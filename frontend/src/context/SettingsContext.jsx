import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getSettings, updateSettings as apiUpdateSettings } from "../api/settings";

const SettingsContext = createContext(null);

function parseApiErrorStatus(error) {
  const msg = error?.message || "";
  const m = msg.match(/API error\s+(\d{3})/i);
  return m ? Number(m[1]) : null;
}

export function SettingsProvider({ children }) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErr] = useState("");

  async function reload() {
    setErr("");
    setIsLoading(true);
    try {
      const data = await getSettings();
      setSettings(data.settings ?? data);
    } catch (e) {
      setSettings(null);
      setErr(e?.message || "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateSettings(patchOrFull) {
    setErr("");
    try {
      const saved = await apiUpdateSettings(patchOrFull);

      setSettings((prev) => {
        return (
          saved?.settings ??
          saved ??
          { ...(prev || {}), ...(patchOrFull || {}) }
        );
      });

      return saved;
    } catch (e) {
      const status = parseApiErrorStatus(e);
      const msg = e?.message || "Failed to save settings";
      setErr(status === 401 || status === 403 ? `Admin only. ${msg}` : msg);
      throw e;
    }
  }

  // load once on app start
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setSettings(null);
      setIsLoading(false);
      setErr("");
      return;
    }

    reload();
  }, [authLoading, isAuthenticated]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      error,
      reload,
      updateSettings,
    }),
    [settings, isLoading, error]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
