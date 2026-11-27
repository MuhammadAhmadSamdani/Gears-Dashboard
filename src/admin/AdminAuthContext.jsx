import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, ApiError } from "../services/api";

/* =========================================================
   ADMIN AUTHENTICATION

   The session lives in an HTTP-only cookie set by the backend.
   This context only holds the safe profile the server returns
   from /auth/me - it never sees a password or a hash.

   Route guards here are a convenience for the UI. Every admin
   API is independently protected on the server.
========================================================= */

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);

  /* "checking" until the first /auth/me resolves, so guards do not
     bounce an authenticated admin to the login screen on refresh. */
  const [status, setStatus] = useState("checking");

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");

      setAdmin(response.admin);
      setStatus("authenticated");

      return response.admin;
    } catch {
      setAdmin(null);
      setStatus("anonymous");

      return null;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.removeItem("gears_admin_token");
    } catch {
      // Some browsers disable access to local storage.
    }

    /*
      The state updates inside this loader all happen after an await,
      so they cannot cascade renders the way this rule guards against.
    */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile();
  }, [loadProfile]);

  const login = useCallback(async (email, password) => {
    await api.post("/auth/login", { email, password });
    const response = await api.get("/auth/me").catch((error) => {
      if (error.status !== 401) throw error;
      throw new ApiError("Your browser did not accept the admin session cookie.", 401);
    });

    setAdmin(response.admin);
    setStatus("authenticated");

    return response.admin;
  }, []);

  const clearSession = useCallback(() => {
    setAdmin(null);
    setStatus("signed-out");
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      admin,
      status,
      isAuthenticated: status === "authenticated",
      isChecking: status === "checking",
      login,
      logout,
      clearSession,
      refresh: loadProfile,
      setAdmin,
    }),
    [admin, status, login, logout, clearSession, loadProfile]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

/* eslint-disable-next-line react-refresh/only-export-components */
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }

  return context;
};
