import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RotateCcw, FlaskConical } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { QueueProvider } from "../../context/QueueContext";
import { useAuth } from "../../context/AuthContext";
import { ENV } from "../../config/env";
import { Button } from "../ui";

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { branchId } = useAuth();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const resetDemo = async () => {
    const { resetMock } = await import("../../api/mock/mockAdapter.js");
    resetMock();
    window.location.reload();
  };

  return (
    <QueueProvider>
      <div className="app-shell">
        <Sidebar open={open} onNavigate={() => setOpen(false)} />
        {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
        <div className="main">
          <Header onMenu={() => setOpen(true)} />
          {/* key=branchId → every page remounts and refetches when the branch changes */}
          <main className="content" id="main" key={branchId}>
            {ENV.USE_MOCK && (
              <div className="demo-banner no-print" role="note">
                <FlaskConical size={18} />
                <span><b>Demo mode</b> – running on built-in sample data. Nothing is sent to a server.</span>
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetDemo}>Reset demo data</Button>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </QueueProvider>
  );
}
