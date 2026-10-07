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
//
// Ablauf eines Schritts (step):
//   1. Hitstop? → nur Knopfdrücke merken, sonst einfrieren
//   2. think:    Eingaben → Laufen, Springen, Ducken, Angriffe
//   3. physics:  Bewegung, Schwerkraft, Landung, Wände
//   4. Schiebeboxen, Blickrichtung, Projektile
//   5. Treffer beider Spieler sammeln und GLEICHZEITIG anwenden
//   6. Zähler weiterzählen, Rundenablauf
// =====================================================================

import { STAGE, FIGHTER, MOVES, COMBAT, ROUND, TRAINING } from './config.js';
import { UP, DOWN, LEFT, RIGHT, LIGHT, HEAVY, SPECIAL, BUTTONS, ALL_INPUTS } from './buttons.js';

export const SUB = 100; // 1 Pixel = 100 Subpixel

const px = (v) => Math.round(v * SUB);
const toward0 = (v, amount) => (v > amount ? v - amount : v < -amount ? v + amount : 0);
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const toPx = (v) => Math.trunc(v / SUB);

// ---------------------------------------------------------------------
// Spielwerte einmalig in Ganzzahlen (Subpixel) umrechnen
// ---------------------------------------------------------------------
const box = (b) => (b ? { x: px(b.x || 0), y: px(b.y || 0), w: px(b.w), h: px(b.h) } : null);

const K = {
  width: px(STAGE.WIDTH),
  wallMin: px(STAGE.WALL_MARGIN),
  wallMax: px(STAGE.WIDTH - STAGE.WALL_MARGIN),
  startX: STAGE.START_X.map(px),
  walkF: px(FIGHTER.WALK_FORWARD),
  walkB: px(FIGHTER.WALK_BACK),
  jumpV: px(FIGHTER.JUMP_VELOCITY),
  jumpX: px(FIGHTER.JUMP_FORWARD),
  gravity: px(FIGHTER.GRAVITY),
  airAccel: px(FIGHTER.AIR_CONTROL || 0),
  airMax: px(FIGHTER.AIR_MAX_SPEED || 0),
  friction: px(FIGHTER.FRICTION),
  launchV: px(COMBAT.LAUNCH_VELOCITY),
  launchX: px(COMBAT.LAUNCH_PUSH),
  proximity: px(COMBAT.PROXIMITY_GUARD),
  wallTouch: px(4),
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

/** Angriffe mit Ganzzahl-Werten. Wird auch vom Renderer benutzt (Animationen). */
export const MOVE_DATA = {};
for (const [id, m] of Object.entries(MOVES)) {
  MOVE_DATA[id] = {
    ...m,
    id,
    total: m.startup + m.active + m.recovery,
    knockback: px(m.knockback || 0),
    blockPush: px(m.blockPush || 0),
    speed: px(m.speed || 0),
    hitbox: box(m.hitbox),
    hurt: box(m.hurt),
    ball: box(m.ball),
  };
}
const M = MOVE_DATA;

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
    state: 'idle',      // idle, walk, crouch, jumpsquat, air, land, attack, blockstun,
                        // hitstun, knockdown, getup, ko, win
    stateFrame: 0,      // seit wie vielen Frames im aktuellen Zustand
    move: null,         // aktueller Angriff (Schlüssel aus MOVES) oder null
    moveFrame: 0,       // Frame innerhalb des Angriffs (0 = erster Frame)
    hasHit: false,      // hat der Angriff schon getroffen/wurde geblockt?
    stun: 0,            // Rest-Frames für land/hitstun/blockstun/knockdown/getup
    cooldown: 0,        // Rest-Frames bis zum nächsten Energieball
    prevInput: 0,       // Eingabe des letzten Frames (zum Erkennen neuer Knopfdrücke)
    bufferBtn: 0,       // gemerkter Angriffsknopf (Eingabepuffer)
    bufferTimer: 0,
    combo: 0,           // wie viele Treffer in Folge man kassiert hat
    crouching: false,
    guarding: false,    // Blockhaltung
    airAttackUsed: false,
    jumpDir: 0,         // Sprungrichtung: -1 nach links, 0 senkrecht, 1 nach rechts
    invuln: 0,          // unverwundbare Frames
    refillTimer: 0,     // nur Training: Frames ohne Treffer
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
  f.move = null;
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
const BLOCK_STATES = { idle: true, walk: true, crouch: true, blockstun: true };
const INVULNERABLE = { knockdown: true, getup: true, ko: true };

function isAirborne(f) {
  return f.y > 0 || f.vy !== 0 || f.state === 'air';
}

function pushboxOf(f) {
  if (isAirborne(f)) return K.push.air;
  return f.crouching || f.state === 'knockdown' ? K.push.crouch : K.push.stand;
}

function worldBox(f, b) {
  const cx = f.x + f.facing * b.x;
  const half = Math.trunc(b.w / 2);
  return { l: cx - half, r: cx + half, b: f.y + b.y, t: f.y + b.y + b.h };
}

function overlap(a, b) {
  if (a.l >= b.r || b.l >= a.r || a.b >= b.t || b.b >= a.t) return null;
  // Mitte der Überschneidung (für Treffer-Effekte)
  const l = a.l > b.l ? a.l : b.l;
  const r = a.r < b.r ? a.r : b.r;
  const lo = a.b > b.b ? a.b : b.b;
  const hi = a.t < b.t ? a.t : b.t;
  return { x: Math.trunc((l + r) / 2), y: Math.trunc((lo + hi) / 2) };
}

/** Verwundbare Boxen in Weltkoordinaten (auch für die Debug-Anzeige). */
export function hurtboxesOf(f) {
  if (INVULNERABLE[f.state] || f.invuln > 0) return [];
  const base = isAirborne(f) ? K.hurt.air : f.crouching ? K.hurt.crouch : K.hurt.stand;
  const list = base.map((b) => worldBox(f, b));
  if (f.state === 'attack' && f.move) {
    const m = M[f.move];
    if (m.hurt && f.moveFrame >= m.startup) list.push(worldBox(f, m.hurt));
  }
  return list;
}

/** Aktive Hitbox eines Kämpfers (oder null). */
export function hitboxOf(f) {
  if (f.state !== 'attack' || !f.move || f.hasHit) return null;
  const m = M[f.move];
  if (!m.hitbox || f.moveFrame < m.startup || f.moveFrame >= m.startup + m.active) return null;
  return worldBox(f, m.hitbox);
}

/** Box eines Projektils in Weltkoordinaten. */
export function projectileBox(p) {
  const half = Math.trunc(p.w / 2);
  return { l: p.x - half, r: p.x + half, b: p.y, t: p.y + p.h };
}

/** Schiebebox in Weltkoordinaten (für die Debug-Anzeige). */
export function pushboxWorld(f) {
  return worldBox(f, pushboxOf(f));
}

function canSpecial(s, i) {
  if (s.fighters[i].cooldown > 0) return false;
  for (const p of s.projectiles) if (p.owner === i) return false;
  return true;
}

// Droht gerade ein Angriff? Dann wird "zurück halten" zur Blockhaltung.
function threatened(s, i) {
  const f = s.fighters[i];
  const o = s.fighters[1 - i];
  if (o.state === 'attack' && o.move && Math.abs(o.x - f.x) < K.proximity) {
    const m = M[o.move];
    if (o.moveFrame < m.startup + m.active) return true;
  }
  for (const p of s.projectiles) {
    if (p.owner !== i && Math.abs(p.x - f.x) < K.proximity && sign(p.vx) === sign(f.x - p.x)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Angriffe
// ---------------------------------------------------------------------
function chooseGroundMove(btn, down) {
  if (btn === SPECIAL) return 'special';
  if (down) return btn === HEAVY ? 'heavyCrouch' : 'lightCrouch';
  return btn === HEAVY ? 'heavyStand' : 'lightStand';
}

function startMove(s, i, id) {
  const f = s.fighters[i];
  const m = M[id];
  f.state = 'attack';
  f.stateFrame = 0;
  f.move = id;
  f.moveFrame = 0;
  f.hasHit = false;
  f.guarding = false;
  f.crouching = !!m.crouch;
  f.bufferBtn = 0;
  f.bufferTimer = 0;
  if (!m.air) f.vx = 0;
  s.events.push({ type: 'swing', p: i, move: id });
}

// Neuen Knopfdruck merken (Eingabepuffer)
function recordPress(f, input) {
  const pressed = input & ~f.prevInput & BUTTONS;
  f.prevInput = input;
  if (pressed) {
    f.bufferBtn = pressed & SPECIAL ? SPECIAL : pressed & HEAVY ? HEAVY : LIGHT;
    f.bufferTimer = COMBAT.INPUT_BUFFER;
  }
  return pressed;
}

// ---------------------------------------------------------------------
// Steuerung eines Kämpfers für einen Frame
// ---------------------------------------------------------------------
function think(s, i, input) {
  const f = s.fighters[i];
  const d = readDirs(input, f.facing);

  if (f.bufferTimer > 0) {
    f.bufferTimer--;
    if (f.bufferTimer === 0) f.bufferBtn = 0;
  }
  const pressed = recordPress(f, input);

  // Zustände, die von selbst enden
  switch (f.state) {
    case 'attack': {
      const m = M[f.move];
      if (m.air) {
        if (f.moveFrame >= m.startup + m.active) {
          setState(f, 'air');
          f.move = null;
        }
      } else if (f.moveFrame >= m.total) {
        toIdle(f);
      } else if (m.cancel && f.hasHit && f.bufferBtn === SPECIAL && f.moveFrame >= m.startup && canSpecial(s, i)) {
        // Abbruch eines Treffers in den Energieball ("Cancel")
        startMove(s, i, 'special');
        return;
      }
      break;
    }
    case 'land':
    case 'hitstun':
    case 'blockstun':
      if (f.stun <= 0) toIdle(f);
      break;
    case 'getup':
      if (f.stun <= 0) toIdle(f);
      break;
    case 'knockdown':
      if (!isAirborne(f) && f.stun <= 0) {
        setState(f, 'getup');
        f.stun = COMBAT.GETUP_TIME;
        f.invuln = COMBAT.GETUP_TIME;
      }
      break;
    case 'jumpsquat':
      if (f.stateFrame >= FIGHTER.JUMP_SQUAT) {
        if (d.h !== 0) f.jumpDir = d.h; // Richtung darf im Anlauf noch gewählt werden
        setState(f, 'air');
        f.vy = K.jumpV;
        f.vx = f.jumpDir * K.jumpX;
        s.events.push({ type: 'jump', p: i, x: toPx(f.x) });
      }
      break;
  }

  // Im Blockstun kann man zwischen stehend und geduckt wechseln
  if (f.state === 'blockstun') f.crouching = d.down;

  // In der Luft lenken (nur im normalen Sprung und beim Sprung-Angriff)
  const steering = f.state === 'air' || (f.state === 'attack' && M[f.move].air);
  if (steering && K.airAccel > 0 && d.h !== 0) {
    f.vx += d.h * K.airAccel;
    if (f.vx > K.airMax) f.vx = K.airMax;
    if (f.vx < -K.airMax) f.vx = -K.airMax;
  }

  // Sprung-Angriff
  if (f.state === 'air' && !f.airAttackUsed && (f.bufferBtn === LIGHT || f.bufferBtn === HEAVY)) {
    startMove(s, i, f.bufferBtn === HEAVY ? 'heavyAir' : 'lightAir');
    f.airAttackUsed = true;
    return;
  }

  if (!ACTIONABLE[f.state]) return;

  // Am Boden und handlungsfähig: Angriff?
  if (f.bufferBtn) {
    const id = chooseGroundMove(f.bufferBtn, d.down);
    if (id !== 'special' || canSpecial(s, i)) {
      startMove(s, i, id);
      return;
    }
    if (pressed & SPECIAL) s.events.push({ type: 'noSpecial', p: i });
    f.bufferBtn = 0;
    f.bufferTimer = 0;
  }

  // Bewegung
  if (d.up) {
    setState(f, 'jumpsquat');
    f.jumpDir = d.h;
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
  f.airAttackUsed = false;
  if (f.state === 'air' || f.state === 'attack') {
    setState(f, 'land');
    f.move = null;
    f.stun = FIGHTER.LANDING_RECOVERY;
    f.vx = 0;
    s.events.push({ type: 'land', p: i, x: toPx(f.x) });
  } else if (f.state === 'knockdown') {
    f.vx = 0;
    if (f.hp <= 0) {
      setState(f, 'ko');
    } else {
      f.stun = COMBAT.KNOCKDOWN_TIME;
    }
    s.events.push({ type: 'down', p: i, x: toPx(f.x) });
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
  if (f.x < K.wallMin) {
    f.x = K.wallMin;
    if (!isAirborne(f)) f.vx = 0;
  }
  if (f.x > K.wallMax) {
    f.x = K.wallMax;
    if (!isAirborne(f)) f.vx = 0;
  }
}

// Kämpfer dürfen sich nicht überlappen
function separate(s) {
  const [a, b] = s.fighters;
  if (a.state === 'ko' || b.state === 'ko') return;
  const pa = pushboxOf(a);
  const pb = pushboxOf(b);
  // Überlappen sie in der Höhe?
  const aBottom = a.y + pa.y;
  const bBottom = b.y + pb.y;
  if (aBottom + pa.h <= bBottom || bBottom + pb.h <= aBottom) return;
  const minDist = Math.trunc((pa.w + pb.w) / 2);
  const dist = Math.abs(a.x - b.x);
  if (dist >= minDist) return;
  const overlapX = minDist - dist;
  // Wer steht links? Bei exakt gleicher Position entscheidet die Blickrichtung von P1.
  const aLeft = a.x < b.x || (a.x === b.x && a.facing > 0);
  const half = Math.trunc(overlapX / 2);
  const left = aLeft ? a : b;
  const right = aLeft ? b : a;
  left.x -= half;
  right.x += overlapX - half;
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

// ---------------------------------------------------------------------
// Projektile (Energiebälle)
// ---------------------------------------------------------------------
function spawnProjectiles(s) {
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i];
    if (f.state !== 'attack' || f.move !== 'special' || f.moveFrame !== M.special.startup) continue;
    const ball = M.special.ball;
    s.projectiles.push({
      id: s.nextId++,
      owner: i,
      x: f.x + f.facing * ball.x,
      y: f.y + ball.y,
      vx: f.facing * M.special.speed,
      w: ball.w,
      h: ball.h,
      life: M.special.lifetime,
    });
    f.cooldown = M.special.cooldown;
    s.events.push({ type: 'special', p: i, x: toPx(f.x + f.facing * ball.x), y: toPx(f.y + ball.y + Math.trunc(ball.h / 2)) });
  }
}

function moveProjectiles(s) {
  const keep = [];
  for (const p of s.projectiles) {
    p.x += p.vx;
    p.life--;
    if (p.life <= 0 || p.x < -p.w || p.x > K.width + p.w) {
      s.events.push({ type: 'fade', x: toPx(p.x), y: toPx(p.y + Math.trunc(p.h / 2)) });
      continue;
    }
    keep.push(p);
  }
  // Zusammenstoß zweier Bälle: beide verpuffen
  for (let a = 0; a < keep.length; a++) {
    for (let b = a + 1; b < keep.length; b++) {
      const pa = keep[a];
      const pb = keep[b];
      if (pa.owner === pb.owner || pa.life <= 0 || pb.life <= 0) continue;
      const hit = overlap(projectileBox(pa), projectileBox(pb));
      if (hit) {
        pa.life = 0;
        pb.life = 0;
        s.events.push({ type: 'clash', x: toPx(hit.x), y: toPx(hit.y) });
      }
    }
  }
  s.projectiles = keep.filter((p) => p.life > 0);
}

// ---------------------------------------------------------------------
// Treffer
// ---------------------------------------------------------------------
function collectHits(s) {
  const hits = [];
  for (let i = 0; i < 2; i++) {
    const a = s.fighters[i];
    const hb = hitboxOf(a);
    if (!hb) continue;
    for (const hurt of hurtboxesOf(s.fighters[1 - i])) {
      const at = overlap(hb, hurt);
      if (at) {
        hits.push({ attacker: i, defender: 1 - i, move: M[a.move], dir: a.facing, at, melee: true });
        break;
      }
    }
  }
  for (const p of s.projectiles) {
    const def = 1 - p.owner;
    const pb = projectileBox(p);
    for (const hurt of hurtboxesOf(s.fighters[def])) {
      const at = overlap(pb, hurt);
      if (at) {
        hits.push({ attacker: p.owner, defender: def, move: M.special, dir: sign(p.vx), at, melee: false });
        p.life = 0;
        break;
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);
  return hits;
}

function knockDown(f, dir) {
  setState(f, 'knockdown');
  f.stateFrame = 0;
  f.vy = K.launchV;
  f.vx = dir * K.launchX;
  f.stun = 0;
  f.move = null;
  f.crouching = false;
  f.guarding = false;
}

function atWall(f) {
  return f.x - K.wallMin <= K.wallTouch || K.wallMax - f.x <= K.wallTouch;
}

function applyHit(s, h) {
  const a = s.fighters[h.attacker];
  const d = s.fighters[h.defender];
  const m = h.move;
  if (h.melee) a.hasHit = true;

  const dirs = readDirs(d.prevInput, 1);
  const holdsAway = dirs.h !== 0 && dirs.h === h.dir; // weg vom Angreifer halten
  const crouch = dirs.down;
  const levelOk = m.level === 'mid' || (m.level === 'low' && crouch) || (m.level === 'overhead' && !crouch);
  const blocked = BLOCK_STATES[d.state] && !isAirborne(d) && holdsAway && levelOk;
  const ex = toPx(h.at.x);
  const ey = toPx(h.at.y);
  const minHp = s.training ? 1 : 0;

  if (blocked) {
    setState(d, 'blockstun');
    d.stateFrame = 0;
    d.stun = m.blockstun;
    d.crouching = crouch;
    d.guarding = true;
    d.move = null;
    d.vx = h.dir * m.blockPush;
    if (m.chip) d.hp = Math.max(minHp, d.hp - m.chip);
    if (h.melee && atWall(d)) a.vx = -h.dir * m.blockPush;
    s.hitstop = Math.max(s.hitstop, Math.max(2, m.hitstop - COMBAT.BLOCK_HITSTOP_LESS));
    s.events.push({
      type: 'block', p: h.defender, a: h.attacker, x: ex, y: ey, proj: !h.melee,
      adv: h.melee && !m.air ? m.blockstun - (m.total - a.moveFrame) : null,
    });
    return;
  }

  // Getroffen!
  const comboing = d.state === 'hitstun';
  d.combo = comboing ? d.combo + 1 : 1;
  const scale = Math.max(COMBAT.COMBO_MIN_DAMAGE, 100 - COMBAT.COMBO_SCALING * (d.combo - 1));
  const dmg = Math.max(1, Math.trunc((m.damage * scale) / 100));
  d.hp = Math.max(minHp, d.hp - dmg);
  d.move = null;
  d.hasHit = false;
  d.guarding = false;
  d.refillTimer = 0;
  const airborne = isAirborne(d);
  const falls = d.hp <= 0 || m.knockdown || airborne;
  if (falls) {
    knockDown(d, h.dir);
  } else {
    setState(d, 'hitstun');
    d.stateFrame = 0;
    d.stun = m.hitstun;
    d.vx = h.dir * m.knockback;
  }
  if (h.melee && !airborne && atWall(d)) a.vx = -h.dir * m.knockback;
  s.hitstop = Math.max(s.hitstop, d.hp <= 0 ? COMBAT.KO_HITSTOP : m.hitstop);
  s.events.push({
    type: 'hit', p: h.defender, a: h.attacker, x: ex, y: ey, dmg, combo: d.combo,
    heavy: m.damage >= 10, proj: !h.melee, knockdown: falls, ko: d.hp <= 0,
    adv: h.melee && !m.air && !falls ? m.hitstun - (m.total - a.moveFrame) : null,
  });
}

// ---------------------------------------------------------------------
// Zähler weiterzählen
// ---------------------------------------------------------------------
function advanceCounters(s) {
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i];
    f.stateFrame++;
    if (f.state === 'attack') f.moveFrame++;
    if (f.stun > 0) f.stun--;
    if (f.cooldown > 0) f.cooldown--;
    if (f.invuln > 0) f.invuln--;
    if (s.training) {
      // Training: Lebensenergie füllt sich wieder auf
      if (ACTIONABLE[f.state]) {
        f.refillTimer++;
        if (f.refillTimer >= TRAINING.REFILL_DELAY && f.hp < FIGHTER.MAX_HP) {
          f.hp = FIGHTER.MAX_HP;
          s.events.push({ type: 'refill', p: i });
        }
      } else {
        f.refillTimer = 0;
      }
    }
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
      const both = a.hp <= 0 && b.hp <= 0;
      endRound(s, both ? -1 : a.hp <= 0 ? 1 : 0, both ? 'double' : 'ko');
      s.hitstop = Math.max(s.hitstop, COMBAT.KO_HITSTOP);
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
  const control = s.phase === 'fight';
  const inputs = control ? [inputP1 & ALL_INPUTS, inputP2 & ALL_INPUTS] : [0, 0];

  // Hitstop: die Welt friert kurz ein – Knopfdrücke werden aber gemerkt
  if (s.hitstop > 0) {
    s.hitstop--;
    for (let i = 0; i < 2; i++) recordPress(s.fighters[i], inputs[i]);
    return s;
  }

  for (let i = 0; i < 2; i++) think(s, i, inputs[i]);
  for (let i = 0; i < 2; i++) physics(s, i);
  separate(s);
  updateFacing(s);
  spawnProjectiles(s);
  moveProjectiles(s);
  if (control) {
    const hits = collectHits(s);
    for (const h of hits) applyHit(s, h);
  }
  advanceCounters(s);
  roundLogic(s);
  return s;
}
