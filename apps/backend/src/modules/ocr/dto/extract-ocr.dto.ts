export interface ExtractOcrDto {
  filename?: string;
  patientId?: string;
}

export const ALLOWED_OCR_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/bmp',
  'image/gif',
  'application/pdf',
];

export const MAX_OCR_FILE_SIZE = 15 * 1024 * 1024; // 15 MB limit
