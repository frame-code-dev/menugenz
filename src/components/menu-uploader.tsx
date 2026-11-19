'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Video,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { AppMode } from '@/types/receipt';
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  isImageFile,
  isVideoFile,
} from '@/lib/video';

interface MenuUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  mode?: AppMode;
}

export const MenuUploader: React.FC<MenuUploaderProps> = ({
  onFileSelect,
  disabled,
  mode = 'menu',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowVideo = mode === 'menu';

  const validateAndSelect = (file: File) => {
    setErrorMessage(null);

    const isImg = isImageFile(file);
    const isVid = allowVideo && isVideoFile(file);

    if (!isImg && !isVid) {
      setErrorMessage(
        allowVideo
          ? 'Format tidak didukung. Pilih foto (JPG, PNG, WEBP) atau video (MP4, MOV, WEBM).'
          : 'Format gambar struk harus JPG, JPEG, PNG, atau WEBP.'
      );
      return;
    }

    if (isImg && file.size > IMAGE_MAX_BYTES) {
      setErrorMessage('Ukuran foto maksimal 10 MB.');
      return;
    }

    if (isVid && file.size > VIDEO_MAX_BYTES) {
      setErrorMessage('Ukuran video maksimal 50 MB.');
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center px-5 py-10 sm:py-12 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
          isDragging
            ? 'border-forest-700 bg-forest-50/70'
            : 'border-border hover:border-forest-600/60 bg-subtle/40 hover:bg-forest-50/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={
            allowVideo
              ? 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm'
              : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
          }
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="w-14 h-14 mb-4 rounded-2xl bg-forest-50 border border-forest-100 text-forest-700 flex items-center justify-center">
          {mode === 'receipt' ? (
            <Receipt className="w-6 h-6" aria-hidden="true" />
          ) : (
            <UploadCloud className="w-6 h-6" aria-hidden="true" />
          )}
        </div>

        <h3 className="text-base sm:text-lg font-bold text-ink mb-1 text-center">
          {mode === 'receipt'
            ? 'Unggah Foto Struk atau Nota Belanja'
            : 'Unggah Foto atau Video Menu MBG'}
        </h3>

        <p className="text-sm text-ink-muted mb-5 text-center max-w-md leading-relaxed">
          {mode === 'receipt'
            ? 'Pilih atau tarik foto struk kasir, nota pasar, maupun bon bahan pangan agar rincian item terhitung otomatis.'
            : 'Tarik file ke sini atau ambil langsung dari galeri HP — mendukung foto menu maupun video dokumentasi sajian.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white font-semibold text-sm transition-colors"
          >
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            <span>
              {mode === 'receipt' ? 'Pilih Foto Struk' : 'Pilih Foto / Video'}
            </span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            JPG, PNG, WEBP (maks. 10 MB)
          </span>
          {allowVideo && (
            <span className="inline-flex items-center gap-1 text-terracotta-700 font-medium">
              <Video className="w-3.5 h-3.5" aria-hidden="true" />
              MP4, MOV, WEBM (maks. 50 MB)
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
