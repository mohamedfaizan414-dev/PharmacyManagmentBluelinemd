import { round2, toNum } from "./format";

/**
 * One billing engine used by POS, prescription dispensing and the returns screen,
 * so every screen computes totals identically (and identically to the admin panel's
 * AddPharmacyBill: unit price × qty, + GST, − per-item %, − overall %, rounded off).
 */

/** Build a cart line from an inventory (batch) record. */
export const lineFromInventory = (inv, qty = 1, extra = {}) => {
  const unitPrice = inv.unitPrice ?? (inv.unitsPerStrip ? inv.pricePerStrip / inv.unitsPerStrip : 0);
  return recomputeLine({
    key: `${inv.id}`,
    inventoryId: inv.id,
    medicineId: inv.medicineId,
    name: inv.name,
    batch: inv.batch,
    expiryDate: inv.expiryDate,
    stock: inv.stockUnits,
    unitPrice: round2(unitPrice),
    gstPercent: toNum(inv.gstPercent),
    qty,
    discountPct: 0,
    ...extra,
  });
};

export const recomputeLine = (line) => {
  const qty = Math.max(0, toNum(line.qty));
  const base = line.unitPrice * qty;
  const gstAmount = (base * toNum(line.gstPercent)) / 100;
  const total = base + gstAmount;
  const discountAmt = (total * toNum(line.discountPct)) / 100;
  return {
    ...line,
    qty,
    gstAmount: round2(gstAmount),
    total: round2(total),
    discountAmt: round2(discountAmt),
    amount: round2(total - discountAmt),
  };
};

export const computeTotals = (lines, overallDiscountPercent = 0, paidAmount = 0) => {
  const net = lines.reduce((s, l) => s + l.amount, 0);
  const gst = lines.reduce((s, l) => s + l.gstAmount, 0);
  const itemDiscount = lines.reduce((s, l) => s + l.discountAmt, 0);
  const overallDiscount = (net * toNum(overallDiscountPercent)) / 100;
  const payable = net - overallDiscount;
  const billAmount = Math.round(payable);
  const roundOff = round2(billAmount - payable);
  const paid = toNum(paidAmount);
  return {
    net: round2(net),
    gst: round2(gst),
    cgst: round2(gst / 2),
    sgst: round2(gst / 2),
    itemDiscount: round2(itemDiscount),
    overallDiscount: round2(overallDiscount),
    discountAmount: round2(itemDiscount + overallDiscount),
    roundOff,
    billAmount,
    paid: round2(paid),
    balance: round2(Math.max(0, billAmount - paid)),
    itemCount: lines.length,
    unitCount: lines.reduce((s, l) => s + l.qty, 0),
  };
};

/** Payload for POST api/v1/pharmacyBilling/createPharmacyBill (same shape the admin panel already sends). */
export const buildBillPayload = ({ lines, patient, doctorName, overallDiscountPercent, paidAmount, paymentMode, transactionId, notes, source, prescriptionId, branchId }) => ({
  branchId,
  source, // WALKIN | OPD | IPD   (new, optional for backend)
  prescriptionId, // new, optional
  patientId: patient?.id || undefined,
  patientName: patient?.name || "Walk-in customer",
  age: patient?.age ?? null,
  gender: patient?.genderCode ?? patient?.gender,
  countryCode: patient?.countryCode || "+91",
  phone: patient?.phone || "",
  email: patient?.email || "",
  doctorName: doctorName || "",
  items: lines.map((l) => ({
    medicineId: l.medicineId,
    inventoryId: l.inventoryId,
    medicineName: l.name,
    batch: l.batch,
    price: l.unitPrice,
    quantity: l.qty,
    discountPercent: l.discountPct,
    gstPercent: l.gstPercent,
    total: l.total,
    itemDiscountAmount: l.discountAmt,
    amount: l.amount,
  })),
  overallDiscountPercent: toNum(overallDiscountPercent),
  paidAmount: toNum(paidAmount),
  paymentMode: String(paymentMode || "CASH").toUpperCase(),
  transactionId: transactionId || "",
  notes: notes || "",
});
