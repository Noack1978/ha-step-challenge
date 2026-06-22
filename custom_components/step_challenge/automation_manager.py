"""Manages the daily stage automation created by Step Challenge."""
from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN, MANAGED_AUTOMATION_ID, SERVICE_RECORD_DAY

_LOGGER = logging.getLogger(__name__)

_AUTOMATION_CONFIG = {
    "id": MANAGED_AUTOMATION_ID,
    "alias": "Step Challenge – Daily Stage",
    "description": (
        "Automatically records the daily stage winner. "
        "Managed by the Step Challenge integration – do not edit manually."
    ),
    "trigger": [{"platform": "time", "at": "23:00:00"}],  # overwritten at runtime
    "condition": [],
    "action": [{"service": f"{DOMAIN}.{SERVICE_RECORD_DAY}", "data": {}}],
    "mode": "single",
}


async def async_ensure_automation(hass: HomeAssistant, record_time: str = "23:00:00") -> None:
    """Create or update the daily automation with the configured time."""
    try:
        from homeassistant.components.automation.config import (  # noqa: PLC0415
            AutomationStorageCollection,
        )
        collection: AutomationStorageCollection | None = hass.data.get(
            "automation_storage_collection"
        )
        if collection is not None:
            existing_ids = {item["id"] for item in collection.async_items()}
            config = dict(_AUTOMATION_CONFIG)
            config["trigger"] = [{"platform": "time", "at": record_time}]

            if MANAGED_AUTOMATION_ID in existing_ids:
                # Update time if changed
                for item in collection.async_items():
                    if item.get("id") == MANAGED_AUTOMATION_ID:
                        current_time = (item.get("trigger") or [{}])[0].get("at", "")
                        if current_time != record_time:
                            await collection.async_update_item(
                                item[collection.id_manager.id_key], config
                            )
                            _LOGGER.info(
                                "Step Challenge: automation time updated to %s", record_time
                            )
                        return
            else:
                await collection.async_create_item(config)
                _LOGGER.info(
                    "Step Challenge: daily automation created at %s", record_time
                )
            return
    except Exception as exc:
        _LOGGER.debug(
            "Step Challenge: automation collection unavailable (%s) – skipping auto-create",
            exc,
        )

    _LOGGER.info(
        "Step Challenge: automatic automation creation not available. "
        "Import the blueprint from blueprints/automation/step_challenge/daily_stage.yaml "
        "and set the time to %s.",
        record_time,
    )


async def async_remove_automation(hass: HomeAssistant) -> None:
    """Remove the managed automation on unload."""
    try:
        from homeassistant.components.automation.config import (  # noqa: PLC0415
            AutomationStorageCollection,
        )
        collection: AutomationStorageCollection | None = hass.data.get(
            "automation_storage_collection"
        )
        if collection is not None:
            for item in collection.async_items():
                if item.get("id") == MANAGED_AUTOMATION_ID:
                    await collection.async_delete_item(
                        item[collection.id_manager.id_key]
                    )
                    _LOGGER.info("Step Challenge: daily automation removed")
                    return
    except Exception as exc:
        _LOGGER.debug("Step Challenge: could not remove automation (%s)", exc)
