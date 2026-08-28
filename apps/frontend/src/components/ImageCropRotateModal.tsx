import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, RotateCw, Crop, Check, X, ZoomIn, ZoomOut, Upload, Move } from 'lucide-react';
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

  // Finger & Mouse Drag Pan State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch Pinch Zoom State
  const [pinchDist, setPinchDist] = useState<number | null>(null);
  const [pinchStartZoom, setPinchStartZoom] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imageFile) {
      setCurrentFile(imageFile);
      setZoom(1);
      setPan({ x: 0, y: 0 });
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
      setPan({ x: 0, y: 0 });
      setZoom(1);
    } catch (err) {
      console.error('Rotation failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mouse & Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Touch Gesture Drag & Pinch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchDist(dist);
      setPinchStartZoom(zoom);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / pinchDist;
      const newZoom = Math.min(3, Math.max(0.5, pinchStartZoom * scale));
      setZoom(newZoom);
    } else if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setPinchDist(null);
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

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      let targetW = imgWidth;
      let targetH = imgHeight;

      if (aspectMode === '1:1') {
        const cropSize = Math.min(imgWidth, imgHeight);
        targetW = cropSize;
        targetH = cropSize;
      }

      const scaleFactor = Math.max(0.2, zoom);
      const centerOffsetX = (pan.x / 120) * (imgWidth / 2);
      const centerOffsetY = (pan.y / 120) * (imgHeight / 2);

      let sourceW = targetW / scaleFactor;
      let sourceH = targetH / scaleFactor;
      let sourceX = (imgWidth - sourceW) / 2 - centerOffsetX;
      let sourceY = (imgHeight - sourceH) / 2 - centerOffsetY;

      // Clamp coordinates to natural image dimensions
      sourceX = Math.max(0, Math.min(imgWidth - sourceW, sourceX));
      sourceY = Math.max(0, Math.min(imgHeight - sourceH, sourceY));

      canvas.width = targetW;
      canvas.height = targetH;

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        0,
        0,
        targetW,
        targetH
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-3.5 sm:space-y-4 relative max-h-[96vh] flex flex-col my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <Crop className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate">{title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate flex items-center gap-1">
                <Move className="w-3 h-3 text-emerald-600 inline shrink-0" />
                <span>Drag image with finger to position • Pinch 2 fingers to zoom</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Finger Drag & Pinch Box */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 min-h-[240px] sm:min-h-[290px] max-h-[330px] sm:max-h-[380px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 p-2 sm:p-3 shadow-inner cursor-grab active:cursor-grabbing select-none touch-none"
        >
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2 z-30 text-white font-bold text-xs">
              <span className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing Crop...</span>
            </div>
          )}

          {/* Visual Gesture Instruction Overlay */}
          <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
            <span className="text-[10px] font-bold text-emerald-300 bg-slate-900/90 px-2.5 py-1 rounded-full border border-emerald-500/40 backdrop-blur-xs flex items-center gap-1 shadow-md">
              <Move className="w-3 h-3" />
              <span>Finger Drag to Pan & Adjust</span>
            </span>
          </div>

          <div className="relative overflow-hidden flex items-center justify-center max-w-full max-h-full">
            <img
              src={previewUrl}
              alt="Crop Preview"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                touchAction: 'none',
              }}
              className="max-h-[290px] sm:max-h-[340px] w-auto object-contain transition-transform duration-75 rounded-lg shadow-lg pointer-events-none"
            />

            {/* Visual 1:1 Square Crop Guidelines Overlay */}
            {aspectMode === '1:1' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="w-40 h-40 sm:w-52 sm:h-52 border-2 border-dashed border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] flex flex-col items-center justify-between p-2">
                  <div className="w-full flex justify-between">
                    <span className="w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                    <span className="w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold font-mono text-emerald-300 bg-slate-900/90 px-2 py-0.5 rounded-full border border-emerald-500/40 backdrop-blur-xs">
                    1:1 Profile Frame
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

        {/* Mobile Toolbar Controls */}
        <div className="space-y-2 bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200">
          {/* Rotate & Change Image Controls */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleRotate(-90)}
              disabled={isProcessing}
              className="py-2 px-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Rotate ↺</span>
            </button>
            <button
              type="button"
              onClick={() => handleRotate(90)}
              disabled={isProcessing}
              className="py-2 px-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Rotate ↻</span>
            </button>
            <label className="py-2 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-[11px] sm:text-xs rounded-xl border border-emerald-300 flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">Change Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCurrentFile(file);
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    const url = URL.createObjectURL(file);
                    setPreviewUrl(url);
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* Aspect Ratio & Zoom Controls */}
          <div className="flex items-center justify-between gap-2">
            {/* Aspect Ratio Modes */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs flex-1">
              <button
                type="button"
                onClick={() => setAspectMode('1:1')}
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${
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
                className={`flex-1 py-1 px-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${
                  aspectMode === 'FREE'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Image
              </button>
            </div>

            {/* Zoom Controls */}
            {/* <div className="flex items-center gap-1 shrink-0 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-lg border border-slate-200 active:scale-95 transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <span className="text-[11px] font-bold font-mono text-slate-700 w-9 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-lg border border-slate-200 active:scale-95 transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5 text-slate-700" />
              </button>
            </div> */}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 sm:py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropAndApply}
            disabled={isProcessing}
            className="flex-2 py-3 sm:py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>Confirm & Use Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
