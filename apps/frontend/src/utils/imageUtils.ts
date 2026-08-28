/**
 * Rotate an image File by specified degrees (90, -90, 180).
 * Flips canvas dimensions dynamically when rotated 90° or 270°.
 */
export const rotateImageFile = (
  imageFile: File,
  rotationAngle: number // e.g. 90 or -90
): Promise<{ file: File; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error('Canvas context unavailable'));
      }

      // Calculate total angle normalized to 0, 90, 180, 270
      const normalizedAngle = ((rotationAngle % 360) + 360) % 360;
      const isRotatedQuarter = normalizedAngle === 90 || normalizedAngle === 270;

      // Set target canvas dimensions
      canvas.width = isRotatedQuarter ? img.height : img.width;
      canvas.height = isRotatedQuarter ? img.width : img.height;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalizedAngle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) return reject(new Error('Failed to create rotated blob'));

          const rotatedFile = new File([blob], imageFile.name || `photo-${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve({ file: rotatedFile, dataUrl });
        },
        'image/jpeg',
        0.92
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
};

/**
 * Auto-detect smartphone camera stream orientation and return an upright canvas.
 */
export const captureUprightCanvasFromVideo = (
  videoEl: HTMLVideoElement
): HTMLCanvasElement => {
  const vWidth = videoEl.videoWidth || 1280;
  const vHeight = videoEl.videoHeight || 720;
  const isScreenPortrait = window.innerHeight > window.innerWidth;
  const isVideoStreamLandscape = vWidth > vHeight;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // If phone is held in portrait mode but camera stream is landscape 1920x1080:
  // Auto-rotate 90° so photo matches screen orientation perfectly
  if (isScreenPortrait && isVideoStreamLandscape) {
    canvas.width = vHeight;
    canvas.height = vWidth;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(videoEl, 0, -vHeight);
    ctx.restore();
  } else {
    canvas.width = vWidth;
    canvas.height = vHeight;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  }

  return canvas;
};
