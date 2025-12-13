import { api }  from "./client";

export async function getHealthz() {
  const res = await api.get("/system/info");
  return res.data;
}

export async function getVersion() {
  const res = await api.get("/system/status");
  return res.data;
}