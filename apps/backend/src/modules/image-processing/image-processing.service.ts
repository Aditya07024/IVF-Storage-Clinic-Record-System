import sharp from 'sharp';

export class ImageProcessingService {
  /**
   * Optimizes an image for permanent storage and high handwriting readability:
   * - Validates image format.
   * - Resizes if width > 2000px.
   * - Compresses images larger than ~2MB while maintaining high contrast & readability (quality 85).
   * - Preserves original image untouched for HEIC/HEIF or images already <= 2MB.
   */
  async optimizeForStorage(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ buffer: Buffer; optimized: boolean; fileSize: number }> {
    const initialSize = fileBuffer.length;

    // HEIC/HEIF or non-raster image formats
    const cleanMime = mimeType.toLowerCase();
    if (!cleanMime.startsWith('image/') || cleanMime.includes('heic') || cleanMime.includes('heif')) {
      return { buffer: fileBuffer, optimized: false, fileSize: initialSize };
    }

    const TWO_MB = 2 * 1024 * 1024;

    try {
      const metadata = await sharp(fileBuffer).metadata();
      const needsResize = (metadata.width || 0) > 2000;
      const needsCompression = initialSize > TWO_MB;

      if (!needsResize && !needsCompression) {
        return { buffer: fileBuffer, optimized: false, fileSize: initialSize };
      }

      let pipeline = sharp(fileBuffer);

      if (needsResize) {
        pipeline = pipeline.resize({ width: 2000, withoutEnlargement: true });
      }

      let optimizedBuffer: Buffer;
      if (cleanMime === 'image/png') {
        optimizedBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      } else if (cleanMime === 'image/webp') {
        optimizedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
      } else {
        optimizedBuffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      }

      if (optimizedBuffer.length > initialSize && !needsResize) {
        return { buffer: fileBuffer, optimized: false, fileSize: initialSize };
      }

      return {
        buffer: optimizedBuffer,
        optimized: true,
        fileSize: optimizedBuffer.length,
      };
    } catch (err: any) {
      console.log('[ImageProcessingService] Keeping original image buffer:', err.message || err);
      return { buffer: fileBuffer, optimized: false, fileSize: initialSize };
    }
  }
}

export const imageProcessingService = new ImageProcessingService();
