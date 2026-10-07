// =====================================================================
// poses.js – Körperhaltungen der Kämpfer (nur für die Grafik)
// ---------------------------------------------------------------------
// Die Figur ist ein Skelett aus Knochen. Eine Pose legt fest, wie die
// Gelenke stehen. Animationen entstehen, indem zwischen zwei Posen
// weich übergeblendet wird. Angriffs-Animationen werden direkt aus den
// Frame-Daten in config.js abgeleitet (Ausholen → Treffen → Zurück).
//
// Winkel in Grad. Glieder: 0 = zeigt nach unten, 90 = nach vorne,
// 180 = nach oben. Unterarm/Unterschenkel sind relativ zum oberen Teil.
// =====================================================================

import { MOVE_DATA } from './sim.js';
import { COMBAT, FIGHTER } from './config.js';

export const BONES = { thigh: 42, shin: 42, upperArm: 28, foreArm: 27, torso: 50, neck: 7, head: 15 };

// Grundpose mit Abweichungen erzeugen
const P = (o) => ({
  hip: [0, 78],     // Hüfte relativ zu den Füßen
  torso: 8,         // Neigung des Oberkörpers (positiv = nach vorne)
  head: -4,         // Kopfneigung
  armF: [45, 95],   // vorderer Arm [Oberarm, Unterarm]
  armB: [30, 110],  // hinterer Arm
  legF: [24, -34],  // vorderes Bein [Oberschenkel, Unterschenkel]
  legB: [-15, -20], // hinteres Bein
  rot: 0,           // Drehung der ganzen Figur um die Hüfte
  ...o,
});

export const POSES = {
  stance: P({}),
  walkB: P({ hip: [3, 77], legF: [34, -36], legB: [-10, -26] }),
  walkC: P({ hip: [-1, 79], legF: [16, -28], legB: [-22, -14] }),
  crouch: P({ hip: [0, 46], torso: 20, head: -6, armF: [55, 95], armB: [40, 105], legF: [75, -115], legB: [-5, -85] }),
  squat: P({ hip: [0, 58], torso: 14, head: -4, armF: [40, 100], armB: [25, 115], legF: [50, -80], legB: [-8, -60] }),
  jumpUp: P({ hip: [0, 70], torso: 4, head: -2, armF: [100, 60], armB: [70, 70], legF: [70, -110], legB: [10, -100] }),
  jumpFall: P({ hip: [0, 74], torso: 6, head: 0, armF: [80, 70], armB: [55, 80], legF: [25, -30], legB: [-12, -35] }),
  tuck: P({ hip: [0, 70], torso: 30, head: 20, armF: [80, 90], armB: [70, 90], legF: [100, -140], legB: [90, -130] }),
  guard: P({ hip: [-2, 76], torso: 0, head: -8, armF: [40, 130], armB: [55, 115] }),
  guardCrouch: P({ hip: [-2, 46], torso: 12, head: -10, armF: [45, 130], armB: [60, 112], legF: [75, -115], legB: [-5, -85] }),
  hurt: P({ hip: [-6, 76], torso: -22, head: -20, armF: [10, 40], armB: [-20, 60], legF: [10, -20], legB: [-25, -10] }),
  hurtCrouch: P({ hip: [-4, 46], torso: -5, head: -18, armF: [20, 50], armB: [0, 60], legF: [75, -115], legB: [-5, -85] }),
  fly: P({ hip: [0, 70], torso: -10, head: -20, armF: [150, 20], armB: [120, 30], legF: [40, -30], legB: [20, -40], rot: -55 }),
  lying: P({ hip: [0, 14], torso: 0, head: 10, armF: [10, 0], armB: [20, 10], legF: [5, 0], legB: [-5, 0], rot: -90 }),
  win: P({ hip: [0, 82], torso: -6, head: -10, armF: [175, 10], armB: [-20, 100], legF: [16, -10], legB: [-16, -10] }),
};

// Ausholen (windup) und Treffen (strike) für jeden Angriff
const ATTACKS = {
  lightStand: {
    base: 'stance',
    windup: P({ armF: [60, 80], torso: 6 }),
    strike: P({ hip: [4, 77], torso: 14, armF: [82, -2], armB: [20, 120] }),
  },
  heavyStand: {
    base: 'stance',
    windup: P({ hip: [0, 80], torso: -8, legF: [80, -120], legB: [-6, -8], armF: [40, 110], armB: [50, 90] }),
    strike: P({ hip: [-4, 82], torso: -22, head: -10, legF: [98, 0], legB: [-4, -6], armF: [30, 120], armB: [60, 100] }),
  },
  lightCrouch: {
    base: 'crouch',
    windup: P({ hip: [0, 40], torso: 22, head: -6, armF: [55, 95], armB: [40, 105], legF: [60, -110], legB: [-30, -60] }),
    strike: P({ hip: [2, 30], torso: 26, head: -8, armF: [55, 95], armB: [40, 105], legF: [82, 3], legB: [-40, -50] }),
  },
  heavyCrouch: {
    base: 'crouch',
    windup: P({ hip: [0, 36], torso: 30, head: 0, armF: [20, 40], armB: [40, 90], legF: [40, -60], legB: [-35, -55] }),
    strike: P({ hip: [6, 28], torso: 45, head: 10, armF: [10, 20], armB: [60, 80], legF: [86, 2], legB: [-40, -50] }),
  },
  lightAir: {
    base: 'jumpFall',
    windup: P({ hip: [0, 70], torso: 4, armF: [100, 50], armB: [70, 60], legF: [90, -120], legB: [10, -110] }),
    strike: P({ hip: [0, 70], torso: 10, armF: [100, 40], armB: [70, 60], legF: [70, -30], legB: [10, -110] }),
  },
  heavyAir: {
    base: 'jumpFall',
    windup: P({ hip: [0, 70], torso: -4, armF: [120, 40], armB: [90, 60], legF: [80, -130], legB: [-10, -100] }),
    strike: P({ hip: [0, 68], torso: -15, head: -6, armF: [130, 30], armB: [100, 60], legF: [65, 0], legB: [-20, -100] }),
  },
  // Einhändiger Wurf: vorderer Arm holt weit nach hinten aus und schleudert den Ball nach vorn
  special: {
    base: 'stance',
    windup: P({ hip: [-4, 77], torso: -10, head: -4, armF: [-55, 50], armB: [60, 80], legF: [26, -30], legB: [-18, -18] }),
    strike: P({ hip: [6, 74], torso: 16, head: 4, armF: [88, -4], armB: [-20, 50], legF: [36, -30], legB: [-28, -6] }),
  },
};

// ---------------------------------------------------------------------
// Überblenden
// ---------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function blend(a, b, t) {
  return {
    hip: [lerp(a.hip[0], b.hip[0], t), lerp(a.hip[1], b.hip[1], t)],
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head, b.head, t),
    armF: [lerp(a.armF[0], b.armF[0], t), lerp(a.armF[1], b.armF[1], t)],
    armB: [lerp(a.armB[0], b.armB[0], t), lerp(a.armB[1], b.armB[1], t)],
    legF: [lerp(a.legF[0], b.legF[0], t), lerp(a.legF[1], b.legF[1], t)],
    legB: [lerp(a.legB[0], b.legB[0], t), lerp(a.legB[1], b.legB[1], t)],
    rot: lerp(a.rot, b.rot, t),
  };
}

function cycle(frames, frame, period) {
  const t = ((frame % period) + period) % period / period * frames.length;
  const i = Math.floor(t);
  return blend(frames[i], frames[(i + 1) % frames.length], ease(t - i));
}

const WALK = [POSES.stance, POSES.walkB, POSES.walkC];

/**
 * Pose für einen Kämpfer aus dem Spielzustand.
 * time = Sekunden (für Atmen u. Ä.). Liefert { pose, snap } –
 * snap = true heißt: sofort zeigen statt weich überblenden.
 */
export function poseFor(f, time) {
  switch (f.state) {
    case 'walk': {
      const backwards = f.vx * f.facing < 0;
      return { pose: cycle(WALK, backwards ? -f.stateFrame : f.stateFrame, 27), snap: false };
    }
    case 'crouch':
      return { pose: f.guarding ? POSES.guardCrouch : POSES.crouch, snap: false };
    case 'jumpsquat':
    case 'land':
      return { pose: POSES.squat, snap: false };
    case 'air': {
      if (f.jumpDir !== 0) {
        // Salto beim Vor-/Rückwärtssprung
        const airtime = (2 * FIGHTER.JUMP_VELOCITY) / FIGHTER.GRAVITY;
        const t = Math.min(1, Math.max(0, (f.stateFrame - 4) / (airtime - 12)));
        const flipDir = f.jumpDir * f.facing; // 1 = vorwärts
        const pose = { ...blend(POSES.jumpUp, POSES.tuck, Math.min(1, t * 4) * Math.min(1, (1 - t) * 4)) };
        pose.rot = ease(t) * 360 * flipDir;
        return { pose, snap: false };
      }
      return { pose: f.vy > 0 ? POSES.jumpUp : POSES.jumpFall, snap: false };
    }
    case 'attack':
      return { pose: attackPose(f), snap: true };
    case 'blockstun':
      return { pose: f.crouching ? POSES.guardCrouch : POSES.guard, snap: true };
    case 'hitstun': {
      const base = f.crouching ? POSES.crouch : POSES.stance;
      const hurt = f.crouching ? POSES.hurtCrouch : POSES.hurt;
      const t = Math.min(1, f.stun / 10);
      return { pose: blend(base, hurt, 0.35 + 0.65 * t), snap: f.stateFrame < 2 };
    }
    case 'knockdown': {
      if (f.y > 0 || f.vy !== 0) {
        const pose = { ...POSES.fly, rot: Math.max(-85, -40 + (f.vy < 0 ? -40 : 0)) };
        return { pose, snap: f.stateFrame < 2 };
      }
      return { pose: POSES.lying, snap: false };
    }
    case 'ko':
      return { pose: POSES.lying, snap: false };
    case 'getup': {
      const t = 1 - f.stun / COMBAT.GETUP_TIME;
      const pose = t < 0.5 ? blend(POSES.lying, POSES.squat, ease(t * 2)) : blend(POSES.squat, POSES.stance, ease((t - 0.5) * 2));
      return { pose, snap: true };
    }
    case 'win': {
      const pump = Math.sin(time * 6) * 0.5 + 0.5;
      const pose = blend(POSES.win, { ...POSES.win, armF: [160, 30], hip: [0, 80] }, pump);
      return { pose, snap: false };
    }
    default: {
      // idle: leichtes Atmen
      const base = f.guarding ? POSES.guard : POSES.stance;
      const b = Math.sin(time * 3.2);
      const pose = { ...base, hip: [base.hip[0], base.hip[1] + b * 1.5], armF: [base.armF[0] + b * 3, base.armF[1]], armB: [base.armB[0] + b * 2, base.armB[1]] };
      return { pose, snap: false };
    }
  }
}

function attackPose(f) {
  const m = MOVE_DATA[f.move];
  const a = ATTACKS[f.move];
  if (!m || !a) return POSES.stance;
  const base = POSES[a.base];
  const mf = f.moveFrame;
  if (mf < m.startup) {
    // Ausholen, im letzten Frame schon Richtung Treffer
    const t = (mf + 1) / m.startup;
    return t < 0.75 ? blend(base, a.windup, ease(t / 0.75)) : blend(a.windup, a.strike, ease((t - 0.75) / 0.25) * 0.5);
  }
  if (mf < m.startup + m.active) return a.strike;
  if (m.recovery <= 0) return a.strike;
  const t = (mf - m.startup - m.active + 1) / m.recovery;
  return blend(a.strike, base, ease(Math.min(1, t)));
}

// ---------------------------------------------------------------------
// Gelenkpositionen berechnen (Körper-Koordinaten: x nach vorne, y nach oben)
// ---------------------------------------------------------------------
const RAD = Math.PI / 180;
const dir = (deg) => [Math.sin(deg * RAD), -Math.cos(deg * RAD)];

export function solvePose(p) {
  const hip = [p.hip[0], p.hip[1]];
  const t = p.torso * RAD;
  const neck = [hip[0] + Math.sin(t) * BONES.torso, hip[1] + Math.cos(t) * BONES.torso];
  const shoulder = [hip[0] + Math.sin(t) * BONES.torso * 0.9, hip[1] + Math.cos(t) * BONES.torso * 0.9];
  const ht = (p.torso + p.head) * RAD;
  const headR = BONES.neck + BONES.head;
  const head = [neck[0] + Math.sin(ht) * headR, neck[1] + Math.cos(ht) * headR];

  const limb = (start, a1, a2, l1, l2) => {
    const d1 = dir(a1 + p.torso * 0.3);
    const mid = [start[0] + d1[0] * l1, start[1] + d1[1] * l1];
    const d2 = dir(a1 + a2 + p.torso * 0.3);
    return [mid, [mid[0] + d2[0] * l2, mid[1] + d2[1] * l2]];
  };
  const leg = (start, a1, a2) => {
    const d1 = dir(a1);
    const mid = [start[0] + d1[0] * BONES.thigh, start[1] + d1[1] * BONES.thigh];
    const d2 = dir(a1 + a2);
    return [mid, [mid[0] + d2[0] * BONES.shin, mid[1] + d2[1] * BONES.shin]];
  };
  const [elbowF, handF] = limb(shoulder, p.armF[0], p.armF[1], BONES.upperArm, BONES.foreArm);
  const [elbowB, handB] = limb([shoulder[0] - 3, shoulder[1]], p.armB[0], p.armB[1], BONES.upperArm, BONES.foreArm);
  const [kneeF, footF] = leg([hip[0] + 3, hip[1]], p.legF[0], p.legF[1]);
  const [kneeB, footB] = leg([hip[0] - 3, hip[1]], p.legB[0], p.legB[1]);

  const j = { hip, neck, shoulder, head, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };
  if (p.rot) {
    // ganze Figur um die Hüfte drehen (positiv = nach vorne kippen)
    const c = Math.cos(-p.rot * RAD);
    const s = Math.sin(-p.rot * RAD);
    for (const key of Object.keys(j)) {
      if (key === 'hip') continue;
      const dx = j[key][0] - hip[0];
      const dy = j[key][1] - hip[1];
      j[key] = [hip[0] + dx * c - dy * s, hip[1] + dx * s + dy * c];
    }
  }
  j.footAngleF = p.legF[0] + p.legF[1] - p.rot;
  j.footAngleB = p.legB[0] + p.legB[1] - p.rot;
  j.torsoAngle = p.torso + p.rot;
  j.headAngle = p.torso + p.head + p.rot;
  return j;
}
