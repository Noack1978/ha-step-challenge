"""Sensor platform for Step Challenge."""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_CHALLENGE_NAME, CONF_DURATION_DAYS, CONF_PARTICIPANTS, DOMAIN
from .storage import ChallengeStore

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    participants = entry.options.get(
        CONF_PARTICIPANTS, entry.data.get(CONF_PARTICIPANTS, [])
    )
    entities: list[SensorEntity] = (
        [StageWinSensor(hass, entry, p) for p in participants]
        + [
            DaysElapsedSensor(hass, entry),
            ChallengeStatusSensor(hass, entry),
            LeaderSensor(hass, entry, participants),
        ]
    )
    async_add_entities(entities, True)


# ── Base ──────────────────────────────────────────────────────────────────────

class _Base(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry

    @property
    def _store(self) -> ChallengeStore:
        return self.hass.data[DOMAIN][self._entry.entry_id]["store"]

    @property
    def device_info(self) -> dict:
        name = self._entry.options.get(
            CONF_CHALLENGE_NAME,
            self._entry.data.get(CONF_CHALLENGE_NAME, "Step Challenge"),
        )
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": name,
            "manufacturer": "Step Challenge",
            "model": "Step Challenge",
        }

    async def async_added_to_hass(self) -> None:
        for event in (
            f"{DOMAIN}_data_updated",
            f"{DOMAIN}_started",
            f"{DOMAIN}_stopped",
        ):
            self.async_on_remove(
                self.hass.bus.async_listen(event, self._refresh)
            )

    @callback
    def _refresh(self, _event=None) -> None:
        self.async_write_ha_state()


# ── Stage wins per participant ────────────────────────────────────────────────

class StageWinSensor(_Base):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, participant: dict) -> None:
        super().__init__(hass, entry)
        self._p = participant
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_stages_{participant['key']}"
        self._attr_name = f"{participant['name']} Stage Wins"
        self._attr_icon = "mdi:podium-gold"
        # MEASUREMENT because scores can be reset when a new challenge starts
        self._attr_state_class = SensorStateClass.MEASUREMENT
        self._attr_native_unit_of_measurement = "stages"

    @property
    def native_value(self) -> int:
        return self._store.scores.get(self._p["key"], 0)

    @property
    def extra_state_attributes(self) -> dict:
        won = [h["date"] for h in self._store.history if h.get("winner") == self._p["key"]]
        return {
            "participant_key": self._p["key"],
            "step_entity": self._p["entity"],
            "won_dates": won,
        }


# ── Days elapsed ──────────────────────────────────────────────────────────────

class DaysElapsedSensor(_Base):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_days_elapsed"
        self._attr_name = "Days Elapsed"
        self._attr_icon = "mdi:calendar-clock"
        self._attr_native_unit_of_measurement = "days"
        self._attr_state_class = SensorStateClass.MEASUREMENT

    def _duration(self) -> int:
        return int(
            self._entry.options.get(
                CONF_DURATION_DAYS,
                self._entry.data.get(CONF_DURATION_DAYS, 30),
            )
        )

    @property
    def native_value(self) -> int:
        if not self._store.start:
            return 0
        try:
            start = datetime.fromisoformat(self._store.start)
            elapsed = (datetime.now(start.tzinfo) - start).days
            return min(max(elapsed, 0), self._duration())
        except (ValueError, TypeError):
            return 0

    @property
    def extra_state_attributes(self) -> dict:
        duration = self._duration()
        elapsed = self.native_value
        return {
            "duration_days": duration,
            "days_remaining": max(0, duration - elapsed),
            "progress_pct": round((elapsed / duration) * 100) if duration else 0,
            "start_date": self._store.start,
        }


# ── Status ────────────────────────────────────────────────────────────────────

class ChallengeStatusSensor(_Base):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(hass, entry)
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_status"
        self._attr_name = "Status"
        self._attr_icon = "mdi:flag-checkered"

    @property
    def native_value(self) -> str:
        if not self._store.active or not self._store.start:
            return "inactive"
        try:
            start = datetime.fromisoformat(self._store.start)
            elapsed = (datetime.now(start.tzinfo) - start).days
            duration = int(
                self._entry.options.get(
                    CONF_DURATION_DAYS,
                    self._entry.data.get(CONF_DURATION_DAYS, 30),
                )
            )
            return "finished" if elapsed >= duration else "active"
        except (ValueError, TypeError):
            return "inactive"

    @property
    def extra_state_attributes(self) -> dict:
        return {
            "start": self._store.start,
            "stages_recorded": len(self._store.history),
        }


# ── Leader ────────────────────────────────────────────────────────────────────

class LeaderSensor(_Base):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, participants: list[dict]) -> None:
        super().__init__(hass, entry)
        self._participants = participants
        self._attr_unique_id = f"{DOMAIN}_{entry.entry_id}_leader"
        self._attr_name = "Current Leader"
        self._attr_icon = "mdi:trophy"

    @property
    def native_value(self) -> str:
        scores = self._store.scores
        if not scores or all(v == 0 for v in scores.values()):
            return "—"
        best = max(scores, key=lambda k: scores[k])
        p = next((p for p in self._participants if p["key"] == best), None)
        return p["name"] if p else best

    @property
    def extra_state_attributes(self) -> dict:
        scores = self._store.scores
        return {
            "scores": {p["name"]: scores.get(p["key"], 0) for p in self._participants}
        }
