/**
 * Filament Manager panel.
 *
 * A dependency-free web component: Home Assistant sets `hass`, `narrow`,
 * `panel` and `route` on it, the panel subscribes to the backend and re-renders
 * its shadow root whenever the inventory changes.
 */

import { loadTranslations, t, translateError } from "./i18n.js";
import { panelStyles } from "./styles.js";
import { createLookup, itemLabel } from "./data.js";
import {
  dialog,
  dialogActions,
  html,
  icon,
  setFormatting,
} from "./ui.js";
import { renderOverview } from "./views/overview.js";
import {
  itemDialogBody,
  newItemValues,
  renderManage,
} from "./views/manage.js";
import {
  manufacturerDialogBody,
  materialDialogBody,
  newManufacturerValues,
  newMaterialValues,
  renderAdmin,
} from "./views/admin.js";

const DOMAIN = "filament_manager";
const VIEWS = ["overview", "manage", "admin"];
const DEFAULT_STATIC_BASE = "/filament_manager_static";

const EMPTY_DATA = {
  manufacturers: [],
  materials: [],
  items: [],
  usage: { manufacturers: {}, materials: {} },
  summary: {
    entry_count: 0,
    sealed_spools: 0,
    open_spools: 0,
    total_spools: 0,
    total_grams: 0,
    total_kg: 0,
    inventory_value: 0,
    by_material: {},
    by_manufacturer: {},
  },
};

class FilamentManagerPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this._narrow = false;
    this._panel = null;
    this._route = null;

    this._ready = false;
    this._data = EMPTY_DATA;
    this._unsubscribe = null;
    this._toastTimer = null;
    this._overlayKey = "";

    this._state = {
      view: "overview",
      filters: { q: "", manufacturer: "", material: "", condition: "", sort: "manufacturer" },
      manageFilters: { q: "", sort: "manufacturer" },
      expanded: new Set(),
    };
    this._dialog = null;

    this.shadowRoot.innerHTML = `
      <style>${panelStyles}</style>
      <div id="app"><div class="content"><div class="empty">…</div></div></div>
      <div id="overlay"></div>
      <div id="toast"></div>
    `;

    this._onClick = this._onClick.bind(this);
    this._onInput = this._onInput.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  // -- Properties set by Home Assistant ------------------------------------

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
  }

  get hass() {
    return this._hass;
  }

  set narrow(value) {
    this._narrow = Boolean(value);
    this.toggleAttribute("narrow", this._narrow);
  }

  set panel(value) {
    this._panel = value;
  }

  set route(value) {
    this._route = value;
    const path = (value && value.path ? value.path : "").replace(/^\//, "");
    const view = VIEWS.includes(path) ? path : "overview";
    if (view !== this._state.view) {
      this._state.view = view;
      if (this._ready) this._renderApp();
    }
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("input", this._onInput);
    this.shadowRoot.addEventListener("change", this._onChange);
    this.shadowRoot.addEventListener("keydown", this._onKeyDown);
    if (this._hass) this._init();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._onClick);
    this.shadowRoot.removeEventListener("input", this._onInput);
    this.shadowRoot.removeEventListener("change", this._onChange);
    this.shadowRoot.removeEventListener("keydown", this._onKeyDown);
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._toastTimer) clearTimeout(this._toastTimer);
  }

  // -- Setup ---------------------------------------------------------------

  get _staticBase() {
    return (this._panel && this._panel.config && this._panel.config.static_base) || DEFAULT_STATIC_BASE;
  }

  get _isAdmin() {
    return Boolean(this._hass && this._hass.user && this._hass.user.is_admin);
  }

  async _init() {
    if (this._initStarted) return;
    this._initStarted = true;

    const language = (this._hass.locale && this._hass.locale.language) || this._hass.language;
    try {
      await loadTranslations(this._staticBase, language);
    } catch (err) {
      // Keep going with the raw keys rather than showing an empty panel.
      console.error("Filament Manager: cannot load translations", err);
    }
    setFormatting(language, (this._hass.config && this._hass.config.currency) || "EUR");

    this._renderLoading();
    await this._subscribe();
    this._ready = true;
    this._renderApp();
  }

  _renderLoading() {
    this.shadowRoot.getElementById("app").innerHTML = String(
      html`<div class="content"><div class="empty">${t("app.loading")}</div></div>`
    );
  }

  async _subscribe() {
    try {
      this._unsubscribe = await this._hass.connection.subscribeMessage(
        (message) => {
          if (message && message.snapshot) {
            this._data = message.snapshot;
            if (this._ready) this._renderApp();
          }
        },
        { type: `${DOMAIN}/subscribe` }
      );
    } catch (err) {
      console.error("Filament Manager: subscription failed", err);
      this._data = await this._hass.callWS({ type: `${DOMAIN}/data` }).catch(() => EMPTY_DATA);
    }
  }

  async _call(message) {
    try {
      return await this._hass.callWS(message);
    } catch (err) {
      this._toast(translateError(err), true);
      throw err;
    }
  }

  // -- Rendering -----------------------------------------------------------

  get _lookup() {
    return createLookup(this._data);
  }

  _context() {
    return {
      data: this._data,
      state: this._state,
      lookup: this._lookup,
      isAdmin: this._isAdmin,
    };
  }

  _renderApp() {
    const app = this.shadowRoot.getElementById("app");
    const active = this.shadowRoot.activeElement;
    const focusAttr = active && active.dataset
      ? (active.dataset.filter ? "data-filter" : active.dataset.mfilter ? "data-mfilter" : null)
      : null;
    const focusKey = focusAttr
      ? (focusAttr === "data-filter" ? active.dataset.filter : active.dataset.mfilter)
      : null;
    const caret = focusKey && active.selectionStart !== undefined ? active.selectionStart : null;

    const ctx = this._context();
    const view =
      this._state.view === "manage"
        ? renderManage(ctx)
        : this._state.view === "admin"
          ? renderAdmin(ctx)
          : renderOverview(ctx);

    app.innerHTML = String(html`
      <div class="app-header">
        <div class="toolbar">
          <button class="menu-button" data-action="toggle-menu" title="Menu">
            ${icon("menu", 24)}
          </button>
          <div class="title">${t("app.title")}</div>
        </div>
        <div class="tabs" role="tablist">
          ${VIEWS.filter((name) => name !== "admin" || this._isAdmin).map(
            (name) => html`<button
              class="tab"
              role="tab"
              data-action="goto"
              data-view="${name}"
              aria-selected="${this._state.view === name ? "true" : "false"}"
            >
              ${t(`tab.${name}`)}
            </button>`
          )}
        </div>
      </div>
      <div class="content">${view}</div>
    `);

    if (focusKey) {
      const restored = app.querySelector(`[${focusAttr}="${focusKey}"]`);
      if (restored) {
        restored.focus();
        if (caret !== null && restored.setSelectionRange) {
          try {
            restored.setSelectionRange(caret, caret);
          } catch {
            /* not supported for this input type */
          }
        }
      }
    }
  }

  _renderOverlay(force = false) {
    const container = this.shadowRoot.getElementById("overlay");
    const key = this._dialog
      ? `${this._dialog.kind}:${this._dialog.id || "new"}:${this._dialog.error || ""}`
      : "";
    if (!force && key === this._overlayKey) return;
    this._overlayKey = key;

    if (!this._dialog) {
      container.innerHTML = "";
      return;
    }

    const values = this._dialog.values || {};
    let body;
    let actions;

    if (this._dialog.kind === "item") {
      body = itemDialogBody(values, this._data);
      actions = dialogActions({ confirmLabel: t("action.save") });
    } else if (this._dialog.kind === "manufacturer") {
      body = manufacturerDialogBody(values);
      actions = dialogActions({ confirmLabel: t("action.save") });
    } else if (this._dialog.kind === "material") {
      body = materialDialogBody(values);
      actions = dialogActions({ confirmLabel: t("action.save") });
    } else {
      body = html`<p>${this._dialog.text}</p>`;
      actions = dialogActions({
        confirmLabel: this._dialog.confirmLabel || t("action.delete"),
        danger: true,
      });
    }

    container.innerHTML = String(
      dialog({ title: this._dialog.title, body, actions, error: this._dialog.error })
    );

    const firstField = container.querySelector("[data-field]");
    if (firstField) firstField.focus();
  }

  _toast(message, isError = false) {
    const container = this.shadowRoot.getElementById("toast");
    container.innerHTML = String(
      html`<div class="toast ${isError ? "error" : ""}">${message}</div>`
    );
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      container.innerHTML = "";
    }, isError ? 6000 : 2500);
  }

  // -- Navigation ----------------------------------------------------------

  _navigate(view) {
    if (!VIEWS.includes(view)) return;
    this._state.view = view;
    const prefix = (this._route && this._route.prefix) || "/filament-manager";
    history.pushState(null, "", `${prefix}/${view}`);
    this.dispatchEvent(
      new CustomEvent("location-changed", { bubbles: true, composed: true })
    );
    this._renderApp();
  }

  // -- Dialog helpers ------------------------------------------------------

  _openDialog(config) {
    this._dialog = { error: "", ...config };
    this._renderOverlay(true);
  }

  _closeDialog() {
    this._dialog = null;
    this._renderOverlay(true);
  }

  _setDialogError(message) {
    if (!this._dialog) return;
    this._dialog.error = message;
    this._renderOverlay(true);
  }

  _confirm({ title, text, confirmLabel, onConfirm }) {
    this._openDialog({ kind: "confirm", title, text, confirmLabel, onConfirm });
  }

  /** Message shown when master data is still referenced by entries. */
  _blockedMessage(name, count) {
    const key = count === 1 ? "admin.delete_blocked_one" : "admin.delete_blocked";
    return t(key, { name, count });
  }

  _findItem(id) {
    return (this._data.items || []).find((item) => item.id === id) || null;
  }

  // -- Event handling ------------------------------------------------------

  _onKeyDown(event) {
    if (event.key === "Escape" && this._dialog) {
      event.preventDefault();
      this._closeDialog();
      return;
    }
    if (
      event.key === "Enter" &&
      this._dialog &&
      this._dialog.kind !== "confirm" &&
      event.target.tagName === "INPUT"
    ) {
      event.preventDefault();
      this._commitDialog();
    }
  }

  /** Filter inputs live in the main area and re-render the list as you type. */
  _applyFilter(target) {
    if (target.dataset.filter) {
      this._state.filters[target.dataset.filter] = target.value;
      this._renderApp();
      return true;
    }
    if (target.dataset.mfilter) {
      this._state.manageFilters[target.dataset.mfilter] = target.value;
      this._renderApp();
      return true;
    }
    return false;
  }

  /** Dialog fields are kept in state without re-rendering, so focus survives. */
  _captureDialogField(target) {
    if (!this._dialog || !target.dataset.field || !target.closest(".overlay")) return false;
    this._dialog.values[target.dataset.field] = target.value;
    return true;
  }

  _onInput(event) {
    const target = event.target;
    if (!target || !target.dataset) return;
    if (this._applyFilter(target)) return;
    this._captureDialogField(target);
  }

  _onChange(event) {
    const target = event.target;
    if (!target || !target.dataset) return;
    if (this._applyFilter(target)) return;
    if (this._captureDialogField(target)) return;
    // Inline editing of an opened spool in the manage view.
    const editor = target.closest(".spool-edit");
    if (editor && target.dataset.field) {
      this._call({
        type: `${DOMAIN}/spool/update`,
        item_id: editor.dataset.item,
        spool_id: editor.dataset.spool,
        [target.dataset.field]: target.value === "" ? null : target.value,
      }).catch(() => {});
    }
  }

  _onClick(event) {
    const trigger = event.composedPath().find((node) => node.dataset && node.dataset.action);
    if (!trigger) return;
    const { action } = trigger.dataset;

    // Clicks inside the dialog box must not close it through the backdrop.
    if (action === "dialog-backdrop" && event.target !== trigger) return;

    const handler = this._actions()[action];
    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(trigger.dataset, trigger);
    }
  }

  _actions() {
    const ws = (message) => this._call(message).catch(() => {});

    return {
      "toggle-menu": () =>
        this.dispatchEvent(
          new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
        ),
      goto: (dataset) => this._navigate(dataset.view),
      "goto-manage": () => this._navigate("manage"),

      "reset-manage-filters": () => {
        this._state.manageFilters = { q: "", sort: "manufacturer" };
        this._renderApp();
      },

      "reset-filters": () => {
        this._state.filters = {
          q: "",
          manufacturer: "",
          material: "",
          condition: "",
          sort: "manufacturer",
        };
        this._renderApp();
      },

      // ---- inventory items ----
      "new-item": () =>
        this._openDialog({
          kind: "item",
          mode: "new",
          title: t("dialog.item.new"),
          values: newItemValues(this._data),
        }),

      "edit-item": (dataset) => {
        const item = this._findItem(dataset.item);
        if (!item) return;
        this._openDialog({
          kind: "item",
          mode: "edit",
          id: item.id,
          title: t("dialog.item.edit"),
          values: {
            manufacturer_id: item.manufacturer_id,
            material_id: item.material_id,
            color_name: item.color_name,
            color_hex: item.color_hex,
            diameter: item.diameter,
            spool_net_weight_g: item.spool_net_weight_g,
            sealed_count: item.sealed_count,
            location: item.location,
            price: item.price ?? "",
            purchase_date: item.purchase_date ?? "",
            nozzle_temp: item.nozzle_temp ?? "",
            bed_temp: item.bed_temp ?? "",
            notes: item.notes,
          },
        });
      },

      "delete-item": (dataset) => {
        const item = this._findItem(dataset.item);
        if (!item) return;
        this._confirm({
          title: t("manage.delete_title"),
          text: t("manage.delete_text", { name: itemLabel(item, this._lookup) }),
          onConfirm: async () => {
            await this._call({ type: `${DOMAIN}/item/delete`, item_id: item.id });
            this._toast(t("toast.deleted"));
          },
        });
      },

      "sealed-plus": (dataset) => {
        const item = this._findItem(dataset.item);
        if (!item) return;
        ws({
          type: `${DOMAIN}/item/set_sealed`,
          item_id: item.id,
          sealed_count: Number(item.sealed_count || 0) + 1,
        });
      },

      "sealed-minus": (dataset) => {
        const item = this._findItem(dataset.item);
        if (!item || Number(item.sealed_count || 0) < 1) return;
        ws({
          type: `${DOMAIN}/item/set_sealed`,
          item_id: item.id,
          sealed_count: Number(item.sealed_count) - 1,
        });
      },

      "open-spool": (dataset) => {
        this._state.expanded.add(dataset.item);
        ws({ type: `${DOMAIN}/spool/open`, item_id: dataset.item });
      },

      "toggle-spools": (dataset) => {
        if (this._state.expanded.has(dataset.item)) {
          this._state.expanded.delete(dataset.item);
        } else {
          this._state.expanded.add(dataset.item);
        }
        this._renderApp();
      },

      "consume-spool": (dataset) => {
        const item = this._findItem(dataset.item);
        if (!item) return;
        this._confirm({
          title: t("manage.consume_title"),
          text: t("manage.consume_text", { name: itemLabel(item, this._lookup) }),
          confirmLabel: t("manage.consume"),
          onConfirm: async () => {
            await this._call({
              type: `${DOMAIN}/spool/consume`,
              item_id: dataset.item,
              spool_id: dataset.spool,
            });
            this._toast(t("toast.deleted"));
          },
        });
      },

      "copy-id": async (dataset) => {
        try {
          await navigator.clipboard.writeText(dataset.id);
          this._toast(t("toast.id_copied"));
        } catch {
          this._toast(dataset.id);
        }
      },

      // ---- master data ----
      "new-manufacturer": () =>
        this._openDialog({
          kind: "manufacturer",
          mode: "new",
          title: t("dialog.manufacturer.new"),
          values: newManufacturerValues(this._data),
        }),

      "edit-manufacturer": (dataset) => {
        const entry = this._data.manufacturers.find((one) => one.id === dataset.id);
        if (!entry) return;
        this._openDialog({
          kind: "manufacturer",
          mode: "edit",
          id: entry.id,
          title: t("dialog.manufacturer.edit"),
          values: { name: entry.name, website: entry.website, sort_order: entry.sort_order },
        });
      },

      "delete-manufacturer": (dataset) => {
        const entry = this._data.manufacturers.find((one) => one.id === dataset.id);
        if (!entry) return;
        const used = (this._data.usage.manufacturers || {})[entry.id] || 0;
        if (used > 0) {
          this._toast(this._blockedMessage(entry.name, used), true);
          return;
        }
        this._confirm({
          title: t("admin.delete_manufacturer_title"),
          text: t("admin.delete_text", { name: entry.name }),
          onConfirm: async () => {
            await this._call({
              type: `${DOMAIN}/manufacturer/delete`,
              manufacturer_id: entry.id,
            });
            this._toast(t("toast.deleted"));
          },
        });
      },

      "new-material": () =>
        this._openDialog({
          kind: "material",
          mode: "new",
          title: t("dialog.material.new"),
          values: newMaterialValues(this._data),
        }),

      "edit-material": (dataset) => {
        const entry = this._data.materials.find((one) => one.id === dataset.id);
        if (!entry) return;
        this._openDialog({
          kind: "material",
          mode: "edit",
          id: entry.id,
          title: t("dialog.material.edit"),
          values: {
            name: entry.name,
            nozzle_temp: entry.nozzle_temp ?? "",
            bed_temp: entry.bed_temp ?? "",
            density: entry.density ?? "",
            sort_order: entry.sort_order,
          },
        });
      },

      "delete-material": (dataset) => {
        const entry = this._data.materials.find((one) => one.id === dataset.id);
        if (!entry) return;
        const used = (this._data.usage.materials || {})[entry.id] || 0;
        if (used > 0) {
          this._toast(this._blockedMessage(entry.name, used), true);
          return;
        }
        this._confirm({
          title: t("admin.delete_material_title"),
          text: t("admin.delete_text", { name: entry.name }),
          onConfirm: async () => {
            await this._call({ type: `${DOMAIN}/material/delete`, material_id: entry.id });
            this._toast(t("toast.deleted"));
          },
        });
      },

      // ---- dialog ----
      "dialog-backdrop": () => this._closeDialog(),
      "dialog-cancel": () => this._closeDialog(),
      "dialog-confirm": () => this._commitDialog(),
    };
  }

  async _commitDialog() {
    if (!this._dialog) return;
    const { kind, mode, id, values } = this._dialog;

    if (kind === "confirm") {
      const { onConfirm } = this._dialog;
      this._closeDialog();
      if (onConfirm) await onConfirm().catch(() => {});
      return;
    }

    if (kind === "item") {
      if (!values.manufacturer_id || !values.material_id) {
        this._setDialogError(t("error.item_required"));
        return;
      }
    } else if (!String(values.name || "").trim()) {
      this._setDialogError(t("error.name_required"));
      return;
    }

    const target = { item: "item", manufacturer: "manufacturer", material: "material" }[kind];
    const message = {
      type: `${DOMAIN}/${target}/${mode === "edit" ? "update" : "create"}`,
      ...this._cleanValues(values),
    };
    // The record id must not be sent as "id" — the websocket client uses that
    // key for the message number and would overwrite it.
    if (mode === "edit") message[`${target}_id`] = id;

    try {
      await this._call(message);
    } catch {
      return;
    }
    this._closeDialog();
    this._toast(t("toast.saved"));
  }

  /** Turn empty form fields into nulls the backend reads as "not set". */
  _cleanValues(values) {
    const cleaned = {};
    for (const [key, value] of Object.entries(values)) {
      cleaned[key] = value === "" ? null : value;
    }
    return cleaned;
  }
}

if (!customElements.get("filament-manager-panel")) {
  customElements.define("filament-manager-panel", FilamentManagerPanel);
}
