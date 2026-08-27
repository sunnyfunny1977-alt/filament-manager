"""Overview sensors for the Filament Manager.

All sensors share one service device and update through the dispatcher signal
that the store fires after every change, so there is no polling.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfMass
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_CURRENCY,
    CONF_LOW_STOCK_THRESHOLD,
    DEFAULT_CURRENCY,
    DEFAULT_LOW_STOCK_THRESHOLD,
    DOMAIN,
    SIGNAL_UPDATED,
    VERSION,
)
from .store import FilamentStore


@dataclass(frozen=True, kw_only=True)
class FilamentSensorDescription(SensorEntityDescription):
    """Describes a Filament Manager sensor."""

    value_fn: Callable[[FilamentStore, int], Any]
    attributes_fn: Callable[[FilamentStore, int], dict[str, Any]] | None = None


SENSORS: tuple[FilamentSensorDescription, ...] = (
    FilamentSensorDescription(
        key="total_spools",
        translation_key="total_spools",
        icon="mdi:package-variant-closed",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda store, _: store.summary()["total_spools"],
        attributes_fn=lambda store, _: {
            "by_material": store.summary()["by_material"],
            "by_manufacturer": store.summary()["by_manufacturer"],
        },
    ),
    FilamentSensorDescription(
        key="sealed_spools",
        translation_key="sealed_spools",
        icon="mdi:package-variant-closed-check",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda store, _: store.summary()["sealed_spools"],
    ),
    FilamentSensorDescription(
        key="open_spools",
        translation_key="open_spools",
        icon="mdi:package-variant",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda store, _: store.summary()["open_spools"],
    ),
    FilamentSensorDescription(
        key="total_weight",
        translation_key="total_weight",
        icon="mdi:weight-kilogram",
        device_class=SensorDeviceClass.WEIGHT,
        state_class=SensorStateClass.MEASUREMENT,
        native_unit_of_measurement=UnitOfMass.KILOGRAMS,
        suggested_display_precision=2,
        value_fn=lambda store, _: store.summary()["total_kg"],
    ),
    FilamentSensorDescription(
        key="entry_count",
        translation_key="entry_count",
        icon="mdi:format-list-bulleted",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda store, _: store.summary()["entry_count"],
    ),
    FilamentSensorDescription(
        key="inventory_value",
        translation_key="inventory_value",
        icon="mdi:cash-multiple",
        device_class=SensorDeviceClass.MONETARY,
        state_class=SensorStateClass.TOTAL,
        suggested_display_precision=2,
        value_fn=lambda store, _: store.summary()["inventory_value"],
    ),
    FilamentSensorDescription(
        key="low_stock",
        translation_key="low_stock",
        icon="mdi:alert-outline",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda store, threshold: len(store.low_stock_items(threshold)),
        attributes_fn=lambda store, threshold: {
            "threshold": threshold,
            "items": store.low_stock_items(threshold),
        },
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Filament Manager sensors."""
    store: FilamentStore = hass.data[DOMAIN]
    async_add_entities(
        FilamentManagerSensor(store, entry, description) for description in SENSORS
    )


class FilamentManagerSensor(SensorEntity):
    """A sensor summarising the filament inventory."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    entity_description: FilamentSensorDescription

    def __init__(
        self,
        store: FilamentStore,
        entry: ConfigEntry,
        description: FilamentSensorDescription,
    ) -> None:
        """Initialise the sensor."""
        self._store = store
        self._entry = entry
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Filament Manager",
            manufacturer="Filament Manager",
            model="Inventory",
            sw_version=VERSION,
            entry_type=DeviceEntryType.SERVICE,
        )
        if description.device_class is SensorDeviceClass.MONETARY:
            self._attr_native_unit_of_measurement = entry.options.get(
                CONF_CURRENCY, DEFAULT_CURRENCY
            )

    @property
    def _threshold(self) -> int:
        """Return the configured low-stock threshold."""
        return int(
            self._entry.options.get(CONF_LOW_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD)
        )

    @property
    def native_value(self) -> Any:
        """Return the current value."""
        return self.entity_description.value_fn(self._store, self._threshold)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return the extra attributes."""
        if self.entity_description.attributes_fn is None:
            return None
        return self.entity_description.attributes_fn(self._store, self._threshold)

    async def async_added_to_hass(self) -> None:
        """Subscribe to inventory changes."""

        @callback
        def _updated() -> None:
            self.async_write_ha_state()

        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATED, _updated)
        )
