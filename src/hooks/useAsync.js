import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../utils/format";

/**
 * Data loader with loading / error / reload, stale-response protection and optional silent refresh.
 *   const { data, loading, error, reload } = useAsync(() => api.list(params), [params]);
 */
export function useAsync(fn, deps = [], { immediate = true, keepPrevious = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: "" });
  const callId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++callId.current;
    if (!silent) setState((s) => ({ data: keepPrevious ? s.data : null, loading: true, error: "" }));
    try {
      const data = await fnRef.current();
      if (id === callId.current) setState({ data, loading: false, error: "" });
      return data;
    } catch (e) {
      if (id === callId.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error: silent ? s.error : errorMessage(e) }));
      return undefined;
    }
  }, [keepPrevious]);

  useEffect(() => {
    if (immediate) run();
    return () => {
      callId.current += 1; // ignore responses from an unmounted / superseded request
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })) };
}
