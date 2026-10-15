/**
 * EVERY backend route the pharmacy app calls lives here – nowhere else.
 *
 * EXISTING = already implemented by the BluelineMD backend (used today by the admin panel).
 * NEW      = needs to be added to the backend. Contracts are in docs/API_INTEGRATION_GUIDE.md.
 *
 * To point a screen at a different route, change it here only.
 */
export const EP = {
  auth: {
    login: "api/v1/adminAuth/Login", //                 EXISTING  POST  {identifier,password}
    profile: "api/v1/adminAuth/branches/get", //        EXISTING  GET   → isAdmin, roleAccess, roleName, branches, healthcareDetails
  },

  // ── Prescription / order requests raised by doctors (OPD + IPD) ──────────────
  orders: {
    list: "api/v1/pharmacyOrders/getAll", //             NEW  GET   ?page&limit&search&type&status&from&to
    get: (id) => `api/v1/pharmacyOrders/get/${id}`, //   NEW  GET
    counts: "api/v1/pharmacyOrders/counts", //           NEW  GET   → { PENDING, IN_PROGRESS, ... }  (sidebar badge)
    status: (id) => `api/v1/pharmacyOrders/${id}/status`, // NEW PATCH {status, reason}
    dispense: (id) => `api/v1/pharmacyOrders/${id}/dispense`, // NEW POST {lines, payment…} → creates bill + deducts stock
    create: "api/v1/pharmacyOrders/create", //           NEW  POST  called by the doctor's prescription save (or by backend hook)
  },

  // ── Billing ──────────────────────────────────────────────────────────────────
  bills: {
    list: "api/v1/pharmacyBilling/getAllPharmacyBills", //          EXISTING GET
    create: "api/v1/pharmacyBilling/createPharmacyBill", //         EXISTING POST
    get: (id) => `api/v1/pharmacyBilling/getPharmacyBill/${id}`, // NEW  GET (single bill; list payload is used as fallback)
    addDeposit: (id) => `api/v1/pharmacyBilling/addDeposit/${id}`, // EXISTING POST
    byPatient: (patientId) => `api/v1/pharmacyBilling/getBillsByPatientId/${patientId}`, // EXISTING GET
  },

  // ── Inventory ────────────────────────────────────────────────────────────────
  inventory: {
    list: "api/v1/inventory/getallInventory", //          EXISTING GET  ?page&limit&search
    createInvoice: "api/v1/inventory/createInvoice", //    EXISTING POST (purchase / stock-in invoice)
    adjust: (id) => `api/v1/inventory/adjustStock/${id}`, // NEW POST {delta, reason}
  },
  medicines: {
    list: "api/v1/medicine/getallMedicines", //           EXISTING GET
  },
  manufacturers: {
    list: "api/v1/manufacturer/getManufacturers", //      EXISTING GET
  },

  // ── Returns & refunds ────────────────────────────────────────────────────────
  returns: {
    list: "api/v1/pharmacyReturns/getAll", //             NEW GET
    create: "api/v1/pharmacyReturns/create", //           NEW POST {billId, items:[{inventoryId, quantity, reason}], refundMode}
  },

  // ── Reports ──────────────────────────────────────────────────────────────────
  reports: {
    summary: "api/v1/pharmacyReports/summary", //         NEW GET ?from&to → sales, top medicines, payment split, daily trend
  },

  // ── Shared lookups ───────────────────────────────────────────────────────────
  patients: { list: "api/v1/patients/getAll" }, //        EXISTING GET ?search
  doctors: { list: "api/v1/staff/doctors" }, //           EXISTING GET
};
