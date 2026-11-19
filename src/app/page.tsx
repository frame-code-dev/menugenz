'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Utensils,
  CalendarRange,
  Receipt,
  Camera,
  AlertCircle,
  Clock,
  ShieldCheck,
  Github,
  Globe,
  Linkedin,
  Coffee,
  ArrowRight,
  RotateCw,
} from 'lucide-react';
import { MenuUploader } from '@/components/menu-uploader';
import { ImagePreview } from '@/components/image-preview';
import { LoadingState } from '@/components/loading-state';
import { CaptionEditor } from '@/components/caption-editor';
import { WhatsAppForm } from '@/components/whatsapp-form';
import { ReceiptBreakdown } from '@/components/receipt-breakdown';
import { PasFotoEditor } from '@/components/pas-foto-editor';
import { SupportModal } from '@/components/support-modal';
import { MbgRecommender } from '@/components/mbg-recommender';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { CaptionStyle, MenuResult } from '@/types/menu';
import { AppMode, ReceiptResult } from '@/types/receipt';
import { DailyMenuPlan } from '@/types/recommendation';
import { analyzeMenuImage, analyzeReceiptImage } from '@/lib/api';
import { generateCaption } from '@/lib/caption';
import { generateReceiptCaption } from '@/lib/receipt';
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  isImageFile,
  isVideoFile,
} from '@/lib/video';
import { MEAL_CATEGORIES } from '@/lib/mbg-menus';
import { APP_VERSION_TAG } from '@/lib/version';

const NAV_ITEMS: {
  id: AppMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'menu', label: 'Caption Menu', shortLabel: 'Caption', icon: Utensils },
  {
    id: 'recommend',
    label: 'Rekomendasi MBG',
    shortLabel: 'Menu MBG',
    icon: CalendarRange,
  },
  { id: 'receipt', label: 'Baca Struk', shortLabel: 'Struk', icon: Receipt },
  { id: 'pasfoto', label: 'Pas Foto', shortLabel: 'Pas Foto', icon: Camera },
];

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('menu');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoExtractProgress, setVideoExtractProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [menuResult, setMenuResult] = useState<MenuResult | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('formal_santai');
  const [caption, setCaption] = useState<string>('');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const analyzeLockRef = useRef(false);

  const isSelectedVideo = Boolean(selectedFile && isVideoFile(selectedFile));

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoExtractProgress(null);
    setErrorMessage(null);
    setIsRateLimited(false);
    setMenuResult(null);
    setReceiptResult(null);
    setCaption('');
  };

  const handleModeChange = (newMode: AppMode) => {
    if (newMode === mode || loading) return;
    setMode(newMode);
    if (newMode === 'recommend') {
      setErrorMessage(null);
      setIsRateLimited(false);
    } else {
      // Prevent cross-workspace state bleed (e.g. menu video leaking into Pas Foto)
      resetState();
    }
  };

  const handleFileSelect = (file: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setVideoExtractProgress(null);
    setErrorMessage(null);
    setIsRateLimited(false);
    setMenuResult(null);
    setReceiptResult(null);
    setCaption('');
  };

  const handleReplaceFile = (file: File) => {
    const allowVideo = mode === 'menu';
    const isImg = isImageFile(file);
    const isVid = allowVideo && isVideoFile(file);

    if (!isImg && !isVid) {
      setErrorMessage(
        allowVideo
          ? 'Format tidak didukung. Pilih foto (JPG, PNG, WEBP) atau video (MP4, MOV, WEBM).'
          : 'Format gambar struk harus JPG, JPEG, PNG, atau WEBP.'
      );
      return;
    }

    if (isImg && file.size > IMAGE_MAX_BYTES) {
      setErrorMessage('Ukuran foto maksimal 10 MB.');
      return;
    }

    if (isVid && file.size > VIDEO_MAX_BYTES) {
      setErrorMessage('Ukuran video maksimal 50 MB.');
      return;
    }

    handleFileSelect(file);
  };

  const handleRemoveMedia = () => {
    resetState();
  };

  const handleCaptionStyleChange = (nextStyle: CaptionStyle) => {
    setCaptionStyle(nextStyle);
    if (menuResult) {
      setCaption(generateCaption(menuResult, nextStyle));
    }
  };

  const handleUseRecommendedDayAsCaption = (
    day: DailyMenuPlan,
    targetGroupLabel: string,
    dateIso?: string
  ) => {
    resetState();
    const dishes = MEAL_CATEGORIES.map((c) => day.meals[c.key]?.name).filter(
      (n): n is string => Boolean(n)
    );
    const synthesized: MenuResult = {
      date: dateIso || null,
      recipients: [targetGroupLabel],
      menus: dishes,
      closingNote: `Perpaduan ${day.meals.protein?.name || 'protein pilihan'}, ${
        day.meals.sayuran?.name || 'sayuran segar'
      }, dan buah ${
        day.meals.buah?.name || 'segar'
      } hari ini disiapkan agar asupan gizi harian tetap seimbang dan nyaman disantap. Semoga santapan hari ini disukai dan bermanfaat untuk aktivitas belajar bersama.`,
    };
    setMenuResult(synthesized);
    setCaptionStyle('formal_santai');
    setCaption(generateCaption(synthesized, 'formal_santai'));
    setMode('menu');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || analyzeLockRef.current) return;

    analyzeLockRef.current = true;
    setLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);
    setVideoExtractProgress(isVideoFile(selectedFile) ? 5 : null);

    try {
      if (mode === 'menu') {
        const result = await analyzeMenuImage(selectedFile, {
          onVideoExtractProgress: (pct) => setVideoExtractProgress(pct),
        });

        if (result.success && result.data) {
          setMenuResult(result.data);
          const generated = generateCaption(result.data, captionStyle);
          setCaption(generated);
        } else {
          if (result.isRateLimited) {
            setIsRateLimited(true);
          }
          setErrorMessage(
            result.message ||
              'AI gagal membaca media menu. Pastikan foto atau video terlihat terang dan jelas.'
          );
        }
      } else if (mode === 'receipt') {
        const result = await analyzeReceiptImage(selectedFile);

        if (result.success && result.data) {
          setReceiptResult(result.data);
          const generated = generateReceiptCaption(result.data);
          setCaption(generated);
        } else {
          if (result.isRateLimited) {
            setIsRateLimited(true);
          }
          setErrorMessage(
            result.message ||
              'AI gagal membaca struk belanja. Pastikan foto struk terlihat jelas dan cukup cahaya.'
          );
        }
      }
    } finally {
      analyzeLockRef.current = false;
      setLoading(false);
      setVideoExtractProgress(null);
    }
  };

  const hasResult = Boolean(menuResult || receiptResult);

  return (
    <div className="min-h-screen bg-canvas flex flex-col pb-24 md:pb-10">
      {/* Compact Sticky Top App Bar */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border pwa-safe-top no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Mark */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-forest-700 text-white flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold text-ink tracking-tight leading-none">
                  MenuGenZ
                </span>
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(true)}
                  data-compact-target="true"
                  title={`Versi aplikasi ${APP_VERSION_TAG} — lihat catatan pembaruan`}
                  className="px-1.5 py-0.5 rounded-md bg-forest-50 hover:bg-forest-100 border border-forest-100 text-forest-800 font-mono text-[10px] font-bold leading-none transition-colors cursor-pointer"
                >
                  {APP_VERSION_TAG}
                </button>
              </div>
              <span className="text-[11px] text-ink-muted block mt-0.5 truncate">
                Asisten Menu MBG &amp; Dapur
              </span>
            </div>
          </div>

          {/* Desktop Navigation (<nav>, not ARIA tablist) */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModeChange(item.id)}
                  disabled={loading}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                    active
                      ? 'text-forest-800 bg-forest-50'
                      : 'text-ink-muted hover:text-ink hover:bg-subtle'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-[13px] h-[3px] bg-forest-700 rounded-t-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Utility Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallButton />
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              aria-label="Info pengembang dan traktir kopi"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-subtle hover:bg-border/60 border border-border text-ink text-xs font-semibold transition-colors cursor-pointer"
            >
              <Coffee className="w-3.5 h-3.5 text-terracotta-600" aria-hidden="true" />
              <span className="hidden sm:inline">Info &amp; Kopi</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full px-4 sm:px-6 pt-5 sm:pt-7">
        <div
          className={`${
            mode === 'pasfoto' || mode === 'recommend' ? 'max-w-6xl' : 'max-w-4xl'
          } mx-auto transition-all duration-200`}
        >
          {/* Concise Contextual Mode Heading (for menu & receipt) */}
          {(mode === 'menu' || mode === 'receipt') && (
            <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-terracotta-700">
                  {mode === 'receipt' ? 'OCR Nota & Belanja' : 'Foto & Video ke Copywriting'}
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight mt-0.5">
                  {mode === 'receipt'
                    ? 'Baca Struk & Rincian Belanja'
                    : 'Buat Caption Menu MBG'}
                </h1>
                <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
                  {mode === 'receipt'
                    ? 'Ekstrak daftar barang, kuantitas, dan total belanja ke laporan WhatsApp siap kirim.'
                    : 'Unggah foto atau video menu — AI menyusun caption formal santai bergaya copywriter.'}
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 text-xs text-forest-800 bg-forest-50 border border-forest-100 px-3 py-1.5 rounded-xl self-start sm:self-auto shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-forest-700 shrink-0" aria-hidden="true" />
                <span>Tanpa simpan data</span>
              </div>
            </div>
          )}

          {/* Mode Views */}
          {mode === 'recommend' ? (
            <MbgRecommender onUseDayAsCaption={handleUseRecommendedDayAsCaption} />
          ) : mode === 'pasfoto' ? (
            <PasFotoEditor
              initialFile={selectedFile && isImageFile(selectedFile) ? selectedFile : null}
              initialPreviewUrl={selectedFile && isImageFile(selectedFile) ? previewUrl : null}
              onFileSelect={handleFileSelect}
              onReset={resetState}
            />
          ) : (
            <div className="bg-surface rounded-2xl p-4 sm:p-7 border border-border flex flex-col gap-6">
              {/* Step 1: Upload or Preview (Hidden if synthesized caption from Recommender has no media yet, show compact option to attach media) */}
              {!previewUrl ? (
                <MenuUploader
                  onFileSelect={handleFileSelect}
                  disabled={loading || isRateLimited}
                  mode={mode}
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <ImagePreview
                    previewUrl={previewUrl}
                    file={selectedFile}
                    isVideo={isSelectedVideo}
                    label={
                      mode === 'receipt'
                        ? 'Pratinjau Foto Struk'
                        : isSelectedVideo
                        ? 'Pratinjau Video Menu'
                        : 'Pratinjau Foto Menu'
                    }
                    onReplace={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept =
                        mode === 'menu'
                          ? 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm'
                          : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
                      input.onchange = (e: Event) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files && files[0]) handleReplaceFile(files[0]);
                      };
                      input.click();
                    }}
                    onRemove={handleRemoveMedia}
                    disabled={loading}
                  />

                  {!hasResult && !loading && (
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={isRateLimited}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm sm:text-base transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>
                        {mode === 'receipt'
                          ? 'Baca Struk & Buat Laporan'
                          : isSelectedVideo
                          ? 'Analisis Video & Buat Caption'
                          : 'Analisis Foto & Buat Caption'}
                      </span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              {/* Loading Indicator */}
              <LoadingState
                isLoading={loading}
                mode={mode}
                isVideo={isSelectedVideo}
                extractProgress={videoExtractProgress}
              />

              {/* Rate Limit Notice */}
              {isRateLimited && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h3 className="font-bold text-amber-950">
                        Batas Kuota AI Sementara Tercapai
                      </h3>
                      <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                        {errorMessage ||
                          'Batas penggunaan AI sementara telah tercapai. Tunggu beberapa saat lalu coba kembali.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              )}

              {/* General Error */}
              {errorMessage && !isRateLimited && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className="w-5 h-5 shrink-0 text-rose-600 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{errorMessage}</span>
                  </div>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Coba Lagi</span>
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Result, Breakdown, Copywriter Caption Editor & WhatsApp Share */}
              {hasResult && (
                <div className="flex flex-col gap-6 pt-5 border-t border-border">
                  {mode === 'receipt' && receiptResult && (
                    <ReceiptBreakdown data={receiptResult} caption={caption} />
                  )}

                  <CaptionEditor
                    caption={caption}
                    onChange={setCaption}
                    onReanalyze={selectedFile ? handleAnalyze : undefined}
                    disabled={loading}
                    captionStyle={captionStyle}
                    onStyleChange={mode === 'menu' ? handleCaptionStyleChange : undefined}
                    menuResult={mode === 'menu' ? menuResult : null}
                    sourceFileName={selectedFile?.name}
                    title={
                      mode === 'receipt'
                        ? 'Draft Laporan Belanja WhatsApp'
                        : 'Draft Caption Copywriter'
                    }
                  />

                  <WhatsAppForm
                    caption={caption}
                    imageFile={selectedFile}
                    previewUrl={previewUrl}
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          )}

          {/* Restrained Editorial Footer */}
          <footer className="mt-10 pt-6 border-t border-border text-xs text-ink-muted flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" aria-hidden="true" />
              <span>
                MenuGenZ memproses media secara real-time tanpa menyimpan foto, video, atau data pengguna.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(true)}
                data-compact-target="true"
                className="font-mono font-semibold text-forest-800 hover:underline cursor-pointer"
              >
                {APP_VERSION_TAG}
              </button>
              <span className="text-border">•</span>
              <span>
                Oleh <strong className="text-ink">rifjan29</strong>
              </span>
              <span className="text-border">•</span>
              <a
                href="https://github.com/rifjan29"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-forest-800 font-medium transition-colors"
              >
                <Github className="w-3.5 h-3.5" aria-hidden="true" />
                <span>GitHub</span>
              </a>
              <a
                href="https://rifjan29.github.io/profile-me/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-forest-800 font-medium transition-colors"
              >
                <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Web</span>
              </a>
              <a
                href="https://www.linkedin.com/in/rifjan-jundila/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-forest-800 font-medium transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>LinkedIn</span>
              </a>
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile PWA Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi bawah aplikasi"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border pwa-bottom-nav no-print"
      >
        <div className="grid grid-cols-4 gap-1 pt-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleModeChange(item.id)}
                disabled={loading}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
                  active
                    ? 'text-forest-800 font-bold bg-forest-50/70'
                    : 'text-ink-muted font-medium'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 inset-x-5 h-[2.5px] rounded-b-full bg-forest-700"
                  />
                )}
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] leading-none">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Support & Dev Info Dialog */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
}
