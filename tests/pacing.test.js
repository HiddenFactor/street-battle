// =====================================================================
// tests/pacing.test.js – läuft das Spiel gleichmäßig (ohne Ruckler)?
// ---------------------------------------------------------------------
// Starten:  node tests/pacing.test.js     (oder: npm test)
// Prüft die Taktlogik (pacing.js) und den Zeitabgleich im Online-Spiel
// (lockstep.js) mit realistischen Browser-Zeitstempeln: auf 0,1 ms
// gerundet, leicht unruhig, Geräte mit leicht unterschiedlichen Uhren.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameClock, STEP_MS } from '../src/pacing.js';
import { Lockstep } from '../src/lockstep.js';
import { createMatch } from '../src/sim.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zeitstempel wie requestAnimationFrame sie liefert (gerundet auf 0,1 ms, leicht unruhig)
function stamps(hz, count, seed, clockRate = 1) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) out.push(Math.round(((i * 1000) / hz + (r() - 0.5) * 0.06) * clockRate * 10) / 10);
  return out;
}

test('60-Hz-Bildschirm: genau ein Spielschritt pro Bild', () => {
  const fc = new FrameClock();
  const t = stamps(60, 3600, 1);
  const counts = {};
  for (let i = 1; i < t.length; i++) {
    fc.add(t[i] - t[i - 1]);
    const n = fc.run(() => true);
    counts[n] = (counts[n] || 0) + 1;
  }
  assert.deepEqual(counts, { 1: 3599 });
});

test('120-Hz-Bildschirm: abwechselnd 0 und 1 Schritt, im Schnitt 60 pro Sekunde', () => {
  const fc = new FrameClock();
  const t = stamps(120, 1200, 2);
  let total = 0;
  for (let i = 1; i < t.length; i++) {
    fc.add(t[i] - t[i - 1]);
    const n = fc.run(() => true);
    assert.ok(n <= 1, 'nie zwei Schritte in einem Bild');
    total += n;
  }
  assert.ok(Math.abs(total - 600) <= 1, `${total} Schritte statt 600`);
});

test('nach einem Warten läuft es sofort wieder gleichmäßig', () => {
  const fc = new FrameClock();
  const t = stamps(60, 600, 3);
  let uneven = 0;
  for (let i = 1; i < t.length; i++) {
    fc.add(t[i] - t[i - 1]);
    const waiting = i === 100 || i === 300; // zwei kurze Hänger
    const n = fc.run(() => !waiting);
    if (i > 102 && i !== 300 && i !== 301 && n !== 1) uneven++;
  }
  assert.equal(uneven, 0);
});

// Zwei Geräte online, jedes mit eigenem Bildschirm-Takt und eigener Uhr
function simulateOnline({ clock = [1, 1], hz = [60, 60], latency = 3.5, jitter = 3, spikes = 0, seconds = 30, delay = 2, seed = 1 }) {
  const r = rng(seed);
  let now = 0;
  const queue = [];
  const send = (to) => (msg) => {
    let lag = latency + (r() - 0.5) * 2 * jitter;
    if (spikes && r() < spikes) lag += 40 + r() * 60;
    queue.push({ at: now + Math.max(0.3, lag), to, msg: JSON.parse(JSON.stringify(msg)) });
  };
  const peers = [0, 1].map((i) => ({
    fc: new FrameClock(),
    ls: new Lockstep({ isHost: i === 0, send: send(1 - i), now: () => now * clock[i] }),
    next: r() * 16,
    last: null,
    frames: 0,
    uneven: 0,
  }));
  peers[0].ls.hostStart(createMatch(), delay, 'start');
  for (now = 0; now < seconds * 1000; now += 0.1) {
    for (let k = queue.length - 1; k >= 0; k--) {
      if (queue[k].at <= now) {
        peers[queue[k].to].ls.receive(queue[k].msg);
        queue.splice(k, 1);
      }
    }
    peers.forEach((p, i) => {
      if (now < p.next) return;
      p.next += 1000 / hz[i] / clock[i];
      const stamp = Math.round((now + (r() - 0.5) * 0.06) * clock[i] * 10) / 10;
      if (p.last !== null) p.fc.add(stamp - p.last);
      p.last = stamp;
      const steps = p.fc.run(() => {
        const ok = p.ls.tick(0, latency);
        p.ls.takeEvents();
        return ok;
      }, p.ls.timeScale());
      p.frames++;
      if (p.frames > 120 && steps !== 1) p.uneven++;
    });
  }
  return peers.map((p) => ({ uneven: (100 * p.uneven) / p.frames, frame: p.ls.frame }));
}

test('online, gleiche Uhren: keine Ruckler', () => {
  for (const p of simulateOnline({})) assert.ok(p.uneven < 0.1, `${p.uneven.toFixed(2)} % ungleichmäßige Bilder`);
});

test('online, Uhren 0,2 % verschieden + 59,94-Hz-Bildschirm: Zeitabgleich verhindert Ruckler', () => {
  const peers = simulateOnline({ clock: [1, 1.002], hz: [60, 59.94] });
  for (const p of peers) assert.ok(p.uneven < 0.5, `${p.uneven.toFixed(2)} % ungleichmäßige Bilder`);
  assert.ok(Math.abs(peers[0].frame - peers[1].frame) <= 3, 'Geräte laufen auseinander');
});

test('online, WLAN-Spitzen: kaum Ruckler', () => {
  for (const p of simulateOnline({ clock: [1, 1.002], spikes: 0.01, seed: 4 })) {
    assert.ok(p.uneven < 1, `${p.uneven.toFixed(2)} % ungleichmäßige Bilder`);
  }
});

test('STEP_MS ist 1/60 Sekunde', () => {
  assert.equal(Math.round(STEP_MS * 60), 1000);
});
