"""Step Challenge Integration for Home Assistant."""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.persistent_notification import async_create as pn_create
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant, ServiceCall, callback
from homeassistant.util.dt import now as ha_now

from .const import (
    CARD_FILE,
    CONF_PARTICIPANTS,
    CONF_RECORD_TIME,
    CONF_SHOW_BLUEPRINT_HINT,
    DEFAULT_RECORD_TIME,
    DEFAULT_SHOW_BLUEPRINT_HINT,
    DOMAIN,
    INTEGRATION_VERSION,
    PANEL_NAME,
    PANEL_URL,
    PLATFORMS,
    SERVICE_RECORD_DAY,
    SERVICE_START,
    SERVICE_STOP,
    STATIC_URL,
)
from .storage import ChallengeStore

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register static path for the card JS (once at startup)."""
    frontend_dir = Path(__file__).parent / "frontend"
    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(frontend_dir), cache_headers=False)]
        )
        _LOGGER.debug("Step Challenge: static path registered at %s", STATIC_URL)
    except RuntimeError:
        _LOGGER.debug("Step Challenge: static path already registered")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Step Challenge from a config entry."""
    store = ChallengeStore(hass)
    await store.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"store": store}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    @callback
    def _register_panel(_event=None) -> None:
        if PANEL_URL in hass.data.get("frontend_panels", {}):
            return
        try:
            async_register_built_in_panel(
                hass,
                component_name="custom",
                sidebar_title="Step Challenge",
                sidebar_icon="mdi:racing-helmet",
                frontend_url_path=PANEL_URL,
                config={
                    "_panel_custom": {
                        "name": PANEL_NAME,
                        "embed_iframe": False,
                        "trust_external": False,
                        "module_url": f"{STATIC_URL}/{CARD_FILE}?v={INTEGRATION_VERSION}",
                    }
                },
                require_admin=False,
            )
            _LOGGER.info("Step Challenge: panel registered at /%s", PANEL_URL)
        except Exception as err:  # noqa: BLE001
            _LOGGER.error("Step Challenge: could not register panel: %s", err)

    if hass.state is CoreState.running:
        _register_panel()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register_panel)

    _register_services(hass, entry)

    record_time = entry.options.get(
        CONF_RECORD_TIME,
        entry.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME),
    )
    show_hint = entry.options.get(
        CONF_SHOW_BLUEPRINT_HINT,
        entry.data.get(CONF_SHOW_BLUEPRINT_HINT, DEFAULT_SHOW_BLUEPRINT_HINT),
    )
    if show_hint:
        pn_create(
            hass,
            title="Step Challenge",
            message=(
                f"✅ Step Challenge ist bereit!\n\n"
                f"Blueprint importieren für die tägliche Auswertung um **{record_time}**:\n"
                f"*Einstellungen → Automationen → Blueprints → Blueprint importieren*\n\n"
                f"`https://github.com/Noack1978/ha-step-challenge/blob/main/"
                f"blueprints/automation/step_challenge/daily_stage.yaml`\n\n"
                f"Diesen Hinweis deaktivieren: *Konfigurieren → Challenge-Einstellungen*"
            ),
            notification_id=f"{DOMAIN}_setup_hint",
        )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            from homeassistant.components.frontend import async_remove_panel
            try:
                async_remove_panel(hass, PANEL_URL)
            except Exception:  # noqa: BLE001
                pass
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
        return list(hass.data[DOMAIN].keys())

    async def _start(call: ServiceCall) -> None:
        for entry_id in _entry_ids():
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
        for entry_id in _entry_ids():
            _store(entry_id).stop()
            await _store(entry_id).async_save()
        hass.bus.async_fire(f"{DOMAIN}_stopped")

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
                _LOGGER.warning("Step Challenge: no valid step data")
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
