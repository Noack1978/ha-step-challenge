"""JavaScript module registration for Step Challenge."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from ..const import CARD_FILENAME, INTEGRATION_VERSION, URL_BASE

_LOGGER = logging.getLogger(__name__)


class JSModuleRegistration:
    """Registers the Step Challenge card JS in Lovelace resources."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.lovelace = hass.data.get("lovelace")

    async def async_register(self) -> None:
        """Register static path and Lovelace resource."""
        await self._async_register_path()
        if self.lovelace and self.lovelace.mode == "storage":
            await self._async_wait_for_resources()

    async def _async_register_path(self) -> None:
        try:
            await self.hass.http.async_register_static_paths(
                [StaticPathConfig(URL_BASE, str(Path(__file__).parent), False)]
            )
            _LOGGER.debug("Step Challenge: static path registered at %s", URL_BASE)
        except RuntimeError:
            _LOGGER.debug("Step Challenge: static path already registered")

    async def _async_wait_for_resources(self) -> None:
        async def _check(_now: Any = None) -> None:
            if self.lovelace.resources.loaded:
                await self._async_register_resource()
            else:
                _LOGGER.debug("Step Challenge: Lovelace resources not loaded yet, retrying in 5s")
                async_call_later(self.hass, 5, _check)

        await _check()

    async def _async_register_resource(self) -> None:
        url = f"{URL_BASE}/{CARD_FILENAME}"
        versioned_url = f"{url}?v={INTEGRATION_VERSION}"

        existing = [
            r for r in self.lovelace.resources.async_items()
            if r["url"].startswith(url)
        ]

        if existing:
            resource = existing[0]
            current_version = resource["url"].split("?v=")[-1] if "?v=" in resource["url"] else "0"
            if current_version != INTEGRATION_VERSION:
                await self.lovelace.resources.async_update_item(
                    resource["id"],
                    {"res_type": "module", "url": versioned_url},
                )
                _LOGGER.info("Step Challenge: card updated to v%s", INTEGRATION_VERSION)
        else:
            await self.lovelace.resources.async_create_item(
                {"res_type": "module", "url": versioned_url}
            )
            _LOGGER.info("Step Challenge: card registered (v%s)", INTEGRATION_VERSION)

    async def async_unregister(self) -> None:
        """Remove Lovelace resource on unload."""
        if not self.lovelace or self.lovelace.mode != "storage":
            return
        url = f"{URL_BASE}/{CARD_FILENAME}"
        for resource in self.lovelace.resources.async_items():
            if resource["url"].startswith(url):
                await self.lovelace.resources.async_delete_item(resource["id"])
                _LOGGER.debug("Step Challenge: card resource removed")
