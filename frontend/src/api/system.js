import { api }  from "./client";

export async function getHealthz() {
  const res = await api.get("/system/health");
  return res.data;
}

export async function getVersion() {
  const res = await api.get("/system/version");
  return res.data;
}
