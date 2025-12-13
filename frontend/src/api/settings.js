import { api } from "./client";

export async function getSettings() {
  const res = await api.get("/settings");
  return res.data;
}

export async function updateSettings(data) {
  const res = await api.put("/settings", data);
  return res.data;
}