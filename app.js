// 30 Sekunden – Zustand, Spiellogik und Oberfläche.
//
// Aufbau der Datei:
//   1. Einstellungen und Zustand
//   2. Kartenstapel
//   3. Spielablauf (Runde, Wertung, Spielende, Stechrunde)
//   4. Ton und Bildschirmsperre
//   5. Speichern / Laden
//   6. Anzeige (ein HTML-Baustein pro Phase)
//   7. Bedienung und Start

// ---------- 1. Einstellungen und Zustand ----------

const VERSION = 10; // steht klein im Hauptmenü; bei jeder Veröffentlichung zusammen mit ?v= in index.html hochzählen
const RUNDEN_SEKUNDEN = 30;
const STECH_SEKUNDEN = 60;
const COUNTDOWN_SEKUNDEN = 3;
const BEGRIFFE_PRO_KARTE = 3; // zum Testen auch 5 möglich – sonst ist nichts anzupassen
const ZIELWERTE = [20, 30, 40, 50, 100];
const STANDARD_ZIEL = 30;
const HAPTIK_AB_SEKUNDE = 5; // in den letzten 5 Sekunden kommt je Sekunde ein Ton (auf Android zusätzlich Vibration)
const SPEICHER_KEY = "dreissig-sekunden-spiel-v2";

// Nur in diesen Phasen wird gespeichert. Wer mitten in einer Runde neu lädt,
// landet deshalb wieder auf "Team X ist dran" – die angefangene Runde zählt nicht.
const SPEICHER_PHASEN = ["bereit", "rundenende", "zwischenstand", "stechrunde", "ende"];

// Sprüche zum Rundenende, gestaffelt nach der Zahl der gewerteten Karten.
// "bis" ist die höchste Kartenzahl einer Stufe (gerechnet auf 30 Sekunden).
// Neue Sprüche einfach in die passende Liste schreiben.
const KOMMENTARE = [
  {
    bis: 0,
    texte: [
      "Null Punkte. Immerhin habt ihr nichts falsch gemacht.",
      "Das war eher eine Schweigeminute.",
      "Die Karten haben diese Runde gewonnen.",
      "Dreißig Sekunden Stille – auch eine Leistung.",
      "War das Erklären oder Pantomime ohne Bewegung?",
      "Kein Punkt. Aber die Frisur sitzt.",
      "Das üben wir noch mal. Heimlich.",
      "Der Wille war da. Sonst leider nichts.",
    ],
  },
  {
    bis: 2,
    texte: [
      "Der Anfang ist gemacht. Ein sehr kleiner Anfang.",
      "Lieber wenig als gar keine Ausrede.",
      "Qualität vor Quantität, sagt man.",
      "Warmgelaufen seid ihr jetzt – hoffentlich.",
      "Kleinvieh macht auch Mist.",
      "Das Tempo einer gemütlichen Schildkröte.",
      "Da war mehr drin. Deutlich mehr.",
      "Ihr schont euch wohl fürs Finale.",
    ],
  },
  {
    bis: 4,
    texte: [
      "Solide. Nicht aufregend, aber solide.",
      "Ordentlich – die Konkurrenz zittert noch nicht.",
      "Gutes Mittelfeld. Mama wäre zufrieden.",
      "Läuft. Noch nicht rund, aber es läuft.",
      "Damit kann man arbeiten.",
      "Eine Runde wie ein Butterbrot: unspektakulär, aber sättigend.",
      "Nicht schlecht für Menschen ohne Gedankenübertragung.",
      "Das Fundament steht. Jetzt fehlt nur noch das Haus.",
    ],
  },
  {
    bis: 6,
    texte: [
      "Stark! Da hat jemand zugehört.",
      "Jetzt wird es ernst für die anderen.",
      "Ihr versteht euch ja fast blind.",
      "Das sah verdächtig nach Absprache aus.",
      "Sauber erklärt, sauber geraten.",
      "So spielt man das.",
      "Da saß fast jedes Wort.",
      "Respekt. Das war richtig gut.",
    ],
  },
  {
    bis: 8,
    texte: [
      "Wow. Habt ihr heimlich geübt?",
      "Das war ein Feuerwerk.",
      "Gedankenübertragung ist eigentlich nicht erlaubt.",
      "Die anderen dürfen jetzt nervös werden.",
      "Bitte einmal zur Dopingkontrolle.",
      "Zwei Köpfe, ein Gedanke.",
      "Das ging schneller, als man mitlesen konnte.",
      "Ganz großes Kino.",
    ],
  },
  {
    bis: Infinity,
    texte: [
      "Unfassbar. Seid ihr sicher, dass ihr keine Maschinen seid?",
      "Rekordverdächtig – Autogramme bitte nach dem Spiel.",
      "Das war nicht mehr fair gegenüber den Karten.",
      "Legendär. Davon erzählt ihr noch euren Enkeln.",
      "So schnell kann die App kaum mitzählen.",
      "Das grenzt an Zauberei.",
    ],
  },
];
// Wenn die Runde endet, weil das Ziel erreicht ist, sagt die Kartenzahl wenig aus.
const KOMMENTARE_ZIEL = [
  "Punktlandung!",
  "Zielgerade genommen, Zielflagge geschwenkt.",
  "Mission erfüllt.",
  "Das Ziel ist erreicht – die Uhr durfte früher Feierabend machen.",
  "Geschafft. Jetzt erst mal durchatmen.",
];

let begriffe = new Map(); // id -> { id, begriff, kategorie }
let state = neuerZustand();

// Laufzeit-Werte, die nicht gespeichert werden
let timer = null;
let rundenEnde = 0; // Zeitstempel, an dem die laufende Runde endet
let rundenDauer = 0;
let countdownRest = 0;
let letzterTipp = 0;
let letzteSekunde = 0; // zuletzt angezeigte Sekunde – für den haptischen Countdown
let pauseRest = null; // verbleibende Millisekunden, solange die Runde angehalten ist
let rundenendeNeu = false; // true nur direkt nach dem Ende einer Runde (Glocke, kurze Knopfsperre)
let audio = null;
let wachSperre = null;

function neuerZustand() {
  return {
    // einstellungen | bereit | countdown | runde | rundenende | zwischenstand | stechrunde | ende
    phase: "einstellungen",
    teams: [
      { name: "Team 1", punkte: 0 },
      { name: "Team 2", punkte: 0 },
    ],
    ziel: STANDARD_ZIEL,
    amZug: 0,
    rundeNr: 1,
    modus: "normal", // normal | stechen
    bestaetigt: false, // erstes Tippen auf "Team X ist dran"
    stechNr: 0,
    stechPunkte: [0, 0],
    stechStart: 0, // ausgelostes Startteam der Stechrunde
    stechVorher: null, // Ergebnis der letzten, unentschiedenen Stechrunde
    stapel: [], // noch nicht gezogene Begriff-IDs
    karte: [], // die IDs der aktuellen Karte
    treffer: [], // als richtig gewertete Karten der laufenden Runde: { begriffe[], wahl }
    log: [], // { titel, team, karten[] } je gespielter Runde
    gewinner: null,
  };
}

function rundenTitel() {
  if (state.modus === "stechen") return state.stechNr > 1 ? `Stechrunde ${state.stechNr}` : "Stechrunde";
  return `Runde ${state.rundeNr}`;
}

function hatZiel(team) {
  return state.teams[team].punkte >= state.ziel;
}

// ---------- 2. Kartenstapel ----------

function mische(liste) {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

// Zieht eine neue Karte. Erst wenn der Stapel leer ist, wird der ganze Pool
// neu gemischt – so wiederholt sich innerhalb eines Spiels nichts vorzeitig.
function neueKarte() {
  const karte = [];
  while (karte.length < BEGRIFFE_PRO_KARTE) {
    if (state.stapel.length === 0) {
      state.stapel = mische([...begriffe.keys()].filter((id) => !karte.includes(id)));
    }
    karte.push(state.stapel.pop());
  }
  state.karte = karte;
}

// Übersprungene und nicht mehr gewertete Karten gehen zurück in den Stapel und
// können im selben Spiel in neuer Zusammenstellung wiederkommen. Sie landen in
// der unteren Hälfte, damit sie nicht gleich auf der nächsten Karte stehen.
function legeZurueck(ids) {
  for (const id of ids) {
    const stelle = Math.floor(Math.random() * (Math.floor(state.stapel.length / 2) + 1));
    state.stapel.splice(stelle, 0, id);
  }
}

// Sucht einen Spruch passend zur Rundenleistung aus. Sprüche, die in diesem
// Spiel schon gefallen sind, kommen erst wieder, wenn die Stufe aufgebraucht ist.
function waehleKommentar(karten, amZiel, sekunden) {
  // Die Stechrunde dauert länger – auf 30 Sekunden umrechnen, damit die Stufen passen.
  const wert = Math.round((karten * RUNDEN_SEKUNDEN) / sekunden);
  const texte = amZiel ? KOMMENTARE_ZIEL : KOMMENTARE.find((stufe) => wert <= stufe.bis).texte;
  const benutzt = state.log.map((eintrag) => eintrag.kommentar);
  const frei = texte.filter((text) => !benutzt.includes(text));
  const auswahl = frei.length ? frei : texte;
  return auswahl[Math.floor(Math.random() * auswahl.length)];
}

// ---------- 3. Spielablauf ----------

function starteSpiel(namen, ziel) {
  state = neuerZustand();
  state.teams.forEach((team, i) => {
    team.name = namen[i].trim() || `Team ${i + 1}`;
  });
  state.ziel = ziel;
  zuBereit();
  speichern();
  render();
}

function zuBereit() {
  state.phase = "bereit";
  state.bestaetigt = false;
}

function stoppeTimer() {
  clearInterval(timer);
  timer = null;
}

function starteCountdown() {
  tonVorbereiten();
  planeToene(state.modus === "stechen" ? STECH_SEKUNDEN : RUNDEN_SEKUNDEN, true);
  haltWach();
  state.phase = "countdown";
  countdownRest = COUNTDOWN_SEKUNDEN;
  render();
  timer = setInterval(() => {
    countdownRest--;
    if (countdownRest <= 0) {
      stoppeTimer();
      starteRunde();
    } else {
      render();
    }
  }, 1000);
}

function starteRunde() {
  state.phase = "runde";
  state.treffer = [];
  neueKarte();
  rundenDauer = (state.modus === "stechen" ? STECH_SEKUNDEN : RUNDEN_SEKUNDEN) * 1000;
  // Fester Endzeitpunkt statt Herunterzählen: bleibt genau, auch wenn der
  // Browser den Intervall kurz ausbremst.
  rundenEnde = Date.now() + rundenDauer;
  pauseRest = null;
  render();
  timer = setInterval(tick, 100);
}

// Unterbrechung (Anruf, App-Wechsel, Bildschirm aus): Die Uhr bleibt stehen,
// statt im Hintergrund abzulaufen. Die offene Karte wird verdeckt.
function pausiere() {
  if (state.phase !== "runde" || pauseRest !== null) return;
  pauseRest = Math.max(0, rundenEnde - Date.now());
  stoppeTimer();
  brichToeneAb();
  render();
}

// Weiter geht es erst auf Antippen – und mit einer neuen Karte, damit niemand
// die Pause zum Nachdenken über die alte nutzen kann.
function setzeFort() {
  if (state.phase !== "runde" || pauseRest === null) return;
  tonVorbereiten();
  haltWach();
  legeZurueck(state.karte);
  neueKarte();
  rundenEnde = Date.now() + pauseRest;
  planeToene(pauseRest / 1000, false);
  pauseRest = null;
  render();
  timer = setInterval(tick, 100);
}

function tick() {
  const rest = rundenEnde - Date.now();
  if (rest <= 0) return beendeRunde();
  zeigeUhr(rest);
  // Vibration einmal je Sekundenwechsel bei 5, 4, 3, 2, 1 (die Töne dazu sind vorab eingeplant)
  const sekunde = Math.ceil(rest / 1000);
  if (sekunde !== letzteSekunde) {
    letzteSekunde = sekunde;
    if (sekunde <= HAPTIK_AB_SEKUNDE) haptik();
  }
}

// Linke Hälfte = richtig, rechte Hälfte = weiter. Gewertet wird die ganze
// Karte: erklärt wird einer ihrer Begriffe, danach kommt in jedem Fall eine neue.
function bewerte(richtig) {
  if (state.phase !== "runde" || pauseRest !== null) return;
  if (Date.now() >= rundenEnde) return beendeRunde(); // Zeit ist um: zählt nicht mehr

  if (richtig) {
    // Welcher der Begriffe erklärt wurde, tippt der Spieler erst nach der Runde an.
    state.treffer.push({ begriffe: state.karte.map((id) => begriffe.get(id).begriff), wahl: null });
    state.karte = []; // gewertet, also verbraucht
    if (state.modus === "stechen") {
      // Die Stechrunde hat einen eigenen Zähler, der Punktestand bleibt eingefroren.
      state.stechPunkte[state.amZug]++;
    } else {
      state.teams[state.amZug].punkte++;
      // Zielwert erreicht: ab hier zählt das Team nicht weiter, die Runde endet.
      if (hatZiel(state.amZug)) return beendeRunde();
    }
  }

  legeZurueck(state.karte);
  neueKarte();
  zeigeKarte(richtig ? "richtig" : "weiter");
}

function beendeRunde() {
  stoppeTimer();
  legeZurueck(state.karte); // die Karte, die beim Ablauf der Zeit offen lag
  state.karte = [];
  const amZiel = state.modus !== "stechen" && hatZiel(state.amZug);
  const sekunden = state.modus === "stechen" ? STECH_SEKUNDEN : RUNDEN_SEKUNDEN;
  state.log.push({
    titel: rundenTitel(),
    team: state.amZug,
    karten: state.treffer,
    // wird hier festgelegt und mitgespeichert, damit er nach dem Neuladen derselbe bleibt
    kommentar: waehleKommentar(state.treffer.length, amZiel, sekunden),
  });
  state.phase = "rundenende";
  haptik(true);
  pauseRest = null;
  rundenendeNeu = true;
  glocke();
  speichern();
  render();
}

// Was nach der gerade beendeten Runde kommt. Ändert nichts am Zustand, damit
// der Rundenende-Bildschirm vorab anzeigen kann, wohin es geht.
function naechsterSchritt() {
  const beideAmZiel = hatZiel(0) && hatZiel(1);

  if (state.modus === "stechen") {
    if (state.amZug === state.stechStart) return { phase: "bereit", amZug: 1 - state.stechStart };
    const [a, b] = state.stechPunkte;
    if (a === b) return { phase: "stechrunde" }; // Gleichstand: wiederholen
    return { phase: "ende", gewinner: a > b ? 0 : 1 };
  }

  // Team 1 beginnt, deshalb darf Team 2 seine Runde immer noch spielen. Danach
  // haben beide gleich oft gespielt und es wird abgerechnet.
  if (state.amZug === 0) return { phase: "bereit", amZug: 1 };
  if (beideAmZiel) return { phase: "stechrunde" };
  if (hatZiel(0) || hatZiel(1)) return { phase: "ende", gewinner: hatZiel(0) ? 0 : 1 };
  return { phase: "zwischenstand" };
}

function weiterNachRunde() {
  const schritt = naechsterSchritt();
  if (schritt.phase === "bereit") {
    state.amZug = schritt.amZug;
    zuBereit();
  } else if (schritt.phase === "stechrunde") {
    starteStechrunde();
  } else if (schritt.phase === "ende") {
    state.gewinner = schritt.gewinner;
    state.phase = "ende";
    gibFrei();
  } else {
    state.phase = "zwischenstand";
  }
  speichern();
  render();
}

function weiterNachZwischenstand() {
  state.rundeNr++;
  state.amZug = 0;
  zuBereit();
  speichern();
  render();
}

function starteStechrunde() {
  state.stechVorher = state.modus === "stechen" ? [...state.stechPunkte] : null;
  state.modus = "stechen";
  state.stechNr++;
  state.stechPunkte = [0, 0];
  state.stechStart = Math.random() < 0.5 ? 0 : 1; // wer beginnt, wird ausgelost
  state.amZug = state.stechStart;
  state.phase = "stechrunde";
}

function zuEinstellungen() {
  stoppeTimer();
  brichToeneAb();
  pauseRest = null;
  gibFrei();
  const alt = state;
  state = neuerZustand();
  // Namen und Zielwert für die nächste Partie vorbelegen
  state.teams.forEach((team, i) => (team.name = alt.teams[i].name));
  state.ziel = alt.ziel;
  try {
    localStorage.removeItem(SPEICHER_KEY);
  } catch {}
  render();
}

// ---------- 4. Ton ----------
//
// Das iPhone spielt nur Töne, die während einer Berührung in Auftrag gegeben
// werden. Ein Ton, den erst die ablaufende Uhr auslöst, bleibt dort stumm.
// Deshalb werden alle Töne einer Runde schon beim Antippen von "Bereit?"
// vorab auf die Sekunde genau eingeplant: die drei Töne des Countdowns, je ein
// Ton in den letzten fünf Sekunden und die Glocke am Ende. Endet die Runde
// anders als geplant (Pause, Ziel erreicht, Abbruch), wird der Rest gestrichen.

let geplant = []; // vorab eingeplante Töne: { zeit, glocke, knoten[] }
let grundton = null; // unhörbare Dauerquelle, hält die Tonausgabe während des Spiels wach

function tonVorbereiten() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    // "running" ist der einzige Zustand, in dem Ton herauskommt (iOS kennt auch "interrupted").
    if (audio.state !== "running") audio.resume();
    if (!grundton) {
      grundton = audio.createOscillator();
      const stumm = audio.createGain();
      stumm.gain.value = 0.00001;
      grundton.connect(stumm).connect(audio.destination);
      grundton.start();
    }
  } catch {
    audio = null;
  }
}

// Ein einzelner Ton zur Zeit "zeit" (in Sekunden der Audio-Uhr). Gibt den Knoten
// zurück, damit er sich wieder streichen lässt.
function spieleTon(zeit, frequenz, dauer, laut) {
  const oszillator = audio.createOscillator();
  const lautstaerke = audio.createGain();
  oszillator.frequency.value = frequenz;
  lautstaerke.gain.setValueAtTime(0.0001, zeit);
  lautstaerke.gain.exponentialRampToValueAtTime(laut, zeit + 0.01);
  lautstaerke.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
  oszillator.connect(lautstaerke).connect(audio.destination);
  oszillator.start(zeit);
  oszillator.stop(zeit + dauer + 0.1);
  return oszillator;
}

// Glockenton: zwei Schläge, jeder ein Grundton plus leisere Obertöne, die ausklingen.
function spieleGlocke(zeit) {
  const knoten = [];
  for (const versatz of [0, 0.35]) {
    for (const [frequenz, anteil] of [[880, 1], [1760, 0.5], [2640, 0.3], [3520, 0.15]]) {
      knoten.push(spieleTon(zeit + versatz, frequenz, 1.6, 0.3 * anteil));
    }
  }
  return knoten;
}

// Plant alle Töne für eine Runde, die noch "restSekunden" dauert. Muss aus
// einer Berührung heraus aufgerufen werden (Start der Runde, Ende einer Pause).
function planeToene(restSekunden, mitCountdown) {
  if (!audio) return;
  try {
    brichToeneAb();
    let start = audio.currentTime + 0.03;
    if (mitCountdown) {
      for (let i = 0; i < COUNTDOWN_SEKUNDEN; i++) {
        geplant.push({ zeit: start + i, glocke: false, knoten: [spieleTon(start + i, 660, 0.14, 0.25)] });
      }
      start += COUNTDOWN_SEKUNDEN;
    }
    for (let s = HAPTIK_AB_SEKUNDE; s >= 1; s--) {
      if (s >= restSekunden) continue; // nach einer Pause sind es vielleicht weniger als fünf
      const zeit = start + restSekunden - s;
      geplant.push({ zeit, glocke: false, knoten: [spieleTon(zeit, 1100, 0.09, 0.3)] });
    }
    const ende = start + restSekunden;
    geplant.push({ zeit: ende, glocke: true, knoten: spieleGlocke(ende) });
  } catch {}
}

// Streicht alle Töne, die noch nicht begonnen haben. Gibt zurück, ob die
// eingeplante Glocke gerade schon läutet – dann braucht es keine zweite.
function brichToeneAb() {
  if (!audio) return false;
  const jetzt = audio.currentTime;
  let glockeLaeutet = false;
  for (const ton of geplant) {
    if (ton.zeit > jetzt + 0.05) {
      for (const knoten of ton.knoten) {
        try {
          knoten.stop();
        } catch {}
      }
    } else if (ton.glocke && jetzt - ton.zeit < 1) {
      glockeLaeutet = true;
    }
  }
  geplant = [];
  return glockeLaeutet;
}

// Rundenende: Die Glocke ist normalerweise schon eingeplant. Nur wenn die
// Runde vorzeitig endet (Ziel erreicht), wird sie hier sofort angeschlagen.
function glocke() {
  if (!audio) return;
  try {
    if (audio.state !== "running") audio.resume(); // nach einer Unterbrechung wieder aufwecken
    if (!brichToeneAb()) spieleGlocke(audio.currentTime);
  } catch {}
}

// Vibration zusätzlich zum Ton. Das können nur Android-Browser
// (navigator.vibrate); Safari auf dem iPhone erlaubt Webseiten kein Vibrieren –
// dort übernehmen die Töne den Countdown.
function haptik(lang = false) {
  try {
    navigator.vibrate?.(lang ? [200, 80, 200] : 70);
  } catch {}
}

// Hält den Bildschirm an, solange gespielt wird – sonst sperrt sich das Handy
// beim Weiterreichen. Der Browser gibt die Sperre von selbst frei, wenn die
// Seite in den Hintergrund geht; deshalb wird sie vor jeder Runde neu geholt.
// Geht nur über https (oder localhost); ohne passiert einfach nichts.
async function haltWach() {
  try {
    if (!wachSperre || wachSperre.released) wachSperre = await navigator.wakeLock.request("screen");
  } catch {}
}

function gibFrei() {
  wachSperre?.release().catch(() => {});
  wachSperre = null;
}

// ---------- 5. Speichern / Laden ----------

function speichern() {
  if (!SPEICHER_PHASEN.includes(state.phase)) return;
  try {
    localStorage.setItem(SPEICHER_KEY, JSON.stringify(state));
  } catch {} // z. B. privates Fenster: dann eben ohne Speichern
}

function laden() {
  try {
    const alt = JSON.parse(localStorage.getItem(SPEICHER_KEY));
    if (!alt || !SPEICHER_PHASEN.includes(alt.phase)) return;
    state = { ...neuerZustand(), ...alt };
    // Falls begriffe.json inzwischen geändert wurde: unbekannte IDs aussortieren
    // Neu mischen: Sonst kämen nach dem Neuladen mitten in einer Runde dieselben
    // Karten in derselben Reihenfolge noch einmal.
    state.stapel = mische(state.stapel.filter((id) => begriffe.has(id)));
  } catch {}
}

// ---------- 6. Anzeige ----------

// Teamnamen kommen aus einem Eingabefeld – vor dem Einsetzen in HTML entschärfen.
function esc(text) {
  return String(text).replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[z]);
}

function name(team) {
  return esc(state.teams[team].name);
}

function standHtml() {
  const zeilen = state.teams.map((team, i) => {
    const anteil = Math.min(1, team.punkte / state.ziel);
    return `
      <div class="stand-zeile team-${i}">
        <span>${name(i)}</span>
        <b>${team.punkte}</b>
        <i style="width:${anteil * 100}%"></i>
      </div>`;
  });
  return `<div class="stand">${zeilen.join("")}<small>Ziel: ${state.ziel} Punkte</small></div>`;
}

// Text einer gewerteten Karte im Log: der angetippte Begriff, sonst die ganze Karte.
function kartenText(karte) {
  return karte.wahl === null ? karte.begriffe.join(" / ") : karte.begriffe[karte.wahl];
}

// Gestrichene Karten zählen nicht – weder für die Anzeige noch fürs Log.
function gewertet(eintrag) {
  return eintrag.karten.filter((karte) => !karte.gestrichen);
}

// Kurzer Spielstand, immer mit Teamnamen. In der Stechrunde zeigt er deren
// eigenen Zähler und sagt das auch dazu.
function standKurz() {
  const stechen = state.modus === "stechen";
  const punkte = stechen ? state.stechPunkte : state.teams.map((team) => team.punkte);
  return `${stechen ? "<em>Stechrunde</em>" : ""}
    <span class="team-0"><small>${name(0)}</small> ${punkte[0]}</span>
    <i>:</i>
    <span class="team-1">${punkte[1]} <small>${name(1)}</small></span>`;
}

const GLOCKE = `<svg class="glocke" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 3v1.5"/><path d="M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2.2h-14z"/><path d="M10.2 20.4a1.9 1.9 0 0 0 3.6 0"/>
</svg>`;
const LOG_KNOPF = `<button class="knopf leise" data-aktion="log">Log</button>`;

const ANSICHTEN = {
  einstellungen() {
    const ziele = ZIELWERTE.map(
      (wert) => `
        <label class="ziel">
          <input type="radio" name="ziel" value="${wert}" ${wert === state.ziel ? "checked" : ""}>
          <span>${wert}</span>
        </label>`
    ).join("");
    return `
      <section class="screen einstellungen">
        <h1><b>30</b> Sekunden</h1>
        <p class="unter">Erklären, raten, weiterreichen.</p>
        <div class="gruppe">${state.teams
          .map(
            (team, i) => `
              <label class="feld team-${i}">
                <span>Team ${i + 1}</span>
                <input id="name${i}" type="text" maxlength="20" autocomplete="off"
                       placeholder="Team ${i + 1}" value="${esc(team.name)}">
              </label>`
          )
          .join("")}</div>
        <fieldset class="ziele">
          <legend>Zielpunktzahl</legend>
          <div>${ziele}</div>
        </fieldset>
        <button class="knopf gross" data-aktion="start">Spiel starten</button>
        <p class="version">Version ${VERSION}</p>
      </section>`;
  },

  bereit() {
    const sekunden = state.modus === "stechen" ? STECH_SEKUNDEN : RUNDEN_SEKUNDEN;
    // Team 1 ist schon am Ziel: Team 2 muss in dieser Runde gleichziehen.
    const letzteChance = state.modus === "normal" && state.amZug === 1 && hatZiel(0);
    const inhalt = state.bestaetigt
      ? `<p class="klein">${name(state.amZug)}</p>
         <h2>Bereit?</h2>
         <p class="hinweis">Tippen startet den Countdown · ${sekunden} Sekunden</p>`
      : `<p class="klein">${rundenTitel()}${letzteChance ? " · letzte Chance" : ""}</p>
         <h2>${name(state.amZug)} <br>ist dran</h2>
         ${letzteChance ? `<p class="hinweis"><b>${name(0)}</b> hat das Ziel erreicht.</p>` : ""}
         <p class="spielstand">${standKurz()}</p>
         <p class="hinweis">Tippen zum Bestätigen</p>`;
    return `
      <section class="screen bereit team-${state.amZug}" data-aktion="bereit-tipp">
        <div class="ecke">${LOG_KNOPF}</div>
        ${inhalt}
      </section>`;
  },

  countdown() {
    return `
      <section class="screen countdown team-${state.amZug}">
        <div class="zahl">${countdownRest}</div>
      </section>`;
  },

  runde() {
    return `
      <section class="screen runde team-${state.amZug}">
        <div class="haelften">
          <button class="haelfte richtig" data-tipp="richtig"><span>✓ Richtig</span></button>
          <button class="haelfte weiter" data-tipp="weiter"><span>Weiter →</span></button>
        </div>
        <header class="uhr">
          <div class="balken"><i id="balken"></i></div>
          <div class="uhr-zeile">
            <span>${name(state.amZug)} · <b id="punkte"></b> <em id="runden-plus"></em></span>
            <button class="pausenknopf" data-aktion="pause" aria-label="Pause">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="6" width="3.4" height="12" rx="1"/><rect x="13.6" y="6" width="3.4" height="12" rx="1"/></svg>
            </button>
            <strong id="sekunden"></strong>
          </div>
        </header>
        <ol class="karte" id="karte"></ol>
        ${pauseRest === null
          ? ""
          : `<div class="pause">
               <b>Pause</b>
               <small>Die Uhr steht. Es geht mit einer neuen Karte weiter.</small>
               <button class="knopf gross" data-aktion="fortsetzen">Fortsetzen</button>
               <button class="knopf leise warn" data-aktion="abbrechen">Zum Hauptmenü</button>
             </div>`}
      </section>`;
  },

  rundenende() {
    const eintrag = state.log[state.log.length - 1];
    const schritt = naechsterSchritt();
    const amZiel = state.modus !== "stechen" && hatZiel(state.amZug);
    const anzahl = gewertet(eintrag).length;
    const knopf = (karte, i, j) =>
      `<button class="${karte.wahl === j ? "gewaehlt" : ""}" data-aktion="wahl" data-karte="${i}" data-begriff="${j}"
         ${karte.gestrichen ? "disabled" : ""}>${esc(karte.begriffe[j])}</button>`;
    // Am Zeilenende: Karte streichen (Fehltipp) bzw. das Streichen zurücknehmen
    const streichen = (karte, i) =>
      `<button class="streichen" data-aktion="streichen" data-karte="${i}"
         aria-label="${karte.gestrichen ? "Karte wieder werten" : "Karte streichen"}">${karte.gestrichen ? "↩" : "✕"}</button>`;
    const zeile = (karte, i) =>
      `<li class="${karte.gestrichen ? "gestrichen" : ""}">${karte.begriffe.map((_, j) => knopf(karte, i, j)).join("")}${streichen(karte, i)}</li>`;
    const begriffListe = eintrag.karten.length
      ? `<p class="hinweis frage">Welcher Begriff wurde erklärt?</p>
         <ul class="wahl">${eintrag.karten.map(zeile).join("")}</ul>
         <p class="fussnote">Falsch getippt? ✕ streicht die Karte und nimmt den Punkt zurück.</p>`
      : `<p class="hinweis">Keine Karte erraten.</p>`;
    const weiter = {
      bereit: [`Weiterreichen an <b>${schritt.phase === "bereit" ? name(schritt.amZug) : ""}</b>`, "Weiter"],
      zwischenstand: ["", "Zum Zwischenstand"],
      stechrunde: ["", "Zur Stechrunde"],
      ende: ["", "Zum Ergebnis"],
    }[schritt.phase];
    return `
      <section class="screen rundenende team-${state.amZug} ${eintrag.karten.length ? "mit-karten" : ""} ${rundenendeNeu ? "neu" : ""}">
        <div class="ecke">${LOG_KNOPF}</div>
        <div class="kopf">
          ${GLOCKE}
          <h2>${amZiel ? "Ziel erreicht!" : "Zeit um!"}</h2>
          ${eintrag.kommentar ? `<p class="kommentar">${esc(eintrag.kommentar)}</p>` : ""}
          <p class="klein">${name(state.amZug)} · +${anzahl} ${anzahl === 1 ? "Karte" : "Karten"}</p>
          <p class="spielstand">${standKurz()}</p>
        </div>
        <div class="liste">${begriffListe}</div>
        <footer class="fuss">
          ${weiter[0] ? `<p class="weiterreichen team-${schritt.amZug}">${weiter[0]}</p>` : ""}
          <button class="knopf gross" data-aktion="nach-runde" id="weiter-knopf" ${rundenendeNeu ? "disabled" : ""}>${weiter[1]}</button>
        </footer>
      </section>`;
  },

  zwischenstand() {
    const hinweis = `<p class="hinweis">Weiter mit <b>${name(0)}</b></p>`;
    return `
      <section class="screen zwischenstand">
        <p class="klein">nach Runde ${state.rundeNr}</p>
        <h2>Zwischenstand</h2>
        ${standHtml()}
        ${hinweis}
        <div class="knoepfe">
          <button class="knopf gross" data-aktion="nach-zwischenstand">Weiter</button>
          ${LOG_KNOPF}
        </div>
      </section>`;
  },

  stechrunde() {
    const text = state.stechVorher
      ? `Wieder Gleichstand (${state.stechVorher[0]} : ${state.stechVorher[1]}) – es wird wiederholt.`
      : `Beide Teams haben ${state.ziel} Punkte erreicht.`;
    return `
      <section class="screen stechrunde">
        <h2>${rundenTitel()}</h2>
        <p class="hinweis">${text}</p>
        <p class="hinweis">Beide starten bei 0 und spielen je <b>${STECH_SEKUNDEN} Sekunden</b>.
          Ausgelost: <b>${name(state.stechStart)}</b> beginnt. Wer mehr Karten schafft, gewinnt.</p>
        <div class="knoepfe">
          <button class="knopf gross" data-aktion="stechen-los">Los</button>
          ${LOG_KNOPF}
        </div>
      </section>`;
  },

  ende() {
    const stechen = state.stechNr
      ? `<p class="hinweis">Stechrunde: ${name(0)} ${state.stechPunkte[0]} : ${state.stechPunkte[1]} ${name(1)}</p>`
      : "";
    return `
      <section class="screen ende team-${state.gewinner}">
        <p class="klein">Gewonnen hat</p>
        <h2>${name(state.gewinner)}</h2>
        ${standHtml()}
        ${stechen}
        <div class="knoepfe">
          <button class="knopf gross" data-aktion="neues-spiel">Neues Spiel</button>
          ${LOG_KNOPF}
        </div>
      </section>`;
  },
};

function render() {
  document.getElementById("app").innerHTML = ANSICHTEN[state.phase]();
  if (state.phase === "runde") {
    zeigeKarte();
    zeigeUhr(pauseRest ?? rundenEnde - Date.now());
  }
  if (state.phase === "rundenende" && rundenendeNeu) {
    // Nur direkt nach der Runde: kurz sperren, damit ein letzter Tipp nicht gleich
    // weiterschaltet. Späteres Neuzeichnen (Begriff antippen, Karte streichen)
    // sperrt nicht erneut und lässt auch die Glocke nicht noch einmal läuten.
    rundenendeNeu = false;
    setTimeout(() => document.getElementById("weiter-knopf")?.removeAttribute("disabled"), 800);
  }
}

// Karte und Uhr werden während der Runde einzeln aktualisiert, damit nicht
// zehnmal pro Sekunde der ganze Bildschirm neu aufgebaut wird.
function zeigeKarte(ergebnis) {
  const karte = document.getElementById("karte");
  karte.innerHTML = state.karte.map((id) => `<li>${esc(begriffe.get(id).begriff)}</li>`).join("");
  if (ergebnis) {
    // Klasse entfernen, Layout einmal abfragen, wieder setzen: so startet die
    // Animation auch dann neu, wenn zweimal hintereinander gleich gewertet wird.
    karte.classList.remove("nach-richtig", "nach-weiter");
    void karte.offsetWidth;
    karte.classList.add(`nach-${ergebnis}`);
  }
  document.getElementById("runden-plus").textContent = state.treffer.length ? `+${state.treffer.length}` : "";
  const punkte = state.modus === "stechen" ? state.stechPunkte[state.amZug] : state.teams[state.amZug].punkte;
  document.getElementById("punkte").textContent = punkte;
}

function zeigeUhr(rest) {
  const sekunden = document.getElementById("sekunden");
  sekunden.textContent = Math.ceil(rest / 1000);
  sekunden.classList.toggle("knapp", rest <= 5000);
  document.getElementById("balken").style.width = `${(rest / rundenDauer) * 100}%`;
}

function zeigeLog() {
  const overlay = document.getElementById("log-overlay");
  const eintraege = state.log.map((eintrag) => {
    const karten = gewertet(eintrag);
    const liste = karten.length ? karten.map((karte) => esc(kartenText(karte))).join(" · ") : "–";
    return `
      <li class="team-${eintrag.team}">
        <header><b>${esc(eintrag.titel)}</b> · ${name(eintrag.team)} <em>${karten.length}</em></header>
        <p>${liste}</p>
      </li>`;
  });
  overlay.innerHTML = `
    <div class="log">
      <header>
        <h3>Log</h3>
        <button class="knopf leise" data-aktion="log-zu">Fertig</button>
      </header>
      ${eintraege.length ? `<ol>${eintraege.join("")}</ol>` : `<p class="hinweis">Noch keine Runde gespielt.</p>`}
      ${state.phase === "ende" ? "" : `<button class="knopf leise warn" data-aktion="abbrechen">Spiel abbrechen</button>`}
    </div>`;
  overlay.hidden = false;
}

// ---------- 7. Bedienung und Start ----------

const AKTIONEN = {
  start() {
    const namen = [0, 1].map((i) => document.getElementById(`name${i}`).value);
    const ziel = Number(document.querySelector("input[name=ziel]:checked").value);
    starteSpiel(namen, ziel);
  },
  "bereit-tipp"() {
    if (!state.bestaetigt) {
      state.bestaetigt = true;
      render();
    } else {
      starteCountdown();
    }
  },
  // Rundenende: den erklärten Begriff einer gewerteten Karte markieren (nochmal tippen hebt auf).
  wahl(knopf) {
    const karte = state.log[state.log.length - 1].karten[knopf.dataset.karte];
    const j = Number(knopf.dataset.begriff);
    karte.wahl = karte.wahl === j ? null : j;
    speichern();
    render();
  },
  // Rundenende: eine versehentlich als richtig gewertete Karte streichen. Der Punkt
  // wird abgezogen; nochmal tippen nimmt das Streichen zurück.
  streichen(knopf) {
    const karte = state.log[state.log.length - 1].karten[knopf.dataset.karte];
    karte.gestrichen = !karte.gestrichen;
    if (karte.gestrichen) karte.wahl = null;
    const aenderung = karte.gestrichen ? -1 : 1;
    if (state.modus === "stechen") state.stechPunkte[state.amZug] += aenderung;
    else state.teams[state.amZug].punkte += aenderung;
    speichern();
    render();
  },
  pause: pausiere,
  fortsetzen: setzeFort,
  "nach-runde": weiterNachRunde,
  "nach-zwischenstand": weiterNachZwischenstand,
  "stechen-los"() {
    zuBereit();
    speichern();
    render();
  },
  "neues-spiel": zuEinstellungen,
  log: zeigeLog,
  "log-zu"() {
    document.getElementById("log-overlay").hidden = true;
  },
  abbrechen() {
    if (!confirm("Spiel wirklich abbrechen? Der Spielstand geht verloren.")) return;
    document.getElementById("log-overlay").hidden = true;
    zuEinstellungen();
  },
};

document.addEventListener("click", (ereignis) => {
  const ziel = ereignis.target.closest("[data-aktion]");
  if (ziel && !ziel.disabled) AKTIONEN[ziel.dataset.aktion](ziel);
});

// Die beiden Bildschirmhälften reagieren schon beim Berühren, nicht erst beim
// Loslassen – in 30 Sekunden zählt jede Zehntelsekunde.
document.addEventListener("pointerdown", (ereignis) => {
  const haelfte = ereignis.target.closest("[data-tipp]");
  if (!haelfte) return;
  ereignis.preventDefault();
  if (Date.now() - letzterTipp < 120) return; // versehentlicher Doppeltipp
  letzterTipp = Date.now();
  bewerte(haelfte.dataset.tipp === "richtig");
});

// Geht die App in den Hintergrund, hält die Runde an. Ein laufender Countdown
// springt zurück auf "Bereit?", damit die Runde nicht ungesehen startet.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.phase === "runde") {
      pausiere();
    } else if (state.phase === "countdown") {
      stoppeTimer();
      brichToeneAb();
      state.phase = "bereit";
      state.bestaetigt = true;
      render();
    }
  } else if (wachSperre) {
    haltWach(); // der Browser hat die Sperre im Hintergrund freigegeben
  }
});

async function init() {
  try {
    const antwort = await fetch("data/begriffe.json", { cache: "no-cache" });
    const liste = await antwort.json();
    begriffe = new Map(liste.map((eintrag) => [eintrag.id, eintrag]));
  } catch {
    document.getElementById("app").innerHTML = `
      <section class="screen">
        <h2>Begriffe konnten nicht geladen werden</h2>
        <p class="hinweis">Die App braucht einen kleinen lokalen Server
          (im Projektordner <code>npx serve</code> starten) – ein Doppelklick
          auf index.html reicht nicht.</p>
      </section>`;
    return;
  }
  laden();
  render();
}

init();
