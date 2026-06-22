"""Storage helpers for Step Challenge."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION, MAX_HISTORY

_LOGGER = logging.getLogger(__name__)

_EMPTY: dict[str, Any] = {
    "active": False,
    "start": None,
    "scores": {},
    "history": [],
}


class ChallengeStore:
    """Thin wrapper around HA persistent storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = dict(_EMPTY)

    async def async_load(self) -> None:
        loaded = await self._store.async_load()
        if loaded and isinstance(loaded, dict):
            self._data = loaded
        else:
            self._data = dict(_EMPTY)

    async def async_save(self) -> None:
        await self._store.async_save(self._data)

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def active(self) -> bool:
        return bool(self._data.get("active"))

    @property
    def start(self) -> str | None:
        return self._data.get("start")

    @property
    def scores(self) -> dict[str, int]:
        return self._data.get("scores", {})

    @property
    def history(self) -> list[dict]:
        return self._data.get("history", [])

    @property
    def data(self) -> dict[str, Any]:
        return self._data

    # ── Mutations ─────────────────────────────────────────────────────────────

    def reset(self, participant_keys: list[str], start_iso: str) -> None:
        self._data = {
            "active": True,
            "start": start_iso,
            "scores": {k: 0 for k in participant_keys},
            "history": [],
        }

    def stop(self) -> None:
        self._data["active"] = False

    def record_stage(self, date_str: str, winner_key: str, steps: dict[str, int]) -> None:
        """Add or update a stage result."""
        history: list = self._data.setdefault("history", [])
        existing = next((h for h in history if h.get("date") == date_str), None)
        if existing:
            existing.update({"winner": winner_key, "steps": steps})
        else:
            history.append({"date": date_str, "winner": winner_key, "steps": steps})
            scores = self._data.setdefault("scores", {})
            scores[winner_key] = scores.get(winner_key, 0) + 1
        # Cap history length
        self._data["history"] = history[-MAX_HISTORY:]
