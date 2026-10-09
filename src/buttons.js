// =====================================================================
// buttons.js – die Eingabe-Bitmaske
// ---------------------------------------------------------------------
// Jede Eingabe eines Spielers in einem Frame ist EINE Zahl. Jeder
// gedrückte Knopf setzt ein Bit. Beispiel: RECHTS + LEICHT = 8 + 16 = 24.
// Richtungen sind absolut (links/rechts auf dem Bildschirm); die
// Simulation rechnet selbst aus, was "vorwärts" und "zurück" ist.
// =====================================================================

export const UP = 1;
export const DOWN = 2;
export const LEFT = 4;
export const RIGHT = 8;
export const LIGHT = 16;
export const HEAVY = 32;
export const SPECIAL = 64;
export const DASH = 128;

export const DIRECTIONS = UP | DOWN | LEFT | RIGHT;
export const BUTTONS = LIGHT | HEAVY | SPECIAL | DASH;
export const ALL_INPUTS = DIRECTIONS | BUTTONS;
