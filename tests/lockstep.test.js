// =====================================================================
// tests/lockstep.test.js – Online-Netcode mit simuliertem Netz
// ---------------------------------------------------------------------
// Starten:  node tests/lockstep.test.js     (oder: npm test)
// Zwei "Geräte" (Host und Gast) laufen im selben Programm. Dazwischen
// liegt ein künstliches Netz mit Verzögerung, Paketverlust, doppelten
// und vertauschten Paketen. Beide müssen trotzdem exakt gleich rechnen.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lockstep } from '../src/lockstep.js';
import { createMatch, checksum } from '../src/sim.js';
import { BotInput } from '../src/input.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Künstliches Netz: Nachrichten kommen verzögert, manchmal gar nicht,
// manchmal doppelt und in beliebiger Reihenfolge an.
class FakeNet {
  constructor(seed, { minLag = 2, maxLag = 10, loss = 0.1, dup = 0.05 } = {}) {
    this.r = rng(seed);
    this.opts = { minLag, maxLag, loss, dup };
    this.queue = [];
    this.now = 0;
    this.sent = 0;
  }
  sender(to) {
    return (msg) => {
      this.sent++;
      const { minLag, maxLag, loss, dup } = this.opts;
      const copies = this.r() < dup ? 2 : 1;
      for (let c = 0; c < copies; c++) {
        if (this.r() < loss) continue;
        const lag = minLag + Math.floor(this.r() * (maxLag - minLag + 1));
        this.queue.push({ at: this.now + lag, to, msg: JSON.parse(JSON.stringify(msg)), order: this.r() });
      }
    };
  }
  deliver(peers) {
    const due = this.queue.filter((m) => m.at <= this.now).sort((a, b) => a.order - b.order);
    this.queue = this.queue.filter((m) => m.at > this.now);
    for (const m of due) peers[m.to].receive(m.msg);
  }
}

function setup(seed, netOpts) {
  const net = new FakeNet(seed, netOpts);
  const peers = [];
  peers[0] = new Lockstep({ isHost: true, send: net.sender(1) });
  peers[1] = new Lockstep({ isHost: false, send: net.sender(0) });
  const sums = [new Map(), new Map()];
  return { net, peers, sums };
}

// Einen Tick für beide Geräte; "slow" lässt den Gast manchmal einen Tick auslassen
function runTicks(ctx, ticks, inputFor, { slow = 0.1, seed = 1, onTick } = {}) {
  const r = rng(seed);
  for (let t = 0; t < ticks; t++) {
    ctx.net.now++;
    ctx.net.deliver(ctx.peers);
    for (let p = 0; p < 2; p++) {
      if (p === 1 && r() < slow) continue;
      const ls = ctx.peers[p];
      if (ls.tick(inputFor(p, ls)) && ls.state) {
        ctx.sums[p].set(`${ls.session}:${ls.frame}`, checksum(ls.state));
      }
      ls.takeEvents();
    }
    if (onTick) onTick(t);
  }
}

function compareSums(ctx) {
  let compared = 0;
  for (const [key, h] of ctx.sums[0]) {
    if (ctx.sums[1].has(key)) {
      assert.equal(ctx.sums[1].get(key), h, `Zustände weichen ab bei Session:Frame ${key}`);
      compared++;
    }
  }
  return compared;
}

function randomInput(seed) {
  const r = rng(seed);
  let hold = 0;
  return () => {
    if (r() < 0.08) hold = Math.floor(r() * 16);
    let m = hold;
    if (r() < 0.1) m |= 16 << Math.floor(r() * 3);
    return m;
  };
}

test('Host und Gast rechnen trotz schlechtem Netz exakt gleich', () => {
  // Laufzeit 1–5 Ticks, 15 % Verlust, doppelte und vertauschte Pakete
  const ctx = setup(1, { minLag: 1, maxLag: 5, loss: 0.15, dup: 0.05 });
  const inputs = [randomInput(11), randomInput(22)];
  ctx.peers[0].hostStart(createMatch(), 4, 'start');
  runTicks(ctx, 4000, (p) => inputs[p]());
  const compared = compareSums(ctx);
  assert.ok(compared > 2800, `zu wenig verglichen: ${compared}`);
  assert.ok(ctx.peers[0].frame > 2800 && ctx.peers[1].frame > 2800, 'Spiel hängt fest');
  assert.equal(ctx.peers[0].desyncCount + ctx.peers[1].desyncCount, 0);
});

test('sehr schlechtes Netz: langsamer, aber nie falsch', () => {
  const ctx = setup(2, { minLag: 2, maxLag: 14, loss: 0.25, dup: 0.1 });
  const inputs = [randomInput(3), randomInput(4)];
  ctx.peers[0].hostStart(createMatch(), 3, 'start');
  runTicks(ctx, 4000, (p) => inputs[p]());
  assert.ok(compareSums(ctx) > 800, 'Spiel hängt fest');
  assert.equal(ctx.peers[0].desyncCount + ctx.peers[1].desyncCount, 0);
});

test('verschiedene Verzögerungen (1 bis 8) funktionieren', () => {
  for (const delay of [1, 2, 5, 8]) {
    // Netz-Laufzeit passend zur Verzögerung (so wählt man sie auch im Spiel)
    const ctx = setup(100 + delay, { minLag: 0, maxLag: delay, loss: 0.05 });
    const inputs = [randomInput(delay), randomInput(delay * 7)];
    ctx.peers[0].hostStart(createMatch(), delay, 'start');
    runTicks(ctx, 1500, (p) => inputs[p]());
    assert.ok(compareSums(ctx) > 1000, `Verzögerung ${delay}: zu wenig Fortschritt`);
    assert.equal(ctx.peers[1].delay, delay, 'Gast übernimmt die Verzögerung des Hosts');
  }
});

test('Start-Nachricht geht verloren → wird wiederholt', () => {
  const ctx = setup(5, { minLag: 2, maxLag: 4, loss: 0 });
  const realSend = ctx.peers[0].send;
  let dropped = 0;
  ctx.peers[0].send = (msg) => {
    if (msg.t === 'sync' && dropped < 3) {
      dropped++;
      return;
    }
    realSend(msg);
  };
  ctx.peers[0].hostStart(createMatch(), 3, 'start');
  const inputs = [randomInput(1), randomInput(2)];
  runTicks(ctx, 600, (p) => inputs[p]());
  assert.equal(ctx.peers[1].session, 1);
  assert.ok(ctx.peers[1].frame > 300);
  assert.ok(compareSums(ctx) > 300);
});

test('fehlende Eingaben → es wird gewartet, nicht geraten', () => {
  const ctx = setup(9, { minLag: 2, maxLag: 3, loss: 0 });
  ctx.peers[0].hostStart(createMatch(), 3, 'start');
  runTicks(ctx, 100, () => 0, { slow: 0 });
  const before = ctx.peers[0].frame;
  // Gast fällt aus: Host darf höchstens "delay" Frames weiterlaufen
  for (let t = 0; t < 60; t++) {
    ctx.net.now++;
    ctx.net.deliver(ctx.peers);
    ctx.peers[0].tick(0);
  }
  assert.ok(ctx.peers[0].frame - before <= 3 + 3, `Host lief ohne Gegner weiter: ${ctx.peers[0].frame - before}`);
});

test('Desync wird erkannt und die Runde neu gestartet', () => {
  const ctx = setup(77, { minLag: 2, maxLag: 6, loss: 0.05 });
  const inputs = [randomInput(5), randomInput(6)];
  ctx.peers[0].hostStart(createMatch(), 3, 'start');
  let corrupted = false;
  runTicks(ctx, 3000, (p) => inputs[p](), {
    onTick: () => {
      if (!corrupted && ctx.peers[1].frame === 500) {
        ctx.peers[1].corrupt();
        corrupted = true;
      }
    },
  });
  assert.ok(corrupted);
  assert.ok(ctx.peers[0].desyncCount + ctx.peers[1].desyncCount >= 1, 'Desync nicht erkannt');
  assert.equal(ctx.peers[0].session, 2, 'keine neue Session nach Desync');
  assert.equal(ctx.peers[1].session, 2);
  // Nach dem Neustart rechnen beide wieder gleich
  let comparedAfter = 0;
  for (const [key, h] of ctx.sums[0]) {
    if (key.startsWith('2:') && ctx.sums[1].has(key)) {
      assert.equal(ctx.sums[1].get(key), h);
      comparedAfter++;
    }
  }
  assert.ok(comparedAfter > 1000, `nach Neustart zu wenig verglichen: ${comparedAfter}`);
});

test('Rematch: beide stimmen zu → neues Match für beide', () => {
  const ctx = setup(31, { minLag: 2, maxLag: 6, loss: 0.1 });
  ctx.peers[0].hostStart(createMatch(), 2, 'start');
  const bots = [0, 1].map((p) => new BotInput(p + 3, () => ctx.peers[p].state && ctx.peers[p].state.fighters[p], () => ctx.peers[p].state && ctx.peers[p].state.fighters[1 - p]));
  let requested = false;
  runTicks(ctx, 20000, (p) => bots[p].read(), {
    onTick: () => {
      if (!requested && ctx.peers.every((ls) => ls.state.phase === 'matchEnd')) {
        ctx.peers.forEach((ls) => ls.requestRematch());
        requested = true;
      }
    },
  });
  assert.ok(requested, 'Match wurde nie beendet');
  assert.equal(ctx.peers[0].session, 2);
  assert.equal(ctx.peers[1].session, 2);
  assert.ok(compareSums(ctx) > 1000);
});
