"""DataUpdateCoordinator for Step Challenge."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .archive import ChallengeArchive
from .const import DOMAIN
from .storage import ChallengeStore

_LOGGER = logging.getLogger(__name__)


class StepChallengeCoordinator(DataUpdateCoordinator):
    """Koordiniert Store- und Archiv-Daten für Step Challenge."""

    def __init__(
        self,
        hass: HomeAssistant,
        store: ChallengeStore,
        archive: ChallengeArchive,
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=5),
        )
        self.store   = store
        self.archive = archive

    async def _async_update_data(self) -> dict:
        """Return current store + archive data."""
        return {
            "active":   self.store.active,
            "start":    self.store.start,
            "scores":   self.store.scores,
            "history":  self.store.history,
            "archive":  self.archive.challenges,
        }

    def async_force_refresh(self) -> None:
        """Force immediate update of all listeners (sensors/cards)."""
        self.async_set_updated_data({
            "active":   self.store.active,
            "start":    self.store.start,
            "scores":   self.store.scores,
            "history":  self.store.history,
            "archive":  self.archive.challenges,
        })
