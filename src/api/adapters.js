/**
 * Backend → UI model adapters.
 *
 * The rest of the app only ever sees the shapes returned here. If the backend renames a
 * field, fix it in ONE place (this file) and every screen keeps working.
 */
import { GENDER, round2, toNum } from "../utils/format";

const idOf = (v) => (v && typeof v === "object" ? v._id || v.id : v);

export const adaptInventory = (r = {}) => {
  const med = typeof r.medicineId === "object" && r.medicineId ? r.medicineId : {};
  const unitsPerStrip = toNum(r.unitsPerStrip) || 1;
  const pricePerStrip = toNum(r.pricePerStrip ?? r.mrpPerStrip);
  return {
    id: r._id || r.id,
    medicineId: idOf(r.medicineId) || r.medicine,
    name: med.name || r.medicineName || r.name || "Unnamed medicine",
    genericName: med.genericName || r.genericName || "",
    manufacturer: med.manufacturer?.name || med.manufacturerName || r.manufacturerName || "",
    form: med.medicineType?.name || med.type || r.type || "",
    strength: med.strength || r.strength || "",
    batch: r.batch || r.batchNo || "",
    expiryDate: r.expiryDate || r.expiry || null,
    stockUnits: toNum(r.totalUnits ?? r.stock ?? r.quantity),
    unitsPerStrip,
    pricePerStrip,
    mrpPerStrip: toNum(r.mrpPerStrip ?? pricePerStrip),
    unitPrice: round2(pricePerStrip / unitsPerStrip),
    gstPercent: toNum(r.gstPercent),
    reorderLevel: toNum(med.reorderLevel ?? med.lowStockAlert ?? r.reorderLevel ?? r.lowStockAlert ?? 0),
    rack: r.rackNo || r.rack || "",
    hsn: r.hsnCode || "",
  };
};

export const adaptPatient = (r = {}) => ({
  id: r._id || r.id,
  code: r.patientId || r.uhid || r.code || "",
  name: r.patientName || r.name || "",
  age: r.age ?? null,
  gender: GENDER[r.gender] ?? r.gender ?? "",
  genderCode: r.gender,
  phone: r.phoneNumber || r.phone || "",
  countryCode: r.countryCode || "+91",
  email: r.emailId || r.email || "",
  allergies: Array.isArray(r.allergies) ? r.allergies : r.allergies ? [r.allergies] : [],
});

export const billStatus = (total, paid) => {
  if (toNum(total) > 0 && toNum(paid) >= toNum(total)) return "PAID";
  if (toNum(paid) > 0) return "PARTIAL";
  return "UNPAID";
};

export const adaptBill = (r = {}) => {
  const total = toNum(r.billAmount ?? r.total);
  const paid = toNum(r.paidAmount ?? r.paid);
  const balance = r.totalBalance != null ? toNum(r.totalBalance) : Math.max(0, total - paid);
  return {
    id: r._id || r.id,
    billNo: r.billId || r.billNo || r._id,
    source: r.source || (r.prescriptionId ? "OPD" : "WALKIN"),
    prescriptionId: idOf(r.prescriptionId),
    patientId: idOf(r.patientId),
    patientName: r.patientName || r.patient?.patientName || "Walk-in customer",
    phone: r.phone || "",
    age: r.age ?? null,
    gender: GENDER[r.gender] ?? r.gender ?? "",
    doctorName: r.doctorName || "",
    items: (r.items || []).map((i) => ({
      id: i._id || i.inventoryId,
      inventoryId: idOf(i.inventoryId),
      medicineId: idOf(i.medicineId),
      name: i.medicineName || i.name || i.medicineId?.name || "",
      batch: i.batch || "",
      expiryDate: i.expiryDate || null,
      qty: toNum(i.quantity ?? i.qty),
      returnedQty: toNum(i.returnedQuantity ?? 0),
      unitPrice: toNum(i.price ?? i.unitPrice),
      gstPercent: toNum(i.gstPercent),
      discountPct: toNum(i.discountPercent),
      amount: toNum(i.amount),
    })),
    net: toNum(r.netAmount),
    gst: toNum(r.gstAmount),
    discount: toNum(r.overallDiscountAmount ?? r.discountAmount),
    roundOff: toNum(r.roundOff),
    total,
    paid,
    balance,
    status: r.status && STATUS_OK.has(r.status) ? r.status : billStatus(total, paid),
    paymentMode: r.paymentMode || "CASH",
    transactionId: r.transactionId || r.transacationId || "",
    notes: r.notes || "",
    createdAt: r.createdAt || r.billDate,
    createdBy: r.createdByName || r.createdBy?.name || "",
    payments: (r.payments || r.paymentHistory || []).map((p) => ({
      amount: toNum(p.amount ?? p.depositAmount),
      mode: p.paymentMode || p.mode || "CASH",
      at: p.createdAt || p.date,
    })),
  };
};
const STATUS_OK = new Set(["PAID", "PARTIAL", "UNPAID", "REFUNDED"]);

export const adaptOrder = (r = {}) => {
  const p = r.patient || (typeof r.patientId === "object" ? r.patientId : null) || {};
  const doc = r.doctor || (typeof r.doctorId === "object" ? r.doctorId : null) || {};
  const patient = adaptPatient({ ...p, patientName: p.patientName || r.patientName, allergies: p.allergies ?? r.allergies });
  if (!patient.id) patient.id = idOf(r.patientId);
  return {
    id: r._id || r.id,
    orderNo: r.orderId || r.orderNo || r.prescriptionNo || r._id,
    type: r.type || "OPD",
    status: r.status || "PENDING",
    priority: r.priority || "NORMAL",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    patient,
    doctor: { id: doc._id || idOf(r.doctorId), name: doc.name || r.doctorName || "", department: doc.department || r.department || "" },
    location: r.location || [r.ward, r.bed && `Bed ${r.bed}`].filter(Boolean).join(" - ") || "",
    encounterId: r.encounterId || r.appointmentId || r.admissionId || "",
    diagnosis: r.diagnosis || "",
    notes: r.notes || "",
    rejectionReason: r.rejectionReason || "",
    billId: idOf(r.billId),
    items: (r.items || r.medicines || []).map((i) => ({
      id: i._id || i.id,
      medicineId: idOf(i.medicineId),
      name: i.medicineName || (typeof i.medicineId === "object" ? i.medicineId?.name : "") || i.name || "",
      dosage: i.dosage || "",
      frequency: i.frequency || "",
      duration: i.duration || "",
      route: i.route || "",
      instructions: i.instructions || i.notes || "",
      qtyPrescribed: toNum(i.quantity ?? i.qty ?? i.qtyPrescribed),
      qtyDispensed: toNum(i.dispensedQuantity ?? i.qtyDispensed),
      substituteAllowed: i.substituteAllowed !== false,
    })),
  };
};

export const adaptReturn = (r = {}) => ({
  id: r._id || r.id,
  returnNo: r.returnId || r.returnNo || r._id,
  billId: idOf(r.billId),
  billNo: r.billNo || r.billId?.billId || "",
  patientName: r.patientName || "Walk-in customer",
  refundAmount: toNum(r.refundAmount),
  refundMode: r.refundMode || "CASH",
  createdAt: r.createdAt,
  createdBy: r.createdByName || "",
  items: (r.items || []).map((i) => ({
    name: i.medicineName || i.name,
    batch: i.batch,
    qty: toNum(i.quantity),
    reason: i.reason || "",
    amount: toNum(i.amount),
  })),
});

/** Pagination envelopes differ between endpoints (res.total vs res.pagination.total). */
export const totalOf = (res) => res?.pagination?.total ?? res?.total ?? res?.data?.length ?? 0;
