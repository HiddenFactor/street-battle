// =====================================================================
// main.js – Start des Spiels und die Spielschleife
// ---------------------------------------------------------------------
// Die Spiellogik läuft mit festen 60 Schritten pro Sekunde (Accumulator).
// Gezeichnet wird so oft, wie der Bildschirm es schafft – unabhängig
// von der Logik.
// =====================================================================

import { Renderer, VIEW_W, VIEW_H } from './render.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { attachKeyboard, onKeyPress, clearInputLatch, TouchInput, GamepadInput } from './input.js';
import { LocalSession, TrainingSession, DemoSession } from './sessions.js';
import { OnlineLobby } from './online.js';
import { CharacterSelect } from './select.js';
import { TouchControls, prefersTouch } from './touch.js';
import { ERRORS } from './net.js';
import { KEYS, LOOK, GAME_VERSION } from './config.js';
import { controlsLines, menuHint } from './controls.js';
import { FrameClock, STEP_MS } from './pacing.js';

const params = new URLSearchParams(location.search);
// ?test: für automatische Tests – kein Auto-Pause, auch im versteckten Tab zeichnen
const TEST_MODE = params.has('test');

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = new UI();
const sound = new Sound();
const touchInput = new TouchInput();
const touch = new TouchControls(touchInput);
const pads = [new GamepadInput(0), new GamepadInput(1)];
const $ = (id) => document.getElementById(id);

let session = new DemoSession();
let paused = false;
const clock = new FrameClock(); // fester Spieltakt (siehe pacing.js)
let last = performance.now();
let fps = 60; // gemessene Bilder pro Sekunde (geglättet)
let lastSecond = -1;
let banner = null; // große Meldung im Bild (z. B. Desync)

renderer.showBoxes = params.has('debug');

// ---------------------------------------------------------------------
// Bildschirmgröße: feste interne Auflösung, mit Rändern eingepasst
// ---------------------------------------------------------------------
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / VIEW_W, vh / VIEW_H);
  const w = Math.floor(VIEW_W * scale);
  const h = Math.floor(VIEW_H * scale);
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  stage.style.setProperty('--u', scale.toFixed(4));
  renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// Ton erst nach der ersten Nutzeraktion möglich (Browser-Regel)
for (const type of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(type, () => sound.unlock(), { capture: true });
}

// ---------------------------------------------------------------------
// Modi starten / beenden
// ---------------------------------------------------------------------
function startSession(next) {
  if (session) session.dispose();
  clearInputLatch();
  session = next;
  paused = false;
  clock.reset();
  lastSecond = -1;
  ui.hide();
  updateChrome();
}

function goToMenu() {
  select.close();
  startSession(new DemoSession());
  ui.show('title');
  updateChrome();
}

function pause() {
  if (session.kind === 'online') {
    // Online gibt es keine Pause – nur "Spiel verlassen?"
    if (ui.current === 'leave') ui.hide();
    else if (!ui.isOpen()) ui.show('leave');
    return;
  }
  if (!session.canPause || paused || ui.isOpen()) return;
  paused = true;
  const training = session.kind === 'training';
  $('btn-dummy').hidden = !training;
  $('btn-hitboxes').hidden = !training;
  if (training) updateTrainingButtons();
  ui.show('pause');
  updateChrome();
}

function resume() {
  paused = false;
  clearInputLatch(); // Tasten, die während der Pause gedrückt wurden, nicht nachträglich auslösen
  clock.reset();
  last = performance.now();
  ui.hide();
  updateChrome();
}

function showMatchEnd(winner) {
  const s = session.state;
  const names = LOOK.PLAYERS.map((p) => p.name);
  let title = winner < 0 ? 'UNENTSCHIEDEN!' : `${names[winner]} GEWINNT!`;
  if (session.kind === 'online' && winner >= 0) title = winner === session.localPlayer ? 'DU GEWINNST!' : 'DU VERLIERST!';
  ui.setText('end-title', title);
  ui.setText('end-score', `${s.wins[0]} : ${s.wins[1]}`);
  ui.setStatus('end-status', '');
  $('btn-rematch').disabled = false;
  ui.show('end');
  updateChrome();
}

// Knöpfe oben: im Menü in die Ecke, im Spiel unter den Timer
function updateChrome() {
  $('btn-pause').hidden = session.kind === 'demo';
  document.body.classList.toggle('in-menu', session.kind === 'demo' || select.active);
  $('btn-mute').textContent = sound.muted ? '🔇' : '🔊';
}

function updateTrainingButtons() {
  ui.setText('btn-dummy', 'Dummy: ' + session.dummy.mode.label);
  ui.setText('btn-hitboxes', 'Hitboxen: ' + (renderer.showBoxes ? 'an' : 'aus'));
}

function toggleHitboxes() {
  renderer.showBoxes = !renderer.showBoxes;
  ui.toast('Hitboxen ' + (renderer.showBoxes ? 'an' : 'aus'));
  if (session.kind === 'training') updateTrainingButtons();
}

function nextDummyMode() {
  if (session.kind !== 'training') return;
  const mode = session.dummy.nextMode();
  ui.toast('Dummy: ' + mode.label);
  updateTrainingButtons();
}

ui.onClick = () => sound.play('menu');

// ---------------------------------------------------------------------
// Charakterwahl (vor jedem Match)
// ---------------------------------------------------------------------
const lastChars = { local: null, training: null, online: null }; // zuletzt gewählt
const select = new CharacterSelect({ ui, sound, touch, onDone: onSelectDone });

function openSelect(mode, initial) {
  select.open({ mode, initial: initial || lastChars[mode] });
  updateChrome();
}

function onSelectDone({ mode, chars }) {
  lastChars[mode] = chars;
  if (mode === 'local') {
    startSession(new LocalSession(touchInput, chars));
    if (touch.enabled) ui.toast('Spieler 2 braucht eine Tastatur (Pfeiltasten) oder ein Gamepad.', 4000);
  } else {
    startSession(new TrainingSession(touchInput, chars));
    ui.toast(touch.enabled ? 'Training: Dummy und Hitboxen im Pause-Menü (❚❚)' : 'Training: T = Dummy wechseln, F1 = Hitboxen', 3500);
  }
}

ui.on('local', () => openSelect('local'));
ui.on('training', () => openSelect('training'));
ui.on('select-back', () => {
  if (session.kind === 'online') {
    goToMenu(); // online: Zurück = Spiel verlassen
    return;
  }
  select.close();
  ui.show('title');
  updateChrome();
});
ui.on('reselect', () => {
  if (session.kind === 'online') session.enterSelect(true); // öffnet die Auswahl über das 'reselect'-Ereignis
  else openSelect(session.kind, session.chars);
});
// ---------------------------------------------------------------------
// Online
// ---------------------------------------------------------------------
const lobby = new OnlineLobby({
  ui,
  sound,
  touch: touchInput,
  botSeed: parseInt(params.get('bot'), 10) || 0,
  onStart: (online) => {
    startSession(online);
    select.open({ mode: 'online', session: online, initial: lastChars.online, bot: !!parseInt(params.get('bot'), 10) });
    updateChrome();
    ui.toast(online.isHost ? 'Verbunden! Du bist Spieler 1 (links).' : 'Verbunden! Du bist Spieler 2 (rechts).', 3500);
  },
  onFail: (key) => {
    const [title, text] = ERRORS[key] || ERRORS.closed;
    sound.play('error');
    select.close();
    startSession(new DemoSession());
    ui.message(title, text, () => ui.show('title'));
  },
});

function showBanner(text, seconds = 3) {
  banner = { text, until: performance.now() + seconds * 1000 };
}

ui.on('online', () => lobby.open());
ui.on('host', () => lobby.host());
ui.on('join', () => lobby.join($('join-code').value));
ui.on('cancel-online', () => lobby.cancel());
ui.on('copy-link', () => lobby.copyLink());
ui.on('share-link', () => lobby.shareLink());
ui.on('stay', () => ui.hide());
ui.on('help', () => ui.show('help'));
ui.on('back', () => ui.show('title'));
ui.on('resume', resume);
ui.on('quit', goToMenu);
ui.on('dummy', nextDummyMode);
ui.on('hitboxes', toggleHitboxes);
ui.on('rematch', () => {
  if (session.kind === 'online') {
    session.rematch();
    $('btn-rematch').disabled = true;
    ui.setStatus('end-status', 'Warte auf deinen Gegner …');
    return;
  }
  session.rematch();
  ui.hide();
  updateChrome();
});

$('btn-pause').addEventListener('click', () => (paused ? resume() : pause()));
$('btn-mute').addEventListener('click', () => {
  sound.unlock();
  sound.toggleMute();
  updateChrome();
  ui.toast(sound.muted ? 'Ton aus' : 'Ton an', 1200);
});
$('btn-fullscreen').addEventListener('click', toggleFullscreen);
// Nach einem Klick den Fokus abgeben – sonst würde die Leertaste (Energieball) den Knopf erneut drücken
$('top-buttons').addEventListener('click', () => document.activeElement && document.activeElement.blur());

function toggleFullscreen() {
  const doc = document;
  const el = doc.documentElement;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    return;
  }
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) {
    ui.toast('Vollbild geht hier nicht. Tipp: „Zum Home-Bildschirm hinzufügen“.', 3500);
    return;
  }
  Promise.resolve(request.call(el))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}

// ---------------------------------------------------------------------
// Tastatur: Pause, Hitboxen, Dummy
// ---------------------------------------------------------------------
attachKeyboard();
onKeyPress((code) => {
  if (KEYS.PAUSE.includes(code) && select.active) {
    ui.emit('select-back');
  } else if (KEYS.PAUSE.includes(code)) {
    if (session.kind === 'online' && (ui.current === 'leave' || !ui.isOpen())) pause();
    else if (paused) resume();
    else if (!ui.isOpen()) pause();
    else if (ui.current === 'help' || ui.current === 'online') ui.show('title');
  } else if (KEYS.HITBOXES.includes(code)) {
    toggleHitboxes();
  } else if (KEYS.DUMMY_MODE.includes(code)) {
    nextDummyMode();
  } else if (code === 'F9' && params.has('debug') && session.debugDesync) {
    session.debugDesync(); // Test: Desync absichtlich auslösen
  }
});

// Gamepad-Start = Pause
const padPausePrev = [false, false];
function pollPadPause() {
  pads.forEach((pad, i) => {
    const now = pad.pausePressed();
    if (now && !padPausePrev[i]) {
      if (paused) resume();
      else pause();
    }
    padPausePrev[i] = now;
  });
}

// Tab im Hintergrund → lokales Spiel pausieren
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if ((session.kind === 'local' || session.kind === 'training') && !TEST_MODE) pause();
  } else {
    last = performance.now();
  }
  schedule();
});

// ---------------------------------------------------------------------
// Spielschleife
// ---------------------------------------------------------------------
function handleEvents() {
  const quiet = session.kind === 'demo';
  for (const e of session.takeEvents()) {
    renderer.onEvent(e);
    if (!quiet) sound.onEvent(e);
    if (e.type === 'matchEnd' && !quiet) showMatchEnd(e.winner);
    if (e.type === 'desync') showBanner('DESYNC – Runde wird neu gestartet');
    if (e.type === 'reselect') {
      // Online: einer will neue Charaktere wählen → beide zurück zur Auswahl
      select.open({ mode: 'online', session, initial: session.state.chars, bot: !!parseInt(params.get('bot'), 10) });
      updateChrome();
    }
    if (e.type === 'sync') {
      if (select.active) {
        select.close();
        ui.hide();
        updateChrome();
      }
      if (session.kind === 'online') lastChars.online = session.state.chars;
      if (e.reason === 'desync') showBanner('DESYNC – Runde wird neu gestartet');
      if (ui.current === 'end' || ui.current === 'leave') ui.hide();
    }
    if (e.type === 'rematchRequest') {
      if (ui.current === 'end') ui.setStatus('end-status', 'Dein Gegner will ein Rematch!');
      else ui.toast('Dein Gegner will ein Rematch!');
    }
  }
  // Countdown-Piepen in den letzten 10 Sekunden
  const s = session.state;
  const sec = Math.ceil(s.timer / 60);
  if (!quiet && !s.training && s.phase === 'fight' && sec !== lastSecond && sec <= 10 && sec > 0) sound.play('tick');
  lastSecond = sec;
}

function frame(now) {
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;
  if (dt < 0) dt = 0;
  if (dt > 0) fps += (1000 / dt - fps) * 0.05;
  if (session.kind === 'online') session.localFps = fps;

  ui.pollGamepads();
  pollPadPause();
  touch.setActive(session.kind !== 'demo' && !ui.isOpen());
  if (select.active) select.update();

  if (!paused && !window.streetBattle.freeze) {
    clock.add(dt);
    // Online: Zeitabgleich mit dem Gegner (minimal schneller/langsamer), sonst 1
    const scale = session.timeScale ? session.timeScale() : 1;
    clock.run(() => {
      const advanced = session.tick(); // false = Eingabe des Gegners fehlt noch → warten statt raten
      clearInputLatch(); // kurze Tipper wurden jetzt gelesen
      return advanced;
    }, scale);
  }

  handleEvents();
  runWaiters();
  if (!document.hidden || TEST_MODE) {
    renderer.draw(select.active ? select.sceneState(renderer.time) : session.state, {
      hud: session.kind !== 'demo' && !select.active,
      select: select.active ? select.view() : null,
      kind: session.kind,
      localPlayer: select.active ? -1 : session.localPlayer,
      dummyLabel: session.kind === 'training' ? session.dummy.mode.label : null,
      net: session.netInfo ? session.netInfo() : null,
      waiting: session.waitingText ? session.waitingText() : null,
      banner: banner && performance.now() < banner.until ? banner.text : null,
      controlsHint: controlsHint(),
      dt,
    });
  }
  schedule();
}

// Tastenbelegung unten im Bild (nicht im Menü und nicht auf Touch-Geräten)
let hintCache = { key: '', lines: null };
function controlsHint() {
  if (!LOOK.SHOW_CONTROLS || session.kind === 'demo' || touch.enabled || select.active) return null;
  const pad = pads.some((p) => p.connected());
  const key = session.kind + pad;
  if (hintCache.key !== key) hintCache = { key, lines: controlsLines(session.kind, pad) };
  return hintCache.lines;
}

// Normalerweise requestAnimationFrame. Ist der Tab versteckt, pausiert der
// Browser das – dann läuft die Logik per Timer weiter (wichtig online).
let loopId = 0;
const testChannel = new MessageChannel();
function schedule() {
  const id = ++loopId;
  const run = (now) => {
    if (id === loopId) frame(now);
  };
  if (TEST_MODE) {
    testTick(run, performance.now());
    return;
  }
  if (!document.hidden) requestAnimationFrame(run);
  // Sicherheitsnetz: falls der Browser requestAnimationFrame anhält
  // (Tab versteckt, Fenster verdeckt), läuft das Spiel per Timer weiter.
  setTimeout(() => run(performance.now()), document.hidden ? STEP_MS : 100);
}

// Nur für automatische Tests: Nachrichten werden im versteckten Tab nicht
// gedrosselt (Timer schon). Ruft frame() etwa 60-mal pro Sekunde auf.
function testTick(run, since) {
  testChannel.port1.onmessage = () => {
    const now = performance.now();
    if (now - since >= STEP_MS - 1) run(now);
    else testTick(run, since);
  };
  testChannel.port2.postMessage(0);
}

// Für Tests: Promise, die nach n Bildern erfüllt wird (Timer werden in
// versteckten Tabs stark gedrosselt, die Spielschleife im Test-Modus nicht)
const waiters = [];
function runWaiters() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (--waiters[i].n <= 0) {
      waiters[i].resolve();
      waiters.splice(i, 1);
    }
  }
}

// Für Tests und Neugierige: in der Browser-Konsole "streetBattle.session.state" eingeben
window.streetBattle = {
  get session() {
    return session;
  },
  renderer,
  ui,
  sound,
  lobby,
  freeze: false, // true = Spiel anhalten, ohne das Pause-Menü (für Tests/Screenshots)
  frames: (n) => new Promise((resolve) => waiters.push({ n, resolve })),
  async until(cond, maxFrames = 1200) {
    for (let i = 0; i < maxFrames && !cond(); i++) await this.frames(1);
    return cond();
  },
  key(code, down) {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  },
};

// Hinweise je nach Gerät
ui.setText('title-hint', prefersTouch() ? 'Tipp: Am Handy am besten „Online“ oder „Training“ spielen.' : menuHint());
ui.setText('version', 'v' + GAME_VERSION);

// Service Worker: lädt Spieldateien immer frisch vom Server (sonst bis zu 10 Min. alte Version)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* z. B. auf itch.io oder ohne https – dann eben ohne */
  });
}
$('btn-fullscreen').hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);

ui.show('title');
updateChrome();
schedule();

// Seite wird geschlossen → dem Gegner Bescheid geben
window.addEventListener('pagehide', () => {
  if (session.kind === 'online') session.dispose();
});

// Einladungslink (?join=CODE) oder automatischer Raum (?autohost, für Tests)
if (params.get('join')) {
  lobby.open();
  $('join-code').value = params.get('join').toUpperCase();
  lobby.join(params.get('join'));
} else if (params.has('autohost')) {
  lobby.open();
  lobby.host();
}
