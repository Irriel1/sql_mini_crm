import { api }  from "./client";

export async function listMovements() {
  const res = await api.get("/movements");
  return res.data;
}

export async function getMovement(id) {
  const res = await api.get(`/movements/${id}`);
  return res.data;
}

export async function createMovement(data) {
  const res = await api.post("/movements", data);
  return res.data;
}