import { api } from "./client";

// GET /api/logs?user_id=&action=&date_from=&date_to=
export async function getLogs(params = {}) {
  const { data } = await api.get("/logs", { params });
  return data; // očekávám { logs: [...] }
}

// GET /api/logs/:id
export async function getLog(id) {
  const { data } = await api.get(`/logs/${id}`);
  return data; // očekávám { log: {...} }
}
