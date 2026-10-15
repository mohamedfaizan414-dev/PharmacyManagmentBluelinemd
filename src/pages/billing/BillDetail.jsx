import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Banknote, CheckCircle2, Printer, Undo2 } from "lucide-react";
import { billsApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Alert, Button, ErrorState, Field, Modal, NumberInput, PageHeader, PageLoader, StatusBadge } from "../../components/ui";
import { PAYMENT_MODES, SOURCE_LABEL } from "../../config/constants";
import { errorMessage, formatDate, formatDateTime, money } from "../../utils/format";

export default function BillDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { access, hospitalName, branch } = useAuth();
  const { data: bill, loading, error, reload } = useAsync(() => billsApi.get(id), [id]);
  useDocumentTitle(bill ? `Invoice ${bill.billNo}` : "Invoice");
  const [payOpen, setPayOpen] = useState(false);
  const [f, setF] = useState({ amount: "", mode: "CASH", txn: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading && !bill) return <PageLoader />;
  if (error && !bill) return <div className="card-box"><ErrorState message={error} onRetry={reload} /></div>;
  if (!bill) return null;

  const openPay = () => { setF({ amount: bill.balance, mode: "CASH", txn: "" }); setErr(""); setPayOpen(true); };
  const collect = async () => {
    const amt = Number(f.amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than zero.");
    if (amt > bill.balance) return setErr(`Amount can't exceed the pending balance of ${money(bill.balance)}.`);
    if (f.mode !== "CASH" && !f.txn.trim()) return setErr("Enter the transaction / reference number.");
    setBusy(true);
    try {
      await billsApi.addDeposit(bill.id, { amount: amt, paymentMode: f.mode, transactionId: f.txn.trim() });
      toast.success("Payment recorded");
      setPayOpen(false);
      reload({ silent: true });
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  const canReturn = bill.status !== "REFUNDED" && bill.items.some((i) => i.qty - i.returnedQty > 0);

  return (
    <>
      <div className="no-print">
        <PageHeader back="/billing" title={<span className="flex items-center gap-12 wrap">Invoice {bill.billNo} <StatusBadge status={bill.status} /></span>}
          actions={<>
            {access.canCreate() && canReturn && <Button variant="ghost" icon={Undo2} onClick={() => navigate(`/returns?billId=${bill.id}`)}>Return items</Button>}
            {bill.balance > 0 && access.canEdit() && <Button variant="outline" icon={Banknote} onClick={openPay}>Collect payment</Button>}
            <Button icon={Printer} onClick={() => window.print()}>Print invoice</Button>
          </>} />
        {state?.justBilled && <Alert tone="success" icon={CheckCircle2} className="mb-16">Bill created. {bill.balance > 0 ? `Balance of ${money(bill.balance)} is pending.` : "Paid in full."} Print the invoice for the patient.</Alert>}
      </div>

      <article className="invoice">
        <div className="invoice__head">
          <div>
            <h2>{hospitalName || "Pharmacy"}</h2>
            <div className="muted fs-13">{branch?.branchName} · Pharmacy</div>
          </div>
          <div className="text-right">
            <div className="fw-700" style={{ fontSize: 18 }}>TAX INVOICE</div>
            <div className="fs-13">No: <b>{bill.billNo}</b></div>
            <div className="fs-13">Date: {formatDateTime(bill.createdAt)}</div>
            <div className="mt-4"><span className={`stamp ${bill.balance > 0 ? "due" : "paid"}`}>{bill.balance > 0 ? "BALANCE DUE" : "PAID"}</span></div>
          </div>
        </div>
        <div className="flex between wrap gap-16 mb-16 fs-14">
          <div><div className="muted fs-12">BILLED TO</div><b>{bill.patientName}</b>{bill.age != null && <span> · {bill.age}y {bill.gender}</span>}<div>{bill.phone}</div></div>
          <div><div className="muted fs-12">TYPE</div><b>{SOURCE_LABEL[bill.source] || bill.source}</b>{bill.doctorName && <div>Dr: {bill.doctorName.replace(/^Dr\.?\s*/i, "")}</div>}</div>
          <div><div className="muted fs-12">PAYMENT</div><b>{bill.paymentMode}</b>{bill.transactionId && <div>Ref: {bill.transactionId}</div>}</div>
        </div>
        <div className="table-wrap">
          <table className="bl-table">
            <thead><tr><th>#</th><th>Medicine</th><th>Batch</th><th>Exp</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">GST</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {bill.items.map((i, n) => (
                <tr key={i.id || n}>
                  <td>{n + 1}</td>
                  <td><b>{i.name}</b>{i.returnedQty > 0 && <div className="fs-12" style={{ color: "var(--danger)" }}>{i.returnedQty} returned</div>}</td>
                  <td>{i.batch}</td><td>{i.expiryDate ? formatDate(i.expiryDate) : "—"}</td>
                  <td className="r num">{i.qty}</td><td className="r num">{money(i.unitPrice)}</td><td className="r">{i.gstPercent}%</td><td className="r num fw-700">{money(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="invoice__totals num">
          {bill.net > 0 && <div><span>Subtotal (incl. GST)</span><span>{money(bill.net)}</span></div>}
          {bill.discount > 0 && <div><span>Discount</span><span>− {money(bill.discount)}</span></div>}
          {bill.roundOff !== 0 && <div><span>Round off</span><span>{money(bill.roundOff)}</span></div>}
          <div className="grand"><span>Total</span><span>{money(bill.total)}</span></div>
          <div><span>Paid</span><span>{money(bill.paid)}</span></div>
          <div style={{ color: bill.balance > 0 ? "var(--danger)" : undefined, fontWeight: 700 }}><span>Balance</span><span>{money(bill.balance)}</span></div>
        </div>
        {bill.payments.length > 0 && (
          <div className="mt-16 fs-13 no-print">
            <b>Payment history</b>
            <ul className="timeline mt-8">{bill.payments.map((p, i) => <li key={i}><i /><span>{money(p.amount)} via {p.mode} <span className="muted">· {formatDateTime(p.at)}</span></span></li>)}</ul>
          </div>
        )}
        {bill.notes && <div className="mt-16 fs-13"><b>Notes:</b> {bill.notes}</div>}
        <div className="invoice__foot">Medicines once sold can be returned only against this invoice within the return window set by the hospital. Computer-generated invoice.</div>
      </article>

      <Modal open={payOpen} onClose={() => !busy && setPayOpen(false)} title="Collect payment"
        footer={<><Button variant="ghost" onClick={() => setPayOpen(false)} disabled={busy}>Cancel</Button><Button loading={busy} onClick={collect}>Record payment</Button></>}>
        <p className="mb-16">Pending balance: <b>{money(bill.balance)}</b></p>
        {err && <Alert tone="danger" className="mb-16">{err}</Alert>}
        <div className="flex-col gap-16">
          <Field label="Amount received" required>{(p) => <NumberInput {...p} value={f.amount} max={bill.balance} step={0.01} onChange={(v) => setF({ ...f, amount: v })} data-autofocus />}</Field>
          <Field label="Payment mode">{(p) => <select {...p} className="bl-select" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{PAYMENT_MODES.filter((m) => m.value !== "CREDIT").map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>}</Field>
          {f.mode !== "CASH" && <Field label="Transaction / reference no." required>{(p) => <input {...p} className="bl-input" value={f.txn} onChange={(e) => setF({ ...f, txn: e.target.value })} maxLength={40} />}</Field>}
        </div>
      </Modal>
    </>
  );
}
