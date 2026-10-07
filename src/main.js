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
import { attachKeyboard, onKeyPress, TouchInput, GamepadInput } from './input.js';
import { LocalSession, TrainingSession, DemoSession } from './sessions.js';
import { KEYS, LOOK } from './config.js';

const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;
const params = new URLSearchParams(location.search);
// ?test: für automatische Tests – kein Auto-Pause, auch im versteckten Tab zeichnen
const TEST_MODE = params.has('test');

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = new UI();
const sound = new Sound();
const touchInput = new TouchInput();
const pads = [new GamepadInput(0), new GamepadInput(1)];
const $ = (id) => document.getElementById(id);

let session = new DemoSession();
let paused = false;
let acc = 0;
let last = performance.now();
let lastSecond = -1;

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
  session = next;
  paused = false;
  acc = 0;
  lastSecond = -1;
  ui.hide();
  updateChrome();
}

function goToMenu() {
  startSession(new DemoSession());
  ui.show('title');
  updateChrome();
}

function pause() {
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
  last = performance.now();
  ui.hide();
  updateChrome();
}

function showMatchEnd(winner) {
  const s = session.state;
  const names = LOOK.PLAYERS.map((p) => p.name);
  ui.setText('end-title', winner < 0 ? 'UNENTSCHIEDEN!' : `${names[winner]} GEWINNT!`);
  ui.setText('end-score', `${s.wins[0]} : ${s.wins[1]}`);
  ui.setStatus('end-status', '');
  $('btn-rematch').disabled = false;
  ui.show('end');
  updateChrome();
}

// Knöpfe oben: im Menü in die Ecke, im Spiel unter den Timer
function updateChrome() {
  $('btn-pause').hidden = !session.canPause || session.kind === 'demo';
  document.body.classList.toggle('in-menu', session.kind === 'demo');
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
ui.on('local', () => startSession(new LocalSession(touchInput)));
ui.on('training', () => {
  startSession(new TrainingSession(touchInput));
  ui.toast('Training: T = Dummy wechseln, F1 = Hitboxen', 3500);
});
ui.on('online', () => ui.message('Online', 'Der Online-Modus folgt in Kürze.', () => ui.show('title')));
ui.on('help', () => ui.show('help'));
ui.on('back', () => ui.show('title'));
ui.on('resume', resume);
ui.on('quit', goToMenu);
ui.on('dummy', nextDummyMode);
ui.on('hitboxes', toggleHitboxes);
ui.on('rematch', () => {
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
  if (KEYS.PAUSE.includes(code)) {
    if (paused) resume();
    else if (!ui.isOpen()) pause();
    else if (ui.current === 'help' || ui.current === 'online') ui.show('title');
  } else if (KEYS.HITBOXES.includes(code)) {
    toggleHitboxes();
  } else if (KEYS.DUMMY_MODE.includes(code)) {
    nextDummyMode();
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

  ui.pollGamepads();
  pollPadPause();

  if (!paused && !window.streetBattle.freeze) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      if (!session.tick()) {
        // Online: Eingabe des Gegners fehlt noch → warten statt raten
        acc = Math.min(acc, STEP_MS);
        break;
      }
      acc -= STEP_MS;
      steps++;
    }
    if (steps >= MAX_STEPS_PER_FRAME) acc = 0;
  }

  handleEvents();
  runWaiters();
  if (!document.hidden || TEST_MODE) {
    renderer.draw(session.state, {
      hud: session.kind !== 'demo',
      kind: session.kind,
      localPlayer: session.localPlayer,
      dummyLabel: session.kind === 'training' ? session.dummy.mode.label : null,
      net: session.netInfo ? session.netInfo() : null,
      waiting: session.waitingText ? session.waitingText() : null,
      dt,
    });
  }
  schedule();
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

ui.show('title');
updateChrome();
schedule();
