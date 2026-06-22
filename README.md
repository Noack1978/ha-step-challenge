# ha-step-challenge

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Noack1978/ha-step-challenge.svg)](https://github.com/Noack1978/ha-step-challenge/releases)

> 🇩🇪 [Deutsch](#deutsch) · 🇬🇧 [English](#english)

---

## Deutsch

### Was es tut

**ha-step-challenge** verwandelt tägliche Schrittzahlen in ein visuelles Rennen. Jeden Tag gewinnt der Teilnehmer mit den meisten Schritten eine Etappe. Etappensiege summieren sich über die Challenge-Dauer und werden als animiertes Rennen dargestellt.

**Alles wird automatisch eingerichtet** – keine Helfer, Automationen oder YAML-Änderungen nötig.

### Funktionen

- **Kein manueller Aufwand** nach der Installation: tägliche Automation, Rennpanel und Sensoren werden automatisch erstellt
- Unbegrenzte Teilnehmeranzahl – jederzeit über *Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren* ändern
- Jeder Teilnehmer wird mit einem beliebigen Schritt-Sensor verknüpft (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animiertes Rennpanel mit Fortschrittsbalken, Etappenkalender und Ergebnistabelle
- Start / Stop / Etappe werten direkt im Panel
- Vier Sensoren: Etappensiege je Teilnehmer, vergangene Tage, Status, aktueller Führender
- Alle Daten in HA `.storage` gespeichert – kein externer Dienst oder Datenbank nötig

### Installation

#### Via HACS (empfohlen)

1. HACS → **Integrationen** → ⋮ → **Benutzerdefinierte Repositories**
2. `https://github.com/Noack1978/ha-step-challenge` als Typ **Integration** hinzufügen
3. **Step Challenge** installieren und Home Assistant neu starten

#### Manuell

1. `custom_components/step_challenge/` nach `/config/custom_components/step_challenge/` kopieren
2. Home Assistant neu starten

### Einrichtung

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen → Step Challenge**
2. Challenge-Name und Dauer eingeben
3. Mindestens zwei Teilnehmer hinzufügen – je Name und Schritt-Sensor-Entity
4. Bei Aufforderung neu starten

Die Integration richtet automatisch ein:
- Das Rennpanel unter `http://deine-ha-ip/local/step_challenge/index.html`
- Sensoren für jeden Teilnehmer und die Challenge insgesamt

Nach der Einrichtung erscheint eine Benachrichtigung in HA mit dem Link zum Blueprint für die tägliche Auswertung. Den Blueprint einmalig importieren unter *Einstellungen → Automationen → Blueprints → Blueprint importieren*.

### Teilnehmer verwalten

Jederzeit über **Einstellungen → Geräte & Dienste → Step Challenge → Konfigurieren**:
- ➕ Teilnehmer hinzufügen
- ➖ Teilnehmer entfernen
- ⚙️ Challenge-Name oder Dauer ändern

### Challenge starten

**Start**-Button im Rennpanel, oder den Dienst `step_challenge.start` per Dashboard-Button aufrufen.

### Das Rennpanel anzeigen

Das Panel wird automatisch in der **Seitenleiste** unter „Step Challenge" eingetragen.

Wer das Panel lieber **direkt in einem Dashboard** einbinden möchte, kann eine Webpage-Karte verwenden:

```yaml
type: iframe
url: /local/step_challenge/index.html
aspect_ratio: 75%
```

Oder als Button, der das Panel in einem neuen Tab öffnet:

```yaml
show_name: true
show_icon: true
type: button
name: Step Challenge
icon: mdi:racing-helmet
tap_action:
  action: url
  url_path: /local/step_challenge/index.html
```

### Dienste

| Dienst | Beschreibung |
|---|---|
| `step_challenge.start` | Challenge starten (oder neu starten), alle Punkte zurücksetzen |
| `step_challenge.stop` | Challenge vorzeitig beenden |
| `step_challenge.record_day` | Heutigen Tagessieger manuell eintragen |

---

## English

### What it does

**ha-step-challenge** turns daily step counts into a visual race. The participant with the most steps each day wins a stage. Stages accumulate over the full challenge duration and are displayed as an animated race.

**Everything is set up automatically** – no helpers, automations, or YAML edits required.

### Features

- **Zero manual setup** after installation: daily automation, race panel, and sensors are created automatically
- Unlimited participants – add or remove them at any time via *Settings → Devices & Services → Step Challenge → Configure*
- Each participant links to any step-count sensor (Google Fit, Apple Health, Fitbit, Samsung Health, …)
- Animated race panel with progress bars, stage calendar, and results table
- Control buttons (Start / Stop / Record Day) directly in the panel
- Four sensors: stage wins per participant, days elapsed, status, current leader
- All data stored in HA `.storage` – no external service or database required

### Installation

#### Via HACS (recommended)

1. HACS → **Integrations** → ⋮ → **Custom repositories**
2. Add `https://github.com/Noack1978/ha-step-challenge` as type **Integration**
3. Install **Step Challenge** and restart Home Assistant

#### Manual

1. Copy `custom_components/step_challenge/` to `/config/custom_components/step_challenge/`
2. Restart Home Assistant

### Setup

1. **Settings → Devices & Services → Add Integration → Step Challenge**
2. Enter a challenge name and duration
3. Add at least two participants – each needs a display name and the entity ID of their step sensor
4. Restart if prompted

The integration automatically:
- Makes the race panel available at `http://your-ha-ip/local/step_challenge/index.html`
- Creates sensors for each participant and the overall challenge

After setup, a notification appears in HA with a link to the daily evaluation blueprint. Import it once via *Settings → Automations → Blueprints → Import Blueprint*.

### Managing participants

Go to **Settings → Devices & Services → Step Challenge → Configure** at any time to:
- ➕ Add a new participant
- ➖ Remove a participant
- ⚙️ Change the challenge name or duration

### Starting a challenge

Use the **Start** button in the race panel, or call the service `step_challenge.start` from a dashboard button, script, or automation.

### Displaying the race panel

The panel is automatically added to the **sidebar** under "Step Challenge".

To embed it directly in a **dashboard view** instead, use a Webpage card:

```yaml
type: iframe
url: /local/step_challenge/index.html
aspect_ratio: 75%
```

Or as a button that opens the panel in a new tab:

```yaml
show_name: true
show_icon: true
type: button
name: Step Challenge
icon: mdi:racing-helmet
tap_action:
  action: url
  url_path: /local/step_challenge/index.html
```

### Services

| Service | Description |
|---|---|
| `step_challenge.start` | Start (or restart) the challenge, reset all scores |
| `step_challenge.stop` | Stop the challenge early |
| `step_challenge.record_day` | Manually record today's stage winner |

---

## License

MIT © [Noack1978](https://github.com/Noack1978)
