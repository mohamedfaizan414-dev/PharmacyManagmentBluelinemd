import { PAYMENT_MODES } from "../../config/constants";
import { money, toNum } from "../../utils/format";
import { NumberInput } from "../ui";

export const emptyPayment = () => ({ discountPct: "", mode: "CASH", paid: "", txn: "" });

/** Turns the panel state + computed totals into what the API needs, plus any validation errors. */
export const resolvePayment = (pay, totals) => {
  const credit = pay.mode === "CREDIT";
  const paid = credit ? 0 : pay.paid === "" ? totals.billAmount : toNum(pay.paid);
  const errors = {};
  if (toNum(pay.discountPct) < 0 || toNum(pay.discountPct) > 100) errors.discount = "Discount must be between 0 and 100%.";
  if (paid > totals.billAmount) errors.paid = "Paid amount can't be more than the bill total.";
  if ((pay.mode === "UPI" || pay.mode === "CARD") && paid > 0 && !pay.txn.trim()) errors.txn = pay.mode === "UPI" ? "Enter the UPI transaction ID." : "Enter the card reference number.";
  return {
    paidAmount: paid,
    // "Pay later" is recorded as a zero-paid cash bill so the existing backend enum stays valid.
    paymentMode: credit ? "CASH" : pay.mode,
    transactionId: pay.mode === "UPI" || pay.mode === "CARD" ? pay.txn.trim() : "",
    balance: Math.max(0, totals.billAmount - paid),
    errors,
    valid: Object.keys(errors).length === 0,
  };
};

export default function PaymentPanel({ pay, onChange, totals, showErrors }) {
  const res = resolvePayment(pay, totals);
  const set = (patch) => onChange({ ...pay, ...patch });
  const credit = pay.mode === "CREDIT";

  return (
    <div className="flex-col gap-16">
      <div className="total-box" aria-live="polite">
        <div><span className="muted">Items ({totals.itemCount}) · Units ({totals.unitCount})</span><span /></div>
        <div><span>Subtotal incl. GST</span><span className="num">{money(totals.net)}</span></div>
        <div><span className="muted fs-13">of which GST</span><span className="muted fs-13 num">{money(totals.gst)}</span></div>
        {totals.overallDiscount > 0 && <div><span>Discount ({pay.discountPct}%)</span><span className="num" style={{ color: "var(--success)" }}>− {money(totals.overallDiscount)}</span></div>}
        {totals.roundOff !== 0 && <div><span className="muted fs-13">Round off</span><span className="muted fs-13 num">{totals.roundOff > 0 ? "+" : "−"} {money(Math.abs(totals.roundOff))}</span></div>}
        <div className="grand"><span>Total</span><span className="num">{money(totals.billAmount)}</span></div>
      </div>

      <div className="field">
        <label htmlFor="pay-discount">Discount %</label>
        <NumberInput id="pay-discount" value={pay.discountPct} onChange={(v) => set({ discountPct: v })} max={100} step={0.5} placeholder="0" />
        {showErrors && res.errors.discount && <span className="field-error">{res.errors.discount}</span>}
      </div>

      <div className="field">
        <span className="lbl">Payment</span>
        <div className="pay-modes" role="group" aria-label="Payment mode">
          {PAYMENT_MODES.map((m) => (
            <button key={m.value} type="button" className={pay.mode === m.value ? "active" : ""} onClick={() => set({ mode: m.value, paid: "" })} aria-pressed={pay.mode === m.value}>
              {m.value === "CREDIT" ? "Pay later" : m.label}
            </button>
          ))}
        </div>
      </div>

      {!credit && (
        <div className="field">
          <label htmlFor="pay-paid">Amount received</label>
          <NumberInput id="pay-paid" value={pay.paid === "" ? "" : pay.paid} onChange={(v) => set({ paid: v })} max={totals.billAmount} step={0.01} placeholder={String(totals.billAmount)} />
          <span className="field-hint">Leave empty to take the full {money(totals.billAmount)}.</span>
          {showErrors && res.errors.paid && <span className="field-error">{res.errors.paid}</span>}
        </div>
      )}

      {(pay.mode === "UPI" || pay.mode === "CARD") && (
        <div className="field">
          <label htmlFor="pay-txn">{pay.mode === "UPI" ? "UPI transaction ID" : "Card reference no."} <span className="req">*</span></label>
          <input id="pay-txn" className={`bl-input ${showErrors && res.errors.txn ? "invalid" : ""}`} value={pay.txn} onChange={(e) => set({ txn: e.target.value })} maxLength={40} />
          {showErrors && res.errors.txn && <span className="field-error">{res.errors.txn}</span>}
        </div>
      )}

      {res.balance > 0 && (
        <div className="alert-bl warn" style={{ padding: "8px 12px" }}>
          <div>Balance due: <b>{money(res.balance)}</b>. It stays on the bill and can be collected later.</div>
        </div>
      )}
    </div>
  );
}
