const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN");

export const money = (v) => inr.format(Number(v) || 0);
export const number = (v) => num.format(Number(v) || 0);
export const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export const toNum = (v) => Number.parseFloat(v || 0) || 0;

export const parseDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (v) => {
  const d = parseDate(v);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

export const formatDateTime = (v) => {
  const d = parseDate(v);
  return d
    ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

export const toISODate = (v) => {
  const d = parseDate(v);
  if (!d) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export const daysUntil = (v) => {
  const d = parseDate(v);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

export const timeAgo = (v) => {
  const d = parseDate(v);
  if (!d) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

export const GENDER = { 0: "Male", 1: "Female", 2: "Other", Male: "Male", Female: "Female", Other: "Other" };

export const errorMessage = (e, fallback = "Something went wrong. Please try again.") =>
  e?.message && e.message !== "Network Error" ? e.message : e?.message === "Network Error" ? "Cannot reach the server. Check your connection." : fallback;
