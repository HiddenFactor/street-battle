// =====================================================================
// lockstep.js – Delay-based Lockstep (Online-Netcode)
// ---------------------------------------------------------------------
// Idee: Beide Geräte rechnen das Spiel komplett selbst. Übers Netz gehen
// nur die Eingaben. Ein Frame wird erst simuliert, wenn die Eingaben
// BEIDER Spieler für diesen Frame da sind – fehlt eine, wird gewartet
// (nicht geraten). Damit das selten passiert, wird die eigene Eingabe mit
// einer kleinen Verzögerung ("delay" Frames) eingeplant.
//
// Diese Datei kennt kein PeerJS und kein DOM: Nachrichten gehen über die
// Funktion send() hinaus und kommen über receive() herein. So lässt sie
// sich in Node mit einem simulierten Netz testen (tests/lockstep.test.js).
//
// Nachrichten (alle mit s = Session-Nummer):
//   sync    {t,s,d,state,reason}  Host → Gast: neue Session ab diesem Zustand
//                                  (Spielstart, Rematch, Neustart nach Desync)
//   in      {t,s,a,f,i,lf}        Eingaben ab Frame f (i = Liste von Masken),
//                                  a = höchster lückenlos empfangener Gegner-Frame,
//                                  lf = aktueller Frame des Absenders (für den Zeitabgleich)
//   cs      {t,s,f,h}             Prüfsumme des Zustands nach Frame f
//   desync  {t,s,f}               Gast → Host: Prüfsummen weichen ab
//   rematch {t,s}                 "Ich will ein Rematch"
// =====================================================================

import { step, checksum, createMatch, resetRound } from './sim.js';
import { NET } from './config.js';
import { ALL_INPUTS } from './buttons.js';

const RESEND_TICKS = 30;     // Steuer-Nachrichten alle 0,5 s wiederholen, bis sie ankommen
const MAX_INPUTS_PER_PACKET = 64;
const STEP_MS = 1000 / 60;

// Zeitabgleich: Zwei Geräte laufen nie exakt gleich schnell (Uhren, Bildschirm-Takt).
// Ohne Abgleich läuft das schnellere voraus, bis es immer wieder kurz warten muss (Ruckler).
// Deshalb wird das vorauslaufende Gerät minimal gebremst und das hinterherlaufende minimal
// beschleunigt – höchstens um SYNC_MAX (3 %), das sieht man nicht.
// Erst ab einem ganzen Frame Vorsprung eingreifen: Bruchteile davon sind nur der feste Versatz
// zwischen den Bildschirm-Takten der beiden Geräte und lassen sich nicht wegregeln.
const SYNC_SMOOTHING = 0.1;  // wie schnell der gemessene Vorsprung nachgeführt wird
const SYNC_DEADBAND = 1;     // so viel Vorsprung (in Frames) ist egal
const SYNC_GAIN = 0.01;      // Tempo-Änderung pro Frame Vorsprung (über der Totzone)
const SYNC_MAX = 0.03;

export class Lockstep {
  /**
   * isHost: Host = Spieler 1 (links), Gast = Spieler 2
   * send:   Funktion, die eine Nachricht (Objekt) an den Gegner schickt
   * now:    Uhr in Millisekunden (Browser: performance.now; Tests: künstliche Zeit)
   */
  constructor({ isHost, send, now }) {
    this.isHost = isHost;
    this.now = now || (() => 0);
    this.local = isHost ? 0 : 1;
    this.send = send;
    this.session = 0;            // 0 = noch nicht gestartet
    this.state = null;
    this.delay = NET.DEFAULT_DELAY;
    this.frame = 0;              // nächster zu simulierender Frame dieser Session
    this.localInputs = new Map();
    this.remoteInputs = new Map();
    this.localScheduled = -1;    // höchster Frame mit eingeplanter eigener Eingabe
    this.remoteAck = -1;         // bis hierhin hat der Gegner unsere Eingaben lückenlos
    this.remoteContig = -1;      // bis hierhin haben wir seine Eingaben lückenlos
    this.localHashes = new Map();
    this.remoteHashes = new Map();
    this.events = [];            // Spiel-Ereignisse für Grafik/Sound + 'sync'/'desync'
    this.pendingSync = null;     // Host: sync wiederholen, bis der Gast mitmacht
    this.pendingDesync = null;   // Gast: Desync-Meldung wiederholen
    this.resendTimer = 0;
    this.rematchLocal = false;
    this.rematchRemote = false;
    this.desyncCount = 0;
    this.checksumsCompared = 0;
    this.started = false;
    this.remoteFrame = 0;        // zuletzt gemeldeter Frame des Gegners
    this.remoteFrameAt = 0;      // wann diese Meldung ankam (ms)
    this.advantage = 0;          // geglätteter Vorsprung vor dem Gegner (in Frames)
    this.ticksOk = 0;            // Statistik: Ticks mit / ohne Fortschritt
    this.ticksWaiting = 0;
  }

  // -------------------------------------------------------------------
  // Session starten
  // -------------------------------------------------------------------
  /** Nur Host: neue Session ab state starten (und dem Gast schicken). */
  hostStart(state, delay, reason) {
    const msg = { t: 'sync', s: this.session + 1, d: delay, state, reason };
    this.applySync(msg);
    this.pendingSync = msg;
    this.send(msg);
  }

  applySync(msg) {
    this.session = msg.s;
    this.delay = msg.d;
    this.state = JSON.parse(JSON.stringify(msg.state)); // eigene Kopie
    this.frame = 0;
    this.localInputs.clear();
    this.remoteInputs.clear();
    this.localHashes.clear();
    this.remoteHashes.clear();
    this.remoteAck = -1;
    this.remoteContig = -1;
    // Die ersten "delay" Frames hat niemand etwas gedrückt
    for (let f = 0; f < this.delay; f++) this.localInputs.set(f, 0);
    this.localScheduled = this.delay - 1;
    this.rematchLocal = false;
    this.rematchRemote = false;
    this.pendingDesync = null;
    this.started = true;
    this.remoteFrame = 0;
    this.remoteFrameAt = this.now();
    this.advantage = 0;
    for (const e of this.state.events) this.events.push(e);
    this.events.push({ type: 'sync', reason: msg.reason, session: msg.s });
  }

  // -------------------------------------------------------------------
  // Ein Tick (60-mal pro Sekunde). Gibt true zurück, wenn simuliert wurde.
  // oneWayMs: geschätzte Laufzeit einer Nachricht (halber Ping) für den Zeitabgleich
  // -------------------------------------------------------------------
  tick(localInput, oneWayMs = 0) {
    if (!this.session) return false;
    this.resendControl();

    // Eigene Eingabe für Frame (jetzt + delay) einplanen
    const target = this.frame + this.delay;
    if (this.localScheduled < target) {
      this.localInputs.set(target, localInput & ALL_INPUTS);
      this.localScheduled = target;
    }

    let advanced = false;
    if (this.localInputs.has(this.frame) && this.remoteInputs.has(this.frame)) {
      const mine = this.localInputs.get(this.frame);
      const theirs = this.remoteInputs.get(this.frame);
      const p1 = this.local === 0 ? mine : theirs;
      const p2 = this.local === 0 ? theirs : mine;
      this.state = step(this.state, p1, p2);
      for (const e of this.state.events) this.events.push(e);
      this.frame++;
      advanced = true;

      // Regelmäßig Prüfsummen vergleichen
      if (this.frame % NET.CHECKSUM_INTERVAL === 0) {
        const h = checksum(this.state);
        this.localHashes.set(this.frame, h);
        this.send({ t: 'cs', s: this.session, f: this.frame, h });
        this.compareHashes(this.frame);
      }
      // Alte Eingaben vergessen
      this.localInputs.delete(this.frame - 70);
      this.remoteInputs.delete(this.frame - 70);
    }

    // Vorsprung vor dem Gegner messen (für timeScale): Frame des Gegners laut letzter Meldung,
    // plus die Zeit, die seitdem vergangen ist (Laufzeit + Alter der Meldung)
    const age = oneWayMs + Math.max(0, this.now() - this.remoteFrameAt);
    const remoteNow = this.remoteFrame + Math.min(age, 10 * STEP_MS) / STEP_MS;
    this.advantage += (this.frame - remoteNow - this.advantage) * SYNC_SMOOTHING;
    if (advanced) this.ticksOk++;
    else this.ticksWaiting++;

    this.sendInputs();
    return advanced;
  }

  /**
   * Faktor für die Länge eines Spielschritts: > 1 = etwas langsamer (wir sind voraus),
   * < 1 = etwas schneller (wir hängen hinterher), 1 = passt.
   */
  timeScale() {
    if (!this.session) return 1;
    const a = this.advantage;
    if (Math.abs(a) < SYNC_DEADBAND) return 1;
    const over = a - Math.sign(a) * SYNC_DEADBAND + Math.sign(a) * 0.5; // mind. ein halber Schritt
    return 1 + Math.max(-SYNC_MAX, Math.min(SYNC_MAX, over * SYNC_GAIN));
  }

  sendInputs() {
    let from = Math.min(this.remoteAck + 1, this.localScheduled - NET.REDUNDANCY + 1);
    from = Math.max(0, from, this.localScheduled - MAX_INPUTS_PER_PACKET + 1);
    const inputs = [];
    for (let f = from; f <= this.localScheduled; f++) inputs.push(this.localInputs.has(f) ? this.localInputs.get(f) : 0);
    this.send({ t: 'in', s: this.session, a: this.remoteContig, f: from, i: inputs, lf: this.frame });
  }

  resendControl() {
    if (++this.resendTimer < RESEND_TICKS) return;
    this.resendTimer = 0;
    if (this.pendingSync) this.send(this.pendingSync);
    if (this.pendingDesync) this.send(this.pendingDesync);
    if (this.rematchLocal) this.send({ t: 'rematch', s: this.session });
  }

  // -------------------------------------------------------------------
  // Nachrichten vom Gegner
  // -------------------------------------------------------------------
  receive(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'sync':
        if (!this.isHost && msg.s > this.session) this.applySync(msg);
        break;
      case 'in': {
        if (msg.s !== this.session || !Array.isArray(msg.i)) return; // alte oder zu neue Session
        if (this.pendingSync && this.pendingSync.s === msg.s) this.pendingSync = null; // Gast ist dabei
        for (let k = 0; k < msg.i.length; k++) {
          const f = msg.f + k;
          if (f >= this.frame && !this.remoteInputs.has(f)) this.remoteInputs.set(f, msg.i[k] & ALL_INPUTS);
        }
        while (this.remoteInputs.has(this.remoteContig + 1) || this.remoteContig + 1 < this.frame) this.remoteContig++;
        if (msg.a > this.remoteAck) this.remoteAck = msg.a;
        if (typeof msg.lf === 'number' && msg.lf > this.remoteFrame) {
          this.remoteFrame = msg.lf;
          this.remoteFrameAt = this.now();
        }
        break;
      }
      case 'cs':
        if (msg.s !== this.session) return;
        this.remoteHashes.set(msg.f, msg.h);
        this.compareHashes(msg.f);
        break;
      case 'desync':
        if (this.isHost && msg.s === this.session) this.recover();
        break;
      case 'rematch':
        if (msg.s !== this.session) return;
        this.rematchRemote = true;
        this.events.push({ type: 'rematchRequest' });
        this.checkRematch();
        break;
    }
  }

  compareHashes(f) {
    if (!this.localHashes.has(f) || !this.remoteHashes.has(f)) return;
    const same = this.localHashes.get(f) === this.remoteHashes.get(f);
    this.checksumsCompared++;
    this.localHashes.delete(f);
    this.remoteHashes.delete(f);
    if (same) return;
    // DESYNC: Die Spiele laufen auseinander
    this.desyncCount++;
    this.events.push({ type: 'desync', frame: f });
    if (this.isHost) this.recover();
    else {
      this.pendingDesync = { t: 'desync', s: this.session, f };
      this.send(this.pendingDesync);
    }
  }

  /** Host: Runde neu starten (Rundenstand bleibt) und Zustand an den Gast schicken. */
  recover() {
    this.hostStart(resetRound(this.state), this.delay, 'desync');
  }

  // -------------------------------------------------------------------
  // Rematch: beide müssen zustimmen, dann startet der Host neu
  // -------------------------------------------------------------------
  requestRematch() {
    if (!this.state || this.state.phase !== 'matchEnd' || this.rematchLocal) return;
    this.rematchLocal = true;
    this.send({ t: 'rematch', s: this.session });
    this.checkRematch();
  }

  checkRematch() {
    if (this.isHost && this.rematchLocal && this.rematchRemote) {
      // Rematch mit denselben Charakteren
      this.hostStart(createMatch({ chars: this.state.chars }), this.delay, 'rematch');
    }
  }

  takeEvents() {
    const list = this.events;
    this.events = [];
    return list;
  }

  /** Nur zum Testen: den eigenen Zustand absichtlich verfälschen. */
  corrupt() {
    if (this.state) this.state = { ...this.state, fighters: this.state.fighters.map((f, i) => (i === 0 ? { ...f, x: f.x + 777 } : f)) };
  }
}
