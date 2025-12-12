import { apiRequest } from './client';

export function loginUser(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function registerUser(email, password, name = '') {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function getCurrentUser(token) {
  return apiRequest('/auth/me', { method: 'GET' }, token);
}
