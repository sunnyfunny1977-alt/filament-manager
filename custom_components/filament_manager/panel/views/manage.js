/**
 * The manage view: everything that changes the actual stock.
 */

import { t } from "../i18n.js";
import {
  colorField,
  emptyState,
  fmtDate,
  fmtDiameter,
  fmtNumber,
  fmtWeight,
  html,
  icon,
  progressBar,
  raw,
  selectField,
  swatch,
  textAreaField,
  textField,
} from "../ui.js";
import { filterAndSort, itemGrams, itemTare, spoolPercent } from "../data.js";

const NET_WEIGHT_PRESETS = [250, 500, 750, 1000, 2000, 3000];
const DIAMETERS = [1.75, 2.85, 3.0];

function openSpoolEditor(item, spool, index, tare) {
  const net = Number(item.spool_net_weight_g || 0);
  const hasTare = tare !== null && tare !== undefined;
  return html`<div class="spool-edit" data-item="${item.id}" data-spool="${spool.id}">
    <div class="grow">
      <div class="open-row">
        <span class="chip muted">${t("label.spool_index", { index: index + 1 })}</span>
        ${progressBar(spoolPercent(spool, net))}
      </div>
      <div class="hint">
        ${t("label.opened_at")}: ${fmtDate(spool.opened_at)}
      </div>
    </div>
    <div class="num-field">
      ${textField({
        name: "remaining_percent",
        label: t("field.remaining_percent"),
        type: "number",
        min: 0,
        max: 100,
        step: 1,
        value: spool.remaining_percent,
      })}
    </div>
    <div class="num-field">
      ${textField({
        name: "remaining_grams",
        label: t("field.remaining_grams"),
        type: "number",
        min: 0,
        step: 1,
        value: spool.remaining_grams,
      })}
    </div>
    <div class="num-field">
      ${textField({
        name: "gross_weight_g",
        label: t("field.gross_weight"),
        type: "number",
        min: 0,
        step: 1,
        // Never prefilled: this is a calculator input, not a stored value.
        value: "",
        placeholder: hasTare ? "" : "—",
        disabled: !hasTare,
        title: hasTare ? t("field.gross_weight_hint") : t("field.gross_weight_disabled"),
      })}
    </div>
    <div class="grow">
      ${textField({ name: "note", label: t("field.note"), value: spool.note })}
    </div>
    <button
      class="btn danger text"
      data-action="consume-spool"
      data-item="${item.id}"
      data-spool="${spool.id}"
    >
      ${t("manage.consume")}
    </button>
  </div>`;
}

function itemRow(item, ctx) {
  const { lookup, state, isAdmin } = ctx;
  const tare = itemTare(item, lookup);
  const hasTare = tare !== null && tare !== undefined;
  const sealed = Number(item.sealed_count || 0);
  const open = item.open_spools || [];
  const expanded = state.expanded.has(item.id);

  return html`<div class="row" data-item="${item.id}">
    <div class="row-main">
      ${swatch(item.color_hex)}
      <div class="grow">
        <div class="name">
          ${lookup.manufacturerName(item.manufacturer_id)}
          ${lookup.materialName(item.material_id)} · ${item.color_name || "–"}
        </div>
        <div class="sub hint">
          ${fmtDiameter(item.diameter)} · ${fmtNumber(item.spool_net_weight_g)} g ·
          ${fmtWeight(itemGrams(item))}${hasTare
            ? ` · ${t("label.empty_weight")} ${fmtNumber(tare)} g`
            : ""}${item.location ? ` · ${item.location}` : ""}
        </div>
      </div>

      <div class="row-actions">
        <span class="hint">${t("manage.sealed_count")}</span>
        <span class="counter">
          <button
            class="icon-btn plain"
            data-action="sealed-minus"
            data-item="${item.id}"
            title="-1"
            ${raw(!isAdmin || sealed < 1 ? "disabled" : "")}
          >
            ${icon("minus")}
          </button>
          <span class="num">${sealed}</span>
          <button
            class="icon-btn plain"
            data-action="sealed-plus"
            data-item="${item.id}"
            title="+1"
            ${raw(isAdmin ? "" : "disabled")}
          >
            ${icon("plus")}
          </button>
        </span>

        <button
          class="btn secondary"
          data-action="open-spool"
          data-item="${item.id}"
          ${raw(!isAdmin || sealed < 1 ? "disabled" : "")}
        >
          ${t("manage.open_spool")}
        </button>

        <button
          class="btn text"
          data-action="toggle-spools"
          data-item="${item.id}"
          title="${expanded ? t("manage.hide_spools") : t("manage.show_spools")}"
          ${raw(open.length ? "" : "disabled")}
        >
          ${icon(expanded ? "chevronUp" : "chevronDown")}
          ${open.length
            ? t("label.open_spools", { count: open.length })
            : t("manage.no_open_spools")}
        </button>

        <button
          class="icon-btn"
          data-action="edit-item"
          data-item="${item.id}"
          title="${t("action.edit")}"
          ${raw(isAdmin ? "" : "disabled")}
        >
          ${icon("pencil")}
        </button>
        <button
          class="icon-btn danger"
          data-action="delete-item"
          data-item="${item.id}"
          title="${t("action.delete")}"
          ${raw(isAdmin ? "" : "disabled")}
        >
          ${icon("delete")}
        </button>
        <button
          class="id-badge"
          data-action="copy-id"
          data-id="${item.id}"
          title="${t("manage.copy_id")}"
        >
          ${item.id}
        </button>
      </div>
    </div>

    ${expanded && open.length
      ? html`<div class="sub-list">
          <div class="section-title" style="margin:0">
            ${t("manage.open_spools_title")}
          </div>
          <div class="hint">
            ${t("field.remaining_hint")}
            ${hasTare ? ` ${t("field.gross_weight_hint")}` : ` ${t("field.gross_weight_disabled")}`}
          </div>
          ${open.map((spool, index) => openSpoolEditor(item, spool, index, tare))}
        </div>`
      : ""}
  </div>`;
}

/** Render the manage view. */
export function renderManage(ctx) {
  const { data, state, lookup, isAdmin } = ctx;
  const items = data.items || [];

  const header = html`<div class="section-title">
    <span>${t("manage.title")}</span>
    <span class="spacer"></span>
    <button class="btn" data-action="new-item" ${raw(isAdmin ? "" : "disabled")}>
      ${icon("plus")} ${t("manage.new_item")}
    </button>
  </div>`;

  const toolbar = html`<div class="filters">
    <div class="grow">
      <input
        type="search"
        data-mfilter="q"
        value="${state.manageFilters.q}"
        placeholder="${t("filter.search_placeholder")}"
        aria-label="${t("filter.search")}"
      />
    </div>
    <select data-mfilter="sort" aria-label="${t("filter.sort")}">
      ${["manufacturer", "material", "color", "remaining", "updated"].map(
        (key) => html`<option value="${key}" ${state.manageFilters.sort === key ? " selected" : ""}>
          ${t("filter.sort")}: ${t(`sort.${key}`)}
        </option>`
      )}
    </select>
  </div>`;

  const notice = isAdmin
    ? ""
    : html`<div class="card" style="margin-bottom:12px">${t("readonly.notice")}</div>`;

  if (!items.length) {
    return html`${header} ${notice}
    ${emptyState({
      emoji: "📦",
      title: t("manage.empty.title"),
      text: t("manage.empty.text"),
      actionLabel: isAdmin ? t("manage.new_item") : "",
      action: "new-item",
    })}`;
  }

  const visible = filterAndSort(
    items,
    { q: state.manageFilters.q, manufacturer: "", material: "", condition: "", sort: state.manageFilters.sort },
    lookup
  );

  return html`${header} ${notice} ${toolbar}
  ${visible.length
    ? html`<div class="list">${visible.map((item) => itemRow(item, ctx))}</div>`
    : emptyState({
        emoji: "🔍",
        title: t("overview.no_match.title"),
        text: t("overview.no_match.text"),
        actionLabel: t("overview.no_match.action"),
        action: "reset-manage-filters",
      })}`;
}

/** Body of the create/edit dialog for an inventory item. */
export function itemDialogBody(values, data) {
  return html`<div class="form-grid">
    ${selectField({
      name: "manufacturer_id",
      label: t("field.manufacturer"),
      value: values.manufacturer_id,
      placeholder: "—",
      options: data.manufacturers.map((entry) => ({ value: entry.id, label: entry.name })),
    })}
    ${selectField({
      name: "material_id",
      label: t("field.material"),
      value: values.material_id,
      placeholder: "—",
      options: data.materials.map((entry) => ({ value: entry.id, label: entry.name })),
    })}

    <div class="span-2">
      ${colorField({
        nameText: "color_name",
        nameHex: "color_hex",
        label: t("field.color_name"),
        textValue: values.color_name,
        hexValue: values.color_hex || "#9e9e9e",
        placeholder: t("field.color_name_placeholder"),
      })}
    </div>

    ${selectField({
      name: "diameter",
      label: t("field.diameter"),
      value: values.diameter,
      options: DIAMETERS.map((value) => ({ value, label: `${value} mm` })),
    })}
    ${selectField({
      name: "spool_net_weight_g",
      label: t("field.net_weight"),
      value: values.spool_net_weight_g,
      options: NET_WEIGHT_PRESETS.map((value) => ({ value, label: `${value} g` })),
    })}

    ${textField({
      name: "sealed_count",
      label: t("field.sealed_count"),
      type: "number",
      min: 0,
      step: 1,
      value: values.sealed_count,
    })}
    ${textField({
      name: "location",
      label: t("field.location"),
      value: values.location,
      placeholder: t("field.location_placeholder"),
    })}

    ${textField({
      name: "price",
      label: t("field.price"),
      type: "number",
      min: 0,
      step: 0.01,
      value: values.price,
    })}
    ${textField({
      name: "purchase_date",
      label: t("field.purchase_date"),
      type: "date",
      value: values.purchase_date,
    })}

    ${textField({
      name: "nozzle_temp",
      label: t("field.nozzle_temp"),
      type: "number",
      min: 0,
      max: 600,
      step: 5,
      value: values.nozzle_temp,
      hint: t("field.temp_hint"),
    })}
    ${textField({
      name: "bed_temp",
      label: t("field.bed_temp"),
      type: "number",
      min: 0,
      max: 300,
      step: 5,
      value: values.bed_temp,
      hint: t("field.temp_hint"),
    })}

    <div class="span-2">
      ${textAreaField({ name: "notes", label: t("field.notes"), value: values.notes })}
    </div>
  </div>`;
}

/** Default values for a new item. */
export function newItemValues(data) {
  return {
    manufacturer_id: data.manufacturers[0]?.id || "",
    material_id: data.materials[0]?.id || "",
    color_name: "",
    color_hex: "#9e9e9e",
    diameter: 1.75,
    spool_net_weight_g: 1000,
    sealed_count: 1,
    location: "",
    price: "",
    purchase_date: "",
    nozzle_temp: "",
    bed_temp: "",
    notes: "",
  };
}
