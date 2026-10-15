# BluelineMD Pharmacy – API Integration Guide

This guide takes you from the **demo build** (runs on built-in sample data) to a **production build** talking to your BluelineMD backend. The UI never calls the backend directly; everything goes through three files, so integration is a matter of checking those files, not hunting through screens.

| File | What it does | When you edit it |
|---|---|---|
| `src/api/endpoints.js` | Every route the app calls (marked EXISTING / NEW) | A route path differs |
| `src/api/adapters.js` | Backend JSON → UI models | A field name differs |
| `src/api/services.js` | Typed functions the screens use | Rarely |

---

## 0. Read this first: the backend URL

The URL supplied with the brief, `https://bluelinemd-pharmacy.netlify.app/`, serves a **front-end** (a single-page app shell with no API routes). It is a good UI reference, but it cannot answer API calls. Use the **same backend base URL your admin panel uses** (its `VITE_API_ENDPOINT`). The pharmacy app was built against the routes already present in the admin repo (`api/v1/adminAuth/Login`, `api/v1/pharmacyBilling/...`, `api/v1/inventory/...`). Anything the admin repo did not already have is listed in section 4 as **NEW**.

---

## 1. Quick start

```bash
npm install
npm run dev            # http://localhost:5174, demo mode
```

Demo logins (shown on the sign-in page): `pharmacist@blueline.demo / Pharma@123`, `admin@blueline.demo / Admin@123`, `doctor@blueline.demo / Doctor@123` (no pharmacy access, to see the 403 screen).

**Switch to the real backend**

```bash
# .env
VITE_API_ENDPOINT=https://your-api-host
VITE_USE_MOCK=false
```

Restart `npm run dev`. If `VITE_API_ENDPOINT` is empty the app always falls back to demo mode, so a misconfigured deploy never silently hits nothing.

| Variable | Meaning |
|---|---|
| `VITE_API_ENDPOINT` | Backend base URL, no trailing slash |
| `VITE_USE_MOCK` | `true` = mock API, `false` = real |
| `VITE_ADMIN_URL` | Adds "Back to admin panel" and "Forgot password" links |
| `VITE_QUEUE_POLL_SECONDS` | Prescription queue refresh interval (0 = off) |
| `VITE_EXPIRY_WARN_DAYS` | "Expiring soon" window (default 90) |

---

## 2. Authentication and authorization

### How sign-in works (identical to the admin panel)

1. `POST api/v1/adminAuth/Login` `{ identifier, password }` → `{ data: { token, type, isFirstLogin } }`
2. `GET api/v1/adminAuth/branches/get` (Bearer token) → `data: { isAdmin, roleName, roleAccess, branches[], healthcareDetails{name} }`
3. User picks a branch (skipped if there is only one). The session `{ token, branchId, ...jwtClaims }` is stored in `localStorage["authUserData"]`, the **same key and shape as the admin panel**, so if both apps are served from one origin, one login serves both.

### What the HTTP layer does automatically (`src/api/http.js`)

- Adds `Authorization: Bearer <token>` to every call (never overrides one you pass explicitly).
- Adds `branchId` to every request (query string for GET/DELETE, body for POST/PUT/PATCH), as the admin panel does.
- On **401** → clears the session, returns to the sign-in page with a toast.
- Normalises errors: it reads `error`, `message` or `response` from the body, so toasts show your backend's own message.
- Treats `{ success: false }` with HTTP 200 as an error.
- Expired JWTs are detected on load and by timer (`exp` claim), before any request is wasted.

### Authorization (who can do what)

- A user may enter the app only if `roleAccess["9"]` exists (module 9 = Pharmacy Management) or `isAdmin` is true; otherwise they see an "access denied" screen.
- Inside the app: view → read permission; POS, dispensing, receiving stock, returns → `write`; adjusting stock, collecting payment → `edit`. Buttons are hidden and routes are guarded (`src/components/layout/guards.jsx`).
- Sub-modules: `roleAccess["9"]` can be a flat array (`["read","write"]`) or an object keyed by sub-module. If you use sub-modules, set the numbers in `src/config/permissions.js` (`FEATURES`). Until then the app uses the union of everything granted on module 9.

> **Hiding a button is not security.** Every NEW endpoint below must re-check the role server-side. The UI is a convenience layer only.

### Optional: one-click hand-off from the admin panel

Open the pharmacy app with the token in the URL **fragment** (never sent to servers or written to logs); it is consumed and removed immediately:

```js
// admin panel, "Pharmacy" button
const { token, branchId } = JSON.parse(localStorage.getItem("authUserData"));
window.open(`https://pharmacy.yourhospital.com/#token=${token}&branchId=${branchId}`);
```

---

## 3. The doctor → pharmacy flow

```
Doctor saves prescription (OPD visit or IPD round)
        │   backend creates a pharmacy order  ← section 5
        ▼
status PENDING (OPD) / REQUESTED (IPD)         ── appears in pharmacy queue (bell + sidebar badge, toast)
        ▼
Pharmacist opens it → batches pre-picked FEFO → allergy check → adjust / substitute
        ▼
POST …/dispense  → bill created + stock deducted + order updated (one transaction)
        ▼
DISPENSED, or PARTIALLY_DISPENSED (remaining items stay open) → invoice printed
```

Statuses: `PENDING`, `REQUESTED`, `IN_PROGRESS`, `PARTIALLY_DISPENSED`, `DISPENSED`, `REJECTED`, `CANCELLED`. A rejected request needs a reason, which the doctor's screen should show.

---

## 4. Endpoint reference

`EXISTING` = already in your backend (the admin panel uses it). `NEW` = to build. All responses use the existing envelope `{ success, data, message|response, total? }`. Lists accept `page` (1-based) and `limit`.

### EXISTING (verify the shapes once)

| Purpose | Route | Notes |
|---|---|---|
| Login | `POST api/v1/adminAuth/Login` | |
| Profile / roles / branches | `GET api/v1/adminAuth/branches/get` | `healthcareDetails.name` is shown as the hospital name; change in `AuthContext.jsx` if yours differs |
| Stock list | `GET api/v1/inventory/getallInventory?page&limit&search` | Pagination in `pagination.total` |
| Medicines | `GET api/v1/medicine/getallMedicines` | |
| Manufacturers | `GET api/v1/manufacturer/getManufacturers` | |
| Receive stock | `POST api/v1/inventory/createInvoice` | Same payload as the admin inventory invoice |
| Bills list + stats | `GET api/v1/pharmacyBilling/getAllPharmacyBills?page&limit&search&from&to&status` | Top-level `totalBills,totalAmount,paidAmount,pendingAmount`, `total` |
| Create bill (POS) | `POST api/v1/pharmacyBilling/createPharmacyBill` | Same items payload as admin `AddPharmacyBill`; extra optional fields `source` (`WALKIN\|OPD\|IPD`) and `prescriptionId` |
| Collect payment | `POST api/v1/pharmacyBilling/addDeposit/:billId` | Body `{ depositAmount, amount, paymentMode, transactionId }` |
| Patients / doctors lookups | `GET api/v1/patients/getAll?search`, `GET api/v1/staff/doctors` | Optional, for linking a sale to a patient |

> **Check:** the app derives a unit's selling price as `pricePerStrip / unitsPerStrip` (as admin `AddPharmacyBill` does). If you sell at MRP, change one line in `adaptInventory` (`unitPrice`).

### NEW

**`GET api/v1/pharmacyOrders/getAll`** — query `page, limit, search, type (OPD|IPD), status (comma list, e.g. PENDING,REQUESTED), from, to`. Sort: open requests first, `URGENT` before `NORMAL`, then newest. Returns `{ success, data: [Order], total }`.

```json
Order = {
  "_id": "…", "orderId": "OPD-9812", "type": "OPD", "status": "PENDING", "priority": "NORMAL",
  "createdAt": "2026-10-14T09:12:00Z",
  "patient": { "_id": "…", "patientId": "P101", "patientName": "Ramesh Kumar", "age": 54, "gender": 0, "phoneNumber": "9876500101", "allergies": ["Penicillin"] },
  "doctor":  { "_id": "…", "name": "Dr. Meera Krishnan", "department": "General Medicine" },
  "location": "Male Medical Ward - Bed 4",     // IPD only
  "encounterId": "ADM-2210",                    // appointment / admission ref
  "diagnosis": "Acid reflux",
  "items": [{
    "_id": "…", "medicineId": "…", "medicineName": "Pantoprazole 40mg",
    "dosage": "40mg", "frequency": "1-0-0", "duration": "14 days", "route": "Oral",
    "quantity": 14, "dispensedQuantity": 0, "instructions": "Before breakfast", "substituteAllowed": true
  }]
}
```

**`GET api/v1/pharmacyOrders/get/:id`** → `{ success, data: Order }`

**`GET api/v1/pharmacyOrders/counts`** → `{ data: { PENDING: 3, REQUESTED: 2, IN_PROGRESS: 1, …, AWAITING: 5 } }` (`AWAITING = PENDING + REQUESTED`; drives the badge). Keep it cheap, it is polled every 30 s.

**`PATCH api/v1/pharmacyOrders/:id/status`** `{ status: "IN_PROGRESS" | "REJECTED" | "CANCELLED", reason }` → updated Order. Reject must require `reason` (400 otherwise); 409 if already closed.

**`POST api/v1/pharmacyOrders/:id/dispense`** — the important one. Body = the standard `createPharmacyBill` payload **plus**:

```json
{
  "orderItems": [{ "itemId": "<order item _id>", "inventoryId": "<batch _id>", "quantity": 10 }],
  "complete": false          // true = close the order even if some items weren't dispensed
}
```

The server must, **in one database transaction**:
1. Lock the batches, and reject with 400 if any `quantity` exceeds stock or the batch is expired.
2. **Recompute prices, GST, discount and totals itself.** Never trust client totals. Use the batch's own price.
3. Deduct stock; create the bill (`source = order.type`, `prescriptionId = order._id`).
4. Add to each item's `dispensedQuantity`; set status `DISPENSED` when all items are complete or `complete = true`, else `PARTIALLY_DISPENSED`.
5. Return `{ success, message, data: { order, bill } }`. Respond **409** if the order is already closed (blocks double-clicks and two pharmacists).

**`POST api/v1/pharmacyOrders/create`** — see section 5.

**`GET api/v1/pharmacyBilling/getPharmacyBill/:id`** → `{ data: Bill }` (single bill with `items`, `payments[]`). If you skip it, change `billsApi.get` to read from the list endpoint.

**`POST api/v1/inventory/adjustStock/:batchId`** `{ delta, reason }` (negative removes). 400 if stock would go below 0; write an audit row (who, when, why).

**`GET api/v1/pharmacyReturns/getAll?page&limit&search`** and **`POST api/v1/pharmacyReturns/create`**

```json
{ "billId": "…", "refundMode": "CASH", "items": [{ "inventoryId": "…", "quantity": 2, "reason": "Doctor changed prescription" }] }
```
Server rules: quantity ≤ sold − already returned; refund = proportional `amount / quantity × returnQty` (include GST and discount); put stock back **unless** the reason is damaged/expired; record `returnedQuantity` on bill items. Response `data: { returnId, billId, billNo, patientName, refundAmount, refundMode, createdAt, items[] }`.

**`GET api/v1/pharmacyReports/summary?from&to`**

```json
{ "from": "2026-09-15", "to": "2026-10-14",
  "totals": { "bills": 0, "sales": 0, "collected": 0, "pending": 0, "refunds": 0, "unitsSold": 0 },
  "bySource": [{ "name": "OPD", "value": 0 }], "byPayment": [{ "name": "CASH", "value": 0 }],
  "topMedicines": [{ "name": "…", "units": 0, "revenue": 0 }],
  "daily": [{ "date": "2026-10-14", "sales": 0 }] }
```
(`daily` should include zero-sales days so the chart has no gaps.)

### Error contract

Use HTTP status + `{ success: false, message }`: `400` validation (shown verbatim to the pharmacist, so make it readable: "Only 30 units of X (batch Y) are in stock."), `401` not signed in, `403` no permission, `404` missing, `409` conflict (already dispensed), `5xx` unexpected.

---

## 5. Sending doctor prescriptions to the pharmacy

**Recommended (server-side hook):** when your existing prescription save succeeds (OPD consultation or IPD order), create a pharmacy order inside the same service. The doctor's screen needs no change and cannot "forget" to notify pharmacy.

```js
// inside your existing "save prescription" handler, after it succeeds
await PharmacyOrder.create({
  type: appointment.isInpatient ? "IPD" : "OPD",           // from your encounter
  status: appointment.isInpatient ? "REQUESTED" : "PENDING",
  priority: payload.urgent ? "URGENT" : "NORMAL",
  patientId, doctorId, branchId, encounterId: appointment._id,
  location: admission ? `${admission.ward} - Bed ${admission.bed}` : "",
  diagnosis: payload.diagnosis,
  items: prescription.medicines.map(m => ({
    medicineId: m.medicineId, medicineName: m.name, dosage: m.dosage, frequency: m.frequency,
    duration: m.duration, route: m.route, quantity: m.totalQuantity, instructions: m.notes,
    substituteAllowed: m.substituteAllowed !== false })),
});
```

Generate `orderId` as `OPD-####` / `IPD-####` (a per-branch counter). When a doctor **edits** a prescription that is still `PENDING/REQUESTED`, update the same order; if it is already partially dispensed, add a new order instead of rewriting history.

**Alternative (client-side):** from the admin's `Prescription.jsx` save handler, call `POST api/v1/pharmacyOrders/create` with the body above (`type, priority, patientId, doctorId, location, diagnosis, items`). Use this only if you cannot touch the backend flow.

`quantity` is in **units** (tablets, vials). If doctors prescribe "1-0-1 for 5 days", the doctor screen or backend should multiply to units (10). That is the one conversion the pharmacy UI does not guess.

---

## 6. Where to change things

| Backend differs by… | Change |
|---|---|
| A route path | `src/api/endpoints.js` |
| A field name in a response | `src/api/adapters.js` |
| Pagination envelope | `totalOf()` in `adapters.js` |
| Hospital name location | `AuthContext.jsx` (`healthcareDetails.name`) |
| Permission sub-modules | `src/config/permissions.js` |
| GST / rounding rules | `src/utils/billing.js` (one engine for POS, dispensing, returns) |
| Allergy aliases | `src/utils/allergy.js` |
| Statuses / reasons / payment modes | `src/config/constants.js` |

Billing maths: line = unit price × qty + GST, minus line discount, minus overall discount %, rounded to the whole rupee (round-off is shown). This matches the admin's pharmacy billing; the server must repeat it.

---

## 7. Going real-time (optional)

Polling every 30 s is the default and needs nothing extra. For instant delivery, have the server push an event when an order is created and call `refresh()` from `useQueue()`:

```js
// in QueueProvider (src/context/QueueContext.jsx)
useEffect(() => {
  if (!enabled) return;
  const es = new EventSource(`${ENV.API_BASE_URL}/api/v1/pharmacyOrders/stream?token=${token}&branchId=${branchId}`);
  es.onmessage = () => refresh();
  return () => es.close();
}, [enabled, refresh]);
```
(Prefer a short-lived stream ticket over a raw token in the URL. Keep polling at a longer interval as a fallback.)

---

## 8. Deployment

- **Netlify:** `public/_redirects` (SPA fallback) is included. Build `npm run build`, publish `dist`. Set env vars in the site settings.
- **Docker/nginx:** `Dockerfile` + `nginx.conf` included. `docker build --build-arg VITE_API_ENDPOINT=https://api… --build-arg VITE_USE_MOCK=false -t blueline-pharmacy .`
- **CORS:** allow the pharmacy origin on the API (`Authorization`, `Content-Type` headers; methods incl. `PATCH`).
- Vite env vars are baked in **at build time**; rebuild after changing them.

---

## 9. Go-live checklist

- [ ] `VITE_USE_MOCK=false`, `VITE_API_ENDPOINT` set, rebuilt
- [ ] Log in as a real pharmacist; profile loads, correct hospital/branch/role in the header
- [ ] A role without module 9 sees the access-denied screen; the API returns 403 for it too
- [ ] Doctor saves OPD and IPD prescriptions → both appear in the queue within 30 s
- [ ] Dispense fully, then partially; stock decreases; bill matches the server's own recomputation
- [ ] Two browsers dispense the same order → the second gets a 409 message
- [ ] An expired batch can't be sold (UI hides it **and** the API rejects it)
- [ ] Return a bill item; refund and restock are right; over-returning is rejected
- [ ] Reports totals equal the Billing page totals
- [ ] Print an invoice (browser print → A4)

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in page shows "Demo mode" in production | `VITE_API_ENDPOINT` was empty at build time |
| "Cannot reach the server" | CORS, wrong URL, or API down (check the Network tab) |
| Everything signs out immediately | Backend rejects the token (wrong audience/secret) → 401 |
| Queue empty but doctors saved prescriptions | Order isn't created in the save flow (section 5) or `branchId` differs |
| Prices off by a factor | Unit price derivation (`adaptInventory`): strip vs unit |
| Access-denied for a valid pharmacist | `roleAccess["9"]` missing, or sub-module keys don't match `permissions.js` |

## 11. Project map

```
src/
  api/          endpoints.js · http.js · adapters.js · services.js · mock/ (demo backend)
  config/       env · constants · permissions
  context/      AuthContext (session, roles) · QueueContext (live queue + badge)
  components/   layout/ (sidebar, header, guards) · ui/ (buttons, modal, tables…) · pharmacy/ (payment, patient picker)
  pages/        auth · dashboard · prescriptions · pos · billing · inventory · returns · reports
  utils/        billing (one maths engine) · inventory (FEFO, expiry) · allergy · access · format
  styles/       base (design tokens from the admin panel) · layout · components
```
