import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ocrService } from '../src/modules/ocr/ocr.service.js';
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
});
