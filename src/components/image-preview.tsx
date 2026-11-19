'use client';

import React from 'react';
import {
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Film,
  Info,
} from 'lucide-react';
import { DIRECT_VIDEO_MAX_BYTES, formatFileSize } from '@/lib/video';

interface ImagePreviewProps {
  previewUrl: string;
  file?: File | null;
  isVideo?: boolean;
  label?: string;
  onReplace: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  previewUrl,
  file,
  isVideo = false,
  label,
  onReplace,
  onRemove,
  disabled,
}) => {
  const usesKeyframeMode = Boolean(
    isVideo && file && file.size > DIRECT_VIDEO_MAX_BYTES
  );

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-border bg-ink/95">
        {isVideo ? (
          <video
            src={previewUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[340px] object-contain bg-black"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label || 'Pratinjau Media'}
            className="w-full h-64 sm:h-80 object-contain bg-ink/90"
          />
        )}

        <div className="absolute top-3 left-3 px-2.5 py-1 bg-ink/75 backdrop-blur-sm rounded-lg text-white text-xs font-medium inline-flex items-center gap-1.5 pointer-events-none">
          {isVideo ? (
            <Film className="w-3.5 h-3.5 text-terracotta-500" aria-hidden="true" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-forest-200" aria-hidden="true" />
          )}
          <span>{label || (isVideo ? 'Pratinjau Video Menu' : 'Pratinjau Foto')}</span>
          {file && (
            <span className="font-mono text-[11px] text-white/75 ml-1">
              • {formatFileSize(file.size)}
            </span>
          )}
        </div>
      </div>

      {isVideo && (
        <div className="mt-3 w-full max-w-lg px-3.5 py-2.5 rounded-xl bg-subtle border border-border text-xs text-ink-muted flex items-start gap-2">
          <Info className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {usesKeyframeMode
              ? 'Video di atas 3,5 MB akan otomatis diekstrak menjadi 6 frame HD di perangkat Anda agar proses analisis cepat dan hemat kuota.'
              : 'Video ringan (≤ 3,5 MB) akan dikirim langsung ke AI Vision agar visual dan narasi audio ikut terbaca.'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
        <button
          type="button"
          onClick={onReplace}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border text-ink hover:bg-subtle text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isVideo ? 'Ganti Media' : 'Ganti Foto'}</span>
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Hapus</span>
        </button>
      </div>
    </div>
  );
};
