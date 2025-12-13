import { api } from "./client";

export async function listLogs() {
  const res = await api.get("/logs");
  return res.data;
}

export async function getLog(id) {
  const res = await api.get(`/logs/${id}`);
  return res.data;
}