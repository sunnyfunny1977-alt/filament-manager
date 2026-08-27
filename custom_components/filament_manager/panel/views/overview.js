/**
 * The default view: a read-only overview of the whole inventory.
 */

import { t } from "../i18n.js";
import {
  emptyState,
  fmtCurrency,
  fmtDate,
  fmtDiameter,
  fmtNumber,
  fmtWeight,
  html,
  progressBar,
  swatch,
} from "../ui.js";
import {
  filterAndSort,
  itemGrams,
  itemSpoolCount,
  itemTemps,
  spoolGrams,
  spoolPercent,
} from "../data.js";

function summaryStrip(summary) {
  const stats = [
    { value: fmtNumber(summary.total_spools), label: t("stat.total_spools") },
    { value: fmtNumber(summary.sealed_spools), label: t("stat.sealed") },
    { value: fmtNumber(summary.open_spools), label: t("stat.open") },
    { value: fmtWeight(summary.total_grams), label: t("stat.weight") },
    { value: fmtCurrency(summary.inventory_value), label: t("stat.value") },
    { value: fmtNumber(summary.entry_count), label: t("stat.entries") },
  ];
  return html`<div class="summary">
    ${stats.map(
      (stat) => html`<div class="stat">
        <div class="value">${stat.value}</div>
        <div class="label">${stat.label}</div>
      </div>`
    )}
  </div>`;
}

function filterBar(data, filters) {
  return html`<div class="filters">
    <div class="grow">
      <input
        type="search"
        data-filter="q"
        value="${filters.q}"
        placeholder="${t("filter.search_placeholder")}"
        aria-label="${t("filter.search")}"
      />
    </div>
    <select data-filter="manufacturer" aria-label="${t("filter.manufacturer")}">
      <option value="">${t("filter.manufacturer")}: ${t("filter.all")}</option>
      ${data.manufacturers.map(
        (entry) => html`<option
          value="${entry.id}"
          ${filters.manufacturer === entry.id ? " selected" : ""}
        >
          ${entry.name}
        </option>`
      )}
    </select>
    <select data-filter="material" aria-label="${t("filter.material")}">
      <option value="">${t("filter.material")}: ${t("filter.all")}</option>
      ${data.materials.map(
        (entry) => html`<option
          value="${entry.id}"
          ${filters.material === entry.id ? " selected" : ""}
        >
          ${entry.name}
        </option>`
      )}
    </select>
    <select data-filter="condition" aria-label="${t("filter.condition")}">
      <option value="">${t("filter.condition")}: ${t("filter.all")}</option>
      <option value="sealed" ${filters.condition === "sealed" ? " selected" : ""}>
        ${t("condition.sealed_only")}
      </option>
      <option value="open" ${filters.condition === "open" ? " selected" : ""}>
        ${t("condition.open_only")}
      </option>
    </select>
    <select data-filter="sort" aria-label="${t("filter.sort")}">
      ${["manufacturer", "material", "color", "remaining", "updated"].map(
        (key) => html`<option value="${key}" ${filters.sort === key ? " selected" : ""}>
          ${t("filter.sort")}: ${t(`sort.${key}`)}
        </option>`
      )}
    </select>
  </div>`;
}

function itemCard(item, lookup) {
  const net = Number(item.spool_net_weight_g || 0);
  const sealed = Number(item.sealed_count || 0);
  const open = item.open_spools || [];
  const temps = itemTemps(item, lookup);

  const meta = [
    item.location ? `${t("label.location")}: ${item.location}` : "",
    item.spool_empty_weight_g !== null && item.spool_empty_weight_g !== undefined
      ? `${t("label.empty_weight")}: ${fmtNumber(item.spool_empty_weight_g)} g`
      : "",
    temps.nozzle !== null ? `${t("label.nozzle")}: ${temps.nozzle} °C` : "",
    temps.bed !== null ? `${t("label.bed")}: ${temps.bed} °C` : "",
    item.price !== null && item.price !== undefined
      ? `${t("label.price")}: ${fmtCurrency(item.price)}`
      : "",
    item.purchase_date ? `${t("label.purchased")}: ${fmtDate(item.purchase_date)}` : "",
  ].filter(Boolean);

  return html`<div class="card spool-card">
    <div class="spool-head">
      ${swatch(item.color_hex)}
      <div class="spool-title">
        <div class="name">
          ${lookup.manufacturerName(item.manufacturer_id)}
          ${lookup.materialName(item.material_id)}
        </div>
        <div class="sub">
          ${item.color_name || "–"} · ${fmtDiameter(item.diameter)} ·
          ${fmtNumber(net)} g
        </div>
      </div>
      <div class="chip muted">${fmtWeight(itemGrams(item))}</div>
    </div>

    <div class="chips">
      ${sealed > 0 ? html`<span class="chip sealed">${t("label.sealed", { count: sealed })}</span>` : ""}
      ${open.length > 0
        ? html`<span class="chip open">${t("label.open_spools", { count: open.length })}</span>`
        : ""}
      ${itemSpoolCount(item) === 0
        ? html`<span class="chip muted">${t("label.no_stock")}</span>`
        : ""}
    </div>

    ${open.map((spool, index) => {
      const percent = spoolPercent(spool, net);
      const parts = [
        spool.remaining_percent !== null && spool.remaining_percent !== undefined
          ? `${fmtNumber(spool.remaining_percent)} %`
          : "",
        spool.remaining_grams !== null && spool.remaining_grams !== undefined
          ? `${fmtNumber(spool.remaining_grams)} g`
          : "",
      ].filter(Boolean);
      return html`<div class="open-row">
        <span class="chip muted">${t("label.spool_index", { index: index + 1 })}</span>
        ${progressBar(percent)}
        <span class="amount">
          ${parts.length ? parts.join(" · ") : fmtWeight(spoolGrams(spool, net))}
        </span>
      </div>`;
    })}
    ${meta.length ? html`<div class="meta">${meta.map((line) => html`<span>${line}</span>`)}</div>` : ""}
    ${item.notes ? html`<div class="meta"><span>${item.notes}</span></div>` : ""}
  </div>`;
}

/** Render the overview. */
export function renderOverview(ctx) {
  const { data, state, lookup } = ctx;
  const items = data.items || [];

  if (!items.length) {
    return html`${summaryStrip(data.summary)}
    ${emptyState({
      emoji: "🧵",
      title: t("overview.empty.title"),
      text: t("overview.empty.text"),
      actionLabel: ctx.isAdmin ? t("overview.empty.action") : "",
      action: "goto-manage",
    })}`;
  }

  const visible = filterAndSort(items, state.filters, lookup);

  return html`${summaryStrip(data.summary)} ${filterBar(data, state.filters)}
  ${visible.length
    ? html`<div class="grid">${visible.map((item) => itemCard(item, lookup))}</div>`
    : emptyState({
        emoji: "🔍",
        title: t("overview.no_match.title"),
        text: t("overview.no_match.text"),
        actionLabel: t("overview.no_match.action"),
        action: "reset-filters",
      })}`;
}
