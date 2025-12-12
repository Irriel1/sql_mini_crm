export async function apiRequest(path, options = {}, token = null) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const baseHeaders = {
    'Content-Type': 'application/json',
  };

  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    // ostatní option hodnoty
    ...options,
    // bezpečné sloučení headers
    headers: {
      ...(options.headers || {}),
      ...baseHeaders,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}