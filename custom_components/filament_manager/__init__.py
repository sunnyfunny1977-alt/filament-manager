"""The Filament Manager integration.

Sets up the storage, the sidebar panel, the websocket API and the services.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import (
    DOMAIN,
    PANEL_COMPONENT_NAME,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    SERVICE_ADD_SPOOLS,
    SERVICE_CONSUME_SPOOL,
    SERVICE_OPEN_SPOOL,
    SERVICE_SET_REMAINING,
    STATIC_URL_BASE,
    VERSION,
)
from .store import FilamentError, FilamentStore
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

# Marks the one-off, hass-wide registrations so a reload does not repeat them.
DATA_STATIC_REGISTERED = f"{DOMAIN}_static_registered"
DATA_WS_REGISTERED = f"{DOMAIN}_ws_registered"

SERVICE_ADD_SPOOLS_SCHEMA = vol.Schema(
    {
        vol.Required("item_id"): cv.string,
        vol.Optional("count", default=1): vol.All(vol.Coerce(int), vol.Range(min=-999, max=999)),
    }
)

SERVICE_OPEN_SPOOL_SCHEMA = vol.Schema({vol.Required("item_id"): cv.string})

SERVICE_SET_REMAINING_SCHEMA = vol.Schema(
    {
        vol.Required("item_id"): cv.string,
        vol.Optional("spool_id"): cv.string,
        vol.Optional("remaining_percent"): vol.All(
            vol.Coerce(float), vol.Range(min=0, max=100)
        ),
        vol.Optional("remaining_grams"): vol.All(
            vol.Coerce(float), vol.Range(min=0, max=100000)
        ),
        vol.Optional("note"): cv.string,
    }
)

SERVICE_CONSUME_SPOOL_SCHEMA = vol.Schema(
    {vol.Required("item_id"): cv.string, vol.Optional("spool_id"): cv.string}
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Filament Manager from a config entry."""
    store = FilamentStore(hass)
    await store.async_load()
    hass.data[DOMAIN] = store

    await _async_register_frontend(hass)

    if not hass.data.get(DATA_WS_REGISTERED):
        async_register_commands(hass)
        hass.data[DATA_WS_REGISTERED] = True

    _async_register_services(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
        for service in (
            SERVICE_ADD_SPOOLS,
            SERVICE_OPEN_SPOOL,
            SERVICE_SET_REMAINING,
            SERVICE_CONSUME_SPOOL,
        ):
            hass.services.async_remove(DOMAIN, service)
        hass.data.pop(DOMAIN, None)
    return unload_ok


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the entry when the options changed."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the panel files and add the sidebar entry."""
    if not hass.data.get(DATA_STATIC_REGISTERED):
        panel_dir = Path(__file__).parent / "panel"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_BASE, str(panel_dir), False)]
        )
        hass.data[DATA_STATIC_REGISTERED] = True

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT_NAME,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        # The version query busts the browser cache after an update.
        module_url=f"{STATIC_URL_BASE}/filament-manager-panel.js?v={VERSION}",
        embed_iframe=False,
        require_admin=False,
        config={"version": VERSION, "static_base": STATIC_URL_BASE},
    )


def _async_register_services(hass: HomeAssistant) -> None:
    """Register the services used by automations."""

    def _store() -> FilamentStore:
        store: FilamentStore | None = hass.data.get(DOMAIN)
        if store is None:
            raise HomeAssistantError("Filament Manager is not loaded")
        return store

    def _resolve_spool_id(item_id: str, given: str | None) -> str:
        """Return the spool to act on, defaulting to the first opened one."""
        store = _store()
        for item in store.items:
            if item["id"] != item_id:
                continue
            if given:
                return given
            if not item["open_spools"]:
                raise HomeAssistantError(f"Item {item_id} has no opened spool")
            return item["open_spools"][0]["id"]
        raise HomeAssistantError(f"Unknown item {item_id}")

    async def _handle(call: ServiceCall) -> None:
        """Dispatch a service call to the store."""
        store = _store()
        data: dict[str, Any] = dict(call.data)
        item_id = data["item_id"]
        try:
            if call.service == SERVICE_ADD_SPOOLS:
                current = next(
                    (item["sealed_count"] for item in store.items if item["id"] == item_id),
                    None,
                )
                if current is None:
                    raise HomeAssistantError(f"Unknown item {item_id}")
                store.set_sealed_count(item_id, current + data["count"])
            elif call.service == SERVICE_OPEN_SPOOL:
                store.open_spool(item_id)
            elif call.service == SERVICE_SET_REMAINING:
                spool_id = _resolve_spool_id(item_id, data.get("spool_id"))
                payload = {
                    key: data[key]
                    for key in ("remaining_percent", "remaining_grams", "note")
                    if key in data
                }
                store.update_open_spool(item_id, spool_id, payload)
            elif call.service == SERVICE_CONSUME_SPOOL:
                spool_id = _resolve_spool_id(item_id, data.get("spool_id"))
                store.consume_spool(item_id, spool_id)
        except FilamentError as err:
            raise HomeAssistantError(f"{err.code}: {err.details}") from err

    for service, schema in (
        (SERVICE_ADD_SPOOLS, SERVICE_ADD_SPOOLS_SCHEMA),
        (SERVICE_OPEN_SPOOL, SERVICE_OPEN_SPOOL_SCHEMA),
        (SERVICE_SET_REMAINING, SERVICE_SET_REMAINING_SCHEMA),
        (SERVICE_CONSUME_SPOOL, SERVICE_CONSUME_SPOOL_SCHEMA),
    ):
        hass.services.async_register(DOMAIN, service, _handle, schema=schema)
