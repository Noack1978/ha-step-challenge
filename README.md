# ha-step-challenge

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Noack1978/ha-step-challenge.svg)](https://github.com/Noack1978/ha-step-challenge/releases)

> 🇩🇪 [Deutsch](#deutsch) · 🇬🇧 [English](#english)

---

## Deutsch

### Was es tut

**ha-step-challenge** verwandelt tägliche Schrittzahlen in ein visuelles Rennen. Jeden Tag gewinnt der Teilnehmer mit den meisten Schritten eine Etappe. Etappensiege summieren sich über die Challenge-Dauer und werden als animiertes Rennen in einer Custom Lovelace Card dargestellt.

**Alles wird automatisch eingerichtet** – keine Helfer, Automationen oder YAML-Änderungen nötig.

### Funktionen

- **Kein manueller Aufwand** nach der Installation: Lovelace-Ressource, Sidebar-Panel und Sensoren werden automatisch erstellt
- Unbegrenzte Teilnehmeranzahl – jederzeit über *Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren* ändern
- Jeder Teilnehmer wird mit einem beliebigen Schritt-Sensor verknüpft (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animierte Rennkarte mit Fortschrittsbalken, Etappenkalender und Ergebnistabelle
- Start / Stop / Etappe werten direkt in der Karte
- Vier Sensoren: Etappensiege je Teilnehmer, vergangene Tage, Status, aktueller Führender
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

Nach der Einrichtung erscheint eine Benachrichtigung in HA mit dem Link zum Blueprint für die tägliche Auswertung. Den Blueprint einmalig importieren unter *Einstellungen → Automationen → Blueprints → Blueprint importieren*.

### Teilnehmer verwalten

Jederzeit über **Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren**:
- ➕ Teilnehmer hinzufügen
- ➖ Teilnehmer entfernen
- ⚙️ Challenge-Name, Dauer oder Auswertungszeit ändern

### Challenge starten

**Start**-Button in der Rennkarte, oder den Dienst `step_challenge.start` aufrufen.

### Das Rennpanel anzeigen

Das Panel erscheint automatisch in der **Seitenleiste** unter „Step Challenge".


### Dienste

| Dienst | Beschreibung |
|---|---|
| `step_challenge.start` | Challenge starten (oder neu starten), alle Punkte zurücksetzen |
| `step_challenge.stop` | Challenge vorzeitig beenden |
| `step_challenge.record_day` | Heutigen Tagessieger manuell eintragen |

---

## English

### What it does

**ha-step-challenge** turns daily step counts into a visual race. The participant with the most steps each day wins a stage. Stages accumulate over the full challenge duration and are displayed as an animated race in a custom Lovelace card.

**Everything is set up automatically** – no helpers, automations, or YAML edits required.

### Features

- **Zero manual setup** after installation: Lovelace resource, sidebar panel, and sensors are created automatically
- Unlimited participants – add or remove them at any time via *Settings → Devices & Services → Step Challenge → Configure*
- Each participant links to any step-count sensor (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animated race card with progress bars, stage calendar, and results table
- Control buttons (Start / Stop / Record Day) directly in the card
- Four sensors: stage wins per participant, days elapsed, status, current leader
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

After setup, a notification appears in HA with a link to the daily evaluation blueprint. Import it once via *Settings → Automations → Blueprints → Import Blueprint*.

### Managing participants

Go to **Settings → Devices & Services → Step Challenge → Configure** at any time to:
- ➕ Add a new participant
- ➖ Remove a participant
- ⚙️ Change the challenge name, duration, or evaluation time

### Starting a challenge

Use the **Start** button in the race card, or call the service `step_challenge.start`.

### Displaying the race panel

The panel is automatically added to the **sidebar** under "Step Challenge".


### Services

| Service | Description |
|---|---|
| `step_challenge.start` | Start (or restart) the challenge, reset all scores |
| `step_challenge.stop` | Stop the challenge early |
| `step_challenge.record_day` | Manually record today's stage winner |

---

## License

MIT © [Noack1978](https://github.com/Noack1978)
