/**
 * Central place for every environment-driven setting.
 * Nothing else in the app should read import.meta.env directly.
 */
const toBool = (v, fallback = false) =>
  v === undefined || v === "" ? fallback : String(v).toLowerCase() === "true";
const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const API_BASE_URL = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");

export const ENV = Object.freeze({
  API_BASE_URL,
  // No backend URL configured → always run on the mock API.
  USE_MOCK: !API_BASE_URL || toBool(import.meta.env.VITE_USE_MOCK, false),
  ADMIN_URL: import.meta.env.VITE_ADMIN_URL || "",
  QUEUE_POLL_SECONDS: toInt(import.meta.env.VITE_QUEUE_POLL_SECONDS, 30),
  EXPIRY_WARN_DAYS: toInt(import.meta.env.VITE_EXPIRY_WARN_DAYS, 90),
});

/** localStorage key – intentionally identical to the admin panel so SSO on one origin just works. */
export const STORAGE_KEY = "authUserData";
