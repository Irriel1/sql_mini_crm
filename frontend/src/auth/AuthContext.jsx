// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser, getCurrentUser, logoutUser } from "../api/auth.js";
import { setAuthToken, clearAuthToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  // 1) vždy synchronizuj axios Authorization header s tokenem
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // 2) ověření tokenu po načtení appky (GET /api/auth/me)
  useEffect(() => {
    let cancelled = false;

    async function verifyToken() {
      if (!token || token.trim().length === 0) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser(); // ✅ /auth/me
        if (!cancelled) setUser(currentUser);
      } catch (error) {
        console.error("Auth verify failed:", error.message);
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem("token");
          clearAuthToken();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    verifyToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // 3) login: POST /api/auth/login -> uložit token + user
  async function login(email, password) {
    const data = await loginUser(email, password);

    const newToken = data?.token;
    const userData =
      data?.user ?? (data?.token ? { ...data, token: undefined } : null);

    setToken(newToken);
    localStorage.setItem("token", newToken);
    setAuthToken(newToken);

    // Pokud backend vrací user v login response, použij ho,
    // jinak si ho dotáhni přes /auth/me
    if (userData) setUser(userData);
    else setUser(await getCurrentUser());
  }

  // 4) logout: FE logout vždy; BE logout jen pokud existuje
  async function logout() {
    try {
      // ⚠️ zavolej jen pokud tento endpoint reálně existuje
      await logoutUser();
    } catch (e) {
      // ignoruj
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      clearAuthToken();
    }
  }

  const value = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      isLoading,
      isAuthenticated: !!user,
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
