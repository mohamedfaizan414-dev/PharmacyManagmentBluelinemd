import axios from "axios";
import { ENV } from "../config/env";

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, code = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

/**
 * AuthContext registers itself here so the HTTP layer can read the live session
 * without importing React code (avoids circular imports).
 */
let bridge = { getToken: () => null, getBranchId: () => null, onUnauthorized: () => {} };
export const bindAuthBridge = (b) => {
  bridge = { ...bridge, ...b };
};

const client = axios.create({
  baseURL: ENV.USE_MOCK ? "/mock" : ENV.API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

if (ENV.USE_MOCK) {
  // Loaded lazily so the mock database never ships in a real-backend build's critical path.
  client.defaults.adapter = async (config) => (await import("./mock/mockAdapter.js")).default(config);
}

client.interceptors.request.use((config) => {
  const token = bridge.getToken();
  if (token && !config.skipAuth && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;

  // The admin panel sends branchId on every call – do the same automatically.
  const branchId = bridge.getBranchId();
  if (branchId && !config.skipBranch) {
    const method = (config.method || "get").toLowerCase();
    if (method === "get" || method === "delete") {
      config.params = { branchId, ...(config.params || {}) };
    } else if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
      config.data = { branchId, ...config.data };
    }
  }
  return config;
});

const pickMessage = (data, fallback) =>
  data?.error || data?.message || data?.response || fallback;

client.interceptors.response.use(
  (res) => {
    const body = res.data;
    // Backend envelope: { success, data, message, total, ... }. Treat explicit success:false or status:false as failure.
    if (body && (body.success === false || body.status === false)) {
      throw new ApiError(pickMessage(body, "Request failed"), { status: res.status, data: body });
    }
    return body;
  },
  (error) => {
    if (error?.config?.skipAuthRedirect !== true && error?.response?.status === 401) {
      bridge.onUnauthorized();
    }
    const status = error?.response?.status || 0;
    const data = error?.response?.data;
    const fallback =
      status === 403
        ? "You don't have permission to do that."
        : status === 404
          ? "That record could not be found."
          : status >= 500
            ? "The server ran into a problem. Please try again."
            : error?.code === "ECONNABORTED"
              ? "The request timed out. Please try again."
              : error?.message || "Something went wrong.";
    return Promise.reject(new ApiError(pickMessage(data, fallback), { status, data, code: error?.code }));
  },
);

/** Thin verbs → return the backend envelope, throw ApiError on failure. */
export const http = {
  get: (url, params, opts = {}) => client.get(url, { params, ...opts }),
  post: (url, data, opts = {}) => client.post(url, data, opts),
  put: (url, data, opts = {}) => client.put(url, data, opts),
  patch: (url, data, opts = {}) => client.patch(url, data, opts),
  delete: (url, data, opts = {}) => client.delete(url, { data, ...opts }),
};
