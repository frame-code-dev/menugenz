'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  Image as ImageIcon,
  Check,
  Info,
  X,
  ArrowLeftRight,
  Eye,
  Download,
  CheckCircle2,
  Ruler,
} from 'lucide-react';
import {
  PasFotoSizeId,
  PasFotoQuality,
  PasFotoSizeOption,
  PasFotoSettings,
  TransformState,
} from '@/types/pasfoto';
import { PAS_FOTO_SIZES, downloadCroppedPasFoto } from '@/lib/pasfoto';
import { useDialogLightDismiss } from '@/components/recipe-detail-dialog';

interface PasFotoEditorProps {
  initialFile?: File | null;
  initialPreviewUrl?: string | null;
  onFileSelect: (file: File) => void;
  onReset: () => void;
}

export const PasFotoEditor: React.FC<PasFotoEditorProps> = ({
  initialFile,
  initialPreviewUrl,
  onFileSelect,
  onReset,
}) => {
  const [selectedSizeId, setSelectedSizeId] = useState<PasFotoSizeId>('3x4');
  const [settings, setSettings] = useState<PasFotoSettings>({
    showFrame: true,
    showGrid: true,
    quality: 'high',
  });
  const [transform, setTransform] = useState<TransformState>({
    zoom: 1,
    rotate: 0,
    panX: 0,
    panY: 0,
  });

  const [imageUrl, setImageUrl] = useState<string | null>(initialPreviewUrl || null);
  const [fileName, setFileName] = useState<string>(initialFile?.name || 'Contoh_PasFoto.jpg');
  const [fileSizeStr, setFileSizeStr] = useState<string>(
    initialFile ? `${(initialFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Contoh bawaan'
  );
  const [hasUserPhoto, setHasUserPhoto] = useState<boolean>(Boolean(initialFile));
  const [showSizeModal, setShowSizeModal] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sizeDialogRef = useRef<HTMLDialogElement>(null);
  const ownedObjectUrlRef = useRef<string | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useDialogLightDismiss(sizeDialogRef, showSizeModal, () => setShowSizeModal(false));

  const currentSizeOption: PasFotoSizeOption =
    PAS_FOTO_SIZES.find((s) => s.id === selectedSizeId) || PAS_FOTO_SIZES[1];

  // Cleanup any locally created object URL on unmount
  useEffect(() => {
    return () => {
      if (ownedObjectUrlRef.current) {
        URL.revokeObjectURL(ownedObjectUrlRef.current);
        ownedObjectUrlRef.current = null;
      }
    };
  }, []);

  // Load initial file or generate neutral demo portrait canvas
  useEffect(() => {
    if (initialFile && initialPreviewUrl) {
      setImageUrl(initialPreviewUrl);
      setFileName(initialFile.name);
      setFileSizeStr(`${(initialFile.size / (1024 * 1024)).toFixed(1)} MB`);
      setHasUserPhoto(true);
      return;
    }

    if (!imageUrl) {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 800, 1000);
        gradient.addColorStop(0, '#0f4c81');
        gradient.addColorStop(1, '#09355c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 1000);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(150, 1000);
        ctx.quadraticCurveTo(240, 680, 400, 680);
        ctx.quadraticCurveTo(560, 680, 650, 1000);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(350, 680);
        ctx.lineTo(450, 680);
        ctx.lineTo(400, 820);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(390, 710);
        ctx.lineTo(410, 710);
        ctx.lineTo(420, 920);
        ctx.lineTo(400, 960);
        ctx.lineTo(380, 920);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f8d2b8';
        ctx.fillRect(365, 580, 70, 110);

        ctx.beginPath();
        ctx.ellipse(400, 480, 140, 180, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(400, 360, 150, 100, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.fillRect(340, 460, 30, 8);
        ctx.fillRect(430, 460, 30, 8);
        ctx.beginPath();
        ctx.arc(355, 485, 8, 0, Math.PI * 2);
        ctx.arc(445, 485, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#e29d7e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(400, 490);
        ctx.lineTo(400, 530);
        ctx.lineTo(410, 535);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(400, 565, 25, 0.2, Math.PI - 0.2);
        ctx.stroke();

        setImageUrl(canvas.toDataURL('image/jpeg', 0.9));
        setFileName('Contoh_PasFoto.jpg');
        setFileSizeStr('Contoh bawaan');
        setHasUserPhoto(false);
      }
    }
  }, [initialFile, initialPreviewUrl, imageUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (ownedObjectUrlRef.current) {
        URL.revokeObjectURL(ownedObjectUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      ownedObjectUrlRef.current = url;
      setImageUrl(url);
      setFileName(file.name);
      setFileSizeStr(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      setHasUserPhoto(true);
      setTransform({ zoom: 1, rotate: 0, panX: 0, panY: 0 });
      onFileSelect(file);
      e.target.value = '';
    }
  };

  const handleFullReset = () => {
    setTransform({ zoom: 1, rotate: 0, panX: 0, panY: 0 });
    setSelectedSizeId('3x4');
    setSettings({ showFrame: true, showGrid: true, quality: 'high' });
    onReset();
  };

  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.min(Math.max(Number((prev.zoom + delta).toFixed(2)), 0.5), 3.0),
    }));
  };

  const handleRotate = (angleDelta: number) => {
    setTransform((prev) => ({
      ...prev,
      rotate: (prev.rotate + angleDelta + 360) % 360,
    }));
  };

  const handlePanNudge = (deltaX: number) => {
    setTransform((prev) => ({
      ...prev,
      panX: prev.panX + deltaX,
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    panStartPos.current = { x: transform.panX, y: transform.panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    setTransform((prev) => ({
      ...prev,
      panX: panStartPos.current.x + dx,
      panY: panStartPos.current.y + dy,
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartPos.current = { x: transform.panX, y: transform.panY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartPos.current.x;
    const dy = e.touches[0].clientY - dragStartPos.current.y;
    setTransform((prev) => ({
      ...prev,
      panX: panStartPos.current.x + dx,
      panY: panStartPos.current.y + dy,
    }));
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleZoom(delta);
  };

  const updateMiniPreview = useCallback(() => {
    if (!miniCanvasRef.current || !imageRef.current || !frameRef.current) return;
    const canvas = miniCanvasRef.current;
    const img = imageRef.current;
    const frame = frameRef.current;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameRect = frame.getBoundingClientRect();
    const displayW = frameRect.width || 300;
    const displayH = frameRect.height || 400;

    canvas.width = 120;
    canvas.height = Math.round(120 / currentSizeOption.aspectRatio);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / displayW;
    const scaleY = canvas.height / displayH;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.translate(transform.panX * scaleX, transform.panY * scaleY);
    ctx.rotate((transform.rotate * Math.PI) / 180);
    ctx.scale(transform.zoom, transform.zoom);

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const frameAspect = displayW / displayH;
    let drawW: number;
    let drawH: number;

    if (imgAspect > frameAspect) {
      drawH = canvas.height;
      drawW = canvas.height * imgAspect;
    } else {
      drawW = canvas.width;
      drawH = canvas.width / imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [transform, currentSizeOption]);

  useEffect(() => {
    updateMiniPreview();
  }, [updateMiniPreview, imageUrl]);

  const handleDownload = async () => {
    if (!imageRef.current || !frameRef.current) return;
    try {
      setIsDownloading(true);
      const frameRect = frameRef.current.getBoundingClientRect();
      await downloadCroppedPasFoto(
        imageRef.current,
        currentSizeOption,
        transform,
        settings.quality,
        frameRect.width,
        frameRect.height,
        `PasFoto_${selectedSizeId}_${Date.now()}.jpg`
      );
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full bg-surface rounded-2xl p-4 sm:p-6 border border-border flex flex-col gap-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-700 text-white flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight">
              Studio Pas Foto
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted">
              Unggah foto, sesuaikan posisi wajah pada bingkai, lalu unduh siap cetak.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{hasUserPhoto ? 'Ganti Foto' : 'Upload Foto Anda'}</span>
          </button>
          <button
            type="button"
            onClick={handleFullReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-subtle hover:bg-border/60 border border-border text-ink text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 3-Column Studio Workspace (Canvas first on mobile!) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (Order 3 on mobile, 1 on desktop) */}
        <div className="order-3 lg:order-1 lg:col-span-3 flex flex-col gap-4">
          {/* Stepper */}
          <div className="p-4 rounded-2xl bg-subtle/60 border border-border flex flex-col gap-3.5">
            {[
              {
                num: '1',
                title: 'Upload Foto',
                sub: hasUserPhoto ? 'Foto siap diatur' : 'Pilih foto dari perangkat',
                done: hasUserPhoto,
                active: !hasUserPhoto,
              },
              {
                num: '2',
                title: 'Pilih Ukuran',
                sub: currentSizeOption.label,
                done: false,
                active: hasUserPhoto,
              },
              {
                num: '3',
                title: 'Atur Posisi',
                sub: 'Geser & zoom di bingkai',
                done: false,
                active: false,
              },
              {
                num: '4',
                title: 'Unduh Hasil',
                sub: 'Siap cetak 150–600 DPI',
                done: false,
                active: false,
              },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-2.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step.done
                      ? 'bg-forest-700 text-white'
                      : step.active
                      ? 'bg-terracotta-600 text-white'
                      : 'bg-surface border border-border text-ink-muted'
                  }`}
                >
                  {step.done ? (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    step.num
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-ink block">{step.title}</span>
                  <span className="text-[11px] text-ink-muted block">{step.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* File Card */}
          <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col gap-3">
            <span className="text-xs font-bold text-ink">File Foto</span>
            <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-subtle/60 border border-border">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-border/60 shrink-0 border border-border">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="Thumbnail foto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-ink-faint m-auto mt-2.5" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-ink truncate max-w-[130px]">
                    {fileName}
                  </span>
                  <span className="text-[11px] text-ink-faint">{fileSizeStr}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Card */}
          <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col gap-3.5">
            <span className="text-xs font-bold text-ink">Pengaturan Kanvas</span>

            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted font-medium">Tampilkan bingkai</span>
              <button
                type="button"
                role="switch"
                aria-label="Tampilkan bingkai"
                aria-checked={settings.showFrame}
                onClick={() => setSettings((s) => ({ ...s, showFrame: !s.showFrame }))}
                data-compact-target="true"
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.showFrame ? 'bg-forest-700 justify-end' : 'bg-border justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted font-medium">Panduan posisi wajah</span>
              <button
                type="button"
                role="switch"
                aria-label="Panduan posisi wajah"
                aria-checked={settings.showGrid}
                onClick={() => setSettings((s) => ({ ...s, showGrid: !s.showGrid }))}
                data-compact-target="true"
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  settings.showGrid ? 'bg-forest-700 justify-end' : 'bg-border justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <label htmlFor="kualitas-select" className="text-xs text-ink-muted font-medium">
                Resolusi cetak
              </label>
              <select
                id="kualitas-select"
                value={settings.quality}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, quality: e.target.value as PasFotoQuality }))
                }
                className="w-full text-xs font-semibold text-ink bg-subtle/70 border border-border rounded-xl px-3 py-2 outline-none focus:border-forest-700 cursor-pointer"
              >
                <option value="high">Tinggi (300 DPI — Rekomendasi)</option>
                <option value="standard">Standar (150 DPI)</option>
                <option value="maximum">Maksimum (600 DPI)</option>
              </select>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Interactive Canvas (Order 1 on mobile, 2 on desktop) */}
        <div className="order-1 lg:order-2 lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-subtle text-ink shrink-0">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Atur Posisi Foto</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Geser langsung di dalam bingkai atau gunakan kontrol zoom &amp; putar di bawah.
              </p>
            </div>
          </div>

          <div className="relative w-full h-[360px] sm:h-[430px] bg-subtle rounded-2xl overflow-hidden flex items-center justify-center p-4 select-none border border-border">
            <div
              ref={frameRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{
                aspectRatio: `${currentSizeOption.widthMm} / ${currentSizeOption.heightMm}`,
                maxHeight: '100%',
                maxWidth: '100%',
                touchAction: 'none',
              }}
              className="relative h-[320px] sm:h-[385px] overflow-hidden cursor-grab active:cursor-grabbing bg-ink/10 rounded-sm shadow-lg"
            >
              {imageUrl && (
                <div
                  style={{
                    transform: `translate(${transform.panX}px, ${transform.panY}px) rotate(${transform.rotate}deg) scale(${transform.zoom})`,
                    transformOrigin: 'center center',
                    transition: isDraggingRef.current ? 'none' : 'transform 0.05s ease-out',
                  }}
                  className="w-full h-full pointer-events-none flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Pratinjau Pas Foto"
                    onLoad={updateMiniPreview}
                    className="max-w-none w-full h-full object-cover select-none"
                    draggable={false}
                  />
                </div>
              )}

              {settings.showFrame && (
                <div className="absolute inset-0 pointer-events-none border-2 border-white/80">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-white" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-white" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-white" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-white" />
                </div>
              )}

              {settings.showGrid && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/60 -translate-y-1/2" />
                  <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-white/60 -translate-x-1/2" />
                  <div
                    style={{ width: '62%', height: '56%', top: '18%' }}
                    className="absolute border-2 border-dashed border-white/75 rounded-[50%_50%_46%_46%] flex flex-col items-center justify-end"
                  >
                    <div className="w-16 h-8 border-b-2 border-dashed border-white/50 -mb-7 rounded-b-xl" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-1.5 rounded-xl bg-surface border border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                aria-label="Perkecil foto"
                className="p-1.5 rounded-lg hover:bg-subtle text-ink transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="text-xs font-mono font-bold text-ink">
                {Math.round(transform.zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                aria-label="Perbesar foto"
                className="p-1.5 rounded-lg hover:bg-subtle text-ink transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-1.5 rounded-xl bg-surface border border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleRotate(-90)}
                aria-label="Putar kiri 90 derajat"
                className="p-1.5 rounded-lg hover:bg-subtle text-ink transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="text-xs font-medium text-ink-muted">Putar</span>
              <button
                type="button"
                onClick={() => handleRotate(90)}
                aria-label="Putar kanan 90 derajat"
                className="p-1.5 rounded-lg hover:bg-subtle text-ink transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-1.5 rounded-xl bg-surface border border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => handlePanNudge(-10)}
                aria-label="Geser ke kiri"
                className="p-1.5 rounded-lg hover:bg-subtle text-ink transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="text-xs font-medium text-ink-muted">Geser</span>
              <button
                type="button"
                onClick={() => handlePanNudge(10)}
                aria-label="Geser ke kanan"
                className="p-1.5 rounded-lg hover:bg-subtle text-ink transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-subtle/70 border border-border text-ink-muted text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Semua pemrosesan crop dilakukan langsung di browser perangkat Anda — foto tidak diunggah ke server.
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Size Options & Download (Order 2 on mobile, 3 on desktop) */}
        <div className="order-2 lg:order-3 lg:col-span-4 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-forest-700" aria-hidden="true" />
                <span>Pilih Ukuran Pas Foto</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSizeModal(true)}
                className="inline-flex items-center gap-1 text-xs text-forest-800 hover:underline font-semibold cursor-pointer"
              >
                <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Panduan</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {PAS_FOTO_SIZES.map((size) => {
                const isSelected = size.id === selectedSizeId;
                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSelectedSizeId(size.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-forest-700 bg-forest-50/50 ring-1 ring-forest-700'
                        : 'border-border bg-surface hover:bg-subtle/50'
                    }`}
                  >
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-forest-700' : 'border-ink-faint'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-forest-700" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">{size.label}</span>
                        <span className="text-[11px] font-mono text-ink-muted">
                          {size.widthMmStr}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-muted block mt-0.5">
                        {size.kegunaan}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview & Download */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-forest-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-ink">Pratinjau Hasil</h3>
            </div>

            <div className="p-4 rounded-2xl bg-subtle/50 border border-border flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-24 rounded-lg overflow-hidden border-2 border-dashed border-forest-600/60 bg-surface flex items-center justify-center shrink-0">
                  <canvas ref={miniCanvasRef} className="w-full h-full object-cover" />
                </div>

                <div className="flex flex-col gap-1 text-xs text-ink-muted">
                  <span className="text-sm font-bold text-ink">
                    {currentSizeOption.label}
                  </span>
                  <span className="font-mono text-[11px]">{currentSizeOption.widthCmStr}</span>
                  <span className="font-mono text-[11px]">{currentSizeOption.widthMmStr}</span>
                  <span className="inline-flex items-center gap-1 text-forest-800 font-semibold text-[11px] mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Siap diunduh</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>{isDownloading ? 'Menyiapkan Foto...' : 'Unduh Hasil Pas Foto'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Native <dialog>: Panduan Ukuran Pas Foto */}
      <dialog
        ref={sizeDialogRef}
        aria-labelledby="pasfoto-guide-title"
        className="app-dialog"
        {...({ closedby: 'any' } as Record<string, string>)}
      >
        <div className="bg-surface rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-border flex flex-col gap-4 text-ink">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Ruler className="w-5 h-5 text-forest-700" aria-hidden="true" />
              <h2 id="pasfoto-guide-title" className="text-base font-bold text-ink">
                Panduan Ukuran Pas Foto Resmi
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSizeModal(false)}
              aria-label="Tutup panduan ukuran"
              className="p-2 text-ink-muted hover:text-ink hover:bg-subtle rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Standar ukuran pas foto resmi di Indonesia beserta dokumen peruntukannya:
          </p>

          <div className="flex flex-col gap-2.5">
            {PAS_FOTO_SIZES.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-subtle/60 border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-ink">{item.label}</span>
                  <span className="text-xs font-mono font-semibold text-forest-800">
                    {item.widthMmStr}
                  </span>
                </div>
                <div className="text-xs text-ink-muted">
                  Dimensi: {item.widthCmStr} ({item.widthInchStr})
                </div>
                <div className="text-xs text-ink mt-0.5">
                  Peruntukan: <strong>{item.kegunaan}</strong>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowSizeModal(false)}
            className="w-full py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup Panduan
          </button>
        </div>
      </dialog>
    </div>
  );
};
