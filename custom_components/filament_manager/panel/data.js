/**
 * Derived data helpers shared by the overview and the manage view.
 *
 * Grams are the only stored amount; the fill percentage is derived from them,
 * exactly as the backend does it.
 */

/** Build lookup maps and convenience accessors for one snapshot. */
export function createLookup(data) {
  const manufacturers = new Map((data.manufacturers || []).map((entry) => [entry.id, entry]));
  const materials = new Map((data.materials || []).map((entry) => [entry.id, entry]));
  const spoolTypes = new Map(
    (data.spool_types || []).map((entry) => [spoolTypeKey(entry, "net_weight_g"), entry])
  );

  return {
    manufacturers,
    materials,
    spoolTypes,
    manufacturerName: (id) => manufacturers.get(id)?.name || "?",
    materialName: (id) => materials.get(id)?.name || "?",
    material: (id) => materials.get(id) || null,
    spoolTypeFor: (item) => spoolTypes.get(spoolTypeKey(item, "spool_net_weight_g")) || null,
  };
}

/** Business key of a spool type: manufacturer + material + size in whole grams. */
export function spoolTypeKey(record, netField) {
  return [
    record.manufacturer_id,
    record.material_id,
    Math.round(Number(record[netField]) || 0),
  ].join("|");
}

/**
 * The empty-spool weight that applies to an item.
 *
 * The backend already resolves it into `tare_g`; the lookup is only the
 * fallback for fixtures that do not carry it.
 */
export function itemTare(item, lookup) {
  if (item.tare_g !== undefined) return item.tare_g;
  const spoolType = lookup && lookup.spoolTypeFor ? lookup.spoolTypeFor(item) : null;
  return spoolType ? spoolType.empty_weight_g : null;
}

/** "Sunlu PETG Black" — the human readable name of an entry. */
export function itemLabel(item, lookup) {
  return [
    lookup.manufacturerName(item.manufacturer_id),
    lookup.materialName(item.material_id),
    item.color_name,
  ]
    .filter(Boolean)
    .join(" ");
}

export function spoolGrams(spool) {
  const grams = spool.remaining_grams;
  return grams === null || grams === undefined ? 0 : Number(grams);
}

/**
 * How full a spool is, in percent.
 *
 * The backend already sends this as `remaining_percent`; the calculation is
 * the fallback for fixtures that do not carry it. Returns null while the
 * amount is unknown, so "0 %" is never shown for "not measured yet".
 */
export function spoolPercent(spool, netWeight) {
  if (spool.remaining_percent !== null && spool.remaining_percent !== undefined) {
    return Number(spool.remaining_percent);
  }
  const grams = spool.remaining_grams;
  const net = Number(netWeight || 0);
  if (grams === null || grams === undefined || net <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (Number(grams) / net) * 100)) * 10) / 10;
}

export function itemSpoolCount(item) {
  return Number(item.sealed_count || 0) + (item.open_spools || []).length;
}

export function itemGrams(item) {
  const net = Number(item.spool_net_weight_g || 0);
  return (
    Number(item.sealed_count || 0) * net +
    (item.open_spools || []).reduce((sum, spool) => sum + spoolGrams(spool), 0)
  );
}

/** Effective temperatures: the entry overrides the default of its type. */
export function itemTemps(item, lookup) {
  const material = lookup.material(item.material_id);
  return {
    nozzle: item.nozzle_temp ?? material?.nozzle_temp ?? null,
    bed: item.bed_temp ?? material?.bed_temp ?? null,
    nozzleIsDefault: item.nozzle_temp === null || item.nozzle_temp === undefined,
    bedIsDefault: item.bed_temp === null || item.bed_temp === undefined,
  };
}

/** Apply the search text, the dropdown filters and the sort order. */
export function filterAndSort(items, filters, lookup) {
  const query = (filters.q || "").trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (filters.manufacturer && item.manufacturer_id !== filters.manufacturer) return false;
    if (filters.material && item.material_id !== filters.material) return false;
    if (filters.condition === "sealed" && Number(item.sealed_count || 0) < 1) return false;
    if (filters.condition === "open" && (item.open_spools || []).length < 1) return false;
    if (!query) return true;
    const haystack = [
      lookup.manufacturerName(item.manufacturer_id),
      lookup.materialName(item.material_id),
      item.color_name,
      item.location,
      item.notes,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  const compare = {
    manufacturer: (a, b) =>
      lookup.manufacturerName(a.manufacturer_id).localeCompare(
        lookup.manufacturerName(b.manufacturer_id)
      ) || lookup.materialName(a.material_id).localeCompare(lookup.materialName(b.material_id)),
    material: (a, b) =>
      lookup.materialName(a.material_id).localeCompare(lookup.materialName(b.material_id)) ||
      lookup.manufacturerName(a.manufacturer_id).localeCompare(
        lookup.manufacturerName(b.manufacturer_id)
      ),
    color: (a, b) => (a.color_name || "").localeCompare(b.color_name || ""),
    remaining: (a, b) => itemGrams(a) - itemGrams(b),
    updated: (a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
  }[filters.sort || "manufacturer"];

  return filtered
    .slice()
    .sort((a, b) => compare(a, b) || (a.color_name || "").localeCompare(b.color_name || ""));
}
