# BluelineMD Pharmacy (frontend)

Pharmacy module for BluelineMD hospital management: **doctor-prescribed OPD/IPD orders, walk-in POS, billing & invoices, inventory (FEFO + expiry), returns, reports.** React 18 + Vite, styled with the admin panel's design tokens (Nunito, `#0d67b7` / `#d70d78`, gradient rail sidebar).

```bash
npm install
npm run dev        # demo mode on built-in data → http://localhost:5174
npm run build      # production bundle in dist/
npm run lint
```

Demo logins: `pharmacist@blueline.demo / Pharma@123` · `admin@blueline.demo / Admin@123` · `doctor@blueline.demo / Doctor@123` (no pharmacy access).

To connect your backend, read **[docs/API_INTEGRATION_GUIDE.md](docs/API_INTEGRATION_GUIDE.md)** (auth, every endpoint with JSON contracts, doctor→pharmacy hook, deployment, go-live checklist).

## What's inside

| Area | Highlights |
|---|---|
| Sign-in | Same login/branch flow as admin, JWT expiry handling, role gate, optional SSO hand-off |
| Prescriptions | Live OPD/IPD queue (polling + toast + badge), urgent first, filters, search |
| Dispense | FEFO batch pre-pick, partial dispense, substitutes, allergy warnings, reject with reason, double-dispense protection |
| POS | Keyboard-first search (`/`, ↑↓, Enter), expired/out-of-stock blocked, discount, UPI/Card/Cash/Pay-later |
| Billing | Stats, filters, printable GST invoice, collect pending payments |
| Inventory | Stock, expiry watch, low-stock, receive stock, adjust/write-off |
| Returns | Against original bill, partial quantities, reasons, refund, restock rules |
| Reports | Sales trend, source & payment split, top medicines |

Accessible modals (focus trap, Esc), keyboard operable, responsive down to phones, print stylesheet for invoices.
