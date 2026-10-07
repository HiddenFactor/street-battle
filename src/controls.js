// =====================================================================
// controls.js – Tastenbelegung als lesbarer Text (nur zur Anzeige)
// ---------------------------------------------------------------------
// Der Text wird aus KEYS und GAMEPAD in config.js gebaut. Ändert man dort
// eine Taste, zeigt das Spiel automatisch die neue an.
// =====================================================================

import { KEYS, GAMEPAD } from './config.js';

const SPECIAL_LABELS = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Comma: ',', Period: '.', Slash: '-', // so beschriftet auf deutschen Tastaturen
  Minus: 'ß', Semicolon: 'Ö', Quote: 'Ä', BracketLeft: 'Ü',
  Space: 'Leertaste', Enter: 'Enter', Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Strg', ControlRight: 'Strg',
};

const PAD_LABELS = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 9: 'Start' };

/** Tasten-Code (z. B. "KeyW") → Beschriftung (z. B. "W") */
export function keyLabel(code) {
  if (SPECIAL_LABELS[code]) return SPECIAL_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

// Erste Taste einer Aktion (die anderen sind Ersatztasten)
const first = (map, action) => keyLabel(map[action][0]);
const moveKeys = (map) => [first(map, 'up'), first(map, 'left'), first(map, 'down'), first(map, 'right')].join(' ');

/**
 * Textzeilen für die Anzeige unten im Bild.
 * kind: 'local' | 'training' | 'online'
 * Ergebnis: { left, right } (lokal) oder { center }
 */
export function controlsLines(kind, gamepadConnected) {
  const p1 = KEYS.P1;
  const p2 = KEYS.P2;
  const pad = gamepadConnected
    ? ` · Pad: ${PAD_LABELS[GAMEPAD.LIGHT[0]]} schnell · ${PAD_LABELS[GAMEPAD.HEAVY[0]]} stark · ${PAD_LABELS[GAMEPAD.SPECIAL[0]]} Special`
    : '';
  if (kind === 'local') {
    return {
      left: `P1: ${moveKeys(p1)} · ${first(p1, 'light')} schnell · ${first(p1, 'heavy')} stark · ${first(p1, 'special')} Special`,
      right: `P2: ${moveKeys(p2)} · ${first(p2, 'light')} schnell · ${first(p2, 'heavy')} stark · ${first(p2, 'special')} Special`,
      center: pad ? pad.slice(3) : '',
    };
  }
  const both = (action) => `${first(p1, action)}/${first(p2, action)}`;
  let text = `${moveKeys(p1)} oder ${moveKeys(p2)} · ${both('light')} schnell · ${both('heavy')} stark · ${both('special')} Special`;
  if (kind === 'training') text += ` · ${keyLabel(KEYS.DUMMY_MODE[0])} Dummy · ${keyLabel(KEYS.HITBOXES[0])} Hitboxen`;
  return { center: text + pad };
}
