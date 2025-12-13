import { api } from "./client";

// GET /api/items -> { items: [...] }
export async function listItems(params = {}) {
  const res = await api.get("/items", { params });
  return res.data.items || [];
}

export async function getItem(id) {
  const res = await api.get(`/items/${id}`);
  return res.data;
}

// POST /api/items -> (dle BE, typicky { item: {...} })
export async function createItem(body) {
  const res = await api.post("/items", body);
  return res.data.item ?? res.data;
}

// PUT /api/items/:id -> (dle BE)
export async function updateItem(id, body) {
  const res = await api.put(`/items/${id}`, body);
  return res.data.item ?? res.data;
}

// DELETE /api/items/:id -> 204
export async function deleteItem(id) {
  await api.delete(`/items/${id}`);
}
