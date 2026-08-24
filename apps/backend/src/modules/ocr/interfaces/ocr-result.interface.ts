export interface OcrExtractionResult {
  text: string;
  provider: 'google-vision' | 'mock';
  status: 'success' | 'failed';
  error?: string;
}

export interface VerifyOcrInput {
  ocrRecordId: string;
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
  comments?: string;
}
