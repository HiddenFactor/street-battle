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
//   Alle Frame- und Tempo-Werte gelten fürs Grundtempo. GAME_SPEED (unten)
//   rechnet sie beim Laden auf das eingestellte Spieltempo um.
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

export const GAME_VERSION = '2.2.0';

// ---------------------------------------------------------------------
// Spieltempo
// ---------------------------------------------------------------------
// 1 = Grundtempo, 1.1 = alles 10 % schneller: Laufen, Springen, Angriffe,
// Geschosse, Trefferpausen, Abklingzeiten. Sprunghöhe, Reichweiten und
// Abstände bleiben gleich – es geht nur schneller. Die Rundenzeit (99 s)
// und die Einblendungen bleiben gleich lang.
// Tipp: in kleinen Schritten ändern (z. B. 1.05 oder 1.15).
export const GAME_SPEED = 1.1;

// ---------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------
export const STAGE = {
  WIDTH: 960,            // Breite der Arena (Pixel)
  WALL_MARGIN: 34,       // so nah kommt die Körpermitte an die Wand
  START_X: [330, 630],   // Startpositionen Spieler 1 / Spieler 2
};

// ---------------------------------------------------------------------
// Kämpfer – Grundwerte
// ---------------------------------------------------------------------
// Diese Werte gelten für alle Charaktere. Ein Charakter kann einzelne
// davon in CHARACTERS (weiter unten) überschreiben. Funke benutzt sie
// unverändert.
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

  // Dash: kurzer, schneller Schritt (Taste C). Richtung = gehaltene Richtung, sonst nach vorn.
  // Währenddessen kann man weder angreifen noch blocken. Charaktere können
  // dashForward / dashBack (px/F) überschreiben.
  DASH_SPEED: 9,         // Tempo beim Vorwärts-Dash (px/F) → 9 × 12 ≈ 108 Pixel
  BACKDASH_SPEED: 7.5,   // Tempo beim Rückwärts-Dash (px/F) → ≈ 90 Pixel
  DASH_FRAMES: 12,       // so lange gleitet man (Frames)
  DASH_RECOVERY: 6,      // danach kurz nicht handlungsfähig (Frames)

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
// grab      true = Griff: geht durch den Block, packt aber keine springenden
//           oder gerade getroffenen/blockenden Gegner
// counter   Konter: fängt in den aktiven Frames Angriffe ab, dann folgt der
//           hier genannte Angriff
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
  // ----- Specials (jeder Charakter hat eins, siehe CHARACTERS) -----
  // Funke: ein Energieball (Projektil)
  special: {
    name: 'Energieball',
    projectile: 'ball',   // Art des Geschosses (Aussehen)
    startup: 13, active: 1, recovery: 24,
    cooldown: 120,        // Frames, bis der nächste Ball möglich ist (120 = 2 Sekunden)
    speed: 6.5,           // Flugtempo (px/F)
    lifetime: 200,        // Frames, bis der Ball verpufft
    damage: 10, chip: 2, hitstun: 18, blockstun: 14, hitstop: 8,
    knockback: 5, blockPush: 4, level: 'mid',
    ball: { x: 72, y: 92, w: 44, h: 36 },   // Größe und Startpunkt des Balls
    hurt: { x: 40, y: 96, w: 40, h: 26 },
  },
  // Fels: Erdstoß – stampft auf, eine Druckwelle läuft über den Boden.
  // Sie ist "tief": nur geduckt blockbar – oder man springt darüber.
  stomp: {
    name: 'Erdstoß',
    projectile: 'wave',
    startup: 18, active: 1, recovery: 26,
    cooldown: 150,
    speed: 5.5,
    lifetime: 120,
    damage: 12, chip: 2, hitstun: 22, blockstun: 16, hitstop: 10,
    knockback: 6, blockPush: 5, level: 'low',
    ball: { x: 64, y: 0, w: 72, h: 30 },
    hurt: { x: 30, y: 0, w: 46, h: 30 },
  },
  // Wiesel: Blitztritt – sprintet mit einem Tritt nach vorn und wirft um.
  // Geblockt steht man lange ungeschützt da (bestrafbar).
  dashKick: {
    name: 'Blitztritt',
    startup: 6, active: 12, recovery: 20,
    cooldown: 75,
    dashSpeed: 9,         // Tempo während des Tritts (px/F)
    damage: 9, chip: 0, hitstun: 0, blockstun: 12, hitstop: 9,
    knockback: 5, blockPush: 6, level: 'mid', knockdown: true,
    hitbox: { x: 62, y: 70, w: 70, h: 40 },
    hurt: { x: 44, y: 70, w: 60, h: 34 },
  },
  // Luchs: Konter – fängt in den aktiven Frames jeden Schlag und Tritt ab und
  // schlägt sofort zurück (Konterschlag). Geschosse werden einfach geschluckt.
  // Gegen Griffe hilft der Konter nicht. Daneben = kurz angreifbar.
  counter: {
    name: 'Konter',
    counter: 'counterStrike', // dieser Angriff folgt, wenn der Konter klappt
    startup: 3, active: 17, recovery: 20,
    cooldown: 90,
    damage: 0, chip: 0, hitstun: 0, blockstun: 0,
    hitstop: 14,          // Standbild, wenn der Konter klappt
    knockback: 0, blockPush: 0, level: 'mid',
    hitbox: null,
    hurt: null,
  },
  counterStrike: {
    name: 'Konterschlag',
    startup: 2, active: 4, recovery: 14,
    damage: 12, chip: 0, hitstun: 0, blockstun: 14, hitstop: 10,
    knockback: 6, blockPush: 5, level: 'mid', knockdown: true,
    hitbox: { x: 66, y: 70, w: 92, h: 70 },
    hurt: { x: 48, y: 84, w: 50, h: 30 },
  },
  // Komet: Sternwurf – ein Stern fliegt im hohen Bogen und fällt von oben herab.
  // Nur STEHEND blockbar. Weite wählen: zurück halten = kurz, vorne halten = weit.
  arc: {
    name: 'Sternwurf',
    projectile: 'arc',
    startup: 14, active: 1, recovery: 22,
    cooldown: 95,
    speed: 5,             // Tempo seitwärts (px/F) ...
    speedNear: 3,         // ... mit "zurück" gehalten
    speedFar: 7,          // ... mit "vorne" gehalten
    rise: 9,              // Wurf nach oben (px/F)
    gravity: 0.35,        // Schwerkraft des Sterns (px/F pro Frame)
    lifetime: 200,
    damage: 10, chip: 2, hitstun: 18, blockstun: 14, hitstop: 8,
    knockback: 4.5, blockPush: 4, level: 'overhead',
    ball: { x: 40, y: 150, w: 34, h: 34 },
    hurt: { x: 30, y: 110, w: 40, h: 34 },
  },
  // Anker: Klammergriff – packt den Gegner und wirft ihn zu Boden. Blocken hilft nicht!
  // Daneben gegriffen steht man aber lange ungeschützt da.
  grab: {
    name: 'Klammergriff',
    grab: true,
    startup: 6, active: 3, recovery: 30,
    cooldown: 60,
    damage: 15, chip: 0, hitstun: 0, blockstun: 0, hitstop: 14,
    knockback: 6, blockPush: 0, level: 'mid', knockdown: true,
    hitbox: { x: 58, y: 40, w: 56, h: 90 },
    hurt: { x: 44, y: 76, w: 52, h: 36 },
  },
};

// ---------------------------------------------------------------------
// Charaktere
// ---------------------------------------------------------------------
// Die Werte sind mit vielen Computer-Kämpfen ausbalanciert (alle Paarungen
// zwischen etwa 45 und 55 % Siegen). Kleine Änderungen wirken stark!
// Jeder Charakter benutzt die Grundwerte aus FIGHTER und MOVES und legt
// hier nur seine Abweichungen fest:
//   hp            Lebenspunkte
//   size          Körpergröße (1 = normal). Wirkt auf Grafik UND alle Boxen.
//   walkForward / walkBack / jumpVelocity / jumpForward / airControl / airMaxSpeed
//                 wie in FIGHTER (fehlt ein Wert, gilt der Grundwert)
//   airJumps      Sprünge in der Luft (1 = Doppelsprung), airJumpVelocity = deren Kraft
//   damageScale   Schaden aller Angriffe in Prozent (125 = 25 % mehr)
//   special       welches Special (Schlüssel aus MOVES)
//   moves         einzelne Angriffswerte ändern, z. B. { lightStand: { startup: 3 } }
//   stats         nur für den Auswahl-Bildschirm (1 bis 5 Balken)
//   look          Aussehen; palettes[1] ist die zweite Farbe, wenn beide
//                 Spieler denselben Charakter wählen
export const CHARACTERS = {
  funke: {
    name: 'FUNKE',
    role: 'Allrounder',
    info: 'Ausgewogen in allem. Hält Gegner mit dem Energieball auf Abstand.',
    hp: 100,
    size: 1,
    special: 'special',
    moves: {},
    stats: { Leben: 3, Kraft: 3, Tempo: 3, Sprung: 3 },
    look: {
      build: 'normal', head: 'band', torso: 'gi',
      palettes: [
        { gi: '#1fa59c', giDark: '#0e5a55', pants: '#1fa59c', belt: '#111318', band: '#ff8c1a', skin: '#f0b98d', hair: '#2a1a12', glow: '#45f0e0' },
        { gi: '#7c42d6', giDark: '#43207a', pants: '#7c42d6', belt: '#111318', band: '#a6f03a', skin: '#d79a6c', hair: '#141010', glow: '#c77dff' },
      ],
    },
  },
  fels: {
    name: 'FELS',
    role: 'Kraftpaket',
    info: 'Langsam, aber zäh und hart. Der Erdstoß rollt über den Boden – nur geduckt blockbar.',
    hp: 110,
    size: 1.05,
    walkForward: 2.7,
    walkBack: 2.1,
    jumpVelocity: 13.5,
    jumpForward: 3.6,
    airControl: 0.45,
    airMaxSpeed: 3.8,
    damageScale: 108,
    special: 'stomp',
    moves: {
      lightStand: { startup: 5, recovery: 9 },
      heavyStand: { startup: 11, recovery: 20, knockback: 8.5 },
      heavyCrouch: { startup: 12 },
    },
    stats: { Leben: 4, Kraft: 4, Tempo: 1, Sprung: 2 },
    look: {
      build: 'heavy', head: 'bald', torso: 'vest',
      palettes: [
        { gi: '#b5652a', giDark: '#6e3a16', pants: '#3d4a2a', belt: '#1c140e', band: '#e8d9b0', skin: '#c98e62', hair: '#3a2416', glow: '#ffb347' },
        { gi: '#4a5a78', giDark: '#2a3346', pants: '#262b36', belt: '#101216', band: '#d0d6e0', skin: '#a8714a', hair: '#1a1414', glow: '#8fd3ff' },
      ],
    },
  },
  wiesel: {
    name: 'WIESEL',
    role: 'Flink',
    info: 'Schnell und wendig mit Doppelsprung. Der Blitztritt überrascht – geblockt ist er aber gefährlich.',
    hp: 95,
    size: 0.98,
    walkForward: 4.3,
    walkBack: 3.3,
    jumpVelocity: 15.5,
    jumpForward: 4.8,
    airControl: 0.9,
    airMaxSpeed: 5.4,
    airJumps: 1,
    airJumpVelocity: 12.5,
    damageScale: 90,
    special: 'dashKick',
    moves: {
      lightStand: { startup: 3, recovery: 7 },
      heavyStand: { startup: 8, recovery: 16 },
      lightCrouch: { startup: 4 },
      heavyCrouch: { startup: 9, recovery: 20 },
    },
    stats: { Leben: 2, Kraft: 2, Tempo: 5, Sprung: 5 },
    look: {
      build: 'slim', head: 'scarf', torso: 'jacket',
      palettes: [
        { gi: '#d6336c', giDark: '#7d1a3e', pants: '#4a3d63', belt: '#1a1420', band: '#f4f4f4', skin: '#f2c6a0', hair: '#2b2b40', glow: '#ff6fae' },
        { gi: '#6b6f78', giDark: '#3a3d44', pants: '#3b4250', belt: '#111216', band: '#ffcc33', skin: '#c99068', hair: '#5a3010', glow: '#ffd75e' },
      ],
    },
  },
  luchs: {
    name: 'LUCHS',
    role: 'Konter',
    info: 'Wartet ab und schlägt zurück: Der Konter fängt Schläge, Tritte und Geschosse ab.',
    hp: 98,
    size: 1,
    walkForward: 3.6,
    walkBack: 2.9,
    damageScale: 100,
    special: 'counter',
    moves: {
      heavyStand: { startup: 8 },
    },
    stats: { Leben: 3, Kraft: 3, Tempo: 4, Sprung: 3 },
    look: {
      build: 'normal', head: 'ponytail', torso: 'tank',
      palettes: [
        { gi: '#2f8a57', giDark: '#1a4f32', pants: '#2b2f3a', belt: '#14161c', band: '#f0e2c0', skin: '#e8b48a', hair: '#c4702a', glow: '#7dffb0' },
        { gi: '#2f6fb5', giDark: '#1b3f69', pants: '#3a2f2b', belt: '#14161c', band: '#ffe08a', skin: '#b97f58', hair: '#1d1a1a', glow: '#6ecbff' },
      ],
    },
  },
  komet: {
    name: 'KOMET',
    role: 'Fernkämpfer',
    info: 'Wirft Sterne im hohen Bogen – nur stehend blockbar. Mit zurück/vorne die Weite wählen.',
    hp: 102,
    size: 0.98,
    jumpVelocity: 15.5,
    airControl: 0.8,
    damageScale: 100,
    special: 'arc',
    moves: {},
    stats: { Leben: 3, Kraft: 3, Tempo: 3, Sprung: 4 },
    look: {
      build: 'normal', head: 'hood', torso: 'hoodie',
      palettes: [
        { gi: '#2c3d94', giDark: '#182259', pants: '#23262f', belt: '#14161c', band: '#ffd23b', skin: '#c68b5e', hair: '#141010', glow: '#ffe066' },
        { gi: '#b8bccb', giDark: '#73778a', pants: '#3b3346', belt: '#14161c', band: '#ff5a8a', skin: '#f1c29a', hair: '#7a4a22', glow: '#ff8ad8' },
      ],
    },
  },
  anker: {
    name: 'ANKER',
    role: 'Ringer',
    info: 'Groß, zäh und langsam. Der Klammergriff geht durch jeden Block – daneben wird es gefährlich.',
    hp: 115,
    size: 1.06,
    walkForward: 2.5,
    walkBack: 2.0,
    jumpVelocity: 13,
    jumpForward: 3.4,
    airControl: 0.4,
    airMaxSpeed: 3.6,
    damageScale: 104,
    special: 'grab',
    moves: {
      lightStand: { startup: 5, recovery: 10 },
      heavyStand: { startup: 11, recovery: 21 },
      heavyCrouch: { startup: 12 },
    },
    stats: { Leben: 5, Kraft: 4, Tempo: 1, Sprung: 1 },
    look: {
      build: 'heavy', head: 'beanie', torso: 'overall',
      palettes: [
        { gi: '#d9a21b', giDark: '#8a6510', pants: '#3d4148', belt: '#1b1d22', band: '#c0c6cc', skin: '#d6a07c', hair: '#4a2a14', hat: '#1f6f78', glow: '#ffa54f' },
        { gi: '#7a5ea8', giDark: '#463566', pants: '#5b5a3a', belt: '#1b1d22', band: '#e6b422', skin: '#9e6b4a', hair: '#141414', hat: '#d9822b', glow: '#5fe3c0' },
      ],
    },
  },
};

// Reihenfolge im Auswahl-Bildschirm (3 pro Reihe)
export const CHARACTER_ORDER = ['funke', 'fels', 'wiesel', 'luchs', 'komet', 'anker'];

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
    dash: ['KeyC'],
  },
  P2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    // Nummernblock 1/2/3 – oder , . - für Laptops ohne Nummernblock
    light: ['Numpad1', 'Comma'], heavy: ['Numpad2', 'Period'], special: ['Numpad3', 'Slash'],
    dash: ['Numpad0', 'KeyM'],
  },
  PAUSE: ['Escape', 'KeyP'],
  HITBOXES: ['F1'],
  DUMMY_MODE: ['KeyT'],
};

// ---------------------------------------------------------------------
// Gamepad (Nummern der Knöpfe im "Standard-Layout")
// 0 = A/✕   1 = B/○   2 = X/□   3 = Y/△   4 = LB/L1   5 = RB/R1   6 = LT/L2   7 = RT/R2   9 = Start
// ---------------------------------------------------------------------
export const GAMEPAD = {
  LIGHT: [2, 0],
  HEAVY: [3, 7],
  SPECIAL: [1, 5],
  DASH: [4, 6],
  PAUSE: [9],
  STICK_DEADZONE: 0.5,
};

// ---------------------------------------------------------------------
// Aussehen (nur Grafik, ändert nichts am Spielablauf)
// ---------------------------------------------------------------------
export const LOOK = {
  // Kennfarben der Spieler (Namen, Markierungen); die Kämpfer-Farben stehen bei CHARACTERS
  PLAYERS: [
    { name: 'SPIELER 1', color: '#ffb02e' },
    { name: 'SPIELER 2', color: '#5fd4ff' },
  ],
  SCREEN_SHAKE: 1.0,     // 0 = aus, 1 = normal, 2 = doppelt
  PARTICLES: 1.0,        // Menge der Partikel (0 = aus)
  SHOW_CONTROLS: true,   // Tastenbelegung klein unten im Bild anzeigen (false = aus)
};

// Nur diese Teile bestimmen den Spielablauf. Online müssen sie bei beiden
// Spielern gleich sein (wird beim Verbinden per Prüfsumme verglichen).
export function gameplayConfig() {
  return { GAME_VERSION, GAME_SPEED, STAGE, FIGHTER, MOVES, CHARACTERS, COMBAT, ROUND, TRAINING };
}
