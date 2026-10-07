// =====================================================================
// sessions.js – die Spielmodi (Lokal, Training, Menü-Demo)
// ---------------------------------------------------------------------
// Eine Session besitzt den aktuellen Spielzustand und weiß, woher die
// Eingaben der beiden Spieler kommen. main.js ruft 60-mal pro Sekunde
// tick() auf. Der Online-Modus steckt in online.js.
// =====================================================================

import { createMatch, step } from './sim.js';
import { KEYS } from './config.js';
import { KeyboardInput, GamepadInput, BotInput, DummyInput, combine } from './input.js';

class BaseSession {
  constructor(state) {
    this.state = state;
    this.events = [...state.events];
    this.canPause = true;
    this.localPlayer = -1; // -1 = beide Spieler sitzen hier
  }
  advance(inputP1, inputP2) {
    const next = step(this.state, inputP1, inputP2);
    for (const e of next.events) this.events.push(e);
    this.state = next;
  }
  /** Ereignisse seit dem letzten Abholen (für Effekte und Sound) */
  takeEvents() {
    const list = this.events;
    this.events = [];
    return list;
  }
  restart(options) {
    this.state = createMatch(options);
    for (const e of this.state.events) this.events.push(e);
  }
  dispose() {}
}

/** Zwei Spieler an einem Gerät (Tastatur und/oder Gamepads). */
export class LocalSession extends BaseSession {
  constructor(touch) {
    super(createMatch());
    this.kind = 'local';
    this.p1 = combine(new KeyboardInput(KEYS.P1), new GamepadInput(0), touch);
    this.p2 = combine(new KeyboardInput(KEYS.P2), new GamepadInput(1));
  }
  tick() {
    this.advance(this.p1.read(), this.p2.read());
    return true;
  }
  rematch() {
    this.restart();
  }
}

/** Training gegen einen Dummy. Spieler 1 darf jedes Eingabegerät benutzen. */
export class TrainingSession extends BaseSession {
  constructor(touch) {
    super(createMatch({ training: true }));
    this.kind = 'training';
    this.p1 = combine(new KeyboardInput(KEYS.P1), new KeyboardInput(KEYS.P2), new GamepadInput(0), touch);
    this.dummy = new DummyInput(() => this.state.fighters[1]);
  }
  tick() {
    this.advance(this.p1.read(), this.dummy.read());
    return true;
  }
  rematch() {
    this.restart({ training: true });
  }
}

/** Zwei Computer-Kämpfer als Hintergrund fürs Hauptmenü. */
export class DemoSession extends BaseSession {
  constructor() {
    super(createMatch());
    this.kind = 'demo';
    this.canPause = false;
    const seed = (Date.now() & 0xffff) + 1;
    this.p1 = new BotInput(seed, () => this.state.fighters[0], () => this.state.fighters[1]);
    this.p2 = new BotInput(seed * 7 + 3, () => this.state.fighters[1], () => this.state.fighters[0]);
  }
  tick() {
    this.advance(this.p1.read(), this.p2.read());
    if (this.state.phase === 'matchEnd' && this.state.phaseFrame > 240) this.restart();
    return true;
  }
  rematch() {
    this.restart();
  }
}
