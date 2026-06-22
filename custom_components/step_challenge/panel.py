"""Registers the Step Challenge race panel in Home Assistant."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN, STATIC_URL, PANEL_URL

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register static files and the iframe panel."""
    # Register static path so /step_challenge-static/... is served
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=STATIC_URL,
                path=str(FRONTEND_DIR),
                cache_headers=False,
            )
        ]
    )

    # Register sidebar panel (iframe pointing to our index.html)
    hass.components.frontend.async_register_built_in_panel(
        component_name="iframe",
        sidebar_title="Step Challenge",
        sidebar_icon="mdi:racing-helmet",
        frontend_url_path=DOMAIN,
        config={"url": f"{STATIC_URL}/index.html"},
        require_admin=False,
    )
    _LOGGER.debug("Step Challenge: panel registered at %s", PANEL_URL)


def async_remove_panel(hass: HomeAssistant) -> None:
    """Remove the sidebar panel."""
    try:
        hass.components.frontend.async_remove_panel(DOMAIN)
    except Exception as exc:
        _LOGGER.debug("Step Challenge: could not remove panel (%s)", exc)
