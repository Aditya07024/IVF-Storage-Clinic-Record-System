import React, { useState, useEffect } from 'react';
import { RotateCcw, RotateCw, Crop, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { rotateImageFile } from '../utils/imageUtils';

interface ImageCropRotateModalProps {
  isOpen: boolean;
  imageFile: File | null;
  title?: string;
  onClose: () => void;
  onConfirm: (processedFile: File, dataUrl: string) => void;
}

export const ImageCropRotateModal: React.FC<ImageCropRotateModalProps> = ({
  isOpen,
  imageFile,
  title = 'Crop & Rotate Photo Studio',
  onClose,
  onConfirm,
}) => {
  const [currentFile, setCurrentFile] = useState<File | null>(imageFile);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [aspectMode, setAspectMode] = useState<'1:1' | 'FREE'>('1:1');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (imageFile) {
      setCurrentFile(imageFile);
      setZoom(1);
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  if (!isOpen || !currentFile || !previewUrl) return null;

  const handleRotate = async (deg: number) => {
    setIsProcessing(true);
    try {
      const { file: rFile, dataUrl } = await rotateImageFile(currentFile, deg);
      setCurrentFile(rFile);
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Rotation failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCropAndApply = () => {
    if (!currentFile || !previewUrl) return;

    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        onConfirm(currentFile, previewUrl);
        onClose();
        return;
      }

      let cropWidth = img.naturalWidth;
      let cropHeight = img.naturalHeight;
      let startX = 0;
      let startY = 0;

      if (aspectMode === '1:1') {
        const minDim = Math.min(img.naturalWidth, img.naturalHeight);
        cropWidth = minDim;
        cropHeight = minDim;
        startX = (img.naturalWidth - minDim) / 2;
        startY = (img.naturalHeight - minDim) / 2;
      }

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(
        img,
        startX,
        startY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], `profile-crop-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onConfirm(croppedFile, croppedDataUrl);
        } else {
          onConfirm(currentFile, previewUrl);
        }
        setIsProcessing(false);
        onClose();
      }, 'image/jpeg', 0.95);
    };

    img.onerror = () => {
      setIsProcessing(false);
      onConfirm(currentFile, previewUrl);
      onClose();
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
              <p className="text-xs text-slate-500 font-medium">Rotate 90°, adjust crop frame, & confirm before saving</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview & Interactive Frame Box */}
        <div className="relative flex-1 min-h-[280px] max-h-[380px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 p-3 shadow-inner">
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-2 z-20 text-white font-bold text-xs">
              <span className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing Photo...</span>
            </div>
          )}

          <div className="relative overflow-hidden flex items-center justify-center max-w-full max-h-full">
            <img
              src={previewUrl}
              alt="Crop Preview"
              style={{ transform: `scale(${zoom})` }}
              className="max-h-[340px] w-auto object-contain transition-all duration-200 rounded-lg shadow-lg"
            />

            {/* Visual 1:1 Square Crop Guidelines Overlay */}
            {aspectMode === '1:1' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] flex flex-col items-center justify-between p-2">
                  <div className="w-full flex justify-between">
                    <span className="w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                    <span className="w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold font-mono text-emerald-300 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/40 backdrop-blur-xs">
                    1:1 Square Profile Crop
                  </span>
                  <div className="w-full flex justify-between">
                    <span className="w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                    <span className="w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          {/* Rotate Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleRotate(-90)}
              disabled={isProcessing}
              className="py-2 px-3.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              title="Rotate Left 90°"
            >
              <RotateCcw className="w-4 h-4 text-emerald-700" />
              <span>Rotate ↺</span>
            </button>
            <button
              type="button"
              onClick={() => handleRotate(90)}
              disabled={isProcessing}
              className="py-2 px-3.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              title="Rotate Right 90°"
            >
              <RotateCw className="w-4 h-4 text-emerald-700" />
              <span>Rotate ↻</span>
            </button>
          </div>

          {/* Aspect Ratio Modes */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
            <button
              type="button"
              onClick={() => setAspectMode('1:1')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                aspectMode === '1:1'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1:1 Square
            </button>
            <button
              type="button"
              onClick={() => setAspectMode('FREE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                aspectMode === 'FREE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Image
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="p-2 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-slate-700" />
            </button>
            <span className="text-xs font-bold font-mono text-slate-700 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-2 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropAndApply}
            disabled={isProcessing}
            className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>✓ Confirm & Use Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
