'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  FileText,
  Calendar,
  Users,
  Utensils,
} from 'lucide-react';
import { CaptionStyle, MenuResult } from '@/types/menu';
import { formatIndonesianDate } from '@/lib/caption';

interface CaptionEditorProps {
  caption: string;
  onChange: (value: string) => void;
  onReanalyze?: () => void;
  disabled?: boolean;
  captionStyle?: CaptionStyle;
  onStyleChange?: (style: CaptionStyle) => void;
  menuResult?: MenuResult | null;
  title?: string;
}

const STYLE_OPTIONS: { id: CaptionStyle; label: string; hint: string }[] = [
  { id: 'formal_santai', label: 'Formal Santai', hint: 'Copywriter hangat & rapi' },
  { id: 'ringkas', label: 'Ringkas WA', hint: 'Padat untuk grup cepat' },
  { id: 'sosmed', label: 'Sosial Media', hint: 'Cocok IG / Status WA' },
];

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  caption,
  onChange,
  onReanalyze,
  disabled,
  captionStyle = 'formal_santai',
  onStyleChange,
  menuResult,
  title = 'Draft Caption Siap Bagikan',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = caption;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Structured summary chips when MenuResult is available */}
      {menuResult && menuResult.menus.length > 0 && (
        <div className="p-4 rounded-2xl bg-subtle/70 border border-border flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
            <span className="font-semibold text-ink inline-flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
              Terdeteksi {menuResult.menus.length} item menu
            </span>
            {menuResult.date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" />
                {formatIndonesianDate(menuResult.date)}
              </span>
            )}
            {menuResult.recipients.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" />
                {menuResult.recipients.join(', ')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {menuResult.menus.map((item, idx) => (
              <span
                key={`${item}-${idx}`}
                className="px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-medium text-ink"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Header + Style switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label
          htmlFor="caption-textarea"
          className="text-sm font-bold text-ink flex items-center gap-2"
        >
          <FileText className="w-4 h-4 text-forest-700" aria-hidden="true" />
          <span>{title}</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {onStyleChange && (
            <div
              className="inline-flex p-1 rounded-xl bg-subtle border border-border gap-0.5"
              role="group"
              aria-label="Pilih gaya bahasa caption"
            >
              {STYLE_OPTIONS.map((opt) => {
                const active = captionStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onStyleChange(opt.id)}
                    disabled={disabled}
                    title={opt.hint}
                    data-compact-target="true"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-surface text-forest-800 shadow-sm border border-border/80'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {onReanalyze && (
            <button
              type="button"
              onClick={onReanalyze}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-subtle text-xs font-semibold text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Analisis Ulang</span>
            </button>
          )}
        </div>
      </div>

      {/* Readable editorial textarea */}
      <textarea
        id="caption-textarea"
        value={caption}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={9}
        placeholder="Hasil caption akan muncul di sini dan bebas Anda sunting..."
        className="w-full p-4 rounded-2xl border border-border focus:border-forest-700 focus:ring-2 focus:ring-forest-700/15 text-ink text-sm leading-relaxed bg-surface resize-y outline-none transition-colors placeholder:text-ink-faint disabled:bg-subtle"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-mono text-ink-faint">
          {caption.length} karakter
        </span>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!caption || disabled}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors ${
            copied
              ? 'bg-forest-800 text-white'
              : 'bg-forest-700 hover:bg-forest-800 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Caption Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" aria-hidden="true" />
              <span>Salin Caption</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
