import sharp from 'sharp';

export class ImageProcessingService {
  /**
   * Optimizes an image for permanent storage and high handwriting readability:
   * - Validates image format.
   * - Resizes if width > 2000px.
   * - Compresses images larger than ~2MB while maintaining high contrast & readability (quality 85).
   * - Preserves original image untouched if already <= 2MB and within dimensions.
   */
  async optimizeForStorage(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ buffer: Buffer; optimized: boolean; fileSize: number }> {
    if (!mimeType.startsWith('image/')) {
      return { buffer: fileBuffer, optimized: false, fileSize: fileBuffer.length };
    }

    const TWO_MB = 2 * 1024 * 1024;
    const initialSize = fileBuffer.length;

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
      if (mimeType === 'image/png') {
        optimizedBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      } else if (mimeType === 'image/webp') {
        optimizedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
      } else {
        optimizedBuffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      }

      // If optimization resulted in larger file size and no resize occurred, return original
      if (optimizedBuffer.length > initialSize && !needsResize) {
        return { buffer: fileBuffer, optimized: false, fileSize: initialSize };
      }

      return {
        buffer: optimizedBuffer,
        optimized: true,
        fileSize: optimizedBuffer.length,
      };
    } catch (err) {
      console.warn('[ImageProcessingService] Optimization warning, keeping original buffer:', err);
      return { buffer: fileBuffer, optimized: false, fileSize: initialSize };
    }
  }
}

export const imageProcessingService = new ImageProcessingService();
