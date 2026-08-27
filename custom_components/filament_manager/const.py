"""Constants for the Filament Manager integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "filament_manager"
VERSION: Final = "1.1.0"

# Storage
STORAGE_KEY: Final = DOMAIN
STORAGE_VERSION: Final = 1

# Frontend panel
PANEL_URL_PATH: Final = "filament-manager"
PANEL_COMPONENT_NAME: Final = "filament-manager-panel"
PANEL_TITLE: Final = "Filament"
PANEL_ICON: Final = "mdi:printer-3d-nozzle"
STATIC_URL_BASE: Final = "/filament_manager_static"

# Dispatcher signal fired after every mutation of the store
SIGNAL_UPDATED: Final = f"{DOMAIN}_updated"

# Options
CONF_LOW_STOCK_THRESHOLD: Final = "low_stock_threshold"
DEFAULT_LOW_STOCK_THRESHOLD: Final = 1
CONF_CURRENCY: Final = "currency"
DEFAULT_CURRENCY: Final = "EUR"

# Domain defaults
DEFAULT_DIAMETER: Final = 1.75
DEFAULT_SPOOL_NET_WEIGHT_G: Final = 1000
VALID_DIAMETERS: Final = (1.75, 2.85, 3.0)

# Error codes returned by the websocket API
ERR_NOT_FOUND: Final = "not_found"
ERR_IN_USE: Final = "in_use"
ERR_NO_SEALED_SPOOLS: Final = "no_sealed_spools"
ERR_NO_EMPTY_WEIGHT: Final = "no_empty_weight"
ERR_DUPLICATE: Final = "duplicate"
ERR_INVALID: Final = "invalid_data"

# Seed data written on first setup. Everything is editable in the admin area.
DEFAULT_MATERIALS: Final = (
    {"name": "PLA", "nozzle_temp": 210, "bed_temp": 60, "density": 1.24},
    {"name": "PLA+", "nozzle_temp": 215, "bed_temp": 60, "density": 1.24},
    {"name": "Silk PLA", "nozzle_temp": 215, "bed_temp": 60, "density": 1.24},
    {"name": "Wood PLA", "nozzle_temp": 205, "bed_temp": 55, "density": 1.28},
    {"name": "PETG", "nozzle_temp": 240, "bed_temp": 80, "density": 1.27},
    {"name": "ABS", "nozzle_temp": 250, "bed_temp": 100, "density": 1.04},
    {"name": "ASA", "nozzle_temp": 255, "bed_temp": 100, "density": 1.07},
    {"name": "TPU", "nozzle_temp": 225, "bed_temp": 50, "density": 1.21},
    {"name": "PA / Nylon", "nozzle_temp": 260, "bed_temp": 90, "density": 1.14},
    {"name": "PC", "nozzle_temp": 275, "bed_temp": 110, "density": 1.20},
)

DEFAULT_MANUFACTURERS: Final = (
    {"name": "Anycubic", "website": "https://www.anycubic.com"},
    {"name": "Bambu Lab", "website": "https://bambulab.com"},
    {"name": "Elegoo", "website": "https://www.elegoo.com"},
    {"name": "eSun", "website": "https://www.esun3d.com"},
    {"name": "Overture", "website": "https://overture3d.com"},
    {"name": "Polymaker", "website": "https://polymaker.com"},
    {"name": "Prusament", "website": "https://prusament.com"},
    {"name": "Sunlu", "website": "https://www.sunlu.com"},
)

# Services
SERVICE_ADD_SPOOLS: Final = "add_spools"
SERVICE_OPEN_SPOOL: Final = "open_spool"
SERVICE_SET_REMAINING: Final = "set_remaining"
SERVICE_CONSUME_SPOOL: Final = "consume_spool"
