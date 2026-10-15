export const ORDER_TYPES = { OPD: "OPD", IPD: "IPD" };

export const ORDER_STATUS = {
  PENDING: "PENDING", //                     OPD request waiting for pharmacy
  REQUESTED: "REQUESTED", //                 IPD request waiting for pharmacy
  IN_PROGRESS: "IN_PROGRESS", //             a pharmacist has opened / claimed it
  PARTIALLY_DISPENSED: "PARTIALLY_DISPENSED",
  DISPENSED: "DISPENSED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
};

export const AWAITING = [ORDER_STATUS.PENDING, ORDER_STATUS.REQUESTED];
export const OPEN_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.REQUESTED, ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.PARTIALLY_DISPENSED];
export const CLOSED_STATUSES = [ORDER_STATUS.DISPENSED, ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED];

export const STATUS_LABEL = {
  PENDING: "Pending",
  REQUESTED: "Requested",
  IN_PROGRESS: "In progress",
  PARTIALLY_DISPENSED: "Partially dispensed",
  DISPENSED: "Dispensed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
  REFUNDED: "Refunded",
};

export const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CREDIT", label: "Pay later (credit)" },
];

export const SOURCE_LABEL = { WALKIN: "Walk-in", OPD: "OPD", IPD: "IPD" };

export const RETURN_REASONS = [
  "Wrong medicine dispensed",
  "Doctor changed prescription",
  "Patient discharged",
  "Damaged / defective",
  "Near expiry",
  "Adverse reaction",
  "Other",
];

export const ADJUST_REASONS = [
  "Stock count correction",
  "Damaged",
  "Expired – written off",
  "Lost / missing",
  "Found in recount",
];

export const PAGE_SIZES = [10, 25, 50];
