'use client';

import React from 'react';
import { RefreshCw, Trash2, Image as ImageIcon } from 'lucide-react';

interface ImagePreviewProps {
  previewUrl: string;
  onReplace: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  previewUrl,
  onReplace,
  onRemove,
  disabled,
}) => {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-md h-64 md:h-80 rounded-2xl overflow-hidden border border-emerald-100 bg-gray-900 shadow-md group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Preview Menu"
          className="w-full h-full object-contain bg-black/40"
        />
        <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-white text-xs font-medium flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          Preview Foto Menu
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={onReplace}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Ganti Gambar
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus
        </button>
      </div>
    </div>
  );
};
