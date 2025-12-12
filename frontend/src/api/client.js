export async function apiRequest(path, options = {}, token = null) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const baseHeaders = {
    'Content-Type': 'application/json',
  };

  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
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
