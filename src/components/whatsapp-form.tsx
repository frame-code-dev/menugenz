'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  ExternalLink,
  Smartphone,
  Download,
  Share2,
  Info,
} from 'lucide-react';
import { openWhatsApp, normalizePhone } from '@/lib/whatsapp';
import { isVideoFile } from '@/lib/video';

interface WhatsAppFormProps {
  caption: string;
  imageFile?: File | null;
  previewUrl?: string | null;
  disabled?: boolean;
}

const STORAGE_KEY = 'menuGenZ_lastWhatsappNumber';

export const WhatsAppForm: React.FC<WhatsAppFormProps> = ({
  caption,
  imageFile,
  previewUrl,
  disabled,
}) => {
  const [phone, setPhone] = useState('');
  const [normalizedPreview, setNormalizedPreview] = useState('');
  const [canWebShare, setCanWebShare] = useState(false);

  const isVideo = Boolean(imageFile && isVideoFile(imageFile));
  const mediaLabel = isVideo ? 'Video' : 'Foto';

  const getTodayString = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (typeof window !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
      setCanWebShare(true);
    }
  }, []);

  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          if (parsed && parsed.savedDate === getTodayString()) {
            setPhone(parsed.phone || '');
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setPhone('');
          }
        } catch {
          setPhone(savedRaw);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (phone.trim()) {
      setNormalizedPreview(normalizePhone(phone));
    } else {
      setNormalizedPreview('');
    }
  }, [phone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);
    try {
      if (val.trim()) {
        const payload = JSON.stringify({
          phone: val,
          savedDate: getTodayString(),
        });
        localStorage.setItem(STORAGE_KEY, payload);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleOpenWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !caption.trim()) return;
    openWhatsApp(phone, caption);
  };

  const handleDownloadMedia = () => {
    if (!previewUrl && !imageFile) return;

    const extMatch = imageFile?.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : isVideo ? 'mp4' : 'jpg';

    const link = document.createElement('a');
    let tempUrl: string | null = null;
    if (previewUrl) {
      link.href = previewUrl;
    } else if (imageFile) {
      tempUrl = URL.createObjectURL(imageFile);
      link.href = tempUrl;
    }

    link.download = `MenuGenZ_${getTodayString()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (tempUrl) {
      URL.revokeObjectURL(tempUrl);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share || !caption) return;

    try {
      const shareData: ShareData = {
        title: 'MenuGenZ Caption',
        text: caption,
      };

      if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        shareData.files = [imageFile];
      }

      await navigator.share(shareData);
    } catch {
      // User cancelled share or unsupported
    }
  };

  return (
    <div className="w-full p-5 rounded-2xl bg-forest-50/55 border border-forest-100 flex flex-col gap-4">
      <form onSubmit={handleOpenWhatsApp} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-forest-900 font-bold text-sm">
            <MessageSquare className="w-4 h-4 text-forest-700" aria-hidden="true" />
            <span>Bagikan ke WhatsApp</span>
          </div>

          {(previewUrl || imageFile) && (
            <button
              type="button"
              onClick={handleDownloadMedia}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-forest-200 text-forest-800 hover:bg-forest-50 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Unduh {mediaLabel}</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="wa-phone-input"
            className="text-xs font-semibold text-ink-muted flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Nomor WhatsApp Tujuan</span>
          </label>
          <input
            id="wa-phone-input"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="Contoh: 08123456789 atau 628123456789"
            disabled={disabled}
            className="w-full px-4 py-3 rounded-xl border border-border focus:border-forest-700 focus:ring-2 focus:ring-forest-700/15 text-sm text-ink bg-surface outline-none transition-colors placeholder:text-ink-faint disabled:bg-subtle"
          />
          {normalizedPreview && (
            <span className="text-xs text-forest-800">
              Format WhatsApp:{' '}
              <strong className="font-mono">+{normalizedPreview}</strong>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="submit"
            disabled={!phone.trim() || !caption.trim() || disabled}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            <span>Buka WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
          </button>

          {canWebShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={!caption.trim() || disabled}
              className="sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface border border-border hover:bg-subtle text-ink font-semibold text-sm transition-colors shrink-0 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4 text-forest-700" aria-hidden="true" />
              <span>Share HP (Dengan {mediaLabel})</span>
            </button>
          )}
        </div>
      </form>

      <p className="text-xs text-forest-900/80 leading-relaxed flex items-start gap-2 pt-1 border-t border-forest-100">
        <Info className="w-3.5 h-3.5 text-forest-700 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Tautan WhatsApp mengisi teks caption otomatis. Untuk melampirkan{' '}
          {mediaLabel.toLowerCase()}, klik <strong>Unduh {mediaLabel}</strong>{' '}
          atau gunakan tombol <strong>Share HP</strong> di ponsel Anda.
        </span>
      </p>
    </div>
  );
};
