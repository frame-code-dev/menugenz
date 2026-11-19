'use client';

import React, { useRef, useState } from 'react';
import {
  X,
  Coffee,
  Heart,
  Copy,
  Check,
  Code2,
  ShieldCheck,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Tag,
} from 'lucide-react';
import { useDialogLightDismiss } from '@/components/recipe-detail-dialog';
import { APP_CHANGELOG, APP_VERSION_TAG } from '@/lib/version';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const accountNumber = '1430032353797';
  const accountHolder = 'RIFJAN JUNDILA';
  const bankName = 'Bank Mandiri';

  useDialogLightDismiss(dialogRef, isOpen, onClose);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(accountNumber);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = accountNumber;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Gagal menyalin nomor rekening:', err);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="support-dialog-title"
      className="app-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="bg-surface rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-border flex flex-col gap-5 max-h-[90dvh] overflow-y-auto text-ink">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-terracotta-50 border border-terracotta-100 text-terracotta-700 flex items-center justify-center">
              <Coffee className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="support-dialog-title"
                className="text-base font-bold text-ink leading-tight"
              >
                Dukungan &amp; Info Pengembang
              </h2>
              <p className="text-xs text-ink-muted">
                MenuGenZ <span className="font-mono font-semibold text-forest-800">{APP_VERSION_TAG}</span> • Asisten Menu MBG, Resep &amp; Struk
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal dukungan"
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Section 1: Buy Me a Coffee */}
        <div className="rounded-2xl bg-forest-900 text-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/10 text-terracotta-100 text-[11px] font-semibold">
              <Coffee className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Traktir Kopi / Donasi</span>
            </span>
            <span className="text-[11px] text-white/60">Sukarela</span>
          </div>

          <p className="text-xs text-white/80 leading-relaxed">
            Dukungan sukarela membantu biaya operasional token AI Vision dan server agar MenuGenZ tetap gratis dan bebas iklan.
          </p>

          <div className="bg-white/10 rounded-xl p-3.5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Bank Tujuan</span>
              <span className="font-bold text-white">{bankName}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-white/70">Nomor Rekening</span>
              <div className="flex items-center justify-between gap-2 bg-black/25 px-3 py-2 rounded-lg border border-white/10">
                <span className="font-mono text-sm sm:text-base font-bold tracking-wider text-terracotta-100 select-all">
                  {accountNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  data-compact-target="true"
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    copied
                      ? 'bg-forest-200 text-forest-900'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
              <span className="text-white/70">Atas Nama</span>
              <span className="font-bold text-white">{accountHolder}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Developer Profile */}
        <div className="rounded-2xl bg-subtle/60 p-4 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-forest-700" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Tentang Pengembang
            </h3>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Dibuat dan dirawat oleh <strong className="text-ink">Rifjan Jundila</strong>{' '}
            (<strong className="text-ink">@rifjan29</strong>). Terbuka untuk kolaborasi, masukan fitur, dan kontribusi open-source.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href="https://github.com/rifjan29"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-ink hover:text-forest-700 hover:border-forest-600/40 text-xs font-semibold transition-colors"
            >
              <Github className="w-3.5 h-3.5" aria-hidden="true" />
              <span>GitHub</span>
              <ExternalLink className="w-2.5 h-2.5 text-ink-faint" aria-hidden="true" />
            </a>
            <a
              href="https://rifjan29.github.io/profile-me/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-ink hover:text-forest-700 hover:border-forest-600/40 text-xs font-semibold transition-colors"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Website</span>
              <ExternalLink className="w-2.5 h-2.5 text-ink-faint" aria-hidden="true" />
            </a>
            <a
              href="https://www.linkedin.com/in/rifjan-jundila/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-ink hover:text-forest-700 hover:border-forest-600/40 text-xs font-semibold transition-colors"
            >
              <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" aria-hidden="true" />
              <span>LinkedIn</span>
              <ExternalLink className="w-2.5 h-2.5 text-ink-faint" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Section 3: What's New / Version */}
        <div className="rounded-2xl bg-forest-50/60 p-4 border border-forest-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-forest-700" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-forest-900">
                Pembaruan {APP_CHANGELOG.version}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-surface border border-forest-100 font-mono text-[11px] font-bold text-forest-800">
              {APP_VERSION_TAG}
            </span>
          </div>
          <ul className="text-xs text-forest-900/90 space-y-1.5 leading-relaxed list-disc pl-4">
            {APP_CHANGELOG.highlights.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        {/* Section 4: Privacy & API */}
        <div className="rounded-2xl bg-subtle/60 p-4 border border-border space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-forest-700" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Privasi &amp; Integrasi AI
            </h3>
          </div>
          <ul className="text-xs text-ink-muted space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-ink">Zero-Data Retention:</strong> Foto, video, dan struk diproses real-time tanpa disimpan ke database maupun server.
            </li>
            <li>
              <strong className="text-ink">Google Gemini Vision:</strong> Digunakan untuk analisis menu foto/video, rekomendasi siklus MBG, serta pembacaan struk.
            </li>
          </ul>
        </div>

        <div className="pt-1 flex items-center justify-between gap-3">
          <div className="text-[11px] text-ink-faint flex items-center gap-1">
            <span>Dibuat dengan</span>
            <Heart className="w-3 h-3 text-terracotta-600 fill-current" aria-hidden="true" />
            <span>untuk operasional harian</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-subtle hover:bg-border/60 text-ink text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
