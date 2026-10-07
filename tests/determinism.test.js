// =====================================================================
// tests/determinism.test.js – ist die Simulation deterministisch?
// ---------------------------------------------------------------------
// Starten:  node tests/determinism.test.js     (oder: npm test)
//
// Online funktioniert nur, wenn beide Geräte aus denselben Eingaben
// exakt denselben Spielzustand berechnen. Diese Tests prüfen das.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, step, checksum, resetRound } from '../src/sim.js';
import { BotInput } from '../src/input.js';
import { UP, DOWN, LEFT, RIGHT, LIGHT, HEAVY, SPECIAL } from '../src/buttons.js';

// Eigener, reproduzierbarer Zufall (nur für die Tests!)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zufällige, aber "menschliche" Eingaben: Richtungen werden eine Weile gehalten
function randomInputs(seed, count) {
  const r = rng(seed);
  const dirs = [0, LEFT, RIGHT, UP, DOWN, DOWN | LEFT, DOWN | RIGHT, UP | LEFT, UP | RIGHT];
  const out = [];
  const hold = [0, 0];
  const timer = [0, 0];
  for (let i = 0; i < count; i++) {
    const pair = [0, 0];
    for (let p = 0; p < 2; p++) {
      if (timer[p]-- <= 0) {
        hold[p] = dirs[Math.floor(r() * dirs.length)];
        timer[p] = 1 + Math.floor(r() * 25);
      }
      let mask = hold[p];
      if (r() < 0.08) mask |= LIGHT;
      if (r() < 0.05) mask |= HEAVY;
      if (r() < 0.03) mask |= SPECIAL;
      if (r() < 0.01) mask = Math.floor(r() * 128); // völlig wilde Eingaben
      pair[p] = mask;
    }
    out.push(pair);
  }
  return out;
}

function run(inputs, options) {
  let state = createMatch(options);
  const sums = [];
  for (let i = 0; i < inputs.length; i++) {
    state = step(state, inputs[i][0], inputs[i][1]);
    if (state.frame % 60 === 0) sums.push(checksum(state));
  }
  return { state, sums, final: checksum(state) };
}

// Zwei Bots gegeneinander – erzeugt echte Kämpfe mit Treffern, K.O. und Runden
function runBots(seed, ticks, onTick) {
  let state = createMatch();
  const b1 = new BotInput(seed, () => state.fighters[0], () => state.fighters[1]);
  const b2 = new BotInput(seed * 31 + 7, () => state.fighters[1], () => state.fighters[0]);
  const inputs = [];
  for (let i = 0; i < ticks; i++) {
    const pair = [b1.read(), b2.read()];
    inputs.push(pair);
    state = step(state, pair[0], pair[1]);
    if (onTick) onTick(state);
  }
  return { state, inputs };
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

function findNonInteger(value, path = 'state') {
  if (typeof value === 'number') return Number.isInteger(value) ? null : `${path} = ${value}`;
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const bad = findNonInteger(v, `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

test('gleiche Eingabefolge zweimal simuliert → identische Prüfsumme', () => {
  const inputs = randomInputs(42, 3000);
  const a = run(inputs);
  const b = run(inputs);
  assert.equal(a.final, b.final);
  assert.deepEqual(a.sums, b.sums);
  assert.equal(JSON.stringify(a.state), JSON.stringify(b.state));
});

test('zufällige Eingaben über 10.000 Ticks: zwei Läufe identisch', () => {
  for (const seed of [1, 2024, 987654]) {
    const inputs = randomInputs(seed, 10000);
    const a = run(inputs);
    const b = run(inputs);
    assert.equal(a.sums.length, Math.floor(10000 / 60));
    assert.deepEqual(a.sums, b.sums, `Prüfsummen weichen ab (Seed ${seed})`);
    assert.equal(a.final, b.final);
  }
});

test('Bot-Kämpfe über 10.000 Ticks: Wiederholung mit denselben Eingaben ist identisch', () => {
  const { state, inputs } = runBots(7, 10000);
  const replay = run(inputs);
  assert.equal(checksum(replay.state), checksum(state));
});

test('Zustand übersteht JSON-Serialisierung mitten im Lauf', () => {
  const inputs = randomInputs(99, 10000);
  let a = createMatch();
  let b = createMatch();
  for (let i = 0; i < inputs.length; i++) {
    a = step(a, inputs[i][0], inputs[i][1]);
    b = step(b, inputs[i][0], inputs[i][1]);
    if (i === 5000) b = JSON.parse(JSON.stringify(b)); // z. B. übers Netz geschickt
  }
  assert.equal(checksum(a), checksum(b));
});

test('Training und Rundenneustart sind ebenfalls deterministisch', () => {
  const inputs = randomInputs(5, 4000);
  assert.equal(run(inputs, { training: true }).final, run(inputs, { training: true }).final);
  const s = run(inputs).state;
  assert.equal(checksum(resetRound(s)), checksum(resetRound(s)));
});

test('step() verändert den alten Zustand nie', () => {
  const inputs = randomInputs(3, 2000);
  let state = createMatch();
  for (const [i1, i2] of inputs) {
    deepFreeze(state); // jede Änderung würde jetzt einen Fehler werfen
    state = step(state, i1, i2);
  }
  assert.ok(state.frame === 2000);
});

test('alle Zahlen im Zustand sind Ganzzahlen', () => {
  runBots(11, 10000, (state) => {
    const bad = findNonInteger(state);
    if (bad) assert.fail(`Kommazahl im Zustand (Frame ${state.frame}): ${bad}`);
  });
  const inputs = randomInputs(12, 10000);
  let state = createMatch();
  for (const [i1, i2] of inputs) {
    state = step(state, i1, i2);
    const bad = findNonInteger(state);
    if (bad) assert.fail(`Kommazahl im Zustand (Frame ${state.frame}): ${bad}`);
  }
});

test('verschiedene Eingaben → verschiedene Prüfsummen (Eingaben wirken)', () => {
  const a = run(randomInputs(1, 1200));
  const b = run(randomInputs(2, 1200));
  assert.notEqual(a.final, b.final);
});

test('sim.js nutzt keinen Zufall, keine Zeit, keine Trigonometrie und kein DOM', () => {
  const forbidden = [
    /Math\.random/, /Date\b/, /performance\./, /\bsetTimeout\b/, /\bsetInterval\b/,
    /Math\.(sin|cos|tan|asin|acos|atan|atan2|sqrt|pow|exp|log|hypot|cbrt)\b/,
    /\bdocument\b/, /\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/,
  ];
  for (const file of ['../src/sim.js', '../src/config.js', '../src/buttons.js']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
    for (const pattern of forbidden) {
      assert.doesNotMatch(code, pattern, `${file} enthält Verbotenes: ${pattern}`);
    }
  }
});
