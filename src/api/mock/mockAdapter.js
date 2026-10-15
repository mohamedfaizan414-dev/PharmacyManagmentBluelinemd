/**
 * In-browser mock of the BluelineMD backend (axios adapter).
 * It speaks the same envelopes and routes as the real API (see ../endpoints.js), so screens
 * and services are identical in demo mode and production. Remove nothing – just set VITE_USE_MOCK=false.
 */
import { AxiosError } from "axios";
import { seed } from "./seed";

const KEY = "bl_pharmacy_mock_v3";
const BOOT = Date.now();

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return seed();
};
let db = load();
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
};
export const resetMock = () => {
  db = seed();
  save();
};

/* ───────────── helpers ───────────── */
class HttpFail extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpFail(status, message);
};
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const makeJwt = (payload) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.mock-signature`;
const readJwt = (t) => {
  try {
    const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p));
  } catch {
    return null;
  }
};
const page = (list, params = {}) => {
  const p = Math.max(1, parseInt(params.page, 10) || 1);
  const l = Math.max(1, parseInt(params.limit, 10) || 10);
  return list.slice((p - 1) * l, p * l);
};
const inRange = (iso, from, to) => {
  const t = new Date(iso).getTime();
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
};
const has = (hay, needle) => String(hay || "").toLowerCase().includes(String(needle).toLowerCase());
const ok = (data, extra = {}) => ({ success: true, data, ...extra });

const USERS = [
  { id: "u1", email: "pharmacist@blueline.demo", password: "Pharma@123", name: "Priya Pharmacist", role: "Pharmacist", pharmacy: true },
  { id: "u2", email: "admin@blueline.demo", password: "Admin@123", name: "Hospital Admin", role: "Admin", admin: true, pharmacy: true },
  { id: "u3", email: "doctor@blueline.demo", password: "Doctor@123", name: "Dr. Meera Krishnan", role: "Doctor", pharmacy: false },
];

/* ───────────── domain logic ───────────── */
const findInv = (id) => db.inventory.find((i) => i._id === id);

const createBill = (body, user) => {
  const items = body.items || [];
  if (!items.length) fail(400, "Add at least one medicine to the bill.");
  // Validate stock first so a failed bill never half-deducts.
  const need = {};
  items.forEach((it) => {
    need[it.inventoryId] = (need[it.inventoryId] || 0) + Number(it.quantity);
  });
  Object.entries(need).forEach(([id, qty]) => {
    const inv = findInv(id);
    if (!inv) fail(404, "A selected batch no longer exists. Refresh and try again.");
    if (new Date(inv.expiryDate) < new Date(new Date().toDateString())) fail(400, `${inv.medicineId.name} (batch ${inv.batch}) has expired and cannot be sold.`);
    if (qty > inv.totalUnits) fail(400, `Only ${inv.totalUnits} units of ${inv.medicineId.name} (batch ${inv.batch}) are in stock.`);
  });
  const net = round2(items.reduce((s, i) => s + Number(i.amount || 0), 0));
  const overall = round2((net * Number(body.overallDiscountPercent || 0)) / 100);
  const payable = net - overall;
  const billAmount = Math.round(payable);
  const paid = Number(body.paidAmount || 0);
  if (paid < 0) fail(400, "Paid amount cannot be negative.");
  if (paid > billAmount) fail(400, "Paid amount cannot be more than the bill amount.");
  Object.entries(need).forEach(([id, qty]) => {
    findInv(id).totalUnits -= qty;
  });
  db.counters.bill += 1;
  const bill = {
    _id: uid("bill"),
    billId: `PH-${1000 + db.counters.bill}`,
    source: body.source || "WALKIN",
    prescriptionId: body.prescriptionId,
    patientId: body.patientId,
    patientName: body.patientName || "Walk-in customer",
    phone: body.phone || "",
    age: body.age ?? null,
    gender: body.gender,
    doctorName: body.doctorName || "",
    items: items.map((i) => ({ _id: uid("bi"), ...i })),
    netAmount: net,
    gstAmount: round2(items.reduce((s, i) => s + (Number(i.total) - Number(i.total) / (1 + Number(i.gstPercent || 0) / 100)), 0)),
    overallDiscountAmount: overall,
    roundOff: round2(billAmount - payable),
    billAmount,
    paidAmount: paid,
    totalBalance: billAmount - paid,
    paymentMode: body.paymentMode || "CASH",
    transactionId: body.transactionId || "",
    notes: body.notes || "",
    createdAt: new Date().toISOString(),
    createdByName: user?.name || "Pharmacist",
    payments: paid ? [{ amount: paid, paymentMode: body.paymentMode || "CASH", createdAt: new Date().toISOString() }] : [],
  };
  db.bills.unshift(bill);
  return bill;
};

const billStatus = (b) => (b.billAmount > 0 && b.paidAmount >= b.billAmount ? "PAID" : b.paidAmount > 0 ? "PARTIAL" : "UNPAID");
const withStatus = (b) => ({ ...b, status: b.status === "REFUNDED" ? "REFUNDED" : billStatus(b) });

const maybeIncoming = () => {
  if (db.flags?.incoming || Date.now() - BOOT < 45000) return;
  db.flags = { ...(db.flags || {}), incoming: true };
  db.counters.ord += 1;
  const p = db.patients[3];
  db.orders.unshift({
    _id: uid("ord"), orderId: `IPD-${db.counters.ord}`, type: "IPD", status: "REQUESTED", priority: "URGENT",
    patient: p, doctor: db.doctors[3], location: "ICU - Bed 2", encounterId: "ADM-2231", diagnosis: "Acute asthma exacerbation",
    createdAt: new Date().toISOString(),
    items: [
      { _id: uid("it"), medicineId: "med_15", medicineName: "Salbutamol Inhaler (Asthalin)", dosage: "100mcg", frequency: "2 puffs q4h", duration: "3 days", quantity: 2, dispensedQuantity: 0, route: "Inhaled", instructions: "Use with spacer", substituteAllowed: true },
      { _id: uid("it"), medicineId: "med_12", medicineName: "Normal Saline 0.9% 500ml", dosage: "500ml", frequency: "1-1-1", duration: "1 day", quantity: 3, dispensedQuantity: 0, route: "IV", instructions: "", substituteAllowed: true },
    ],
  });
  save();
};

const orderSort = (a, b) => {
  const open = (o) => ["PENDING", "REQUESTED", "IN_PROGRESS", "PARTIALLY_DISPENSED"].includes(o.status);
  if (open(a) !== open(b)) return open(a) ? -1 : 1;
  if (open(a) && a.priority !== b.priority) return a.priority === "URGENT" ? -1 : 1;
  return new Date(b.createdAt) - new Date(a.createdAt);
};

/* ───────────── routes ───────────── */
const routes = [];
const route = (method, pattern, handler, { public: isPublic = false } = {}) =>
  routes.push({ method, re: new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, "([^/]+)")}$`), handler, isPublic });

const handleMockLogin = ({ body }) => {
  const id = String(body.email || body.identifier || "").trim().toLowerCase();
  const u = USERS.find((x) => x.email === id && x.password === body.password);
  if (!u) fail(401, "Invalid email or password.");
  const token = makeJwt({ sub: u.id, name: u.name, email: u.email, exp: Math.floor(Date.now() / 1000) + 8 * 3600 });
  return { success: true, response: "Login successful", data: { token, type: "staff", isFirstLogin: false } };
};
route("POST", "api/v1/adminAuth/Login", handleMockLogin, { public: true });
route("POST", "api/v1/auth/Login", handleMockLogin, { public: true });

route("GET", "api/v1/adminAuth/branches/get", ({ user }) => {
  const access = user.admin ? {} : user.pharmacy ? { 9: ["read", "write", "edit", "delete"] } : { 8: ["read"] };
  return ok({
    isAdmin: !!user.admin,
    roleName: user.role,
    roleAccess: access,
    staff: { status: 1, name: user.name },
    healthcareDetails: { name: "Smiles health Care Center", type: 1 },
    branches: [
      { _id: "br_1", branchName: "Y test" },
      { _id: "br_2", branchName: "Smiles Main Campus" },
    ],
  });
});

route("GET", "api/v1/inventory/getallInventory", ({ query }) => {
  let list = db.inventory;
  if (query.search) list = list.filter((i) => has(i.medicineId.name, query.search) || has(i.medicineId.genericName, query.search) || has(i.batch, query.search));
  return { success: true, data: page(list, query), pagination: { total: list.length } };
});
route("GET", "api/v1/medicine/getallMedicines", () => ok(db.medicines));
route("GET", "api/v1/manufacturer/getManufacturers", () =>
  ok(["Cipla", "Sun Pharma", "Abbott", "Alkem Laboratories", "Novo Nordisk", "Zydus Cadila"].map((n, i) => ({ _id: `mf_${i}`, name: n }))));

route("POST", "api/v1/inventory/createInvoice", ({ body }) => {
  if (!body.items?.length) fail(400, "Add at least one item to the invoice.");
  body.items.forEach((it) => {
    const med = db.medicines.find((m) => m._id === it.medicineId);
    if (!med) fail(400, "Unknown medicine on invoice.");
    const units = (Number(it.noOfStrips || 0) + Number(it.freeStrips || 0)) * Number(it.unitsPerStrip || med.unitsPerStrip);
    const existing = db.inventory.find((i) => i.medicineId._id === med._id && i.batch === it.batch);
    if (existing) existing.totalUnits += units;
    else
      db.inventory.push({
        _id: uid("inv"), medicineId: med, batch: it.batch, expiryDate: it.expiryDate, totalUnits: units,
        unitsPerStrip: Number(it.unitsPerStrip || med.unitsPerStrip), pricePerStrip: Number(it.pricePerStrip || it.mrpPerStrip),
        mrpPerStrip: Number(it.mrpPerStrip || it.pricePerStrip), gstPercent: Number(it.gstPercent ?? med.gstPercent), rackNo: it.rackNo || "",
      });
  });
  save();
  return { success: true, response: "Stock received successfully", data: { _id: uid("pinv") } };
});

route("POST", "api/v1/inventory/adjustStock/:id", ({ params, body }) => {
  const inv = findInv(params[0]);
  if (!inv) fail(404, "Batch not found.");
  const delta = Number(body.delta);
  if (!Number.isFinite(delta) || delta === 0) fail(400, "Enter a non-zero quantity.");
  if (inv.totalUnits + delta < 0) fail(400, `Cannot remove more than the ${inv.totalUnits} units in stock.`);
  inv.totalUnits += delta;
  save();
  return { success: true, response: "Stock updated", data: inv };
});

route("GET", "api/v1/pharmacyBilling/getAllPharmacyBills", ({ query }) => {
  let list = db.bills.map(withStatus);
  if (query.search) list = list.filter((b) => has(b.billId, query.search) || has(b.patientName, query.search) || has(b.phone, query.search));
  if (query.from || query.to) list = list.filter((b) => inRange(b.createdAt, query.from, query.to));
  if (query.status) list = list.filter((b) => b.status === query.status);
  const sum = (k) => round2(list.reduce((s, b) => s + b[k], 0));
  return {
    success: true, data: page(list, query), total: list.length,
    totalBills: list.length, totalAmount: sum("billAmount"), paidAmount: sum("paidAmount"), pendingAmount: sum("totalBalance"),
  };
});
route("GET", "api/v1/pharmacyBilling/getPharmacyBill/:id", ({ params }) => {
  const b = db.bills.find((x) => x._id === params[0]);
  if (!b) fail(404, "Bill not found.");
  return ok(withStatus(b));
});
route("POST", "api/v1/pharmacyBilling/createPharmacyBill", ({ body, user }) => {
  const bill = createBill(body, user);
  save();
  return { success: true, response: "Bill created successfully", data: withStatus(bill) };
});
route("POST", "api/v1/pharmacyBilling/addDeposit/:id", ({ params, body }) => {
  const b = db.bills.find((x) => x._id === params[0]);
  if (!b) fail(404, "Bill not found.");
  const amt = Number(body.depositAmount ?? body.amount);
  if (!(amt > 0)) fail(400, "Enter an amount greater than zero.");
  if (amt > b.totalBalance) fail(400, `Amount cannot be more than the pending balance of ₹${b.totalBalance}.`);
  b.paidAmount = round2(b.paidAmount + amt);
  b.totalBalance = round2(b.billAmount - b.paidAmount);
  b.payments.push({ amount: amt, paymentMode: body.paymentMode || "CASH", createdAt: new Date().toISOString() });
  save();
  return { success: true, response: "Payment recorded", data: withStatus(b) };
});
route("GET", "api/v1/pharmacyBilling/getBillsByPatientId/:id", ({ params }) => ok(db.bills.filter((b) => b.patientId === params[0]).map(withStatus)));

route("GET", "api/v1/patients/getAll", ({ query }) => {
  const list = query.search ? db.patients.filter((p) => has(p.patientName, query.search) || has(p.patientId, query.search) || has(p.phoneNumber, query.search)) : db.patients;
  return ok({ allPatients: list });
});
route("GET", "api/v1/staff/doctors", () => ok(db.doctors));

/* ── orders ── */
route("GET", "api/v1/pharmacyOrders/getAll", ({ query }) => {
  maybeIncoming();
  let list = [...db.orders];
  if (query.type) list = list.filter((o) => o.type === query.type);
  if (query.status) {
    const set = new Set(String(query.status).split(","));
    list = list.filter((o) => set.has(o.status));
  }
  if (query.search) list = list.filter((o) => has(o.orderId, query.search) || has(o.patient?.patientName, query.search) || has(o.patient?.patientId, query.search) || has(o.doctor?.name, query.search));
  if (query.from || query.to) list = list.filter((o) => inRange(o.createdAt, query.from, query.to));
  list.sort(orderSort);
  return { success: true, data: page(list, query), total: list.length };
});
route("GET", "api/v1/pharmacyOrders/counts", () => {
  maybeIncoming();
  const c = {};
  db.orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
  c.AWAITING = (c.PENDING || 0) + (c.REQUESTED || 0);
  return ok(c);
});
route("GET", "api/v1/pharmacyOrders/get/:id", ({ params }) => {
  const o = db.orders.find((x) => x._id === params[0]);
  if (!o) fail(404, "Prescription request not found.");
  return ok(o);
});
route("PATCH", "api/v1/pharmacyOrders/:id/status", ({ params, body }) => {
  const o = db.orders.find((x) => x._id === params[0]);
  if (!o) fail(404, "Prescription request not found.");
  if (["DISPENSED", "REJECTED", "CANCELLED"].includes(o.status)) fail(409, `This request is already ${o.status.toLowerCase()}.`);
  if (body.status === "REJECTED" && !String(body.reason || "").trim()) fail(400, "Please give a reason so the doctor knows why it was rejected.");
  o.status = body.status;
  if (body.reason) o.rejectionReason = body.reason;
  save();
  return { success: true, response: "Status updated", data: o };
});
route("POST", "api/v1/pharmacyOrders/:id/dispense", ({ params, body, user }) => {
  const o = db.orders.find((x) => x._id === params[0]);
  if (!o) fail(404, "Prescription request not found.");
  if (["DISPENSED", "REJECTED", "CANCELLED"].includes(o.status)) fail(409, `This request is already ${o.status.toLowerCase()}.`);
  const lines = body.orderItems || [];
  if (!lines.length) fail(400, "Select at least one medicine to dispense.");
  const bill = createBill({ ...body, source: o.type, prescriptionId: o._id, patientId: o.patient?._id, patientName: o.patient?.patientName, age: o.patient?.age, gender: o.patient?.gender, phone: o.patient?.phoneNumber, doctorName: o.doctor?.name }, user);
  lines.forEach((l) => {
    const it = o.items.find((x) => x._id === l.itemId);
    if (it) it.dispensedQuantity = Math.min(it.quantity, (it.dispensedQuantity || 0) + Number(l.quantity));
  });
  const allDone = o.items.every((i) => (i.dispensedQuantity || 0) >= i.quantity);
  o.status = body.complete || allDone ? "DISPENSED" : "PARTIALLY_DISPENSED";
  o.billId = bill._id;
  save();
  return { success: true, response: o.status === "DISPENSED" ? "Prescription dispensed" : "Partially dispensed", data: { order: o, bill: withStatus(bill) } };
});
route("POST", "api/v1/pharmacyOrders/create", ({ body }) => {
  db.counters.ord += 1;
  const patient = db.patients.find((p) => p._id === body.patientId) || db.patients[0];
  const o = {
    _id: uid("ord"), orderId: `${body.type || "OPD"}-${db.counters.ord}`, type: body.type || "OPD", status: body.type === "IPD" ? "REQUESTED" : "PENDING",
    priority: body.priority || "NORMAL", patient, doctor: db.doctors.find((d) => d._id === body.doctorId) || db.doctors[0], location: body.location || "",
    diagnosis: body.diagnosis || "", createdAt: new Date().toISOString(), items: (body.items || []).map((i) => ({ _id: uid("it"), dispensedQuantity: 0, ...i })),
  };
  db.orders.unshift(o);
  save();
  return { success: true, response: "Sent to pharmacy", data: o };
});

/* ── returns ── */
route("GET", "api/v1/pharmacyReturns/getAll", ({ query }) => {
  let list = db.returns;
  if (query.search) list = list.filter((r) => has(r.returnId, query.search) || has(r.billNo, query.search) || has(r.patientName, query.search));
  return { success: true, data: page(list, query), total: list.length };
});
route("POST", "api/v1/pharmacyReturns/create", ({ body, user }) => {
  const bill = db.bills.find((b) => b._id === body.billId);
  if (!bill) fail(404, "Original bill not found.");
  if (!body.items?.length) fail(400, "Select at least one item to return.");
  let refund = 0;
  const lines = body.items.map((r) => {
    const bi = bill.items.find((i) => i.inventoryId === r.inventoryId);
    if (!bi) fail(400, "Item was not part of this bill.");
    const qty = Number(r.quantity);
    const left = bi.quantity - (bi.returnedQuantity || 0);
    if (!(qty > 0) || qty > left) fail(400, `You can return at most ${left} unit(s) of ${bi.medicineName}.`);
    const amount = round2((bi.amount / bi.quantity) * qty);
    refund += amount;
    bi.returnedQuantity = (bi.returnedQuantity || 0) + qty;
    const restock = !/damag|expir/i.test(r.reason || "");
    const inv = findInv(r.inventoryId);
    if (inv && restock) inv.totalUnits += qty;
    return { medicineName: bi.medicineName, batch: bi.batch, quantity: qty, reason: r.reason, amount };
  });
  refund = round2(refund);
  db.counters.ret += 1;
  const ret = { _id: uid("ret"), returnId: `RT-${db.counters.ret}`, billId: bill._id, billNo: bill.billId, patientName: bill.patientName, refundAmount: refund, refundMode: body.refundMode || "CASH", createdAt: new Date().toISOString(), createdByName: user?.name, items: lines };
  db.returns.unshift(ret);
  if (bill.items.every((i) => (i.returnedQuantity || 0) >= i.quantity)) bill.status = "REFUNDED";
  save();
  return { success: true, response: "Return processed", data: ret };
});

/* ── reports ── */
route("GET", "api/v1/pharmacyReports/summary", ({ query }) => {
  const from = query.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const to = query.to || new Date().toISOString().slice(0, 10);
  const bills = db.bills.filter((b) => inRange(b.createdAt, from, to));
  const bySource = {}; const byMode = {}; const meds = {}; const daily = {};
  bills.forEach((b) => {
    bySource[b.source] = round2((bySource[b.source] || 0) + b.billAmount);
    byMode[b.paymentMode] = round2((byMode[b.paymentMode] || 0) + b.paidAmount);
    const d = b.createdAt.slice(0, 10);
    daily[d] = round2((daily[d] || 0) + b.billAmount);
    b.items.forEach((i) => {
      const m = meds[i.medicineName] || { name: i.medicineName, units: 0, revenue: 0 };
      m.units += i.quantity; m.revenue = round2(m.revenue + i.amount); meds[i.medicineName] = m;
    });
  });
  const days = []; 
  for (let t = new Date(from); t <= new Date(to) && days.length < 92; t = new Date(t.getTime() + 86400000)) {
    const k = t.toISOString().slice(0, 10);
    days.push({ date: k, sales: daily[k] || 0 });
  }
  const returns = db.returns.filter((r) => inRange(r.createdAt, from, to));
  return ok({
    from, to,
    totals: { bills: bills.length, sales: round2(bills.reduce((s, b) => s + b.billAmount, 0)), collected: round2(bills.reduce((s, b) => s + b.paidAmount, 0)), pending: round2(bills.reduce((s, b) => s + b.totalBalance, 0)), refunds: round2(returns.reduce((s, r) => s + r.refundAmount, 0)), unitsSold: bills.reduce((s, b) => s + b.items.reduce((x, i) => x + i.quantity, 0), 0) },
    bySource: Object.entries(bySource).map(([name, value]) => ({ name, value })),
    byPayment: Object.entries(byMode).map(([name, value]) => ({ name, value })),
    topMedicines: Object.values(meds).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    daily: days,
  });
});

/* ───────────── adapter entry ───────────── */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function mockAdapter(config) {
  await delay(120 + Math.random() * 200);
  const method = (config.method || "get").toUpperCase();
  const url = String(config.url || "").replace(/^\/+/, "").split("?")[0];
  const respond = (status, data) => ({ data, status, statusText: String(status), headers: {}, config, request: {} });
  const reject = (status, message) => {
    const res = respond(status, { success: false, message });
    return Promise.reject(new AxiosError(message, status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST", config, {}, res));
  };

  const r = routes.find((x) => x.method === method && x.re.test(url));
  if (!r) return reject(404, `Mock: no route for ${method} /${url}`);

  let user = null;
  if (!r.isPublic) {
    const auth = config.headers?.Authorization || config.headers?.get?.("Authorization") || "";
    const claims = readJwt(String(auth).replace(/^Bearer /, ""));
    if (!claims || claims.exp * 1000 < Date.now()) return reject(401, "Your session has expired. Please sign in again.");
    user = USERS.find((u) => u.id === claims.sub);
    if (!user) return reject(401, "Unknown user.");
    // Authorization: non-pharmacy staff may only read the profile endpoint.
    if (!user.pharmacy && !url.includes("adminAuth")) return reject(403, "You don't have access to the pharmacy module.");
  }

  let body = {};
  try { body = typeof config.data === "string" ? JSON.parse(config.data) : config.data || {}; } catch { body = {}; }
  const params = r.re.exec(url).slice(1);

  try {
    const out = r.handler({ params, query: config.params || {}, body, user });
    return respond(200, out);
  } catch (e) {
    if (e instanceof HttpFail) return reject(e.status, e.message);
    console.error("[mock] unexpected error", e);
    return reject(500, "Mock server error");
  }
}
