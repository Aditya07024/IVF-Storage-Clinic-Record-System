export interface OcrExtractionResult {
  text: string;
  provider: 'google-vision' | 'mock';
  status: 'success' | 'failed';
  error?: string;
}

export interface VerifyOcrInput {
  ocrRecordId: string;
  fullName: string;
  partnerName?: string;
  visitDate?: string;
  deDate?: string;
  freezingDate?: string;
  thawDate?: string;
  comments?: string;
}
