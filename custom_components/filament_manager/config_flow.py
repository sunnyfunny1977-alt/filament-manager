"""Config flow for the Filament Manager."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
)

from .const import (
    CONF_CURRENCY,
    CONF_LOW_STOCK_THRESHOLD,
    DEFAULT_CURRENCY,
    DEFAULT_LOW_STOCK_THRESHOLD,
    DOMAIN,
)


class FilamentManagerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the (single instance) setup."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Confirm the setup — there is nothing to configure up front."""
        if user_input is None:
            return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
        return self.async_create_entry(title="Filament Manager", data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Return the options flow."""
        return FilamentManagerOptionsFlow()


class FilamentManagerOptionsFlow(OptionsFlow):
    """Handle the options."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Let the user set the low-stock threshold and the currency."""
        if user_input is not None:
            return self.async_create_entry(
                data={
                    CONF_LOW_STOCK_THRESHOLD: int(user_input[CONF_LOW_STOCK_THRESHOLD]),
                    CONF_CURRENCY: user_input[CONF_CURRENCY].strip().upper()
                    or DEFAULT_CURRENCY,
                }
            )

        options = self.config_entry.options
        schema = vol.Schema(
            {
                vol.Required(
                    CONF_LOW_STOCK_THRESHOLD,
                    default=options.get(
                        CONF_LOW_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD
                    ),
                ): NumberSelector(
                    NumberSelectorConfig(min=0, max=99, step=1, mode=NumberSelectorMode.BOX)
                ),
                vol.Required(
                    CONF_CURRENCY,
                    default=options.get(CONF_CURRENCY, DEFAULT_CURRENCY),
                ): str,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
