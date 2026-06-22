"""Manages the daily stage automation created by Step Challenge."""
from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant

from .const import DOMAIN, MANAGED_AUTOMATION_ID, SERVICE_RECORD_DAY

_LOGGER = logging.getLogger(__name__)

# The automation config we inject into HA's automation registry
_AUTOMATION_CONFIG = {
    "id": MANAGED_AUTOMATION_ID,
    "alias": "Step Challenge – Daily Stage",
    "description": (
        "Automatically records the daily stage winner at 00:01. "
        "Managed by the Step Challenge integration – do not edit manually."
    ),
    "trigger": [{"platform": "time", "at": "00:01:00"}],
    "condition": [],
    "action": [
        {
            "service": f"{DOMAIN}.{SERVICE_RECORD_DAY}",
            "data": {},
        }
    ],
    "mode": "single",
}


async def async_ensure_automation(hass: HomeAssistant) -> None:
    """Create the daily automation if it does not exist yet."""
    automations: list[dict] = hass.data.get("automations", [])

    # Check via entity registry whether our automation already exists
    entity_registry = hass.helpers.entity_registry.async_get(hass)
    existing = next(
        (
            e
            for e in entity_registry.entities.values()
            if e.platform == "automation"
            and e.unique_id == MANAGED_AUTOMATION_ID
        ),
        None,
    )
    if existing:
        _LOGGER.debug("Step Challenge: managed automation already present")
        return

    try:
        await hass.services.async_call(
            "automation",
            "reload",
            {},
            blocking=False,
        )
    except Exception:
        pass

    # Write via storage directly (supported public API since HA 2023.x)
    try:
        from homeassistant.components.automation import (
            AutomationStorageCollection,
        )
        collection: AutomationStorageCollection = hass.data.get(
            "automation_storage_collection"
        )
        if collection is not None:
            existing_ids = {item["id"] for item in collection.async_items()}
            if MANAGED_AUTOMATION_ID not in existing_ids:
                await collection.async_create_item(_AUTOMATION_CONFIG)
                _LOGGER.info("Step Challenge: daily stage automation created")
            return
    except Exception as exc:
        _LOGGER.debug("Step Challenge: automation collection not available (%s), using fallback", exc)

    # Fallback: write into automations.yaml via config entry helper
    # (works on standard HA OS installations)
    try:
        await hass.services.async_call(
            "automation",
            "create",
            _AUTOMATION_CONFIG,
            blocking=True,
        )
        _LOGGER.info("Step Challenge: daily stage automation created via service")
    except Exception as exc:
        _LOGGER.warning(
            "Step Challenge: could not create daily automation automatically (%s). "
            "Please import the blueprint manually from the integration's blueprints/ folder.",
            exc,
        )


async def async_remove_automation(hass: HomeAssistant) -> None:
    """Remove the managed automation when the integration is unloaded."""
    try:
        from homeassistant.components.automation import (
            AutomationStorageCollection,
        )
        collection: AutomationStorageCollection = hass.data.get(
            "automation_storage_collection"
        )
        if collection is not None:
            for item in collection.async_items():
                if item.get("id") == MANAGED_AUTOMATION_ID:
                    await collection.async_delete_item(item[collection.id_manager.id_key])
                    _LOGGER.info("Step Challenge: daily stage automation removed")
                    return
    except Exception as exc:
        _LOGGER.debug("Step Challenge: could not remove automation (%s)", exc)
