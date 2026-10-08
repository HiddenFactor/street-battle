// =====================================================================
// tests/characters.test.js – haben die Charaktere ihre Eigenschaften?
// ---------------------------------------------------------------------
// Starten:  node tests/characters.test.js     (oder: npm test)
// Erwartungen werden aus config.js berechnet – Werte dürfen sich ändern.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, checksum, SUB, charData } from '../src/sim.js';
import { CHARACTERS, CHARACTER_ORDER, MOVES, FIGHTER, GAME_SPEED } from '../src/config.js';
import { UP, DOWN, LEFT, RIGHT, LIGHT, HEAVY, SPECIAL } from '../src/buttons.js';

function fightState(chars, options = {}) {
  let s = createMatch({ ...options, chars });
  while (s.phase !== 'fight') s = step(s, 0, 0);
  return s;
}

function place(s, x0, x1) {
  s.fighters[0].x = x0 * SUB;
  s.fighters[1].x = x1 * SUB;
  return s;
}

function run(s, ticks, inputs) {
  const events = [];
  for (let t = 0; t < ticks; t++) {
    const [a, b] = inputs(t, s);
    s = step(s, a, b);
    for (const e of s.events) events.push({ ...e, tick: t });
  }
  return { s, events };
}

function rng(seed) {
  let x = seed >>> 0;
  return () => {
    let t = (x = (x + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('jeder Charakter startet mit seinen Lebenspunkten', () => {
  for (const a of CHARACTER_ORDER) {
    for (const b of CHARACTER_ORDER) {
      const s = createMatch({ chars: [a, b] });
      assert.equal(s.fighters[0].hp, CHARACTERS[a].hp ?? FIGHTER.MAX_HP);
      assert.equal(s.fighters[1].hp, CHARACTERS[b].hp ?? FIGHTER.MAX_HP);
      assert.deepEqual(s.chars, [a, b]);
    }
  }
});

test('unbekannter Charakter → Standard-Charakter', () => {
  const s = createMatch({ chars: ['gibtsnicht', undefined] });
  assert.deepEqual(s.chars, [CHARACTER_ORDER[0], CHARACTER_ORDER[0]]);
});

test('Schaden wird mit damageScale skaliert', () => {
  for (const id of CHARACTER_ORDER) {
    const s0 = place(fightState([id, 'funke']), 400, 500);
    const { events } = run(s0, 30, (t) => [t === 0 ? LIGHT : 0, 0]);
    const hit = events.find((e) => e.type === 'hit');
    assert.ok(hit, `${id}: kein Treffer`);
    const expected = Math.max(1, Math.round((MOVES.lightStand.damage * (CHARACTERS[id].damageScale || 100)) / 100));
    assert.equal(hit.dmg, expected, `${id}: falscher Schaden`);
  }
});

test('Fels: Erdstoß ist tief – stehend geblockt trifft er, geduckt nicht', () => {
  const standing = run(place(fightState(['fels', 'funke']), 250, 700), 200, (t) => [t === 0 ? SPECIAL : 0, RIGHT]);
  assert.ok(standing.events.find((e) => e.type === 'special' && e.kind === 'wave'), 'keine Druckwelle');
  assert.ok(standing.events.find((e) => e.type === 'hit' && e.proj), 'stehendes Blocken sollte nicht reichen');
  // Funke steht an der Wand (kann nicht zurückweichen)
  const crouching = run(place(fightState(['fels', 'funke']), 250, 700), 200, (t) => [t === 0 ? SPECIAL : 0, DOWN | RIGHT]);
  assert.ok(crouching.events.find((e) => e.type === 'block' && e.proj), 'geduckt nicht geblockt');
});

test('Fels: über die Druckwelle kann man springen', () => {
  const { events } = run(place(fightState(['fels', 'funke']), 250, 520), 200, (t, s) => {
    // Gegner springt, sobald die Welle nah ist
    const wave = s.projectiles[0];
    const jump = wave && Math.abs(wave.x - s.fighters[1].x) < 110 * SUB ? UP : 0;
    return [t === 0 ? SPECIAL : 0, jump];
  });
  assert.ok(!events.find((e) => e.type === 'hit'), 'Welle hat trotz Sprung getroffen');
});

test('Wiesel: Doppelsprung nur einmal pro Sprung, und er geht höher', () => {
  const single = run(place(fightState(['wiesel', 'funke']), 300, 800), 80, (t) => [t < 2 ? UP : 0, 0]);
  let maxSingle = 0;
  let maxDouble = 0;
  let jumps = 0;
  run(place(fightState(['wiesel', 'funke']), 300, 800), 80, (t, s) => {
    maxSingle = Math.max(maxSingle, s.fighters[0].y);
    return [t < 2 ? UP : 0, 0];
  });
  const r = run(place(fightState(['wiesel', 'funke']), 300, 800), 90, (t, s) => {
    maxDouble = Math.max(maxDouble, s.fighters[0].y);
    // nach dem Absprung mehrmals neu "hoch" drücken
    const press = t < 2 || t === 20 || t === 30 || t === 40;
    return [press ? UP : 0, 0];
  });
  jumps = r.events.filter((e) => e.type === 'jump' && e.p === 0).length;
  assert.equal(jumps, 2, 'genau ein Doppelsprung erwartet');
  assert.ok(maxDouble > maxSingle + 30 * SUB, 'Doppelsprung bringt keine Höhe');
  void single;
});

test('nur Wiesel kann doppelt springen', () => {
  for (const id of ['funke', 'fels']) {
    const r = run(place(fightState([id, 'funke']), 300, 800), 90, (t) => [t < 2 || t === 20 ? UP : 0, 0]);
    assert.equal(r.events.filter((e) => e.type === 'jump' && e.p === 0).length, 1, `${id} springt doppelt`);
  }
});

test('Wiesel: Blitztritt sprintet nach vorn, wirft um und hat Abklingzeit', () => {
  const m = MOVES.dashKick;
  const s0 = place(fightState(['wiesel', 'funke']), 300, 520);
  const { s, events } = run(s0, 60, (t) => [t === 0 || t === 40 ? SPECIAL : 0, 0]);
  const hit = events.find((e) => e.type === 'hit');
  assert.ok(hit && hit.knockdown, 'Blitztritt wirft nicht um');
  assert.equal(events.filter((e) => e.type === 'swing' && e.move === 'dashKick').length, 1, 'Abklingzeit ignoriert');
  assert.ok(s.fighters[0].x > 300 * SUB + 60 * SUB, 'kein Sprint nach vorn');
  assert.ok(m.cooldown > 40);
});

test('Wiesel: geblockter Blitztritt ist bestrafbar (Frame-Nachteil)', () => {
  const s0 = place(fightState(['wiesel', 'funke']), 300, 420);
  const { events } = run(s0, 60, (t) => [t === 0 ? SPECIAL : 0, RIGHT]);
  const block = events.find((e) => e.type === 'block');
  assert.ok(block, 'nicht geblockt');
  assert.ok(block.adv < -4, `Vorteil ${block.adv} – sollte deutlich negativ sein`);
});

test('Fels ist größer (Boxen), Wiesel kleiner', () => {
  const h = (id) => charData(id).hurt.stand[1].y + charData(id).hurt.stand[1].h;
  assert.ok(h('fels') > h('funke') && h('funke') > h('wiesel'));
});

test('alle Paarungen: deterministisch und nur Ganzzahlen', () => {
  const r = rng(77);
  const isInt = (v) => typeof v !== 'number' || Number.isInteger(v);
  for (const a of CHARACTER_ORDER) {
    for (const b of CHARACTER_ORDER) {
      const inputs = Array.from({ length: 2500 }, () => [Math.floor(r() * 128), Math.floor(r() * 128)]);
      const play = () => {
        let s = createMatch({ chars: [a, b] });
        for (const [i1, i2] of inputs) {
          s = step(s, i1, i2);
          for (const f of s.fighters) for (const v of Object.values(f)) assert.ok(isInt(v), `${a}/${b}: Kommazahl`);
          for (const p of s.projectiles) for (const v of Object.values(p)) assert.ok(isInt(v), `${a}/${b}: Kommazahl im Geschoss`);
        }
        return checksum(s);
      };
      assert.equal(play(), play(), `${a} gegen ${b} nicht deterministisch`);
    }
  }
});

test('Training füllt bis zum Maximum des Charakters auf', () => {
  const s0 = place(fightState(['funke', 'fels'], { training: true }), 400, 500);
  s0.fighters[1].hp = 10;
  const { s } = run(s0, 200, () => [0, 0]);
  assert.equal(s.fighters[1].hp, CHARACTERS.fels.hp);
});

test('Lauftempo unterscheidet sich', () => {
  const dist = (id) => {
    const { s } = run(place(fightState([id, 'funke']), 100, 900), 60, () => [RIGHT, 0]);
    return s.fighters[0].x;
  };
  assert.ok(dist('wiesel') > dist('funke') && dist('funke') > dist('fels'));
  void LEFT;
  void HEAVY;
});

// ---------------------------------------------------------------------
// Spieltempo
// ---------------------------------------------------------------------
test('Spieltempo: Sprung ist kürzer, aber gleich hoch', () => {
  let top = 0;
  const { events } = run(place(fightState(['funke', 'funke']), 300, 800), 80, (t, s) => {
    top = Math.max(top, s.fighters[0].y);
    return [t < 2 ? UP : 0, 0];
  });
  const jump = events.find((e) => e.type === 'jump' && e.p === 0);
  const land = events.find((e) => e.type === 'land' && e.p === 0);
  const airtime = land.tick - jump.tick;
  const baseAirtime = (2 * FIGHTER.JUMP_VELOCITY) / FIGHTER.GRAVITY;
  // Höhe bei schrittweiser Rechnung: v · (v + g) / 2g
  const baseHeight = (FIGHTER.JUMP_VELOCITY * (FIGHTER.JUMP_VELOCITY + FIGHTER.GRAVITY)) / (2 * FIGHTER.GRAVITY);
  assert.ok(Math.abs(airtime - baseAirtime / GAME_SPEED) <= 2, `Flugzeit ${airtime}, erwartet ~${(baseAirtime / GAME_SPEED).toFixed(1)}`);
  assert.ok(Math.abs(top / SUB - baseHeight) / baseHeight < 0.04, `Sprunghöhe ${top / SUB}, erwartet ~${baseHeight}`);
});

test('Spieltempo: Laufen ist schneller, Angriffe kürzer', () => {
  const { s } = run(place(fightState(['funke', 'funke']), 100, 900), 60, () => [RIGHT, 0]);
  const walked = (s.fighters[0].x - 100 * SUB) / SUB;
  const expected = FIGHTER.WALK_FORWARD * 60 * GAME_SPEED;
  assert.ok(Math.abs(walked - expected) < 3, `gelaufen ${walked}, erwartet ~${expected}`);
  const m = charData('funke').moves.heavyStand;
  const base = MOVES.heavyStand;
  assert.ok(Math.abs(m.total - (base.startup + base.active + base.recovery) / GAME_SPEED) <= 1.5);
});

// ---------------------------------------------------------------------
// Luchs: Konter
// ---------------------------------------------------------------------
test('Luchs: Konter fängt einen Schlag ab und schlägt zurück', () => {
  const s0 = place(fightState(['luchs', 'funke']), 400, 500);
  const { s, events } = run(s0, 60, (t) => [t === 0 ? SPECIAL : 0, t === 2 ? LIGHT : 0]);
  const counter = events.find((e) => e.type === 'counter');
  assert.ok(counter && !counter.proj, 'kein Konter');
  assert.equal(s.fighters[0].hp, CHARACTERS.luchs.hp, 'Luchs hat Schaden bekommen');
  const hit = events.find((e) => e.type === 'hit' && e.p === 1);
  assert.ok(hit && hit.knockdown, 'Konterschlag trifft nicht oder wirft nicht um');
});

test('Luchs: Konter schluckt Geschosse', () => {
  const s0 = place(fightState(['luchs', 'funke']), 250, 700);
  const { s, events } = run(s0, 120, (t, st) => {
    const ball = st.projectiles[0];
    const near = ball && Math.abs(ball.x - st.fighters[0].x) < 120 * SUB;
    return [near ? SPECIAL : 0, t === 0 ? SPECIAL : 0];
  });
  const counter = events.find((e) => e.type === 'counter');
  assert.ok(counter && counter.proj, 'Geschoss nicht abgefangen');
  assert.ok(!events.find((e) => e.type === 'hit'), 'trotzdem getroffen');
  assert.equal(s.fighters[0].hp, CHARACTERS.luchs.hp);
});

test('Luchs: Konter braucht Erholung, und ein Griff schlägt den Konter', () => {
  const m = charData('luchs').moves.counter;
  assert.ok(m.recovery >= 10, 'Konter braucht Erholung');
  const s0 = place(fightState(['luchs', 'anker']), 400, 470);
  const { events } = run(s0, 60, (t) => [t === 0 ? SPECIAL : 0, t === 3 ? SPECIAL : 0]);
  assert.ok(!events.find((e) => e.type === 'counter'), 'Griff wurde gekontert');
  assert.ok(events.find((e) => e.type === 'hit' && e.grab && e.p === 0), 'Griff hat nicht gepackt');
});

// ---------------------------------------------------------------------
// Anker: Klammergriff
// ---------------------------------------------------------------------
test('Anker: Griff geht durch den Block und wirft um', () => {
  const s0 = place(fightState(['anker', 'funke']), 400, 470);
  // Funke hält "zurück" (rechts) = Blockhaltung
  const { s, events } = run(s0, 60, (t) => [t === 0 ? SPECIAL : 0, RIGHT]);
  const hit = events.find((e) => e.type === 'hit' && e.grab);
  assert.ok(hit && hit.knockdown, 'Griff hat nicht gepackt');
  assert.ok(!events.find((e) => e.type === 'block'), 'Griff wurde geblockt');
  assert.ok(s.fighters[1].hp < FIGHTER.MAX_HP);
});

test('Anker: Griff packt keine springenden Gegner', () => {
  const s0 = place(fightState(['anker', 'funke']), 400, 470);
  const { events } = run(s0, 60, (t) => [t === 6 ? SPECIAL : 0, t < 2 ? UP : 0]);
  assert.ok(events.find((e) => e.type === 'swing' && e.move === 'grab'), 'kein Griff versucht');
  assert.ok(!events.find((e) => e.type === 'hit' && e.grab), 'springenden Gegner gepackt');
});

test('Anker: Griff hat kurze Reichweite und lange Erholung', () => {
  const m = charData('anker').moves.grab;
  assert.ok(m.recovery >= 20);
  const s0 = place(fightState(['anker', 'funke']), 300, 600);
  const { events } = run(s0, 60, (t) => [t === 0 ? SPECIAL : 0, 0]);
  assert.ok(!events.find((e) => e.type === 'hit'), 'Griff reicht zu weit');
});

// ---------------------------------------------------------------------
// Komet: Sternwurf
// ---------------------------------------------------------------------
test('Komet: Sternwurf kommt von oben – geduckt trifft er, stehend wird geblockt', () => {
  // Funke steht an der Wand (kann nicht zurückweichen)
  const crouching = run(place(fightState(['komet', 'funke']), 560, 920), 160, (t) => [t === 0 ? SPECIAL : 0, DOWN | RIGHT]);
  assert.ok(crouching.events.find((e) => e.type === 'special' && e.kind === 'arc'), 'kein Sternwurf');
  assert.ok(crouching.events.find((e) => e.type === 'hit' && e.proj), 'geduckt sollte nicht reichen');
  const standing = run(place(fightState(['komet', 'funke']), 560, 920), 160, (t) => [t === 0 ? SPECIAL : 0, RIGHT]);
  assert.ok(standing.events.find((e) => e.type === 'block' && e.proj), 'stehend nicht geblockt');
});

test('Komet: zurück = kurz, vorne = weit; der Stern zerplatzt am Boden', () => {
  const landing = (dir) => {
    const { events } = run(place(fightState(['komet', 'funke']), 150, 900), 160, (t) => [(t === 0 ? SPECIAL : 0) | dir, 0]);
    const fade = events.find((e) => e.type === 'fade' && e.ground);
    assert.ok(fade, 'Stern landet nicht');
    return fade.x;
  };
  const near = landing(LEFT);
  const mid = landing(0);
  const far = landing(RIGHT);
  assert.ok(near < mid && mid < far, `Weiten: ${near} / ${mid} / ${far}`);
});

test('die neuen Charaktere springen nicht doppelt', () => {
  for (const id of ['luchs', 'komet', 'anker']) {
    const r = run(place(fightState([id, 'funke']), 300, 800), 90, (t) => [t < 2 || t === 20 ? UP : 0, 0]);
    assert.equal(r.events.filter((e) => e.type === 'jump' && e.p === 0).length, 1, `${id} springt doppelt`);
  }
});
