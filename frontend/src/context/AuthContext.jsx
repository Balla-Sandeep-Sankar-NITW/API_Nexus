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

  // The API client fires this when a request fails and the refresh token can't
  // renew the session.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", { email, password }, { auth: false });
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  // Registration does not log you in: the backend requires a verified email
  // first, so this returns { message, email_sent, verification_token? } and the
  // Register page walks the person through verifying.
  const register = useCallback(
    (email, fullName, password) =>
      api.post("/auth/register", { email, full_name: fullName, password }, { auth: false }),
    []
  );

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

  const refreshUser = useCallback(async () => {
    const fresh = await api.get("/auth/me");
    setUser(fresh);
    return fresh;
  }, []);

  const resendVerification = useCallback(() => api.post("/auth/resend-verification"), []);

  const resendVerificationByEmail = useCallback(
    (email) => api.post("/auth/resend-verification-by-email", { email }, { auth: false }),
    []
  );

  const verifyEmail = useCallback((token) => api.post("/auth/verify-email", { token }, { auth: false }), []);

  const requestPasswordReset = useCallback(
    (email) => api.post("/auth/request-password-reset", { email }, { auth: false }),
    []
  );

  const resetPassword = useCallback(
    (token, newPassword) => api.post("/auth/reset-password", { token, new_password: newPassword }, { auth: false }),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
        resendVerification,
        resendVerificationByEmail,
        verifyEmail,
        requestPasswordReset,
        resetPassword,
      }}
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
