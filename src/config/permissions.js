/**
 * Pharmacy permissions map.
 *
 * Module number 9 = "Pharmacy Management" in the admin panel (see admin utils/moduleNavigation.js).
 * `roleAccess` from the backend looks like one of:
 *   { "9": ["read","write","edit","delete"] }                       // flat
 *   { "9": { "1": ["read"], "2": ["read","write","edit"] } }        // per sub-module
 *
 * If your backend uses per-sub-module permissions, put the real sub-module numbers below.
 * Features without a number here fall back to the union of everything granted on module 9,
 * so nothing breaks while sub-modules are still being defined.
 */
export const PHARMACY_MODULE = 9;

export const FEATURES = {
  DASHBOARD: { key: "dashboard", sub: null },
  PRESCRIPTIONS: { key: "prescriptions", sub: null },
  POS: { key: "pos", sub: null },
  BILLING: { key: "billing", sub: null },
  INVENTORY: { key: "inventory", sub: null },
  RETURNS: { key: "returns", sub: null },
  REPORTS: { key: "reports", sub: null },
};

/** Which verb a screen needs just to be opened. */
export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
};
