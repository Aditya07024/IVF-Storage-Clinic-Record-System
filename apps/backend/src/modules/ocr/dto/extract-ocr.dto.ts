export interface ExtractOcrDto {
  filename?: string;
  patientId?: string;
}

export const ALLOWED_OCR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/pdf',
];

export const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
