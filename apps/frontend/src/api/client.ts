const getApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:4000';
  }
  // Production: frontend on Vercel, backend on Render
  return 'https://ivf-storage-clinic-record-system.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

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

  if (response.status === 401 && !(options as any)._isRetry) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.accessToken) {
          localStorage.setItem('access_token', refreshData.accessToken);
          if (refreshData.refreshToken) {
            localStorage.setItem('refresh_token', refreshData.refreshToken);
          }
          return apiRequest(endpoint, { ...options, _isRetry: true } as any);
        }
      } catch (err) {
        console.error('Silent token refresh failed:', err);
      }
    }
  }

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

export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';
  let str = String(dateInput).trim();
  if (str.includes('T')) {
    str = str.split('T')[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
