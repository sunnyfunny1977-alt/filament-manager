"""Persistence and CRUD for the Filament Manager."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import (
    ERR_IN_USE,
    ERR_INVALID,
    ERR_NO_SEALED_SPOOLS,
    ERR_NOT_FOUND,
    SIGNAL_UPDATED,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .models import (
    Item,
    Manufacturer,
    Material,
    OpenSpool,
    default_data,
    item_total_grams,
    item_total_spools,
    normalize_item,
    normalize_manufacturer,
    normalize_material,
    normalize_open_spool,
    spool_remaining_grams,
    utcnow_iso,
)

_LOGGER = logging.getLogger(__name__)

SAVE_DELAY = 2


class FilamentError(Exception):
    """Raised when a store operation cannot be carried out.

    ``code`` is a stable identifier the frontend translates into a readable
    message; ``details`` carries extra context such as how many items still use
    a record that was about to be deleted.
    """

    def __init__(self, code: str, **details: Any) -> None:
        """Initialise the error."""
        super().__init__(code)
        self.code = code
        self.details = details


class FilamentStore:
    """Holds the inventory in memory and persists it to .storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialise the store."""
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"manufacturers": [], "materials": [], "items": []}

    # ------------------------------------------------------------------
    # Loading and saving
    # ------------------------------------------------------------------

    async def async_load(self) -> None:
        """Load the data, seeding defaults on first run."""
        stored = await self._store.async_load()
        if stored is None:
            _LOGGER.debug("No stored data found, seeding defaults")
            self._data = default_data()
            await self._store.async_save(self._data)
            return

        self._data = {
            "manufacturers": [
                normalize_manufacturer(entry)
                for entry in stored.get("manufacturers", [])
                if isinstance(entry, dict)
            ],
            "materials": [
                normalize_material(entry)
                for entry in stored.get("materials", [])
                if isinstance(entry, dict)
            ],
            "items": [
                normalize_item(entry)
                for entry in stored.get("items", [])
                if isinstance(entry, dict)
            ],
        }

    @callback
    def _save_and_notify(self) -> None:
        """Schedule a save and tell sensors and the panel about the change."""
        self._store.async_delay_save(lambda: self._data, SAVE_DELAY)
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)

    async def async_remove(self) -> None:
        """Delete the stored data (used when the integration is removed)."""
        await self._store.async_remove()

    # ------------------------------------------------------------------
    # Read access
    # ------------------------------------------------------------------

    @property
    def manufacturers(self) -> list[Manufacturer]:
        """Return all manufacturers sorted for display."""
        return sorted(
            self._data["manufacturers"],
            key=lambda entry: (entry.get("sort_order", 0), entry.get("name", "").lower()),
        )

    @property
    def materials(self) -> list[Material]:
        """Return all materials sorted for display."""
        return sorted(
            self._data["materials"],
            key=lambda entry: (entry.get("sort_order", 0), entry.get("name", "").lower()),
        )

    @property
    def items(self) -> list[Item]:
        """Return all inventory items."""
        return list(self._data["items"])

    def _find(self, collection: str, record_id: str) -> dict[str, Any]:
        """Return one record or raise if it does not exist."""
        for entry in self._data[collection]:
            if entry.get("id") == record_id:
                return entry
        raise FilamentError(ERR_NOT_FOUND, collection=collection, id=record_id)

    def _usage_count(self, field: str, record_id: str) -> int:
        """Return how many items reference a manufacturer or material."""
        return sum(1 for item in self._data["items"] if item.get(field) == record_id)

    # ------------------------------------------------------------------
    # Manufacturers
    # ------------------------------------------------------------------

    def add_manufacturer(self, raw: dict[str, Any]) -> Manufacturer:
        """Create a manufacturer."""
        record = normalize_manufacturer({**raw, "id": None})
        if not record["name"]:
            raise FilamentError(ERR_INVALID, field="name")
        self._data["manufacturers"].append(record)
        self._save_and_notify()
        return record

    def update_manufacturer(self, record_id: str, raw: dict[str, Any]) -> Manufacturer:
        """Update a manufacturer."""
        existing = self._find("manufacturers", record_id)
        record = normalize_manufacturer({**raw, "id": record_id}, existing)
        if not record["name"]:
            raise FilamentError(ERR_INVALID, field="name")
        existing.update(record)
        self._save_and_notify()
        return existing

    def delete_manufacturer(self, record_id: str) -> None:
        """Delete a manufacturer that is not referenced by any item."""
        self._find("manufacturers", record_id)
        if used := self._usage_count("manufacturer_id", record_id):
            raise FilamentError(ERR_IN_USE, count=used)
        self._data["manufacturers"] = [
            entry for entry in self._data["manufacturers"] if entry["id"] != record_id
        ]
        self._save_and_notify()

    # ------------------------------------------------------------------
    # Materials
    # ------------------------------------------------------------------

    def add_material(self, raw: dict[str, Any]) -> Material:
        """Create a material."""
        record = normalize_material({**raw, "id": None})
        if not record["name"]:
            raise FilamentError(ERR_INVALID, field="name")
        self._data["materials"].append(record)
        self._save_and_notify()
        return record

    def update_material(self, record_id: str, raw: dict[str, Any]) -> Material:
        """Update a material."""
        existing = self._find("materials", record_id)
        record = normalize_material({**raw, "id": record_id}, existing)
        if not record["name"]:
            raise FilamentError(ERR_INVALID, field="name")
        existing.update(record)
        self._save_and_notify()
        return existing

    def delete_material(self, record_id: str) -> None:
        """Delete a material that is not referenced by any item."""
        self._find("materials", record_id)
        if used := self._usage_count("material_id", record_id):
            raise FilamentError(ERR_IN_USE, count=used)
        self._data["materials"] = [
            entry for entry in self._data["materials"] if entry["id"] != record_id
        ]
        self._save_and_notify()

    # ------------------------------------------------------------------
    # Items
    # ------------------------------------------------------------------

    def add_item(self, raw: dict[str, Any]) -> Item:
        """Create an inventory item."""
        record = normalize_item({**raw, "id": None})
        self._validate_references(record)
        self._data["items"].append(record)
        self._save_and_notify()
        return record

    def update_item(self, record_id: str, raw: dict[str, Any]) -> Item:
        """Update an inventory item.

        The opened spools are managed through their own commands, so they are
        never overwritten here.
        """
        existing = self._find("items", record_id)
        payload = {key: value for key, value in raw.items() if key != "open_spools"}
        record = normalize_item({**payload, "id": record_id}, existing)
        self._validate_references(record)
        existing.update(record)
        self._save_and_notify()
        return existing

    def delete_item(self, record_id: str) -> None:
        """Delete an inventory item."""
        self._find("items", record_id)
        self._data["items"] = [
            entry for entry in self._data["items"] if entry["id"] != record_id
        ]
        self._save_and_notify()

    def _validate_references(self, item: Item) -> None:
        """Make sure the referenced manufacturer and material exist."""
        self._find("manufacturers", item["manufacturer_id"])
        self._find("materials", item["material_id"])

    def set_sealed_count(self, record_id: str, count: int) -> Item:
        """Set the number of sealed spools of an item."""
        existing = self._find("items", record_id)
        existing["sealed_count"] = max(0, int(count))
        existing["updated_at"] = utcnow_iso()
        self._save_and_notify()
        return existing

    # ------------------------------------------------------------------
    # Opened spools
    # ------------------------------------------------------------------

    def open_spool(self, item_id: str, raw: dict[str, Any] | None = None) -> OpenSpool:
        """Turn one sealed spool into an opened one."""
        existing = self._find("items", item_id)
        if int(existing.get("sealed_count", 0)) < 1:
            raise FilamentError(ERR_NO_SEALED_SPOOLS)
        existing["sealed_count"] = int(existing["sealed_count"]) - 1
        spool = normalize_open_spool({"remaining_percent": 100, **(raw or {}), "id": None})
        existing["open_spools"].append(spool)
        existing["updated_at"] = utcnow_iso()
        self._save_and_notify()
        return spool

    def update_open_spool(
        self, item_id: str, spool_id: str, raw: dict[str, Any]
    ) -> OpenSpool:
        """Update the remaining amount or note of an opened spool."""
        existing = self._find("items", item_id)
        for spool in existing["open_spools"]:
            if spool.get("id") == spool_id:
                spool.update(normalize_open_spool({**raw, "id": spool_id}, spool))
                existing["updated_at"] = utcnow_iso()
                self._save_and_notify()
                return spool
        raise FilamentError(ERR_NOT_FOUND, collection="open_spools", id=spool_id)

    def consume_spool(self, item_id: str, spool_id: str) -> None:
        """Remove an opened spool that has been used up."""
        existing = self._find("items", item_id)
        remaining = [
            spool for spool in existing["open_spools"] if spool.get("id") != spool_id
        ]
        if len(remaining) == len(existing["open_spools"]):
            raise FilamentError(ERR_NOT_FOUND, collection="open_spools", id=spool_id)
        existing["open_spools"] = remaining
        existing["updated_at"] = utcnow_iso()
        self._save_and_notify()

    # ------------------------------------------------------------------
    # Snapshot for the panel
    # ------------------------------------------------------------------

    def snapshot(self) -> dict[str, Any]:
        """Return the full state the panel renders from."""
        return {
            "manufacturers": self.manufacturers,
            "materials": self.materials,
            "items": self.items,
            "usage": {
                "manufacturers": {
                    entry["id"]: self._usage_count("manufacturer_id", entry["id"])
                    for entry in self._data["manufacturers"]
                },
                "materials": {
                    entry["id"]: self._usage_count("material_id", entry["id"])
                    for entry in self._data["materials"]
                },
            },
            "summary": self.summary(),
        }

    def summary(self) -> dict[str, Any]:
        """Return the aggregated numbers used by the panel and the sensors."""
        items = self._data["items"]
        material_names = {entry["id"]: entry["name"] for entry in self._data["materials"]}
        manufacturer_names = {
            entry["id"]: entry["name"] for entry in self._data["manufacturers"]
        }

        sealed = sum(int(item.get("sealed_count", 0)) for item in items)
        opened = sum(len(item.get("open_spools", [])) for item in items)
        total_grams = sum(item_total_grams(item) for item in items)

        by_material: dict[str, int] = {}
        by_manufacturer: dict[str, int] = {}
        value = 0.0
        for item in items:
            spools = item_total_spools(item)
            material = material_names.get(item.get("material_id"), "?")
            manufacturer = manufacturer_names.get(item.get("manufacturer_id"), "?")
            by_material[material] = by_material.get(material, 0) + spools
            by_manufacturer[manufacturer] = by_manufacturer.get(manufacturer, 0) + spools
            if item.get("price") is not None:
                value += float(item["price"]) * spools

        return {
            "entry_count": len(items),
            "sealed_spools": sealed,
            "open_spools": opened,
            "total_spools": sealed + opened,
            "total_grams": round(total_grams, 1),
            "total_kg": round(total_grams / 1000, 3),
            "inventory_value": round(value, 2),
            "by_material": dict(sorted(by_material.items())),
            "by_manufacturer": dict(sorted(by_manufacturer.items())),
        }

    def low_stock_items(self, threshold: int) -> list[dict[str, Any]]:
        """Return items at or below the low-stock threshold, most urgent first."""
        material_names = {entry["id"]: entry["name"] for entry in self._data["materials"]}
        manufacturer_names = {
            entry["id"]: entry["name"] for entry in self._data["manufacturers"]
        }

        low: list[dict[str, Any]] = []
        for item in self._data["items"]:
            spools = item_total_spools(item)
            if spools > threshold:
                continue
            net = float(item.get("spool_net_weight_g") or 0)
            low.append(
                {
                    "id": item["id"],
                    "name": " ".join(
                        part
                        for part in (
                            manufacturer_names.get(item.get("manufacturer_id"), ""),
                            material_names.get(item.get("material_id"), ""),
                            item.get("color_name", ""),
                        )
                        if part
                    ),
                    "spools": spools,
                    "grams": round(
                        sum(
                            spool_remaining_grams(spool, net)
                            for spool in item.get("open_spools", [])
                        )
                        + int(item.get("sealed_count", 0)) * net,
                        1,
                    ),
                }
            )
        return sorted(low, key=lambda entry: (entry["spools"], entry["grams"]))
