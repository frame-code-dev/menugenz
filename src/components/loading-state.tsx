'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { AppMode } from '@/types/receipt';

interface LoadingStateProps {
  isLoading: boolean;
  mode?: AppMode;
  isVideo?: boolean;
  extractProgress?: number | null;
}

const imageMenuSteps = [
  'Membaca visual & teks pada foto menu',
  'Mengidentifikasi setiap hidangan MBG',
  'Menyusun caption copywriter formal santai',
];

const videoMenuSteps = [
  'Menyiapkan frame & konteks video menu',
  'Menggabungkan daftar hidangan dari video',
  'Menyusun caption copywriter formal santai',
];

const receiptSteps = [
  'Membaca foto struk & nama toko',
  'Mengekstrak item, kuantitas & harga satuan',
  'Menghitung total & menyusun laporan belanja',
];

export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  mode = 'menu',
  isVideo = false,
  extractProgress = null,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const steps =
    mode === 'receipt'
      ? receiptSteps
      : isVideo
      ? videoMenuSteps
      : imageMenuSteps;

  useEffect(() => {
    if (!isLoading) {
      setCurrentStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading, steps.length]);

  if (!isLoading) return null;

  const isExtractingVideo =
    isVideo && extractProgress !== null && extractProgress < 100;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full p-5 rounded-2xl bg-subtle/70 border border-border flex flex-col gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-forest-700 text-white flex items-center justify-center shrink-0">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {isExtractingVideo
              ? `Mengekstrak frame HD dari video (${extractProgress}%)`
              : steps[currentStepIndex]}
          </p>
          <p className="text-xs text-ink-muted">
            {mode === 'receipt'
              ? 'AI OCR sedang merapikan daftar belanja dan subtotal.'
              : isVideo
              ? 'Memproses media video langsung di memori tanpa disimpan.'
              : 'AI Vision sedang membaca sajian dan menyusun teks yang rapi.'}
          </p>
        </div>
      </div>

      {isExtractingVideo ? (
        <div className="w-full h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-forest-700 transition-all duration-200"
            style={{ width: `${extractProgress}%` }}
          />
        </div>
      ) : (
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {steps.map((stepText, idx) => {
            const done = idx < currentStepIndex;
            const active = idx === currentStepIndex;
            return (
              <li
                key={stepText}
                className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-surface border-forest-700/40 text-ink font-semibold'
                    : done
                    ? 'bg-forest-50/60 border-forest-100 text-forest-800'
                    : 'bg-surface/60 border-border text-ink-faint'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    done
                      ? 'bg-forest-700 text-white'
                      : active
                      ? 'bg-terracotta-600 text-white'
                      : 'bg-border text-ink-muted'
                  }`}
                >
                  {done ? <Check className="w-2.5 h-2.5" aria-hidden="true" /> : idx + 1}
                </span>
                <span className="truncate">{stepText}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
