// =====================================================================
// tests/gameplay.test.js – funktioniert das Kampfsystem wie gedacht?
// ---------------------------------------------------------------------
// Starten:  node tests/gameplay.test.js     (oder: npm test)
// Die Erwartungen werden aus config.js berechnet – wenn du Werte
// änderst, laufen die Tests trotzdem weiter.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, SUB } from '../src/sim.js';
import { MOVES, ROUND, FIGHTER, TRAINING, STAGE } from '../src/config.js';
import { UP, DOWN, LEFT, RIGHT, LIGHT, HEAVY, SPECIAL } from '../src/buttons.js';

// Match starten und das "RUNDE 1"-Intro überspringen
function fightState(options) {
  let s = createMatch(options);
  while (s.phase !== 'fight') s = step(s, 0, 0);
  return s;
}

// Kämpfer an feste Positionen setzen (x in Pixeln)
function place(s, x0, x1) {
  s.fighters[0].x = x0 * SUB;
  s.fighters[1].x = x1 * SUB;
  s.fighters[0].facing = x0 < x1 ? 1 : -1;
  s.fighters[1].facing = x0 < x1 ? -1 : 1;
  return s;
}

// Schritte ausführen; inputs ist eine Funktion (tick) → [p1, p2]
function run(s, ticks, inputs) {
  const events = [];
  for (let t = 0; t < ticks; t++) {
    const [a, b] = inputs(t, s);
    s = step(s, a, b);
    for (const e of s.events) events.push({ ...e, tick: t, frame: s.frame });
  }
  return { s, events };
}

const first = (events, type) => events.find((e) => e.type === type);
const total = (m) => m.startup + m.active + m.recovery;

test('nach dem Intro beginnt der Kampf', () => {
  let s = createMatch();
  let fight = -1;
  for (let t = 0; t < ROUND.INTRO_FRAMES + 5; t++) {
    s = step(s, 0, 0);
    if (s.events.some((e) => e.type === 'fight')) fight = t + 1;
  }
  assert.equal(fight, ROUND.INTRO_FRAMES);
  assert.equal(s.phase, 'fight');
});

test('schneller Schlag trifft genau im Frame nach dem Startup und macht config-Schaden', () => {
  const m = MOVES.lightStand;
  const s0 = place(fightState(), 400, 500);
  const { s, events } = run(s0, 30, (t) => [t === 0 ? LIGHT : 0, 0]);
  const hit = first(events, 'hit');
  assert.ok(hit, 'kein Treffer');
  assert.equal(hit.tick, m.startup, 'Treffer im falschen Frame');
  assert.equal(hit.dmg, m.damage);
  assert.equal(s.fighters[1].hp, FIGHTER.MAX_HP - m.damage);
  assert.equal(hit.adv, m.hitstun - (total(m) - m.startup), 'Frame-Vorteil falsch berechnet');
});

test('Hitstop friert beide Kämpfer ein', () => {
  const m = MOVES.lightStand;
  let s = place(fightState(), 400, 500);
  for (let t = 0; t <= m.startup; t++) s = step(s, t === 0 ? LIGHT : 0, 0);
  assert.equal(s.hitstop, m.hitstop);
  const frozen = JSON.stringify(s.fighters);
  for (let t = 0; t < m.hitstop; t++) s = step(s, 0, 0);
  assert.equal(JSON.stringify(s.fighters), frozen);
  s = step(s, 0, 0);
  assert.notEqual(JSON.stringify(s.fighters), frozen, 'nach dem Hitstop geht es weiter');
});

test('zurück halten blockt: kein Schaden, Blockstun', () => {
  const s0 = place(fightState(), 400, 500);
  // Spieler 2 schaut nach links → "zurück" ist RECHTS
  const { s, events } = run(s0, 12, (t) => [t === 0 ? LIGHT : 0, RIGHT]);
  const block = first(events, 'block');
  assert.ok(block, 'nicht geblockt');
  assert.ok(!first(events, 'hit'));
  assert.equal(s.fighters[1].hp, FIGHTER.MAX_HP);
  assert.equal(s.fighters[1].state, 'blockstun');
});

test('tiefe Angriffe müssen geduckt geblockt werden', () => {
  const s0 = place(fightState(), 400, 500);
  const standing = run(s0, 20, (t) => [t === 0 ? DOWN | LIGHT : DOWN, RIGHT]);
  assert.ok(first(standing.events, 'hit'), 'stehend geblockt, sollte aber treffen');
  const crouching = run(s0, 20, (t) => [t === 0 ? DOWN | LIGHT : DOWN, DOWN | RIGHT]);
  assert.ok(first(crouching.events, 'block'), 'geduckt nicht geblockt');
});

test('Sprung-Angriffe müssen stehend geblockt werden', () => {
  const s0 = place(fightState(), 380, 520);
  // passenden Zeitpunkt für den Sprung-Tritt suchen
  let timing = -1;
  for (let press = 6; press < 40 && timing < 0; press++) {
    const r = run(s0, 60, (t) => [t === 0 ? UP | RIGHT : t === press ? HEAVY : 0, DOWN | RIGHT]);
    const contact = r.events.find((e) => e.type === 'hit' || e.type === 'block');
    if (contact) {
      assert.equal(contact.type, 'hit', 'geduckt geblockt, sollte aber treffen');
      timing = press;
    }
  }
  assert.ok(timing >= 0, 'Sprung-Angriff trifft nie');
  const r = run(s0, 60, (t) => [t === 0 ? UP | RIGHT : t === timing ? HEAVY : 0, RIGHT]);
  assert.ok(first(r.events, 'block'), 'stehend nicht geblockt');
});

test('Energieball: fliegt, trifft, hat Cooldown', () => {
  const m = MOVES.special;
  const s0 = place(fightState(), 200, 760);
  const { s, events } = run(s0, 200, (t) => [t === 0 || t === 60 ? SPECIAL : 0, 0]);
  const spawned = first(events, 'special');
  assert.ok(spawned, 'kein Energieball');
  assert.equal(spawned.tick, m.startup);
  assert.equal(events.filter((e) => e.type === 'special').length, 1, 'Cooldown wurde ignoriert');
  assert.ok(first(events, 'noSpecial'), 'kein Hinweis auf Cooldown');
  const hit = events.find((e) => e.type === 'hit' && e.proj);
  assert.ok(hit, 'Ball trifft nicht');
  assert.equal(s.fighters[1].hp, FIGHTER.MAX_HP - m.damage);
});

test('Energieball wird geblockt: nur Chip-Schaden', () => {
  const m = MOVES.special;
  const s0 = place(fightState(), 200, 760);
  const { s, events } = run(s0, 200, (t) => [t === 0 ? SPECIAL : 0, RIGHT]);
  assert.ok(events.find((e) => e.type === 'block' && e.proj));
  assert.equal(s.fighters[1].hp, FIGHTER.MAX_HP - m.chip);
});

test('zwei Energiebälle löschen sich gegenseitig aus', () => {
  const s0 = place(fightState(), 200, 760);
  const { s, events } = run(s0, 200, (t) => [t === 0 ? SPECIAL : 0, t === 0 ? SPECIAL : 0]);
  assert.ok(first(events, 'clash'));
  assert.equal(s.fighters[0].hp, FIGHTER.MAX_HP);
  assert.equal(s.fighters[1].hp, FIGHTER.MAX_HP);
  assert.equal(s.projectiles.length, 0);
});

test('Feger wirft um, danach steht man wieder auf', () => {
  const s0 = place(fightState(), 400, 500);
  const { s, events } = run(s0, 150, (t) => [t === 0 ? DOWN | HEAVY : 0, 0]);
  const hit = first(events, 'hit');
  assert.ok(hit && hit.knockdown, 'kein Umfallen');
  assert.ok(first(events, 'down'));
  assert.equal(s.fighters[1].state, 'idle');
});

test('schneller Schlag lässt sich bei Treffer in den Energieball abbrechen', () => {
  const m = MOVES.lightStand;
  const s0 = place(fightState(), 400, 500);
  const { events } = run(s0, 40, (t) => [t === 0 ? LIGHT : t === m.startup + 2 ? SPECIAL : 0, 0]);
  const swings = events.filter((e) => e.type === 'swing').map((e) => e.move);
  assert.deepEqual(swings, ['lightStand', 'special']);
});

test('K.O. bringt einen Rundensieg, danach startet Runde 2', () => {
  const s0 = place(fightState(), 400, 500);
  s0.fighters[1].hp = 3;
  const { s, events } = run(s0, 20, (t) => [t === 0 ? LIGHT : 0, 0]);
  assert.ok(first(events, 'ko'));
  assert.equal(s.phase, 'roundEnd');
  assert.deepEqual(s.wins, [1, 0]);
  const later = run(s, ROUND.END_FRAMES + 200, () => [0, 0]);
  assert.equal(later.s.round, 2);
  assert.equal(later.s.fighters[1].hp, FIGHTER.MAX_HP);
  assert.ok(first(later.events, 'round'));
});

test('Zeitablauf: wer mehr Leben hat, gewinnt die Runde', () => {
  const s0 = fightState();
  s0.timer = 3;
  s0.fighters[0].hp = 40;
  const { s, events } = run(s0, 5, () => [0, 0]);
  assert.ok(first(events, 'timeup'));
  assert.deepEqual(s.wins, [0, 1]);
});

test('Zeitablauf bei Gleichstand: niemand bekommt den Punkt', () => {
  const s0 = fightState();
  s0.timer = 2;
  const { s } = run(s0, 5, () => [0, 0]);
  assert.equal(s.roundWinner, -1);
  assert.deepEqual(s.wins, [0, 0]);
});

test('Best of 3: zwei Rundensiege beenden das Match', () => {
  const s0 = place(fightState(), 400, 500);
  s0.wins = [ROUND.ROUNDS_TO_WIN - 1, 0];
  s0.fighters[1].hp = 2;
  const { s, events } = run(s0, ROUND.END_FRAMES + 120, (t) => [t === 0 ? LIGHT : 0, 0]);
  const end = first(events, 'matchEnd');
  assert.ok(end, 'Match endet nicht');
  assert.equal(end.winner, 0);
  assert.equal(s.phase, 'matchEnd');
  assert.equal(s.fighters[0].state, 'win');
});

test('Training: kein K.O., Leben füllt sich wieder auf, keine Zeit', () => {
  const s0 = place(fightState({ training: true }), 400, 500);
  s0.fighters[1].hp = 3;
  const { s, events } = run(s0, TRAINING.REFILL_DELAY + 80, (t) => [t === 0 ? HEAVY : 0, 0]);
  assert.ok(!first(events, 'ko'));
  assert.equal(s.phase, 'fight');
  assert.equal(s.fighters[1].hp, FIGHTER.MAX_HP);
  assert.equal(s.timer, s0.timer);
});

test('Kämpfer schauen sich nach einem Sprung über den Gegner wieder an', () => {
  const s0 = place(fightState(), 440, 520);
  const { s } = run(s0, 80, (t) => [t < 3 ? UP | RIGHT : 0, 0]);
  assert.ok(s.fighters[0].x > s.fighters[1].x, 'nicht übersprungen');
  assert.equal(s.fighters[0].facing, -1);
  assert.equal(s.fighters[1].facing, 1);
});

test('Wände halten die Kämpfer in der Arena', () => {
  const s0 = fightState();
  const { s } = run(s0, 400, () => [LEFT, RIGHT]);
  assert.equal(s.fighters[0].x, STAGE.WALL_MARGIN * SUB);
  assert.equal(s.fighters[1].x, (STAGE.WIDTH - STAGE.WALL_MARGIN) * SUB);
});

test('Kämpfer können nicht durcheinander laufen', () => {
  const s0 = fightState();
  const { s } = run(s0, 200, () => [RIGHT, LEFT]);
  const dist = Math.abs(s.fighters[0].x - s.fighters[1].x) / SUB;
  assert.ok(dist >= FIGHTER.PUSHBOX.stand.w - 1, `zu nah: ${dist}`);
  assert.ok(s.fighters[0].x < s.fighters[1].x);
});

test('Luftsteuerung: in der Luft rechts halten lenkt nach rechts, nie schneller als erlaubt', () => {
  const s0 = place(fightState(), 300, 800);
  const landingX = (events) => events.find((e) => e.type === 'land' && e.p === 0).x;
  // Senkrechter Sprung ohne Lenken
  const plain = run(s0, 60, (t) => [t < 2 ? UP : 0, 0]);
  // Senkrechter Sprung, in der Luft rechts halten (erst nach dem Absprung)
  let maxSpeed = 0;
  const steered = run(s0, 60, (t, s) => {
    maxSpeed = Math.max(maxSpeed, Math.abs(s.fighters[0].vx));
    return [t < 2 ? UP : t > FIGHTER.JUMP_SQUAT + 1 ? RIGHT : 0, 0];
  });
  assert.equal(landingX(plain.events), 300, 'ohne Lenken landet der senkrechte Sprung am Absprungort');
  if (FIGHTER.AIR_CONTROL > 0) {
    assert.ok(landingX(steered.events) > 350, `Lenken wirkt nicht (Landung bei ${landingX(steered.events)})`);
    assert.ok(maxSpeed <= Math.round(FIGHTER.AIR_MAX_SPEED * SUB), `zu schnell: ${maxSpeed}`);
  } else {
    assert.equal(landingX(steered.events), 300);
  }
});
