import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible modal: Esc to close, focus trapped + restored, scroll locked, click outside to dismiss. */
export default function Modal({ open, title, onClose, size = "", footer, children, dismissible = true, labelledBy = "modal-title" }) {
  const ref = useRef(null);
  const prev = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    prev.current = document.activeElement;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    const first = node?.querySelector("[data-autofocus]") || node?.querySelector(FOCUSABLE);
    first?.focus();

    const onKey = (e) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === "Tab" && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev.current?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose?.()}>
      <div className={`modal-bl ${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
        <div className="modal-bl__head">
          <h3 id={labelledBy}>{title}</h3>
          {dismissible && (
            <button className="icon-action" onClick={onClose} aria-label="Close dialog"><X /></button>
          )}
        </div>
        <div className="modal-bl__body">{children}</div>
        {footer && <div className="modal-bl__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
