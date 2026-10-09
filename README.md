# STREET BATTLE

Ein 2D-Fighting-Game für den Browser – für zwei Spieler an einem Gerät oder **online gegeneinander**
(PC und Handy, auch gemischt). Alles ist mit Code gezeichnet, es gibt keine Bilddateien, keine Engine
und keinen Build-Schritt. Die einzige fremde Bibliothek ist [PeerJS](https://peerjs.com) für die
Online-Verbindung.

**Modi:** Lokal (2 Spieler) · Online (deine feste Lobby per Link) · Training (gegen einen Dummy)
**Kämpfer:** Funke · Fels · Wiesel · Luchs · Komet · Anker – Auswahl vor jedem Match

**▶ Jetzt spielen: <https://hiddenfactor.github.io/street-battle/>**
(läuft über GitHub Pages – einfach diesen Link verschicken, der PC muss dafür nicht an sein)

---

## Die Kämpfer

| Kämpfer | Typ | Stärken / Schwächen | Special (Leertaste) |
|---|---|---|---|
| **Funke** | Allrounder | ausgewogen | **Energieball** – fliegt quer über die Arena |
| **Fels** | Kraftpaket | mehr Leben, Schaden und Reichweite – aber langsam, niedriger Sprung | **Erdstoß** – Druckwelle über den Boden, nur **geduckt** blockbar (oder drüberspringen) |
| **Wiesel** | flink | schnell, **Doppelsprung**, starkes Lenken in der Luft – aber weniger Leben und Schaden | **Blitztritt** – Sprint-Tritt, wirft um; geblockt ist man lange angreifbar |
| **Luchs** | Konter | flott, wartet auf Fehler des Gegners | **Konter** – fängt kurz jeden Schlag, Tritt und jedes Geschoss ab und schlägt sofort zurück. Gegen Griffe hilft er nicht, ins Leere ist man kurz offen |
| **Komet** | Fernkämpfer | guter Springer, gefährlich auf Abstand | **Sternwurf** – Stern im hohen Bogen, kommt von oben: nur **stehend** blockbar. Mit zurück/vorne gehalten wirft man kurz/weit |
| **Anker** | Ringer | am meisten Leben, groß und stark – aber am langsamsten | **Klammergriff** – packt aus der Nähe und wirft um, **Blocken hilft nicht**. Packt keine springenden Gegner; daneben gegriffen ist man lange offen |

**Auswahl:** Vor jedem Match wählen beide ihren Kämpfer (Spieler 1: W A S D + F, Spieler 2: Pfeiltasten + Num 1,
oder auf eine Karte klicken/tippen). Unter den Karten steht, was der Kämpfer kann. Wählen beide denselben, bekommt Spieler 2 eine andere Farbe.
Im Training wählst du erst dich, dann den Dummy. Nach dem Match: „Rematch“ (gleiche Kämpfer) oder
„Charakterwahl“. Online sieht jeder, was der andere gerade wählt.

---

## Steuerung

|                         | Spieler 1 | Spieler 2                 | Gamepad              | Handy                 |
|-------------------------|-----------|---------------------------|----------------------|-----------------------|
| Laufen/Springen/Ducken  | W A S D   | Pfeiltasten               | Steuerkreuz / Stick  | Steuerkreuz links     |
| Schneller Angriff       | **Linksklick** (oder F) | Nummernblock 1 (oder `,`) | X / □  | **L**                 |
| Starker Angriff (Kick)  | **Rechtsklick** (oder G) | Nummernblock 2 (oder `.`) | Y / △ | **S**                 |
| Special (je Kämpfer)    | **Leertaste** (oder H) | Nummernblock 3 (oder `-`) | B / ○   | **★**                 |
| Dash (kurzer Sprint)    | **C**     | Nummernblock 0 (oder `M`) | LB / L1              | **»**                 |
| Pause                   | Esc oder P| Esc oder P                | Start                | ❚❚ oben in der Mitte  |

- **Blocken:** vom Gegner weg halten. Geduckt blocken gegen tiefe Tritte, stehend gegen Sprung-Angriffe.
- **Unten + Angriff** = tiefer Angriff (der starke tiefe Tritt wirft um). **In der Luft angreifen** = Sprung-Angriff.
- **In der Luft lenken:** Während eines Sprungs mit links/rechts die Flugbahn ändern.
- **Doppelsprung (nur Wiesel):** in der Luft nochmal „hoch“ drücken.
- **Dash:** schneller Schritt nach vorn, mit „zurück“ gehalten nach hinten. Währenddessen kann man weder
  angreifen noch blocken – gut zum Heranstürmen oder Ausweichen, aber riskant.
- Die Tastenbelegung steht klein unten im Bild und im Hauptmenü. Unten links im Menü steht die Version (z. B. v2.1.0).
- Der schnelle Schlag lässt sich bei Kontakt direkt ins Special abbrechen (Combo!).
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

### So geht's (Test: feste Lobby)
1. **Du:** „Online spielen“ → **„Lobby öffnen“**. Es erscheint dein Einladungslink, z. B.
   `…/street-battle/?join=AB3CD7EF`.
2. **Einmal** auf „Einladungslink kopieren“ drücken und deinem Bruder schicken. **Der Link bleibt immer gleich** –
   er kann ihn sich speichern und beim nächsten Mal einfach wieder antippen.
3. **Dein Bruder:** öffnet den Link – und ist direkt in deiner Lobby. Ist sie noch nicht offen, wartet das
   Spiel einfach („Die Lobby ist noch nicht offen …“) und verbindet sich, sobald du sie öffnest.
4. Beide wählen ihren Kämpfer, dann geht's los! Wer die Lobby geöffnet hat, ist links, der andere rechts.
   Über deiner Figur steht „DU“.

Gut zu wissen:
- Der Lobby-Code wird nur **auf deinem Gerät** gespeichert. PC und Handy haben also je einen eigenen Link.
- Nur wer deinen Link hat, kommt rein (der Code ist 8 Zeichen lang und nicht zu erraten). Ist schon jemand drin,
  bekommt ein Dritter „Raum ist voll“.
- **„Neuer Link“** erzeugt einen neuen Code – der alte Link gilt dann nicht mehr (z. B. falls er in falsche
  Hände geraten ist).
- **Zurück zum alten System** (jedes Mal ein neuer 5-stelliger Raum-Code, Beitreten per Code-Eingabe):
  in `src/config.js` bei `NET` den Wert `FIXED_LOBBY: false` setzen.

Oben in der Mitte steht eine Info-Zeile, z. B. `Ping 7 ms · Verzögerung 2 · Warten 0 % · FPS 60/60`:
- **Ping:** Laufzeit eurer Verbindung (hin und zurück).
- **Verzögerung:** eingestellte Eingabeverzögerung; steht dahinter `(empf. 3)`, ist ein anderer Wert besser.
- **Warten:** wie oft das Spiel in der letzten Sekunde auf den Gegner warten musste. Über 1 % → Verzögerung erhöhen.
- **FPS:** Bilder pro Sekunde bei dir / beim Gegner. Deutlich unter 60 → das Gerät ist zu langsam
  (oft Stromsparmodus am Handy – den ausschalten). Grün = alles gut, gelb = grenzwertig, rot = schlecht.

### Wie funktioniert das?
Eure Geräte verbinden sich **direkt** miteinander (Peer-to-Peer über WebRTC). Ein kostenloser
PeerJS-Server hilft nur beim Kennenlernen. Danach schicken sich die Geräte nur noch die **Tastendrücke**
– beide rechnen das Spiel komplett selbst und kommen dadurch zum exakt gleichen Ergebnis
(„Lockstep“). Zur Kontrolle vergleichen sie jede Sekunde eine Prüfsumme. Weicht etwas ab (sehr selten),
erscheint **„DESYNC – Runde wird neu gestartet“** und die Runde beginnt neu (der Spielstand bleibt).

### Eingabeverzögerung einstellen
Im Online-Menü (Schieberegler, 1–8 Frames, Standard 3). Es gilt der Wert dessen, der die Lobby öffnet.

| Ping       | Empfohlene Verzögerung |
|------------|------------------------|
| unter 40 ms (gleiches WLAN, gleiche Stadt) | 2 |
| 40–90 ms   | 3 (Standard) |
| 90–150 ms  | 4–5 |
| über 150 ms| 6–8 |

Verzögerung 1 ist im WLAN fast immer zu knapp (kleine Schwankungen erzeugen dann Mini-Hänger) –
nur für Kabelverbindungen gedacht. Das Spiel gleicht außerdem automatisch aus, dass zwei Geräte nie exakt
gleich schnell laufen (leicht bremsen/beschleunigen statt anzuhalten).

Zu niedrig = das Spiel stockt kurz („Warte auf Gegner …“). Zu hoch = die Figur reagiert träge.

### Wenn es nicht klappt
- **„Verbindung fehlgeschlagen“:** Manche **Mobilfunknetze** und Firmen-/Schul-WLANs blockieren
  Peer-to-Peer. Probiert es im Heim-WLAN, über einen **Handy-Hotspot**, oder tauscht, wer die Lobby öffnet.
- **Dein Bruder wartet ewig:** Ist deine Lobby offen (Bildschirm „Deine Lobby ist offen“)? Hat er den
  richtigen Link (von dem Gerät, auf dem du gerade spielst)?
- **„Lobby schon offen“:** Deine Lobby ist noch in einem anderen Tab/Fenster offen – das schließen.
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
6. Online-Tipp für itch.io: Dort führt der Einladungslink zur nackten Spieldatei (itch.io zeigt das Spiel in
   einem Rahmen an). Für itch.io daher `FIXED_LOBBY: false` setzen und den **Raumcode** schicken.

---

## 4. Balancing: Werte in `src/config.js` ändern

Alle Spielwerte stehen in **`src/config.js`** – mit Kommentaren. Datei mit einem Texteditor (z. B. VS Code)
öffnen, Zahl ändern, speichern, im Browser **F5** drücken.

**Wichtig:** Das Spiel läuft mit **60 Frames pro Sekunde**. „30 Frames“ heißt also eine halbe Sekunde.
Alle Werte gelten fürs **Grundtempo** – `GAME_SPEED` rechnet sie aufs eingestellte Tempo um.

| Wo                        | Wert                          | Bedeutung |
|---------------------------|-------------------------------|-----------|
| `GAME_SPEED`              | 1.1                           | **Spieltempo** für alles (1 = Grundtempo, 1.1 = 10 % schneller). Sprunghöhe und Reichweiten bleiben gleich, nur schneller |
| `FIGHTER.MAX_HP`          | 100                           | Lebenspunkte (Grundwert – Charaktere können eigene haben) |
| `FIGHTER.WALK_FORWARD` / `WALK_BACK` | 3.4 / 2.6         | Lauftempo (Pixel pro Frame) |
| `FIGHTER.JUMP_VELOCITY`   | 15                            | Sprungkraft (höher = höher springen) |
| `FIGHTER.GRAVITY`         | 0.75                          | Schwerkraft (höher = kürzere Sprünge) |
| `FIGHTER.AIR_CONTROL`     | 0.7                           | Lenken in der Luft (0 = aus, 0.3 = leicht, 0.7 = stark) |
| `FIGHTER.AIR_MAX_SPEED`   | 4.8                           | höchstes Seitwärts-Tempo in der Luft |
| `FIGHTER.DASH_SPEED` / `BACKDASH_SPEED` | 9 / 7.5         | Tempo des Dashs vor/zurück (Pixel pro Frame) |
| `FIGHTER.DASH_FRAMES` / `DASH_RECOVERY` | 12 / 6          | wie lange man gleitet / danach kurz steht |
| `MOVES.lightStand` usw.   | `damage`                      | Schaden des Angriffs |
|                           | `startup`                     | Frames bis der Angriff trifft (kleiner = schneller) |
|                           | `active`                      | wie lange der Angriff treffen kann |
|                           | `recovery`                    | Erholung danach – in der Zeit ist man verwundbar |
|                           | `hitstun` / `blockstun`       | wie lange der Gegner nach Treffer/Block festsitzt |
|                           | `hitstop`                     | kurzes Standbild beim Treffer („Wucht“) |
|                           | `knockback`                   | wie weit der Gegner zurückrutscht |
|                           | `hitbox`                      | wo und wie groß der Angriff trifft (mit F1 im Training sichtbar) |
| `MOVES.special.cooldown`  | 120                           | Wartezeit bis zum nächsten Energieball (120 = 2 Sekunden im Grundtempo) |
| `MOVES.stomp` / `dashKick` / `counter` / `arc` / `grab` |  | Specials von Fels, Wiesel, Luchs, Komet und Anker |
| `MOVES.counter.active`    | 17                            | so lange fängt Luchs' Konter Angriffe ab |
| `MOVES.arc.speedNear` / `speed` / `speedFar` | 3 / 5 / 7  | Wurfweite des Sterns (zurück / neutral / vorne gehalten) |
| `MOVES.grab.damage`       | 15                            | Schaden des Klammergriffs |
| `CHARACTERS.fels.hp` usw. | 95 … 115                      | Leben je Charakter |
| `CHARACTERS.….damageScale`| 90 … 108                      | Schaden in Prozent (100 = normal) |
| `CHARACTERS.….size`       | 0.98 … 1.06                   | Körpergröße – ändert auch die Reichweite! |
| `CHARACTERS.….moves`      |                               | einzelne Angriffe eines Charakters ändern, z. B. `{ lightStand: { startup: 3 } }` |
| `CHARACTERS.wiesel.airJumps` | 1                          | Sprünge in der Luft (0 = kein Doppelsprung) |
| `MOVES.special.speed`     | 6.5                           | Flugtempo des Energieballs |
| `COMBAT.COMBO_SCALING`    | 10                            | jeder weitere Combo-Treffer macht 10 % weniger Schaden |
| `COMBAT.INPUT_BUFFER`     | 5                             | wie viele Frames ein zu früh gedrückter Knopf gemerkt wird |
| `ROUND.TIME_SECONDS`      | 99                            | Rundenzeit |
| `ROUND.ROUNDS_TO_WIN`     | 2                             | 2 = Best of 3, 3 = Best of 5 |
| `NET.DEFAULT_DELAY`       | 3                             | Standard-Eingabeverzögerung online |
| `KEYS`                    |                               | Tastenbelegung |
| `CHARACTERS.….look.palettes` |                            | Farben der Kämpfer (2. Farbe = gleiche Wahl) |
| `LOOK.PLAYERS`            |                               | Kennfarben von Spieler 1/2 (Namen, Markierungen) |
| `LOOK.SCREEN_SHAKE` / `PARTICLES` | 1.0                   | Bildschirmwackeln und Partikelmenge (0 = aus) |
| `LOOK.SHOW_CONTROLS`      | true                          | Tastenbelegung klein unten im Bild anzeigen (`false` = aus) |

Beispiel: Der Energieball ist zu stark? Setze `cooldown: 180` (3 Sekunden) oder `damage: 7`.

**Charaktere ausbalancieren:** Die jetzigen Werte sind mit vielen Computer-Kämpfen abgestimmt (jede
Paarung gewinnt etwa 45–55 %). Schon wenige Prozent bei `hp`, `damageScale` oder `size` machen viel aus –
lieber in kleinen Schritten ändern und ausprobieren.

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
- **Kampfsystem:** Treffer-Timing, Blocken, Specials aller Kämpfer, Spieltempo, K.O., Zeitablauf, Best of 3, Training.
- **Netcode:** zwei simulierte Geräte mit schlechtem Netz (Verzögerung, verlorene und vertauschte Pakete),
  Desync-Erkennung und Rematch.

Einzeln geht z. B. `node tests/determinism.test.js`.

Für Neugierige (über den lokalen Server öffnen):
- <http://localhost:8080/tests/online-test.html> – zwei Spiele verbinden sich übers Internet und zwei
  Computer-Kämpfer spielen gegeneinander. Zeigt Ping, Prüfsummen und Desyncs.
- <http://localhost:8080/tests/poses.html> – alle Körperhaltungen der Figur mit Hitboxen
  (`?char=luchs` für einen anderen Kämpfer, `?lineup` zeigt alle Kämpfer in beiden Farben).
- <http://localhost:8080/?debug> – Spiel mit eingeblendeten Hitboxen und Debug-Infos.

---

## Rechtliches / Herkunft

- **Alles selbst gemacht:** Figuren, Hintergrund, Effekte und Logo werden komplett per Code gezeichnet;
  alle Sounds werden live per WebAudio erzeugt. Es gibt keine fremden Bilder, Sprites, Schriftdateien,
  Musik- oder Sprachaufnahmen. Benutzt werden nur Standard-Schriften des Geräts.
- **Eigener Stil:** Alle sechs Kämpfer, ihre Farben, der einhändige Energieball-Wurf und das Neon-Logo
  sind bewusst nicht an bekannte Spielfiguren oder Logos angelehnt. Begriffe wie „FIGHT!“, „K.O.“ oder „Energieball“
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
| `src/select.js` | der Auswahl-Bildschirm für die Kämpfer |
| `src/render.js`, `src/poses.js` | Grafik: Hintergrund, Figuren, Effekte, Anzeigen |
| `src/audio.js` | Soundeffekte (werden live erzeugt) |
| `src/input.js`, `src/touch.js` | Tastatur, Gamepad, Touch |
| `src/lockstep.js`, `src/net.js`, `src/online.js` | Online-Spiel |
| `src/main.js`, `src/sessions.js`, `src/ui.js` | Spielschleife, Modi, Menüs |
| `tests/` | automatische Tests und Test-Seiten |
| `tools/serve.js` | der kleine Webserver für `start.bat` |
| `CLAUDE.md` | Architektur-Regeln für die Weiterentwicklung |
