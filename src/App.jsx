import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedLayout, PublicOnly, RequireAccess, FullLoader } from "./components/layout/guards";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import { PageLoader } from "./components/ui";
import Login from "./pages/auth/Login";
import SelectBranch from "./pages/auth/SelectBranch";

// Code-split every screen after sign-in.
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Prescriptions = lazy(() => import("./pages/prescriptions/Prescriptions"));
const PrescriptionDetail = lazy(() => import("./pages/prescriptions/PrescriptionDetail"));
const PosSale = lazy(() => import("./pages/pos/PosSale"));
const Billing = lazy(() => import("./pages/billing/Billing"));
const BillDetail = lazy(() => import("./pages/billing/BillDetail"));
const Inventory = lazy(() => import("./pages/inventory/Inventory"));
const Returns = lazy(() => import("./pages/returns/Returns"));
const Reports = lazy(() => import("./pages/reports/Reports"));
const NotFound = lazy(() => import("./pages/system/NotFound"));

function Screen({ children, action = "view" }) {
  const { pathname } = useLocation();
  return (
    <RequireAccess action={action}>
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </ErrorBoundary>
    </RequireAccess>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer position="top-center" theme="light" autoClose={4000} newestOnTop pauseOnFocusLoss={false} />
        <Suspense fallback={<FullLoader />}>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<Login />} />
            </Route>
            <Route path="/select-branch" element={<SelectBranch />} />

            <Route element={<ProtectedLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Screen><Dashboard /></Screen>} />
              <Route path="/prescriptions" element={<Screen><Prescriptions /></Screen>} />
              <Route path="/prescriptions/:id" element={<Screen><PrescriptionDetail /></Screen>} />
              <Route path="/pos" element={<Screen action="create"><PosSale /></Screen>} />
              <Route path="/billing" element={<Screen><Billing /></Screen>} />
              <Route path="/billing/:id" element={<Screen><BillDetail /></Screen>} />
              <Route path="/inventory" element={<Screen><Inventory /></Screen>} />
              <Route path="/returns" element={<Screen><Returns /></Screen>} />
              <Route path="/reports" element={<Screen><Reports /></Screen>} />
              <Route path="*" element={<Screen><NotFound /></Screen>} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
