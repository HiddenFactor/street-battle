// =====================================================================
// touch.js – Steuerung per Touchscreen (Handy/Tablet)
// ---------------------------------------------------------------------
// Links ein Steuerkreuz (8 Richtungen), rechts drei Angriffsknöpfe und der Dash (»).
// Mehrere Finger gleichzeitig gehen (Pointer Events). Das Ergebnis
// landet als Bitmaske in einem TouchInput (siehe input.js).
// =====================================================================

import { UP, DOWN, LEFT, RIGHT, LIGHT, HEAVY, SPECIAL, DASH } from './buttons.js';

const BUTTON_BITS = { light: LIGHT, heavy: HEAVY, special: SPECIAL, dash: DASH };

// Richtungen nach Winkel (0° = rechts, 90° = oben). Waagerecht ist großzügig,
// damit man nicht aus Versehen springt.
const SECTORS = [
  [-30, 30, RIGHT],
  [30, 65, UP | RIGHT],
  [65, 115, UP],
  [115, 150, UP | LEFT],
  [150, 210, LEFT],
  [210, 245, DOWN | LEFT],
  [245, 295, DOWN],
  [295, 330, DOWN | RIGHT],
];

function directionFor(dx, dy, radius) {
  if (Math.hypot(dx, dy) < radius * 0.22) return 0; // tote Zone in der Mitte
  let ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (ang < -30) ang += 360;
  for (const [from, to, bits] of SECTORS) if (ang >= from && ang < to) return bits;
  return RIGHT;
}

export function prefersTouch() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

export class TouchControls {
  constructor(touchInput) {
    this.input = touchInput;
    this.root = document.getElementById('touch');
    this.dpad = document.getElementById('dpad');
    this.knob = document.getElementById('dpad-knob');
    this.dirBits = 0;
    this.buttonBits = 0;
    this.dpadPointer = null;
    this.enabled = prefersTouch(); // Touch-Gerät erkannt?
    this.active = false;           // gerade im Spiel?

    this.setupDpad();
    this.setupButtons();

    // Erster Fingertipp irgendwo → Touch-Steuerung einschalten.
    // Wer Tastatur benutzt, bekommt sie wieder ausgeblendet.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !this.enabled) {
        this.enabled = true;
        this.refresh();
      }
    }, { capture: true });
    window.addEventListener('keydown', (e) => {
      if (this.enabled && !prefersTouch() && e.code !== 'Escape') {
        this.enabled = false;
        this.refresh();
      }
    });

    // Kein Zoomen, Scrollen oder Kontextmenü beim Spielen
    const block = (e) => {
      if (!(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
    };
    document.addEventListener('gesturestart', block);
    document.addEventListener('dblclick', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('touchmove', block, { passive: false });
  }

  /** main.js meldet jedes Bild, ob gerade gespielt wird. */
  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    if (!active) this.releaseAll();
    this.refresh();
  }

  refresh() {
    this.root.hidden = !(this.enabled && this.active);
  }

  releaseAll() {
    this.dirBits = 0;
    this.buttonBits = 0;
    this.input.latch = 0;
    this.dpadPointer = null;
    this.knob.style.transform = '';
    for (const b of this.root.querySelectorAll('.tbtn')) b.classList.remove('down');
    this.update();
  }

  update() {
    this.input.mask = this.dirBits | this.buttonBits;
  }

  setupDpad() {
    const move = (e) => {
      const rect = this.dpad.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = e.clientX - (rect.left + radius);
      const dy = e.clientY - (rect.top + radius);
      this.dirBits = directionFor(dx, dy, radius);
      // Knopf folgt dem Finger (begrenzt)
      const len = Math.hypot(dx, dy) || 1;
      const max = radius * 0.55;
      const k = Math.min(1, max / len);
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.update();
    };
    this.dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dpadPointer = e.pointerId;
      try {
        this.dpad.setPointerCapture(e.pointerId);
      } catch {
        /* egal */
      }
      move(e);
    });
    this.dpad.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.dpadPointer) move(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.dpadPointer) return;
      this.dpadPointer = null;
      this.dirBits = 0;
      this.knob.style.transform = '';
      this.update();
    };
    this.dpad.addEventListener('pointerup', end);
    this.dpad.addEventListener('pointercancel', end);
    this.dpad.addEventListener('lostpointercapture', end);
  }

  setupButtons() {
    for (const btn of this.root.querySelectorAll('.tbtn')) {
      const bit = BUTTON_BITS[btn.dataset.btn];
      const pointers = new Set();
      const sync = () => {
        if (pointers.size) this.buttonBits |= bit;
        else this.buttonBits &= ~bit;
        btn.classList.toggle('down', pointers.size > 0);
        this.update();
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pointers.add(e.pointerId);
        this.input.latch |= bit; // auch ganz kurze Tipper zählen (siehe clearInputLatch)
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          /* egal */
        }
        if (navigator.vibrate) navigator.vibrate(8);
        sync();
      });
      const up = (e) => {
        pointers.delete(e.pointerId);
        sync();
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    }
  }
}
