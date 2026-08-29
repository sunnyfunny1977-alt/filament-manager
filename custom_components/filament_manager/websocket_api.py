"""Websocket commands used by the Filament Manager panel.

Read commands are available to every logged-in user, all mutating commands
require an administrator.

Record ids travel as ``manufacturer_id`` / ``material_id`` / ``item_id`` rather
than a plain ``id``: the websocket envelope reserves ``id`` for the message
number, and the client overwrites any ``id`` a caller puts in the payload. The panel keeps itself up to date through the
``subscribe`` command, which pushes a fresh snapshot after every change.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, SIGNAL_UPDATED
from .store import FilamentError, FilamentStore

# Fields accepted for an inventory item. Unknown keys are ignored so the panel
# can post the whole form object.
ITEM_FIELDS = {
    vol.Optional("manufacturer_id"): str,
    vol.Optional("material_id"): str,
    vol.Optional("color_name"): vol.Any(str, None),
    vol.Optional("color_hex"): vol.Any(str, None),
    vol.Optional("diameter"): vol.Any(float, int, str, None),
    vol.Optional("spool_net_weight_g"): vol.Any(float, int, str, None),
    vol.Optional("sealed_count"): vol.Any(int, str, None),
    vol.Optional("location"): vol.Any(str, None),
    vol.Optional("notes"): vol.Any(str, None),
    vol.Optional("price"): vol.Any(float, int, str, None),
    vol.Optional("purchase_date"): vol.Any(str, None),
    vol.Optional("nozzle_temp"): vol.Any(int, str, None),
    vol.Optional("bed_temp"): vol.Any(int, str, None),
}

MANUFACTURER_FIELDS = {
    vol.Optional("name"): str,
    vol.Optional("website"): vol.Any(str, None),
    vol.Optional("sort_order"): vol.Any(int, str, None),
}

MATERIAL_FIELDS = {
    vol.Optional("name"): str,
    vol.Optional("nozzle_temp"): vol.Any(int, str, None),
    vol.Optional("bed_temp"): vol.Any(int, str, None),
    vol.Optional("density"): vol.Any(float, int, str, None),
    vol.Optional("sort_order"): vol.Any(int, str, None),
}

SPOOL_TYPE_FIELDS = {
    vol.Optional("empty_weight_g"): vol.Any(float, int, str, None),
}

# The fill percentage is derived from the grams and cannot be written.
SPOOL_FIELDS = {
    vol.Optional("remaining_grams"): vol.Any(float, int, str, None),
    # Weighed total including the empty spool; converted by the store.
    vol.Optional("gross_weight_g"): vol.Any(float, int, str, None),
    vol.Optional("opened_at"): vol.Any(str, None),
    vol.Optional("note"): vol.Any(str, None),
}


def _get_store(hass: HomeAssistant) -> FilamentStore | None:
    """Return the store, or None when the integration is not loaded."""
    return hass.data.get(DOMAIN)


def _payload(msg: dict[str, Any], fields: dict[Any, Any]) -> dict[str, Any]:
    """Extract the known fields the caller actually sent."""
    names = [getattr(key, "schema", key) for key in fields]
    return {name: msg[name] for name in names if name in msg}


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register every websocket command of this integration."""
    for handler in (
        handle_data,
        handle_subscribe,
        handle_manufacturer_create,
        handle_manufacturer_update,
        handle_manufacturer_delete,
        handle_material_create,
        handle_material_update,
        handle_material_delete,
        handle_spool_type_update,
        handle_item_create,
        handle_item_update,
        handle_item_delete,
        handle_item_set_sealed,
        handle_spool_open,
        handle_spool_update,
        handle_spool_consume,
    ):
        websocket_api.async_register_command(hass, handler)


# ----------------------------------------------------------------------
# Reading
# ----------------------------------------------------------------------


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/data"})
@callback
def handle_data(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Send the full inventory snapshot."""
    store = _get_store(hass)
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "Filament Manager is not loaded")
        return
    connection.send_result(msg["id"], store.snapshot())


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def handle_subscribe(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Subscribe to inventory changes and push a snapshot after each one."""
    store = _get_store(hass)
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "Filament Manager is not loaded")
        return

    @callback
    def _push() -> None:
        connection.send_message(
            websocket_api.event_message(msg["id"], {"snapshot": store.snapshot()})
        )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_UPDATED, _push
    )
    connection.send_result(msg["id"])
    _push()


# ----------------------------------------------------------------------
# Manufacturers (admin area)
# ----------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/manufacturer/create", **MANUFACTURER_FIELDS}
)
@websocket_api.require_admin
@callback
def handle_manufacturer_create(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create a manufacturer."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.add_manufacturer(_payload(msg, MANUFACTURER_FIELDS)),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/manufacturer/update",
        vol.Required("manufacturer_id"): str,
        **MANUFACTURER_FIELDS,
    }
)
@websocket_api.require_admin
@callback
def handle_manufacturer_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update a manufacturer."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.update_manufacturer(
            msg["manufacturer_id"], _payload(msg, MANUFACTURER_FIELDS)
        ),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/manufacturer/delete", vol.Required("manufacturer_id"): str}
)
@websocket_api.require_admin
@callback
def handle_manufacturer_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete a manufacturer that is not in use."""
    _answer(
        hass, connection, msg, lambda store: store.delete_manufacturer(msg["manufacturer_id"])
    )


# ----------------------------------------------------------------------
# Materials (admin area)
# ----------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/material/create", **MATERIAL_FIELDS}
)
@websocket_api.require_admin
@callback
def handle_material_create(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create a filament type."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.add_material(_payload(msg, MATERIAL_FIELDS)),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/material/update",
        vol.Required("material_id"): str,
        **MATERIAL_FIELDS,
    }
)
@websocket_api.require_admin
@callback
def handle_material_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update a filament type."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.update_material(
            msg["material_id"], _payload(msg, MATERIAL_FIELDS)
        ),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/material/delete", vol.Required("material_id"): str}
)
@websocket_api.require_admin
@callback
def handle_material_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete a filament type that is not in use."""
    _answer(hass, connection, msg, lambda store: store.delete_material(msg["material_id"]))


# ----------------------------------------------------------------------
# Spool types (admin area)
# ----------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/spool_type/update",
        vol.Required("spool_type_id"): str,
        **SPOOL_TYPE_FIELDS,
    }
)
@websocket_api.require_admin
@callback
def handle_spool_type_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Set the empty-spool weight; weighed spools are recomputed."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.update_spool_type(
            msg["spool_type_id"], _payload(msg, SPOOL_TYPE_FIELDS)
        ),
    )


# ----------------------------------------------------------------------
# Inventory items (manage area)
# ----------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/item/create", **ITEM_FIELDS}
)
@websocket_api.require_admin
@callback
def handle_item_create(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create an inventory item."""
    _answer(hass, connection, msg, lambda store: store.add_item(_payload(msg, ITEM_FIELDS)))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/item/update",
        vol.Required("item_id"): str,
        **ITEM_FIELDS,
    }
)
@websocket_api.require_admin
@callback
def handle_item_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update an inventory item."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.update_item(msg["item_id"], _payload(msg, ITEM_FIELDS)),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/item/delete", vol.Required("item_id"): str}
)
@websocket_api.require_admin
@callback
def handle_item_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete an inventory item."""
    _answer(hass, connection, msg, lambda store: store.delete_item(msg["item_id"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/item/set_sealed",
        vol.Required("item_id"): str,
        vol.Required("sealed_count"): vol.All(vol.Coerce(int), vol.Range(min=0, max=9999)),
    }
)
@websocket_api.require_admin
@callback
def handle_item_set_sealed(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Set the number of sealed spools."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.set_sealed_count(msg["item_id"], msg["sealed_count"]),
    )


# ----------------------------------------------------------------------
# Opened spools
# ----------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/spool/open", vol.Required("item_id"): str, **SPOOL_FIELDS}
)
@websocket_api.require_admin
@callback
def handle_spool_open(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Open one sealed spool."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.open_spool(msg["item_id"], _payload(msg, SPOOL_FIELDS)),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/spool/update",
        vol.Required("item_id"): str,
        vol.Required("spool_id"): str,
        **SPOOL_FIELDS,
    }
)
@websocket_api.require_admin
@callback
def handle_spool_update(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update the remaining amount of an opened spool."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.update_open_spool(
            msg["item_id"], msg["spool_id"], _payload(msg, SPOOL_FIELDS)
        ),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/spool/consume",
        vol.Required("item_id"): str,
        vol.Required("spool_id"): str,
    }
)
@websocket_api.require_admin
@callback
def handle_spool_consume(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Remove an opened spool that has been used up."""
    _answer(
        hass,
        connection,
        msg,
        lambda store: store.consume_spool(msg["item_id"], msg["spool_id"]),
    )


def _answer(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
    action: Callable[[FilamentStore], Any],
) -> None:
    """Run a store operation and send the result or a coded error."""
    store = _get_store(hass)
    if store is None:
        connection.send_error(msg["id"], "not_loaded", "Filament Manager is not loaded")
        return
    try:
        result = action(store)
    except FilamentError as err:
        connection.send_error(msg["id"], err.code, str(err.details))
        return
    connection.send_result(msg["id"], result)
