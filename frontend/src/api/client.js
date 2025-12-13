import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

/**
 * Axios instance pro celé FE.
 * baseURL = VITE_API_URL (např. http://localhost:4000/api) nebo "" (proxy /api)
 */
export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Robustní nastavení Bearer tokenu (trim + non-empty).
 */
export function setAuthToken(token) {
  if (typeof token === "string" && token.trim().length > 0) {
    api.defaults.headers.common.Authorization = `Bearer ${token.trim()}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function clearAuthToken() {
  delete api.defaults.headers.common.Authorization;
}

/**
 * Axios vyhazuje error automaticky, my jen sjednotíme message.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;

    const msg =
      (typeof data === "string" && data) ||
      data?.error ||
      data?.message ||
      error?.message ||
      "Request failed";

    // `API error 401: ...`
    throw new Error(`API error ${status ?? "?"}: ${msg}`);
  }
);