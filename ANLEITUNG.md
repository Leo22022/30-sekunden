# 30 Sekunden – Web-App für Spieleabende

## Ziel
Eine mobile Web-App für ein Team-Erklärspiel (ähnlich Tabu / 30 Seconds). Ein Handy wird reihum weitergegeben. Die App übernimmt Timer, Kartenwechsel, Punktestand und Begriffe-Log. Die App läuft komplett im Browser, ohne Backend und ohne Installation.

## Technik
- HTML, CSS und Vanilla JavaScript, kein Framework.
- Mobile-first, Bedienung mit einer Hand im Hochformat.
- Begriffe in der lokalen Datei `data/begriffe.json`.
- Spielstand in `localStorage`, damit ein Spiel nach Neuladen nicht verloren geht. Eine angefangene Runde zählt nach dem Neuladen nicht.
- Sound (Glöckchen) über die Web Audio API.
- Später optional als PWA installierbar. In dieser Phase nicht nötig.
- Zielgerät ist ein iPhone 16 Pro (402 × 874 Punkte, Safari):
  - Abstände berücksichtigen Dynamic Island und Home-Balken (`env(safe-area-inset-…)`).
  - Über „Teilen → Zum Home-Bildschirm“ läuft die App im Vollbild ohne Safari-Leisten.
  - Die Glocke soll auch bei umgelegtem Stummschalter klingen (`navigator.audioSession`).
  - Der Bildschirm bleibt während des Spiels an (Wake Lock). Das geht nur über https oder localhost.

Starten: im Projektordner `npx serve` ausführen und die angezeigte Adresse öffnen. Ein Doppelklick auf `index.html` reicht nicht, weil der Browser die Begriffe-Datei dann nicht laden darf.

## Spielablauf

### Einstellungen (Startbildschirm)
- Teamnamen eingeben (Standard: „Team 1“ und „Team 2“).
- Zielpunktzahl wählen: 20, 30, 40, 50 oder 100 (Standard: 30).
- Start-Button.

### Runde
1. Die Runde beginnt mit dem Bildschirm „Team X ist dran“. Der Spieler tippt einmal auf den Bildschirm, um zu bestätigen.
2. Ein weiteres Tippen startet einen 3-Sekunden-Countdown, danach läuft der 30-Sekunden-Timer.
3. Es wird eine Karte angezeigt (siehe „Kartenlogik“).
4. Nach 30 Sekunden stoppt die Runde sofort. Die laufende Karte zählt nicht.
5. Eine Glöckchen-Animation und ein Sound zeigen das Rundenende an.
6. Auf demselben Bildschirm steht „Weiterreichen an Team X“.
7. Das Handy wird weitergegeben. Danach beginnt die nächste Runde mit Schritt 1.

### Kartenlogik
- Jede Karte zeigt **3 Begriffe** (Standard). Die Anzahl steht zentral in der Konstante `BEGRIFFE_PRO_KARTE` in `app.js`, damit man später auch 5 Begriffe pro Karte testen kann.
- **Kein Begriff ist hervorgehoben.** Alle angezeigten Begriffe sehen gleich aus.
- Zu jeder Karte ist **nur ein Begriff gültig**. Der Spieler erklärt einen der Begriffe, nicht alle. Die Logik gilt pro Karte, nicht pro Begriff.
- Der Spieler tippt nicht auf einzelne Begriffe:
  - **Linke Bildschirmhälfte** = „Richtig“: +1 Punkt, der erratene Begriff kommt in den Log, nächste Karte.
  - **Rechte Bildschirmhälfte** = „Weiter“: Karte überspringen, kein Punkt, nächste Karte.
- Welchen der Begriffe er erklärt, sucht sich der Erklärer frei aus.
- Karten stehen nicht fest, sondern werden bei jedem Ziehen **dynamisch** aus dem gemischten Pool zusammengesetzt.
- Begriffe einer als „Richtig“ gewerteten Karte gelten alle als verbraucht und kommen erst wieder, wenn der Pool erschöpft ist.
- Begriffe einer **übersprungenen** Karte (und der Karte, die beim Ablauf der Zeit offen lag) gehen zurück in den Pool und können im laufenden Spiel neu gemischt auf späteren Karten auftreten.
- **Zuordnung für den Log:** Nach der Runde, ohne Zeitdruck, zeigt der Rundenende-Bildschirm jede gewertete Karte. Der Spieler tippt den erklärten Begriff an. Das ist überspringbar; dann steht die ganze Karte im Log.

### Zwischenstand
- Nach jeder vollen Runde (beide Teams waren einmal dran) erscheint ein Zwischenstand mit Punkten beider Teams.
- Von dort geht es mit „Weiter“ in die nächste Runde.

### Begriffe-Log
- Nach jeder Runde sieht man, was in dieser Runde als richtig gewertet wurde.
- Der Log ist über den gesamten Spielverlauf über den Button „Log“ abrufbar (nicht während einer laufenden Runde).

### Spielende und Tiebreaker
- Erreicht ein Team den Zielwert, endet seine Runde sofort mit Glocke. Der Punktestand bleibt beim Zielwert stehen.
- **Es gibt keine zusätzliche Nachziehrunde.** Team 1 beginnt jede Runde; erreicht es das Ziel, spielt Team 2 noch seine normale Runde. Damit haben beide gleich oft gespielt.
- Nach jeder vollen Runde wird abgerechnet:
  - Nur ein Team am Ziel → dieses Team gewinnt. (Erreicht Team 2 das Ziel, während Team 1 es nicht hat, ist das Spiel sofort entschieden.)
  - Beide am Ziel → **Stechrunde**. Das kann nur Team 2 auslösen, indem es in seiner Runde gleichzieht.
- Stechrunde:
  - Beide Teams starten bei 0 und spielen je eine 60-Sekunden-Runde. Wer beginnt, wird ausgelost.
  - Wer mehr Karten schafft, gewinnt. Bei Gleichstand wird wiederholt, mit neuer Auslosung.
  - Die Stechrunde hat einen eigenen Zähler und entscheidet allein über den Gewinner.
- Am Ende: Siegerbildschirm mit Endstand und Button „Neues Spiel“.

## Begriffspool

### Format
Datei `data/begriffe.json`, Array von Objekten:

```json
[
  { "id": 1, "begriff": "Starbucks", "kategorie": "Marke" },
  { "id": 2, "begriff": "Baumkrone", "kategorie": "Zusammengesetzt" }
]
```

### Umfang und Verteilung
Mindestens **600 Begriffe**, aktuell 695. Richtwerte pro Kategorie:

| Kategorie | Anzahl |
|---|---|
| Marken (Deutsch und Englisch, z. B. Starbucks, PlayStation) | 60 |
| Filme | 50 |
| Serien | 30 |
| Musik (Songs, Bands, Alben, Musiker) | 60 |
| Bücher und Autoren | 40 |
| Spiele und Konsolen | 30 |
| Personen (bekannte Persönlichkeiten) | 50 |
| Essen und Getränke | 60 |
| Tiere | 30 |
| Orte (Städte, Länder, Sehenswürdigkeiten) | 40 |
| Alltagsgegenstände | 60 |
| Zusammengesetzte Wörter (z. B. Baumkrone, Eisbein, Eiswürfel, Skigebiet) | 60 |
| Sport | 30 |
| Technik und Apps | 30 |
| Natur und Wetter | 25 |
| Berufe | 20 |
| Redewendungen und Alltagsbegriffe | 20 |

### Regeln für die Begriffe
- Alltagsnah und sofort verständlich. Kein Spezialwissen nötig.
- Gut in 30 Sekunden erklärbar. Keine Begriffe, die man nur mit langen Umschreibungen erklären kann.
- Keine Dopplungen, auch nicht in Schreibvarianten.
- Eindeutig: keine Wörter mit sehr vielen Bedeutungen, außer die gängige Bedeutung ist klar.
- Keine Schimpfwörter, keine politisch oder religiös heiklen Begriffe, keine Gewalt- oder Sexthemen.
- Deutsch und Englisch gemischt. Englische Marken und Begriffe sind ausdrücklich erlaubt.
- Kategorie für jeden Begriff angeben, damit man die Verteilung prüfen kann.

## Prüfung vor dem Layout

Vor jeder weiteren optischen Gestaltung (Design, Farben, Schriften, Animationen) wird der Spielmodus geprüft, und zwar am Spielablauf, nicht am Code:

1. **Spielbarkeit:** kompletter Ablauf aus Sicht eines Spielers mit einem Handy in der Hand.
2. **Durchsetzbarkeit:** Sind die Regeln eindeutig, sind Sonderfälle geregelt?
3. **Rückfragen:** alle offenen Punkte gesammelt, jeweils mit Vorschlag.
4. **Warten:** Das Layout wird erst nach Beantwortung der Rückfragen angefasst.

### Stand der Prüfung

**(a) Geprüft, ohne Problem**
- Rundenstart: Zwei Tipps (bestätigen, dann starten) sind beschriftet; der Countdown gibt Zeit, das Handy richtig zu halten.
- Teamwechsel: Nach jeder Runde steht der Name des nächsten Teams auf dem Bildschirm, danach nochmals „Team X ist dran“.
- Tempo: Drei Begriffe lesen und einen wählen kostet etwa 2 Sekunden, Erklären und Raten 3–5. Das ergibt etwa 4–6 Karten in 30 Sekunden, bei Ziel 30 also rund 6 Runden je Team.
- Zeit läuft während eines Tipps ab: Ein Tipp zählt, wenn er vor Ablauf ankommt, danach nicht mehr.
- Ziel in der letzten Sekunde erreicht: zählt wie jeder andere Punkt, solange der Tipp vor Ablauf ankommt.
- Punktezählung: Der normale Punktestand zählt höchstens bis zum Zielwert, die Stechrunde hat einen eigenen Zähler.

**(b) und (c) Rückfragen – entschieden am 10.10.2026**

1. **Gültiger Begriff:** Der Erklärer sucht sich frei einen der drei aus.
2. **Zuordnung für den Log:** nach der Runde antippen, überspringbar.
3. **Nachziehen:** keine zusätzliche Runde. Nur Team 2 kann die Verlängerung auslösen, weil Team 1 beginnt und sonst eine Runde mehr gespielt hätte.
4. **Ziel mitten in der Runde:** Die Runde endet sofort.
5. **Nicht erklärte Begriffe einer gewerteten Karte:** gelten als verbraucht.
6. **Stechrunde:** startet bei 0, das Startteam wird ausgelost.
7. **„Weiter“:** bleibt ohne Strafpunkt.
8. **Zusatz:** Karten werden dynamisch zusammengesetzt; Begriffe übersprungener Karten können im laufenden Spiel wiederkommen.

## Umsetzungsreihenfolge
1. Projektstruktur: `index.html`, `style.css`, `app.js`, `data/begriffe.json`. ✔
2. Begriffspool erstellen und prüfen (Dopplungen, Verteilung, Format). ✔
3. Zustandsmodell: Phasen `einstellungen`, `bereit`, `countdown`, `runde`, `rundenende`, `zwischenstand`, `stechrunde`, `ende`. ✔
4. Spiellogik: Timer, Richtig/Weiter, Punkte, Log, Teamwechsel. ✔
5. Tiebreaker und Stechrunde. ✔
6. Kartenauswahl ohne Wiederholung innerhalb eines Spiels. ✔
7. Kartenlogik auf einen gültigen Begriff pro Karte umstellen, Zuordnung im Log. ✔
8. Prüfung vor dem Layout und Rückfragen. ✔
9. Mobile Oberfläche und Animationen. ✔ (im Browser bei Handybreite geprüft)
10. Test: Spiel bis zum Ende durchspielen, Ergebnis auf dem Handy testen.
