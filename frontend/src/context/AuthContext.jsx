import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getAccessToken, setTokens, clearTokens } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", { email, password }, { auth: false });
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, fullName, password) => {
    const data = await api.post(
      "/auth/register",
      { email, full_name: fullName, password },
      { auth: false }
    );
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  // PATCH /api/auth/me only accepts full_name today (see UserUpdate in the
  // OpenAPI schema) - there is no endpoint to change email from account
  // settings, so that field is intentionally not editable here.
  const updateProfile = useCallback(async (fullName) => {
    const updated = await api.patch("/auth/me", { full_name: fullName });
    setUser(updated);
    return updated;
  }, []);

  const resendVerification = useCallback(() => api.post("/auth/resend-verification"), []);

  const requestPasswordReset = useCallback(
    (email) => api.post("/auth/request-password-reset", { email }, { auth: false }),
    []
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile, resendVerification, requestPasswordReset }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
