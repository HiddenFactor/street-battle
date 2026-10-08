# CLAUDE.md – Street Battle

2D-Realtime-Fighting-Game für den Browser. Reines HTML5-Canvas + JavaScript (ES-Module),
**kein Build-Schritt, keine Engine**. Einzige externe Bibliothek: PeerJS (per CDN, wird erst
im Online-Menü geladen). Muss als statische Seite hostbar bleiben (GitHub Pages / itch.io).
Der Besitzer ist Programmier-Anfänger: UI-Texte und Code-Kommentare auf Deutsch,
Bezeichner auf Englisch, Kommentare knapp und erklärend.

## Befehle
- Starten (Windows): `start.bat` doppelklicken, oder `node tools/serve.js --open` → http://localhost:8080
- Tests: `npm test` (= `node --test`, findet `tests/*.test.js`), einzeln z. B. `node tests/determinism.test.js`
- Debug: `?debug` in der URL oder F1 zeigt Hit-/Hurt-/Pushboxen.
- itch.io-ZIP: `tools/make-itch-zip.bat` (nutzt das Windows-eigene `tar.exe`)

## Architektur (PFLICHT – nicht aufweichen)

### src/sim.js – reine, deterministische Spiellogik
- API: `createMatch(options)`, `step(state, inputP1, inputP2) → neuer state`, `resetRound(state)`,
  `checksum(state)`, plus Debug-Helfer `hurtboxesOf`, `hitboxOf`, `pushboxWorld`.
- `step` bekommt NUR `{state, inputP1, inputP2}` und gibt einen neuen State zurück. Der alte
  State wird nie verändert (Test friert ihn ein).
- **Verboten in sim.js (und allem, was es importiert: config.js, buttons.js):** DOM, Zeichnen,
  `Date`, `performance`, Timer, `Math.random`, Trigonometrie/`sqrt`/`pow`. Ein Test prüft den Quelltext.
- **Nur Ganzzahlen** im State: Positionen/Geschwindigkeiten in Subpixeln (`SUB = 100`, 1 px = 100).
  config.js darf lesbare Kommazahlen enthalten (px, px/Frame); sim.js rechnet sie beim Laden
  einmal mit `Math.round(v * SUB)` in Ganzzahl-Tabellen um. Halbierungen etc. mit `Math.trunc`.
- State ist reines JSON: Zahlen, Strings, Booleans, Arrays, **flache** Objekte. Kämpfer und
  Projektile enthalten keine verschachtelten Objekte → `cloneState` ist eine flache Kopie.
  Neue Felder immer flach anlegen, sonst muss `cloneState` angepasst werden.
- Reihenfolge ist fest (Index 0 vor 1). Treffer beider Spieler werden erst gesammelt und dann
  gleichzeitig angewendet (kein Vorteil für P1).
- `state.events` (z. B. `hit`, `block`, `jump`, `land`, `ko`, `round`, `fight`) werden in jedem
  `step` neu befüllt; Koordinaten in Events sind ganze Pixel. main.js sammelt sie nach JEDEM
  Schritt ein (bei mehreren Schritten pro Bild gehen sonst welche verloren).
- `checksum` = FNV-1a (`Math.imul`) über `JSON.stringify(state)`.

### Spielschleife (src/main.js, src/pacing.js)
- Fester Takt 60 Ticks/s per `FrameClock` (pacing.js), max. 5 Schritte pro Bild. Rendering ist davon getrennt.
- `FrameClock` rastet Bildzeiten nahe 1/60 s bzw. 1/120 s exakt ein und hält den Accumulator nach Start,
  Pause und jedem Warten auf einem halben Schritt – sonst entsteht 0/2-Schritte-Ruckeln (Browser-Zeitstempel
  sind auf 0,1 ms gerundet). Nicht durch eine einfache `acc += dt`-Schleife ersetzen (tests/pacing.test.js).
- `session.tick()` gibt `false` zurück, wenn (online) eine Remote-Eingabe fehlt → es wird
  gewartet, nicht geraten.

### Rendering (src/render.js, src/poses.js)
- Liest den State nur. Screenshake, Partikel, Lebensbalken-Nachlauf, Kamera-Parallaxe gibt es
  NUR im Renderer (dürfen Zufall/Zeit/Trigonometrie benutzen).
- Interne Auflösung 960×540, Letterboxing über main.js `resize()`; Boden bei y = 470.

### Eingaben (src/buttons.js, src/input.js)
- Bitmaske pro Tick: UP=1, DOWN=2, LEFT=4, RIGHT=8, LIGHT=16, HEAVY=32, SPECIAL=64.
  Richtungen sind absolut; die sim rechnet vor/zurück über `facing` (links+rechts = nichts).
- Quellen mit `read() → Maske`: `KeyboardInput`, `GamepadInput`, `TouchInput` (Maske setzt
  touch.js), `NetworkInput` (Frame → Maske), `DummyInput`, `BotInput`; `combine()` verodert.
- Maustasten sind Pseudo-Codes `MouseLeft`/`MouseRight` im selben Tasten-Set (in `KEYS` nutzbar);
  Klicks auf Knöpfe/offene Menüs und Touch-Kompatibilitäts-Mausereignisse zählen nicht.
- Kurze Tipper werden gemerkt („latch“) und nach jedem `session.tick()` mit `clearInputLatch()` gelöscht.
- Anzeige der Tastenbelegung: `src/controls.js` (aus `KEYS`/`GAMEPAD`), Schalter `LOOK.SHOW_CONTROLS`.

### Online (src/lockstep.js, src/net.js, src/online.js)
- Delay-based Lockstep: lokale Eingabe für Frame `f + delay` einplanen, Frame `f` nur simulieren,
  wenn beide Eingaben da sind. Pakete enthalten alle unbestätigten Eingaben (mind. die letzten 8)
  + `ack`. Alle 60 Ticks Prüfsumme; bei Abweichung startet der Host die Runde neu (`sync`).
- lockstep.js ist transportunabhängig (Tests in Node mit simuliertem Netz), net.js kapselt PeerJS.
- Zeitabgleich: `in`-Pakete tragen `lf` (eigener Frame); `advantage` = geglätteter Vorsprung in Frames
  (inkl. Alter der Meldung über die injizierte Uhr `now`). `timeScale()` bremst/beschleunigt max. 3 %, erst ab
  1 Frame Vorsprung (Bruchteile = fester Bildschirm-Versatz, nicht regelbar). main.js multipliziert damit die Schrittlänge.
- HUD online: Ping, Verzögerung (+ Empfehlung aus Ping/Schwankung), Warten-%, FPS beider Geräte (`fps` im `ping`).
- Protokoll robust gegen Verlust, Duplikate und Vertauschung (DataConnection `reliable:false` =
  ungeordnet). Steuer-Nachrichten (`sync`, `desync`, `rematch`) werden wiederholt, bis sie wirken.
  Alles ist Session-nummeriert; `sync` (Host → Gast) startet Spiel, Rematch und Desync-Neustart.
- online.js: `OnlineLobby` (Raum erstellen/beitreten) und `OnlineSession` (hello/ping/pong/bye/busy,
  Abbruch nach `NET.DISCONNECT_TIMEOUT_MS`). Host = Spieler 1. Der Delay des Hosts gilt für beide.
- Spielwerte (`gameplayConfig()`) werden beim Verbinden per Hash verglichen (`CONFIG_HASH`).
- PeerJS wird erst im Online-Menü per CDN geladen (`NET.PEERJS_URLS`, Version fest gepinnt).

### Grafik-Details
- Posen in poses.js; Angriffs-Animationen werden aus `startup/active/recovery` abgeleitet.
  Neuer Angriff → Eintrag in `MOVES` (config.js) + `ATTACKS` (poses.js) + ggf. `KICKS` (render.js, Leuchtspur).
- `tests/poses.html` zeigt alle Posen mit Hitboxen nebeneinander.

### Spielschleife-Details
- `requestAnimationFrame` + `setTimeout`-Sicherheitsnetz (verdeckte Fenster/Tabs laufen weiter, wichtig online).
- Lokal/Training pausieren, wenn der Tab versteckt wird.

## URL-Parameter und Test-Hilfen
- `?debug` Hitboxen + Debug-Text, F9 erzwingt online einen Desync · `?join=CODE` tritt direkt bei ·
  `?autohost` erstellt sofort einen Raum · `?bot=SEED` online spielt ein Bot ·
  `?test` keine Auto-Pause, ungedrosselte Schleife (MessageChannel) auch im versteckten Tab.
- `window.streetBattle` (Konsole/Tests): `session`, `renderer`, `ui`, `lobby`, `freeze`,
  `frames(n)`, `until(cond)`, `key(code, down)`.
- `tests/online-test.html`: Host + Gast in iframes über echtes PeerJS mit Bots, zeigt Prüfsummen/Desyncs,
  klickt nach Match-Ende Rematch.

## Dateien
- `src/config.js` – ALLE Spielwerte (Frame-Daten, Schaden, Tempo, Hitboxen, Runden, Netz, Tasten, Farben)
- `src/sim.js` – Spiellogik · `src/buttons.js` – Bitmaske · `src/input.js` – Eingabequellen
- `src/sessions.js` – Lokal/Training/Demo · `src/main.js` – Start, Schleife, Menü-Verdrahtung
- `src/render.js`, `src/poses.js` – Grafik · `src/audio.js` – WebAudio-Sounds · `src/ui.js` – DOM-Menüs
- `src/touch.js` – Touch-Steuerung · `src/lockstep.js`, `src/net.js`, `src/online.js` – Online
- `tests/` – Node-Tests (`node:test`), `tests/online-test.html` – zwei Instanzen mit Bots über echtes PeerJS
- `tools/serve.js` – Mini-Webserver ohne Abhängigkeiten
- `sw.js` – Service Worker: eigene Dateien immer mit `cache: 'no-cache'` laden (GitHub Pages cacht sonst 10 Min.)

## Veröffentlichung
- Live: https://hiddenfactor.github.io/street-battle/ (GitHub Pages, Branch `main`, Ordner `/`).
- Repo-lokale Git-Identität ist anonym (`HiddenFactor`, noreply-Adresse) – nicht ändern, keine persönlichen Daten committen.
- Bei jedem Release `GAME_VERSION` erhöhen (wird im Menü angezeigt und online verglichen).

## Konventionen
- Keine npm-Abhängigkeiten. package.json nur für `"type": "module"` und Skripte.
- Nach Änderungen an sim.js/config.js immer `npm test` laufen lassen.
- Neue Spielwerte gehören in config.js (mit deutschem Kommentar und Einheit).
