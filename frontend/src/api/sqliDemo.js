import { api } from "./client";

export async function runSqliDemo(body) {
  const res = await api.post("/sqli-demo/run", body);
  return res.data;
}