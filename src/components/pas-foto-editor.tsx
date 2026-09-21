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
  UploadCloud,
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
  // Pilihan Ukuran
  const [selectedSizeId, setSelectedSizeId] = useState<PasFotoSizeId>('2x3');

  // Pengaturan
  const [settings, setSettings] = useState<PasFotoSettings>({
    showFrame: true,
    showGrid: true,
    quality: 'high',
  });

  // Transformasi Kanvas (Zoom, Rotate, Pan)
  const [transform, setTransform] = useState<TransformState>({
    zoom: 1,
    rotate: 0,
    panX: 0,
    panY: 0,
  });

  // State File & Gambar
  const [currentFile, setCurrentFile] = useState<File | null>(initialFile || null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialPreviewUrl || null);
  const [fileName, setFileName] = useState<string>(initialFile?.name || 'IMG_20250920_123456.jpg');
  const [fileSizeStr, setFileSizeStr] = useState<string>(
    initialFile ? (initialFile.size / (1024 * 1024)).toFixed(1) + ' MB' : '1.2 MB'
  );

  // Modal Lihat Ukuran
  const [showSizeModal, setShowSizeModal] = useState<boolean>(false);

  // Status Download / Loading
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Refs untuk interaksi Drag & Kanvas
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Cari opsi ukuran aktif
  const currentSizeOption: PasFotoSizeOption =
    PAS_FOTO_SIZES.find((s) => s.id === selectedSizeId) || PAS_FOTO_SIZES[0];

  // Helper untuk membuat sample image default jika user langsung membuka tab
  useEffect(() => {
    if (initialFile && initialPreviewUrl) {
      setCurrentFile(initialFile);
      setImageUrl(initialPreviewUrl);
      setFileName(initialFile.name);
      setFileSizeStr((initialFile.size / (1024 * 1024)).toFixed(1) + ' MB');
    } else if (!imageUrl) {
      // Buat sample portrait canvas dengan latar belakang biru pas foto jika belum ada foto
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Latar belakang biru pas foto standar
        const gradient = ctx.createLinearGradient(0, 0, 800, 1000);
        gradient.addColorStop(0, '#005bb5');
        gradient.addColorStop(1, '#004085');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 1000);

        // Badan / Jas Hitam
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(150, 1000);
        ctx.quadraticCurveTo(240, 680, 400, 680);
        ctx.quadraticCurveTo(560, 680, 650, 1000);
        ctx.closePath();
        ctx.fill();

        // Kemeja Putih & Dasi
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(350, 680);
        ctx.lineTo(450, 680);
        ctx.lineTo(400, 820);
        ctx.closePath();
        ctx.fill();

        // Dasi Hitam
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(390, 710);
        ctx.lineTo(410, 710);
        ctx.lineTo(420, 920);
        ctx.lineTo(400, 960);
        ctx.lineTo(380, 920);
        ctx.closePath();
        ctx.fill();

        // Leher
        ctx.fillStyle = '#f8d2b8';
        ctx.fillRect(365, 580, 70, 110);

        // Kepala / Wajah
        ctx.beginPath();
        ctx.ellipse(400, 480, 140, 180, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rambut
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(400, 360, 150, 100, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mata & Alis
        ctx.fillStyle = '#334155';
        ctx.fillRect(340, 460, 30, 8);
        ctx.fillRect(430, 460, 30, 8);
        ctx.beginPath();
        ctx.arc(355, 485, 8, 0, Math.PI * 2);
        ctx.arc(445, 485, 8, 0, Math.PI * 2);
        ctx.fill();

        // Hidung & Mulut
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

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImageUrl(dataUrl);
        setFileName('IMG_20250920_123456.jpg');
        setFileSizeStr('1.2 MB');
      }
    }
  }, [initialFile, initialPreviewUrl]);

  // Handler File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCurrentFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setFileName(file.name);
      setFileSizeStr((file.size / (1024 * 1024)).toFixed(1) + ' MB');
      setTransform({ zoom: 1, rotate: 0, panX: 0, panY: 0 });
      onFileSelect(file);
    }
  };

  // Reset Semua
  const handleFullReset = () => {
    setTransform({ zoom: 1, rotate: 0, panX: 0, panY: 0 });
    setSelectedSizeId('2x3');
    setSettings({ showFrame: true, showGrid: true, quality: 'high' });
    onReset();
  };

  // Zoom Controls
  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.min(Math.max(Number((prev.zoom + delta).toFixed(2)), 0.5), 3.0),
    }));
  };

  // Rotate Controls (Putar 90 Derajat atau 15 Derajat)
  const handleRotate = (angleDelta: number) => {
    setTransform((prev) => ({
      ...prev,
      rotate: (prev.rotate + angleDelta + 360) % 360,
    }));
  };

  // Pan Nudge Controls (Geser Posisi)
  const handlePanNudge = (deltaX: number) => {
    setTransform((prev) => ({
      ...prev,
      panX: prev.panX + deltaX,
    }));
  };

  // Drag Event Handlers (Mouse & Touch)
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

  // Touch Handlers
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

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleZoom(delta);
  };

  // Update Mini Preview Kanvas
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

  // Handler Download Hasil Foto
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
    <div className="w-full bg-white rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Buat Pas Foto
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Upload foto Anda, lalu atur posisi dan ukuran sesuai kebutuhan.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFullReset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-2xs self-end sm:self-auto cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* KOLOM KIRI (Sidebar Kiri: Stepper, File Foto, Pengaturan) */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {/* Vertical Stepper */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col gap-4">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs z-10">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div className="w-0.5 h-7 border-l-2 border-dashed border-blue-300 mt-1"></div>
              </div>
              <div className="flex flex-col pt-0.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  Upload Foto <Check className="w-3 h-3 text-blue-600 stroke-[3]" />
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Foto berhasil diunggah</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs z-10">
                  2
                </div>
                <div className="w-0.5 h-7 border-l-2 border-dashed border-slate-300 mt-1"></div>
              </div>
              <div className="flex flex-col pt-0.5">
                <span className="text-xs font-bold text-blue-600">Pilih Ukuran</span>
                <span className="text-[11px] text-slate-500 font-medium">{currentSizeOption.label}</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3">
              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center text-xs font-semibold z-10">
                  3
                </div>
                <div className="w-0.5 h-7 border-l-2 border-dashed border-slate-300 mt-1"></div>
              </div>
              <div className="flex flex-col pt-0.5">
                <span className="text-xs font-bold text-slate-700">Atur Posisi</span>
                <span className="text-[11px] text-slate-400 font-medium">Sesuaikan foto dengan frame</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-3">
              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center text-xs font-semibold z-10">
                  4
                </div>
              </div>
              <div className="flex flex-col pt-0.5">
                <span className="text-xs font-bold text-slate-700">Download</span>
                <span className="text-[11px] text-slate-400 font-medium">Simpan hasil foto</span>
              </div>
            </div>
          </div>

          {/* Card File Foto */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-800">File Foto</span>

            <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="File Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-400 m-auto mt-2.5" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                    {fileName}
                  </span>
                  <span className="text-[10px] text-slate-400">{fileSizeStr}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                title="Hapus / Pilih foto lain"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all shadow-2xs cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Ganti Foto</span>
            </button>
          </div>

          {/* Card Pengaturan */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3.5">
            <span className="text-xs font-bold text-slate-800">Pengaturan</span>

            {/* Toggle Tampilkan Frame */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-700 font-medium">Tampilkan frame</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showFrame}
                onClick={() => setSettings((s) => ({ ...s, showFrame: !s.showFrame }))}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                  settings.showFrame ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            {/* Toggle Bantuan Grid */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-700 font-medium">Bantuan grid</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showGrid}
                onClick={() => setSettings((s) => ({ ...s, showGrid: !s.showGrid }))}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                  settings.showGrid ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            {/* Dropdown Kualitas Hasil */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label htmlFor="kualitas-select" className="text-xs text-slate-700 font-medium">
                Kualitas hasil
              </label>
              <select
                id="kualitas-select"
                value={settings.quality}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, quality: e.target.value as PasFotoQuality }))
                }
                className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
              >
                <option value="high">Tinggi (Rekomendasi)</option>
                <option value="standard">Standar (150 DPI)</option>
                <option value="maximum">Maksimum (600 DPI)</option>
              </select>
            </div>
          </div>

          {/* Info Alert Tips Foto */}
          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/60 text-blue-900 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed text-[11px] text-blue-800/90 font-medium">
              Pastikan wajah terlihat jelas, tidak terpotong, dan pencahayaan cukup (tidak terlalu
              gelap atau terang).
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* KOLOM TENGAH (Interactive Canvas Studio & Kontrol Posisi) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Header Editor Posisi */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Atur Posisi Foto</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Geser, perbesar atau perkecil foto agar wajah berada di dalam frame ukuran yang ditentukan.
              </p>
            </div>
          </div>

          {/* Canvas Viewport Container */}
          <div className="relative w-full h-[380px] sm:h-[450px] bg-slate-100/90 rounded-2xl overflow-hidden flex items-center justify-center p-4 select-none border border-slate-200 shadow-inner">
            {/* Frame Cropping Area */}
            <div
              ref={frameRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{
                aspectRatio: `${currentSizeOption.widthMm} / ${currentSizeOption.heightMm}`,
                maxHeight: '100%',
                maxWidth: '100%',
              }}
              className="relative h-[340px] sm:h-[400px] overflow-hidden cursor-grab active:cursor-grabbing bg-slate-200 rounded-sm shadow-xl"
            >
              {/* Image Transform Layer */}
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
                    alt="Foto Pas Foto"
                    onLoad={updateMiniPreview}
                    className="max-w-none w-full h-full object-cover select-none"
                    draggable={false}
                  />
                </div>
              )}

              {/* OVERLAY: Frame Pembatas & Corner Handles Putih (Saat showFrame aktif) */}
              {settings.showFrame && (
                <div className="absolute inset-0 pointer-events-none border-2 border-white/80">
                  {/* Pojok Kiri Atas */}
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-white shadow-2xs" />
                  {/* Pojok Kanan Atas */}
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-white shadow-2xs" />
                  {/* Pojok Kiri Bawah */}
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-white shadow-2xs" />
                  {/* Pojok Kanan Bawah */}
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-white shadow-2xs" />
                </div>
              )}

              {/* OVERLAY: Grid Bantuan & Siluet Oval Wajah (Saat showGrid aktif) */}
              {settings.showGrid && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Crosshair Horizontal Line */}
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/60 -translate-y-1/2" />
                  {/* Crosshair Vertical Line */}
                  <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-white/60 -translate-x-1/2" />

                  {/* Siluet Oval Panduan Wajah Pas Foto Resmi */}
                  <div
                    style={{
                      width: '62%',
                      height: '56%',
                      top: '18%',
                    }}
                    className="absolute border-2 border-dashed border-white/75 rounded-[50%_50%_46%_46%] shadow-2xs flex flex-col items-center justify-end"
                  >
                    {/* Panduan Leher & Bahu */}
                    <div className="w-16 h-8 border-b-2 border-dashed border-white/50 -mb-7 rounded-b-xl" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls Toolbar Bawah Kanvas */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Zoom Group */}
            <div className="p-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleZoom(-0.1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Perkecil (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800">
                {Math.round(transform.zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoom(0.1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Perbesar (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Rotate Group */}
            <div className="p-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleRotate(-90)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Putar Kiri 90°"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-500">Putar</span>
              <button
                type="button"
                onClick={() => handleRotate(90)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Putar Kanan 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Position Nudge Group */}
            <div className="p-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <button
                type="button"
                onClick={() => handlePanNudge(-10)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Geser Kiri"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-500">Posisi</span>
              <button
                type="button"
                onClick={() => handlePanNudge(10)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Geser Kanan"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Info Banner Biru di Bawah Kanvas */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-700 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-[11px] font-medium">
              Area biru adalah area foto yang akan diambil sesuai ukuran pas foto yang dipilih.
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* KOLOM KANAN (Pilihan Ukuran Pas Foto, Preview & Download) */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Section: Pilih Ukuran Pas Foto */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Pilih Ukuran Pas Foto</h3>
            </div>

            <div className="flex flex-col gap-2.5">
              {PAS_FOTO_SIZES.map((size) => {
                const isSelected = size.id === selectedSizeId;
                return (
                  <div
                    key={size.id}
                    onClick={() => setSelectedSizeId(size.id)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/20 shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Radio Bullet */}
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                    </div>

                    {/* Avatar Silhouette Icon */}
                    <div className="w-9 h-12 bg-slate-100 rounded-md overflow-hidden flex flex-col items-center justify-end p-0.5 shrink-0 border border-slate-200">
                      <div className="w-3.5 h-4.5 rounded-full bg-slate-300 mb-0.5" />
                      <div className="w-7 h-4 rounded-t-lg bg-slate-300" />
                    </div>

                    {/* Detail Ukuran */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{size.label}</span>
                      </div>

                      <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono text-[10px]">cm</span>
                          <span>: {size.widthCmStr}</span>
                        </div>
                        {size.note && (
                          <span className="text-[10px] text-slate-400 -mt-0.5 pl-5">
                            {size.note}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono text-[10px]">mm</span>
                          <span>: {size.widthMmStr}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono text-[10px]">inch</span>
                          <span>: {size.widthInchStr}</span>
                        </div>
                      </div>
                    </div>

                    {/* Info Kegunaan Umum */}
                    <div className="hidden sm:flex flex-col text-right text-[10px] max-w-[95px] shrink-0 pt-0.5">
                      <span className="text-slate-400 font-medium">Kegunaan umum</span>
                      <span className="text-slate-600 font-semibold leading-tight mt-0.5">
                        {size.kegunaan}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Preview */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Preview</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSizeModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-medium transition-colors cursor-pointer"
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Lihat ukuran</span>
              </button>
            </div>

            {/* Preview Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-4">
                {/* Mini Preview Thumbnail Kanvas */}
                <div className="relative w-20 h-26 rounded-lg overflow-hidden border-2 border-dashed border-blue-400 bg-slate-50 flex items-center justify-center shrink-0">
                  <canvas ref={miniCanvasRef} className="w-full h-full object-cover" />
                </div>

                {/* Specs Info */}
                <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                  <span className="text-sm font-bold text-slate-900">
                    {currentSizeOption.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono text-[10px]">cm</span>
                    <span>: {currentSizeOption.widthCmStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono text-[10px]">mm</span>
                    <span>: {currentSizeOption.widthMmStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono text-[10px]">inch</span>
                    <span>: {currentSizeOption.widthInchStr}</span>
                  </div>
                </div>
              </div>

              {/* Status Posisi Wajah */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Posisi wajah</span>
                </div>
                <div className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sudah sesuai</span>
                </div>
              </div>
            </div>

            {/* Tombol Unduh Hasil Foto */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-lg shadow-slate-900/15 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Menyiapkan Foto...' : 'Unduh Hasil Foto'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog: Panduan Ukuran Pas Foto Resmi */}
      {showSizeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-blue-600" />
                <h4 className="text-base font-bold text-slate-900">
                  Panduan Ukuran Pas Foto Resmi
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSizeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Berikut adalah standar ukuran pas foto resmi di Indonesia beserta dokumen peruntukannya:
            </p>

            <div className="flex flex-col gap-3">
              {PAS_FOTO_SIZES.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-800">{item.label}</span>
                    <span className="text-[11px] font-semibold text-blue-600">{item.widthMmStr}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Dimensi: </span>
                    {item.widthCmStr} ({item.widthInchStr})
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    <span className="text-slate-400">Peruntukan: </span>
                    <strong className="text-slate-700">{item.kegunaan}</strong>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowSizeModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all mt-1 cursor-pointer"
            >
              Tutup Panduan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
