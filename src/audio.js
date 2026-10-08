// =====================================================================
// audio.js – Soundeffekte, komplett per WebAudio erzeugt (keine Dateien)
// ---------------------------------------------------------------------
// Browser erlauben Ton erst nach einer Nutzeraktion (Klick/Taste).
// Deshalb wird der AudioContext erst bei unlock() erzeugt.
// =====================================================================

const STORAGE_KEY = 'streetbattle-muted';
// Geschoss-Specials haben ihren eigenen Sound beim Abwurf (Ereignis 'special')
const SILENT_SWINGS = ['special', 'stomp', 'arc'];

function loadMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // privater Modus o. Ä. – dann eben nicht merken
  }
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = loadMuted();
    this.volume = 0.55;
    this.lastPlayed = {};
  }

  /** Nach der ersten Nutzeraktion aufrufen. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // Weißes Rauschen für Schläge, Wind und Explosionen
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(value) {
    this.muted = value;
    saveMuted(value);
    if (this.master) this.master.gain.setTargetAtTime(value ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // -------------------------------------------------------------------
  // Bausteine
  // -------------------------------------------------------------------
  out(pan) {
    const g = this.ctx.createGain();
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(this.master);
    } else {
      g.connect(this.master);
    }
    return g;
  }

  tone({ type = 'sine', f0, f1 = f0, dur, vol = 0.3, delay = 0, pan = 0, attack = 0.005 }) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.out(pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hiss({ dur, vol = 0.3, filter = 'bandpass', f0 = 1000, f1 = f0, q = 1, delay = 0, pan = 0, attack = 0.003 }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filter;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.out(pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt);
    flt.connect(g);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // -------------------------------------------------------------------
  // Die eigentlichen Sounds
  // -------------------------------------------------------------------
  play(name, pan = 0) {
    if (!this.ctx || this.muted) return;
    // gleiche Sounds nicht im selben Moment doppelt
    const now = this.ctx.currentTime;
    if (this.lastPlayed[name] && now - this.lastPlayed[name] < 0.03) return;
    this.lastPlayed[name] = now;

    switch (name) {
      case 'hitLight':
        this.hiss({ dur: 0.07, vol: 0.5, filter: 'bandpass', f0: 2200, f1: 900, q: 0.8, pan });
        this.tone({ f0: 190, f1: 60, dur: 0.09, vol: 0.5, pan });
        break;
      case 'hitHeavy':
        this.hiss({ dur: 0.16, vol: 0.6, filter: 'lowpass', f0: 2600, f1: 300, q: 0.7, pan });
        this.tone({ f0: 140, f1: 38, dur: 0.22, vol: 0.7, pan });
        this.tone({ type: 'square', f0: 90, f1: 40, dur: 0.08, vol: 0.12, pan });
        break;
      case 'block':
        this.tone({ type: 'square', f0: 1300, f1: 700, dur: 0.05, vol: 0.12, pan });
        this.hiss({ dur: 0.05, vol: 0.25, filter: 'highpass', f0: 3000, pan });
        this.tone({ type: 'triangle', f0: 2400, f1: 2200, dur: 0.12, vol: 0.06, delay: 0.01, pan });
        break;
      case 'swingLight':
        this.hiss({ dur: 0.08, vol: 0.12, filter: 'bandpass', f0: 900, f1: 2600, q: 1.5, pan });
        break;
      case 'swingHeavy':
        this.hiss({ dur: 0.16, vol: 0.18, filter: 'bandpass', f0: 500, f1: 1800, q: 1.2, pan });
        break;
      case 'jump':
        this.tone({ f0: 260, f1: 520, dur: 0.09, vol: 0.08, pan });
        break;
      case 'jump2':
        this.tone({ f0: 420, f1: 900, dur: 0.1, vol: 0.08, pan });
        this.hiss({ dur: 0.08, vol: 0.08, filter: 'highpass', f0: 2000, pan });
        break;
      case 'stomp':
        this.tone({ f0: 90, f1: 32, dur: 0.45, vol: 0.75, pan });
        this.hiss({ dur: 0.5, vol: 0.5, filter: 'lowpass', f0: 900, f1: 90, q: 0.7, pan });
        this.tone({ type: 'square', f0: 60, f1: 40, dur: 0.12, vol: 0.12, pan });
        break;
      case 'dash':
        this.hiss({ dur: 0.24, vol: 0.28, filter: 'bandpass', f0: 400, f1: 3200, q: 1.3, pan });
        this.tone({ type: 'sawtooth', f0: 300, f1: 900, dur: 0.15, vol: 0.05, pan });
        break;
      case 'land':
        this.hiss({ dur: 0.07, vol: 0.18, filter: 'lowpass', f0: 600, f1: 200, pan });
        break;
      case 'stance':
        // Konter-Haltung: leises, hohes Sirren
        this.tone({ type: 'triangle', f0: 900, f1: 1500, dur: 0.18, vol: 0.06, pan });
        break;
      case 'counter':
        // Konter klappt: metallisches Klirren
        this.tone({ type: 'triangle', f0: 2100, f1: 1700, dur: 0.35, vol: 0.18, pan });
        this.tone({ type: 'square', f0: 1050, f1: 880, dur: 0.12, vol: 0.08, pan });
        this.hiss({ dur: 0.25, vol: 0.35, filter: 'highpass', f0: 2500, pan });
        this.tone({ f0: 160, f1: 50, dur: 0.2, vol: 0.4, delay: 0.03, pan });
        break;
      case 'grab':
        // Griff packt zu: dumpfer Ruck, dann Wurf-Rauschen
        this.tone({ f0: 120, f1: 45, dur: 0.18, vol: 0.6, pan });
        this.hiss({ dur: 0.1, vol: 0.4, filter: 'lowpass', f0: 1200, f1: 300, pan });
        this.hiss({ dur: 0.3, vol: 0.22, filter: 'bandpass', f0: 500, f1: 2000, q: 1.2, delay: 0.1, pan });
        break;
      case 'toss':
        // Sternwurf: steigender Klang mit Glitzern
        this.tone({ f0: 500, f1: 1400, dur: 0.25, vol: 0.12, pan });
        for (let n = 0; n < 3; n++) this.tone({ type: 'triangle', f0: 2000 + n * 400, dur: 0.06, vol: 0.05, delay: 0.05 + n * 0.05, pan });
        break;
      case 'burst':
        // Stern zerplatzt am Boden
        this.hiss({ dur: 0.18, vol: 0.25, filter: 'highpass', f0: 1800, pan });
        this.tone({ type: 'triangle', f0: 1500, f1: 500, dur: 0.15, vol: 0.08, pan });
        break;
      case 'down':
        this.tone({ f0: 110, f1: 40, dur: 0.25, vol: 0.5, pan });
        this.hiss({ dur: 0.2, vol: 0.3, filter: 'lowpass', f0: 900, f1: 150, pan });
        break;
      case 'special':
        this.tone({ type: 'sawtooth', f0: 180, f1: 760, dur: 0.28, vol: 0.12, pan });
        this.tone({ type: 'sine', f0: 520, f1: 1300, dur: 0.3, vol: 0.12, pan });
        this.hiss({ dur: 0.3, vol: 0.15, filter: 'bandpass', f0: 600, f1: 3000, q: 2, pan });
        break;
      case 'fireballHit':
        this.hiss({ dur: 0.35, vol: 0.6, filter: 'lowpass', f0: 1800, f1: 120, q: 0.6, pan });
        this.tone({ f0: 100, f1: 30, dur: 0.35, vol: 0.6, pan });
        break;
      case 'clash':
        this.hiss({ dur: 0.4, vol: 0.5, filter: 'bandpass', f0: 1500, f1: 300, q: 0.9, pan });
        this.tone({ type: 'triangle', f0: 880, f1: 440, dur: 0.4, vol: 0.15, pan });
        break;
      case 'fade':
        this.tone({ f0: 900, f1: 300, dur: 0.12, vol: 0.04, pan });
        break;
      case 'denied':
        this.tone({ type: 'square', f0: 180, dur: 0.06, vol: 0.06 });
        this.tone({ type: 'square', f0: 150, dur: 0.08, vol: 0.06, delay: 0.08 });
        break;
      case 'ko':
        this.tone({ f0: 70, f1: 24, dur: 1.1, vol: 0.8 });
        this.hiss({ dur: 0.9, vol: 0.5, filter: 'lowpass', f0: 2000, f1: 80 });
        this.tone({ type: 'sawtooth', f0: 420, f1: 70, dur: 0.9, vol: 0.12, delay: 0.05 });
        break;
      case 'round':
        // Gong
        for (const [f, v] of [[196, 0.25], [294, 0.12], [392, 0.1], [523, 0.05]]) this.tone({ f0: f, f1: f * 0.98, dur: 1.4, vol: v, attack: 0.01 });
        break;
      case 'fight':
        for (const f of [220, 277, 330]) this.tone({ type: 'sawtooth', f0: f, f1: f * 1.02, dur: 0.45, vol: 0.09, attack: 0.01 });
        this.hiss({ dur: 0.3, vol: 0.2, filter: 'bandpass', f0: 1200, f1: 3000 });
        break;
      case 'timeup':
        for (let i = 0; i < 3; i++) this.tone({ type: 'square', f0: 660, dur: 0.12, vol: 0.08, delay: i * 0.18 });
        break;
      case 'tick':
        this.tone({ type: 'square', f0: 990, dur: 0.05, vol: 0.05 });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.35, vol: 0.16, delay: i * 0.12 }));
        this.tone({ type: 'sawtooth', f0: 523, dur: 0.6, vol: 0.05, delay: 0.48 });
        break;
      case 'refill':
        [660, 880].forEach((f, i) => this.tone({ f0: f, dur: 0.1, vol: 0.05, delay: i * 0.07 }));
        break;
      case 'menu':
        this.tone({ type: 'triangle', f0: 1200, f1: 900, dur: 0.05, vol: 0.08 });
        break;
      case 'connect':
        [523, 784].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.15, vol: 0.1, delay: i * 0.1 }));
        break;
      case 'error':
        this.tone({ type: 'sawtooth', f0: 220, f1: 110, dur: 0.35, vol: 0.1 });
        break;
    }
  }

  /** Spielereignis aus der Simulation → passender Sound */
  onEvent(e) {
    const pan = e.x !== undefined ? (e.x - 480) / 600 : 0;
    switch (e.type) {
      case 'hit':
        if (e.proj) this.play('fireballHit', pan);
        else if (e.grab) this.play('grab', pan);
        else this.play(e.heavy ? 'hitHeavy' : 'hitLight', pan);
        break;
      case 'counter':
        this.play('counter', pan);
        break;
      case 'block':
        this.play('block', pan);
        break;
      case 'swing':
        if (e.move === 'dashKick') this.play('dash', pan);
        else if (e.move === 'counter') this.play('stance', pan);
        else if (!SILENT_SWINGS.includes(e.move)) {
          this.play(e.move.startsWith('heavy') || e.move === 'grab' || e.move === 'counterStrike' ? 'swingHeavy' : 'swingLight', pan);
        }
        break;
      case 'special':
        this.play(e.kind === 'wave' ? 'stomp' : e.kind === 'arc' ? 'toss' : 'special', pan);
        break;
      case 'jump':
        this.play(e.double ? 'jump2' : 'jump', pan);
        break;
      case 'fade':
        this.play(e.ground ? 'burst' : 'fade', pan);
        break;
      case 'land':
      case 'down':
      case 'clash':
      case 'round':
      case 'fight':
      case 'ko':
      case 'timeup':
      case 'refill':
        this.play(e.type, pan);
        break;
      case 'noSpecial':
        this.play('denied');
        break;
      case 'matchEnd':
        this.play('win');
        break;
    }
  }
}
