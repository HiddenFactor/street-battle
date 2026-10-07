# STREET BATTLE

Ein 2D-Fighting-Game für den Browser – für zwei Spieler an einem Gerät oder **online gegeneinander**
(PC und Handy, auch gemischt). Alles ist mit Code gezeichnet, es gibt keine Bilddateien, keine Engine
und keinen Build-Schritt. Die einzige fremde Bibliothek ist [PeerJS](https://peerjs.com) für die
Online-Verbindung.

**Modi:** Lokal (2 Spieler) · Online (Raumcode) · Training (gegen einen Dummy)

**▶ Jetzt spielen: <https://hiddenfactor.github.io/street-battle/>**
(läuft über GitHub Pages – einfach diesen Link verschicken, der PC muss dafür nicht an sein)

---

## Steuerung

|                         | Spieler 1 | Spieler 2                 | Gamepad              | Handy                 |
|-------------------------|-----------|---------------------------|----------------------|-----------------------|
| Laufen/Springen/Ducken  | W A S D   | Pfeiltasten               | Steuerkreuz / Stick  | Steuerkreuz links     |
| Schneller Angriff       | **Linksklick** (oder F) | Nummernblock 1 (oder `,`) | X / □  | **L**                 |
| Starker Angriff (Kick)  | **Rechtsklick** (oder G) | Nummernblock 2 (oder `.`) | Y / △ | **S**                 |
| Special (Energieball)   | **Leertaste** (oder H) | Nummernblock 3 (oder `-`) | B / ○   | **★**                 |
| Pause                   | Esc oder P| Esc oder P                | Start                | ❚❚ oben in der Mitte  |

- **Blocken:** vom Gegner weg halten. Geduckt blocken gegen tiefe Tritte, stehend gegen Sprung-Angriffe.
- **Unten + Angriff** = tiefer Angriff (der starke tiefe Tritt wirft um). **In der Luft angreifen** = Sprung-Angriff.
- **In der Luft lenken:** Während eines Sprungs mit links/rechts die Flugbahn ändern.
- Die Tastenbelegung steht klein unten im Bild und im Hauptmenü. Unten links im Menü steht die Version (z. B. v1.1.0).
- Der schnelle Schlag lässt sich bei Kontakt direkt in den Energieball abbrechen (Combo!).
- **Training:** `T` wechselt den Dummy (stehen, ducken, blocken, springen), `F1` zeigt die Hitboxen.
  Oben links siehst du Schaden und „Frame-Vorteil“ deines letzten Treffers.
- Zwei Gamepads im Lokalmodus: Gamepad 1 steuert Spieler 1, Gamepad 2 steuert Spieler 2.
- Hinweis: Manche Tastaturen erkennen nicht beliebig viele gleichzeitig gedrückte Tasten. Wenn im
  Lokalmodus mal eine Taste „verschluckt“ wird, liegt das an der Tastatur – ein Gamepad hilft.

---

## 1. Lokal starten (Windows, einfachster Weg)

1. Doppelklick auf **`start.bat`**.
2. Ein schwarzes Fenster geht auf (das ist ein kleiner Webserver), und das Spiel öffnet sich im Browser.
3. Zum Beenden das schwarze Fenster schließen.

Du brauchst dafür **Node.js** (ist bei dir schon installiert; sonst „LTS“ von <https://nodejs.org>).

**Warum nicht einfach `index.html` doppelklicken?** Das Spiel besteht aus mehreren JavaScript-Modulen.
Browser laden solche Module aus Sicherheitsgründen nicht direkt von der Festplatte – sie brauchen einen
(Mini-)Webserver. Genau den startet `start.bat`.

Andere Wege, falls du magst:
- In VS Code die Erweiterung **„Live Server“** installieren → Rechtsklick auf `index.html` → „Open with Live Server“.
- Mit Python: im Spielordner `python -m http.server 8080` und dann <http://localhost:8080> öffnen.

**Am Handy im selben WLAN testen:** `start.bat` zeigt im schwarzen Fenster eine Zeile
„Im WLAN (z. B. Handy): http://192.168.…:8080/“. Diese Adresse am Handy öffnen. Fragt Windows beim ersten
Start, ob Node.js im Netzwerk erreichbar sein darf, „Private Netzwerke“ erlauben.

---

## 2. Online gegen deinen Bruder spielen

### So geht's
1. Beide öffnen das Spiel (am besten die hochgeladene Version, siehe Abschnitt 3).
2. **Du:** „Online spielen“ → **„Raum erstellen“**. Du bekommst einen Code aus 5 Zeichen, z. B. `K7QXM`.
3. **Dein Bruder:** „Online spielen“ → Code eintippen → **„Beitreten“**.
   Noch bequemer: Du drückst „Einladungslink kopieren“ und schickst ihm den Link – er tritt dann
   automatisch bei.
4. Los geht's! Wer den Raum erstellt hat, ist links (türkis), der andere rechts (violett). Über deiner Figur
   steht „DU“.

Oben in der Mitte siehst du den **Ping** (Laufzeit eurer Verbindung) und die **Eingabeverzögerung**.

### Wie funktioniert das?
Eure Geräte verbinden sich **direkt** miteinander (Peer-to-Peer über WebRTC). Ein kostenloser
PeerJS-Server hilft nur beim Kennenlernen. Danach schicken sich die Geräte nur noch die **Tastendrücke**
– beide rechnen das Spiel komplett selbst und kommen dadurch zum exakt gleichen Ergebnis
(„Lockstep“). Zur Kontrolle vergleichen sie jede Sekunde eine Prüfsumme. Weicht etwas ab (sehr selten),
erscheint **„DESYNC – Runde wird neu gestartet“** und die Runde beginnt neu (der Spielstand bleibt).

### Eingabeverzögerung einstellen
Im Online-Menü (Schieberegler, 1–8 Frames, Standard 3). Es gilt der Wert dessen, der den Raum erstellt.

| Ping       | Empfohlene Verzögerung |
|------------|------------------------|
| unter 40 ms (gleiches WLAN, gleiche Stadt) | 2 |
| 40–90 ms   | 3 (Standard) |
| 90–150 ms  | 4–5 |
| über 150 ms| 6–8 |

Zu niedrig = das Spiel stockt kurz („Warte auf Gegner …“). Zu hoch = die Figur reagiert träge.

### Wenn es nicht klappt
- **„Verbindung fehlgeschlagen“:** Manche **Mobilfunknetze** und Firmen-/Schul-WLANs blockieren
  Peer-to-Peer. Probiert es im Heim-WLAN, über einen **Handy-Hotspot**, oder tauscht, wer den Raum erstellt.
- **„Raum nicht gefunden“:** Code prüfen. Der Raum-Ersteller muss die Seite offen lassen.
- **„Verschiedene Versionen“:** Beide die Seite neu laden (F5). Hast du `config.js` geändert, muss dein
  Bruder dieselbe Version benutzen – also erst hochladen, dann spielen.
- **Spiel stockt:** Verzögerung erhöhen. Und: nicht den Browser-Tab wechseln – im Hintergrund bremst der
  Browser das Spiel aus (dein Gegner sieht dann „Gegner hat den Tab gewechselt“).

---

## 3. Kostenlos ins Internet stellen

Damit dein Bruder von zu Hause mitspielen kann, muss das Spiel im Internet liegen. Zwei kostenlose Wege:

### Weg A: GitHub Pages ✅ (ist bereits eingerichtet)

Das Spiel liegt schon online unter **<https://hiddenfactor.github.io/street-battle/>**
(Quellcode: <https://github.com/HiddenFactor/street-battle>). Die Commits sind anonymisiert: Für dieses
Projekt ist im Spielordner die anonyme GitHub-Adresse `…@users.noreply.github.com` eingestellt.

**Eine Änderung online stellen** (z. B. nach dem Balancing in `config.js`): im Spielordner ein Terminal
öffnen und eingeben:
```
git add -A
git commit -m "Balancing angepasst"
git push
```
Nach etwa 1 Minute ist die neue Version online. Danach laden beide Spieler die Seite neu (F5).
Ob die neue Version da ist, siehst du unten links im Hauptmenü (Versionsnummer `GAME_VERSION` in `config.js`
bei jedem Update erhöhen). Falls nicht: einmal **Strg+F5** drücken.

So würdest du es bei einem neuen Projekt selbst einrichten:
1. Konto anlegen auf <https://github.com> (kostenlos).
2. Oben rechts **„+“ → „New repository“**. Name z. B. `street-battle`, **Public** auswählen,
   **„Create repository“** klicken.
3. Dateien hochladen – zwei Möglichkeiten:
   - **Ohne Git (am einfachsten):** Auf der Seite des neuen Repositorys auf **„uploading an existing file“**
     klicken. Dann **den Inhalt** des Spielordners (nicht den Ordner selbst!) per Drag & Drop hineinziehen:
     `index.html`, `style.css`, `manifest.webmanifest`, `icon.svg`, `.nojekyll` und den Ordner `src`
     (die anderen Dateien schaden aber auch nicht). Unten **„Commit changes“** klicken.
     Hinweis: Dateien, die mit einem Punkt beginnen (`.nojekyll`), zeigt Windows evtl. nicht an – nicht
     schlimm, das Spiel läuft auch ohne.
   - **Mit Git** (dein Spielordner ist schon ein Git-Repository): im Spielordner ein Terminal öffnen und
     eingeben (DEINNAME durch deinen GitHub-Namen ersetzen):
     ```
     git remote add origin https://github.com/DEINNAME/street-battle.git
     git push -u origin main
     ```
4. Im Repository: **„Settings“ → links „Pages“**. Bei „Source“ **„Deploy from a branch“** wählen,
   Branch **`main`** und Ordner **`/ (root)`**, dann **„Save“**.
5. Nach 1–2 Minuten ist das Spiel erreichbar unter
   **`https://DEINNAME.github.io/street-battle/`** – diesen Link deinem Bruder schicken.
6. **Änderungen später:** Dateien einfach erneut hochladen (bzw. `git push`). Danach beide die Seite neu laden.

### Weg B: itch.io
1. Doppelklick auf **`tools/make-itch-zip.bat`**. Danach liegt `streetbattle-itch.zip` im Spielordner.
2. Konto anlegen auf <https://itch.io> (kostenlos).
3. Oben rechts auf deinen Namen → **„Upload new project“**.
4. Ausfüllen:
   - **Title:** Street Battle
   - **Kind of project:** **HTML**
   - **Uploads:** `streetbattle-itch.zip` hochladen und den Haken bei
     **„This file will be played in the browser“** setzen.
   - **Embed options:** Größe **960 × 540**, Haken bei **„Mobile friendly“** (Ausrichtung: Landscape) und bei
     **„Fullscreen button“**.
   - **Visibility & access:** **Public**, damit dein Bruder die Seite öffnen kann
     (mit „Draft“ siehst nur du das Spiel).
5. **„Save & view page“** – fertig. Den Link der Seite deinem Bruder schicken.
6. Online-Tipp für itch.io: Schick deinem Bruder lieber den **Raumcode** statt des Einladungslinks
   (itch.io zeigt das Spiel in einem Rahmen an, der Link führt dann zur nackten Spieldatei).

---

## 4. Balancing: Werte in `src/config.js` ändern

Alle Spielwerte stehen in **`src/config.js`** – mit Kommentaren. Datei mit einem Texteditor (z. B. VS Code)
öffnen, Zahl ändern, speichern, im Browser **F5** drücken.

**Wichtig:** Das Spiel läuft mit **60 Frames pro Sekunde**. „30 Frames“ heißt also eine halbe Sekunde.

| Wo                        | Wert                          | Bedeutung |
|---------------------------|-------------------------------|-----------|
| `FIGHTER.MAX_HP`          | 100                           | Lebenspunkte |
| `FIGHTER.WALK_FORWARD` / `WALK_BACK` | 3.4 / 2.6         | Lauftempo (Pixel pro Frame) |
| `FIGHTER.JUMP_VELOCITY`   | 15                            | Sprungkraft (höher = höher springen) |
| `FIGHTER.GRAVITY`         | 0.75                          | Schwerkraft (höher = kürzere Sprünge) |
| `FIGHTER.AIR_CONTROL`     | 0.7                           | Lenken in der Luft (0 = aus, 0.3 = leicht, 0.7 = stark) |
| `FIGHTER.AIR_MAX_SPEED`   | 4.8                           | höchstes Seitwärts-Tempo in der Luft |
| `MOVES.lightStand` usw.   | `damage`                      | Schaden des Angriffs |
|                           | `startup`                     | Frames bis der Angriff trifft (kleiner = schneller) |
|                           | `active`                      | wie lange der Angriff treffen kann |
|                           | `recovery`                    | Erholung danach – in der Zeit ist man verwundbar |
|                           | `hitstun` / `blockstun`       | wie lange der Gegner nach Treffer/Block festsitzt |
|                           | `hitstop`                     | kurzes Standbild beim Treffer („Wucht“) |
|                           | `knockback`                   | wie weit der Gegner zurückrutscht |
|                           | `hitbox`                      | wo und wie groß der Angriff trifft (mit F1 im Training sichtbar) |
| `MOVES.special.cooldown`  | 120                           | Wartezeit bis zum nächsten Energieball (120 = 2 Sekunden) |
| `MOVES.special.speed`     | 6.5                           | Flugtempo des Energieballs |
| `COMBAT.COMBO_SCALING`    | 10                            | jeder weitere Combo-Treffer macht 10 % weniger Schaden |
| `COMBAT.INPUT_BUFFER`     | 5                             | wie viele Frames ein zu früh gedrückter Knopf gemerkt wird |
| `ROUND.TIME_SECONDS`      | 99                            | Rundenzeit |
| `ROUND.ROUNDS_TO_WIN`     | 2                             | 2 = Best of 3, 3 = Best of 5 |
| `NET.DEFAULT_DELAY`       | 3                             | Standard-Eingabeverzögerung online |
| `KEYS`                    |                               | Tastenbelegung |
| `LOOK.PLAYERS`            |                               | Farben der Kämpfer (ändert nichts am Spielablauf) |
| `LOOK.SCREEN_SHAKE` / `PARTICLES` | 1.0                   | Bildschirmwackeln und Partikelmenge (0 = aus) |
| `LOOK.SHOW_CONTROLS`      | true                          | Tastenbelegung klein unten im Bild anzeigen (`false` = aus) |

Beispiel: Der Energieball ist zu stark? Setze `cooldown: 180` (3 Sekunden) oder `damage: 7`.

**Faustregel „Frame-Vorteil“:** `hitstun − (active + recovery)` ungefähr. Positiv heißt: Nach deinem
Treffer bist du zuerst wieder dran. Im Training wird der genaue Wert oben links angezeigt.

Nach Änderungen kannst du prüfen, ob noch alles funktioniert (siehe „Tests“). Online müssen beide
Spieler dieselbe `config.js` haben – das Spiel prüft das beim Verbinden.

---

## 5. Tests und Werkzeuge

Im Spielordner ein Terminal öffnen und eingeben:

```
npm test
```

Das prüft u. a.:
- **Determinismus:** gleiche Eingaben → exakt gleicher Spielzustand (auch über 10.000 Frames mit
  Zufallseingaben). Das ist die Grundlage fürs Online-Spiel.
- **Kampfsystem:** Treffer-Timing, Blocken, Energieball, K.O., Zeitablauf, Best of 3, Training.
- **Netcode:** zwei simulierte Geräte mit schlechtem Netz (Verzögerung, verlorene und vertauschte Pakete),
  Desync-Erkennung und Rematch.

Einzeln geht z. B. `node tests/determinism.test.js`.

Für Neugierige (über den lokalen Server öffnen):
- <http://localhost:8080/tests/online-test.html> – zwei Spiele verbinden sich übers Internet und zwei
  Computer-Kämpfer spielen gegeneinander. Zeigt Ping, Prüfsummen und Desyncs.
- <http://localhost:8080/tests/poses.html> – alle Körperhaltungen der Figur mit Hitboxen.
- <http://localhost:8080/?debug> – Spiel mit eingeblendeten Hitboxen und Debug-Infos.

---

## Rechtliches / Herkunft

- **Alles selbst gemacht:** Figuren, Hintergrund, Effekte und Logo werden komplett per Code gezeichnet;
  alle Sounds werden live per WebAudio erzeugt. Es gibt keine fremden Bilder, Sprites, Schriftdateien,
  Musik- oder Sprachaufnahmen. Benutzt werden nur Standard-Schriften des Geräts.
- **Eigener Stil:** Farben der Kämpfer, der einhändige Energieball-Wurf und das Neon-Logo sind bewusst
  nicht an bekannte Spielfiguren oder Logos angelehnt. Begriffe wie „FIGHT!“, „K.O.“ oder „Energieball“
  sind allgemeine Genre-Begriffe.
- **Fremder Code:** nur [PeerJS](https://github.com/peers/peerjs) (MIT-Lizenz), wird beim Online-Spiel
  vom CDN geladen; dazu der kostenlose PeerJS-Vermittlungsserver.
- **Name:** „Street Battle“ ist ein Arbeitstitel. Ob ein Name markenrechtlich frei ist, lässt sich in den
  Registern von DPMA (Deutschland) und EUIPO (EU) nachsehen – das hier ist keine Rechtsberatung.

## Dateien im Überblick

| Datei | Inhalt |
|---|---|
| `index.html`, `style.css` | Seite, Menüs, Touch-Knöpfe |
| `src/config.js` | **alle Spielwerte** |
| `src/sim.js` | die Spiellogik (Bewegung, Treffer, Runden) – rechnet nur mit ganzen Zahlen |
| `src/render.js`, `src/poses.js` | Grafik: Hintergrund, Figuren, Effekte, Anzeigen |
| `src/audio.js` | Soundeffekte (werden live erzeugt) |
| `src/input.js`, `src/touch.js` | Tastatur, Gamepad, Touch |
| `src/lockstep.js`, `src/net.js`, `src/online.js` | Online-Spiel |
| `src/main.js`, `src/sessions.js`, `src/ui.js` | Spielschleife, Modi, Menüs |
| `tests/` | automatische Tests und Test-Seiten |
| `tools/serve.js` | der kleine Webserver für `start.bat` |
| `CLAUDE.md` | Architektur-Regeln für die Weiterentwicklung |
