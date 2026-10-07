// =====================================================================
// main.js – Start des Spiels und die Spielschleife
// ---------------------------------------------------------------------
// Die Spiellogik läuft mit festen 60 Schritten pro Sekunde (Accumulator).
// Gezeichnet wird so oft, wie der Bildschirm es schafft – unabhängig
// von der Logik.
// =====================================================================

import { Renderer, VIEW_W, VIEW_H } from './render.js';
import { UI } from './ui.js';
import { attachKeyboard, onKeyPress, TouchInput, GamepadInput } from './input.js';
import { LocalSession, TrainingSession, DemoSession } from './sessions.js';
import { KEYS, LOOK } from './config.js';

const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;
const params = new URLSearchParams(location.search);

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = new UI();
const touchInput = new TouchInput();
const pads = [new GamepadInput(0), new GamepadInput(1)];

let session = new DemoSession();
let paused = false;
let acc = 0;
let last = performance.now();

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

// ---------------------------------------------------------------------
// Modi starten / beenden
// ---------------------------------------------------------------------
function startSession(next) {
  if (session) session.dispose();
  session = next;
  paused = false;
  acc = 0;
  ui.hide();
  updateTopButtons();
}

function goToMenu() {
  startSession(new DemoSession());
  ui.show('title');
}

function pause() {
  if (!session.canPause || paused || ui.isOpen()) return;
  paused = true;
  const training = session.kind === 'training';
  document.getElementById('btn-dummy').hidden = !training;
  document.getElementById('btn-hitboxes').hidden = !training;
  if (training) updateTrainingButtons();
  ui.show('pause');
}

function resume() {
  paused = false;
  last = performance.now();
  ui.hide();
}

function showMatchEnd(winner) {
  const s = session.state;
  const names = LOOK.PLAYERS.map((p) => p.name);
  ui.setText('end-title', winner < 0 ? 'UNENTSCHIEDEN!' : `${names[winner]} GEWINNT!`);
  ui.setText('end-score', `${s.wins[0]} : ${s.wins[1]}`);
  ui.setStatus('end-status', '');
  document.getElementById('btn-rematch').disabled = false;
  ui.show('end');
}

function updateTopButtons() {
  document.getElementById('btn-pause').hidden = !session.canPause;
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
});

document.getElementById('btn-pause').addEventListener('click', () => (paused ? resume() : pause()));
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);

function toggleFullscreen() {
  const doc = document;
  const el = doc.documentElement;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    return;
  }
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) {
    ui.toast('Vollbild wird hier nicht unterstützt. Tipp: „Zum Home-Bildschirm hinzufügen“.', 3500);
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
    if (session.kind === 'local' || session.kind === 'training') pause();
  } else {
    last = performance.now();
  }
});

// ---------------------------------------------------------------------
// Spielschleife
// ---------------------------------------------------------------------
function handleEvents() {
  const quiet = session.kind === 'demo';
  for (const e of session.takeEvents()) {
    renderer.onEvent(e, quiet);
    if (e.type === 'matchEnd' && !quiet) showMatchEnd(e.winner);
  }
}

function frame(now) {
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;
  if (dt < 0) dt = 0;

  ui.pollGamepads();
  pollPadPause();

  if (!paused) {
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
  renderer.draw(session.state, {
    hud: session.kind !== 'demo',
    kind: session.kind,
    localPlayer: session.localPlayer,
    dt,
    paused,
  });
  requestAnimationFrame(frame);
}

ui.show('title');
requestAnimationFrame(frame);
