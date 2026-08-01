"""Sensors for Step Challenge."""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    CONF_CHALLENGE_NAME,
    CONF_DURATION_DAYS,
    CONF_PARTICIPANTS,
    CONF_RECORD_TIME,
    DEFAULT_DURATION_DAYS,
    DEFAULT_RECORD_TIME,
    DOMAIN,
)
from .coordinator import StepChallengeCoordinator

_LOGGER = logging.getLogger(__name__)



# ── Archive Sensor ────────────────────────────────────────────────────────────

class ChallengArchiveSensor(CoordinatorEntity[StepChallengeCoordinator], SensorEntity):
    """Dedicated sensor for archive data – updates independently of status sensor."""
    _attr_has_entity_name = True
    _attr_name            = "Archive"
    _attr_icon            = "mdi:archive"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id   = f"{DOMAIN}_{entry.entry_id}_archive"
        self._attr_device_info = _device(entry)

    @property
    def native_value(self) -> int:
        return len(self.coordinator.data.get("archive", []))

    @property
    def extra_state_attributes(self) -> dict:
        return {"challenges": self.coordinator.data.get("archive", [])}

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: StepChallengeCoordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    participants = entry.options.get(
        CONF_PARTICIPANTS, entry.data.get(CONF_PARTICIPANTS, [])
    )

    entities: list[SensorEntity] = [
        StageSensor(coordinator, entry, p) for p in participants
    ]
    entities.append(DaysElapsedSensor(coordinator, entry))
    entities.append(ChallengeStatusSensor(coordinator, entry))
    entities.append(LeaderSensor(coordinator, entry))
    entities.append(ChallengArchiveSensor(coordinator, entry))
    async_add_entities(entities)


def _device(entry: ConfigEntry) -> DeviceInfo:
    name = entry.options.get(
        CONF_CHALLENGE_NAME, entry.data.get(CONF_CHALLENGE_NAME, "Step Challenge")
    )
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=name,
        manufacturer="Noack1978",
        model="Step Challenge",
    )


# ── Stage Win Sensor ──────────────────────────────────────────────────────────

class StageSensor(CoordinatorEntity[StepChallengeCoordinator], SensorEntity):
    _attr_state_class     = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "stages"
    _attr_has_entity_name = True

    def __init__(self, coordinator, entry, participant):
        super().__init__(coordinator)
        self._entry       = entry
        self._participant = participant
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_stages_{participant['key']}"
        self._attr_name      = f"{participant['name']} Stage Wins"
        self._attr_device_info = _device(entry)

    @property
    def native_value(self) -> int:
        return self.coordinator.data.get("scores", {}).get(self._participant["key"], 0)

    @property
    def extra_state_attributes(self) -> dict:
        history = self.coordinator.data.get("history", [])
        won = [e["date"] for e in history if e.get("winner") == self._participant["key"]]
        return {
            "participant_key": self._participant["key"],
            "step_entity":     self._participant.get("entity", ""),
            "won_dates":       won,
        }


# ── Days Elapsed Sensor ───────────────────────────────────────────────────────

class DaysElapsedSensor(CoordinatorEntity[StepChallengeCoordinator], SensorEntity):
    _attr_state_class     = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "days"
    _attr_has_entity_name = True
    _attr_name            = "Days Elapsed"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id   = f"{DOMAIN}_{entry.entry_id}_days_elapsed"
        self._attr_device_info = _device(entry)

    def _duration(self) -> int:
        return int(self._entry.options.get(
            CONF_DURATION_DAYS,
            self._entry.data.get(CONF_DURATION_DAYS, DEFAULT_DURATION_DAYS),
        ))

    @property
    def native_value(self) -> int:
        start_iso = self.coordinator.data.get("start")
        if not start_iso:
            return 0
        try:
            start = datetime.fromisoformat(start_iso)
            now   = datetime.now(start.tzinfo)
            start_date = start.date()
            now_date   = now.date()
            elapsed = (now_date - start_date).days + 1
            return min(max(elapsed, 0), self._duration())
        except Exception:
            return 0

    @property
    def extra_state_attributes(self) -> dict:
        start_iso = self.coordinator.data.get("start")
        elapsed   = self.native_value
        duration  = self._duration()
        pct = min(round((elapsed / duration) * 100), 100) if duration else 0
        return {
            "start_date":    start_iso,
            "duration_days": duration,
            "progress_pct":  pct,
        }


# ── Status Sensor ─────────────────────────────────────────────────────────────

class ChallengeStatusSensor(CoordinatorEntity[StepChallengeCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_name            = "Status"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id   = f"{DOMAIN}_{entry.entry_id}_status"
        self._attr_device_info = _device(entry)

    def _challenge_name(self) -> str:
        return self._entry.options.get(
            CONF_CHALLENGE_NAME,
            self._entry.data.get(CONF_CHALLENGE_NAME, "Step Challenge"),
        )

    def _duration(self) -> int:
        return int(self._entry.options.get(
            CONF_DURATION_DAYS,
            self._entry.data.get(CONF_DURATION_DAYS, DEFAULT_DURATION_DAYS),
        ))

    def _record_time(self) -> str:
        return self._entry.options.get(
            CONF_RECORD_TIME,
            self._entry.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME),
        )

    @property
    def native_value(self) -> str:
        if not self.coordinator.data.get("active"):
            return "inactive"
        elapsed  = 0
        start_iso = self.coordinator.data.get("start")
        if start_iso:
            try:
                start = datetime.fromisoformat(start_iso)
                now   = datetime.now(start.tzinfo)
                elapsed = (now.date() - start.date()).days + 1
            except Exception:
                pass
        duration = self._duration()
        return "finished" if elapsed > duration else "active"

    @property
    def extra_state_attributes(self) -> dict:
        data = self.coordinator.data
        return {
            "friendly_name": self._challenge_name(),
            "record_time":   self._record_time(),
            "stages_recorded": len(data.get("history", [])),
            "history":       data.get("history", []),
        }


# ── Leader Sensor ─────────────────────────────────────────────────────────────

class LeaderSensor(CoordinatorEntity[StepChallengeCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_name            = "Leader"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id   = f"{DOMAIN}_{entry.entry_id}_leader"
        self._attr_device_info = _device(entry)

    @property
    def native_value(self) -> str | None:
        scores = self.coordinator.data.get("scores", {})
        if not scores:
            return None
        key = max(scores, key=lambda k: scores[k])
        participants = self._entry.options.get(
            CONF_PARTICIPANTS, self._entry.data.get(CONF_PARTICIPANTS, [])
        )
        p = next((p for p in participants if p["key"] == key), None)
        return p["name"] if p else key

    @property
    def extra_state_attributes(self) -> dict:
        return {"scores": self.coordinator.data.get("scores", {})}
