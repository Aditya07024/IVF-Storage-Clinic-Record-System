export interface OcrExtractionResult {
  text: string;
  provider: 'google-vision' | 'google-vision-rest' | 'gemini-vision' | 'mock';
  status: 'success' | 'failed';
  error?: string;
}

export interface VerifyOcrInput {
  ocrRecordId: string;
  patientId?: string;
  fullName: string;
  partnerName?: string;
  phone?: string;
  partnerPhone?: string;
  email?: string;
  partnerEmail?: string;
  dob?: string;
  partnerDob?: string;
  patientAge?: string;
  partnerAge?: string;
  doctorName?: string;
  aspirationDate?: string;
  freezingDate?: string;
  thawDate?: string;
  comments?: string;
}
