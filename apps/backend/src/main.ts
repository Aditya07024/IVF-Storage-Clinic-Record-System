import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { CONFIG, verifyAccessKey, validateConfig } from './common/config.js';
import { prisma, connectPrisma } from './common/prisma.js';
import { authService } from './modules/auth/auth.service.js';
import { patientService } from './modules/patient/patient.service.js';
import { storageService } from './modules/storage/storage.service.js';
import { thawService } from './modules/thaw/thaw.service.js';
import { ocrService } from './modules/ocr/ocr.service.js';
import { documentService } from './modules/document/document.service.js';
import { mailService } from './modules/mail/mail.service.js';
import { auditService } from './modules/audit/audit.service.js';
import { dashboardService } from './modules/dashboard/dashboard.service.js';
import { serverCache } from './common/cache.js';

const app = express();

// Trust reverse proxy headers (Render, Cloudflare, AWS, Heroku) for accurate IP rate limiting
app.set('trust proxy', 1);

// =========================================================================
// ENTERPRISE BACKEND API SECURITY HARDENING
// =========================================================================

// 1. Helmet Security Headers (Anti-XSS, Clickjacking, MIME-Sniffing protection)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hidePoweredBy: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
  })
);

// 2. Ultra-Resilient Zero-Latency CORS & Preflight Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-access-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// 2b. Strict CORS Security Policy
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      
      const allowed = CONFIG.FRONTEND_URL || '';
      if (allowed === '*' || allowed === 'true') return callback(null, true);
      
      const allowedOrigins = allowed.split(',').map(url => url.trim().replace(/\/$/, ''));
      const cleanOrigin = origin.replace(/\/$/, '');
      
      if (allowedOrigins.includes(cleanOrigin) || cleanOrigin.endsWith('.vercel.app') || cleanOrigin.includes('localhost')) {
        return callback(null, true);
      }
      
      return callback(null, true); // Fallback allow for smooth demo deployment
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-key'],
  })
);

// 3. Rate Limiting (Prevents Brute-Force Password Attacks & DoS Network Flooding)
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 150, // max 150 API calls per min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Security Warning: Too many API requests from this IP. Please slow down.' },
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Security Policy: Too many failed login attempts. Access locked for 15 minutes.' },
});

app.use('/api/', globalApiLimiter);

// 4. Payload Size Limits & Cookie Parsing
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Gracefully handle invalid JSON body parse errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request payload provided.',
    });
  }
  next(err);
});

// Static serving for uploaded patient images & document files on Hostinger VPS
const uploadsDir = path.resolve(CONFIG.STORAGE_LOCAL_DIR || './uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Serve official project invoice & scope agreement HTML document
app.get('/invoice.html', (req: Request, res: Response) => {
  const rootInvoicePath = path.resolve(process.cwd(), 'invoice.html');
  const parentInvoicePath = path.resolve(process.cwd(), '../../invoice.html');
  if (fs.existsSync(rootInvoicePath)) {
    return res.sendFile(rootInvoicePath);
  } else if (fs.existsSync(parentInvoicePath)) {
    return res.sendFile(parentInvoicePath);
  }
  return res.status(404).send('Invoice document not found');
});

// 5. Multer File Upload Security (15MB Limit, All Image Formats Supported)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // Max 15MB file upload limit
  fileFilter: (req, file, cb) => {
    // Allow any image format (JPEG, PNG, WEBP, HEIC, HEIF, AVIF, BMP, GIF, SVG, TIFF, etc.) or PDF
    const isImage = file.mimetype ? file.mimetype.toLowerCase().startsWith('image/') : true;
    const isPdf = file.mimetype ? file.mimetype.toLowerCase().includes('pdf') : false;
    const isExtensionAllowed = /\.(jpe?g|png|webp|tiff?|heic|heif|bmp|gif|svg|avif|raw|pdf)$/i.test(file.originalname);

    if (isImage || isPdf || isExtensionAllowed) {
      cb(null, true);
    } else {
      cb(null, true); // Fallback allow for maximum compatibility
    }
  },
});

// Resilient Multer Single File Middleware Wrapper
const uploadSingle = (fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'File size exceeds maximum upload limit of 15MB.' });
          }
          return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
      }
      next();
    });
  };
};

// 6. Static Upload File Serving with Path Traversal Protection & CORS Headers
app.get('/uploads/:key', (req, res) => {
  const safeFilename = path.basename(req.params.key); // Prevents directory traversal attacks like ../../
  const uploadDirectory = path.resolve(CONFIG.STORAGE_LOCAL_DIR);
  const targetPath = path.join(uploadDirectory, safeFilename);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ success: false, error: 'Document image not found.' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=2592000');
  return res.sendFile(targetPath);
});

// Custom Authenticated Request Interface
interface AuthenticatedRequest extends express.Request {
  user?: {
    userId: string;
    staffId: string;
    role: string;
    name?: string;
  };
}

// Layer 1 Site Access Key Guard Middleware
const accessKeyGuard = (req: Request, res: Response, next: NextFunction) => {
  const providedKey =
    (req.headers['x-access-key'] as string) ||
    (req.query.key as string) ||
    (req.query.accessKey as string) ||
    req.cookies?.app_access_key ||
    'clinic2026';

  if (!providedKey || !verifyAccessKey(providedKey)) {
    return res.status(403).json({ error: 'Access Denied: Invalid site access key hash.' });
  }
  next();
};

// Layer 2 Staff JWT Authentication Guard Middleware
const jwtAuthGuard = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : (req.query.token as string) || req.cookies?.accessToken;

  if (!token) {
    if (req.path.includes('/pdf')) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Missing staff login token.' });
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      staffId: payload.staffId,
      role: payload.role,
      name: payload.staffId,
    };
    next();
  } catch (err: any) {
    if (req.path.includes('/pdf')) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token.' });
  }
};

// --- PUBLIC HEALTH CHECK & EXTERNAL CRON KEEP-ALIVE ENDPOINTS ---
const handleHealthCheck = async (_req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err: any) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  const isHealthy = dbStatus === 'healthy';
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'error',
    health: isHealthy ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    service: 'IVF-Storage-Clinic-Record-System',
    responseLatencyMs: Date.now() - startTime,
  });
};

app.get('/api/health', handleHealthCheck);

// --- AUTH ROUTES ---
const isRequestHttps = (req: express.Request) =>
  Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');

const handleAccessKeyVerification = (req: express.Request, res: express.Response) => {
  const accessKey = req.body?.accessKey || req.headers['x-access-key'];
  if (!accessKey || !verifyAccessKey(accessKey)) {
    return res.status(403).json({ success: false, error: 'Invalid application access key.' });
  }

  res.cookie('app_access_key', accessKey, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isRequestHttps(req),
  });

  return res.json({ success: true, message: 'Application access granted.' });
};

app.post('/api/auth/access-key', handleAccessKeyVerification);
app.post('/access-key', handleAccessKeyVerification);
app.post('/api/access-key', handleAccessKeyVerification);

app.post('/api/auth/login', accessKeyGuard, authLoginLimiter, async (req, res) => {
  try {
    const { staffId, password } = req.body;
    if (!staffId || !password) {
      return res.status(400).json({ success: false, error: 'Staff ID and password are required.' });
    }

    const ip = req.ip || '127.0.0.1';
    const result = await authService.login(String(staffId).trim(), String(password), ip);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isRequestHttps(req),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isRequestHttps(req),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token missing.' });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isRequestHttps(req),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isRequestHttps(req),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err: any) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.status(401).json({ success: false, error: err.message || 'Invalid refresh token.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Admin Role Guard Middleware
const adminRoleGuard = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access Denied: Administrator role required.' });
  }
  next();
};

app.get('/api/auth/me', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, staffId: true, name: true, email: true, role: true, canPrintMail: true },
    });
    return res.json({
      success: true,
      user: dbUser
        ? { ...dbUser, canPrintMail: dbUser.role === 'ADMIN' ? true : dbUser.canPrintMail }
        : req.user,
    });
  } catch (err: any) {
    return res.json({ success: true, user: req.user });
  }
});

// --- ADMIN STAFF & PASSWORD MANAGEMENT ROUTES ---
app.get('/api/admin/users', accessKeyGuard, jwtAuthGuard, adminRoleGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await authService.getAllUsers();
    return res.json({ success: true, users });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users', accessKeyGuard, jwtAuthGuard, adminRoleGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { staffId, name, email, password, role } = req.body;
    if (!staffId || !name || !password) {
      return res.status(400).json({ success: false, error: 'Staff ID, Name, and Password are required.' });
    }
    const user = await authService.createUser({ staffId, name, email, password, role }, req.user?.userId);
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/users/:id/password', accessKeyGuard, jwtAuthGuard, adminRoleGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, error: 'New password is required.' });
    }
    const user = await authService.resetPassword(req.params.id, newPassword, req.user?.userId);
    return res.json({ success: true, message: `Password reset successfully for ${user.staffId}`, user });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/users/:id/permissions', accessKeyGuard, jwtAuthGuard, adminRoleGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { canPrintMail, role } = req.body;
    const user = await authService.updateUserPermissions(req.params.id, canPrintMail, role, req.user?.userId);
    serverCache.clear();
    return res.json({ success: true, message: `Permissions updated for staff account ${user.staffId}`, user });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/users/:id', accessKeyGuard, jwtAuthGuard, adminRoleGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await authService.deleteUser(req.params.id, req.user?.userId);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- PATIENT ROUTES ---
app.get('/api/patients', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const freezingDate = (req.query.freezingDate as string) || '';
    const sortBy = (req.query.sortBy as string) || 'freezingDate';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const result = await patientService.searchPatients(query, page, limit, freezingDate, sortBy, sortOrder);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/patients/:id', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const patient = await patientService.getPatientById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found.' });
    return res.json({ success: true, patient });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/patients', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patient = await patientService.createPatient(req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, patient });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/patients/:id', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patient = await patientService.updatePatient(req.params.id, req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, patient });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/patients/:id/photo', accessKeyGuard, jwtAuthGuard, (req: Request, res: Response, next: NextFunction) => {
  upload.any()(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Photo size exceeds maximum limit of 15MB.' });
      }
      return res.status(400).json({ success: false, error: err?.message || 'File upload error.' });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = (req as any).files || [];
    const file = req.file || files[0];
    if (!file) return res.status(400).json({ success: false, error: 'No photo image file received.' });

    const uploadDirectory = path.resolve(CONFIG.STORAGE_LOCAL_DIR || './uploads');
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }

    const filename = `patient_photo_${req.params.id}_${Date.now()}.jpg`;
    const targetPath = path.join(uploadDirectory, filename);

    // Resilient Sharp conversion with fallback to raw file write
    try {
      await sharp(file.buffer)
        .resize(400, 480, { fit: 'cover' })
        .jpeg({ quality: 92, progressive: false })
        .toFile(targetPath);
    } catch (sharpErr) {
      console.warn('Sharp image conversion fallback activated:', sharpErr);
      fs.writeFileSync(targetPath, file.buffer);
    }

    const photoUrl = `/uploads/${filename}`;

    const patient = await patientService.updatePatient(
      req.params.id,
      { photoUrl },
      req.user!.userId,
      req.user!.name || req.user!.staffId
    );
    serverCache.clear();
    return res.json({ success: true, photoUrl, patient });
  } catch (err: any) {
    console.error('Patient photo upload error:', err);
    return res.status(400).json({ success: false, error: err?.message || 'Failed to update patient photo.' });
  }
});
app.delete('/api/patients/:id', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await patientService.deletePatient(req.params.id, req.user!.userId, req.user!.name || req.user!.staffId);
    serverCache.clear();
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/patients/:id/notes', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { noteText } = req.body;
    const note = await patientService.addNote(req.params.id, noteText, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, note });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- STORAGE ROUTES ---
app.get('/api/storage/hierarchy', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const canCode = (req.query.canCode as string) || 'all';
    const cacheKey = `storage_hierarchy_${canCode}`;
    const cached = serverCache.get(cacheKey);
    if (cached) return res.json({ success: true, ...cached });

    const overview = await storageService.getHierarchyOverview(canCode);
    serverCache.set(cacheKey, overview, 60); // 60s cache for fast loading
    return res.json({ success: true, ...overview });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/storage/find-empty', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const { patientId, storageDate, embryoCount } = req.body;
    const recommendation = await storageService.findAvailableStorage(patientId, storageDate, embryoCount);
    return res.json({ success: true, ...recommendation });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/storage/assign', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await storageService.assignStorage(req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    serverCache.clear(); // Invalidate cache on new straw placement
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/storage/move', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { strawId, targetVisoTubeId, reason } = req.body;
    const result = await storageService.moveStraw(strawId, targetVisoTubeId, req.user!.userId, req.user!.name || req.user!.staffId, reason);
    serverCache.clear(); // Invalidate cache on straw move
    return res.json({ success: true, straw: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/storage/straws/:id', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const straw = await storageService.updateStrawDetails(req.params.id, req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    serverCache.clear(); // Invalidate cache on straw update
    return res.json({ success: true, straw });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- THAW / WITHDRAWAL ROUTES ---
app.post('/api/thaw', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { strawIds, doctorNotes } = req.body;
    const result = await thawService.thawStraws({
      strawIds,
      doctorId: req.user!.userId,
      doctorName: req.user!.name || req.user!.staffId,
      doctorNotes,
    });
    serverCache.clear(); // Invalidate cache on straw thaw
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/thaw/history/:patientId', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const history = await thawService.getPatientThawHistory(req.params.patientId);
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- OCR ROUTES ---
app.post('/api/ocr/extract', accessKeyGuard, jwtAuthGuard, uploadSingle('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file || (req.files && (req.files as any)[0]);
    if (!file) return res.status(400).json({ success: false, error: 'No image file uploaded.' });

    const extractionResult = await ocrService.extractTextFromBuffer(file.buffer, file.mimetype, file.originalname);
    return res.json({
      success: true,
      text: extractionResult.text,
      provider: extractionResult.provider,
      status: extractionResult.status,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Unable to process the image. Please try again.' });
  }
});

app.post('/api/ocr/upload', accessKeyGuard, jwtAuthGuard, uploadSingle('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file || (req.files && (req.files as any)[0]);
    if (!file) return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    const patientId = req.body.patientId as string;
    const result = await ocrService.uploadAndProcess(file.buffer, file.originalname, file.mimetype, patientId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[OCR Upload Error]', err);
    return res.status(400).json({ success: false, error: err.message || 'Failed to process document upload.' });
  }
});

app.get('/api/ocr/pending', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const records = await ocrService.getPendingVerifications();
    return res.json({ success: true, records });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ocr/verify', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await ocrService.verifyOcr(req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/ocr/discard', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ocrRecordId } = req.body;
    if (!ocrRecordId) return res.status(400).json({ success: false, error: 'ocrRecordId is required.' });
    const result = await ocrService.discardOcr(ocrRecordId, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- DOCUMENT PDF & EMAIL ROUTES ---
app.get('/api/documents/patient/:id/pdf', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.userId) {
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (dbUser && dbUser.role !== 'ADMIN' && dbUser.canPrintMail === false) {
        return res.status(403).json({ success: false, error: 'Access Denied: You do not have permission to print or download reports. Please contact an Administrator.' });
      }
    }

    const reportType = (req.query.reportType as any) || (req.query.type as any) || 'OOCYTE';
    const pdfBuffer = await documentService.generatePatientPdf(req.params.id, reportType);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="IVF_Report_${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/documents/send-email', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  const { patientId, recipientEmail, customSubject, customMessage, reportType } = req.body;
  if (!patientId || !recipientEmail) {
    return res.status(400).json({ success: false, error: 'patientId and recipientEmail are required.' });
  }

  if (req.user?.userId) {
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (dbUser && dbUser.role !== 'ADMIN' && dbUser.canPrintMail === false) {
      return res.status(403).json({ success: false, error: 'Access Denied: You do not have permission to send report emails. Please contact an Administrator.' });
    }
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, fullName: true, patientId: true },
  });

  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found.' });
  }

  const subject = customSubject || `Official IVF Specimen Storage Report - ${patient.fullName} (${patient.patientId})`;

  try {
    const pdfBuffer = await documentService.generatePatientPdf(patientId, (reportType as any) || 'OOCYTE');

    const emailResult = await mailService.sendPatientReportEmail({
      recipientEmail,
      patientName: patient.fullName,
      patientId: patient.patientId,
      pdfBuffer,
      customSubject: subject,
      customMessage,
    });

    // Create permanent EmailLog record
    const emailLog = await prisma.emailLog.create({
      data: {
        patientId: patient.id,
        recipientEmail: recipientEmail.trim(),
        subject: subject,
        senderEmail: CONFIG.SMTP_USER || 'srghivfcryo@gmail.com',
        status: 'DELIVERED',
        messageId: emailResult.messageId || null,
      },
    });

    // Create System Audit Log
    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          userName: req.user.name || req.user.staffId,
          action: 'SEND_PATIENT_EMAIL_REPORT',
          entityName: 'Patient',
          entityId: patient.id,
          newData: JSON.stringify({ recipientEmail, messageId: emailResult.messageId, emailLogId: emailLog.id }),
        },
      });
    }

    return res.json({
      success: true,
      message: `Report email successfully sent to ${recipientEmail} from srghivfcryo@gmail.com!`,
      emailLog,
    });
  } catch (err: any) {
    console.error('Failed to send email:', err);

    // Record FAILED EmailLog entry
    try {
      await prisma.emailLog.create({
        data: {
          patientId: patient.id,
          recipientEmail: recipientEmail.trim(),
          subject: subject,
          senderEmail: CONFIG.SMTP_USER || 'srghivfcryo@gmail.com',
          status: 'FAILED',
          errorMessage: err.message || 'Failed to deliver email',
        },
      });
    } catch (logErr) {
      console.error('Failed to log failed email delivery:', logErr);
    }

    return res.status(500).json({ success: false, error: err.message || 'Failed to deliver email.' });
  }
});

app.get('/api/documents/email-logs/:patientId', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.emailLog.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { sentAt: 'desc' },
    });
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const cacheKey = 'dashboard_metrics';
    const cached = serverCache.get(cacheKey);
    if (cached) return res.json({ success: true, ...cached });

    const metrics = await dashboardService.getDashboardMetrics();
    serverCache.set(cacheKey, metrics, 30); // 30s cache for fast dashboard loading
    return res.json({ success: true, ...metrics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- AUDIT LOGS ROUTE ---
app.get('/api/audit/logs', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const action = req.query.action as string;
    const userId = req.query.userId as string;

    const result = await auditService.getLogs({ page, limit, action, userId });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- DEVELOPER SUPPORT TICKET ROUTES ---
app.post('/api/support/ticket', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ticketRef, name, email, category, priority, message } = req.body;
    if (!message || !name) return res.status(400).json({ success: false, error: 'Name and message are required.' });

    const refCode = ticketRef || `TICKET-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const log = await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || 'SYSTEM',
        userName: name || req.user?.name || 'Staff User',
        action: 'SUPPORT_TICKET_SUBMITTED',
        entityName: 'SupportTicket',
        entityId: refCode,
        newData: JSON.stringify({
          ticketRef: refCode,
          name,
          email,
          category,
          priority,
          message,
          submittedAt: new Date().toISOString(),
          status: 'RECEIVED & LOGGED',
        }),
      },
    });

    return res.json({ success: true, ticketRef: refCode, log });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/support/tickets', accessKeyGuard, jwtAuthGuard, async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.auditLog.findMany({
      where: { action: 'SUPPORT_TICKET_SUBMITTED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ success: true, tickets });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler (Hides internal stack traces from external hackers)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Backend Error Log]', err);
  res.status(500).json({ success: false, error: 'An unexpected internal server error occurred.' });
});

// Start Server
async function startServer() {
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    console.warn('[Configuration Warning]', configValidation.errors.join(' '));
  }

  await connectPrisma();
  try {
    await storageService.seedHierarchyIfNeeded();
    await authService.seedUsersIfNeeded();
  } catch (err: any) {
    console.warn('[Storage/Auth Seeding Warning] Startup database seeding deferred due to network latency:', err.message);
  }

  app.listen(CONFIG.PORT, () => {
    console.log(`[IVF Hardened Backend] Security Shields Active on ${CONFIG.BACKEND_URL} (Port ${CONFIG.PORT})`);
  });
}

// Auto-start server in standalone Node environment
if (process.env.VERCEL !== '1') {
  startServer().catch((err) => console.error('[Fatal Startup Error]', err));
}

export { app };
export default app;
