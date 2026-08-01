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
import voluptuous as vol
import homeassistant.helpers.config_validation as cv

from .archive import ChallengeArchive
from .coordinator import StepChallengeCoordinator
from .const import (
    CARD_FILE,
    CONF_CHALLENGE_NAME,
    CONF_DURATION_DAYS,
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

SERVICE_ARCHIVE         = "archive_challenge"
SERVICE_ADD_PARTICIPANT    = "add_participant"
SERVICE_REMOVE_PARTICIPANT = "remove_participant"
SERVICE_DELETE_ARCHIVE = "delete_archive_entries"
SERVICE_UPDATE_SETTINGS = "update_settings"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    frontend_dir = Path(__file__).parent / "frontend"
    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(frontend_dir), cache_headers=False)]
        )
    except RuntimeError:
        pass
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store   = ChallengeStore(hass)
    archive = ChallengeArchive(hass)
    await store.async_load()
    await archive.async_load()

    coordinator = StepChallengeCoordinator(hass, store, archive)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"store": store, "archive": archive, "coordinator": coordinator}

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
        except Exception as err:  # noqa: BLE001
            _LOGGER.error("Step Challenge: panel registration failed: %s", err)

    if hass.state is CoreState.running:
        _register_panel()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register_panel)

    _register_services(hass, entry)

    record_time = entry.options.get(
        CONF_RECORD_TIME, entry.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME)
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

    def _archive(entry_id: str) -> ChallengeArchive:
        return hass.data[DOMAIN][entry_id]["archive"]

    def _coordinator(entry_id: str) -> StepChallengeCoordinator:
        return hass.data[DOMAIN][entry_id]["coordinator"]

    def _refresh_all() -> None:
        for eid in _entry_ids():
            _coordinator(eid).async_force_refresh()

    def _participants(entry_id: str) -> list[dict]:
        e = hass.config_entries.async_get_entry(entry_id)
        return e.options.get(CONF_PARTICIPANTS, e.data.get(CONF_PARTICIPANTS, []))

    def _challenge_name(entry_id: str) -> str:
        e = hass.config_entries.async_get_entry(entry_id)
        return e.options.get(CONF_CHALLENGE_NAME, e.data.get(CONF_CHALLENGE_NAME, "Step Challenge"))

    def _entry_ids() -> list[str]:
        return [k for k in hass.data[DOMAIN] if isinstance(hass.data[DOMAIN][k], dict) and "store" in hass.data[DOMAIN][k]]

    async def _do_archive(entry_id: str) -> None:
        store = _store(entry_id)
        await _archive(entry_id).async_archive(
            store_data=store.data,
            challenge_name=_challenge_name(entry_id),
            participants=_participants(entry_id),
        )

    async def _start(call: ServiceCall) -> None:
        for entry_id in _entry_ids():
            store = _store(entry_id)
            # Archive current challenge before reset
            if store.active or store.start:
                await _do_archive(entry_id)
            parts = _participants(entry_id)
            store.reset(
                participant_keys=[p["key"] for p in parts],
                start_iso=ha_now().isoformat(),
            )
            await store.async_save()
        hass.bus.async_fire(f"{DOMAIN}_started")
        _refresh_all()
        _LOGGER.info("Step Challenge started")

    async def _stop(call: ServiceCall) -> None:
        for entry_id in _entry_ids():
            _store(entry_id).stop()
            await _store(entry_id).async_save()
        hass.bus.async_fire(f"{DOMAIN}_stopped")
        _refresh_all()

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

            winner_key  = max(steps, key=lambda k: steps[k])
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
        _refresh_all()

    async def _archive_challenge(call: ServiceCall) -> None:
        """Manually archive current challenge."""
        for entry_id in _entry_ids():
            await _do_archive(entry_id)
        hass.bus.async_fire(f"{DOMAIN}_archived")
        _refresh_all()
        _LOGGER.info("Step Challenge: manually archived")

    async def _delete_archive(call: ServiceCall) -> None:
        """Delete specific archive entries by id."""
        ids = call.data.get("ids", [])
        for entry_id in _entry_ids():
            deleted = await _archive(entry_id).async_delete(ids)
            _LOGGER.info("Step Challenge: deleted %d archive entries", deleted)
        hass.bus.async_fire(f"{DOMAIN}_archive_updated")
        _refresh_all()

    async def _update_settings(call: ServiceCall) -> None:
        """Update challenge settings (name, duration, record_time) from panel."""
        new_name     = call.data.get("challenge_name")
        new_duration = call.data.get("duration_days")
        new_time     = call.data.get("record_time")

        entry_obj = hass.config_entries.async_get_entry(entry.entry_id)
        if not entry_obj:
            return

        current = dict(entry_obj.options or entry_obj.data)
        if new_name:     current[CONF_CHALLENGE_NAME] = new_name
        if new_duration: current[CONF_DURATION_DAYS]  = int(new_duration)
        if new_time:     current[CONF_RECORD_TIME]    = new_time

        hass.config_entries.async_update_entry(entry_obj, options=current)
        hass.bus.async_fire(f"{DOMAIN}_settings_updated", current)
        _refresh_all()
        _LOGGER.info("Step Challenge: settings updated via panel")

    # Register all services
    async def _add_participant(call: ServiceCall) -> None:
        """Add a participant dynamically."""
        import re as _re
        name   = (call.data.get("name") or "").strip()
        entity = (call.data.get("entity") or "").strip()
        if not name or not entity:
            _LOGGER.warning("Step Challenge: add_participant requires name and entity")
            return
        key = _re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        for entry_id in _entry_ids():
            e = hass.config_entries.async_get_entry(entry_id)
            current = dict(e.options or e.data)
            parts = list(current.get(CONF_PARTICIPANTS, []))
            if any(p["key"] == key for p in parts):
                _LOGGER.warning("Step Challenge: participant '%s' already exists", name)
                return
            parts.append({"key": key, "name": name, "entity": entity})
            current[CONF_PARTICIPANTS] = parts
            hass.config_entries.async_update_entry(e, options=current)
            hass.bus.async_fire(f"{DOMAIN}_participants_updated")
            _refresh_all()
            _LOGGER.info("Step Challenge: added participant '%s'", name)

    async def _remove_participant(call: ServiceCall) -> None:
        """Remove a participant by key."""
        key = (call.data.get("key") or "").strip()
        if not key:
            return
        for entry_id in _entry_ids():
            e = hass.config_entries.async_get_entry(entry_id)
            current = dict(e.options or e.data)
            parts = [p for p in current.get(CONF_PARTICIPANTS, []) if p["key"] != key]
            current[CONF_PARTICIPANTS] = parts
            hass.config_entries.async_update_entry(e, options=current)
            hass.bus.async_fire(f"{DOMAIN}_participants_updated")
            _refresh_all()
            _LOGGER.info("Step Challenge: removed participant '%s'", key)

    svc_map = {
        SERVICE_START:             _start,
        SERVICE_STOP:              _stop,
        SERVICE_RECORD_DAY:        _record_day,
        SERVICE_ARCHIVE:           _archive_challenge,
        SERVICE_DELETE_ARCHIVE:    _delete_archive,
        SERVICE_UPDATE_SETTINGS:   _update_settings,
        SERVICE_ADD_PARTICIPANT:    _add_participant,
        SERVICE_REMOVE_PARTICIPANT: _remove_participant,
    }
    for name, fn in svc_map.items():
        if not hass.services.has_service(DOMAIN, name):
            hass.services.async_register(DOMAIN, name, fn)
