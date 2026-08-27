/**
 * The admin view: master data for manufacturers and filament types.
 */

import { t } from "../i18n.js";
import {
  emptyState,
  fmtNumber,
  html,
  icon,
  raw,
  selectField,
  textField,
} from "../ui.js";
import { spoolTypeLabel } from "../data.js";

function usageChip(count) {
  if (count === 0) return html`<span class="chip muted">${t("admin.unused")}</span>`;
  const key = count === 1 ? "admin.used_in_one" : "admin.used_in";
  return html`<span class="chip">${t(key, { count })}</span>`;
}

function masterRow({ entry, subtitle, usage, editAction, deleteAction }) {
  return html`<div class="row">
    <div class="row-main">
      <div class="grow">
        <div class="name">${entry.name}</div>
        <div class="sub hint">${subtitle}</div>
      </div>
      <div class="row-actions">
        ${usageChip(usage)}
        <button
          class="icon-btn"
          data-action="${editAction}"
          data-id="${entry.id}"
          title="${t("action.edit")}"
        >
          ${icon("pencil")}
        </button>
        <button
          class="icon-btn danger"
          data-action="${deleteAction}"
          data-id="${entry.id}"
          title="${t("action.delete")}"
          ${raw(usage > 0 ? "disabled" : "")}
        >
          ${icon("delete")}
        </button>
      </div>
    </div>
  </div>`;
}

function materialSubtitle(entry) {
  const temps =
    entry.nozzle_temp !== null || entry.bed_temp !== null
      ? t("admin.temps", {
          nozzle: entry.nozzle_temp ?? "–",
          bed: entry.bed_temp ?? "–",
        })
      : t("admin.no_temps");
  const density =
    entry.density !== null && entry.density !== undefined
      ? ` · ${fmtNumber(entry.density, 2)} g/cm³`
      : "";
  return `${temps}${density}`;
}

/**
 * One spool type with an inline field for the weight of the bare spool.
 *
 * The value is saved on blur, like the remaining-amount fields in the manage
 * view, so setting a weight is a single click and a number.
 */
function spoolTypeRow(entry, usage, lookup) {
  const missing = entry.empty_weight_g === null || entry.empty_weight_g === undefined;
  return html`<div class="row ${missing ? "needs-value" : ""}" data-spool-type="${entry.id}">
    <div class="row-main">
      <div class="grow">
        <div class="name">
          ${spoolTypeLabel(entry, lookup)} · ${fmtNumber(entry.net_weight_g)} g
        </div>
        <div class="sub hint">
          ${missing ? t("admin.tare_missing") : t("admin.tare_set")}
        </div>
      </div>
      <div class="row-actions">
        ${usage > 0
          ? html`<span class="chip"
              >${t(usage === 1 ? "admin.used_in_one" : "admin.used_in", { count: usage })}</span
            >`
          : html`<span class="chip muted">${t("admin.unused")}</span>`}
        <div class="num-field">
          ${textField({
            name: "empty_weight_g",
            label: t("field.empty_weight_short"),
            type: "number",
            min: 0,
            step: 0.1,
            value: entry.empty_weight_g,
            title: t("field.empty_weight_hint"),
          })}
        </div>
        <button
          class="icon-btn danger"
          data-action="delete-spool-type"
          data-id="${entry.id}"
          title="${t("action.delete")}"
          ${raw(usage > 0 ? "disabled" : "")}
        >
          ${icon("delete")}
        </button>
      </div>
    </div>
  </div>`;
}

/** Render the admin view. */
export function renderAdmin(ctx) {
  const { data, isAdmin } = ctx;

  if (!isAdmin) {
    return emptyState({
      emoji: "🔒",
      title: t("admin.only_admin.title"),
      text: t("admin.only_admin.text"),
    });
  }

  const usage = data.usage || { manufacturers: {}, materials: {}, spool_types: {} };
  const spoolTypes = data.spool_types || [];

  return html`<div class="section-title">
      <span>${t("admin.title")} — ${t("admin.manufacturers")}</span>
      <span class="spacer"></span>
      <button class="btn" data-action="new-manufacturer">
        ${icon("plus")} ${t("admin.new_manufacturer")}
      </button>
    </div>
    ${data.manufacturers.length
      ? html`<div class="list">
          ${data.manufacturers.map((entry) =>
            masterRow({
              entry,
              subtitle: entry.website || "—",
              usage: usage.manufacturers[entry.id] || 0,
              editAction: "edit-manufacturer",
              deleteAction: "delete-manufacturer",
            })
          )}
        </div>`
      : html`<div class="card">${t("admin.no_manufacturers")}</div>`}

    <div class="section-title">
      <span>${t("admin.materials")}</span>
      <span class="spacer"></span>
      <button class="btn" data-action="new-material">
        ${icon("plus")} ${t("admin.new_material")}
      </button>
    </div>
    ${data.materials.length
      ? html`<div class="list">
          ${data.materials.map((entry) =>
            masterRow({
              entry,
              subtitle: materialSubtitle(entry),
              usage: usage.materials[entry.id] || 0,
              editAction: "edit-material",
              deleteAction: "delete-material",
            })
          )}
        </div>`
      : html`<div class="card">${t("admin.no_materials")}</div>`}

    <div class="section-title">
      <span>${t("admin.spool_types")}</span>
      <span class="spacer"></span>
      <button class="btn" data-action="new-spool-type">
        ${icon("plus")} ${t("admin.new_spool_type")}
      </button>
    </div>
    <div class="hint" style="margin-bottom:12px">${t("admin.spool_types_hint")}</div>
    ${spoolTypes.length
      ? html`<div class="list">
          ${spoolTypes.map((entry) =>
            spoolTypeRow(entry, usage.spool_types[entry.id] || 0, ctx.lookup)
          )}
        </div>`
      : html`<div class="card">${t("admin.no_spool_types")}</div>`}`;
}

/** Body of the manufacturer dialog. */
export function manufacturerDialogBody(values) {
  return html`<div class="form-grid">
    <div class="span-2">
      ${textField({ name: "name", label: t("field.name"), value: values.name })}
    </div>
    <div class="span-2">
      ${textField({
        name: "website",
        label: `${t("field.website")} (${t("field.optional")})`,
        value: values.website,
        placeholder: "https://",
      })}
    </div>
    ${textField({
      name: "sort_order",
      label: t("field.sort_order"),
      type: "number",
      min: 0,
      step: 1,
      value: values.sort_order,
    })}
  </div>`;
}

/** Body of the filament type dialog. */
export function materialDialogBody(values) {
  return html`<div class="form-grid">
    <div class="span-2">
      ${textField({ name: "name", label: t("field.name"), value: values.name })}
    </div>
    ${textField({
      name: "nozzle_temp",
      label: t("field.nozzle_temp"),
      type: "number",
      min: 0,
      max: 600,
      step: 5,
      value: values.nozzle_temp,
    })}
    ${textField({
      name: "bed_temp",
      label: t("field.bed_temp"),
      type: "number",
      min: 0,
      max: 300,
      step: 5,
      value: values.bed_temp,
    })}
    ${textField({
      name: "density",
      label: t("field.density"),
      type: "number",
      min: 0.1,
      max: 10,
      step: 0.01,
      value: values.density,
    })}
    ${textField({
      name: "sort_order",
      label: t("field.sort_order"),
      type: "number",
      min: 0,
      step: 1,
      value: values.sort_order,
    })}
  </div>`;
}

export function newManufacturerValues(data) {
  return { name: "", website: "", sort_order: data.manufacturers.length };
}

export function newMaterialValues(data) {
  return {
    name: "",
    nozzle_temp: "",
    bed_temp: "",
    density: "",
    sort_order: data.materials.length,
  };
}


/** Body of the dialog that adds a combination which is not in stock yet. */
export function spoolTypeDialogBody(values, data) {
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
    ${selectField({
      name: "net_weight_g",
      label: t("field.net_weight"),
      value: values.net_weight_g,
      options: [250, 500, 750, 1000, 2000, 3000].map((value) => ({
        value,
        label: `${value} g`,
      })),
    })}
    ${textField({
      name: "empty_weight_g",
      label: t("field.empty_weight"),
      type: "number",
      min: 0,
      step: 0.1,
      value: values.empty_weight_g,
      hint: t("field.empty_weight_hint"),
    })}
  </div>`;
}

export function newSpoolTypeValues(data) {
  return {
    manufacturer_id: data.manufacturers[0]?.id || "",
    material_id: data.materials[0]?.id || "",
    net_weight_g: 1000,
    empty_weight_g: "",
  };
}
