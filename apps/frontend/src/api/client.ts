const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const accessKey = localStorage.getItem('app_access_key') || '';
  const token = localStorage.getItem('access_token') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessKey) {
    headers['x-access-key'] = accessKey;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error! Status: ${response.status}`);
  }

  return data;
}
