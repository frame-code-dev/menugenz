'use client';

import React, { useState } from 'react';
import { Copy, Check, RotateCcw, FileText } from 'lucide-react';

interface CaptionEditorProps {
  caption: string;
  onChange: (value: string) => void;
  onReanalyze?: () => void;
  disabled?: boolean;
}

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  caption,
  onChange,
  onReanalyze,
  disabled,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-emerald-600" />
          Edit Caption Menu
        </label>
        {onReanalyze && (
          <button
            type="button"
            onClick={onReanalyze}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Analisis Ulang
          </button>
        )}
      </div>

      <div className="relative w-full">
        <textarea
          value={caption}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={9}
          placeholder="Hasil caption buatan AI akan muncul di sini dan dapat Anda edit..."
          className="w-full p-4 rounded-2xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-gray-800 text-sm font-mono leading-relaxed bg-white shadow-sm resize-y outline-none transition-all placeholder:text-gray-400 disabled:bg-gray-50"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">
          {caption.length} Karakter
        </span>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!caption || disabled}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-xs shadow-sm transition-all ${
            copied
              ? 'bg-emerald-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Caption Disalin!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Caption
            </>
          )}
        </button>
      </div>
    </div>
  );
};
