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
import homeassistant.util.dt as dt_util

from .const import (
    CARD_FILE,
    CONF_CHALLENGE_NAME,
    CONF_DURATION_DAYS,
    CONF_NEXT_DAY_EVAL,
    CONF_PARTICIPANTS,
    CONF_RECORD_TIME,
    DEFAULT_NEXT_DAY_EVAL,
    DEFAULT_RECORD_TIME,
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
    _register_daily_timer(hass, entry)

    record_time = entry.options.get(
        CONF_RECORD_TIME,
        entry.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME),
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

def _register_daily_timer(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Register a daily time-based trigger to auto-evaluate the stage."""
    from homeassistant.helpers.event import async_track_time_change

    _unsub: list = []

    async def _auto_record(_now) -> None:
        e = hass.config_entries.async_get_entry(entry.entry_id)
        if not e:
            return
        store = hass.data.get(DOMAIN, {}).get(entry.entry_id, {}).get("store")
        if not store or not store.active:
            return
        _LOGGER.info("Step Challenge: auto daily evaluation triggered")
        await hass.services.async_call(DOMAIN, SERVICE_RECORD_DAY, {})

    def _subscribe() -> None:
        e = hass.config_entries.async_get_entry(entry.entry_id)
        t = e.options.get(CONF_RECORD_TIME, e.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME))
        parts = t.split(":")
        h, m, s = int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
        if _unsub:
            _unsub[0]()
            _unsub.clear()
        unsub = async_track_time_change(hass, _auto_record, hour=h, minute=m, second=s)
        _unsub.append(unsub)
        _LOGGER.info("Step Challenge: daily evaluation scheduled at %02d:%02d:%02d", h, m, s)

    _subscribe()

    # Re-subscribe when options change (e.g. user changes evaluation time)
    @callback
    def _on_options_updated(_event) -> None:
        _subscribe()

    unsub_event = hass.bus.async_listen(f"{DOMAIN}_settings_updated", _on_options_updated)
    entry.async_on_unload(unsub_event)
    entry.async_on_unload(lambda: _unsub[0]() if _unsub else None)


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
        force_today = call.data.get("force_today", False)
        for entry_id in _entry_ids():
            store = _store(entry_id)
            if not store.active:
                continue
            parts = _participants(entry_id)
            steps: dict[str, int] = {}

            # Determine if next_day_eval is active
            e_cfg = hass.config_entries.async_get_entry(entry_id)
            next_day = (not force_today) and e_cfg.options.get(
                CONF_NEXT_DAY_EVAL,
                e_cfg.data.get(CONF_NEXT_DAY_EVAL, DEFAULT_NEXT_DAY_EVAL)
            )

            # For next_day_eval: read yesterday's last known value from recorder
            if next_day:
                from datetime import date, timedelta as td
                from homeassistant.components.recorder import get_instance
                from homeassistant.components.recorder.history import state_changes_during_period

                local_tz = dt_util.get_default_time_zone()
                today_local = datetime.now(local_tz).date()
                yesterday_start = datetime.combine(
                    today_local - td(days=1), datetime.min.time()
                ).replace(tzinfo=local_tz)
                yesterday_end = datetime.combine(
                    today_local, datetime.min.time()
                ).replace(tzinfo=local_tz)

                for p in parts:
                    try:
                        recorder = get_instance(hass)
                        # Get all states of yesterday, find peak (max) value
                        # Daily step sensors reset to 0 at midnight, so we want the maximum
                        history = await recorder.async_add_executor_job(
                            state_changes_during_period,
                            hass,
                            yesterday_start,
                            yesterday_end,
                            p["entity"],
                            False,   # no_attributes
                            False,   # ascending order
                        )
                        entity_history = history.get(p["entity"], [])
                        if entity_history:
                            # Take the last non-zero value before midnight reset
                            # Iterate in reverse to find last value > 0
                            last_val = 0
                            for state in reversed(entity_history):
                                try:
                                    v = int(float(state.state))
                                    if v > 0:
                                        last_val = v
                                        break
                                except (ValueError, TypeError):
                                    pass
                            steps[p["key"]] = last_val
                            _LOGGER.warning("Step Challenge: %s yesterday_last=%s (from %d states, ts=%s)", p["entity"], last_val, len(entity_history), entity_history[-1].last_changed if entity_history else 'n/a')
                        else:
                            steps[p["key"]] = 0
                            _LOGGER.warning("Step Challenge: %s no history found for %s to %s", p["entity"], yesterday_start, yesterday_end)
                    except Exception as err:
                        _LOGGER.warning("Step Challenge: could not read history for %s: %s", p["entity"], err)
                        steps[p["key"]] = 0
            else:
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
            # If next_day_eval is active, score goes to yesterday
            from datetime import timedelta
            eval_date = datetime.now() - timedelta(days=1) if next_day else datetime.now()
            date_str = eval_date.strftime("%Y-%m-%d")
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
