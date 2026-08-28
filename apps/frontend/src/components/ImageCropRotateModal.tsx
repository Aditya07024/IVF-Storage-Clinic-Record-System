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
  title = 'Adjust Photo (Rotate & Preview)',
  onClose,
  onConfirm,
}) => {
  const [currentFile, setCurrentFile] = useState<File | null>(imageFile);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
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

  const handleApply = () => {
    if (currentFile && previewUrl) {
      onConfirm(currentFile, previewUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Crop className="w-5 h-5 text-emerald-600" />
            <span>{title}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview Window */}
        <div className="relative flex-1 min-h-[260px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 p-2">
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center z-10">
              <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={previewUrl}
            alt="Crop & Rotate Preview"
            style={{ transform: `scale(${zoom})` }}
            className="max-h-[350px] w-auto object-contain transition-all duration-200 rounded-lg"
          />
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          {/* Rotate Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleRotate(-90)}
              disabled={isProcessing}
              className="py-2 px-3.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 text-slate-700" />
              <span>Rotate ↺</span>
            </button>
            <button
              type="button"
              onClick={() => handleRotate(90)}
              disabled={isProcessing}
              className="py-2 px-3.5 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all disabled:opacity-50"
            >
              <RotateCw className="w-4 h-4 text-slate-700" />
              <span>Rotate ↻</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
              className="p-2 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-2xs active:scale-95 transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-slate-700" />
            </button>
            <span className="text-xs font-bold font-mono text-slate-700 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-2 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-300 shadow-2xs active:scale-95 transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>✓ Confirm & Use Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
