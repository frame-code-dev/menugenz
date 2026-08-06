'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, ExternalLink, Smartphone, Download, Share2 } from 'lucide-react';
import { openWhatsApp, normalizePhone } from '@/lib/whatsapp';

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

  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Check Web Share API capability on client
  useEffect(() => {
    if (typeof window !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
      setCanWebShare(true);
    }
  }, []);

  // Load last used WhatsApp number from localStorage (with daily auto-reset)
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

  const handleDownloadImage = () => {
    if (!previewUrl && !imageFile) return;

    const link = document.createElement('a');
    link.href = previewUrl || (imageFile ? URL.createObjectURL(imageFile) : '');
    link.download = `MenuGenZ_${getTodayString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      // User cancelled share or error
    }
  };

  return (
    <div className="w-full mt-6 p-6 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 flex flex-col gap-5">
      <form onSubmit={handleOpenWhatsApp} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold text-base">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <span>Kirim via WhatsApp</span>
          </div>

          {(previewUrl || imageFile) && (
            <button
              type="button"
              onClick={handleDownloadImage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-all shadow-sm"
              title="Unduh foto menu untuk dilampirkan"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Foto
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-gray-500" />
            Nomor WhatsApp Tujuan
          </label>
          <div className="relative">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="Contoh: 08123456789 atau 628123456789"
              disabled={disabled}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-800 bg-white outline-none transition-all placeholder:text-gray-400 disabled:bg-gray-50"
            />
          </div>
          {normalizedPreview && (
            <span className="text-[11px] text-emerald-700">
              Format terisi di WhatsApp: <strong className="font-mono">+{normalizedPreview}</strong>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={!phone.trim() || !caption.trim() || disabled}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-4 h-4 fill-white" />
            Buka WhatsApp
            <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
          </button>

          {canWebShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={!caption.trim() || disabled}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm shadow-sm transition-all shrink-0 disabled:opacity-50"
              title="Share langsung dari HP dengan foto"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              Share HP (Dengan Foto)
            </button>
          )}
        </div>
      </form>

      <p className="text-[11px] text-emerald-800/80 leading-relaxed bg-emerald-100/40 p-3 rounded-xl border border-emerald-200/50">
        💡 <strong>Tips Lampirkan Foto di WhatsApp:</strong> WhatsApp URL standar hanya mendukung pengisian teks caption secara otomatis. Untuk menyertakan foto menu, klik tombol <strong>Unduh Foto</strong> di atas, lalu lampirkan gambar tersebut di chat WhatsApp. (Pada HP Android/iOS, Anda juga dapat menggunakan tombol <strong>Share HP</strong>).
      </p>
    </div>
  );
};
