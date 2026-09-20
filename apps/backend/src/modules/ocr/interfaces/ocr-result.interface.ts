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
  specimenType?: string;
  cycleType?: string;
  donorName?: string;
  donorRegNo?: string;
  donorAge?: string;
  donorPhone?: string;
  vitrificationIndication?: string;
  oocyteStage?: string;
  aspirationDate?: string;
  freezingDate?: string;
  thawDate?: string;
  tankName?: string;
  canisterName?: string;
  visoTubeColor?: string;
  visoTubeId?: string;
  level?: string;
  straws?: Array<{
    strawId?: string;
    colorTag?: string;
    embryoCount?: number;
    grade?: string;
    fragmentation?: string;
    stage?: string;
    pgtTested?: boolean;
    aspirationDate?: string;
    freezingDate?: string;
    thawDate?: string;
  }>;
  comments?: string;
}
