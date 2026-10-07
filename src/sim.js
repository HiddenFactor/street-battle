// =====================================================================
// sim.js – die reine Spiellogik (deterministisch)
// ---------------------------------------------------------------------
// REGELN (siehe CLAUDE.md):
//  * step(state, inputP1, inputP2) bekommt NUR den alten Zustand und die
//    Eingaben der beiden Spieler (Bitmasken) und liefert einen NEUEN
//    Zustand zurück. Der alte Zustand wird nie verändert.
//  * Kein DOM, kein Zeichnen, keine Uhrzeit, kein Zufall, keine
//    Trigonometrie. Positionen/Geschwindigkeiten sind Ganzzahlen in
//    1/100 Pixel ("Subpixel").
//  * Dadurch rechnen beide Online-Spieler exakt dasselbe aus.
// =====================================================================

import { STAGE, FIGHTER, ROUND } from './config.js';
import { UP, DOWN, LEFT, RIGHT, ALL_INPUTS } from './buttons.js';

export const SUB = 100; // 1 Pixel = 100 Subpixel

const px = (v) => Math.round(v * SUB);
const toward0 = (v, amount) => (v > amount ? v - amount : v < -amount ? v + amount : 0);

// ---------------------------------------------------------------------
// Spielwerte einmalig in Ganzzahlen (Subpixel) umrechnen
// ---------------------------------------------------------------------
const box = (b) => (b ? { x: px(b.x || 0), y: px(b.y || 0), w: px(b.w), h: px(b.h) } : null);

const K = {
  wallMin: px(STAGE.WALL_MARGIN),
  wallMax: px(STAGE.WIDTH - STAGE.WALL_MARGIN),
  startX: STAGE.START_X.map(px),
  walkF: px(FIGHTER.WALK_FORWARD),
  walkB: px(FIGHTER.WALK_BACK),
  jumpV: px(FIGHTER.JUMP_VELOCITY),
  jumpX: px(FIGHTER.JUMP_FORWARD),
  gravity: px(FIGHTER.GRAVITY),
  friction: px(FIGHTER.FRICTION),
  roundFrames: ROUND.TIME_SECONDS * 60,
  push: {
    stand: box(FIGHTER.PUSHBOX.stand),
    crouch: box(FIGHTER.PUSHBOX.crouch),
    air: box(FIGHTER.PUSHBOX.air),
  },
  hurt: {
    stand: FIGHTER.HURTBOX.stand.map(box),
    crouch: FIGHTER.HURTBOX.crouch.map(box),
    air: FIGHTER.HURTBOX.air.map(box),
  },
};

// ---------------------------------------------------------------------
// Zustand anlegen
// ---------------------------------------------------------------------
function newFighter(i) {
  return {
    x: K.startX[i],
    y: 0,               // Höhe über dem Boden (0 = steht)
    vx: 0,
    vy: 0,              // positiv = nach oben
    facing: i === 0 ? 1 : -1, // 1 = schaut nach rechts, -1 = nach links
    hp: FIGHTER.MAX_HP,
    state: 'idle',      // siehe CLAUDE.md: idle, walk, crouch, jumpsquat, air, land, ...
    stateFrame: 0,      // seit wie vielen Frames im aktuellen Zustand
    stun: 0,            // Rest-Frames für land/hitstun/blockstun/...
    prevInput: 0,       // Eingabe des letzten Frames (zum Erkennen neuer Knopfdrücke)
    crouching: false,
    guarding: false,    // hält "zurück", während ein Angriff droht (Blockhaltung)
    jumpDir: 0,         // -1 Rückwärts-, 0 Neutral-, 1 Vorwärtssprung
  };
}

function freshRoundFighters(state) {
  state.fighters = [newFighter(0), newFighter(1)];
  state.projectiles = [];
  state.hitstop = 0;
  state.timer = K.roundFrames;
  state.phase = 'intro';
  state.phaseFrame = 0;
  state.roundWinner = -1;
  state.endReason = '';
}

/** Neues Match (Runde 1). options.training = true für den Trainingsmodus. */
export function createMatch(options = {}) {
  const state = {
    frame: 0,
    phase: 'intro',     // intro → fight → roundEnd → (intro ...) → matchEnd
    phaseFrame: 0,
    round: 1,
    timer: K.roundFrames,
    wins: [0, 0],
    roundWinner: -1,    // -1 = niemand / unentschieden
    endReason: '',      // 'ko', 'time', 'double'
    matchWinner: -1,
    hitstop: 0,
    training: !!options.training,
    nextId: 1,
    fighters: [],
    projectiles: [],
    events: [],
  };
  freshRoundFighters(state);
  state.events.push({ type: 'round', round: 1 });
  return state;
}

/** Aktuelle Runde neu starten (Siege bleiben). Wird z. B. nach einem Desync benutzt. */
export function resetRound(prev) {
  const state = cloneState(prev);
  freshRoundFighters(state);
  state.events.push({ type: 'round', round: state.round });
  return state;
}

// Flache Kopie reicht, weil Kämpfer/Projektile nur Zahlen/Texte enthalten.
function cloneState(s) {
  return {
    ...s,
    wins: s.wins.slice(),
    fighters: s.fighters.map((f) => ({ ...f })),
    projectiles: s.projectiles.map((p) => ({ ...p })),
    events: [],
  };
}

// ---------------------------------------------------------------------
// Prüfsumme (FNV-1a über den serialisierten Zustand)
// ---------------------------------------------------------------------
export function checksum(state) {
  const text = JSON.stringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------
function setState(f, name) {
  if (f.state !== name) {
    f.state = name;
    f.stateFrame = 0;
  }
}

function toIdle(f) {
  setState(f, 'idle');
  f.stun = 0;
  f.guarding = false;
  f.crouching = false;
}

// Eingabe in "vor/zurück/hoch/runter" übersetzen (gleichzeitig links+rechts = nichts)
function readDirs(input, facing) {
  let h = 0;
  if (input & LEFT) h -= 1;
  if (input & RIGHT) h += 1;
  let v = 0;
  if (input & UP) v += 1;
  if (input & DOWN) v -= 1;
  return { h, fwd: h * facing > 0, back: h * facing < 0, up: v > 0, down: v < 0 };
}

const ACTIONABLE = { idle: true, walk: true, crouch: true };

function isAirborne(f) {
  return f.y > 0 || f.vy !== 0 || f.state === 'air';
}

function pushboxOf(f) {
  if (isAirborne(f)) return K.push.air;
  return f.crouching ? K.push.crouch : K.push.stand;
}

/** Verwundbare Boxen in Weltkoordinaten (für Treffer und Debug-Anzeige). */
export function hurtboxesOf(f) {
  const list = isAirborne(f) ? K.hurt.air : f.crouching ? K.hurt.crouch : K.hurt.stand;
  return list.map((b) => worldBox(f, b));
}

function worldBox(f, b) {
  const cx = f.x + f.facing * b.x;
  const half = Math.trunc(b.w / 2);
  return { l: cx - half, r: cx + half, b: f.y + b.y, t: f.y + b.y + b.h };
}

/** Schiebebox in Weltkoordinaten (für die Debug-Anzeige). */
export function pushboxWorld(f) {
  return worldBox(f, pushboxOf(f));
}

// Droht gerade ein Angriff? Dann wird "zurück halten" zur Blockhaltung.
function threatened(s, i) {
  return false; // ab Phase 2: Angriffe und Projektile
}

// ---------------------------------------------------------------------
// Steuerung eines Kämpfers für einen Frame
// ---------------------------------------------------------------------
function think(s, i, input) {
  const f = s.fighters[i];
  const d = readDirs(input, f.facing);
  f.prevInput = input;

  // Zustände, die von selbst enden
  if (f.state === 'land' && f.stun <= 0) toIdle(f);
  if (f.state === 'jumpsquat' && f.stateFrame >= FIGHTER.JUMP_SQUAT) {
    setState(f, 'air');
    f.vy = K.jumpV;
    f.vx = d.h * K.jumpX;
    f.jumpDir = d.h * f.facing;
    s.events.push({ type: 'jump', p: i, x: Math.trunc(f.x / SUB) });
  }

  if (!ACTIONABLE[f.state]) return;

  // Am Boden und handlungsfähig
  if (d.up) {
    setState(f, 'jumpsquat');
    f.vx = 0;
    f.crouching = false;
    f.guarding = false;
    return;
  }
  if (d.down) {
    setState(f, 'crouch');
    f.crouching = true;
    f.vx = 0;
    f.guarding = d.back && threatened(s, i);
    return;
  }
  f.crouching = false;
  if (d.fwd) {
    setState(f, 'walk');
    f.vx = K.walkF * f.facing;
    f.guarding = false;
  } else if (d.back) {
    if (threatened(s, i)) {
      setState(f, 'idle');
      f.vx = 0;
      f.guarding = true;
    } else {
      setState(f, 'walk');
      f.vx = -K.walkB * f.facing;
      f.guarding = false;
    }
  } else {
    setState(f, 'idle');
    f.vx = 0;
    f.guarding = false;
  }
}

// ---------------------------------------------------------------------
// Bewegung und Landung
// ---------------------------------------------------------------------
function land(s, i) {
  const f = s.fighters[i];
  f.y = 0;
  f.vy = 0;
  if (f.state === 'air') {
    setState(f, 'land');
    f.stun = FIGHTER.LANDING_RECOVERY;
    f.vx = 0;
    s.events.push({ type: 'land', p: i, x: Math.trunc(f.x / SUB) });
  }
}

function physics(s, i) {
  const f = s.fighters[i];
  if (isAirborne(f)) {
    f.x += f.vx;
    f.y += f.vy;
    f.vy -= K.gravity;
    if (f.y <= 0) land(s, i);
  } else {
    f.x += f.vx;
    if (f.state !== 'walk') f.vx = toward0(f.vx, K.friction);
  }
  if (f.x < K.wallMin) f.x = K.wallMin;
  if (f.x > K.wallMax) f.x = K.wallMax;
}

// Kämpfer dürfen sich nicht überlappen
function separate(s) {
  const [a, b] = s.fighters;
  const pa = pushboxOf(a);
  const pb = pushboxOf(b);
  // Überlappen sie in der Höhe?
  if (a.y + pa.h <= b.y || b.y + pb.h <= a.y) return;
  const minDist = Math.trunc((pa.w + pb.w) / 2);
  const dist = Math.abs(a.x - b.x);
  if (dist >= minDist) return;
  const overlap = minDist - dist;
  // Wer steht links? Bei exakt gleicher Position entscheidet die Blickrichtung von P1.
  const aLeft = a.x < b.x || (a.x === b.x && a.facing > 0);
  const half = Math.trunc(overlap / 2);
  const left = aLeft ? a : b;
  const right = aLeft ? b : a;
  left.x -= half;
  right.x += overlap - half;
  // An der Wand: den anderen weiterschieben
  if (left.x < K.wallMin) {
    right.x += K.wallMin - left.x;
    left.x = K.wallMin;
  }
  if (right.x > K.wallMax) {
    left.x -= right.x - K.wallMax;
    right.x = K.wallMax;
  }
}

// Kämpfer schauen sich an (nur wenn sie am Boden und handlungsfähig sind)
function updateFacing(s) {
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i];
    const o = s.fighters[1 - i];
    const canTurn = ACTIONABLE[f.state] || f.state === 'land' || f.state === 'jumpsquat';
    if (canTurn && o.x !== f.x) f.facing = o.x > f.x ? 1 : -1;
  }
}

function advanceCounters(s) {
  for (const f of s.fighters) {
    f.stateFrame++;
    if (f.stun > 0) f.stun--;
  }
}

// ---------------------------------------------------------------------
// Rundenablauf
// ---------------------------------------------------------------------
function roundLogic(s) {
  s.phaseFrame++;
  if (s.phase === 'intro') {
    if (s.phaseFrame >= ROUND.INTRO_FRAMES) {
      s.phase = 'fight';
      s.phaseFrame = 0;
      s.events.push({ type: 'fight' });
    }
    return;
  }

  if (s.phase === 'fight') {
    const [a, b] = s.fighters;
    if (a.hp <= 0 || b.hp <= 0) {
      endRound(s, a.hp <= 0 && b.hp <= 0 ? -1 : a.hp <= 0 ? 1 : 0, a.hp <= 0 && b.hp <= 0 ? 'double' : 'ko');
      return;
    }
    if (!s.training) {
      s.timer--;
      if (s.timer <= 0) {
        s.timer = 0;
        endRound(s, a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1, 'time');
      }
    }
    return;
  }

  if (s.phase === 'roundEnd') {
    // Sieger jubelt
    if (s.phaseFrame >= ROUND.WIN_POSE_DELAY && s.roundWinner >= 0) {
      const w = s.fighters[s.roundWinner];
      if (ACTIONABLE[w.state]) {
        setState(w, 'win');
        w.vx = 0;
      }
    }
    if (s.phaseFrame >= ROUND.END_FRAMES) {
      const [w0, w1] = s.wins;
      if (w0 >= ROUND.ROUNDS_TO_WIN || w1 >= ROUND.ROUNDS_TO_WIN || s.round >= ROUND.MAX_ROUNDS) {
        s.phase = 'matchEnd';
        s.phaseFrame = 0;
        s.matchWinner = w0 > w1 ? 0 : w1 > w0 ? 1 : -1;
        s.events.push({ type: 'matchEnd', winner: s.matchWinner });
      } else {
        s.round++;
        freshRoundFighters(s);
        s.events.push({ type: 'round', round: s.round });
      }
    }
  }
}

function endRound(s, winner, reason) {
  s.phase = 'roundEnd';
  s.phaseFrame = 0;
  s.roundWinner = winner;
  s.endReason = reason;
  if (winner >= 0) s.wins[winner]++;
  s.events.push({ type: reason === 'time' ? 'timeup' : 'ko', winner });
}

// ---------------------------------------------------------------------
// EIN Spielschritt (1/60 Sekunde)
// ---------------------------------------------------------------------
export function step(prev, inputP1, inputP2) {
  const s = cloneState(prev);
  s.frame++;
  const inputs = [inputP1 & ALL_INPUTS, inputP2 & ALL_INPUTS];

  // Hitstop: die Welt friert kurz ein
  if (s.hitstop > 0) {
    s.hitstop--;
    return s;
  }

  // Steuerung nur während des Kampfes
  const control = s.phase === 'fight';
  for (let i = 0; i < 2; i++) think(s, i, control ? inputs[i] : 0);
  for (let i = 0; i < 2; i++) physics(s, i);
  separate(s);
  updateFacing(s);
  advanceCounters(s);
  roundLogic(s);
  return s;
}
