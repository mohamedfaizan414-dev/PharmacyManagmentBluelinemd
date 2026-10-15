import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ordersApi } from "../api/services";
import { ENV } from "../config/env";
import { useAuth } from "./AuthContext";

const QueueContext = createContext({ awaiting: 0, counts: {}, version: 0, refresh: () => {} });
export const useQueue = () => useContext(QueueContext);

/**
 * Keeps the "awaiting pharmacy" count fresh and tells the pharmacist the moment a doctor
 * sends a new OPD/IPD prescription.  `version` bumps whenever the queue changed so pages can refetch.
 *
 * Polling is the zero-infrastructure default. To go real-time, replace the interval below with a
 * WebSocket / SSE listener that calls `refresh()` (see docs/API_INTEGRATION_GUIDE.md §9).
 */
export function QueueProvider({ children }) {
  const { status, access } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [version, setVersion] = useState(0);
  const last = useRef(null);
  const enabled = status === "ready" && access.canView();

  const refresh = useCallback(async () => {
    try {
      const c = await ordersApi.counts();
      setCounts(c);
      const awaiting = c.AWAITING ?? (c.PENDING || 0) + (c.REQUESTED || 0);
      if (last.current !== null && awaiting > last.current) {
        const n = awaiting - last.current;
        toast.info(`${n} new prescription request${n > 1 ? "s" : ""} from the doctors. Click to open the queue.`, {
          toastId: `rx-${awaiting}`,
          onClick: () => navigate("/prescriptions"),
        });
      }
      if (last.current !== awaiting) setVersion((v) => v + 1);
      last.current = awaiting;
    } catch { /* background refresh – stay quiet, the next tick retries */ }
  }, [navigate]);

  useEffect(() => {
    if (!enabled) {
      last.current = null;
      return undefined;
    }
    refresh();
    if (!ENV.QUEUE_POLL_SECONDS) return undefined;
    const tick = () => document.visibilityState === "visible" && refresh();
    const id = setInterval(tick, ENV.QUEUE_POLL_SECONDS * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  const value = useMemo(
    () => ({ counts, awaiting: counts.AWAITING ?? (counts.PENDING || 0) + (counts.REQUESTED || 0), version, refresh }),
    [counts, version, refresh],
  );
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}
