"""JavaScript module registration for Step Challenge."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from ..const import CARD_FILENAME, INTEGRATION_VERSION, URL_BASE

_LOGGER = logging.getLogger(__name__)

_LOVELACE_STORAGE_KEY = "lovelace_resources"
_LOVELACE_STORAGE_VERSION = 1


class JSModuleRegistration:
    """Registers the Step Challenge card JS via HA storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def async_register(self) -> None:
        """Register static path and Lovelace resource."""
        await self._async_register_path()
        await self._async_register_resource()

    async def _async_register_path(self) -> None:
        try:
            await self.hass.http.async_register_static_paths(
                [StaticPathConfig(URL_BASE, str(Path(__file__).parent), False)]
            )
            _LOGGER.debug("Step Challenge: static path registered at %s", URL_BASE)
        except RuntimeError:
            _LOGGER.debug("Step Challenge: static path already registered")

    async def _async_register_resource(self) -> None:
        """Write resource entry directly to lovelace_resources storage."""
        store = Store(self.hass, _LOVELACE_STORAGE_VERSION, _LOVELACE_STORAGE_KEY)
        data = await store.async_load() or {"items": []}

        url = f"{URL_BASE}/{CARD_FILENAME}"
        versioned_url = f"{url}?v={INTEGRATION_VERSION}"

        items: list[dict] = data.get("items", [])

        # Check if already registered
        for item in items:
            if item.get("url", "").startswith(url):
                if item["url"] != versioned_url:
                    item["url"] = versioned_url
                    await store.async_save(data)
                    _LOGGER.info("Step Challenge: card updated to v%s", INTEGRATION_VERSION)
                return

        # Add new entry
        items.append({"id": f"{CARD_FILENAME}", "res_type": "module", "url": versioned_url})
        data["items"] = items
        await store.async_save(data)
        _LOGGER.info("Step Challenge: card registered (v%s)", INTEGRATION_VERSION)

    async def async_unregister(self) -> None:
        """Remove resource from lovelace_resources storage."""
        store = Store(self.hass, _LOVELACE_STORAGE_VERSION, _LOVELACE_STORAGE_KEY)
        data = await store.async_load()
        if not data:
            return

        url = f"{URL_BASE}/{CARD_FILENAME}"
        items = [i for i in data.get("items", []) if not i.get("url", "").startswith(url)]
        if len(items) != len(data.get("items", [])):
            data["items"] = items
            await store.async_save(data)
            _LOGGER.debug("Step Challenge: card resource removed")
