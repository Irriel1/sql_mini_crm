import { api } from "./client";

export const getMovements = (params) =>
  api.get("/inventory-movements", { params });

export const getMovement = (id) =>
  api.get(`/inventory-movements/${id}`);

export const createMovement = (data) =>
  api.post("/inventory-movements", data);

// Demo vulnerable endpoints
export const getMovementsDemo = (params) =>
  api.get("/demo/inventory-movements", { params });

export const createMovementDemo = (data) =>
  api.post("/demo/inventory-movements", data);