// =====================================================================
// render.js – zeichnet den Spielzustand (einfache Version, Phase 1)
// =====================================================================

import { SUB, hurtboxesOf, pushboxWorld, hitboxOf, projectileBox } from './sim.js';
import { FIGHTER, LOOK } from './config.js';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const FLOOR_Y = 470;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.showBoxes = false;
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.scale = this.canvas.width / VIEW_W;
  }

  onEvent() {}

  draw(state, view) {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#1b1036');
    sky.addColorStop(1, '#5a2a52');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, FLOOR_Y);
    ctx.fillStyle = '#231b2e';
    ctx.fillRect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y);

    if (!state) return;
    state.fighters.forEach((f, i) => this.drawFighter(f, i));
    for (const p of state.projectiles) {
      ctx.fillStyle = p.owner === 0 ? '#5fb4ff' : '#ff9a3c';
      ctx.beginPath();
      ctx.arc(p.x / SUB, FLOOR_Y - (p.y + p.h / 2) / SUB, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.showBoxes) this.drawBoxes(state);
    if (view.hud) this.drawHud(state);
  }

  drawFighter(f, i) {
    const ctx = this.ctx;
    const look = LOOK.PLAYERS[i];
    const x = f.x / SUB;
    const y = FLOOR_Y - f.y / SUB;
    const h = f.crouching ? 105 : 160;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 4, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.gi;
    ctx.fillRect(x - 24, y - h + 30, 48, h - 30);
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(x + f.facing * 6, y - h + 16, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.band;
    ctx.fillRect(x - 17 + f.facing * 6, y - h + 6, 34, 6);
    const hb = hitboxOf(f);
    if (hb) {
      ctx.fillStyle = look.skin;
      ctx.fillRect(Math.min(x, hb.l / SUB), FLOOR_Y - hb.t / SUB, Math.abs((f.facing > 0 ? hb.r : hb.l) / SUB - x), (hb.t - hb.b) / SUB);
    }
  }

  drawBoxes(state) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    for (const f of state.fighters) {
      ctx.strokeStyle = 'rgba(255,230,0,0.9)';
      this.strokeWorldBox(pushboxWorld(f));
      ctx.strokeStyle = 'rgba(60,255,120,0.95)';
      for (const b of hurtboxesOf(f)) this.strokeWorldBox(b);
      const hb = hitboxOf(f);
      ctx.strokeStyle = 'rgba(255,40,60,1)';
      if (hb) this.strokeWorldBox(hb);
    }
    for (const p of state.projectiles) this.strokeWorldBox(projectileBox(p));
  }

  strokeWorldBox(b) {
    const l = b.l / SUB;
    const r = b.r / SUB;
    this.ctx.strokeRect(l, FLOOR_Y - b.t / SUB, r - l, (b.t - b.b) / SUB);
  }

  drawHud(state) {
    const ctx = this.ctx;
    for (let i = 0; i < 2; i++) {
      const f = state.fighters[i];
      const w = 380;
      const x = i === 0 ? 30 : VIEW_W - 30 - w;
      ctx.fillStyle = '#300';
      ctx.fillRect(x, 20, w, 22);
      ctx.fillStyle = '#ffd23b';
      const fill = (w * Math.max(0, f.hp)) / FIGHTER.MAX_HP;
      ctx.fillRect(i === 0 ? x + w - fill : x, 20, fill, 22);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(state.timer / 60)), VIEW_W / 2, 50);
    if (state.phase === 'intro') ctx.fillText('RUNDE ' + state.round, VIEW_W / 2, 250);
    if (state.phase === 'fight' && state.phaseFrame < 45) ctx.fillText('FIGHT!', VIEW_W / 2, 250);
    if (state.phase === 'roundEnd') ctx.fillText(state.endReason === 'time' ? 'ZEIT!' : 'K.O.', VIEW_W / 2, 250);
  }
}
