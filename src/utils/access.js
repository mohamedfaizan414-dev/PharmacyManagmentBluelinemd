import { PHARMACY_MODULE } from "../config/permissions";

/**
 * Same permission semantics as the admin panel's utils/access.jsx, trimmed to what pharmacy needs.
 * Admin users bypass every check.
 */
const SCOPE_KEYS = new Set(["all", "user", "patient"]);

const splitPerms = (arr = []) => {
  const perms = new Set();
  let scope = null;
  for (const raw of arr) {
    const v = String(raw).toLowerCase();
    if (SCOPE_KEYS.has(v)) scope = v;
    else perms.add(v);
  }
  return { perms, scope };
};

export const createAccessChecker = (profile = {}) => {
  const isAdmin = !!profile?.isAdmin;
  const roleAccess = profile?.roleAccess || {};

  const info = (sub) => {
    if (isAdmin) return { perms: new Set(["*"]), scope: "all" };
    const mod = roleAccess[String(PHARMACY_MODULE)];
    if (!mod) return { perms: new Set(), scope: null };
    if (Array.isArray(mod)) return splitPerms(mod);
    if (typeof mod === "object") {
      if (sub != null && mod[String(sub)]) return splitPerms(mod[String(sub)]);
      // Sub-module unknown → union of everything granted on the module.
      const union = new Set();
      let scope = null;
      Object.values(mod).forEach((arr) => {
        const r = splitPerms(arr);
        r.perms.forEach((p) => union.add(p));
        scope = r.scope || scope;
      });
      return { perms: union, scope };
    }
    return { perms: new Set(), scope: null };
  };

  const has = (verbs, sub) => {
    const { perms } = info(sub);
    return perms.has("*") || verbs.some((v) => perms.has(v));
  };

  return {
    isAdmin,
    hasModuleAccess: () => isAdmin || Object.prototype.hasOwnProperty.call(roleAccess, String(PHARMACY_MODULE)),
    canView: (sub) => has(["read", "view"], sub),
    canCreate: (sub) => has(["write", "create"], sub),
    canEdit: (sub) => has(["edit"], sub),
    canDelete: (sub) => has(["delete"], sub),
    scope: (sub) => info(sub).scope,
  };
};
