# ha-step-challenge

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Noack1978/ha-step-challenge.svg)](https://github.com/Noack1978/ha-step-challenge/releases)

> 🇩🇪 [Deutsch](#deutsch) · 🇬🇧 [English](#english)

---

## Deutsch

### Was es tut

**ha-step-challenge** verwandelt tägliche Schrittzahlen in ein visuelles Rennen. Jeden Tag gewinnt der Teilnehmer mit den meisten Schritten eine Etappe. Etappensiege summieren sich über die Challenge-Dauer und werden als animiertes Rennen in einem nativen HA-Panel dargestellt – ohne iframe, ohne Token.

### Funktionen

- Kein manueller Aufwand nach der Installation – Panel und Sensoren werden automatisch erstellt
- Unbegrenzte Teilnehmeranzahl
- Jeder Teilnehmer wird mit einem beliebigen Schritt-Sensor verknüpft (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animiertes Rennpanel in der Seitenleiste mit Fortschrittsbalken, Etappenkalender und Ergebnistabelle
- **🗺 Route** – Tour-de-France-ähnliches Höhenprofil mit allen Etappen und aktuellen Positionen
- **📍 Heute** – Zoom auf die aktuelle Etappe mit Echtzeit-Fortschritt nach Tageszeit
- **Ergebnisanzeige** nach dem Stoppen – Sieger und Etappensiege aller Teilnehmer als Zusammenfassung
- Konfigurierbare Anzahl der angezeigten Etappen in der Ergebnistabelle (−/+/All)
- **Auswertung am Folgetag** – optional, wenn Schrittzähler erst nach Mitternacht synchronisieren
- Alle Daten in HA `.storage` gespeichert – kein externer Dienst nötig

### Installation

Via HACS: Benutzerdefiniertes Repository `https://github.com/Noack1978/ha-step-challenge` als Typ **Integration** hinzufügen, installieren und Home Assistant neu starten.

### Einrichtung

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen → Step Challenge**
2. Challenge-Name, Dauer und Auswertungszeit eingeben
3. Optional: „Auswertung am Folgetag" aktivieren (wenn Schritte erst nach Mitternacht synchronisieren)
4. Mindestens zwei Teilnehmer hinzufügen – je Name und Schritt-Sensor-Entity
5. Bei Aufforderung neu starten

### Teilnehmer und Einstellungen verwalten

Über den **⚙️ Einstellungen**-Button im Panel oder direkt unter **Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren**:
- ➕ Teilnehmer hinzufügen
- ➖ Teilnehmer entfernen
- ⚙️ Challenge-Name, Dauer, Auswertungszeit oder Folgetag-Option ändern

### Challenge-Ablauf

- **🚩 Start** – startet eine neue Challenge (nur sichtbar wenn keine Challenge aktiv)
- **🏁 Etappe beenden** – wertet den heutigen Tagessieger (nur sichtbar wenn Challenge läuft)
- **⏹ Stoppen** – beendet die Challenge nach Bestätigung (nur sichtbar wenn Challenge läuft)

Nach dem Stoppen zeigt das Panel eine Zusammenfassung mit Sieger und Etappensiegen aller Teilnehmer. Diese verschwindet beim Start einer neuen Challenge.

### Auswertung am Folgetag

Falls der Schrittzähler erst nach Mitternacht synchronisiert (z.B. Fitbit, Apple Health): Option in den Einstellungen aktivieren und die Auswertungszeit auf z.B. 01:30 Uhr setzen. Die Etappe wird dann dem Vortag zugerechnet.

### Das Rennpanel

Das Panel erscheint automatisch in der **Seitenleiste** unter „Step Challenge".

### Dienste

| Dienst | Beschreibung |
|---|---|
| `step_challenge.start` | Challenge starten |
| `step_challenge.stop` | Challenge beenden |
| `step_challenge.record_day` | Heutigen Tagessieger manuell eintragen |

### Changelog

#### V1.2.10
- Ergebnisanzeige nach dem Stoppen: Sieger und Etappensiege als Zusammenfassung

#### V1.2.9
- Bestätigungsdialog beim Stoppen der Challenge

#### V1.2.8
- Buttons statusabhängig: Start nur wenn inaktiv, Etappe beenden und Stoppen nur wenn aktiv

#### V1.2.7
- Neue Option „Auswertung am Folgetag" für Schrittzähler die nach Mitternacht synchronisieren

#### V1.2.6
- ⚙️ Einstellungen-Button im Panel öffnet direkt die Integrationsseite

#### V1.2.5
- Buttons neu angeordnet: Start | Etappe beenden | Stoppen
- „Record Day" umbenannt zu „Etappe beenden"
- Stop-Button mit Bestätigungsdialog gesichert

#### V1.2.4
- Konfigurierbare Tabellenzeilen (−/+/All)

#### V1.2.3
- Datumsfehler in der Streckenansicht behoben (last_changed → last_updated)

#### V1.2.2
- 📍 Heute: Zoom auf aktuelle Tagesetappe mit Echtzeit-Fortschritt

#### V1.2.1
- Etappenpositionierung in der Gesamtstrecke korrigiert

#### V1.2.0
- 🗺 Route: Gesamtstrecken-Ansicht als Tour-de-France-Höhenprofil

#### V1.1.3
- Kalender-Datumsfehler behoben (Timezone)

#### V1.1.2
- Lovelace-Karte entfernt, Blueprint-Hinweis deaktivierbar

#### V1.1.1
- Menü-Button (☰) und customCards-Registrierung

#### V1.1.0
- Custom Element Panel (kein Token), component_name="custom"

---

## English

### What it does

**ha-step-challenge** turns daily step counts into a visual race. The participant with the most steps each day wins a stage. Stages accumulate over the full challenge duration and are displayed as an animated race in a native HA panel – no iframe, no token required.

### Features

- Zero manual setup after installation – panel and sensors are created automatically
- Unlimited participants
- Each participant links to any step-count sensor (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animated race panel in the sidebar with progress bars, stage calendar, and results table
- **🗺 Route** – Tour de France-style elevation profile with all stages and current positions
- **📍 Today** – zoomed view of the current stage with real-time progress by time of day
- **Results summary** after stopping – winner and stage wins for all participants
- Configurable number of rows in the results table (−/+/All)
- **Next-day evaluation** – optional, for step counters that sync after midnight
- All data stored in HA `.storage` – no external service required

### Installation

Via HACS: Add custom repository `https://github.com/Noack1978/ha-step-challenge` as type **Integration**, install, and restart Home Assistant.

### Setup

1. **Settings → Devices & Services → Add Integration → Step Challenge**
2. Enter a challenge name, duration, and daily evaluation time
3. Optional: enable „Evaluate on next day" (if steps sync after midnight)
4. Add at least two participants – each needs a display name and step sensor entity ID
5. Restart if prompted

### Managing participants and settings

Via the **⚙️ Settings** button in the panel or directly under **Settings → Devices & Services → Step Challenge → Configure**:
- ➕ Add a participant
- ➖ Remove a participant
- ⚙️ Change name, duration, evaluation time or next-day option

### Challenge workflow

- **🚩 Start** – starts a new challenge (only visible when no challenge is active)
- **🏁 End stage** – records today's stage winner (only visible when challenge is running)
- **⏹ Stop** – ends the challenge after confirmation (only visible when challenge is running)

After stopping, the panel shows a summary with the winner and stage wins for all participants. This disappears when a new challenge is started.

### Next-day evaluation

If your step counter syncs after midnight (e.g. Fitbit, Apple Health): enable the option in settings and set the evaluation time to e.g. 01:30. The stage will be attributed to the previous day.

### The race panel

The panel is automatically added to the **sidebar** under "Step Challenge".

### Services

| Service | Description |
|---|---|
| `step_challenge.start` | Start a challenge |
| `step_challenge.stop` | Stop the challenge |
| `step_challenge.record_day` | Manually record today's stage winner |

---

## License

MIT © [Noack1978](https://github.com/Noack1978)
