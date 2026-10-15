/**
 * Service layer – the ONLY place screens talk to the backend through.
 * Every function returns clean UI models (see adapters.js) and throws ApiError on failure.
 */
import { http } from "./http";
import { EP } from "./endpoints";
import { ENV } from "../config/env";
import { adaptBill, adaptInventory, adaptOrder, adaptPatient, adaptReturn, totalOf } from "./adapters";
import { AWAITING } from "../config/constants";
import { expiryState, groupByMedicine, stockState } from "../utils/inventory";
import { daysUntil } from "../utils/format";

const clean = (obj = {}) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null));

/* ───────────────────────── Auth ───────────────────────── */
export const authApi = {
  login: (identifier, password) =>
    http.post(EP.auth.login, { identifier, email: identifier, password }, { skipAuth: true, skipBranch: true, skipAuthRedirect: true }).then((r) => r?.data || r),
  /** Profile + permissions + branches for the signed-in user. */
  profile: (token) =>
    http
      .get(EP.auth.profile, undefined, { skipBranch: true, skipAuthRedirect: true, headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((r) => r.data || {}),
};

/* ───────────────────── Prescription / orders ───────────────────── */
export const ordersApi = {
  async list({ page = 1, limit = 10, search, type, status, from, to } = {}) {
    const res = await http.get(EP.orders.list, clean({ page, limit, search, type, status, from, to }));
    return { rows: (res.data || []).map(adaptOrder), total: totalOf(res) };
  },
  async get(id) {
    const res = await http.get(EP.orders.get(id));
    return adaptOrder(res.data);
  },
  async counts() {
    const res = await http.get(EP.orders.counts);
    return res.data || {};
  },
  async setStatus(id, status, reason = "") {
    const res = await http.patch(EP.orders.status(id), { status, reason });
    return adaptOrder(res.data);
  },
  /** Dispense (fully or partially) – backend creates the bill and deducts stock atomically. */
  async dispense(id, payload) {
    const res = await http.post(EP.orders.dispense(id), payload);
    return { order: adaptOrder(res.data?.order), bill: res.data?.bill ? adaptBill(res.data.bill) : null, message: res.message };
  },
};

/* ───────────────────────── Billing ───────────────────────── */
export const billsApi = {
  async list({ page = 1, limit = 10, search, from, to, status } = {}) {
    const res = await http.get(EP.bills.list, clean({ page, limit, search, from, to, status }));
    return {
      rows: (res.data || []).map(adaptBill),
      total: totalOf(res),
      stats: {
        totalBills: res.totalBills ?? 0,
        totalAmount: res.totalAmount ?? 0,
        paidAmount: res.paidAmount ?? 0,
        pendingAmount: res.pendingAmount ?? 0,
      },
    };
  },
  async get(id) {
    const res = await http.get(EP.bills.get(id));
    return adaptBill(res.data);
  },
  async create(payload) {
    const res = await http.post(EP.bills.create, payload);
    return { bill: adaptBill(res.data || {}), message: res.message || res.response };
  },
  async addDeposit(id, { amount, paymentMode, transactionId }) {
    const res = await http.post(EP.bills.addDeposit(id), { depositAmount: amount, amount, paymentMode, transactionId });
    return res;
  },
};

/* ───────────────────────── Inventory ───────────────────────── */
export const inventoryApi = {
  async list({ page = 1, limit = 25, search } = {}) {
    const res = await http.get(EP.inventory.list, clean({ page, limit, search }));
    return { rows: (res.data || []).map(adaptInventory), total: totalOf(res) };
  },
  /** Everything in stock, for dashboards and FEFO batch pickers. */
  async all(search = "") {
    const res = await http.get(EP.inventory.list, clean({ page: 1, limit: 1000, search }));
    return (res.data || []).map(adaptInventory);
  },
  adjust: (id, { delta, reason }) => http.post(EP.inventory.adjust(id), { delta, reason }),
  createInvoice: (payload) => http.post(EP.inventory.createInvoice, payload),
  async medicines() {
    const res = await http.get(EP.medicines.list, { limit: 1000 });
    return (res.data || []).map((m) => ({ id: m._id, name: m.name, genericName: m.genericName || "", hsn: m.hsnCode || "", gstPercent: m.gstPercent ?? 12 }));
  },
  async manufacturers() {
    const res = await http.get(EP.manufacturers.list, { limit: 1000 });
    return (res.data || []).map((m) => ({ id: m._id, name: m.name || m.manufacturerName }));
  },
};

/* ───────────────────────── Returns ───────────────────────── */
export const returnsApi = {
  async list({ page = 1, limit = 10, search } = {}) {
    const res = await http.get(EP.returns.list, clean({ page, limit, search }));
    return { rows: (res.data || []).map(adaptReturn), total: totalOf(res) };
  },
  async create(payload) {
    const res = await http.post(EP.returns.create, payload);
    return adaptReturn(res.data || {});
  },
};

/* ───────────────────────── Lookups ───────────────────────── */
export const lookupApi = {
  async patients(search = "") {
    const res = await http.get(EP.patients.list, clean({ search, limit: 20 }));
    const list = res.data?.allPatients || res.data || [];
    return list.map(adaptPatient);
  },
  async doctors() {
    const res = await http.get(EP.doctors.list);
    return (res.data || []).map((d) => ({ id: d._id, name: d.name }));
  },
};

/* ───────────────────────── Reports ───────────────────────── */
export const reportsApi = {
  async summary({ from, to } = {}) {
    const res = await http.get(EP.reports.summary, clean({ from, to }));
    return res.data || {};
  },
};

/* ───────────────────────── Dashboard (composed) ─────────────────────────
 * Built from endpoints that already exist + the new order queue, fetched in parallel.
 * A failure in one widget never blanks the whole dashboard.
 */
export const dashboardApi = {
  async load() {
    const [bills, inventory, orders, counts] = await Promise.allSettled([
      billsApi.list({ page: 1, limit: 5 }),
      inventoryApi.all(),
      ordersApi.list({ page: 1, limit: 6, status: AWAITING.join(",") }),
      ordersApi.counts(),
    ]);
    const ok = (r) => (r.status === "fulfilled" ? r.value : null);
    const stock = ok(inventory) || [];

    const expiring = stock
      .filter((b) => b.stockUnits > 0 && ["expired", "critical", "warning"].includes(expiryState(b)))
      .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))
      .slice(0, 6);

    const lowStock = groupByMedicine(stock)
      .filter((g) => ["low", "out"].includes(stockState(g)))
      .sort((a, b) => a.totalUnits - b.totalUnits)
      .slice(0, 6);

    return {
      stats: ok(bills)?.stats || null,
      recentBills: ok(bills)?.rows || [],
      queue: ok(orders)?.rows || [],
      queueTotal: ok(orders)?.total || 0,
      counts: ok(counts) || {},
      expiring,
      lowStock,
      failed: { stats: bills.status === "rejected", stock: inventory.status === "rejected", queue: orders.status === "rejected" },
    };
  },
};

export const isMock = ENV.USE_MOCK;
