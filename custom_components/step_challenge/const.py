"""Constants for Step Challenge."""
from pathlib import Path
import json
from typing import Final

try:
    _manifest = json.loads((Path(__file__).parent / "manifest.json").read_text(encoding="utf-8"))
    INTEGRATION_VERSION: Final[str] = _manifest.get("version", "1.1.2")
except Exception:
    INTEGRATION_VERSION = "1.1.2"

DOMAIN: Final[str] = "step_challenge"
STORAGE_KEY: Final[str] = f"{DOMAIN}.data"
STORAGE_VERSION: Final[int] = 1

PLATFORMS: Final[list[str]] = ["sensor"]

# Frontend
PANEL_NAME: Final[str] = "step-challenge-card"
PANEL_URL: Final[str]  = "step-challenge"
STATIC_URL: Final[str] = f"/{DOMAIN}-static"
CARD_FILE: Final[str]  = "step-challenge-card.js"

# Config / Options keys
CONF_CHALLENGE_NAME: Final[str]              = "challenge_name"
CONF_DURATION_DAYS: Final[str]               = "duration_days"
CONF_PARTICIPANTS: Final[str]                = "participants"
CONF_RECORD_TIME: Final[str]                 = "record_time"
CONF_SHOW_BLUEPRINT_HINT: Final[str]         = "show_blueprint_hint"

# Services
SERVICE_START: Final[str]      = "start"
SERVICE_STOP: Final[str]       = "stop"
SERVICE_RECORD_DAY: Final[str] = "record_day"

# Defaults
DEFAULT_CHALLENGE_NAME: Final[str]    = "Step Challenge"
DEFAULT_DURATION_DAYS: Final[int]     = 30
DEFAULT_RECORD_TIME: Final[str]       = "23:00:00"
DEFAULT_SHOW_BLUEPRINT_HINT: Final[bool] = True
MIN_PARTICIPANTS: Final[int]          = 2
MAX_HISTORY: Final[int]               = 365
