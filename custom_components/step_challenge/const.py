"""Constants for Step Challenge."""

DOMAIN = "step_challenge"
STORAGE_KEY = f"{DOMAIN}.data"
STORAGE_VERSION = 1

PLATFORMS: list[str] = ["sensor"]

# Config / Options keys
CONF_CHALLENGE_NAME = "challenge_name"
CONF_DURATION_DAYS  = "duration_days"
CONF_PARTICIPANTS   = "participants"
CONF_RECORD_TIME    = "record_time"
# Each participant: {"key": str, "name": str, "entity": str}

# Services
SERVICE_START      = "start"
SERVICE_STOP       = "stop"
SERVICE_RECORD_DAY = "record_day"

# Automation managed by the integration
MANAGED_AUTOMATION_ID = f"{DOMAIN}_daily_stage"

# Defaults
DEFAULT_CHALLENGE_NAME = "Step Challenge"
DEFAULT_DURATION_DAYS  = 30
DEFAULT_RECORD_TIME    = "23:00:00"
MIN_PARTICIPANTS       = 2
MAX_HISTORY            = 365
