export const getApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }

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
      return 'https://api.sgrhivfcryo.in';
    }
    return `${window.location.protocol}//${hostname}`;
  }

  return 'https://api.sgrhivfcryo.in';
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

/**
 * Strict Environment Detection:
 * Returns true ONLY in local development environments.
 * Returns false in all production builds and live domains.
 */
export function isDevelopmentMode(): boolean {
  // 1. Check Vite compile-time environment flags
  if ((import.meta as any).env?.DEV === true) return true;
  if ((import.meta as any).env?.MODE === 'development') return true;

  // 2. Fallback check for localhost / local network addresses if in browser
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the developer sandbox has been unlocked with password "sgrmIVFdev"
 */
export function isDevSandboxUnlocked(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem('dev_sandbox_password') === 'sgrmIVFdev';
}

let isRefreshingToken = false;
let activeRefreshPromise: Promise<string | null> | null = null;

async function silentTokenRefresh(): Promise<string | null> {
  if (isRefreshingToken && activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  isRefreshingToken = true;
  activeRefreshPromise = (async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const accessKey = localStorage.getItem('app_access_key') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessKey) headers['x-access-key'] = accessKey;

      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.accessToken) {
        localStorage.setItem('access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
        return data.accessToken;
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      return null;
    } catch (err) {
      console.error('Silent token refresh failed:', err);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      return null;
    } finally {
      isRefreshingToken = false;
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
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

  const devPassword = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('dev_sandbox_password') || '') : '';
  if (devPassword) {
    headers['x-dev-password'] = devPassword;
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

  const isAuthLoginOrRefresh = endpoint.includes('/api/auth/login') || endpoint.includes('/api/auth/refresh');

  // Handle 401 Unauthorized: Try silent token refresh first
  if (response.status === 401 && !(options as any)._isRetry && !isAuthLoginOrRefresh) {
    const newToken = await silentTokenRefresh();
    if (newToken) {
      return apiRequest(endpoint, { ...options, _isRetry: true } as any);
    }
  }

  const data = await response.json().catch(() => ({}));

  // If 401 Unauthorized persists, auto refresh page immediately (no alert popup!)
  if (response.status === 401 && !isAuthLoginOrRefresh) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
    throw new Error(data.error || 'Session expired. Refreshing page...');
  }

  // Handle Access Key Errors: ONLY redirect to Security Access Gate if backend specifically rejected the site access key
  const isAccessKeyError =
    typeof data.error === 'string' && (
      data.error.toLowerCase().includes('invalid site access key') ||
      data.error.toLowerCase().includes('invalid application access key') ||
      data.error.toLowerCase().includes('invalid site access key hash')
    );

  if (isAccessKeyError) {
    localStorage.removeItem('app_access_key');
    localStorage.removeItem('app_access_key_timestamp');
    clearApiCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('access-key-invalid'));
    }
    throw new Error(data.error || 'Access Key Invalid. Redirecting to Security Access Gate...');
  }

  if (!response.ok) {
    const errObj: any = new Error(data.error || `HTTP error! Status: ${response.status}`);
    const retryHeader =
      response.headers.get('Retry-After') ||
      response.headers.get('retry-after') ||
      response.headers.get('RateLimit-Reset') ||
      response.headers.get('ratelimit-reset');
    const parsedHeaderSec = retryHeader ? parseInt(retryHeader, 10) : null;
    const retrySec = data.retryAfterSeconds || (parsedHeaderSec && !isNaN(parsedHeaderSec) ? parsedHeaderSec : null);

    if (retrySec) {
      errObj.retryAfterSeconds = retrySec;
    }
    throw errObj;
  }

  // Save to client cache on GET success
  if (isGet) {
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

export function formatDateDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return 'N/A';
    const day = String(dateInput.getUTCDate()).padStart(2, '0');
    const month = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
    const year = dateInput.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  let str = String(dateInput).trim();
  if (!str || str === 'N/A' || str === 'null' || str === 'undefined') return 'N/A';

  if (str.includes('T')) {
    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      const day = String(dObj.getUTCDate()).padStart(2, '0');
      const month = String(dObj.getUTCMonth() + 1).padStart(2, '0');
      const year = dObj.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
    str = str.split('T')[0];
  }

  // 1. Check YYYY-MM-DD format (ISO)
  const ymdMatch = str.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 2. Check DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY format
  const dmyMatch = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    let y = dmyMatch[3];
    if (y.length === 2) {
      const yNum = parseInt(y, 10);
      y = String(yNum < 50 ? 2000 + yNum : 1900 + yNum);
    }
    return `${d}/${m}/${y}`;
  }

  const date = new Date(str);
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTimestampDDMMYYYY(dateInput: string | Date | null | undefined, includeTime = true): string {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  if (!includeTime) return dateStr;

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = String(hours % 12 || 12).padStart(2, '0');

  return `${dateStr}, ${formattedHours}:${minutes} ${ampm}`;
}

export function formatPhoneNumber(phoneInput?: string | null): string {
  if (!phoneInput) return '—';
  const cleaned = phoneInput.trim();
  if (!cleaned) return '—';

  // If already starts with '+', format cleanly with space
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Strip non-digits
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return cleaned;

  // 10-digit Indian local mobile number without country code
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // 12-digit Indian number starting with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  return `+${digits}`;
}

export function calculateEmbryoStage(retrievalDate?: string | Date | null, freezingDate?: string | Date | null): string {
  if (!retrievalDate || !freezingDate) return 'Day 5';

  let rStr = typeof retrievalDate === 'string' ? retrievalDate : retrievalDate.toISOString();
  let fStr = typeof freezingDate === 'string' ? freezingDate : freezingDate.toISOString();

  const parseISO = (str: string) => {
    if (!str) return '';
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let [p0, p1, p2] = parts.map(p => p.trim());
      let y = 0, m = 0, d = 0;
      if (p0.length === 4) {
        y = parseInt(p0, 10); m = parseInt(p1, 10); d = parseInt(p2, 10);
      } else {
        d = parseInt(p0, 10); m = parseInt(p1, 10); y = parseInt(p2, 10);
        if (p2.length === 2) y = y < 50 ? 2000 + y : 1900 + y;
      }
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900) {
        return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      }
    }
    return str;
  };

  const rIso = parseISO(rStr);
  const fIso = parseISO(fStr);

  const rDate = new Date(rIso);
  const fDate = new Date(fIso);

  if (isNaN(rDate.getTime()) || isNaN(fDate.getTime())) return 'Day 5';

  const rUtc = Date.UTC(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());
  const fUtc = Date.UTC(fDate.getFullYear(), fDate.getMonth(), fDate.getDate());

  const diffDays = Math.round((fUtc - rUtc) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Day 0';
  }
  if (diffDays > 7) {
    return 'Day 5';
  }
  return `Day ${diffDays}`;
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
  // Dispatch event for in-app loading modal
  window.dispatchEvent(new CustomEvent('pdf-loading-start', { detail: { patientId, reportType } }));

  // Synchronously open window to bypass browser popup blockers
  const pdfWindow = window.open('about:blank', '_blank');
  if (pdfWindow) {
    pdfWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Generating IVF Cryo Specimen Report...</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #334155; text-align: center; max-width: 420px; width: 90%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
          .spinner { width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem auto; }
          .progress-bar-bg { background: #334155; height: 10px; border-radius: 9999px; overflow: hidden; margin: 1.5rem 0 1rem 0; }
          .progress-bar-fill { background: linear-gradient(90deg, #10b981, #14b8a6); height: 100%; width: 0%; transition: width 0.1s linear; }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #ffffff; }
          p { font-size: 0.875rem; color: #94a3b8; margin: 0; }
          .percent { font-family: monospace; font-size: 0.9rem; color: #34d399; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2>Generating Cryo Specimen PDF</h2>
          <p id="stage">Initializing document engine...</p>
          <div class="progress-bar-bg">
            <div id="fill" class="progress-bar-fill"></div>
          </div>
          <div class="percent"><span id="pct">0</span>%</div>
        </div>
        <script>
          const start = Date.now();
          const duration = 7000;
          const fill = document.getElementById('fill');
          const pct = document.getElementById('pct');
          const stage = document.getElementById('stage');
          const stages = [
            'Fetching cryo straw records & patient details...',
            'Formatting straw numbers & tube colors...',
            'Rendering QR barcodes & verification signatures...',
            'Finalizing vector PDF document layout...'
          ];
          const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
            if (fill) fill.style.width = progress + '%';
            if (pct) pct.innerText = progress;
            if (stage) stage.innerText = stages[Math.min(3, Math.floor(progress / 25))];
            if (progress >= 100) clearInterval(timer);
          }, 50);
        </script>
      </body>
      </html>
    `);
  }

  const startTime = Date.now();
  const MIN_LOADING_TIME = 7000; // 7 seconds loading bar duration

  try {
    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    const accessKey = localStorage.getItem('app_access_key') || localStorage.getItem('site_access_key') || 'clinic2026';
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || localStorage.getItem('token') || '';

    const query = reportType ? `?reportType=${reportType}` : '';
    const url = `${apiBase}/api/documents/patient/${patientId}/pdf${query}`;

    // Fetch PDF binary directly using authenticated headers
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

    // Ensure 10-second loading bar animation completes for user feedback
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pdf-loading-complete'));
      if (pdfWindow) {
        pdfWindow.location.href = blobUrl;
      }
    }, remainingTime);

  } catch (err: any) {
    console.error('Secure PDF opening error:', err);
    window.dispatchEvent(new CustomEvent('pdf-loading-error', { detail: { message: err.message || 'Error generating PDF' } }));
    if (pdfWindow) {
      pdfWindow.close();
    }
  }
};
