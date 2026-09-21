'use client';

import React, { useState } from 'react';
import { Sparkles, Utensils, Receipt, Camera, AlertCircle, Clock, ShieldCheck, Github, Globe, Linkedin } from 'lucide-react';
import { MenuUploader } from '@/components/menu-uploader';
import { ImagePreview } from '@/components/image-preview';
import { LoadingState } from '@/components/loading-state';
import { CaptionEditor } from '@/components/caption-editor';
import { WhatsAppForm } from '@/components/whatsapp-form';
import { ReceiptBreakdown } from '@/components/receipt-breakdown';
import { PasFotoEditor } from '@/components/pas-foto-editor';
import { MenuResult } from '@/types/menu';
import { AppMode, ReceiptResult } from '@/types/receipt';
import { analyzeMenuImage, analyzeReceiptImage } from '@/lib/api';
import { generateCaption } from '@/lib/caption';
import { generateReceiptCaption } from '@/lib/receipt';

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('menu');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [menuResult, setMenuResult] = useState<MenuResult | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [caption, setCaption] = useState<string>('');

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsRateLimited(false);
    setMenuResult(null);
    setReceiptResult(null);
    setCaption('');
  };

  const handleModeChange = (newMode: AppMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    resetState();
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setErrorMessage(null);
    setIsRateLimited(false);
    setMenuResult(null);
    setReceiptResult(null);
    setCaption('');
  };

  const handleRemoveImage = () => {
    resetState();
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);

    if (mode === 'menu') {
      const result = await analyzeMenuImage(selectedFile);
      setLoading(false);

      if (result.success && result.data) {
        setMenuResult(result.data);
        const generated = generateCaption(result.data);
        setCaption(generated);
      } else {
        if (result.isRateLimited) {
          setIsRateLimited(true);
        }
        setErrorMessage(
          result.message || 'AI gagal membaca gambar menu. Silakan coba gambar yang lebih jelas.'
        );
      }
    } else {
      const result = await analyzeReceiptImage(selectedFile);
      setLoading(false);

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
  };

  const hasResult = menuResult || receiptResult;

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className={`${mode === 'pasfoto' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto transition-all duration-300`}>
        {/* Header */}
        <header className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold tracking-wide uppercase mb-3 shadow-sm">
            <Utensils className="w-4 h-4" />
            MenuGenZ AI
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            MenuGenZ
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-xl mx-auto font-medium">
            AI Vision otomatis untuk generate caption menu, pembaca struk belanja & studio editor pas foto.
          </p>

          <div className="inline-flex items-center justify-center gap-1.5 mt-3 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs border border-emerald-200/70 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Privasi Terjaga:</strong> Sistem ini tidak menyimpan data atau foto apapun.
            </span>
          </div>
        </header>

        {/* Mode Selector Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 backdrop-blur-sm shadow-inner gap-1.5 border border-slate-300/60 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => handleModeChange('menu')}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 shrink-0 ${
                mode === 'menu'
                  ? 'bg-white text-emerald-800 shadow-md shadow-slate-300/50 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              } disabled:opacity-50`}
            >
              <Utensils className="w-4 h-4" />
              <span>Menu Makanan MBG</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('receipt')}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 shrink-0 ${
                mode === 'receipt'
                  ? 'bg-white text-emerald-800 shadow-md shadow-slate-300/50 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              } disabled:opacity-50`}
            >
              <Receipt className="w-4 h-4" />
              <span>Baca Struk & Nota Belanja</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('pasfoto')}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 shrink-0 ${
                mode === 'pasfoto'
                  ? 'bg-white text-blue-800 shadow-md shadow-slate-300/50 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              } disabled:opacity-50`}
            >
              <Camera className="w-4 h-4" />
              <span>Buat Pas Foto</span>
            </button>
          </div>
        </div>

        {mode === 'pasfoto' ? (
          <PasFotoEditor
            initialFile={selectedFile}
            initialPreviewUrl={previewUrl}
            onFileSelect={handleFileSelect}
            onReset={resetState}
          />
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
          {/* Step 1: Upload or Preview */}
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
                onReplace={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.jpg,.jpeg,.png,.webp';
                  input.onchange = (e: Event) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files[0]) handleFileSelect(files[0]);
                  };
                  input.click();
                }}
                onRemove={handleRemoveImage}
                disabled={loading}
              />

              {!hasResult && !loading && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isRateLimited}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5 fill-white" />
                  {mode === 'receipt' ? 'Baca Struk & Buat Laporan' : 'Generate Caption Menu'}
                </button>
              )}
            </div>
          )}

          {/* Loading Indicator */}
          <LoadingState isLoading={loading} mode={mode} />

          {/* Rate Limit Notice Banner */}
          {isRateLimited && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-900 mb-0.5">
                    Batas Kuota Penggunaan AI Tercapai
                  </h4>
                  <p className="text-xs text-amber-800/90 leading-relaxed">
                    {errorMessage ||
                      'Batas penggunaan AI harian/menit telah tercapai. Silakan tunggu beberapa saat lagi sebelum mencoba kembali.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all shrink-0 self-end sm:self-center"
              >
                🔄 Coba Lagi
              </button>
            </div>
          )}

          {/* General Error Message */}
          {errorMessage && !isRateLimited && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shrink-0"
                >
                  🔄 Coba Lagi
                </button>
              )}
            </div>
          )}

          {/* Step 2: Result, Breakdown & Caption Editor */}
          {hasResult && (
            <div className="flex flex-col gap-6 pt-4 border-t border-slate-100">
              {/* Receipt Visual Breakdown Table (Only on receipt mode) */}
              {mode === 'receipt' && receiptResult && (
                <ReceiptBreakdown data={receiptResult} />
              )}

              <CaptionEditor
                caption={caption}
                onChange={setCaption}
                onReanalyze={handleAnalyze}
                disabled={loading}
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

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200/80 text-center flex flex-col items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center justify-center gap-1.5 text-slate-600 font-medium px-4 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sistem ini tidak menyimpan data apapun. Gambar diproses secara real-time langsung ke AI tanpa disimpan di server maupun database.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-slate-600 pt-1">
            <span>Dibuat oleh <strong className="text-slate-800 font-semibold">rifjan29</strong></span>
            <span className="text-slate-300">•</span>
            <a
              href="https://github.com/rifjan29"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 font-medium transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <span className="text-slate-300">•</span>
            <a
              href="https://rifjan29.github.io/profile-me/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 font-medium transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </a>
            <span className="text-slate-300">•</span>
            <a
              href="https://www.linkedin.com/in/rifjan-jundila/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 font-medium transition-colors"
            >
              <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
              <span>LinkedIn</span>
            </a>
          </div>

          <p className="text-[11px] text-slate-400">
            MenuGenZ &copy; {new Date().getFullYear()} — Ekstraksi Menu & Struk Otomatis ke WhatsApp
          </p>
        </footer>
      </div>
    </main>
  );
}
