// =====================================================================
// input.js – Eingabequellen (austauschbar)
// ---------------------------------------------------------------------
// Jede Quelle hat eine Methode read(), die die aktuelle Eingabe als
// Bitmaske liefert (siehe buttons.js). So ist es dem Spiel egal, ob ein
// Spieler mit Tastatur, Gamepad, Touch oder übers Netzwerk spielt.
// =====================================================================

import { KEYS, GAMEPAD } from './config.js';
import { UP, DOWN, LEFT, RIGHT, LIGHT, HEAVY, SPECIAL } from './buttons.js';

export * from './buttons.js';

const BIT_OF = { up: UP, down: DOWN, left: LEFT, right: RIGHT, light: LIGHT, heavy: HEAVY, special: SPECIAL };

// ---------------------------------------------------------------------
// Tastatur
// ---------------------------------------------------------------------
const keysDown = new Set();
const keyListeners = [];
let keyboardAttached = false;

// Alle Tasten, die das Spiel benutzt (damit z. B. Pfeiltasten nicht scrollen)
const GAME_CODES = new Set(
  [KEYS.P1, KEYS.P2].flatMap((map) => Object.values(map).flat()).concat(KEYS.PAUSE, KEYS.HITBOXES, KEYS.DUMMY_MODE)
);

function isTypingTarget(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/** Tastatur-Ereignisse einmalig abonnieren. */
export function attachKeyboard() {
  if (keyboardAttached) return;
  keyboardAttached = true;
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (GAME_CODES.has(e.code)) e.preventDefault();
    if (!e.repeat) for (const fn of keyListeners) fn(e.code);
    keysDown.add(e.code);
  });
  window.addEventListener('keyup', (e) => keysDown.delete(e.code));
  // Fenster verliert den Fokus → alle Tasten loslassen (sonst "klemmen" sie)
  window.addEventListener('blur', () => keysDown.clear());
}

/** Wird bei jedem neuen Tastendruck aufgerufen (für Menü, Pause, F1 ...). */
export function onKeyPress(fn) {
  keyListeners.push(fn);
}

export function isKeyDown(code) {
  return keysDown.has(code);
}

export class KeyboardInput {
  /** map: z. B. KEYS.P1 aus config.js */
  constructor(map) {
    this.map = map;
  }
  read() {
    let mask = 0;
    for (const [name, codes] of Object.entries(this.map)) {
      if (codes.some((c) => keysDown.has(c))) mask |= BIT_OF[name];
    }
    return mask;
  }
}

// ---------------------------------------------------------------------
// Gamepad (Gamepad API, "Standard-Layout")
// ---------------------------------------------------------------------
function getPad(index) {
  if (!navigator.getGamepads) return null;
  const pads = Array.from(navigator.getGamepads()).filter(Boolean);
  return pads[index] || null;
}

function anyPressed(pad, list) {
  return list.some((b) => pad.buttons[b] && pad.buttons[b].pressed);
}

export class GamepadInput {
  /** index: 0 = erstes angeschlossenes Gamepad, 1 = zweites ... */
  constructor(index) {
    this.index = index;
  }
  connected() {
    return !!getPad(this.index);
  }
  read() {
    const pad = getPad(this.index);
    if (!pad) return 0;
    const dz = GAMEPAD.STICK_DEADZONE;
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    let mask = 0;
    if (anyPressed(pad, [12]) || ay < -dz) mask |= UP;
    if (anyPressed(pad, [13]) || ay > dz) mask |= DOWN;
    if (anyPressed(pad, [14]) || ax < -dz) mask |= LEFT;
    if (anyPressed(pad, [15]) || ax > dz) mask |= RIGHT;
    if (anyPressed(pad, GAMEPAD.LIGHT)) mask |= LIGHT;
    if (anyPressed(pad, GAMEPAD.HEAVY)) mask |= HEAVY;
    if (anyPressed(pad, GAMEPAD.SPECIAL)) mask |= SPECIAL;
    return mask;
  }
  /** Start-Knopf gedrückt? (für Pause) */
  pausePressed() {
    const pad = getPad(this.index);
    return !!pad && anyPressed(pad, GAMEPAD.PAUSE);
  }
}

// ---------------------------------------------------------------------
// Touch: die Bitmaske wird von touch.js gesetzt
// ---------------------------------------------------------------------
export class TouchInput {
  constructor() {
    this.mask = 0;
  }
  read() {
    return this.mask;
  }
}

// ---------------------------------------------------------------------
// Netzwerk: Eingaben des Gegners, Frame für Frame gespeichert
// ---------------------------------------------------------------------
export class NetworkInput {
  constructor() {
    this.frames = new Map();
  }
  set(frame, mask) {
    if (!this.frames.has(frame)) this.frames.set(frame, mask);
  }
  has(frame) {
    return this.frames.has(frame);
  }
  read(frame) {
    return this.frames.get(frame) || 0;
  }
  /** Alte Frames vergessen (Speicher sparen) */
  forgetBefore(frame) {
    for (const f of this.frames.keys()) if (f < frame) this.frames.delete(f);
  }
}

// ---------------------------------------------------------------------
// Trainings-Dummy: steht, duckt, blockt oder springt
// ---------------------------------------------------------------------
export const DUMMY_MODES = [
  { id: 'stand', label: 'Stehen' },
  { id: 'crouch', label: 'Ducken' },
  { id: 'block', label: 'Blocken (stehend)' },
  { id: 'crouchblock', label: 'Blocken (geduckt)' },
  { id: 'jump', label: 'Springen' },
];

export class DummyInput {
  /** getFighter: Funktion, die den Dummy-Kämpfer aus dem aktuellen Zustand liefert */
  constructor(getFighter) {
    this.getFighter = getFighter;
    this.modeIndex = 0;
  }
  get mode() {
    return DUMMY_MODES[this.modeIndex];
  }
  nextMode() {
    this.modeIndex = (this.modeIndex + 1) % DUMMY_MODES.length;
    return this.mode;
  }
  read() {
    const f = this.getFighter();
    const back = f && f.facing > 0 ? LEFT : RIGHT;
    switch (this.mode.id) {
      case 'crouch': return DOWN;
      case 'block': return back;
      case 'crouchblock': return DOWN | back;
      case 'jump': return UP;
      default: return 0;
    }
  }
}

// ---------------------------------------------------------------------
// Computer-Gegner für die Menü-Demo und automatische Tests
// (benutzt eigenen Zufall – das ist erlaubt, denn die Simulation sieht
// nur die fertige Bitmaske)
// ---------------------------------------------------------------------
export class BotInput {
  constructor(seed, getSelf, getOther) {
    this.seed = seed >>> 0 || 1;
    this.getSelf = getSelf;
    this.getOther = getOther;
    this.hold = 0;
    this.timer = 0;
  }
  rand() {
    // mulberry32
    let t = (this.seed = (this.seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  read() {
    const me = this.getSelf();
    const other = this.getOther();
    if (!me || !other) return 0;
    const fwd = me.facing > 0 ? RIGHT : LEFT;
    const back = me.facing > 0 ? LEFT : RIGHT;
    const dist = Math.abs(me.x - other.x) / 100;
    if (this.timer-- <= 0) {
      const r = this.rand();
      this.timer = 6 + Math.floor(this.rand() * 18);
      if (dist > 260) this.hold = r < 0.55 ? fwd : r < 0.7 ? SPECIAL : r < 0.8 ? UP | fwd : 0;
      else if (dist > 140) this.hold = r < 0.4 ? fwd : r < 0.55 ? back : r < 0.7 ? UP | fwd : r < 0.8 ? HEAVY : DOWN | back;
      else this.hold = r < 0.25 ? LIGHT : r < 0.4 ? HEAVY : r < 0.5 ? DOWN | LIGHT : r < 0.58 ? DOWN | HEAVY : r < 0.75 ? back : r < 0.85 ? DOWN | back : UP | back;
    }
    let mask = this.hold;
    // Angriffsknöpfe nur kurz antippen, damit neue Drücke erkannt werden
    if (this.timer % 4 !== 0) mask &= ~(LIGHT | HEAVY | SPECIAL);
    return mask;
  }
}

// ---------------------------------------------------------------------
// Mehrere Quellen zusammenfassen (z. B. Tastatur ODER Gamepad ODER Touch)
// ---------------------------------------------------------------------
export function combine(...sources) {
  return {
    read() {
      let mask = 0;
      for (const s of sources) mask |= s.read();
      return mask;
    },
  };
}

export const NO_INPUT = { read: () => 0 };
