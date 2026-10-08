// =====================================================================
// pacing.js – Spieltakt (60 Schritte/s) passend zum Bildschirmtakt
// ---------------------------------------------------------------------
// Ein "Accumulator" sammelt die vergangene Zeit und macht daraus feste
// Spielschritte von 1/60 s. Zwei Feinheiten verhindern Ruckeln:
//  1. Einrasten: Liegt die Bildzeit sehr nah an 1/60 s (oder 1/120 s),
//     wird genau dieser Wert benutzt. Sonst erzeugen winzige Mess-
//     ungenauigkeiten des Browsers abwechselnd 0 und 2 Schritte pro Bild.
//  2. Mitte halten: Nach dem Start und nach jedem Warten (online) steht
//     der Zähler auf einem halben Schritt – weit weg von der Grenze.
// Ohne DOM, damit es in Node getestet werden kann (tests/lockstep.test.js).
// =====================================================================

export const STEP_MS = 1000 / 60;

export class FrameClock {
  constructor(stepMs = STEP_MS, maxSteps = 5) {
    this.step = stepMs;
    this.maxSteps = maxSteps;
    this.acc = stepMs / 2;
  }

  /** Neu anfangen (Spielstart, nach einer Pause) */
  reset() {
    this.acc = this.step / 2;
  }

  /** Vergangene Bildzeit (ms) hinzufügen */
  add(dt) {
    if (dt > 250) dt = 250; // z. B. nach Tab-Wechsel nicht alles nachholen
    if (dt < 0) dt = 0;
    if (Math.abs(dt - this.step) < 2) dt = this.step; // 60-Hz-Bildschirm
    else if (Math.abs(dt - this.step / 2) < 1) dt = this.step / 2; // 120-Hz-Bildschirm
    this.acc += dt;
  }

  /**
   * So viele Spielschritte ausführen, wie die gesammelte Zeit erlaubt.
   * tick() führt einen Schritt aus und liefert false, wenn (online) gewartet werden muss.
   * scale > 1 macht die Schritte etwas länger (= langsamer), siehe Zeitabgleich in lockstep.js.
   * Rückgabe: Anzahl der ausgeführten Schritte.
   */
  run(tick, scale = 1) {
    const step = this.step * scale;
    let steps = 0;
    while (this.acc >= step && steps < this.maxSteps) {
      if (!tick()) {
        // Warten: beim nächsten Bild gleich wieder versuchen, Zähler in die Mitte
        this.acc = Math.min(this.acc, step / 2);
        return steps;
      }
      this.acc -= step;
      steps++;
    }
    if (steps >= this.maxSteps) this.acc = step / 2; // viel zu weit hinten: nicht alles nachholen
    return steps;
  }
}
