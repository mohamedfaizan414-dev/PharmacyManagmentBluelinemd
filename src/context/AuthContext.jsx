import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { authApi } from "../api/services";
import { bindAuthBridge } from "../api/http";
import { STORAGE_KEY } from "../config/env";
import { createAccessChecker } from "../utils/access";

const AuthContext = createContext(null);
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

/* ── persistence (same key + shape as the admin panel so one login can serve both apps) ── */
const readStore = () => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};
const writeStore = (v) => {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable (private mode) – session lives in memory only */ }
};

const claimsOf = (token) => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};
const isExpired = (token) => {
  const c = claimsOf(token);
  return !c || (c.exp && c.exp * 1000 <= Date.now());
};

/**
 * Optional hand-off from the admin panel:  https://pharmacy.example.com/#token=…&branchId=…
 * A URL *fragment* is never sent to servers or logged, and we strip it immediately.
 */
const consumeHandoff = () => {
  if (!window.location.hash.includes("token=")) return null;
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = p.get("token");
  const branchId = p.get("branchId") || undefined;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (!token || isExpired(token)) return null;
  const session = { token, branchId, ...claimsOf(token) };
  writeStore(session);
  return session;
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const handed = consumeHandoff();
    if (handed) return handed;
    const s = readStore();
    if (s?.token && isExpired(s.token)) {
      writeStore(null);
      return null;
    }
    return s;
  });
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(Boolean(session?.token));
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const token = session?.token || null;
  const branchId = session?.branchId || null;

  const signOut = useCallback((message) => {
    writeStore(null);
    setSession(null);
    setProfile(null);
    setBooting(false);
    if (message) toast.info(message, { toastId: "signed-out" });
  }, []);

  // HTTP layer reads the live session through this bridge.
  useEffect(() => {
    bindAuthBridge({
      getToken: () => sessionRef.current?.token || null,
      getBranchId: () => sessionRef.current?.branchId || null,
      onUnauthorized: () => {
        if (sessionRef.current?.token) signOut("Your session expired. Please sign in again.");
      },
    });
  }, [signOut]);

  const loadProfile = useCallback(async () => {
    const data = await authApi.profile(sessionRef.current?.token);
    setProfile(data);
    if (data?.branches?.length && !sessionRef.current?.branchId) {
      const withBranch = { ...sessionRef.current, branchId: data.branches[0]._id };
      writeStore(withBranch);
      sessionRef.current = withBranch;
      setSession(withBranch);
    }
    return data;
  }, []);

  // Restore profile on page load / token change.
  useEffect(() => {
    if (!token) {
      setBooting(false);
      return undefined;
    }
    let cancelled = false;
    setBooting(true);
    loadProfile()
      .catch(() => { /* 401 handled by bridge; other errors surface via the guard's retry UI */ })
      .finally(() => !cancelled && setBooting(false));
    return () => {
      cancelled = true;
    };
  }, [token, loadProfile]);

  // Sign out automatically the moment the token expires.
  useEffect(() => {
    if (!token) return undefined;
    const exp = claimsOf(token)?.exp;
    if (!exp) return undefined;
    const ms = exp * 1000 - Date.now();
    if (ms <= 0) {
      signOut("Your session expired. Please sign in again.");
      return undefined;
    }
    const t = setTimeout(() => signOut("Your session expired. Please sign in again."), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [token, signOut]);

  const signIn = useCallback(async (identifier, password) => {
    const data = await authApi.login(identifier, password);
    if (!data?.token) throw new Error("Login succeeded but no token was returned.");
    const next = { token: data.token, type: data.type, isFirstLogin: data.isFirstLogin, ...claimsOf(data.token) };
    writeStore(next);
    sessionRef.current = next;
    setSession(next);
    const p = await loadProfile();
    // Directly select default branch so login navigates straight to dashboard
    if (p?.branches?.length) {
      const bId = next.branchId || p.branches[0]._id;
      const withBranch = { ...next, branchId: bId };
      writeStore(withBranch);
      sessionRef.current = withBranch;
      setSession(withBranch);
    }
    return p;
  }, [loadProfile]);

  const selectBranch = useCallback((id) => {
    const next = { ...sessionRef.current, branchId: id };
    writeStore(next);
    sessionRef.current = next;
    setSession(next);
  }, []);

  const value = useMemo(() => {
    const access = createAccessChecker(profile || {});
    const branches = profile?.branches || [];
    const activeBranchId = branchId || (branches.length ? branches[0]._id : null);
    const branch = branches.find((b) => b._id === activeBranchId) || null;
    let status = "anonymous";
    if (token) status = booting ? "booting" : !profile ? "error" : "ready";
    return {
      status,
      token,
      branchId: activeBranchId,
      branch,
      branches,
      profile,
      access,
      roleName: profile?.roleName || (profile?.isAdmin ? "Admin" : ""),
      hospitalName: profile?.healthcareDetails?.name || "",
      user: { name: session?.name || profile?.staff?.name || "", email: session?.email || "" },
      signIn,
      signOut,
      selectBranch,
      retryProfile: () => {
        setBooting(true);
        return loadProfile().catch(() => {}).finally(() => setBooting(false));
      },
    };
  }, [token, booting, profile, branchId, session, signIn, signOut, selectBranch, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
