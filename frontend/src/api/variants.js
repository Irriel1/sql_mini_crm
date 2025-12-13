import { api } from "./client";

export async function listItemVariants(itemId) {
  const res = await api.get(`/items/${itemId}/variants`);
  return res.data?.variants ?? [];
}

// POST /api/items/:itemId/variants
export async function createItemVariant(itemId, data) {
  const res = await api.post(`/items/${itemId}/variants`, data, {
    headers: { "Content-Type": "application/json" },
  });
  // backend: { variant: {...} }
  return res.data?.variant ?? res.data;
}

// DELETE /api/items/:itemId/variants/:variantId
export async function deleteItemVariant(itemId, variantId) {
  const res = await api.delete(`/items/${itemId}/variants/${variantId}`);
  return res.data;
}

// PUT /api/items/:itemId/variants/:variantId (až budeš dělat edit)
export async function updateItemVariant(itemId, variantId, data) {
  const res = await api.put(`/items/${itemId}/variants/${variantId}`, data, {
    headers: { "Content-Type": "application/json" },
  });
  return res.data?.variant ?? res.data;
}