const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface CacheItem {
  data: any;
  timestamp: number;
}

// In-Memory Client Cache for ultra-fast instant UI rendering
const apiCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 60000; // 60 seconds default cache TTL

export function clearApiCache() {
  apiCache.clear();
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = `${endpoint}`;

  // 1. Return from cache immediately if valid GET request
  if (isGet && !options.headers) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Clear cache on mutations (POST, PUT, DELETE)
  if (!isGet) {
    clearApiCache();
  }

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

  // Save to client cache on GET success
  if (isGet) {
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}
