'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  ExternalLink,
  Smartphone,
  Download,
  Share2,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  getLocalTodayIso,
  isValidPhone,
  normalizePhone,
  openWhatsApp,
} from '@/lib/whatsapp';
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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [canWebShare, setCanWebShare] = useState(false);

  const isVideo = Boolean(imageFile && isVideoFile(imageFile));
  const mediaLabel = isVideo ? 'Video' : 'Foto';

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
          if (parsed && parsed.savedDate === getLocalTodayIso()) {
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
    if (phoneError && (!val.trim() || isValidPhone(val))) {
      setPhoneError(null);
    }

    try {
      if (val.trim()) {
        const payload = JSON.stringify({
          phone: val,
          savedDate: getLocalTodayIso(),
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
    setShareFeedback(null);

    if (!caption.trim()) return;

    if (!phone.trim() || !isValidPhone(phone)) {
      setPhoneError(
        'Nomor WhatsApp belum valid. Gunakan format Indonesia 08xxx atau 628xxx (10–14 digit).'
      );
      return;
    }

    setPhoneError(null);
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

    link.download = `MenuGenZ_${getLocalTodayIso()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (tempUrl) {
      URL.revokeObjectURL(tempUrl);
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share || !caption) return;
    setShareFeedback(null);

    try {
      const shareData: ShareData = {
        title: 'MenuGenZ Caption',
        text: caption,
      };

      if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        shareData.files = [imageFile];
      }

      await navigator.share(shareData);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setShareFeedback(
          'Browser belum mendukung lampiran file langsung via Share. Gunakan tombol Unduh dan Buka WhatsApp.'
        );
      }
    }
  };

  const isPhoneCurrentlyValid = phone.trim().length > 0 && isValidPhone(phone);

  return (
    <div className="w-full p-5 rounded-2xl bg-forest-50/55 border border-forest-100 flex flex-col gap-4">
      <form onSubmit={handleOpenWhatsApp} noValidate className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-forest-900 font-bold text-sm">
            <MessageSquare className="w-4 h-4 text-forest-700" aria-hidden="true" />
            <span>Bagikan ke WhatsApp</span>
          </div>

          {(previewUrl || imageFile) && (
            <button
              type="button"
              onClick={handleDownloadMedia}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-forest-200 text-forest-800 hover:bg-forest-50 text-xs font-semibold transition-colors cursor-pointer"
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
            aria-invalid={phoneError ? 'true' : undefined}
            aria-describedby={phoneError ? 'wa-phone-error' : undefined}
            placeholder="Contoh: 08123456789 atau 628123456789"
            disabled={disabled}
            className={`w-full px-4 py-3 rounded-xl border text-sm text-ink bg-surface outline-none transition-colors placeholder:text-ink-faint disabled:bg-subtle ${
              phoneError
                ? 'border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/15'
                : 'border-border focus:border-forest-700 focus:ring-2 focus:ring-forest-700/15'
            }`}
          />

          {phoneError ? (
            <p
              id="wa-phone-error"
              role="alert"
              className="text-xs text-rose-700 font-medium flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{phoneError}</span>
            </p>
          ) : (
            normalizedPreview && (
              <span
                className={`text-xs ${
                  isPhoneCurrentlyValid ? 'text-forest-800' : 'text-amber-800'
                }`}
              >
                Format WhatsApp:{' '}
                <strong className="font-mono">+{normalizedPreview}</strong>
                {!isPhoneCurrentlyValid && ' (periksa kelengkapan digit)'}
              </span>
            )
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="submit"
            disabled={!phone.trim() || !caption.trim() || disabled}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface border border-border hover:bg-subtle text-ink font-semibold text-sm transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-4 h-4 text-forest-700" aria-hidden="true" />
              <span>Share HP (Dengan {mediaLabel})</span>
            </button>
          )}
        </div>

        {shareFeedback && (
          <p role="alert" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            {shareFeedback}
          </p>
        )}
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
