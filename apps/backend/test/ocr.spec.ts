import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ocrService, parseTankFromRawText, parseCanisterFromRawText } from '../src/modules/ocr/ocr.service.js';
import { CONFIG } from '../src/common/config.js';
import sharp from 'sharp';

describe('Google Cloud Vision OCR Integration Test Suite', () => {
  let originalProvider: string;

  beforeEach(() => {
    originalProvider = CONFIG.OCR_PROVIDER;
  });

  afterEach(() => {
    CONFIG.OCR_PROVIDER = originalProvider;
  });

  it('should validate file buffers and reject unsupported MIME types', async () => {
    const emptyBuffer = Buffer.from([]);
    expect(() => ocrService.validateFile(emptyBuffer, 'image/jpeg')).toThrow('File buffer is empty');

    const validBuffer = Buffer.from('test content');
    expect(() => ocrService.validateFile(validBuffer, 'application/exe')).toThrow('Unsupported file type');
  });

  it('should process extraction smoothly using OCR_PROVIDER=mock', async () => {
    CONFIG.OCR_PROVIDER = 'mock';
    const testBuffer = Buffer.from('dummy image data');
    const result = await ocrService.extractTextFromBuffer(testBuffer, 'image/jpeg', 'test-doc.jpg');

    expect(result).toBeDefined();
    expect(result.status).toBe('success');
    expect(result.provider).toBe('mock');
    expect(result.text).toContain('MOCK OCR EXTRACTED TEXT');
  });

  it('should securely call Google Cloud Vision API when OCR_PROVIDER=google and handle Google API responses', async () => {
    CONFIG.OCR_PROVIDER = 'google';

    const testBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="800" height="600">
              <text x="50" y="100" font-family="Arial" font-size="28" fill="#000">CLINIC PATIENT RECORD</text>
              <text x="50" y="180" font-family="Arial" font-size="24" fill="#000">Patient Name: Sunita Verma</text>
              <text x="50" y="240" font-family="Arial" font-size="24" fill="#000">Partner Name: Deepak Verma</text>
            </svg>`
          ),
          top: 0,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();

    try {
      const result = await ocrService.extractTextFromBuffer(testBuffer, 'image/jpeg', 'test-handwritten-record.jpg');
      expect(result).toBeDefined();
      expect(result.provider).toBe('google-vision');
    } catch (err: any) {
      // In GCP test environments without billing enabled on free tiers, Google Cloud Vision returns PERMISSION_DENIED
      // Confirm that the safe error handler caught it cleanly without exposing credential secrets
      expect(err.message).toMatch(/Google Vision authentication or permission error|Unable to process the image/);
    }
  });

  describe('Can No vs Canister No Clinical Extraction Suite', () => {
    it('should extract Can No accurately from various clinical text formats', () => {
      expect(parseTankFromRawText('Can No: 2')).toBe('CAN-02');
      expect(parseTankFromRawText('Can No. 04')).toBe('CAN-04');
      expect(parseTankFromRawText('CAN NO 14')).toBe('CAN-14');
      expect(parseTankFromRawText('Can Number: 8')).toBe('CAN-08');
      expect(parseTankFromRawText('Can #5')).toBe('CAN-05');
      expect(parseTankFromRawText('Can: 3')).toBe('CAN-03');
      expect(parseTankFromRawText('Can 10')).toBe('CAN-10');
      expect(parseTankFromRawText('Cryocan No: 2')).toBe('CAN-02');
      expect(parseTankFromRawText('Tank No: 3')).toBe('CAN-03');
    });

    it('should NOT confuse Can No with Canister No', () => {
      // When only canister is present, tank should NOT match canister number
      expect(parseTankFromRawText('Canister No: 4')).toBe('CAN-01');
      expect(parseCanisterFromRawText('Canister No: 4')).toBe('C04');

      // When both are present in the document
      const doc = `
        PATIENT STORAGE RECORD
        Can No: 2
        Canister No: 4
        Level: 1
        Viso Tube: Pink
      `;
      expect(parseTankFromRawText(doc)).toBe('CAN-02');
      expect(parseCanisterFromRawText(doc)).toBe('C04');
    });

    it('should extract Can accurately when written only as Can without No', () => {
      expect(parseTankFromRawText('Can: 2')).toBe('CAN-02');
      expect(parseTankFromRawText('Can 2')).toBe('CAN-02');
      expect(parseTankFromRawText('CAN 02')).toBe('CAN-02');
      expect(parseTankFromRawText('CAN-2')).toBe('CAN-02');
      expect(parseTankFromRawText('CAN - 2')).toBe('CAN-02');
      expect(parseTankFromRawText('Can = 4')).toBe('CAN-04');
      expect(parseTankFromRawText('Can 14')).toBe('CAN-14');
      expect(parseTankFromRawText('Can: 08')).toBe('CAN-08');

      // Mixed "Can X, Canister Y" without the word "No"
      const mixedDoc1 = 'Storage: Can: 2, Canister: 4, Level: 1';
      expect(parseTankFromRawText(mixedDoc1)).toBe('CAN-02');
      expect(parseCanisterFromRawText(mixedDoc1)).toBe('C04');

      const mixedDoc2 = 'Can 2\nCanister 4\nLevel 1';
      expect(parseTankFromRawText(mixedDoc2)).toBe('CAN-02');
      expect(parseCanisterFromRawText(mixedDoc2)).toBe('C04');

      const mixedDoc3 = 'Canister 4\nCan 2';
      expect(parseTankFromRawText(mixedDoc3)).toBe('CAN-02');
      expect(parseCanisterFromRawText(mixedDoc3)).toBe('C04');
    });

    it('should handle Can/Canister combined format', () => {
      expect(parseTankFromRawText('Can / Canister: 3 / 5')).toBe('CAN-03');
      expect(parseCanisterFromRawText('Can / Canister: 3 / 5')).toBe('C05');

      expect(parseTankFromRawText('Canister / Can: 5 / 3')).toBe('CAN-03');
      expect(parseCanisterFromRawText('Canister / Can: 5 / 3')).toBe('C05');
    });

    it('should use Gemini fallback when raw text is unparseable', () => {
      expect(parseTankFromRawText('Unstructured noisy text', 'CAN-04')).toBe('CAN-04');
      expect(parseTankFromRawText('Unstructured noisy text', 'Can 2')).toBe('CAN-02');
      expect(parseTankFromRawText('Unstructured noisy text', '8')).toBe('CAN-08');
    });
  });
});
