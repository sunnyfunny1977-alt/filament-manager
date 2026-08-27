/**
 * Translation loading for the panel.
 *
 * The strings live in JSON files next to this module so they can be edited
 * without touching any code. English is always loaded as a fallback.
 */

const FALLBACK_LANGUAGE = "en";
const AVAILABLE = ["de", "en"];

let strings = {};
let fallback = {};

/** Pick the best available file for a Home Assistant language code. */
function resolveLanguage(language) {
  if (!language) return FALLBACK_LANGUAGE;
  const lower = String(language).toLowerCase();
  if (AVAILABLE.includes(lower)) return lower;
  const base = lower.split("-")[0];
  return AVAILABLE.includes(base) ? base : FALLBACK_LANGUAGE;
}

async function fetchLanguage(base, language) {
  const response = await fetch(`${base}/translations/${language}.json`);
  if (!response.ok) throw new Error(`Cannot load translations for ${language}`);
  return response.json();
}

/** Load the fallback and, when different, the requested language. */
export async function loadTranslations(base, language) {
  const wanted = resolveLanguage(language);
  if (!Object.keys(fallback).length) {
    fallback = await fetchLanguage(base, FALLBACK_LANGUAGE);
  }
  strings = wanted === FALLBACK_LANGUAGE ? fallback : await fetchLanguage(base, wanted);
  return wanted;
}

/**
 * Translate a key, replacing {placeholders} with the given values.
 * Unknown keys fall back to English and finally to the key itself, so a missing
 * string is visible but never breaks the panel.
 */
export function t(key, params = {}) {
  const template = strings[key] ?? fallback[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match
  );
}

/** Translate a backend error code into a readable message. */
export function translateError(error) {
  const code = error && error.code ? error.code : "unknown_error";
  const known = [
    "in_use",
    "not_found",
    "no_sealed_spools",
    "no_empty_weight",
    "invalid_data",
    "not_loaded",
    "unauthorized",
  ];
  if (known.includes(code)) return t(`error.${code}`);
  return t("error.generic", { message: (error && error.message) || code });
}
