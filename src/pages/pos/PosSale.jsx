import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Minus, PackageSearch, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { billsApi, inventoryApi } from "../../api/services";
import { useDebounce } from "../../hooks/useDebounce";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Alert, Button, EmptyState, ExpiryBadge, Field, PageHeader } from "../../components/ui";
import PaymentPanel, { emptyPayment, resolvePayment } from "../../components/pharmacy/PaymentPanel";
import PatientPicker from "../../components/pharmacy/PatientPicker";
import { buildBillPayload, computeTotals, lineFromInventory, recomputeLine } from "../../utils/billing";
import { errorMessage, formatDate, money } from "../../utils/format";
import { expiryState, fefoSort } from "../../utils/inventory";

export default function PosSale() {
  useDocumentTitle("Walk-in POS Sale");
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const term = useDebounce(q.trim(), 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [cart, setCart] = useState([]);
  const [patient, setPatient] = useState(null);
  const [cust, setCust] = useState({ name: "", phone: "", doctor: "" });
  const [pay, setPay] = useState(emptyPayment());
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  // Search inventory as the user types (stale responses ignored).
  useEffect(() => {
    if (term.length < 2) { setResults([]); setSearchErr(""); return undefined; }
    let live = true;
    setSearching(true);
    inventoryApi.list({ search: term, limit: 25 })
      .then((r) => { if (live) { setResults(fefoSort(r.rows)); setActive(0); setSearchErr(""); } })
      .catch((e) => live && setSearchErr(errorMessage(e)))
      .finally(() => live && setSearching(false));
    return () => { live = false; };
  }, [term]);

  // "/" focuses the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); inputRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", close); };
  }, []);

  const sellableRow = (b) => b.stockUnits > 0 && expiryState(b) !== "expired";

  const addBatch = (b) => {
    if (!sellableRow(b)) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.inventoryId === b.id);
      if (i >= 0) {
        if (c[i].qty >= b.stockUnits) { toast.warn(`Only ${b.stockUnits} units in stock for batch ${b.batch}.`, { toastId: `stk-${b.id}` }); return c; }
        return c.map((l, idx) => (idx === i ? recomputeLine({ ...l, qty: l.qty + 1 }) : l));
      }
      return [...c, lineFromInventory(b, 1)];
    });
    setQ(""); setResults([]); setOpen(false);
    inputRef.current?.focus();
  };

  const setQty = (key, qty) => setCart((c) => c.map((l) => {
    if (l.key !== key) return l;
    const n = qty === "" ? 0 : Math.max(0, Math.min(l.stock, Math.floor(Number(qty) || 0)));
    return recomputeLine({ ...l, qty: n });
  }));
  const remove = (key) => setCart((c) => c.filter((l) => l.key !== key));

  const onSearchKey = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === "Enter") { e.preventDefault(); results[active] && addBatch(results[active]); }
    if (e.key === "Escape") setOpen(false);
  };

  const lines = useMemo(() => cart.filter((l) => l.qty > 0), [cart]);
  const totals = useMemo(() => computeTotals(lines, pay.discountPct), [lines, pay.discountPct]);
  const resolved = resolvePayment(pay, totals);
  const zeroQty = cart.some((l) => l.qty === 0);

  const reset = () => { setCart([]); setPatient(null); setCust({ name: "", phone: "", doctor: "" }); setPay(emptyPayment()); setNotes(""); setShowErrors(false); };

  const submit = async () => {
    setShowErrors(true);
    if (!lines.length) return toast.error("Add at least one medicine to the sale.");
    if (cust.phone && !/^\d{10}$/.test(cust.phone.replace(/\D/g, ""))) return toast.error("Enter a valid 10-digit phone number, or leave it blank.");
    if (!resolved.valid) return;
    setBusy(true);
    try {
      const payload = buildBillPayload({
        lines, patient: patient || { name: cust.name.trim() || "Walk-in customer", phone: cust.phone.replace(/\D/g, "") },
        doctorName: cust.doctor.trim(), overallDiscountPercent: pay.discountPct, paidAmount: resolved.paidAmount,
        paymentMode: resolved.paymentMode, transactionId: resolved.transactionId, notes, source: "WALKIN",
      });
      const { bill } = await billsApi.create(payload);
      toast.success("Sale completed");
      reset();
      if (bill?.id) navigate(`/billing/${bill.id}`, { state: { justBilled: true } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Walk-in POS Sale" subtitle="Counter sale without a prescription. Search, add, take payment, print." actions={cart.length > 0 && <Button variant="ghost" icon={Trash2} onClick={reset}>Clear sale</Button>} />
      <div className="pos-layout">
        <div className="flex-col gap-20" style={{ minWidth: 0, gap: 20 }}>
          <section className="card-box"><div className="card-box__body">
            <div className="pos-search input-wrap" ref={boxRef}>
              <PackageSearch aria-hidden="true" />
              <input ref={inputRef} className="bl-input" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onSearchKey}
                placeholder="Search medicine, generic name or batch…" role="combobox" aria-expanded={open && term.length >= 2} aria-controls="pos-results" aria-label="Search medicine" autoComplete="off" />
              {open && term.length >= 2 && (
                <div className="search-results" id="pos-results" role="listbox">
                  {searching && !results.length ? <p className="muted" style={{ padding: 16 }}>Searching…</p> : searchErr ? <p style={{ padding: 16, color: "var(--danger)" }}>{searchErr}</p> :
                    !results.length ? <p className="muted" style={{ padding: 16 }}>No medicine found for "{term}".</p> : results.map((b, i) => (
                      <button key={b.id} role="option" aria-selected={i === active} disabled={!sellableRow(b)} className={`result-row ${i === active ? "is-active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => addBatch(b)}>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: "block" }}>{b.name}</b>
                          <span className="cell-sub">Batch {b.batch} · Exp {formatDate(b.expiryDate)} {b.genericName && `· ${b.genericName}`}</span>
                        </span>
                        <span className="text-right nowrap">
                          <b className="num">{money(b.unitPrice)}</b><span className="cell-sub"> / unit</span>
                          <span style={{ display: "block" }}>{expiryState(b) === "expired" ? <span className="badge-bl sm b-red">Expired</span> : b.stockUnits <= 0 ? <span className="badge-bl sm b-red">Out of stock</span> : <><span className="fs-12 muted">{b.stockUnits} in stock </span><ExpiryBadge item={b} /></>}</span>
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <p className="hint-keys mt-8">Press <kbd>/</kbd> to search · <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to add. Batches are listed earliest-expiry first.</p>
          </div></section>

          <section className="card-box">
            <div className="card-box__head"><h3>Cart ({cart.length})</h3></div>
            {cart.length === 0 ? <EmptyState icon={ShoppingCart} title="The cart is empty" text="Search for a medicine above to start a sale." /> : cart.map((l) => (
              <div className="cart-line" key={l.key}>
                <div style={{ minWidth: 0 }}>
                  <div className="cell-main">{l.name}</div>
                  <div className="cell-sub">Batch {l.batch} · Exp {formatDate(l.expiryDate)} · {money(l.unitPrice)}/unit + {l.gstPercent}% GST</div>
                  {l.qty >= l.stock && l.stock > 0 && <div className="fs-12" style={{ color: "var(--warning)", fontWeight: 700 }}>Max stock reached ({l.stock})</div>}
                </div>
                <div className="flex items-center gap-12">
                  <div className="stepper">
                    <button onClick={() => setQty(l.key, l.qty - 1)} disabled={l.qty <= 1} aria-label={`Decrease ${l.name}`}><Minus size={14} /></button>
                    <input value={l.qty} inputMode="numeric" onChange={(e) => setQty(l.key, e.target.value.replace(/\D/g, ""))} aria-label={`Quantity of ${l.name}`} />
                    <button onClick={() => setQty(l.key, l.qty + 1)} disabled={l.qty >= l.stock} aria-label={`Increase ${l.name}`}><Plus size={14} /></button>
                  </div>
                  <b className="num" style={{ minWidth: 84, textAlign: "right" }}>{money(l.amount)}</b>
                  <button className="icon-action danger" onClick={() => remove(l.key)} aria-label={`Remove ${l.name}`}><Trash2 /></button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside className="sticky-col flex-col" style={{ gap: 20 }}>
          <section className="card-box">
            <div className="card-box__head"><h3>Customer</h3></div>
            <div className="card-box__body flex-col gap-12">
              <PatientPicker value={patient} onChange={setPatient} />
              {!patient && (
                <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Field label="Name"><input className="bl-input" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder="Walk-in customer" maxLength={60} /></Field>
                  <Field label="Phone"><input className="bl-input" inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="10-digit" maxLength={14} /></Field>
                </div>
              )}
              <Field label="Doctor (optional)"><input className="bl-input" value={cust.doctor} onChange={(e) => setCust({ ...cust, doctor: e.target.value })} maxLength={60} /></Field>
            </div>
          </section>

          <section className="card-box">
            <div className="card-box__head"><h3>Payment</h3></div>
            <div className="card-box__body flex-col gap-16">
              {lines.length === 0 ? <p className="muted fs-14">Totals appear once you add items.</p> : <PaymentPanel pay={pay} onChange={setPay} totals={totals} showErrors={showErrors} />}
              {zeroQty && <Alert tone="warn">Some lines have quantity 0 and won't be billed.</Alert>}
              <Button size="lg" block variant="success" loading={busy} disabled={!lines.length} onClick={submit}>Complete sale · {money(totals.billAmount)}</Button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
