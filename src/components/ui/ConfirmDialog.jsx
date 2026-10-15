import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";

/** Confirm with optional required reason (used for reject / write-off). */
export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", variant = "primary", reasonLabel, reasonRequired = false, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const missing = reasonLabel && reasonRequired && !reason.trim();

  const submit = async () => {
    setTouched(true);
    if (missing) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      setTouched(false);
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (busy) return;
    setReason("");
    setTouched(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button variant={variant} onClick={submit} loading={busy}>{confirmLabel}</Button>
        </>
      }
    >
      <p style={{ lineHeight: 1.6 }}>{message}</p>
      {reasonLabel && (
        <div className="field mt-16">
          <label htmlFor="confirm-reason">{reasonLabel}{reasonRequired && <span className="req"> *</span>}</label>
          <textarea id="confirm-reason" data-autofocus className={`bl-textarea ${touched && missing ? "invalid" : ""}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          {touched && missing && <span className="field-error">A reason is required.</span>}
        </div>
      )}
    </Modal>
  );
}
