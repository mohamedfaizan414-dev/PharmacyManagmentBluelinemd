import { ENV } from "../config/env";
import { daysUntil } from "./format";

export const DEFAULT_REORDER_LEVEL = 20;

/** expired | critical (<=30d) | warning (<= EXPIRY_WARN_DAYS) | ok | none */
export const expiryState = (item) => {
  const d = daysUntil(item?.expiryDate);
  if (d === null) return "none";
  if (d < 0) return "expired";
  if (d <= 30) return "critical";
  if (d <= ENV.EXPIRY_WARN_DAYS) return "warning";
  return "ok";
};

/** First-Expiry-First-Out: earliest expiry first; batches without a date go last. */
export const fefoSort = (batches) =>
  [...batches].sort((a, b) => {
    const da = daysUntil(a.expiryDate);
    const db = daysUntil(b.expiryDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

/** Only batches that can legally be sold: in stock and not expired. */
export const sellable = (batches) => batches.filter((b) => b.stockUnits > 0 && expiryState(b) !== "expired");

/** Group batch rows into one row per medicine with total stock. */
export const groupByMedicine = (items) => {
  const map = new Map();
  items.forEach((b) => {
    const key = b.medicineId || b.name;
    const g = map.get(key) || { key, medicineId: b.medicineId, name: b.name, genericName: b.genericName, reorderLevel: b.reorderLevel, totalUnits: 0, batches: [] };
    g.totalUnits += b.stockUnits;
    g.reorderLevel = Math.max(g.reorderLevel || 0, b.reorderLevel || 0);
    g.batches.push(b);
    map.set(key, g);
  });
  return [...map.values()];
};

export const stockState = (group) => {
  const level = group.reorderLevel || DEFAULT_REORDER_LEVEL;
  if (group.totalUnits <= 0) return "out";
  if (group.totalUnits <= level) return "low";
  return "ok";
};

/** Best FEFO-ordered sellable batches for a prescribed medicine (matched by id, falling back to name). */
export const batchesForMedicine = (inventory, { medicineId, name }) => {
  const norm = (s = "") => s.toLowerCase().replace(/\s+/g, " ").trim();
  const match = inventory.filter(
    (b) => (medicineId && b.medicineId === medicineId) || (!medicineId && norm(b.name) === norm(name)),
  );
  return fefoSort(sellable(match));
};
