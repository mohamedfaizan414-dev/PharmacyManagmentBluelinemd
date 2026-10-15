import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Building2, ChevronDown, LogOut, Menu, Search, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useQueue } from "../../context/QueueContext";
import { initials } from "../../utils/format";

export default function Header({ onMenu }) {
  const { hospitalName, branch, branches, roleName, user, signOut, selectBranch, branchId } = useAuth();
  const { awaiting } = useQueue();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => (!ref.current?.contains(e.target) || e.type === "keydown") && setOpen(false);
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/prescriptions?search=${encodeURIComponent(term)}` : "/prescriptions");
  };

  return (
    <header className="app-header">
      <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Open menu"><Menu /></button>
      <div className="app-header__ctx">
        <div className="hospital"><b>Hospital Name :</b> {hospitalName || "—"}</div>
        <div className="meta">
          <b>Branch Name :</b> {branch?.branchName || "—"} <span style={{ margin: "0 6px", color: "#d0d5dd" }}>|</span>
          <b>Role :</b> <span className="role">{roleName || "Pharmacist"}</span>
        </div>
      </div>

      <form className="app-header__search" onSubmit={submit} role="search">
        <Search aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by patient name, ID or order no." aria-label="Search prescriptions by patient name, ID or order number" />
      </form>

      <div className="app-header__actions">
        <button className="icon-btn" onClick={() => navigate("/prescriptions")} aria-label={`Prescription queue, ${awaiting} awaiting`} title="Prescription queue">
          <Bell />
          {awaiting > 0 && <span className="dot">{awaiting > 99 ? "99+" : awaiting}</span>}
        </button>

        <div className="user-menu" ref={ref}>
          <button className="user-chip" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
            <span className="avatar">{initials(user.name || roleName || "P")}</span>
            <span className="who"><b>{user.name || "Pharmacist"}</b><small>{roleName}</small></span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {open && (
            <div className="popover" role="menu">
              <div className="popover__head">
                <b style={{ display: "block" }}>{user.name || "Pharmacist"}</b>
                <small className="muted">{user.email || roleName}</small>
              </div>
              {branches.length > 1 && (
                <>
                  <div className="popover__label">Switch branch</div>
                  {branches.map((b) => (
                    <button key={b._id} role="menuitem" className={`popover__item ${b._id === branchId ? "is-current" : ""}`}
                      onClick={() => { setOpen(false); if (b._id !== branchId) { selectBranch(b._id); navigate("/dashboard"); } }}>
                      <Building2 /> <span className="grow">{b.branchName}</span> {b._id === branchId && <Check />}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
                </>
              )}
              <button role="menuitem" className="popover__item danger" onClick={() => signOut()}><LogOut /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
