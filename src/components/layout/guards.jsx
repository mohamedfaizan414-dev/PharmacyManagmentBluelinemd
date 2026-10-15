import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button, ErrorState } from "../ui";
import AppLayout from "./AppLayout";
import logo from "../../assets/logo.svg";

export const FullLoader = () => (
  <div className="full-loader" role="status" aria-label="Loading">
    <div className="brand"><img src={logo} alt="" /><div className="loader-ring" /></div>
  </div>
);

export function Forbidden({ inline }) {
  const { signOut } = useAuth();
  const body = (
    <div className="empty" style={{ padding: inline ? "60px 20px" : 0 }}>
      <div className="empty__icon" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}><ShieldAlert /></div>
      <h4>You don't have access to this</h4>
      <p>Your role doesn't include {inline ? "this part of the pharmacy module" : "the pharmacy module"}. Ask your hospital admin to grant it under Staff Management → Roles.</p>
      <Button variant="ghost" icon={LogOut} onClick={() => signOut()} className="mt-16">Sign in with another account</Button>
    </div>
  );
  return inline ? body : <div className="auth-page"><div className="card-box" style={{ maxWidth: 520, padding: 40 }}>{body}</div></div>;
}

/** Everything under here needs: a valid session → a chosen branch → pharmacy module access. */
export function ProtectedLayout() {
  const { status, access, signOut, retryProfile } = useAuth();
  const location = useLocation();

  if (status === "booting") return <FullLoader />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (status === "error") {
    return (
      <div className="auth-page"><div className="card-box" style={{ maxWidth: 520, padding: 30 }}>
        <ErrorState message="We couldn't load your account details." onRetry={retryProfile} />
        <div className="text-right"><Button variant="ghost" size="sm" onClick={() => signOut()}>Sign out</Button></div>
      </div></div>
    );
  }
  if (!access.hasModuleAccess()) return <Forbidden />;
  return <AppLayout />;
}

/** Per-route permission gate. Admins always pass. */
export function RequireAccess({ action = "view", children }) {
  const { access } = useAuth();
  const allowed = { view: access.canView, create: access.canCreate, edit: access.canEdit, delete: access.canDelete }[action]?.();
  return allowed ? children : <Forbidden inline />;
}

/** Login / branch pages – bounce away if already fully signed in. */
export function PublicOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "booting") return <FullLoader />;
  if (status === "ready") return <Navigate to={location.state?.from || "/dashboard"} replace />;
  return <Outlet />;
}
