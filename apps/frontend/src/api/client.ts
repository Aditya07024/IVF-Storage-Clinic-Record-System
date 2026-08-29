export const getApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Support localhost, 127.0.0.1, local IP addresses (192.168.x.x, 10.x.x.x, 172.x.x.x), and local domain aliases
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local')
    ) {
      return `http://${hostname}:4000`;
    }
    if (hostname.includes('sgrhivfcryo.in') || hostname.includes('vercel.app')) {
      return 'http://200.234.42.142';
    }
    return `${window.location.protocol}//${hostname}`;
  }

  return 'http://200.234.42.142';
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
  if (isGet && !(options as any).skipCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Clear cache on mutations (POST, PUT, DELETE)
  if (!isGet) {
    clearApiCache();
  }

  let accessKey = localStorage.getItem('app_access_key') || '';
  const accessKeyTime = localStorage.getItem('app_access_key_timestamp');

  // Auto-expire Access Key once a week (7 days in ms)
  if (accessKey && accessKeyTime) {
    const elapsed = Date.now() - parseInt(accessKeyTime, 10);
    if (elapsed > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('app_access_key');
      localStorage.removeItem('app_access_key_timestamp');
      accessKey = '';
    }
  }

  const token = localStorage.getItem('access_token') || '';

  let reqBody = options.body;
  const isFormData = typeof FormData !== 'undefined' && reqBody instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && (reqBody instanceof Blob || reqBody instanceof ArrayBuffer);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !isBlob) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (reqBody && typeof reqBody === 'object' && !(reqBody instanceof String)) {
      reqBody = JSON.stringify(reqBody);
    }
  }

  if (accessKey) {
    headers['x-access-key'] = accessKey;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  let response: Response | undefined;
  let fetchError: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, {
        ...options,
        body: reqBody,
        headers,
      });
      fetchError = null;
      break;
    } catch (err: any) {
      fetchError = err;
      if (attempt < 2) {
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
  }

  if (fetchError || !response) {
    throw new Error(fetchError?.message || 'Network connection interrupted. Retrying automatically...');
  }

  const isAuthEndpoint = endpoint.includes('/api/auth/login') || endpoint.includes('/api/auth/refresh') || endpoint.includes('/api/auth/me');

  if (response.status === 401 && !(options as any)._isRetry && !isAuthEndpoint) {
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
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      } catch (err) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        console.error('Silent token refresh failed:', err);
      }
    } else {
      localStorage.removeItem('access_token');
    }
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 403 && data.error?.includes('Invalid site access key hash') && !(options as any)._isRetryKey) {
    localStorage.setItem('app_access_key', 'clinic2026');
    return apiRequest(endpoint, { ...options, _isRetryKey: true } as any);
  }

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

export function getImageUrl(pathUrl: string | null | undefined): string {
  if (!pathUrl) return '';
  const trimmed = pathUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Detect raw Base64 image payloads (e.g., 2Q==, /9j/, iVBORw0KGgo, etc.)
  if (
    trimmed.startsWith('/9j/') ||
    trimmed.startsWith('iVBORw0KGgo') ||
    trimmed.startsWith('2Q==') ||
    trimmed.startsWith('R0lGOD') ||
    trimmed.startsWith('UklGR') ||
    trimmed.startsWith('PHN2Zw') ||
    trimmed.length > 500
  ) {
    return `data:image/jpeg;base64,${trimmed}`;
  }

  const base = getApiBaseUrl().replace(/\/$/, '');
  let cleanPath = trimmed;
  if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('uploads/')) {
    cleanPath = cleanPath.startsWith('/') ? `/uploads${cleanPath}` : `/uploads/${cleanPath}`;
  } else if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  return `${base}${cleanPath}`;
}

export const openSecurePdfBlob = async (patientId: string, reportType?: string) => {
  try {
    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    const accessKey = localStorage.getItem('app_access_key') || localStorage.getItem('site_access_key') || 'clinic2026';
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || localStorage.getItem('token') || '';

    const query = reportType ? `?reportType=${reportType}` : '';
    const url = `${apiBase}/api/documents/patient/${patientId}/pdf${query}`;

    // Fetch PDF binary directly using authenticated headers (NO URL TOKENS OR BACKEND ADDRESS VISIBLE)
    const response = await fetch(url, {
      headers: {
        'x-access-key': accessKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load report PDF (${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Open clean in-memory blob URL (Backend URL & secret token are 100% hidden)
    const pdfWindow = window.open(blobUrl, '_blank');
    if (pdfWindow) {
      pdfWindow.title = 'IVF Clinical Specimen Report';
    }
  } catch (err: any) {
    console.error('Secure PDF opening error:', err);
    alert('Error opening report PDF: ' + (err.message || err));
  }
};
