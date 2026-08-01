# ha-step-challenge

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Noack1978/ha-step-challenge.svg)](https://github.com/Noack1978/ha-step-challenge/releases)

> 🇩🇪 [Deutsch](#deutsch) · 🇬🇧 [English](#english)

---

## Deutsch

### Was es tut

**ha-step-challenge** verwandelt tägliche Schrittzahlen in ein visuelles Rennen. Jeden Tag gewinnt der Teilnehmer mit den meisten Schritten eine Etappe. Etappensiege summieren sich über die Challenge-Dauer und werden als animiertes Rennen in einem nativen HA-Panel dargestellt – ohne iframe, ohne Token.

**Alles wird automatisch eingerichtet** – keine Helfer, Automationen oder YAML-Änderungen nötig.

### Funktionen

- **Kein manueller Aufwand** nach der Installation: Panel und Sensoren werden automatisch erstellt
- Unbegrenzte Teilnehmeranzahl – über *Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren* verwalten
- Jeder Teilnehmer wird mit einem beliebigen Schritt-Sensor verknüpft (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animiertes Rennpanel in der Seitenleiste mit Fortschrittsbalken, Etappenkalender und Ergebnistabelle
- **Gesamtstrecken-Ansicht** (🗺 Route) – Tour-de-France-ähnliches Höhenprofil mit allen Etappen
- **Tagesetappen-Ansicht** (📍 Heute) – Zoom auf die aktuelle Etappe mit Echtzeit-Fortschritt
- **⚙️ Einstellungen direkt im Panel** – Challenge-Name, Dauer und Auswertungszeit ohne Umweg über die Integrationsseite ändern
- **📦 Archiv** – abgeschlossene Challenges werden automatisch archiviert und können im Panel verwaltet werden
- Konfigurierbare Anzahl der angezeigten Etappen in der Ergebnistabelle (−/+/Alle)
- Alle Daten in HA `.storage` gespeichert – kein externer Dienst oder Datenbank nötig

### Installation

Via HACS: Benutzerdefiniertes Repository `https://github.com/Noack1978/ha-step-challenge` als Typ **Integration** hinzufügen, installieren und Home Assistant neu starten.

### Einrichtung

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen → Step Challenge**
2. Challenge-Name, Dauer und Auswertungszeit eingeben
3. Mindestens zwei Teilnehmer hinzufügen – je Name und Schritt-Sensor-Entity
4. Bei Aufforderung neu starten

Die Integration richtet automatisch ein:
- Das Rennpanel in der Seitenleiste unter „Step Challenge"
- Sensoren für jeden Teilnehmer und die Challenge insgesamt

Nach der Einrichtung erscheint eine Benachrichtigung mit dem Blueprint-Link. Den Blueprint einmalig importieren unter *Einstellungen → Automationen → Blueprints → Blueprint importieren*.

### Teilnehmer verwalten

Über **Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren**:
- ➕ Teilnehmer hinzufügen
- ➖ Teilnehmer entfernen
- ⚙️ Challenge-Name, Dauer oder Auswertungszeit ändern

### Einstellungen im Panel

Über den **⚙️-Button** oben rechts im Panel:
- Challenge-Name, Dauer und Auswertungszeit direkt anpassen
- Einstellungen werden beim Start einer neuen Challenge übernommen
- Laufende Challenge stoppen (mit optionalem Archivieren)
- Neue Challenge starten

### Challenge-Ablauf

1. ⚙️ Einstellungen öffnen → Name, Dauer, Auswertungszeit festlegen
2. „Neue Challenge starten" → vorherige Challenge wird automatisch archiviert
3. Tägliche Auswertung läuft automatisch über den Blueprint
4. Am Ende: Challenge stoppen → Dialog fragt ob archivieren

### Archiv

Abgeschlossene Challenges werden automatisch archiviert wenn eine neue gestartet wird. Beim Stoppen wird gefragt ob archiviert werden soll.

Im ⚙️-Overlay → Archiv anzeigen:
- Liste aller vergangenen Challenges mit Name, Zeitraum, Gewinner und Etappensiegen
- Einzelne Einträge per Checkbox auswählen und löschen
- Ab 10 Archiv-Einträgen erscheint eine Erinnerung zur Bereinigung

### Das Rennpanel

Das Panel erscheint automatisch in der **Seitenleiste** unter „Step Challenge".

Alternativ in einem Dashboard einbinden:

```yaml
type: custom:step-challenge-card
```

### Dienste

| Dienst | Beschreibung |
|---|---|
| `step_challenge.start` | Neue Challenge starten (archiviert vorherige automatisch) |
| `step_challenge.stop` | Challenge beenden |
| `step_challenge.record_day` | Heutigen Tagessieger manuell eintragen |
| `step_challenge.archive_challenge` | Aktuelle Challenge manuell ins Archiv |
| `step_challenge.delete_archive_entries` | Archiv-Einträge per ID löschen |
| `step_challenge.update_settings` | Einstellungen per Service aktualisieren |

---

## English

### What it does

**ha-step-challenge** turns daily step counts into a visual race. The participant with the most steps each day wins a stage. Stages accumulate over the full challenge duration and are displayed as an animated race in a native HA panel – no iframe, no token required.

**Everything is set up automatically** – no helpers, automations, or YAML edits required.

### Features

- **Zero manual setup** after installation: panel and sensors are created automatically
- Unlimited participants – manage via *Settings → Devices & Services → Step Challenge → Configure*
- Each participant links to any step-count sensor (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animated race panel in the sidebar with progress bars, stage calendar, and results table
- **Total race view** (🗺 Route) – Tour de France-style elevation profile across all stages
- **Today's stage view** (📍 Today) – zoomed view of the current stage with real-time progress
- **⚙️ Settings directly in the panel** – change name, duration and evaluation time without navigating to the integration page
- **📦 Archive** – completed challenges are automatically archived and can be managed in the panel
- Configurable number of rows in the results table (−/+/All)
- All data stored in HA `.storage` – no external service or database required

### Installation

Via HACS: Add custom repository `https://github.com/Noack1978/ha-step-challenge` as type **Integration**, install, and restart Home Assistant.

### Setup

1. **Settings → Devices & Services → Add Integration → Step Challenge**
2. Enter a challenge name, duration, and daily evaluation time
3. Add at least two participants – each needs a display name and step sensor entity ID
4. Restart if prompted

The integration automatically:
- Adds the race panel to the sidebar under "Step Challenge"
- Creates sensors for each participant and the overall challenge

After setup, a notification appears with a blueprint link. Import it once via *Settings → Automations → Blueprints → Import Blueprint*.

### Managing participants

Via **Settings → Devices & Services → Step Challenge → Configure**:
- ➕ Add a participant
- ➖ Remove a participant
- ⚙️ Change name, duration or evaluation time

### Settings in the panel

Via the **⚙️ button** in the top right of the panel:
- Change challenge name, duration and evaluation time directly
- Settings are applied when a new challenge is started
- Stop the running challenge (with optional archiving)
- Start a new challenge

### Challenge workflow

1. Open ⚙️ settings → set name, duration, evaluation time
2. "Start new challenge" → previous challenge is automatically archived
3. Daily evaluation runs automatically via the blueprint
4. At the end: stop challenge → dialog asks whether to archive

### Archive

Completed challenges are automatically archived when a new one is started. When stopping, you are asked whether to archive.

In the ⚙️ overlay → Show archive:
- List of all past challenges with name, period, winner and stage wins per participant
- Select entries via checkbox and delete them
- A cleanup reminder appears after 10 archive entries

### The race panel

The panel is automatically added to the **sidebar** under "Step Challenge".

Alternatively, embed it in any dashboard:

```yaml
type: custom:step-challenge-card
```

### Services

| Service | Description |
|---|---|
| `step_challenge.start` | Start a new challenge (auto-archives the previous one) |
| `step_challenge.stop` | Stop the challenge |
| `step_challenge.record_day` | Manually record today's stage winner |
| `step_challenge.archive_challenge` | Manually archive the current challenge |
| `step_challenge.delete_archive_entries` | Delete archive entries by ID |
| `step_challenge.update_settings` | Update settings via service |

---

## License

MIT © [Noack1978](https://github.com/Noack1978)
