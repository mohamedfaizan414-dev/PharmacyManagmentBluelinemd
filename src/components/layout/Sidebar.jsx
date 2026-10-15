import { NavLink } from "react-router-dom";
import { BarChart3, ClipboardList, DollarSign, LayoutDashboard, Package, ShoppingCart, Undo2, ExternalLink } from "lucide-react";
import logo from "../../assets/logo.svg";
import { ENV } from "../../config/env";
import { useQueue } from "../../context/QueueContext";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/prescriptions", label: "Prescriptions & Orders", icon: ClipboardList, badge: true },
  { to: "/pos", label: "Walk-in POS Sale", icon: ShoppingCart },
  { to: "/billing", label: "Billing & Invoices", icon: DollarSign },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/returns", label: "Returns & Refunds", icon: Undo2 },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
];

export default function Sidebar({ open, onNavigate }) {
  const { awaiting } = useQueue();

  const handleLinkClick = (e) => {
    e.currentTarget.blur();
    if (onNavigate) onNavigate();
  };

  const handleMouseLeave = (e) => {
    if (document.activeElement && e.currentTarget.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  };

  return (
    <aside
      className={`sidebar ${open ? "is-open" : ""}`}
      aria-label="Primary"
      onMouseLeave={handleMouseLeave}
    >
      <div className="sidebar__brand">
        <img src={logo} alt="" />
        <div className="sidebar__brand-text">
          <strong>BluelineMD</strong>
          <span>Pharmacy</span>
        </div>
      </div>
      <nav className="sidebar__nav">
        {NAV.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleLinkClick}
            className={({ isActive }) => `sidebar__link ${isActive ? "active" : ""}`}
          >
            <Icon aria-hidden="true" />
            <span className="label">{label}</span>
            {badge && awaiting > 0 && (
              <>
                <span className="sidebar__badge" aria-label={`${awaiting} awaiting`}>
                  {awaiting > 99 ? "99+" : awaiting}
                </span>
                <i className="sidebar__dot" aria-hidden="true" />
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {ENV.ADMIN_URL && (
        <div className="sidebar__footer">
          <a className="sidebar__link" href={ENV.ADMIN_URL} onClick={handleLinkClick}>
            <ExternalLink aria-hidden="true" />
            <span className="label">Back to admin panel</span>
          </a>
        </div>
      )}
    </aside>
  );
}
