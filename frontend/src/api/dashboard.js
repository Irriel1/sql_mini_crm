// frontend/src/api/dashboard.js
import { apiRequest } from './client';

// GET /api/dashboard
export function getDashboard(token) {
  return apiRequest('/dashboard', { method: 'GET' }, token);
}
