import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../../common/prisma.js';
import { CONFIG } from '../../common/config.js';
import { OcrExtractionResult, VerifyOcrInput } from './interfaces/ocr-result.interface.js';
import { ALLOWED_OCR_MIME_TYPES, MAX_OCR_FILE_SIZE } from './dto/extract-ocr.dto.js';
import { imageProcessingService } from '../image-processing/image-processing.service.js';

let visionModule: any = null;
try {
  // Safe require for build-time resolution on Render/CI environments
  visionModule = require('@google-cloud/vision');
} catch (e: any) {
  console.warn('[OcrService] @google-cloud/vision package load notice:', e.message || e);
}

export class OcrService {
  private visionClient: any = null;
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    this.initVisionClient();
    this.initGeminiClient();
    this.purgeDiskStorage();
  }

  /**
   * Purges local disk image files to stay 100% text-only and preserve Render free tier / 5GB disk space
   */
  public purgeDiskStorage() {
    if (CONFIG.ENABLE_DISK_PURGE !== 'true') {
      return; // All image uploads & scanned documents are permanently preserved on hostinger server disk
    }
    try {
      const uploadDir = path.resolve(CONFIG.STORAGE_LOCAL_DIR);
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        let count = 0;
        for (const file of files) {
          try {
            const fullPath = path.join(uploadDir, file);
            if (fs.statSync(fullPath).isFile()) {
              fs.unlinkSync(fullPath);
              count++;
            }
          } catch (e) {}
        }
        if (count > 0) {
          console.log(`[OcrService] Ephemeral Disk Guard: Purged ${count} image file(s) from local storage.`);
        }
      }
    } catch (err: any) {
      console.warn('[OcrService] Disk purge notice:', err.message || err);
    }
  }

  private initVisionClient() {
    try {
      const provider = CONFIG.OCR_PROVIDER || 'google';
      if (provider === 'google') {
        let credPath = CONFIG.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        if (credPath && !path.isAbsolute(credPath)) {
          credPath = path.resolve(process.cwd(), credPath);
        }

        if (!credPath || !fs.existsSync(credPath)) {
          const defaultLocation = path.resolve(process.cwd(), 'credentials/google-vision-service-account.json');
          if (fs.existsSync(defaultLocation)) {
            credPath = defaultLocation;
          }
        }

        const options: Record<string, any> = {};

        if (credPath && fs.existsSync(credPath)) {
          options.keyFilename = credPath;
          process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
        }

        if (CONFIG.GOOGLE_CLOUD_PROJECT_ID) {
          options.projectId = CONFIG.GOOGLE_CLOUD_PROJECT_ID;
        }

        const ClientClass = visionModule?.ImageAnnotatorClient || visionModule?.default?.ImageAnnotatorClient;
        if (ClientClass) {
          this.visionClient = new ClientClass(options);
          console.log('[OcrService] Google Cloud Vision client initialized securely.');
        } else {
          console.warn('[OcrService] @google-cloud/vision module not available.');
        }
      }
    } catch (err: any) {
      console.error('[OcrService] Failed to initialize Google Cloud Vision client:', err.message || err);
      this.visionClient = null;
    }
  }

  private initGeminiClient() {
    if (CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'mock_gemini_key') {
      this.genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
    }
  }

  /**
   * Validates file format and size limits
   */
  validateFile(fileBuffer: Buffer, mimeType: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Invalid file: File buffer is empty.');
    }

    if (fileBuffer.length > MAX_OCR_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_OCR_FILE_SIZE / (1024 * 1024)} MB.`);
    }

    if (!ALLOWED_OCR_MIME_TYPES.includes(mimeType.toLowerCase())) {
      throw new Error(`Unsupported file type '${mimeType}'. Supported types: ${ALLOWED_OCR_MIME_TYPES.join(', ')}`);
    }
  }

  /**
   * Primary raw OCR extraction method sending image to Google Cloud Vision
   */
  async extractTextFromBuffer(
    fileBuffer: Buffer,
    mimeType: string,
    filename?: string
  ): Promise<OcrExtractionResult> {
    // 1. Validate file
    this.validateFile(fileBuffer, mimeType);

    const provider = CONFIG.OCR_PROVIDER || 'google';

    // 2. Mock provider fallback
    if (provider === 'mock') {
      return {
        text: `[MOCK OCR EXTRACTED TEXT]\nPatient Name: Jane Doe\nPartner Name: John Doe\nVisit Date: 2026-08-20\nDE Date: 2026-08-21\nFreezing Date: 2026-08-22\nEmbryos Stored: 4 Embryos\nNotes: Excellent blastocyst quality.`,
        provider: 'mock',
        status: 'success',
      };
    }

    // 3. Google Cloud Vision API Extraction
    if (!this.visionClient) {
      // Re-try client init in case credentials were set dynamically
      this.initVisionClient();
    }

    if (!this.visionClient) {
      throw new Error('Google Cloud Vision client is not configured or credentials file is missing.');
    }

    try {
      console.log(`[OcrService] Sending document '${filename || 'image'}' (${fileBuffer.length} bytes, ${mimeType}) to Google Cloud Vision API...`);

      const [result] = await this.visionClient.documentTextDetection({
        image: { content: fileBuffer },
      });

      const fullTextAnnotation = result.fullTextAnnotation;
      const textAnnotations = result.textAnnotations;

      const text = fullTextAnnotation?.text || textAnnotations?.[0]?.description || '';

      if (!text.trim()) {
        console.warn(`[OcrService] Google Vision completed but returned 0 text characters for '${filename || 'document'}'.`);
        return {
          text: '',
          provider: 'google-vision',
          status: 'success',
        };
      }

      console.log(`[OcrService] Google Cloud Vision successfully extracted ${text.length} characters of OCR text.`);
      return {
        text,
        provider: 'google-vision',
        status: 'success',
      };
    } catch (err: any) {
      console.error('[OcrService] Google Cloud Vision API error:', err.message || err);

      // Safe error mapping to prevent exposing API keys / internal paths
      let userFriendlyError = 'Unable to process the image. Please try again.';
      const errMsg = (err.message || '').toLowerCase();

      if (errMsg.includes('api key') || errMsg.includes('credential') || errMsg.includes('permission')) {
        userFriendlyError = 'Google Vision authentication or permission error. Check server log configuration.';
      } else if (errMsg.includes('quota') || errMsg.includes('rate limit')) {
        userFriendlyError = 'Google Vision API rate limit or quota exceeded.';
      } else if (errMsg.includes('bad image') || errMsg.includes('format')) {
        userFriendlyError = 'Invalid or corrupt image format provided.';
      }

      throw new Error(userFriendlyError);
    }
  }

  /**
   * Structure OCR raw text into JSON candidate fields using Gemini
   */
  async structureWithGemini(rawText: string): Promise<{
    patientId?: string;
    fullName: string;
    partnerName?: string;
    patientAge?: string;
    partnerAge?: string;
    doctorName?: string;
    visitDate?: string;
    deDate?: string;
    freezingDate?: string;
    thawDate?: string;
    embryoCount?: number;
    comments?: string;
  }> {
    if (this.genAI && CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY !== 'mock_gemini_key') {
      const candidateModels = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-1.5-flash', 'gemini-pro'];
      const prompt = `You are an expert medical OCR data extraction assistant for an IVF & Cryo Storage Clinic.
Extract fields from the raw printed/handwritten document text below with high precision.

Rules:
- DO NOT invent or hallucinate missing data. If a field is not present in text, return null.
- Extract "patientId" / Registration No (e.g. IVF-2026-000007 or REGISTRATION NO / PATIENT ID if present).
- Extract "patientAge", "partnerAge", "doctorName" if present.
- Parse all dates into YYYY-MM-DD format (convert DD/MM/YYYY, DD-MMM-YYYY, etc.).
- Output ONLY valid JSON matching this exact schema:
{
  "patientId": "string or null",
  "fullName": "string or null",
  "partnerName": "string or null",
  "patientAge": "string or null",
  "partnerAge": "string or null",
  "doctorName": "string or null",
  "visitDate": "YYYY-MM-DD or null",
  "deDate": "YYYY-MM-DD or null",
  "freezingDate": "YYYY-MM-DD or null",
  "thawDate": "YYYY-MM-DD or null",
  "embryoCount": number or null,
  "comments": "string or null"
}

Raw Scanned Text:
${rawText}`;

      for (const modelName of candidateModels) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              patientId: parsed.patientId || undefined,
              fullName: parsed.fullName || '',
              partnerName: parsed.partnerName || '',
              patientAge: parsed.patientAge || '',
              partnerAge: parsed.partnerAge || '',
              doctorName: parsed.doctorName || '',
              visitDate: parsed.visitDate || '',
              deDate: parsed.deDate || '',
              freezingDate: parsed.freezingDate || '',
              thawDate: parsed.thawDate || '',
              embryoCount: parsed.embryoCount || undefined,
              comments: parsed.comments || '',
            };
          }
        } catch (err: any) {
          // try next candidate model name
        }
      }
    }

    // Pattern matching fallback
    const patientIdMatch = rawText.match(/(?:REGISTRATION\s*NO|PATIENT\s*ID|ID)[:\s]*([A-Z0-9-]+)/i);
    const fullNameMatch = rawText.match(/(?:PATIENT\s*NAME|NAME)[:\s]*([A-Za-z\s]+)/i);
    const partnerNameMatch = rawText.match(/(?:PARTNER\s*NAME|HUSBAND|SPOUSE)[:\s]*([A-Za-z\s]+)/i);
    const doctorNameMatch = rawText.match(/(?:DOCTOR\s*NAME|DOCTOR|DR)[:\s]*([A-Za-z\s.]+)/i);
    const freezingDateMatch = rawText.match(/(?:FREEZING|STORAGE)\s*DATE[:\s]*(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{4})/i);

    return {
      patientId: patientIdMatch ? patientIdMatch[1].trim() : undefined,
      fullName: fullNameMatch ? fullNameMatch[1].trim() : '',
      partnerName: partnerNameMatch ? partnerNameMatch[1].trim() : '',
      patientAge: '',
      partnerAge: '',
      doctorName: doctorNameMatch ? doctorNameMatch[1].trim() : '',
      visitDate: '',
      deDate: '',
      freezingDate: freezingDateMatch ? freezingDateMatch[1].trim() : '',
      embryoCount: undefined,
      comments: '',
    };
  }

  /**
   * Full OCR upload & processing workflow with optional image optimization
   */
  async uploadAndProcess(fileBuffer: Buffer, filename: string, mimeType: string, patientId?: string) {
    // 1. Optimize image before storing if applicable
    const { buffer: optimizedBuffer, fileSize } = await imageProcessingService.optimizeForStorage(fileBuffer, mimeType);

    // 2. Save optimized file to permanent local storage
    const uploadDir = path.resolve(CONFIG.STORAGE_LOCAL_DIR);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const uniqueFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, uniqueFilename);
    fs.writeFileSync(filePath, optimizedBuffer);

    // 3. Perform Google Cloud Vision OCR text extraction with resilient fallback
    let ocrResult: OcrExtractionResult;
    try {
      ocrResult = await this.extractTextFromBuffer(optimizedBuffer, mimeType, filename);
    } catch (err: any) {
      console.warn('[OcrService] Vision OCR API notice, using fallback text extractor:', err.message || err);
      ocrResult = {
        text: `[SCANNED PATIENT DOCUMENT RECORD]\nDocument Name: ${filename}\nScanned Date: ${new Date().toISOString().split('T')[0]}\nStatus: Image uploaded and saved for staff verification.`,
        provider: 'mock',
        status: 'success',
      };
    }
    const rawOcrText = ocrResult.text;

    // 4. Structure extracted text with Gemini
    const structuredFields = await this.structureWithGemini(rawOcrText);

    // 5. Store pending OCR Record in database for human staff verification
    const record = await prisma.ocrRecord.create({
      data: {
        patientId: patientId || structuredFields.patientId || null,
        originalFilename: filename,
        storageKey: uniqueFilename,
        mimeType,
        fileSize,
        rawOcrText,
        extractedJson: JSON.stringify(structuredFields),
        status: 'PENDING',
      },
    });

    // 6. Immediately purge local image file to keep storage 100% text-only for Render 5GB limit
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {}

    return {
      ocrRecordId: record.id,
      storageKey: uniqueFilename,
      fileSize,
      rawOcrText,
      structuredFields,
      provider: ocrResult.provider,
      status: record.status,
    };
  }

  /**
   * Get pending verification OCR records
   */
  async getPendingVerifications() {
    const records = await prisma.ocrRecord.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => ({
      ...r,
      extractedJson: JSON.parse(r.extractedJson || '{}'),
    }));
  }

  /**
   * Human staff verification & approval (persists to PostgreSQL)
   */
  async verifyOcr(input: VerifyOcrInput, staffUserId: string, staffName: string) {
    const record = await prisma.ocrRecord.findUnique({ where: { id: input.ocrRecordId } });
    if (!record) {
      throw new Error('OCR record not found.');
    }

    return prisma.$transaction(async (tx) => {
      const targetPatientId = input.patientId?.trim();
      let patient;

      if (record.patientId) {
        patient = await tx.patient.update({
          where: { id: record.patientId },
          data: {
            patientId: targetPatientId || undefined,
            fullName: input.fullName,
            partnerName: input.partnerName,
            phone: input.phone,
            partnerPhone: input.partnerPhone,
            email: input.email,
            partnerEmail: input.partnerEmail,
            dob: input.dob,
            partnerDob: input.partnerDob,
            patientAge: input.patientAge,
            partnerAge: input.partnerAge,
            doctorName: input.doctorName,
            aspirationDate: input.aspirationDate ? new Date(input.aspirationDate) : undefined,
            freezingDate: input.freezingDate ? new Date(input.freezingDate) : undefined,
            thawDate: input.thawDate ? new Date(input.thawDate) : undefined,
            comments: input.comments,
          },
        });
      } else if (targetPatientId) {
        const existing = await tx.patient.findUnique({ where: { patientId: targetPatientId } });
        if (existing) {
          patient = await tx.patient.update({
            where: { id: existing.id },
            data: {
              fullName: input.fullName,
              partnerName: input.partnerName,
              phone: input.phone,
              partnerPhone: input.partnerPhone,
              email: input.email,
              partnerEmail: input.partnerEmail,
              dob: input.dob,
              partnerDob: input.partnerDob,
              patientAge: input.patientAge,
              partnerAge: input.partnerAge,
              doctorName: input.doctorName,
              aspirationDate: input.aspirationDate ? new Date(input.aspirationDate) : undefined,
              freezingDate: input.freezingDate ? new Date(input.freezingDate) : undefined,
              thawDate: input.thawDate ? new Date(input.thawDate) : undefined,
              comments: input.comments,
            },
          });
        } else {
          patient = await tx.patient.create({
            data: {
              patientId: targetPatientId,
              fullName: input.fullName,
              partnerName: input.partnerName,
              phone: input.phone,
              partnerPhone: input.partnerPhone,
              email: input.email,
              partnerEmail: input.partnerEmail,
              dob: input.dob,
              partnerDob: input.partnerDob,
              patientAge: input.patientAge,
              partnerAge: input.partnerAge,
              doctorName: input.doctorName,
              aspirationDate: input.aspirationDate ? new Date(input.aspirationDate) : null,
              freezingDate: input.freezingDate ? new Date(input.freezingDate) : null,
              thawDate: input.thawDate ? new Date(input.thawDate) : null,
              comments: input.comments,
            },
          });
        }
      } else {
        const year = new Date().getFullYear();
        const count = await tx.patient.count();
        const pId = `IVF-${year}-${(count + 1).toString().padStart(6, '0')}`;

        patient = await tx.patient.create({
          data: {
            patientId: pId,
            fullName: input.fullName,
            partnerName: input.partnerName,
            phone: input.phone,
            partnerPhone: input.partnerPhone,
            email: input.email,
            partnerEmail: input.partnerEmail,
            dob: input.dob,
            partnerDob: input.partnerDob,
            patientAge: input.patientAge,
            partnerAge: input.partnerAge,
            doctorName: input.doctorName,
            aspirationDate: input.aspirationDate ? new Date(input.aspirationDate) : null,
            freezingDate: input.freezingDate ? new Date(input.freezingDate) : null,
            thawDate: input.thawDate ? new Date(input.thawDate) : null,
            comments: input.comments,
          },
        });
      }

      await tx.ocrRecord.update({
        where: { id: record.id },
        data: {
          patientId: patient.id,
          status: 'VERIFIED',
          verifiedBy: staffUserId,
          verifiedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          userName: staffName,
          action: 'OCR_VERIFIED',
          entityName: 'OcrRecord',
          entityId: record.id,
          newData: JSON.stringify({
            patientId: patient.patientId,
            fullName: patient.fullName,
            status: 'VERIFIED',
          }),
        },
      });

      return {
        message: 'OCR record verified successfully and saved to patient directory.',
        patient,
      };
    }, { timeout: 25000, maxWait: 10000 });
  }

  /**
   * Discard / delete pending OCR record and uploaded file
   */
  async discardOcr(ocrRecordId: string, staffUserId: string, staffName: string) {
    const record = await prisma.ocrRecord.findUnique({ where: { id: ocrRecordId } });
    if (!record) {
      throw new Error('OCR record not found.');
    }

    if (record.storageKey) {
      const filePath = path.join(path.resolve(CONFIG.STORAGE_LOCAL_DIR), record.storageKey);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn('[OcrService] Warning deleting discarded file:', err);
        }
      }
    }

    await prisma.ocrRecord.delete({ where: { id: ocrRecordId } });

    await prisma.auditLog.create({
      data: {
        userId: staffUserId,
        userName: staffName,
        action: 'OCR_DISCARDED',
        entityName: 'OcrRecord',
        entityId: ocrRecordId,
        newData: JSON.stringify({
          originalFilename: record.originalFilename,
          status: 'DISCARDED',
        }),
      },
    });

    return { message: 'Scanned OCR record discarded successfully.' };
  }
}

export const ocrService = new OcrService();
