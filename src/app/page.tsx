'use client';

import React, { useState } from 'react';
import { Sparkles, Utensils, AlertCircle, Clock } from 'lucide-react';
import { MenuUploader } from '@/components/menu-uploader';
import { ImagePreview } from '@/components/image-preview';
import { LoadingState } from '@/components/loading-state';
import { CaptionEditor } from '@/components/caption-editor';
import { WhatsAppForm } from '@/components/whatsapp-form';
import { MenuResult } from '@/types/menu';
import { analyzeMenuImage } from '@/lib/api';
import { generateCaption } from '@/lib/caption';

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [menuResult, setMenuResult] = useState<MenuResult | null>(null);
  const [caption, setCaption] = useState<string>('');

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setErrorMessage(null);
    setIsRateLimited(false);
    setMenuResult(null);
    setCaption('');
  };

  const handleRemoveImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsRateLimited(false);
    setMenuResult(null);
    setCaption('');
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);

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
      setErrorMessage(result.message || 'AI gagal membaca gambar. Silakan coba gambar yang lebih jelas.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold tracking-wide uppercase mb-3 shadow-sm">
            <Utensils className="w-4 h-4" />
            MenuGenZ
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            MenuGenZ
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-xl mx-auto font-medium">
            Buat caption menu WhatsApp otomatis dari foto menggunakan AI Vision.
          </p>
        </header>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
          {/* Step 1: Upload or Preview */}
          {!previewUrl ? (
            <MenuUploader onFileSelect={handleFileSelect} disabled={loading || isRateLimited} />
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

              {!menuResult && !loading && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isRateLimited}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5 fill-white" />
                  Generate Caption
                </button>
              )}
            </div>
          )}

          {/* Loading Indicator */}
          <LoadingState isLoading={loading} />

          {/* Rate Limit Notice Banner */}
          {isRateLimited && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-900 mb-0.5">Batas Kuota Penggunaan AI Tercapai</h4>
                  <p className="text-xs text-amber-800/90 leading-relaxed">
                    {errorMessage || 'Batas penggunaan AI harian/menit telah tercapai. Silakan tunggu beberapa saat lagi sebelum mencoba kembali.'}
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

          {/* Step 2: Result & Caption Editor */}
          {menuResult && (
            <div className="flex flex-col gap-6 pt-4 border-t border-slate-100">
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

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-400">
          MenuGenZ — Bebas Database & Otomatis ke WhatsApp
        </footer>
      </div>
    </main>
  );
}
