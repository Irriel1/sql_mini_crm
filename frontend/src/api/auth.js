import { api } from "./client";

// POST /api/auth/login
export async function loginUser(email, password) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

// GET /api/auth/me
export async function getCurrentUser() {
  const res = await api.get("/auth/me");
  return res.data;
}

// POST /api/auth/register
export async function registerUser(data) {
  const res = await api.post("/auth/register", data);
  return res.data;
}

// (volitelné) logout – jen pokud existuje na backendu
export async function logoutUser() {
  const res = await api.post("/auth/logout");
  return res.data;
}
