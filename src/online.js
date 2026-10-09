// =====================================================================
// online.js – Online-Lobby und Online-Spiel
// ---------------------------------------------------------------------
// OnlineLobby:   "Raum erstellen" / "Beitreten" bis die Verbindung steht
// OnlineSession: das laufende Online-Spiel (Lockstep + Ping + Abbrüche)
// =====================================================================

import { Lockstep } from './lockstep.js';
import { createMatch, checksum } from './sim.js';
import { GAME_VERSION, NET, KEYS, CHARACTERS, CHARACTER_ORDER, gameplayConfig } from './config.js';
import { KeyboardInput, GamepadInput, BotInput, combine } from './input.js';
import { Net, ERRORS, loadPeerJS, makeRoomCode, cleanCode, isValidCode } from './net.js';

/** Prüfsumme der Spielwerte – muss bei beiden Spielern gleich sein. */
export const CONFIG_HASH = checksum(gameplayConfig());

const DELAY_KEY = 'streetbattle-delay';
const LOBBY_KEY = 'streetbattle-lobby'; // fester Lobby-Code dieses Geräts (nur hier gespeichert)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadDelay() {
  try {
    const v = parseInt(localStorage.getItem(DELAY_KEY), 10);
    if (v >= NET.MIN_DELAY && v <= NET.MAX_DELAY) return v;
  } catch {
    /* kein Speicher */
  }
  return NET.DEFAULT_DELAY;
}

function saveDelay(v) {
  try {
    localStorage.setItem(DELAY_KEY, String(v));
  } catch {
    /* egal */
  }
}

// =====================================================================
// Das laufende Online-Spiel
// =====================================================================
export class OnlineSession {
  constructor({ net, isHost, delay, touch, botSeed, onFail }) {
    this.kind = 'online';
    this.canPause = false;
    this.isHost = isHost;
    this.localPlayer = isHost ? 0 : 1;
    this.net = net;
    this.delay = delay;
    this.onFail = onFail;
    this.events = [];
    this.failed = false;
    this.gotHello = false;
    this.ping = -1;
    this.pings = [];          // letzte Ping-Messungen (für die Verzögerungs-Empfehlung)
    this.localFps = 60;       // setzt main.js
    this.remoteFps = 0;       // meldet der Gegner
    this.waitPercent = 0;     // Anteil der Bilder, in denen auf den Gegner gewartet wurde
    this.lastTicks = { ok: 0, waiting: 0 };
    this.remoteHidden = false;
    // Charakterwahl: erst wählen beide, dann startet der Host das Match
    this.mode = 'select';                     // 'select' oder 'play'
    this.localPick = { char: CHARACTER_ORDER[0], ready: false, n: 0 };
    this.remotePick = null;                   // { char, ready, n } vom Gegner
    this.reselectSession = -1;
    this.lastReceive = performance.now();
    this.lastAdvance = performance.now();
    this.placeholder = createMatch();
    this.lockstep = new Lockstep({ isHost, send: (m) => net.send(m), now: () => performance.now() });
    const me = this.localPlayer;
    this.input = botSeed
      ? new BotInput(botSeed, () => this.state.fighters[me], () => this.state.fighters[1 - me])
      : combine(new KeyboardInput(KEYS.P1), new KeyboardInput(KEYS.P2), new GamepadInput(0), touch);

    net.onData = (msg) => this.receive(msg);
    net.onError = (key) => this.fail(key);
    this.hello();
    this.pingTimer = setInterval(() => this.sendPing(), NET.PING_INTERVAL_MS);
  }

  get state() {
    return this.lockstep.state || this.placeholder;
  }

  hello() {
    this.net.send({ t: 'hello', v: GAME_VERSION, cfg: CONFIG_HASH });
  }

  sendPing() {
    if (this.failed) return;
    const pk = this.localPick;
    this.net.send({
      t: 'ping', ts: performance.now(), hid: document.hidden, fps: Math.round(this.localFps),
      v: GAME_VERSION, cfg: CONFIG_HASH,
      pk: { c: pk.char, r: pk.ready, n: pk.n }, // Charakterwahl (falls eine Nachricht verloren ging)
    });
    // Wie oft musste in der letzten Sekunde gewartet werden?
    const ls = this.lockstep;
    const ok = ls.ticksOk - this.lastTicks.ok;
    const waiting = ls.ticksWaiting - this.lastTicks.waiting;
    this.lastTicks = { ok: ls.ticksOk, waiting: ls.ticksWaiting };
    this.waitPercent = ok + waiting > 0 ? (100 * waiting) / (ok + waiting) : 0;
    if (performance.now() - this.lastReceive > NET.DISCONNECT_TIMEOUT_MS) this.fail('lost');
  }

  receive(msg) {
    if (this.failed || !msg) return;
    this.lastReceive = performance.now();
    switch (msg.t) {
      case 'hello':
      case 'ping':
        if (msg.t === 'ping') {
          this.net.send({ t: 'pong', ts: msg.ts });
          this.remoteHidden = !!msg.hid;
          if (typeof msg.fps === 'number') this.remoteFps = msg.fps;
          if (msg.pk) this.receivePick(msg.pk);
        }
        if (!this.gotHello) {
          if (msg.v !== GAME_VERSION || msg.cfg !== CONFIG_HASH) {
            this.hello(); // damit der andere es auch merkt
            this.fail('version');
            return;
          }
          this.gotHello = true;
          this.maybeStart();
        }
        break;
      case 'pick':
        this.receivePick(msg);
        break;
      case 'reselect':
        // Gegner will neue Charaktere wählen (nur für die laufende Session)
        if (msg.s === this.lockstep.session && this.mode === 'play') this.enterSelect(false);
        break;
      case 'pong': {
        const rtt = performance.now() - msg.ts;
        this.ping = this.ping < 0 ? rtt : this.ping * 0.7 + rtt * 0.3;
        this.pings.push(rtt);
        if (this.pings.length > 10) this.pings.shift();
        break;
      }
      case 'bye':
        this.fail('left');
        break;
      case 'busy':
        this.fail('busy');
        break;
      default:
        this.lockstep.receive(msg);
    }
  }

  // -------------------------------------------------------------------
  // Charakterwahl online
  // -------------------------------------------------------------------
  /** Eigene Wahl melden (char = Charakter, ready = bestätigt) */
  sendPick(char, ready) {
    this.localPick = { char, ready, n: this.localPick.n + 1 };
    this.net.send({ t: 'pick', c: char, r: ready, n: this.localPick.n });
    this.maybeStart();
  }

  receivePick(msg) {
    if (!CHARACTERS[msg.c] || typeof msg.n !== 'number') return;
    if (this.remotePick && msg.n <= this.remotePick.n) return; // veraltet (Pakete können sich überholen)
    this.remotePick = { char: msg.c, ready: !!msg.r, n: msg.n };
    this.maybeStart();
  }

  /** Host: Sind beide bereit? Dann Match mit beiden Charakteren starten */
  maybeStart() {
    if (!this.isHost || this.mode !== 'select' || !this.gotHello) return;
    if (!this.localPick.ready || !this.remotePick || !this.remotePick.ready) return;
    this.mode = 'play';
    const chars = [this.localPick.char, this.remotePick.char]; // Host = Spieler 1
    this.lockstep.hostStart(createMatch({ chars }), this.delay, 'start');
  }

  /** Zurück zur Charakterwahl (nach einem Match). tell = dem Gegner Bescheid sagen */
  enterSelect(tell = true) {
    this.mode = 'select';
    this.localPick = { ...this.localPick, ready: false, n: this.localPick.n + 1 };
    if (this.remotePick) this.remotePick = { ...this.remotePick, ready: false };
    if (tell) this.net.send({ t: 'reselect', s: this.lockstep.session });
    this.net.send({ t: 'pick', c: this.localPick.char, r: false, n: this.localPick.n });
    this.events.push({ type: 'reselect' });
  }

  tick() {
    if (this.failed) return false;
    const oneWayMs = this.ping > 0 ? this.ping / 2 : 0;
    const advanced = this.lockstep.tick(this.input.read(), oneWayMs);
    for (const e of this.lockstep.takeEvents()) {
      // Gast: Das Match beginnt, sobald der Start-Zustand vom Host da ist
      if (e.type === 'sync') this.mode = 'play';
      this.events.push(e);
    }
    if (advanced) this.lastAdvance = performance.now();
    return advanced;
  }

  takeEvents() {
    const list = this.events;
    this.events = [];
    return list;
  }

  /** Text für "Warte auf Gegner ..." (oder null, wenn alles läuft) */
  waitingText() {
    if (this.failed || this.mode === 'select') return null;
    if (!this.lockstep.session) return 'Verbinde';
    if (performance.now() - this.lastAdvance < NET.WAIT_MESSAGE_MS) return null;
    return this.remoteHidden ? 'Gegner hat den Tab gewechselt' : 'Warte auf Gegner';
  }

  /** Zeitabgleich: Faktor für die Länge eines Spielschritts (siehe lockstep.js) */
  timeScale() {
    return this.lockstep.timeScale();
  }

  /**
   * Empfohlene Verzögerung: halber Ping + Schwankung + etwas Reserve, mindestens 2 Frames
   * (1 Frame ist im WLAN fast immer zu knapp).
   */
  recommendedDelay() {
    if (this.pings.length < 3) return 0;
    const sorted = [...this.pings].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const jitter = sorted[sorted.length - 1] - sorted[0];
    const frames = Math.ceil((median / 2 + jitter + 6) / (1000 / 60));
    return Math.max(2, Math.min(NET.MAX_DELAY, frames));
  }

  netInfo() {
    return {
      ping: this.ping,
      delay: this.lockstep.delay,
      recommended: this.recommendedDelay(),
      waitPercent: this.waitPercent,
      fps: this.localFps,
      remoteFps: this.remoteFps,
    };
  }

  rematch() {
    this.lockstep.requestRematch();
  }

  fail(key) {
    if (this.failed) return;
    this.failed = true;
    clearInterval(this.pingTimer);
    this.net.close();
    if (this.onFail) this.onFail(key);
  }

  dispose() {
    clearInterval(this.pingTimer);
    if (!this.failed) {
      this.failed = true;
      this.net.send({ t: 'bye' });
      const net = this.net;
      setTimeout(() => net.close(), 300); // "bye" noch rausschicken lassen
    }
  }

  /** Nur zum Testen: Desync absichtlich auslösen */
  debugDesync() {
    this.lockstep.corrupt();
  }
}

// =====================================================================
// Die Lobby: Raum erstellen oder beitreten
// =====================================================================
export class OnlineLobby {
  /**
   * ui, sound: aus main.js
   * onStart(session): wird mit der fertigen OnlineSession aufgerufen
   * onFail(key): Online-Spiel bricht ab
   */
  constructor({ ui, sound, touch, onStart, onFail, botSeed }) {
    this.ui = ui;
    this.sound = sound;
    this.touch = touch;
    this.onStart = onStart;
    this.onFail = onFail;
    this.botSeed = botSeed || 0;
    this.net = null;
    this.code = '';
    this.delay = loadDelay();

    const slider = document.getElementById('delay');
    slider.min = NET.MIN_DELAY;
    slider.max = NET.MAX_DELAY;
    slider.value = this.delay;
    ui.setText('delay-value', String(this.delay));
    slider.addEventListener('input', () => {
      this.delay = parseInt(slider.value, 10);
      ui.setText('delay-value', String(this.delay));
      saveDelay(this.delay);
    });
    const codeInput = document.getElementById('join-code');
    codeInput.addEventListener('input', () => {
      const clean = cleanCode(codeInput.value).slice(0, NET.CODE_LENGTH);
      if (codeInput.value !== clean) codeInput.value = clean;
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.join(codeInput.value);
    });
    document.getElementById('btn-share').hidden = !navigator.share;

    // Test "feste Lobby": nur ein Knopf, Beitreten läuft über den Link
    if (NET.FIXED_LOBBY) {
      ui.setText('host-panel-title', 'Deine Lobby');
      ui.setText('host-panel-text', 'Öffne deine Lobby und schick deinem Gegner den Link – er bleibt immer gleich.');
      ui.setText('btn-host', 'Lobby öffnen');
      document.getElementById('join-panel').hidden = true;
      ui.setText('host-title', 'Deine Lobby ist offen');
      ui.setText('host-text', 'Schick deinem Gegner diesen Link. Er bleibt immer gleich – wer ihn öffnet, landet direkt hier:');
      document.getElementById('room-code').hidden = true;
      document.getElementById('btn-new-lobby').hidden = false;
    }
  }

  // Fester Lobby-Code: einmal erzeugen, dann auf diesem Gerät merken
  lobbyCode() {
    try {
      const saved = localStorage.getItem(LOBBY_KEY);
      if (saved && saved.length === NET.LOBBY_CODE_LENGTH && isValidCode(saved)) return saved;
      const code = makeRoomCode(NET.LOBBY_CODE_LENGTH);
      localStorage.setItem(LOBBY_KEY, code);
      return code;
    } catch {
      // kein Speicher (privates Fenster): gilt dann nur, solange die Seite offen ist
      if (!this.tempLobby) this.tempLobby = makeRoomCode(NET.LOBBY_CODE_LENGTH);
      return this.tempLobby;
    }
  }

  /** Neuer Lobby-Code – der alte Link gilt danach nicht mehr */
  newLobby() {
    try {
      localStorage.removeItem(LOBBY_KEY);
    } catch {
      /* egal */
    }
    this.tempLobby = null;
    this.host().then(() => {
      if (this.ui.current === 'host') this.ui.toast('Neuer Link erstellt – der alte gilt nicht mehr.', 3500);
    });
  }

  open() {
    this.cancel(false);
    this.ui.show('online');
    this.ui.setStatus('online-status', 'Lade Online-Modul …');
    loadPeerJS().then(
      () => this.ui.current === 'online' && this.ui.setStatus('online-status',
        NET.FIXED_LOBBY ? 'Bereit. Öffne deine Lobby.' : 'Bereit. Erstelle einen Raum oder tritt mit einem Code bei.'),
      () => this.ui.current === 'online' && this.ui.setStatus('online-status', ERRORS.load[1], true),
    );
  }

  async host() {
    this.cancel(false);
    this.ui.setStatus('online-status', NET.FIXED_LOBBY ? 'Öffne Lobby …' : 'Erstelle Raum …');
    for (let attempt = 0; attempt < 4; attempt++) {
      // Feste Lobby: immer derselbe Code. Ist er noch belegt (z. B. gerade neu geladen),
      // gibt der Server ihn nach kurzer Zeit frei → kurz warten und nochmal.
      const code = NET.FIXED_LOBBY ? this.lobbyCode() : makeRoomCode();
      const net = new Net();
      this.net = net;
      try {
        await net.host(code);
      } catch (err) {
        net.close();
        if (this.net !== net) return; // inzwischen abgebrochen
        if (err.key === 'taken') {
          if (NET.FIXED_LOBBY) await wait(2000);
          if (this.net !== net) return;
          continue;
        }
        this.showError(err.key || 'server');
        return;
      }
      if (this.net !== net) return;
      this.code = code;
      this.ui.setText('room-code', code);
      this.ui.setText('invite-link', this.inviteLink());
      this.ui.setStatus('host-status', 'Warte auf Mitspieler …');
      this.ui.show('host');
      net.onError = (key) => this.showError(key);
      net.onOpen = () => this.connected(net, true);
      return;
    }
    this.showError(NET.FIXED_LOBBY ? 'lobbyTaken' : 'server');
  }

  /**
   * Einem Raum / einer Lobby beitreten.
   * retry = true (Einladungslink bei fester Lobby): ist die Lobby noch zu, alle paar Sekunden erneut nachsehen.
   */
  async join(text, retry = false) {
    const code = cleanCode(text);
    if (!isValidCode(code)) {
      this.ui.setStatus('online-status', `Der Code hat ${NET.CODE_LENGTH} Zeichen (Buchstaben A–Z und Zahlen 2–9).`, true);
      this.sound.play('error');
      return;
    }
    this.cancel(false);
    this.ui.show('connecting');
    const what = NET.FIXED_LOBBY ? 'Lobby' : `Raum ${code}`;
    this.ui.setStatus('connect-status', `Suche ${what} …`);
    for (;;) {
      const net = new Net();
      this.net = net;
      try {
        await net.join(code);
      } catch (err) {
        if (this.net !== net) return; // abgebrochen
        if (retry && err.key === 'notFound') {
          this.ui.setStatus('connect-status', 'Die Lobby ist noch nicht offen – ich warte und versuche es weiter …');
          await wait(NET.JOIN_RETRY_MS);
          if (this.net !== net) return; // während des Wartens abgebrochen
          continue;
        }
        this.showError(err.key || 'server');
        return;
      }
      if (this.net !== net) return;
      this.connected(net, false);
      return;
    }
  }

  connected(net, isHost) {
    this.net = null; // gehört jetzt der Session
    this.sound.play('connect');
    const session = new OnlineSession({
      net,
      isHost,
      delay: this.delay,
      touch: this.touch,
      botSeed: this.botSeed,
      onFail: (key) => this.onFail(key),
    });
    this.onStart(session);
  }

  cancel(showLobby = true) {
    if (this.net) this.net.close();
    this.net = null;
    if (showLobby) this.ui.show('online');
  }

  showError(key) {
    if (this.net) this.net.close();
    this.net = null;
    const [title, text] = ERRORS[key] || ERRORS.server;
    this.sound.play('error');
    this.ui.message(title, text, () => this.open());
  }

  inviteLink() {
    return `${location.origin}${location.pathname}?join=${this.code}`;
  }

  copyLink() {
    const link = this.inviteLink();
    const done = () => this.ui.toast('Link kopiert! Schick ihn deinem Gegner.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, () => window.prompt('Link zum Kopieren:', link));
    } else {
      window.prompt('Link zum Kopieren:', link);
    }
  }

  shareLink() {
    if (!navigator.share) return this.copyLink();
    const text = NET.FIXED_LOBBY ? 'Kämpf gegen mich in Street Battle!' : `Kämpf gegen mich! Raumcode: ${this.code}`;
    navigator.share({ title: 'Street Battle', text, url: this.inviteLink() }).catch(() => {});
  }
}
