// Auth client for the FastAPI backend (cookie session + CSRF header).
// Put this at src/api/authApi.js. If other code still imports from "./chatApi", add one line there:
//     export * from "./authApi";

// In development this is Vite's same-origin proxy. Deployments can still set
// VITE_API_URL when the frontend and API are intentionally hosted together.
const API_URL = (import.meta.env?.VITE_API_URL ?? "/api").replace(/\/$/, "");

let csrfToken = null;
export const setCsrfToken = (token) => { csrfToken = token || null; };
export const getCsrfToken = () => csrfToken;

export class ApiError extends Error {
  constructor(message, status = 0, retryAfter = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter; // seconds, set on 429
  }
}

/** Shared request helper. Sends the session cookie and, for writes, the CSRF header. */
export async function apiRequest(path, { method = "GET", body, signal, headers = {} } = {}) {
  const init = { method, credentials: "include", signal, headers: { ...headers } };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
    if (!(body instanceof FormData)) init.headers["Content-Type"] = "application/json";
  }
  if (method !== "GET" && csrfToken) init.headers["X-CSRF-Token"] = csrfToken;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("We can't reach the server. Check your connection and try again.");
  }

  let data = null;
  try { data = await response.json(); } catch { /* empty or non-JSON body */ }

  if (!response.ok) {
    const retry = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("auth:expired")); // AuthContext signs the user out
    }
    throw new ApiError(data?.error || "Something went wrong. Please try again.", response.status, Number.isFinite(retry) ? retry : null);
  }
  return data;
}

const remember = (user) => { setCsrfToken(user?.csrf_token); return user; };

export const registerAccount = (email, password, name) =>
  apiRequest("/auth/register", { method: "POST", body: { email, password, ...(name ? { name } : {}) } }).then(remember);

export const loginAccount = (email, password) =>
  apiRequest("/auth/login", { method: "POST", body: { email, password } }).then(remember);

/** Returns the signed-in user, or null when there is no valid session. */
export const fetchCurrentUser = async (signal) => {
  try {
    return remember(await apiRequest("/auth/me", { signal }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) { setCsrfToken(null); return null; }
    throw error;
  }
};

export const logoutAccount = async () => {
  try { await apiRequest("/auth/logout", { method: "POST" }); } finally { setCsrfToken(null); }
};

export const getApiError = (error, fallback = "Something went wrong. Please try again.") =>
  error instanceof ApiError || error?.message ? error.message || fallback : fallback;
