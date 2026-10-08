// =====================================================================
// select.js – Auswahl-Bildschirm für die Charaktere
// ---------------------------------------------------------------------
// Lokal:    beide Spieler wählen gleichzeitig (P1: A/D + bestätigen,
//           P2: Pfeile + Num1). Los geht's, wenn beide bereit sind.
// Training: erst den eigenen Kämpfer, dann den Dummy wählen.
// Online:   jeder wählt selbst und sieht die Wahl des Gegners;
//           der Host startet, sobald beide bereit sind (online.js).
// Maus/Touch: auf eine Karte tippen = wählen und bestätigen.
// =====================================================================

import { CHARACTERS, CHARACTER_ORDER, KEYS, LOOK, MOVES } from './config.js';
import { KeyboardInput, GamepadInput, combine, LEFT, RIGHT, LIGHT, HEAVY } from './input.js';
import { keyLabel } from './controls.js';

const $ = (id) => document.getElementById(id);
const N = CHARACTER_ORDER.length;

export class CharacterSelect {
  /**
   * onDone({ mode, chars }): Auswahl fertig (lokal/Training)
   * onBack(): zurück ins Hauptmenü / Spiel verlassen
   */
  constructor({ ui, sound, touch, onDone, onBack }) {
    this.ui = ui;
    this.sound = sound;
    this.touch = touch;
    this.onDone = onDone;
    this.onBack = onBack;
    this.active = false;
    this.mode = 'local';
    this.session = null;
    this.cursor = [0, 0];
    this.ready = [false, false];
    this.step = 0;
    this.prev = [0, 0];
    this.botTimer = 0;
    this.inputs = [
      combine(new KeyboardInput(KEYS.P1), new GamepadInput(0)),
      combine(new KeyboardInput(KEYS.P2), new GamepadInput(1)),
    ];
    this.inputAny = combine(this.inputs[0], this.inputs[1]);
    this.buildCards();
  }

  // Karten einmal aus CHARACTERS bauen
  buildCards() {
    const box = $('select-cards');
    box.innerHTML = '';
    this.cards = CHARACTER_ORDER.map((id, idx) => {
      const c = CHARACTERS[id];
      const card = document.createElement('button');
      card.className = 'char-card';
      card.type = 'button';
      card.dataset.char = id;
      const stats = Object.entries(c.stats || {})
        .map(([k, v]) => `<div class="stat"><span>${k}</span><i style="--v:${v}"></i></div>`)
        .join('');
      card.innerHTML =
        `<span class="badge b1">P1</span><span class="badge b2">P2</span>` +
        `<b class="char-name">${c.name}</b><em class="char-role">${c.role}</em>` +
        `<div class="stats">${stats}</div><p class="char-special">★ ${MOVES[c.special].name}</p><p class="char-info">${c.info}</p>`;
      card.addEventListener('click', () => this.clickCard(idx));
      box.appendChild(card);
      return card;
    });
  }

  /**
   * Auswahl öffnen.
   * mode: 'local' | 'training' | 'online'; session: OnlineSession (nur online);
   * initial: zuletzt gewählte Charaktere; bot: online automatisch wählen (Tests)
   */
  open({ mode, session = null, initial = null, bot = false }) {
    this.mode = mode;
    this.session = session;
    this.active = true;
    this.step = 0;
    this.bot = bot;
    this.botTimer = 30;
    this.ready = [false, false];
    this.cursor = [0, 1].map((i) => Math.max(0, initial ? CHARACTER_ORDER.indexOf(initial[i]) : 0));
    this.local = mode === 'online' ? session.localPlayer : -1;
    // Schon gedrückte Knöpfe sollen nicht sofort etwas auslösen
    this.prev = [this.inputs[0].read(), this.inputs[1].read()];
    this.prevAny = this.inputAny.read();
    if (mode === 'online') this.sendPick();
    this.ui.show('select');
    this.render();
  }

  close() {
    this.active = false;
  }

  /** Jedes Bild aufrufen: Tasten/Gamepads abfragen, Online-Stand übernehmen */
  update() {
    if (!this.active) return;
    if (this.mode === 'local') {
      for (const i of [0, 1]) {
        const m = this.inputs[i].read();
        this.handle(i, m, this.prev[i]);
        this.prev[i] = m;
      }
    } else {
      const m = this.inputAny.read();
      this.handle(this.mode === 'training' ? this.step : this.local, m, this.prevAny);
      this.prevAny = m;
    }
    if (this.mode === 'online') {
      const remote = 1 - this.local;
      const pick = this.session.remotePick;
      if (pick) {
        const idx = CHARACTER_ORDER.indexOf(pick.char);
        if (idx >= 0 && (idx !== this.cursor[remote] || pick.ready !== this.ready[remote])) {
          this.cursor[remote] = idx;
          this.ready[remote] = pick.ready;
          this.render();
        }
      }
      // Test-Bot: wählt nach einer halben Sekunde zufällig und bestätigt
      if (this.bot && !this.ready[this.local] && --this.botTimer <= 0) {
        this.cursor[this.local] = Math.floor(Math.random() * N);
        this.confirm(this.local);
      }
    }
  }

  handle(slot, mask, prev) {
    const pressed = mask & ~prev;
    if (pressed & LEFT) this.move(slot, -1);
    if (pressed & RIGHT) this.move(slot, 1);
    if (pressed & LIGHT) this.confirm(slot);
    if (pressed & HEAVY) this.cancel(slot);
  }

  move(slot, d) {
    if (this.ready[slot]) return;
    this.cursor[slot] = (this.cursor[slot] + d + N) % N;
    this.sound.play('menu');
    if (this.mode === 'online') this.sendPick();
    this.render();
  }

  confirm(slot) {
    if (this.ready[slot]) return;
    this.ready[slot] = true;
    this.sound.play('connect');
    if (this.mode === 'training' && this.step === 0) {
      this.step = 1; // jetzt den Dummy wählen
      this.render();
      return;
    }
    if (this.mode === 'online') {
      this.sendPick();
      this.render();
      return;
    }
    this.render();
    if (this.ready[0] && this.ready[1]) {
      this.active = false;
      this.onDone({ mode: this.mode, chars: this.chars() });
    }
  }

  cancel(slot) {
    if (this.mode === 'training' && this.step === 1 && !this.ready[1]) {
      this.step = 0;
      this.ready[0] = false;
    } else if (this.ready[slot]) {
      this.ready[slot] = false;
      if (this.mode === 'online') this.sendPick();
    } else {
      return;
    }
    this.sound.play('menu');
    this.render();
  }

  clickCard(idx) {
    const slot = this.mode === 'online' ? this.local : this.mode === 'training' ? this.step : 0;
    if (this.ready[slot]) return;
    this.cursor[slot] = idx;
    this.confirm(slot);
  }

  sendPick() {
    if (this.session) this.session.sendPick(CHARACTER_ORDER[this.cursor[this.local]], this.ready[this.local]);
  }

  chars() {
    return [CHARACTER_ORDER[this.cursor[0]], CHARACTER_ORDER[this.cursor[1]]];
  }

  label(i) {
    if (this.mode === 'training') return i === 0 ? 'DU' : 'DUMMY';
    if (this.mode === 'online') return i === this.local ? 'DU' : 'GEGNER';
    return `P${i + 1}`;
  }

  // Karten, Markierungen und Texte aktualisieren
  render() {
    const both = this.mode === 'local' || this.mode === 'online';
    this.cards.forEach((card, idx) => {
      for (const i of [0, 1]) {
        const shown = both || i === this.step || (this.mode === 'training' && this.ready[i]);
        const here = shown && this.cursor[i] === idx;
        card.classList.toggle(`sel${i + 1}`, here);
        const badge = card.querySelector(`.b${i + 1}`);
        badge.hidden = !here;
        badge.textContent = this.label(i) + (this.ready[i] ? ' ✓' : '');
        badge.style.background = LOOK.PLAYERS[i].color;
      }
    });
    const title =
      this.mode === 'training' ? (this.step === 0 ? 'Wähle deinen Kämpfer' : 'Wähle den Dummy') : 'Wähle deinen Kämpfer';
    this.ui.setText('select-title', title);
    let status = '';
    if (this.mode === 'online') {
      const me = this.ready[this.local];
      const other = this.ready[1 - this.local];
      status = me && other ? 'Los geht’s …' : me ? 'Warte auf deinen Gegner …' : other ? 'Dein Gegner ist bereit!' : '';
    } else if (this.mode === 'local') {
      status = this.ready[0] && !this.ready[1] ? 'Spieler 1 ist bereit – warte auf Spieler 2' : !this.ready[0] && this.ready[1] ? 'Spieler 2 ist bereit – warte auf Spieler 1' : '';
    }
    this.ui.setStatus('select-status', status);
    this.ui.setText('select-hint', this.hintText());
  }

  hintText() {
    if (this.touch && this.touch.enabled) return 'Tippe auf einen Kämpfer.';
    // Tasten statt Maus nennen (Mausklicks zählen hier nur auf den Karten)
    const key = (list) => keyLabel(list.find((c) => !c.startsWith('Mouse')) || list[0]);
    const p1 = KEYS.P1;
    const p2 = KEYS.P2;
    const k1 = `${key(p1.left)}/${key(p1.right)} wählen · ${key(p1.light)} bestätigen · ${key(p1.heavy)} zurück`;
    if (this.mode !== 'local') return `${k1} – oder auf eine Karte klicken`;
    const k2 = `${key(p2.left)}/${key(p2.right)} · ${key(p2.light)} · ${key(p2.heavy)}`;
    return `Spieler 1: ${k1}   ·   Spieler 2: ${k2}   ·   oder auf eine Karte klicken`;
  }

  /** Bühne für den Renderer: die beiden gewählten Kämpfer groß links und rechts */
  sceneState(time) {
    const make = (i) => {
      const char = CHARACTER_ORDER[this.cursor[i]];
      const ready = this.ready[i];
      return {
        char, x: (i === 0 ? 150 : 810) * 100, y: 0, vx: 0, vy: 0, facing: i === 0 ? 1 : -1,
        hp: 1, state: ready ? 'win' : 'idle', stateFrame: Math.floor(time * 60), move: null, moveFrame: 0,
        hasHit: false, stun: 0, cooldown: 0, crouching: false, guarding: false, jumpDir: 0, invuln: 0,
      };
    };
    return {
      phase: 'select', phaseFrame: 0, hitstop: 0, timer: 0, wins: [0, 0], round: 1, training: false,
      chars: this.chars(), fighters: [make(0), make(1)], projectiles: [], events: [],
    };
  }

  view() {
    return {
      labels: [this.label(0), this.label(1)],
      names: this.chars().map((c) => CHARACTERS[c].name),
      ready: this.ready.slice(),
      // im Training ist der Dummy erst nach der eigenen Wahl dran
      dim: this.mode === 'training' && this.step === 0 ? [false, true] : [false, false],
    };
  }
}
