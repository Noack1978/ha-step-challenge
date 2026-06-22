"""Step Challenge Integration for Home Assistant."""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.persistent_notification import async_create as pn_create
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, ServiceCall
from homeassistant.util.dt import now as ha_now

from .const import (
    CONF_PARTICIPANTS,
    CONF_RECORD_TIME,
    DEFAULT_RECORD_TIME,
    DOMAIN,
    INTEGRATION_VERSION,
    PLATFORMS,
    SERVICE_RECORD_DAY,
    SERVICE_START,
    SERVICE_STOP,
)
from .frontend import JSModuleRegistration
from .storage import ChallengeStore

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register the Lovelace card resource once (not per config entry)."""
    hass.data.setdefault(DOMAIN, {})

    async def _register_frontend(_event=None) -> None:
        registrar = JSModuleRegistration(hass)
        await registrar.async_register()
        hass.data[DOMAIN]["js_registrar"] = registrar

    if hass.state is CoreState.running:
        await _register_frontend()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register_frontend)

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Step Challenge from a config entry."""
    store = ChallengeStore(hass)
    await store.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"store": store}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register sidebar panel as a Lovelace dashboard containing the custom card
    try:
        async_register_built_in_panel(
            hass,
            component_name="lovelace",
            sidebar_title="Step Challenge",
            sidebar_icon="mdi:racing-helmet",
            frontend_url_path=DOMAIN,
            config={
                "mode": "storage",
                "id": f"{DOMAIN}_panel",
            },
            require_admin=False,
        )
    except Exception:  # noqa: BLE001
        pass  # Already registered after reload

    _register_services(hass, entry)

    # Notify user about blueprint setup
    record_time = entry.options.get(
        CONF_RECORD_TIME,
        entry.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME),
    )
    pn_create(
        hass,
        title="Step Challenge",
        message=(
            f"✅ Step Challenge is ready!\n\n"
            f"**Next step:** Import the blueprint for automatic daily evaluation "
            f"at **{record_time}**.\n\n"
            f"Go to *Settings → Automations → Blueprints → Import Blueprint* and use:\n"
            f"`https://github.com/Noack1978/ha-step-challenge/blob/main/"
            f"blueprints/automation/step_challenge/daily_stage.yaml`\n\n"
            f"The race panel is available in the sidebar under **Step Challenge** "
            f"or add a `custom:step-challenge-card` to any dashboard."
        ),
        notification_id=f"{DOMAIN}_setup_hint",
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        # Remove panel when last entry is gone
        remaining = [k for k in hass.data[DOMAIN] if k != "js_registrar"]
        if not remaining:
            from homeassistant.components.frontend import async_remove_panel
            try:
                async_remove_panel(hass, DOMAIN)
            except Exception:  # noqa: BLE001
                pass
            # Unregister JS resource
            registrar = hass.data[DOMAIN].get("js_registrar")
            if registrar:
                await registrar.async_unregister()
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


# ── Services ──────────────────────────────────────────────────────────────────

def _register_services(hass: HomeAssistant, entry: ConfigEntry) -> None:

    def _store(entry_id: str) -> ChallengeStore:
        return hass.data[DOMAIN][entry_id]["store"]

    def _participants(entry_id: str) -> list[dict]:
        e = hass.config_entries.async_get_entry(entry_id)
        return e.options.get(CONF_PARTICIPANTS, e.data.get(CONF_PARTICIPANTS, []))

    def _entry_ids() -> list[str]:
        return [k for k in hass.data[DOMAIN] if k != "js_registrar"]

    async def _start(call: ServiceCall) -> None:
        for entry_id in _entry_ids():
            store  = _store(entry_id)
            parts  = _participants(entry_id)
            store.reset(
                participant_keys=[p["key"] for p in parts],
                start_iso=ha_now().isoformat(),
            )
            await store.async_save()
        hass.bus.async_fire(f"{DOMAIN}_started")
        _LOGGER.info("Step Challenge started")

    async def _stop(call: ServiceCall) -> None:
        for entry_id in _entry_ids():
            _store(entry_id).stop()
            await _store(entry_id).async_save()
        hass.bus.async_fire(f"{DOMAIN}_stopped")
        _LOGGER.info("Step Challenge stopped")

    async def _record_day(call: ServiceCall) -> None:
        for entry_id in _entry_ids():
            store = _store(entry_id)
            if not store.active:
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
                {"winner": winner_key, "winner_name": winner_name,
                 "steps": steps, "date": date_str},
            )
            pn_create(
                hass,
                title="Step Challenge",
                message=f"🏆 {winner_name} wins today's stage with {steps[winner_key]:,} steps!",
                notification_id=f"{DOMAIN}_stage_{date_str}",
            )
            _LOGGER.info("Step Challenge: winner %s (%s steps)", winner_name, steps[winner_key])

        hass.bus.async_fire(f"{DOMAIN}_data_updated")

    if not hass.services.has_service(DOMAIN, SERVICE_START):
        hass.services.async_register(DOMAIN, SERVICE_START, _start)
    if not hass.services.has_service(DOMAIN, SERVICE_STOP):
        hass.services.async_register(DOMAIN, SERVICE_STOP, _stop)
    if not hass.services.has_service(DOMAIN, SERVICE_RECORD_DAY):
        hass.services.async_register(DOMAIN, SERVICE_RECORD_DAY, _record_day)
