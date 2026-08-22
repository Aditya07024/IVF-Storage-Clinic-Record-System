import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { CONFIG, verifyAccessKey } from './common/config.js';
import { connectPrisma } from './common/prisma.js';
import { authService } from './modules/auth/auth.service.js';
import { patientService } from './modules/patient/patient.service.js';
import { storageService } from './modules/storage/storage.service.js';
import { thawService } from './modules/thaw/thaw.service.js';
import { ocrService } from './modules/ocr/ocr.service.js';
import { documentService } from './modules/document/document.service.js';
import { auditService } from './modules/audit/audit.service.js';
import { dashboardService } from './modules/dashboard/dashboard.service.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: CONFIG.FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Serve uploaded images statically with authorization
app.use('/uploads', express.static(path.resolve(CONFIG.STORAGE_LOCAL_DIR)));

// Custom Request Interface
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    staffId: string;
    role: string;
    name?: string;
  };
}

// Layer 1 Site Access Key Guard Middleware
const accessKeyGuard = (req: Request, res: Response, next: NextFunction) => {
  const providedKey = (req.headers['x-access-key'] as string) || req.cookies?.app_access_key;
  if (!providedKey || !verifyAccessKey(providedKey)) {
    return res.status(403).json({ error: 'Access Denied: Invalid site access key.' });
  }
  next();
};

// Layer 2 Staff JWT Authentication Guard Middleware
const jwtAuthGuard = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : req.cookies?.accessToken;

  if (!token) {
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
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token.' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/access-key', (req, res) => {
  const { accessKey } = req.body;
  if (!accessKey || !verifyAccessKey(accessKey)) {
    return res.status(403).json({ success: false, error: 'Invalid application access key.' });
  }

  res.cookie('app_access_key', accessKey, {
    httpOnly: true,
    sameSite: 'strict',
    secure: CONFIG.NODE_ENV === 'production',
  });

  return res.json({ success: true, message: 'Application access granted.' });
});

app.post('/api/auth/login', accessKeyGuard, async (req, res) => {
  try {
    const { staffId, password } = req.body;
    const ip = req.ip || '127.0.0.1';
    const result = await authService.login(staffId, password, ip);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: CONFIG.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: CONFIG.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', accessKeyGuard, jwtAuthGuard, (req: AuthenticatedRequest, res) => {
  return res.json({ success: true, user: req.user });
});

// --- PATIENT ROUTES ---
app.get('/api/patients', accessKeyGuard, jwtAuthGuard, async (req, res) => {
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

app.get('/api/patients/:id', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const patient = await patientService.getPatientById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found.' });
    return res.json({ success: true, patient });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/patients', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const patient = await patientService.createPatient(req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, patient });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/patients/:id', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const patient = await patientService.updatePatient(req.params.id, req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, patient });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/patients/:id/notes', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const { noteText } = req.body;
    const note = await patientService.addNote(req.params.id, noteText, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, note });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- STORAGE ROUTES ---
app.get('/api/storage/hierarchy', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const canCode = req.query.canCode as string;
    const overview = await storageService.getHierarchyOverview(canCode);
    return res.json({ success: true, ...overview });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/storage/find-empty', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const { patientId, storageDate, embryoCount } = req.body;
    const recommendation = await storageService.findAvailableStorage(patientId, storageDate, embryoCount);
    return res.json({ success: true, ...recommendation });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/storage/assign', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await storageService.assignStorage(req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/storage/move', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const { strawId, targetVisoTubeId, reason } = req.body;
    const result = await storageService.moveStraw(strawId, targetVisoTubeId, req.user!.userId, req.user!.name || req.user!.staffId, reason);
    return res.json({ success: true, straw: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- THAW / WITHDRAWAL ROUTES ---
app.post('/api/thaw', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const { strawIds, doctorNotes } = req.body;
    const result = await thawService.thawStraws({
      strawIds,
      doctorId: req.user!.userId,
      doctorName: req.user!.name || req.user!.staffId,
      doctorNotes,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/thaw/history/:patientId', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const history = await thawService.getPatientThawHistory(req.params.patientId);
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- OCR ROUTES ---
app.post('/api/ocr/upload', accessKeyGuard, jwtAuthGuard, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    const patientId = req.body.patientId as string;
    const result = await ocrService.uploadAndProcess(req.file.buffer, req.file.originalname, req.file.mimetype, patientId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ocr/pending', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const records = await ocrService.getPendingVerifications();
    return res.json({ success: true, records });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ocr/verify', accessKeyGuard, jwtAuthGuard, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await ocrService.verifyOcr(req.body, req.user!.userId, req.user!.name || req.user!.staffId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- DOCUMENT PDF ROUTES ---
app.get('/api/documents/patient/:id/pdf', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const pdfBuffer = await documentService.generatePatientPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="patient-${req.params.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- DASHBOARD ROUTE ---
app.get('/api/dashboard', accessKeyGuard, jwtAuthGuard, async (req, res) => {
  try {
    const metrics = await dashboardService.getDashboardMetrics();
    return res.json({ success: true, ...metrics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- AUDIT LOGS ROUTE ---
app.get('/api/audit/logs', accessKeyGuard, jwtAuthGuard, async (req, res) => {
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

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Backend Error]', err);
  res.status(500).json({ error: 'An unexpected internal error occurred. Please try again.' });
});

// Start Server
async function startServer() {
  await connectPrisma();
  await storageService.seedHierarchyIfNeeded();

  app.listen(CONFIG.PORT, () => {
    console.log(`[IVF Backend] Server running on ${CONFIG.BACKEND_URL} (Port ${CONFIG.PORT})`);
  });
}

startServer();
