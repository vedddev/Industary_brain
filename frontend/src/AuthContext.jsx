import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, logoutAccount, setCsrfToken as setRequestCsrfToken } from "./api/authApi";

const AuthContext = createContext(null);
const LEGACY_WORKSPACE_KEYS = ["api_key", "provider", "forge_chats", "forge_active_chat", "forge_model", "iki_documents"];

const clearLegacyWorkspaceStorage = () => {
  for (const key of LEGACY_WORKSPACE_KEYS) window.localStorage.removeItem(key);
};

/** Cookie-session authentication state. No session token is persisted in browser storage. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [, setCsrfToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((sessionUser) => {
    if (!sessionUser || typeof sessionUser !== "object") return;
    const { csrf_token: token, ...publicUser } = sessionUser;
    clearLegacyWorkspaceStorage();
    setUser((previous) => {
      if (previous?.id && previous.id !== publicUser.id) {
        window.localStorage.removeItem(`iki:${previous.id}:provider-api-key`);
      }
      return publicUser;
    });
    setCsrfToken(token || null);
  }, []);

  const logout = useCallback(async () => {
    // Unmount account-scoped workspace state before waiting on the network.
    // This also aborts any chat/upload work owned by that workspace.
    if (user?.id) window.localStorage.removeItem(`iki:${user.id}:provider-api-key`);
    clearLegacyWorkspaceStorage();
    setUser(null);
    setCsrfToken(null);
    try {
      await logoutAccount();
    } catch {
      // Local isolation still takes effect if the server cannot be reached.
    } finally {
      // Clear the request client's CSRF token even if the session has expired.
      setRequestCsrfToken(null);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    fetchCurrentUser(controller.signal)
      .then((sessionUser) => {
        if (mounted) login(sessionUser);
      })
      .catch(() => {
        // 401 is the normal guest/expired-session state. The API client keeps the error available
        // to explicit callers, but session restoration should not surface a toast on page load.
        if (mounted) {
          setUser(null);
          setCsrfToken(null);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; controller.abort(); };
  }, [login]);

  useEffect(() => {
    const expired = () => { setUser(null); setCsrfToken(null); setRequestCsrfToken(null); };
    window.addEventListener("auth:expired", expired);
    return () => window.removeEventListener("auth:expired", expired);
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
  }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider.");
  return context;
}
