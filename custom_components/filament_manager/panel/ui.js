/**
 * Small rendering helpers shared by all views.
 *
 * The panel renders plain HTML strings into its shadow root, so everything that
 * comes from user input has to be escaped. The `html` tag does that
 * automatically and only lets explicitly marked fragments through unescaped.
 */

import { t } from "./i18n.js";

class RawHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** Escape a value for safe use in HTML text and attributes. */
export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(value) {
  if (value === null || value === undefined || value === false || value === true) {
    return "";
  }
  if (value instanceof RawHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return esc(value);
}

/** Mark a string as pre-rendered HTML. */
export const raw = (value) => new RawHtml(String(value));

/** Tagged template that escapes every interpolated value. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let index = 0; index < values.length; index += 1) {
    out += render(values[index]) + strings[index + 1];
  }
  return new RawHtml(out);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

let locale = "en";
let currency = "EUR";

/** Set the locale and currency used by the formatters. */
export function setFormatting(language, currencyCode) {
  locale = language || "en";
  currency = currencyCode || "EUR";
}

export function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

/** Format grams, switching to kilograms once it gets large. */
export function fmtWeight(grams) {
  if (grams === null || grams === undefined) return "–";
  const number = Number(grams);
  if (number >= 1000) return `${fmtNumber(number / 1000, 2)} kg`;
  return `${fmtNumber(number, 0)} g`;
}

export function fmtCurrency(value) {
  if (value === null || value === undefined || value === "") return "–";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
      Number(value)
    );
  } catch {
    return `${fmtNumber(value, 2)} ${currency}`;
  }
}

export function fmtDate(iso) {
  if (!iso) return "–";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/** Format a diameter without trailing zeros, e.g. 1.75 mm. */
export function fmtDiameter(value) {
  return `${fmtNumber(value, Number(value) % 1 === 0 ? 0 : 2)} mm`;
}

// ---------------------------------------------------------------------------
// Icons (Material Design Icons paths)
// ---------------------------------------------------------------------------

const ICON_PATHS = {
  plus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  minus: "M19,13H5V11H19V13Z",
  pencil:
    "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  delete:
    "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z",
  close:
    "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  chevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  chevronUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  copy: "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z",
  menu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  scissors:
    "M19,3L13,9L15,11L22,4V3M12,12.5A0.5,0.5 0 0,1 11.5,12A0.5,0.5 0 0,1 12,11.5A0.5,0.5 0 0,1 12.5,12A0.5,0.5 0 0,1 12,12.5M6,20A2,2 0 0,1 4,18C4,16.89 4.9,16 6,16A2,2 0 0,1 8,18C8,19.11 7.1,20 6,20M6,8A2,2 0 0,1 4,6C4,4.89 4.9,4 6,4A2,2 0 0,1 8,6C8,7.11 7.1,8 6,8M9.64,7.64C9.87,7.14 10,6.59 10,6A4,4 0 0,0 6,2A4,4 0 0,0 2,6A4,4 0 0,0 6,10C6.59,10 7.14,9.87 7.64,9.64L10,12L7.64,14.36C7.14,14.13 6.59,14 6,14A4,4 0 0,0 2,18A4,4 0 0,0 6,22A4,4 0 0,0 10,18C10,17.41 9.87,16.86 9.64,16.36L12,14L19,21H22V20L9.64,7.64Z",
};

/** Render an inline icon. */
export function icon(name, size = 20) {
  const path = ICON_PATHS[name];
  if (!path) return raw("");
  return html`<svg
    viewBox="0 0 24 24"
    width="${size}"
    height="${size}"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="${path}"></path>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
export function luminance(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16) / 255
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A colour swatch that stays visible on light and dark backgrounds. */
export function swatch(hex, small = false) {
  const border = luminance(hex) > 0.75 ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.12)";
  return html`<span
    class="swatch ${small ? "small" : ""}"
    style="background:${hex}; border-color:${border}"
  ></span>`;
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

function labelled(label, control, hint) {
  return html`<label class="field">
    <span class="label-text">${label}</span>
    ${control} ${hint ? html`<span class="hint">${hint}</span>` : ""}
  </label>`;
}

export function textField({
  name,
  label,
  value = "",
  type = "text",
  placeholder = "",
  hint = "",
  min,
  max,
  step,
  extraClass = "",
}) {
  const attrs = [
    min !== undefined ? `min="${esc(min)}"` : "",
    max !== undefined ? `max="${esc(max)}"` : "",
    step !== undefined ? `step="${esc(step)}"` : "",
  ].join(" ");
  const control = html`<input
    class="${extraClass}"
    type="${type}"
    name="${name}"
    data-field="${name}"
    value="${value === null || value === undefined ? "" : value}"
    placeholder="${placeholder}"
    ${raw(attrs)}
  />`;
  return labelled(label, control, hint);
}

export function textAreaField({ name, label, value = "", hint = "" }) {
  const control = html`<textarea name="${name}" data-field="${name}">
${value || ""}</textarea
  >`;
  return labelled(label, control, hint);
}

/**
 * A select. `options` is a list of {value, label} — the current value is
 * preselected, and a placeholder entry is shown when nothing is selected yet.
 */
export function selectField({
  name,
  label,
  value = "",
  options = [],
  hint = "",
  placeholder = "",
}) {
  const control = html`<select name="${name}" data-field="${name}">
    ${placeholder
      ? html`<option value="" ${raw(value ? "" : "selected")}>${placeholder}</option>`
      : ""}
    ${options.map(
      (option) =>
        html`<option
          value="${option.value}"
          ${raw(String(option.value) === String(value) ? "selected" : "")}
        >
          ${option.label}
        </option>`
    )}
  </select>`;
  return labelled(label, control, hint);
}

export function colorField({ nameText, nameHex, label, textValue, hexValue, placeholder }) {
  return html`<div class="color-field">
    <div class="grow">
      ${textField({
        name: nameText,
        label,
        value: textValue,
        placeholder: placeholder || "",
      })}
    </div>
    <input type="color" name="${nameHex}" data-field="${nameHex}" value="${hexValue}" />
  </div>`;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A progress bar that turns orange and then red as the spool empties. */
export function progressBar(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const level = value <= 15 ? "low" : value <= 40 ? "mid" : "";
  return html`<span class="bar ${level}"><span style="width:${value}%"></span></span>`;
}

export function emptyState({ emoji, title, text, actionLabel, action }) {
  return html`<div class="empty">
    <div class="big">${emoji}</div>
    <h3>${title}</h3>
    <p>${text}</p>
    ${actionLabel
      ? html`<button class="btn" data-action="${action}">${actionLabel}</button>`
      : ""}
  </div>`;
}

/** Render the modal dialog. `body` and `actions` are pre-rendered fragments. */
export function dialog({ title, body, actions, error }) {
  return html`<div class="overlay" data-action="dialog-backdrop">
    <div class="dialog" role="dialog" aria-modal="true" data-stop>
      <h2>${title}</h2>
      <div class="body">
        ${body} ${error ? html`<div class="error-text">${error}</div>` : ""}
      </div>
      <div class="actions">${actions}</div>
    </div>
  </div>`;
}

export function confirmDialogBody(text) {
  return html`<p>${text}</p>`;
}

export function dialogActions({ confirmLabel, danger = false, extra }) {
  return html`${extra || ""}
    <span class="spacer"></span>
    <button class="btn text" data-action="dialog-cancel">${t("action.cancel")}</button>
    <button class="btn ${danger ? "danger" : ""}" data-action="dialog-confirm">
      ${confirmLabel}
    </button>`;
}
