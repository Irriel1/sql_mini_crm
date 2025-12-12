// frontend/src/api/dashboard.js
import RequireAuth from '../auth/RequireAuth';
import { apiRequest } from './client';

// GET /api/dashboard
export function getDashboard(token) {
  return apiRequest('api/dashboard', { method: 'GET' }, token);
}
