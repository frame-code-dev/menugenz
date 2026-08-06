'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface MenuUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const MenuUploader: React.FC<MenuUploaderProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setErrorMessage(null);
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!validMimes.includes(file.type)) {
      setErrorMessage('Format gambar harus JPG, JPEG, PNG, atau WEBP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran gambar maksimal 10 MB.');
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
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
            : 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="w-16 h-16 mb-4 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shadow-sm">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mb-1 text-center">
          Upload Foto Menu Makanan
        </h3>
        <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
          Drag & drop gambar ke sini, atau klik tombol di bawah untuk memilih file.
        </p>

        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm transition-all hover:shadow-md"
        >
          <ImageIcon className="w-4 h-4" />
          Pilih Gambar
        </button>

        <span className="text-xs text-gray-400 mt-3">
          JPG, JPEG, PNG, WEBP (Max 10 MB)
        </span>
      </div>

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
