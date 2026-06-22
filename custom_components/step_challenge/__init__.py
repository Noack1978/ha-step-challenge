"""Step Challenge Integration for Home Assistant."""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, ServiceCall
from homeassistant.util.dt import now as ha_now

from .automation_manager import async_ensure_automation, async_remove_automation
from .const import (
    CONF_PARTICIPANTS,
    DOMAIN,
    PLATFORMS,
    SERVICE_RECORD_DAY,
    SERVICE_START,
    SERVICE_STOP,
)
from .panel import async_register_panel, async_remove_panel
from .storage import ChallengeStore

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Step Challenge from a config entry."""
    store = ChallengeStore(hass)
    await store.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"store": store, "entry": entry}

    # Forward to sensor platform
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register services (idempotent)
    _register_services(hass, entry)

    # Panel + automation: register after HA has fully started to avoid
    # race conditions with the frontend and automation component
    async def _on_ha_started(_event=None) -> None:
        await async_register_panel(hass)
        await async_ensure_automation(hass)

    if hass.state is CoreState.running:
        await _on_ha_started()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _on_ha_started)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        async_remove_panel(hass)
        # Only remove automation when no more entries remain
        if not hass.data[DOMAIN]:
            await async_remove_automation(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


# ── Services ──────────────────────────────────────────────────────────────────

def _register_services(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Register integration-level services (once per domain)."""

    def _store(entry_id: str) -> ChallengeStore:
        return hass.data[DOMAIN][entry_id]["store"]

    def _participants(entry_id: str) -> list[dict]:
        e = hass.config_entries.async_get_entry(entry_id)
        return e.options.get(CONF_PARTICIPANTS, e.data.get(CONF_PARTICIPANTS, []))

    async def _start(call: ServiceCall) -> None:
        for entry_id in hass.data[DOMAIN]:
            store = _store(entry_id)
            parts = _participants(entry_id)
            store.reset(
                participant_keys=[p["key"] for p in parts],
                start_iso=ha_now().isoformat(),
            )
            await store.async_save()
        hass.bus.async_fire(f"{DOMAIN}_started")
        _LOGGER.info("Step Challenge started")

    async def _stop(call: ServiceCall) -> None:
        for entry_id in hass.data[DOMAIN]:
            store = _store(entry_id)
            store.stop()
            await store.async_save()
        hass.bus.async_fire(f"{DOMAIN}_stopped")
        _LOGGER.info("Step Challenge stopped")

    async def _record_day(call: ServiceCall) -> None:
        for entry_id in hass.data[DOMAIN]:
            store = _store(entry_id)
            if not store.active:
                _LOGGER.debug("Step Challenge: not active, skipping record_day")
                continue

            parts = _participants(entry_id)
            steps: dict[str, int] = {}
            for p in parts:
                state = hass.states.get(p["entity"])
                try:
                    steps[p["key"]] = (
                        int(float(state.state))
                        if state and state.state not in ("unknown", "unavailable")
                        else 0
                    )
                except (ValueError, TypeError):
                    steps[p["key"]] = 0

            if not steps or all(v == 0 for v in steps.values()):
                _LOGGER.warning("Step Challenge: no valid step data for record_day")
                continue

            winner_key = max(steps, key=lambda k: steps[k])
            winner_name = next(
                (p["name"] for p in parts if p["key"] == winner_key), winner_key
            )
            date_str = datetime.now().strftime("%Y-%m-%d")

            store.record_stage(date_str, winner_key, steps)
            await store.async_save()

            hass.bus.async_fire(
                f"{DOMAIN}_stage_won",
                {
                    "winner": winner_key,
                    "winner_name": winner_name,
                    "steps": steps,
                    "date": date_str,
                },
            )

            hass.components.persistent_notification.async_create(
                title="Step Challenge",
                message=(
                    f"🏆 {winner_name} wins today's stage "
                    f"with {steps[winner_key]:,} steps!"
                ),
                notification_id=f"{DOMAIN}_stage_{date_str}",
            )
            _LOGGER.info(
                "Step Challenge stage winner: %s (%s steps)",
                winner_name,
                steps[winner_key],
            )

        # Notify sensors to update
        hass.bus.async_fire(f"{DOMAIN}_data_updated")

    if not hass.services.has_service(DOMAIN, SERVICE_START):
        hass.services.async_register(DOMAIN, SERVICE_START, _start)
    if not hass.services.has_service(DOMAIN, SERVICE_STOP):
        hass.services.async_register(DOMAIN, SERVICE_STOP, _stop)
    if not hass.services.has_service(DOMAIN, SERVICE_RECORD_DAY):
        hass.services.async_register(DOMAIN, SERVICE_RECORD_DAY, _record_day)
