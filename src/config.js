// =====================================================================
// config.js – ALLE Spielwerte an einem Ort
// ---------------------------------------------------------------------
// Hier kannst du das Spiel ausbalancieren, ohne den übrigen Code
// anzufassen. Einfach Zahl ändern, speichern, Browser neu laden (F5).
//
// Einheiten:
//   Frames = Spielschritte. Das Spiel läuft mit 60 Frames pro Sekunde,
//            30 Frames sind also eine halbe Sekunde.
//   Pixel  = Bildpunkte der Arena (die Arena ist 960 × 540 Pixel groß).
//   px/F   = Pixel pro Frame (Geschwindigkeit). Kommazahlen sind erlaubt.
//
// Boxen (Hitbox = trifft, Hurtbox = kann getroffen werden):
//   x = Abstand der Box-Mitte nach vorne (in Blickrichtung)
//   y = Höhe der Box-Unterkante über den Füßen
//   w = Breite, h = Höhe
//   Tipp: Im Training mit F1 werden alle Boxen angezeigt.
//
// WICHTIG fürs Online-Spiel: Beide Spieler brauchen exakt dieselben
// Spielwerte. Das Spiel prüft das beim Verbinden.
// =====================================================================

export const GAME_VERSION = '1.2.0';

// ---------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------
export const STAGE = {
  WIDTH: 960,            // Breite der Arena (Pixel)
  WALL_MARGIN: 34,       // so nah kommt die Körpermitte an die Wand
  START_X: [330, 630],   // Startpositionen Spieler 1 / Spieler 2
};

// ---------------------------------------------------------------------
// Kämpfer (beide sind gleich stark)
// ---------------------------------------------------------------------
export const FIGHTER = {
  MAX_HP: 100,           // Lebenspunkte
  WALK_FORWARD: 3.4,     // Laufen nach vorne (px/F)
  WALK_BACK: 2.6,        // Laufen nach hinten (px/F)
  JUMP_SQUAT: 3,         // Frames Anlauf, bevor man abhebt
  JUMP_VELOCITY: 15,     // Sprungkraft nach oben (px/F)
  JUMP_FORWARD: 4.2,     // Seitwärts-Tempo beim Vor-/Rückwärtssprung (px/F)
  GRAVITY: 0.75,         // Schwerkraft (px/F pro Frame)
  AIR_CONTROL: 0.7,      // Lenken in der Luft mit links/rechts (px/F pro Frame, 0 = aus)
  AIR_MAX_SPEED: 4.8,    // höchstes Seitwärts-Tempo in der Luft (px/F)
  LANDING_RECOVERY: 3,   // Frames Erholung nach der Landung
  FRICTION: 0.5,         // Bremsen beim Zurückrutschen nach Treffern (px/F pro Frame)

  // Schiebeboxen: Kämpfer können nicht ineinander laufen.
  // Sie sind niedriger als der Körper, damit man über den Gegner springen kann.
  PUSHBOX: {
    stand: { y: 0, w: 56, h: 110 },
    crouch: { y: 0, w: 64, h: 80 },
    air: { y: 30, w: 50, h: 90 },
  },

  // Verwundbare Bereiche je Haltung
  HURTBOX: {
    stand: [{ x: 0, y: 0, w: 58, h: 128 }, { x: 6, y: 128, w: 38, h: 36 }],
    crouch: [{ x: 6, y: 0, w: 66, h: 82 }, { x: 18, y: 82, w: 38, h: 30 }],
    air: [{ x: 0, y: 16, w: 54, h: 112 }, { x: 4, y: 128, w: 36, h: 32 }],
  },
};

// ---------------------------------------------------------------------
// Angriffe
// ---------------------------------------------------------------------
// startup   Frames, bevor der Angriff trifft (kleiner = schneller)
// active    Frames, in denen die Hitbox trifft
// recovery  Frames Erholung danach (in dieser Zeit ist man angreifbar)
// damage    Schaden
// hitstun   so lange kann der Getroffene nichts tun (Frames)
// blockstun so lange steckt der Blockende fest (Frames)
// hitstop   so lange friert das Bild beim Treffer ein (Frames, "Wucht")
// knockback wie stark der Getroffene zurückrutscht (px/F)
// blockPush wie stark der Blockende zurückrutscht (px/F)
// level     'mid' = stehend und geduckt blockbar,
//           'low' = nur geduckt blockbar, 'overhead' = nur stehend blockbar
// cancel    true = kann bei Kontakt sofort in das Special abgebrochen werden
// knockdown true = Gegner fällt um
// chip      Schaden, den man auch beim Blocken bekommt
// hitbox    wo der Angriff trifft
// hurt      zusätzliche verwundbare Box (ausgestreckter Arm/Bein)
//
// Frame-Vorteil (für Profis): hitstun minus (restliche active + recovery).
// Positiv = man ist nach dem Treffer zuerst wieder dran.
export const MOVES = {
  lightStand: {
    name: 'Schneller Schlag',
    startup: 4, active: 3, recovery: 8,
    damage: 5, chip: 0, hitstun: 15, blockstun: 11, hitstop: 7,
    knockback: 4, blockPush: 3.5, level: 'mid', cancel: true,
    hitbox: { x: 66, y: 96, w: 60, h: 26 },
    hurt: { x: 54, y: 96, w: 46, h: 24 },
  },
  heavyStand: {
    name: 'Starker Tritt',
    startup: 9, active: 4, recovery: 18,
    damage: 12, chip: 0, hitstun: 21, blockstun: 15, hitstop: 11,
    knockback: 7, blockPush: 5, level: 'mid', cancel: true,
    hitbox: { x: 80, y: 84, w: 76, h: 30 },
    hurt: { x: 64, y: 84, w: 60, h: 30 },
  },
  lightCrouch: {
    name: 'Tiefer Schlag',
    startup: 5, active: 3, recovery: 9,
    damage: 4, chip: 0, hitstun: 14, blockstun: 10, hitstop: 6,
    knockback: 3.5, blockPush: 3, level: 'low', cancel: true, crouch: true,
    hitbox: { x: 66, y: 6, w: 64, h: 22 },
    hurt: { x: 50, y: 6, w: 50, h: 20 },
  },
  heavyCrouch: {
    name: 'Feger',
    startup: 10, active: 4, recovery: 22,
    damage: 10, chip: 0, hitstun: 0, blockstun: 12, hitstop: 10,
    knockback: 4, blockPush: 4, level: 'low', knockdown: true, crouch: true,
    hitbox: { x: 84, y: 4, w: 88, h: 24 },
    hurt: { x: 64, y: 4, w: 64, h: 22 },
  },
  lightAir: {
    name: 'Sprung-Schlag',
    startup: 4, active: 8, recovery: 0,
    damage: 6, chip: 0, hitstun: 15, blockstun: 10, hitstop: 7,
    knockback: 3, blockPush: 3, level: 'overhead', air: true,
    hitbox: { x: 48, y: 24, w: 58, h: 38 },
    hurt: null,
  },
  heavyAir: {
    name: 'Sprung-Tritt',
    startup: 7, active: 6, recovery: 0,
    damage: 10, chip: 0, hitstun: 19, blockstun: 13, hitstop: 10,
    knockback: 4.5, blockPush: 4, level: 'overhead', air: true,
    hitbox: { x: 56, y: 8, w: 72, h: 44 },
    hurt: null,
  },
  // Das Special: ein Energieball (Projektil)
  special: {
    name: 'Energieball',
    startup: 13, active: 1, recovery: 24,
    cooldown: 120,        // Frames, bis der nächste Ball möglich ist (120 = 2 Sekunden)
    speed: 6.5,           // Flugtempo (px/F)
    lifetime: 200,        // Frames, bis der Ball verpufft
    damage: 10, chip: 2, hitstun: 18, blockstun: 14, hitstop: 8,
    knockback: 5, blockPush: 4, level: 'mid',
    ball: { x: 72, y: 92, w: 44, h: 36 },   // Größe und Startpunkt des Balls
    hurt: { x: 40, y: 96, w: 40, h: 26 },
  },
};

// ---------------------------------------------------------------------
// Kampfregeln
// ---------------------------------------------------------------------
export const COMBAT = {
  INPUT_BUFFER: 5,           // Frames, die ein zu früh gedrückter Knopf gemerkt wird
  BLOCK_HITSTOP_LESS: 3,     // Hitstop beim Blocken ist um so viel kürzer
  KO_HITSTOP: 45,            // Standbild beim K.O. (Frames)
  LAUNCH_VELOCITY: 8,        // wie hoch man beim Umfallen fliegt (px/F)
  LAUNCH_PUSH: 3.5,          // wie weit man beim Umfallen fliegt (px/F)
  KNOCKDOWN_TIME: 36,        // Frames am Boden liegen
  GETUP_TIME: 24,            // Frames Aufstehen (unverwundbar)
  COMBO_SCALING: 10,         // jeder weitere Combo-Treffer macht so viel % weniger Schaden
  COMBO_MIN_DAMAGE: 40,      // ... aber nie weniger als so viel % des Normalschadens
  PROXIMITY_GUARD: 170,      // ab dieser Nähe geht man in Blockhaltung (Pixel)
};

// ---------------------------------------------------------------------
// Runden
// ---------------------------------------------------------------------
export const ROUND = {
  TIME_SECONDS: 99,      // Rundenzeit
  ROUNDS_TO_WIN: 2,      // 2 = "Best of 3"
  MAX_ROUNDS: 5,         // spätestens nach so vielen Runden ist Schluss (wegen Unentschieden)
  INTRO_FRAMES: 90,      // Länge der "RUNDE X"-Einblendung
  END_FRAMES: 200,       // Pause nach K.O./Zeitablauf bis zur nächsten Runde
  WIN_POSE_DELAY: 70,    // ab wann der Sieger jubelt
};

// ---------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------
export const TRAINING = {
  REFILL_DELAY: 60,      // Frames ohne Treffer, bis die Lebensenergie wieder voll ist
};

// ---------------------------------------------------------------------
// Online (Netzwerk)
// ---------------------------------------------------------------------
export const NET = {
  DEFAULT_DELAY: 3,      // Eingabeverzögerung in Frames (höher = ruckelfreier, aber träger)
  MIN_DELAY: 1,
  MAX_DELAY: 8,
  REDUNDANCY: 8,         // so viele vergangene Eingaben stecken in jedem Paket
  CHECKSUM_INTERVAL: 60, // alle X Frames wird geprüft, ob beide Spiele gleich laufen
  ID_PREFIX: 'streetbattle-v1-',
  CODE_LENGTH: 5,
  CONNECT_TIMEOUT_MS: 15000,
  DISCONNECT_TIMEOUT_MS: 8000,
  PING_INTERVAL_MS: 1000,
  WAIT_MESSAGE_MS: 250,  // ab so langer Wartezeit erscheint "Warte auf Gegner ..."
  // Eigene STUN/TURN-Server (nur für Profis). null = Standard von PeerJS.
  // Beispiel: [{ urls: 'stun:stun.l.google.com:19302' }]
  ICE_SERVERS: null,
  PEERJS_URLS: [
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
  ],
};

// ---------------------------------------------------------------------
// Tastatur (Codes siehe https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_code_values)
// ---------------------------------------------------------------------
export const KEYS = {
  P1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    // Maus: Linksklick = schnell, Rechtsklick = stark; F/G/H gehen zusätzlich
    light: ['MouseLeft', 'KeyF'], heavy: ['MouseRight', 'KeyG'], special: ['Space', 'KeyH'],
  },
  P2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    // Nummernblock 1/2/3 – oder , . - für Laptops ohne Nummernblock
    light: ['Numpad1', 'Comma'], heavy: ['Numpad2', 'Period'], special: ['Numpad3', 'Slash'],
  },
  PAUSE: ['Escape', 'KeyP'],
  HITBOXES: ['F1'],
  DUMMY_MODE: ['KeyT'],
};

// ---------------------------------------------------------------------
// Gamepad (Nummern der Knöpfe im "Standard-Layout")
// 0 = A/✕   1 = B/○   2 = X/□   3 = Y/△   5 = RB/R1   7 = RT/R2   9 = Start
// ---------------------------------------------------------------------
export const GAMEPAD = {
  LIGHT: [2, 0],
  HEAVY: [3, 7],
  SPECIAL: [1, 5],
  PAUSE: [9],
  STICK_DEADZONE: 0.5,
};

// ---------------------------------------------------------------------
// Aussehen (nur Grafik, ändert nichts am Spielablauf)
// ---------------------------------------------------------------------
export const LOOK = {
  PLAYERS: [
    // Eigene Farben (bewusst nicht an bekannte Spielfiguren angelehnt)
    { name: 'SPIELER 1', gi: '#1fa59c', giDark: '#0e5a55', belt: '#111318', band: '#ff8c1a', skin: '#f0b98d', hair: '#2a1a12', glow: '#45f0e0' },
    { name: 'SPIELER 2', gi: '#7c42d6', giDark: '#43207a', belt: '#111318', band: '#a6f03a', skin: '#d79a6c', hair: '#141010', glow: '#c77dff' },
  ],
  SCREEN_SHAKE: 1.0,     // 0 = aus, 1 = normal, 2 = doppelt
  PARTICLES: 1.0,        // Menge der Partikel (0 = aus)
  SHOW_CONTROLS: true,   // Tastenbelegung klein unten im Bild anzeigen (false = aus)
};

// Nur diese Teile bestimmen den Spielablauf. Online müssen sie bei beiden
// Spielern gleich sein (wird beim Verbinden per Prüfsumme verglichen).
export function gameplayConfig() {
  return { GAME_VERSION, STAGE, FIGHTER, MOVES, COMBAT, ROUND, TRAINING };
}
