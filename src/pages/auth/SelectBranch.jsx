import { Navigate, useNavigate } from "react-router-dom";
import { Building2, LogOut } from "lucide-react";
import logo from "../../assets/logo.svg";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui";
import { FullLoader } from "../../components/layout/guards";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export default function SelectBranch() {
  useDocumentTitle("Select branch");
  const { status, branches, user, selectBranch, signOut } = useAuth();
  const navigate = useNavigate();

  if (status === "booting") return <FullLoader />;
  if (status === "anonymous") return <Navigate to="/login" replace />;

  const pick = (id) => {
    selectBranch(id);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="card-box" style={{ width: "100%", maxWidth: 820, padding: "40px 44px" }}>
        <div className="auth-brand" style={{ marginBottom: 20 }}>
          <img src={logo} alt="" />
          <div><b>BluelineMD</b><span>Pharmacy module</span></div>
        </div>
        <h1>{user.name ? `Hello, ${user.name}` : "Welcome"}</h1>
        <p className="muted mt-4">Choose the branch you're working in today.</p>

        {branches.length === 0 ? (
          <p className="mt-24">No branches are assigned to your account. Please contact your hospital admin.</p>
        ) : (
          <div className="branch-grid">
            {branches.map((b) => (
              <button key={b._id} className="branch-card" onClick={() => pick(b._id)}>
                <span className="ico"><Building2 /></span>
                <span><b style={{ display: "block", color: "var(--text)" }}>{b.branchName}</b><small className="muted">Open pharmacy</small></span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-24"><Button variant="ghost" size="sm" icon={LogOut} onClick={() => signOut()}>Sign out</Button></div>
      </div>
    </div>
  );
}
