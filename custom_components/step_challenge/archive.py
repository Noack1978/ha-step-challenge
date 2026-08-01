"""Archive management for Step Challenge."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

ARCHIVE_KEY     = f"{DOMAIN}.archive"
ARCHIVE_VERSION = 1
ARCHIVE_WARN_AT = 10  # notify user when archive reaches this size


class ChallengeArchive:
    """Stores completed challenges persistently."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store(hass, ARCHIVE_VERSION, ARCHIVE_KEY)
        self._hass  = hass
        self._data: dict[str, Any] = {"challenges": []}

    async def async_load(self) -> None:
        loaded = await self._store.async_load()
        if loaded and isinstance(loaded, dict):
            self._data = loaded
        else:
            self._data = {"challenges": []}

    async def async_save(self) -> None:
        await self._store.async_save(self._data)

    @property
    def challenges(self) -> list[dict]:
        return self._data.get("challenges", [])

    async def async_archive(
        self,
        store_data: dict,
        challenge_name: str,
        participants: list[dict],
    ) -> None:
        """Archive current challenge data."""
        if not store_data.get("start"):
            return  # Nothing to archive

        scores = store_data.get("scores", {})
        # Resolve winner name
        winner_key = max(scores, key=lambda k: scores[k]) if scores else None
        winner_name = next(
            (p["name"] for p in participants if p["key"] == winner_key), winner_key
        ) if winner_key else "—"

        entry = {
            "id":          datetime.now().strftime("%Y%m%d%H%M%S"),
            "name":        challenge_name,
            "start":       store_data.get("start"),
            "archived_at": datetime.now().isoformat(),
            "winner":      winner_name,
            "participants": [
                {"key": p["key"], "name": p["name"],
                 "stages": scores.get(p["key"], 0)}
                for p in participants
            ],
            "scores":  scores,
            "history": store_data.get("history", []),
        }

        self._data.setdefault("challenges", []).append(entry)
        await self.async_save()
        _LOGGER.info("Step Challenge: archived '%s'", challenge_name)

        # Notify if archive is getting large
        count = len(self._data["challenges"])
        if count >= ARCHIVE_WARN_AT and count % ARCHIVE_WARN_AT == 0:
            from homeassistant.components.persistent_notification import async_create as pn
            pn(
                self._hass,
                title="Step Challenge – Archiv",
                message=(
                    f"Das Archiv enthält {count} abgeschlossene Challenges.\n\n"
                    f"Öffne das Step-Challenge-Panel und tippe auf ⚙️ um "
                    f"das Archiv zu bereinigen."
                ),
                notification_id=f"{DOMAIN}_archive_cleanup",
            )

    async def async_delete(self, challenge_ids: list[str]) -> int:
        """Delete challenges by id. Returns number deleted."""
        before = len(self._data["challenges"])
        self._data["challenges"] = [
            c for c in self._data["challenges"]
            if c.get("id") not in challenge_ids
        ]
        deleted = before - len(self._data["challenges"])
        if deleted:
            await self.async_save()
        return deleted
