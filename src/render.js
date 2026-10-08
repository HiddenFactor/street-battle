// =====================================================================
// render.js – zeichnet den Spielzustand
// ---------------------------------------------------------------------
// Liest den Zustand aus sim.js nur ab und verändert ihn nie.
// Alles "Schöne", das nicht spielentscheidend ist (Partikel, Bildschirm-
// wackeln, Lebensbalken-Nachlauf, Parallaxe), passiert nur hier.
// Hier sind Zufall, Zeit und Trigonometrie erlaubt.
// =====================================================================

import { SUB, hurtboxesOf, pushboxWorld, hitboxOf, projectileBox, charData, DEFAULT_CHAR } from './sim.js';
import { ROUND, LOOK, CHARACTERS } from './config.js';
import { poseFor, solvePose, blend } from './poses.js';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const FLOOR_Y = 470;   // Höhe der Füße auf dem Bildschirm
const HORIZON_Y = 400;        // hintere Kante der Straße
const OUTLINE = '#120a16';
const FONT = '"Arial Black", "Segoe UI Black", Impact, "Helvetica Neue", Arial, sans-serif';
const TAU = Math.PI * 2;
const KICKS = ['heavyStand', 'lightCrouch', 'heavyCrouch', 'lightAir', 'heavyAir', 'dashKick'];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Fester Zufall für den Hintergrund (sieht bei jedem Start gleich aus)
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => clamp(Math.round(c * amount), 0, 255);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// =====================================================================
// Hintergrund (einmal vorgezeichnet)
// =====================================================================
function buildSky() {
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, HORIZON_Y);
  sky.addColorStop(0, '#0c0620');
  sky.addColorStop(0.45, '#2a1150');
  sky.addColorStop(0.78, '#7a2a6a');
  sky.addColorStop(1, '#e0644f');
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  const r = seeded(7);
  for (let i = 0; i < 140; i++) {
    const y = r() * 260;
    g.globalAlpha = (1 - y / 260) * (0.3 + r() * 0.7);
    g.fillStyle = '#fff';
    const s = r() < 0.1 ? 2 : 1;
    g.fillRect(r() * VIEW_W, y, s, s);
  }
  g.globalAlpha = 1;
  // Mond mit Schein
  const mx = 730;
  const my = 95;
  const glow = g.createRadialGradient(mx, my, 10, mx, my, 160);
  glow.addColorStop(0, 'rgba(255,220,240,0.35)');
  glow.addColorStop(1, 'rgba(255,220,240,0)');
  g.fillStyle = glow;
  g.fillRect(mx - 160, my - 160, 320, 320);
  g.fillStyle = '#ffe9f0';
  g.beginPath();
  g.arc(mx, my, 38, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(200,160,190,0.35)';
  for (const [dx, dy, rr] of [[-12, -8, 8], [10, 6, 6], [-4, 14, 5], [14, -14, 4]]) {
    g.beginPath();
    g.arc(mx + dx, my + dy, rr, 0, TAU);
    g.fill();
  }
  return c;
}

function buildSkyline(w, h, seed, colorTop, colorBottom, windowAlpha, minH, maxH) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = seeded(seed);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  let x = -10;
  while (x < w) {
    const bw = 40 + r() * 70;
    const bh = minH + r() * (maxH - minH);
    const top = h - bh;
    g.fillStyle = grad;
    g.fillRect(x, top, bw, bh);
    // Dachdetails
    if (r() < 0.35) g.fillRect(x + bw * 0.3, top - 18, 3, 18);
    if (r() < 0.25) g.fillRect(x + bw * 0.55, top - 12, bw * 0.25, 12);
    // Fenster
    for (let wy = top + 10; wy < h - 8; wy += 14) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 11) {
        if (r() < 0.32) {
          g.fillStyle = r() < 0.8 ? `rgba(255,214,140,${windowAlpha})` : `rgba(140,220,255,${windowAlpha})`;
          g.fillRect(wx, wy, 5, 7);
        }
      }
    }
    x += bw + r() * 6;
  }
  return c;
}

function buildStreetWall(w) {
  // Häuserzeile direkt hinter der Straße mit Läden
  const h = 170;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = seeded(99);
  let x = 0;
  const palette = ['#2b1d3d', '#33203f', '#24193a', '#3a2238'];
  while (x < w) {
    const bw = 150 + r() * 120;
    const bh = 120 + r() * 50;
    g.fillStyle = palette[Math.floor(r() * palette.length)];
    g.fillRect(x, h - bh, bw, bh);
    // Mauerfugen
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = h - bh + 6; y < h; y += 10) g.fillRect(x, y, bw, 1);
    // Ladenfront
    const shopTop = h - 62;
    g.fillStyle = '#16101f';
    g.fillRect(x + 12, shopTop, bw - 24, 62);
    if (r() < 0.55) {
      // erleuchtetes Schaufenster
      const lg = g.createLinearGradient(0, shopTop, 0, h);
      lg.addColorStop(0, 'rgba(255,190,120,0.55)');
      lg.addColorStop(1, 'rgba(255,120,80,0.15)');
      g.fillStyle = lg;
      g.fillRect(x + 18, shopTop + 8, bw - 36, 46);
      g.fillStyle = 'rgba(30,15,30,0.6)';
      for (let sx = x + 18; sx < x + bw - 18; sx += 26) g.fillRect(sx, shopTop + 8, 2, 46);
    } else {
      // Rollladen
      g.fillStyle = '#4a4458';
      g.fillRect(x + 18, shopTop + 6, bw - 36, 56);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let sy = shopTop + 9; sy < h; sy += 5) g.fillRect(x + 18, sy, bw - 36, 1);
      // Graffiti-Kringel
      g.strokeStyle = ['#ff4d6d', '#5fb4ff', '#ffcf3a', '#7dff9b'][Math.floor(r() * 4)];
      g.globalAlpha = 0.6;
      g.lineWidth = 4;
      g.beginPath();
      const gx = x + 30 + r() * (bw - 80);
      g.moveTo(gx, shopTop + 40);
      g.bezierCurveTo(gx + 15, shopTop + 10, gx + 30, shopTop + 55, gx + 48, shopTop + 22);
      g.stroke();
      g.globalAlpha = 1;
    }
    // Obere Fenster
    for (let wy = h - bh + 14; wy < shopTop - 20; wy += 34) {
      for (let wx = x + 20; wx < x + bw - 30; wx += 40) {
        g.fillStyle = r() < 0.4 ? 'rgba(255,205,130,0.65)' : 'rgba(20,12,30,0.9)';
        g.fillRect(wx, wy, 18, 22);
      }
    }
    // Feuerleiter
    if (r() < 0.4) {
      g.strokeStyle = 'rgba(10,6,16,0.8)';
      g.lineWidth = 2;
      const fx = x + bw * 0.6;
      for (let fy = h - bh + 20; fy < shopTop - 10; fy += 30) {
        g.strokeRect(fx, fy, 40, 26);
        g.beginPath();
        g.moveTo(fx, fy + 26);
        g.lineTo(fx + 40, fy);
        g.stroke();
      }
    }
    x += bw;
  }
  // Gehweg-Kante
  g.fillStyle = '#100a18';
  g.fillRect(0, h - 4, w, 4);
  return c;
}

function buildSign(text, color, size) {
  const pad = 30;
  const c = makeCanvas(1, 1);
  let g = c.getContext('2d');
  g.font = `italic 900 ${size}px ${FONT}`;
  const tw = Math.ceil(g.measureText(text).width);
  c.width = tw + pad * 2;
  c.height = size + pad * 2;
  g = c.getContext('2d');
  g.font = `italic 900 ${size}px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(10,6,18,0.85)';
  g.fillRect(pad - 10, pad - 6, tw + 20, size + 12);
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeStyle = color;
  g.lineWidth = 2.5;
  g.strokeText(text, pad, pad + size / 2);
  g.shadowBlur = 8;
  g.fillStyle = '#fff';
  g.globalAlpha = 0.9;
  g.fillText(text, pad, pad + size / 2);
  return c;
}

function buildCrowd(w) {
  const h = 80;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = seeded(31);
  for (let layer = 0; layer < 2; layer++) {
    g.fillStyle = layer === 0 ? '#1a1024' : '#0b0612';
    let x = -20 + layer * 22;
    while (x < w + 20) {
      const s = 0.85 + r() * 0.4;
      const base = h - (layer === 0 ? 18 : 0);
      g.beginPath();
      g.arc(x, base - 38 * s, 13 * s, 0, TAU); // Kopf
      g.fill();
      g.beginPath();
      g.ellipse(x, base - 4, 26 * s, 26 * s, 0, Math.PI, TAU); // Schultern
      g.fill();
      if (r() < 0.2) g.fillRect(x + 14 * s, base - 64 * s, 7, 40 * s); // erhobener Arm
      x += 34 + r() * 18;
    }
  }
  return c;
}

function buildVignette() {
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = c.getContext('2d');
  const v = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  return c;
}

function buildGlow(r, g, b, alpha, size) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},${alpha * 0.35})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// =====================================================================
// Renderer
// =====================================================================
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.showBoxes = false;
    this.localPlayer = -1;
    this.time = 0;
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.crowdHype = 0;
    this.lastAdv = null;
    this.annText = '';
    this.annStart = 0;
    this.fx = [0, 1].map(() => ({ flash: 0, pose: null, trail: [], hpLag: 999, hpShown: 999, lagDelay: 0 }));
    this.palettes = null; // Farben der beiden Kämpfer (aus dem letzten Bild, für Effekte)
    this.combo = [{ count: 0, t: -10 }, { count: 0, t: -10 }];

    this.sky = buildSky();
    this.far = buildSkyline(1160, 260, 3, '#2c1748', '#3d1c4f', 0.35, 70, 230);
    this.mid = buildSkyline(1220, 220, 11, '#1d0f2e', '#28143a', 0.6, 60, 190);
    this.street = buildStreetWall(1300);
    this.crowd = buildCrowd(1300);
    this.vignette = buildVignette();
    this.signs = [
      { img: buildSign('BATTLE', '#ff3d8b', 30), x: 180, y: 250, k: 0.1, seed: 1 },
      { img: buildSign('RAMEN', '#3df2ff', 22), x: 650, y: 272, k: 0.1, seed: 2 },
      { img: buildSign('24/7', '#7dff6b', 18), x: 860, y: 300, k: 0.1, seed: 3 },
    ];
    this.glows = [
      buildGlow(255, 250, 230, 1, 128),   // weißer Kern
      buildGlow(255, 210, 140, 0.9, 256), // Laterne
    ];
    this.glowCache = new Map(); // Leuchten in Spielerfarben (siehe glowSprite)
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.scale = this.canvas.width / VIEW_W;
  }

  // -------------------------------------------------------------------
  // Ereignisse aus der Simulation → Effekte
  // -------------------------------------------------------------------
  onEvent(e) {
    const amount = LOOK.PARTICLES;
    const shakeMul = LOOK.SCREEN_SHAKE;
    const sx = e.x;
    const sy = FLOOR_Y - (e.y || 0);
    switch (e.type) {
      case 'hit': {
        const big = e.heavy || e.ko;
        this.fx[e.p].flash = 0.14;
        this.burst(sx, sy, big ? 26 : 14, ['#fff7c2', '#ffd23b', '#ff8a3c'], big ? 520 : 380, 'spark', amount);
        this.addParticle({ type: 'star', x: sx, y: sy, life: 0.16, size: big ? 70 : 44, color: '#fff' });
        this.addParticle({ type: 'ring', x: sx, y: sy, life: 0.3, size: big ? 90 : 55, color: 'rgba(255,230,160,1)' });
        this.shake = Math.max(this.shake, (big ? 9 : 4) * shakeMul);
        if (e.combo >= 2) this.combo[e.a] = { count: e.combo, t: this.time };
        if (e.adv !== null && e.adv !== undefined) this.lastAdv = { value: e.adv, kind: 'Treffer', dmg: e.dmg };
        else this.lastAdv = { value: null, kind: 'Treffer', dmg: e.dmg };
        this.crowdHype = Math.max(this.crowdHype, big ? 0.6 : 0.25);
        if (e.ko) {
          this.flash = 0.5;
          this.shake = 16 * shakeMul;
          this.burst(sx, sy, 40, ['#fff', '#ffd23b', '#ff4d6d'], 700, 'spark', amount);
          this.crowdHype = 1.5;
        }
        break;
      }
      case 'block':
        this.burst(sx, sy, 10, ['#d8f0ff', '#5fb4ff'], 300, 'spark', amount);
        this.addParticle({ type: 'shield', x: sx, y: sy, life: 0.22, size: 34, color: 'rgba(120,200,255,1)' });
        this.shake = Math.max(this.shake, 2 * shakeMul);
        this.lastAdv = { value: e.adv, kind: 'Block', dmg: 0 };
        break;
      case 'special': {
        const glow = this.palettes ? this.palettes[e.p].glow : '#ffffff';
        if (e.kind === 'wave') {
          // Erdstoß: Staub, Gesteinsbrocken, kräftiges Wackeln
          this.dust(sx, FLOOR_Y, 16, amount);
          this.burst(sx, FLOOR_Y - 4, 14, ['#a8957d', '#8a7a68', glow], 380, 'dot', amount);
          this.addParticle({ type: 'ring', x: sx, y: FLOOR_Y, life: 0.35, size: 90, color: rgba(glow, 1) });
          this.shake = Math.max(this.shake, 7 * shakeMul);
        } else {
          this.addParticle({ type: 'ring', x: sx, y: sy, life: 0.25, size: 50, color: rgba(glow, 1) });
          this.burst(sx, sy, 10, ['#ffffff', glow], 260, 'dot', amount);
        }
        break;
      }
      case 'clash':
        this.burst(sx, sy, 30, ['#fff', '#d8f0ff', '#ffd9a0'], 520, 'spark', amount);
        this.addParticle({ type: 'ring', x: sx, y: sy, life: 0.4, size: 120, color: 'rgba(255,255,255,1)' });
        this.shake = Math.max(this.shake, 6 * shakeMul);
        break;
      case 'fade':
        this.burst(sx, sy, 8, ['#ffffff'], 120, 'dot', amount);
        break;
      case 'jump':
        if (e.double) {
          // Doppelsprung: Luftstoß unter den Füßen
          this.addParticle({ type: 'ring', x: sx, y: FLOOR_Y - (e.y || 0), life: 0.25, size: 40, color: 'rgba(255,255,255,1)' });
        } else {
          this.dust(sx, FLOOR_Y, 5, amount);
        }
        break;
      case 'land':
        this.dust(sx, FLOOR_Y, 8, amount);
        break;
      case 'down':
        this.dust(sx, FLOOR_Y, 18, amount);
        this.shake = Math.max(this.shake, 5 * shakeMul);
        break;
      case 'ko':
        this.flash = Math.max(this.flash, 0.35);
        this.crowdHype = 1.5;
        break;
      case 'round':
        for (const fx of this.fx) {
          fx.hpLag = 999; // wird auf das Maximum des Charakters begrenzt
          fx.trail = [];
        }
        this.particles = [];
        this.lastAdv = null;
        break;
    }
  }

  addParticle(p) {
    if (this.particles.length > 500) return;
    p.age = 0;
    this.particles.push(p);
  }

  burst(x, y, count, colors, speed, type, amount = 1) {
    const n = Math.round(count * amount);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const v = rand(speed * 0.3, speed);
      this.addParticle({
        type, x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.15,
        life: rand(0.18, 0.45),
        size: type === 'spark' ? rand(8, 20) : rand(2, 5),
        color: colors[Math.floor(Math.random() * colors.length)],
        drag: 4,
        grav: 600,
      });
    }
  }

  dust(x, y, count, amount = 1) {
    const n = Math.round(count * amount);
    for (let i = 0; i < n; i++) {
      this.addParticle({
        type: 'smoke', x: x + rand(-20, 20), y: y - rand(0, 6),
        vx: rand(-90, 90), vy: rand(-50, -10),
        life: rand(0.35, 0.7), size: rand(6, 14), color: 'rgba(190,170,210,1)', drag: 3, grav: 0,
      });
    }
  }

  // -------------------------------------------------------------------
  // Hauptfunktion: ein Bild zeichnen
  // -------------------------------------------------------------------
  draw(state, view) {
    const ctx = this.ctx;
    const dt = Math.min(0.05, (view.dt || 16) / 1000);
    this.time += dt;
    this.localPlayer = view.localPlayer;
    if (state) this.palettes = [this.paletteFor(state, 0), this.paletteFor(state, 1)];
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.crowdHype = Math.max(0, this.crowdHype - dt * 1.2);

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const fighters = state ? state.fighters : null;
    const midX = fighters ? (fighters[0].x + fighters[1].x) / 2 / SUB : VIEW_W / 2;
    const cam = midX - VIEW_W / 2;

    // Bildschirmwackeln (nur die Spielwelt, nicht das HUD)
    const sx = this.shake > 0.3 ? rand(-this.shake, this.shake) : 0;
    const sy = this.shake > 0.3 ? rand(-this.shake, this.shake) * 0.6 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    this.drawBackground(cam);
    if (state) {
      this.drawShadows(state);
      // Wer angreift, wird vorne gezeichnet
      const order = fighters[1].state === 'attack' && fighters[0].state !== 'attack' ? [0, 1] : [1, 0];
      for (const i of order) this.drawFighter(state, i, dt);
      this.drawProjectiles(state, dt);
    }
    this.drawParticles();
    this.drawForeground(cam);
    if (state && this.showBoxes) this.drawBoxes(state);
    ctx.restore();

    ctx.drawImage(this.vignette, 0, 0);
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash * 1.4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    if (state && view.hud) {
      this.drawHud(state, view, dt);
      this.drawAnnouncements(state, view);
      if (view.controlsHint) this.drawControlsHint(view.controlsHint);
    }
    if (view.waiting) this.drawWaiting(view.waiting);
    if (view.banner) this.drawBanner(view.banner);
    if (state && this.showBoxes) this.drawDebugText(state);
  }

  // -------------------------------------------------------------------
  // Hintergrund
  // -------------------------------------------------------------------
  drawLayer(img, k, cam, y) {
    const x = (VIEW_W - img.width) / 2 - cam * k;
    this.ctx.drawImage(img, Math.round(x), y);
  }

  drawBackground(cam) {
    const ctx = this.ctx;
    ctx.drawImage(this.sky, 0, 0);
    this.drawLayer(this.far, 0.03, cam, HORIZON_Y - this.far.height + 8);
    this.drawLayer(this.mid, 0.06, cam, HORIZON_Y - this.mid.height + 4);
    // Neonschilder mit Flackern
    for (const s of this.signs) {
      const flick = Math.sin(this.time * (7 + s.seed * 3)) + Math.sin(this.time * (13 + s.seed)) > 1.75 ? 0.35 : 1;
      ctx.globalAlpha = flick;
      ctx.drawImage(s.img, Math.round(s.x - s.img.width / 2 - cam * s.k), s.y - s.img.height / 2);
    }
    ctx.globalAlpha = 1;
    this.drawLayer(this.street, 0.1, cam, HORIZON_Y - this.street.height + 6);

    // Straße mit Perspektive
    const floor = ctx.createLinearGradient(0, HORIZON_Y, 0, VIEW_H);
    floor.addColorStop(0, '#2a2036');
    floor.addColorStop(0.35, '#1d1528');
    floor.addColorStop(1, '#0e0a15');
    ctx.fillStyle = floor;
    ctx.fillRect(0, HORIZON_Y + 4, VIEW_W, VIEW_H - HORIZON_Y);
    // Gehweg
    ctx.fillStyle = '#3a3048';
    ctx.fillRect(0, HORIZON_Y + 4, VIEW_W, 10);
    ctx.fillStyle = '#4c405e';
    ctx.fillRect(0, HORIZON_Y + 4, VIEW_W, 2);
    // Fluchtlinien
    const vx = VIEW_W / 2 - cam * 0.16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HORIZON_Y + 14, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.strokeStyle = 'rgba(160,140,200,0.10)';
    ctx.lineWidth = 2;
    for (let i = -12; i <= 12; i++) {
      const bx = VIEW_W / 2 + i * 120 - cam * 0.5;
      ctx.beginPath();
      ctx.moveTo(vx + (bx - vx) * 0.45, HORIZON_Y + 14);
      ctx.lineTo(bx, VIEW_H);
      ctx.stroke();
    }
    // Querlinien (enger nach hinten)
    ctx.fillStyle = 'rgba(160,140,200,0.06)';
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      ctx.fillRect(0, HORIZON_Y + 14 + (VIEW_H - HORIZON_Y) * t * t, VIEW_W, 2);
    }
    // Spiegelungen der Neonschilder auf der nassen Straße
    ctx.globalCompositeOperation = 'lighter';
    const refl = [['rgba(255,61,139,0.10)', 180], ['rgba(61,242,255,0.08)', 650], ['rgba(125,255,107,0.06)', 860]];
    for (const [color, x] of refl) {
      const rx = x - cam * 0.25;
      const grad = ctx.createLinearGradient(0, HORIZON_Y + 14, 0, VIEW_H);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(rx - 40 + Math.sin(this.time * 2 + x) * 3, HORIZON_Y + 14, 80, VIEW_H - HORIZON_Y);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Straßenlaternen
    for (const lx of [90, 870]) {
      const side = lx < VIEW_W / 2 ? 1 : -1;
      const x = lx - cam * 0.12;
      ctx.fillStyle = '#120c1a';
      ctx.fillRect(x - 4, 250, 8, HORIZON_Y - 236);
      ctx.fillRect(side > 0 ? x - 4 : x - 30, 250, 34, 6);
      const hx = x + 30 * side;
      ctx.fillStyle = '#ffe2a8';
      ctx.fillRect(hx - 9, 256, 18, 6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 20 + lx) * 0.03;
      ctx.drawImage(this.glows[1], hx - 128, 260 - 128);
      // Lichtkegel
      const cone = ctx.createLinearGradient(0, 262, 0, FLOOR_Y + 20);
      cone.addColorStop(0, 'rgba(255,214,150,0.22)');
      cone.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(hx - 8, 262);
      ctx.lineTo(hx + 8, 262);
      ctx.lineTo(hx + 90, FLOOR_Y + 20);
      ctx.lineTo(hx - 90, FLOOR_Y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  drawForeground(cam) {
    const hype = Math.min(1, this.crowdHype);
    const bob = Math.abs(Math.sin(this.time * 9)) * 8 * hype;
    const x = (VIEW_W - this.crowd.width) / 2 + cam * 0.2;
    this.ctx.drawImage(this.crowd, Math.round(x), VIEW_H - this.crowd.height + 34 - bob);
  }

  drawShadows(state) {
    const ctx = this.ctx;
    for (const f of state.fighters) {
      const h = f.y / SUB;
      const s = clamp(1 - h / 260, 0.35, 1);
      const lying = f.state === 'ko' || (f.state === 'knockdown' && f.y === 0);
      ctx.fillStyle = `rgba(0,0,0,${0.45 * s})`;
      ctx.beginPath();
      ctx.ellipse(f.x / SUB - (lying ? f.facing * 30 : 0), FLOOR_Y + 3, (lying ? 62 : 36) * s, 8 * s, 0, 0, TAU);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------
  // Kämpfer
  // -------------------------------------------------------------------
  /** Farben eines Kämpfers. Gleicher Charakter auf beiden Seiten → Spieler 2 in Farbe 2. */
  paletteFor(state, i) {
    const f = state.fighters[i];
    const def = CHARACTERS[f.char] || CHARACTERS[DEFAULT_CHAR];
    const mirror = state.fighters[0].char === state.fighters[1].char;
    return def.look.palettes[mirror && i === 1 ? 1 : 0];
  }

  /** Leucht-Sprite in einer Farbe (wird einmal erzeugt und gemerkt) */
  glowSprite(color) {
    if (!this.glowCache.has(color)) this.glowCache.set(color, buildGlow(...hexToRgb(color), 1, 128));
    return this.glowCache.get(color);
  }

  drawFighter(state, i, dt) {
    const f = state.fighters[i];
    const fx = this.fx[i];
    const cd = charData(f);
    const look = (CHARACTERS[f.char] || CHARACTERS[DEFAULT_CHAR]).look;
    const pal = this.paletteFor(state, i);
    fx.flash = Math.max(0, fx.flash - dt);

    // Pose bestimmen und weich überblenden
    const { pose: target, snap } = poseFor(f, this.time + i * 0.7);
    if (!fx.pose || snap) fx.pose = target;
    else fx.pose = blend(fx.pose, target, 1 - Math.exp(-dt * 22));
    const j = solvePose(fx.pose);

    // Position auf dem Bildschirm (Körpergröße des Charakters eingerechnet)
    const size = cd.size;
    let ox = f.x / SUB;
    const oy = FLOOR_Y - f.y / SUB;
    if (state.hitstop > 0 && fx.flash > 0) ox += Math.floor(this.time * 60) % 2 ? 2.5 : -2.5;
    // Füße auf den Boden setzen, wenn der Kämpfer steht
    let lift = 0;
    const grounded = f.y === 0 && f.vy === 0 && f.state !== 'knockdown' && f.state !== 'ko' && f.state !== 'getup';
    if (grounded) lift = -Math.min(j.footF[1], j.footB[1]);
    const dir = f.facing;
    const P = (pt) => [ox + dir * pt[0] * size, oy - (pt[1] + lift) * size];

    // Linienstärken je Körperbau
    const k = {
      limb: size * (look.build === 'heavy' ? 1.25 : look.build === 'slim' ? 0.85 : 1),
      body: size * (look.build === 'heavy' ? 1.3 : look.build === 'slim' ? 0.85 : 1),
      head: size * (look.build === 'heavy' ? 1.05 : 1),
      size,
    };

    const white = fx.flash > 0.05;
    const C = white
      ? { gi: '#ffffff', giDark: '#f2f2f2', pants: '#ffffff', skin: '#ffffff', skinDark: '#eeeeee', band: '#ffffff', belt: '#ffffff', hair: '#ffffff' }
      : { ...pal, pants: pal.pants || pal.gi, skinDark: shade(pal.skin, 0.78) };
    const pantsBack = white ? '#f2f2f2' : shade(C.pants, 0.62);

    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Leuchtspur der zuschlagenden Faust / des Fußes
    const m = f.state === 'attack' && f.move ? cd.moves[f.move] : null;
    if (m && !m.projectile && !white && f.moveFrame >= m.startup - 1) {
      fx.trail.push({ p: P(KICKS.includes(f.move) ? j.footF : j.handF), t: this.time });
    }
    fx.trail = fx.trail.filter((t) => this.time - t.t < 0.1);
    if (fx.trail.length > 1) {
      ctx.globalCompositeOperation = 'lighter';
      for (let n = 1; n < fx.trail.length; n++) {
        const a = fx.trail[n - 1];
        const b = fx.trail[n];
        const age = (this.time - b.t) / 0.1;
        this.stroke2(a.p, b.p, 14 * size * (1 - age), `rgba(255,255,255,${0.35 * (1 - age)})`);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Schal (Wiesel) weht hinter dem Körper
    if (look.head === 'scarf') this.drawScarfTail(P, j, C, dir, f, i, k);

    // Reihenfolge: hinterer Arm, hinteres Bein, Körper, Kopf, vorderes Bein, vorderer Arm
    const armOpts = { sleeveless: look.torso === 'vest', wraps: look.torso === 'vest' };
    this.drawArm(P, j.shoulder, j.elbowB, j.handB, C.giDark, C.skinDark, k, { ...armOpts, wrapColor: shade(C.band, 0.75) });
    this.drawLeg(P, j.hip, j.kneeB, j.footB, j.footAngleB, pantsBack, C.skinDark, dir, k);
    this.drawTorso(P, j, C, dir, k, look.torso);
    this.drawHead(P, j, C, dir, f, i, k, look.head);
    this.drawLeg(P, j.hip, j.kneeF, j.footF, j.footAngleF, C.pants, C.skin, dir, k);
    this.drawArm(P, j.shoulder, j.elbowF, j.handF, C.gi, C.skin, k, { ...armOpts, wrapColor: C.band });

    // Aufladen des Energieballs in der Wurfhand
    if (m && m.projectile === 'ball' && f.moveFrame < m.startup) {
      const hand = P(j.handF);
      const t = f.moveFrame / m.startup;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + t * 0.6;
      const s = 30 + t * 50;
      ctx.drawImage(this.glowSprite(pal.glow), hand[0] - s / 2, hand[1] - s / 2, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Erdstoß: Fuß glüht kurz vor dem Aufstampfen
    if (m && m.projectile === 'wave' && f.moveFrame < m.startup && f.moveFrame > m.startup - 8) {
      const foot = P(j.footF);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.glowSprite(pal.glow), foot[0] - 30, foot[1] - 30, 60, 60);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // "DU"-Markierung (online)
    if (this.localPlayer === i && state.phase !== 'matchEnd') {
      const head = P(j.head);
      const y = Math.min(head[1] - 34 * size, oy - 200 * size);
      ctx.fillStyle = LOOK.PLAYERS[i].color;
      ctx.beginPath();
      ctx.moveTo(head[0] - 7, y);
      ctx.lineTo(head[0] + 7, y);
      ctx.lineTo(head[0], y + 9);
      ctx.closePath();
      ctx.fill();
      this.text('DU', head[0], y - 9, 15, { fill: '#fff', stroke: OUTLINE, line: 4 });
    }
  }

  stroke2(a, b, w, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  drawArm(P, shoulder, elbow, hand, sleeve, skin, k, opts = {}) {
    const s = P(shoulder);
    const e = P(elbow);
    const h = P(hand);
    const ctx = this.ctx;
    const w = k.limb;
    this.stroke2(s, e, 17 * w, OUTLINE);
    this.stroke2(e, h, 14 * w, OUTLINE);
    this.stroke2(s, e, 12 * w, opts.sleeveless ? skin : sleeve);
    this.stroke2(e, h, 9 * w, skin);
    if (opts.sleeveless) {
      // Westen-Schulter
      this.stroke2(s, [s[0] + (e[0] - s[0]) * 0.22, s[1] + (e[1] - s[1]) * 0.22], 13 * w, sleeve);
    } else {
      // Ärmelende
      this.stroke2(e, [e[0] + (h[0] - e[0]) * 0.18, e[1] + (h[1] - e[1]) * 0.18], 12 * w, sleeve);
    }
    if (opts.wraps) {
      // Bandagen am Handgelenk
      const a = [e[0] + (h[0] - e[0]) * 0.55, e[1] + (h[1] - e[1]) * 0.55];
      this.stroke2(a, [e[0] + (h[0] - e[0]) * 0.85, e[1] + (h[1] - e[1]) * 0.85], 10 * w, opts.wrapColor);
    }
    // Faust
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(h[0], h[1], 8.5 * w, 0, TAU);
    ctx.fill();
    ctx.fillStyle = opts.wraps ? opts.wrapColor : skin;
    ctx.beginPath();
    ctx.arc(h[0], h[1], 6 * w, 0, TAU);
    ctx.fill();
  }

  drawLeg(P, hip, knee, foot, footAngle, pants, skin, dir, k) {
    const hp = P(hip);
    const kn = P(knee);
    const f = P(foot);
    const w = k.limb;
    this.stroke2(hp, kn, 21 * w, OUTLINE);
    this.stroke2(kn, f, 18 * w, OUTLINE);
    this.stroke2(hp, kn, 16 * w, pants);
    this.stroke2(kn, f, 13 * w, pants);
    // Fuß (zeigt nach vorne)
    const a = ((footAngle + 90) * Math.PI) / 180;
    const len = 13 * k.size;
    const tip = [f[0] + dir * Math.sin(a) * len, f[1] + Math.cos(a) * len];
    this.stroke2(f, tip, 11 * w, OUTLINE);
    this.stroke2(f, tip, 7 * w, skin);
  }

  drawTorso(P, j, C, dir, k, type) {
    const ctx = this.ctx;
    const hip = P(j.hip);
    const top = P(j.neck);
    const ang = Math.atan2(top[1] - hip[1], top[0] - hip[0]);
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    const along = (t) => [hip[0] + (top[0] - hip[0]) * t, hip[1] + (top[1] - hip[1]) * t];
    const b = k.body;
    const quad = (wHip, wTop, t0, t1) => {
      const a = along(t0);
      const c = along(t1);
      ctx.beginPath();
      ctx.moveTo(a[0] + nx * wHip, a[1] + ny * wHip);
      ctx.lineTo(a[0] - nx * wHip, a[1] - ny * wHip);
      ctx.lineTo(c[0] - nx * wTop, c[1] - ny * wTop);
      ctx.lineTo(c[0] + nx * wTop, c[1] + ny * wTop);
      ctx.closePath();
    };
    ctx.fillStyle = OUTLINE;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5 * k.size;
    quad(17 * b, 22 * b, -0.05, 1.02);
    ctx.fill();
    ctx.stroke();

    if (type === 'vest') {
      // Fels: offene Weste über nackter Brust, breiter Gürtel
      ctx.fillStyle = C.skin;
      quad(14 * b, 19 * b, -0.02, 0.98);
      ctx.fill();
      ctx.fillStyle = C.gi;
      for (const side of [1, -1]) {
        const a = along(-0.02);
        const c = along(0.98);
        ctx.beginPath();
        ctx.moveTo(a[0] + nx * 14 * b * side, a[1] + ny * 14 * b * side);
        ctx.lineTo(a[0] + nx * 5 * b * side, a[1] + ny * 5 * b * side);
        ctx.lineTo(c[0] + nx * 8 * b * side, c[1] + ny * 8 * b * side);
        ctx.lineTo(c[0] + nx * 19 * b * side, c[1] + ny * 19 * b * side);
        ctx.closePath();
        ctx.fill();
      }
      const belt = along(0.08);
      this.stroke2([belt[0] + nx * 16 * b, belt[1] + ny * 16 * b], [belt[0] - nx * 16 * b, belt[1] - ny * 16 * b], 10 * k.size, C.belt);
      ctx.fillStyle = C.band;
      ctx.fillRect(belt[0] - 4 * k.size, belt[1] - 4 * k.size, 8 * k.size, 8 * k.size); // Gürtelschnalle
      return;
    }

    ctx.fillStyle = C.gi;
    quad(14 * b, 19 * b, -0.02, 0.98);
    ctx.fill();

    if (type === 'jacket') {
      // Wiesel: Jacke mit Reißverschluss und Bund
      const z0 = along(0.05);
      const z1 = along(0.92);
      this.stroke2(z0, z1, 2 * k.size, 'rgba(255,255,255,0.55)');
      const hem = along(0.06);
      this.stroke2([hem[0] + nx * 14 * b, hem[1] + ny * 14 * b], [hem[0] - nx * 14 * b, hem[1] - ny * 14 * b], 5 * k.size, C.giDark);
      return;
    }

    // Funke: Kampfanzug mit Ausschnitt und Gürtel
    const neckIn = along(0.94);
    const vTip = along(0.55);
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.moveTo(neckIn[0] + nx * 9 * b, neckIn[1] + ny * 9 * b);
    ctx.lineTo(neckIn[0] - nx * 9 * b, neckIn[1] - ny * 9 * b);
    ctx.lineTo(vTip[0], vTip[1]);
    ctx.closePath();
    ctx.fill();
    const lap = along(0.1);
    this.stroke2(vTip, [lap[0] - nx * 6 * dir, lap[1] - ny * 6 * dir], 2, 'rgba(0,0,0,0.25)');
    const b1 = along(0.1);
    this.stroke2([b1[0] + nx * 15 * b, b1[1] + ny * 15 * b], [b1[0] - nx * 15 * b, b1[1] - ny * 15 * b], 7 * k.size, C.belt);
    const knot = [b1[0] - dir * 3, b1[1]];
    this.stroke2(knot, [knot[0] - dir * 6, knot[1] + 12 * k.size], 4 * k.size, C.belt);
    this.stroke2(knot, [knot[0] + dir * 3, knot[1] + 13 * k.size], 4 * k.size, C.belt);
  }

  drawHead(P, j, C, dir, f, i, k, type) {
    const ctx = this.ctx;
    const h = P(j.head);
    const n = P(j.neck);
    const w = k.head;
    this.stroke2(n, h, 13 * w, OUTLINE);
    this.stroke2(n, h, 8 * w, C.skin);
    const r = 15 * w;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(h[0], h[1], r + 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.arc(h[0], h[1], r, 0, TAU);
    ctx.fill();

    // Kopf-Richtungen: "oben" und "vorne" unter Berücksichtigung der Neigung
    const a = (j.headAngle * Math.PI) / 180;
    const up = [Math.sin(a) * dir, -Math.cos(a)];
    const fwd = [Math.cos(a) * dir, Math.sin(a)];
    const base = Math.atan2(up[1], up[0]);
    const at = (fu, ff) => [h[0] + up[0] * fu + fwd[0] * ff, h[1] + up[1] * fu + fwd[1] * ff];

    if (type === 'bald') {
      // Fels: Glatze, kräftiger Bart, buschige Augenbraue
      // Bart: vorne unten am Kinn bis zum Ohr
      ctx.fillStyle = C.hair;
      ctx.beginPath();
      ctx.arc(h[0], h[1], r + 1.5, base + Math.PI * 0.42 * dir, base + Math.PI * 0.98 * dir, dir < 0);
      const ear = at(-r * 0.15, -r * 0.2);
      ctx.lineTo(ear[0], ear[1]);
      const mouth = at(-r * 0.25, r * 0.75);
      ctx.lineTo(mouth[0], mouth[1]);
      ctx.closePath();
      ctx.fill();
      // Glanzpunkt auf der Glatze
      const shine = at(r * 0.55, -r * 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(shine[0], shine[1], 3 * w, 0, TAU);
      ctx.fill();
      const brow = at(r * 0.28, r * 0.5);
      this.stroke2([brow[0] - fwd[0] * 4, brow[1] - fwd[1] * 4], [brow[0] + fwd[0] * 5, brow[1] + fwd[1] * 5], 3.5 * w, C.hair);
    } else if (type === 'scarf') {
      // Wiesel: Stachelhaare
      ctx.fillStyle = C.hair;
      ctx.beginPath();
      ctx.arc(h[0], h[1], r + 1.5, base + 0.35 * dir, base - 1.8 * dir, dir > 0);
      ctx.closePath();
      ctx.fill();
      for (const [ang, len] of [[-0.2, 1.75], [-0.75, 1.65], [-1.3, 1.55], [0.3, 1.5]]) {
        const d1 = base - ang * dir;
        const tip = [h[0] + Math.cos(d1 - 0.35 * dir) * r * len, h[1] + Math.sin(d1 - 0.35 * dir) * r * len];
        ctx.beginPath();
        ctx.moveTo(h[0] + Math.cos(d1 - 0.3) * r * 0.9, h[1] + Math.sin(d1 - 0.3) * r * 0.9);
        ctx.lineTo(tip[0], tip[1]);
        ctx.lineTo(h[0] + Math.cos(d1 + 0.3) * r * 0.9, h[1] + Math.sin(d1 + 0.3) * r * 0.9);
        ctx.closePath();
        ctx.fill();
      }
      // Schal um den Hals
      this.stroke2([n[0] - fwd[0] * 8 * w, n[1] - fwd[1] * 8 * w + 2], [n[0] + fwd[0] * 9 * w, n[1] + fwd[1] * 9 * w + 2], 9 * w, OUTLINE);
      this.stroke2([n[0] - fwd[0] * 7 * w, n[1] - fwd[1] * 7 * w + 2], [n[0] + fwd[0] * 8 * w, n[1] + fwd[1] * 8 * w + 2], 6 * w, C.band);
    } else {
      // Funke: Haare und Stirnband mit wehenden Bändern
      ctx.fillStyle = C.hair;
      ctx.beginPath();
      ctx.arc(h[0], h[1], r + 1.5, base + 0.45 * dir, base - 1.7 * dir, dir > 0);
      ctx.lineTo(h[0] - fwd[0] * 4 + up[0] * 2, h[1] - fwd[1] * 4 + up[1] * 2);
      ctx.closePath();
      ctx.fill();
      const bc = at(5 * w, 0);
      this.stroke2([bc[0] - fwd[0] * r, bc[1] - fwd[1] * r], [bc[0] + fwd[0] * r, bc[1] + fwd[1] * r], 6 * w, C.band);
      const knot = [bc[0] - fwd[0] * 14 * w, bc[1] - fwd[1] * 14 * w];
      const wave = Math.sin(this.time * 12 + i * 2) * 5;
      const lag = clamp(Math.abs(f.vx) / SUB, 0, 6);
      ctx.strokeStyle = C.band;
      ctx.lineWidth = 4 * w;
      for (const off of [0, 7]) {
        ctx.beginPath();
        ctx.moveTo(knot[0], knot[1]);
        ctx.quadraticCurveTo(
          knot[0] - dir * (14 + lag), knot[1] + 3 + wave * 0.5 + off * 0.5,
          knot[0] - dir * (28 + lag * 2), knot[1] + 6 + wave + off,
        );
        ctx.stroke();
      }
    }
    // Auge
    const eye = at(-1, 8 * w);
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(eye[0], eye[1], 2.4 * w, 3 * w, 0, 0, TAU);
    ctx.fill();
  }

  // Wiesels langes Schal-Ende, weht im Wind hinter dem Körper
  drawScarfTail(P, j, C, dir, f, i, k) {
    const ctx = this.ctx;
    const n = P(j.neck);
    const speed = clamp(Math.abs(f.vx) / SUB, 0, 8);
    const wave = Math.sin(this.time * 10 + i) * 6;
    const len = (38 + speed * 4) * k.size;
    const end = [n[0] - dir * len, n[1] + 10 + wave];
    const mid = [n[0] - dir * len * 0.5, n[1] - 4 + wave * 0.4];
    for (const [w, color] of [[9 * k.size, OUTLINE], [6 * k.size, C.band]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(n[0], n[1] + 2);
      ctx.quadraticCurveTo(mid[0], mid[1], end[0], end[1]);
      ctx.stroke();
    }
  }

  drawProjectiles(state, dt) {
    const ctx = this.ctx;
    for (const p of state.projectiles) {
      const glow = this.paletteFor(state, p.owner).glow;
      const x = p.x / SUB;
      const dirX = Math.sign(p.vx);
      if (p.kind === 'wave') {
        this.drawWave(p, x, dirX, glow, dt);
        continue;
      }
      const y = FLOOR_Y - (p.y + p.h / 2) / SUB;
      // Schweif
      if (Math.random() < dt * 60) {
        this.addParticle({
          type: 'dot', x: x - dirX * 14 + rand(-6, 6), y: y + rand(-10, 10),
          vx: -dirX * rand(40, 120), vy: rand(-30, 30), life: rand(0.2, 0.4), size: rand(3, 7),
          color: glow, drag: 2, grav: 0,
        });
      }
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 1 + Math.sin(this.time * 30) * 0.08;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.glowSprite(glow), x - 64 * pulse, y - 64 * pulse, 128 * pulse, 128 * pulse);
      ctx.globalAlpha = 1;
      ctx.drawImage(this.glows[0], x - 22, y - 22, 44, 44);
      ctx.globalCompositeOperation = 'source-over';
      // Energie-Ringe
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      for (let n = 0; n < 2; n++) {
        ctx.beginPath();
        ctx.ellipse(x, y, 20, 9, this.time * 8 * (n ? -1 : 1) + n, 0, TAU);
        ctx.stroke();
      }
    }
  }

  // Fels' Druckwelle: Gesteinsspitzen und Staub über den Boden
  drawWave(p, x, dirX, glow, dt) {
    const ctx = this.ctx;
    const w = p.w / SUB;
    const ground = FLOOR_Y + 2;
    // Staub hinter der Welle
    if (Math.random() < dt * 90) {
      this.addParticle({
        type: 'smoke', x: x - dirX * w * 0.4 + rand(-8, 8), y: ground - rand(0, 8),
        vx: -dirX * rand(20, 80), vy: rand(-60, -20), life: rand(0.3, 0.6), size: rand(6, 12),
        color: 'rgba(200,180,150,1)', drag: 3, grav: 0,
      });
    }
    // Leuchten am Boden
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(this.glowSprite(glow), x - w * 0.9, ground - 34, w * 1.8, 60);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Gesteinsspitzen (vorne höher)
    for (let n = 0; n < 5; n++) {
      const t = n / 4;
      const sx = x - dirX * w * 0.5 + dirX * w * t;
      const hgt = (10 + 22 * t) * (0.8 + 0.25 * Math.sin(this.time * 25 + n * 1.7));
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.moveTo(sx - 9, ground);
      ctx.lineTo(sx + dirX * 2, ground - hgt - 3);
      ctx.lineTo(sx + 9, ground);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = n % 2 ? '#8a7a68' : '#a8957d';
      ctx.beginPath();
      ctx.moveTo(sx - 6, ground);
      ctx.lineTo(sx + dirX * 2, ground - hgt);
      ctx.lineTo(sx + 6, ground);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------
  // Partikel
  // -------------------------------------------------------------------
  updateParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      if (p.vx !== undefined) {
        const drag = Math.exp(-(p.drag || 0) * dt);
        p.vx *= drag;
        p.vy = p.vy * drag + (p.grav || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const t = p.age / p.life;
      const a = 1 - t;
      ctx.globalCompositeOperation = p.type === 'smoke' ? 'source-over' : 'lighter';
      switch (p.type) {
        case 'spark': {
          const len = p.size * a;
          const sp = Math.hypot(p.vx, p.vy) || 1;
          ctx.globalAlpha = a;
          this.stroke2([p.x, p.y], [p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len], 3 * a + 1, p.color);
          break;
        }
        case 'dot':
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU);
          ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = a * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + t * 1.5), 0, TAU);
          ctx.fill();
          break;
        case 'ring':
          ctx.globalAlpha = a * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * a + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.3 + t * 0.7), 0, TAU);
          ctx.stroke();
          break;
        case 'star': {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          const s = p.size * (0.6 + t * 0.6);
          ctx.beginPath();
          for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * TAU + p.x;
            const rr = k % 2 ? s * 0.22 : s * (k % 4 === 0 ? 1 : 0.5);
            ctx.lineTo(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'shield': {
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 5 * a + 1;
          const s = p.size * (0.8 + t * 0.5);
          ctx.beginPath();
          for (let k = 0; k <= 6; k++) {
            const ang = (k / 6) * TAU + Math.PI / 6;
            ctx.lineTo(p.x + Math.cos(ang) * s, p.y + Math.sin(ang) * s);
          }
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // -------------------------------------------------------------------
  // HUD: Lebensbalken, Timer, Rundenpunkte, Cooldown, Combos
  // -------------------------------------------------------------------
  text(str, x, y, size, opt = {}) {
    const ctx = this.ctx;
    ctx.font = `italic 900 ${size}px ${FONT}`;
    ctx.textAlign = opt.align || 'center';
    ctx.textBaseline = 'middle';
    if (opt.stroke) {
      ctx.lineWidth = opt.line || size * 0.16;
      ctx.strokeStyle = opt.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opt.fill || '#fff';
    ctx.fillText(str, x, y);
  }

  drawHud(state, view, dt) {
    const ctx = this.ctx;
    const barW = 380;
    const barH = 24;
    const top = 18;
    for (let i = 0; i < 2; i++) {
      const f = state.fighters[i];
      const fx = this.fx[i];
      const player = LOOK.PLAYERS[i];
      const pal = this.paletteFor(state, i);
      const cd = charData(f);
      const maxHp = cd.maxHp;
      // Nachlauf des Lebensbalkens
      if (f.hp < fx.hpShown) fx.lagDelay = 0.45;
      fx.hpShown = f.hp;
      if (fx.lagDelay > 0) fx.lagDelay -= dt;
      else fx.hpLag = Math.max(f.hp, fx.hpLag - dt * 40);
      if (fx.hpLag < f.hp) fx.hpLag = f.hp;
      if (fx.hpLag > maxHp) fx.hpLag = maxHp;

      const x0 = i === 0 ? 24 : VIEW_W - 24 - barW;
      const skew = 12;
      // Balkenform (schräg), füllt sich von der Mitte nach außen
      const shape = (w) => {
        ctx.beginPath();
        if (i === 0) {
          const r = x0 + barW;
          const l = r - w;
          ctx.moveTo(l + skew, top);
          ctx.lineTo(r, top);
          ctx.lineTo(r - skew, top + barH);
          ctx.lineTo(l, top + barH);
        } else {
          const l = x0;
          const r = l + w;
          ctx.moveTo(l, top);
          ctx.lineTo(r - skew, top);
          ctx.lineTo(r, top + barH);
          ctx.lineTo(l + skew, top + barH);
        }
        ctx.closePath();
      };
      ctx.fillStyle = '#3a0d14';
      shape(barW);
      ctx.fill();
      ctx.fillStyle = '#ff3b3b';
      shape((barW * fx.hpLag) / maxHp);
      ctx.fill();
      const low = f.hp <= maxHp * 0.25;
      const g = ctx.createLinearGradient(0, top, 0, top + barH);
      if (low && Math.floor(this.time * 6) % 2) {
        g.addColorStop(0, '#ffb0b0');
        g.addColorStop(1, '#ff4040');
      } else {
        g.addColorStop(0, '#fff3a0');
        g.addColorStop(0.5, '#ffd23b');
        g.addColorStop(1, '#f08a12');
      }
      ctx.fillStyle = g;
      shape((barW * Math.max(0, f.hp)) / maxHp);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      shape(barW);
      ctx.stroke();

      // Name
      const who = view.localPlayer === i ? 'DU' : view.localPlayer >= 0 ? 'GEGNER' : `P${i + 1}`;
      const name = `${who} · ${(CHARACTERS[f.char] || CHARACTERS[DEFAULT_CHAR]).name}`;
      this.text(name, i === 0 ? x0 + 4 : x0 + barW - 4, top + barH + 14, 15, { align: i === 0 ? 'left' : 'right', fill: player.color, stroke: OUTLINE, line: 4 });

      // Special-Cooldown
      const ready = 1 - f.cooldown / (cd.moves[cd.special].cooldown || 1);
      const cw = 120;
      const cx = i === 0 ? x0 + 110 : x0 + barW - 110 - cw;
      const cy = top + barH + 9;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx, cy, cw, 8);
      ctx.fillStyle = ready >= 1 ? pal.glow : 'rgba(180,180,220,0.6)';
      const fillW = cw * ready;
      ctx.fillRect(i === 0 ? cx : cx + cw - fillW, cy, fillW, 8);
      if (ready >= 1) {
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.3;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 1, cy - 1, cw + 2, 10);
        ctx.globalAlpha = 1;
      }
      this.text('★', i === 0 ? cx + cw + 12 : cx - 12, cy + 4, 13, { fill: ready >= 1 ? '#ffd23b' : '#777' });

      // Rundenpunkte
      for (let k = 0; k < ROUND.ROUNDS_TO_WIN; k++) {
        const px = i === 0 ? x0 + barW - 14 - k * 22 : x0 + 14 + k * 22;
        const py = top + barH + 16;
        ctx.fillStyle = OUTLINE;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, TAU);
        ctx.fill();
        if (state.wins[i] > k) {
          ctx.fillStyle = '#ffd23b';
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, TAU);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Combo-Anzeige
      const c = this.combo[i];
      const age = this.time - c.t;
      if (c.count >= 2 && age < 1.3) {
        ctx.globalAlpha = age < 1 ? 1 : 1 - (age - 1) / 0.3;
        const pop = age < 0.08 ? 1.3 - age * 3.75 : 1;
        ctx.save();
        ctx.translate(i === 0 ? 70 : VIEW_W - 70, 150);
        ctx.scale(pop, pop);
        this.text(String(c.count), 0, 0, 48, { fill: '#ffd23b', stroke: OUTLINE, line: 7 });
        this.text('TREFFER', 0, 32, 16, { fill: '#fff', stroke: OUTLINE, line: 4 });
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // Timer
    ctx.fillStyle = 'rgba(10,6,20,0.8)';
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 34, 10);
    ctx.lineTo(VIEW_W / 2 + 34, 10);
    ctx.lineTo(VIEW_W / 2 + 28, 58);
    ctx.lineTo(VIEW_W / 2 - 28, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const secs = Math.ceil(state.timer / 60);
    const hurry = !state.training && secs <= 10 && state.phase === 'fight';
    this.text(state.training ? '∞' : String(secs), VIEW_W / 2, 35, 32, {
      fill: hurry && Math.floor(this.time * 4) % 2 ? '#ff4d6d' : '#fff',
      stroke: OUTLINE,
      line: 5,
    });

    // Online: Ping, Verzögerung, Wartezeit und Bilder pro Sekunde beider Geräte
    if (view.net) {
      const n = view.net;
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bad = n.ping > 150 || n.waitPercent > 5 || (n.remoteFps && n.remoteFps < 50) || n.fps < 50;
      const warn = n.ping > 80 || n.waitPercent > 1 || (n.remoteFps && n.remoteFps < 57) || n.fps < 57;
      ctx.fillStyle = n.ping < 0 ? '#ccc' : bad ? '#ff6b6b' : warn ? '#ffd23b' : '#7dff9b';
      const rec = n.recommended && n.recommended !== n.delay ? ` (empf. ${n.recommended})` : '';
      const fpsText = `FPS ${Math.round(n.fps)}/${n.remoteFps ? Math.round(n.remoteFps) : '–'}`;
      ctx.fillText(
        `Ping ${n.ping >= 0 ? Math.round(n.ping) + ' ms' : '–'} · Verzögerung ${n.delay}${rec} · Warten ${Math.round(n.waitPercent)} % · ${fpsText}`,
        VIEW_W / 2, 112,
      );
    }

    // Training: Infos
    if (state.training) {
      ctx.fillStyle = 'rgba(10,6,20,0.7)';
      ctx.fillRect(16, 92, 230, 64);
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('Dummy: ' + (view.dummyLabel || '–') + '  (T)', 26, 106);
      if (this.lastAdv) {
        const v = this.lastAdv.value;
        if (v === null || v === undefined) {
          ctx.fillStyle = '#b7aed6';
          ctx.fillText(`${this.lastAdv.kind}`, 26, 125);
        } else {
          ctx.fillStyle = v > 0 ? '#7dff9b' : v < 0 ? '#ff7a8a' : '#fff';
          ctx.fillText(`Frame-Vorteil (${this.lastAdv.kind}): ${v > 0 ? '+' : ''}${v}`, 26, 125);
        }
        if (this.lastAdv.dmg) {
          ctx.fillStyle = '#ffd23b';
          ctx.fillText(`Schaden: ${this.lastAdv.dmg}`, 26, 143);
        }
      } else {
        ctx.fillStyle = '#b7aed6';
        ctx.fillText('Greif den Dummy an!', 26, 125);
      }
    }
  }

  drawAnnouncements(state, view) {
    const ctx = this.ctx;
    const pf = state.phaseFrame;
    let txt = '';
    let color = '#ffd23b';
    let size = 72;
    let age = 0;
    let dur = 1;
    if (state.phase === 'intro') {
      const last = ROUND.ROUNDS_TO_WIN - 1;
      const finalRound = state.wins[0] === last && state.wins[1] === last && last > 0;
      txt = state.training ? 'TRAINING' : finalRound ? 'FINALE RUNDE' : `RUNDE ${state.round}`;
      age = pf;
      dur = ROUND.INTRO_FRAMES;
      color = '#fff';
      size = 64;
    } else if (state.phase === 'fight' && pf < 50) {
      txt = 'FIGHT!';
      age = pf;
      dur = 50;
      size = 96;
    } else if (state.phase === 'roundEnd') {
      if (pf < 100) {
        txt = state.endReason === 'time' ? 'ZEIT!' : state.endReason === 'double' ? 'DOPPEL-K.O.' : 'K.O.';
        color = state.endReason === 'time' ? '#fff' : '#ff3b3b';
        size = state.endReason === 'ko' ? 120 : 84;
        age = pf;
        dur = 100;
      } else {
        const w = state.roundWinner;
        if (w < 0) txt = 'UNENTSCHIEDEN';
        else if (view.localPlayer >= 0) txt = w === view.localPlayer ? 'RUNDE GEWONNEN!' : 'RUNDE VERLOREN';
        else txt = `${LOOK.PLAYERS[w].name} GEWINNT`;
        color = w < 0 ? '#fff' : LOOK.PLAYERS[w].color;
        size = 46;
        age = pf - 100;
        dur = ROUND.END_FRAMES - 100;
      }
    }
    if (txt !== this.annText) {
      // Neue Einblendung: Einflug-Animation nach echter Zeit (läuft auch im Hitstop)
      this.annText = txt;
      this.annStart = this.time;
    }
    if (!txt) return;
    const t = age / dur;
    const real = (this.time - this.annStart) * 60;
    const appear = Math.min(1, real / 8);
    const scale = real < 8 ? 1.8 - appear * 0.8 : 1 + Math.min(real - 8, 120) * 0.0015;
    ctx.save();
    ctx.globalAlpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : appear;
    ctx.translate(VIEW_W / 2, 230);
    ctx.scale(scale, scale);
    ctx.rotate(-0.04);
    this.text(txt, 4, 5, size, { fill: 'rgba(0,0,0,0.5)' });
    this.text(txt, 0, 0, size, { fill: color, stroke: OUTLINE, line: size * 0.14 });
    ctx.restore();
  }

  // Tastenbelegung klein und halbtransparent ganz unten (LOOK.SHOW_CONTROLS)
  drawControlsHint(lines) {
    const ctx = this.ctx;
    const y = VIEW_H - 11;
    ctx.save();
    ctx.font = '600 12px system-ui, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 3;
    if (lines.left) {
      ctx.textAlign = 'left';
      ctx.fillText(lines.left, 14, y);
    }
    if (lines.right) {
      ctx.textAlign = 'right';
      ctx.fillText(lines.right, VIEW_W - 14, y);
    }
    if (lines.center) {
      ctx.textAlign = 'center';
      ctx.fillText(lines.center, VIEW_W / 2, lines.left ? y - 16 : y);
    }
    ctx.restore();
  }

  drawWaiting(text) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5,3,12,0.55)';
    ctx.fillRect(0, 200, VIEW_W, 90);
    const dots = '.'.repeat(1 + (Math.floor(this.time * 3) % 3));
    this.text(text + dots, VIEW_W / 2, 245, 28, { fill: '#fff', stroke: OUTLINE, line: 5 });
  }

  drawBanner(text) {
    const ctx = this.ctx;
    const pulse = 0.85 + Math.sin(this.time * 10) * 0.15;
    ctx.fillStyle = `rgba(160,10,30,${0.85 * pulse})`;
    ctx.fillRect(0, 300, VIEW_W, 64);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 300, VIEW_W, 3);
    ctx.fillRect(0, 361, VIEW_W, 3);
    this.text(text, VIEW_W / 2, 333, 30, { fill: '#fff', stroke: OUTLINE, line: 5 });
  }

  // -------------------------------------------------------------------
  // Debug: Boxen anzeigen (F1 / ?debug)
  // -------------------------------------------------------------------
  drawBoxes(state) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    for (const f of state.fighters) {
      ctx.strokeStyle = 'rgba(255,230,0,0.9)';
      this.strokeWorldBox(pushboxWorld(f));
      ctx.strokeStyle = 'rgba(60,255,120,0.95)';
      ctx.fillStyle = 'rgba(60,255,120,0.12)';
      for (const b of hurtboxesOf(f)) this.strokeWorldBox(b, true);
      const hb = hitboxOf(f);
      ctx.strokeStyle = 'rgba(255,40,60,1)';
      ctx.fillStyle = 'rgba(255,40,60,0.3)';
      if (hb) this.strokeWorldBox(hb, true);
      ctx.fillStyle = '#fff';
      ctx.fillRect(f.x / SUB - 1, FLOOR_Y - f.y / SUB - 6, 2, 12);
    }
    ctx.strokeStyle = 'rgba(255,40,60,1)';
    ctx.fillStyle = 'rgba(255,40,60,0.3)';
    for (const p of state.projectiles) this.strokeWorldBox(projectileBox(p), true);
  }

  strokeWorldBox(b, fill) {
    const l = b.l / SUB;
    const r = b.r / SUB;
    const y = FLOOR_Y - b.t / SUB;
    const h = (b.t - b.b) / SUB;
    if (fill) this.ctx.fillRect(l, y, r - l, h);
    this.ctx.strokeRect(l, y, r - l, h);
  }

  drawDebugText(state) {
    const ctx = this.ctx;
    ctx.font = '600 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(VIEW_W - 330, 92, 320, 34);
    ctx.fillStyle = '#7dff9b';
    const [a, b] = state.fighters;
    const desc = (f) => `${f.state}${f.move ? ':' + f.move + '@' + f.moveFrame : ''}`;
    ctx.fillText(`Frame ${state.frame}  ${state.phase}  Hitstop ${state.hitstop}`, VIEW_W - 322, 102);
    ctx.fillText(`P1 ${desc(a)}   P2 ${desc(b)}`, VIEW_W - 322, 117);
  }
}
