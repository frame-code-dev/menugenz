'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  isLoading: boolean;
}

const steps = [
  { icon: '🔍', text: 'Membaca gambar...' },
  { icon: '📝', text: 'Membaca tulisan pada menu...' },
  { icon: '🍱', text: 'Mengidentifikasi makanan...' },
  { icon: '✨', text: 'Membuat caption...' },
];

export const LoadingState: React.FC<LoadingStateProps> = ({ isLoading }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1200);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const currentStep = steps[currentStepIndex];

  return (
    <div className="w-full my-6 p-6 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 shadow-sm flex flex-col items-center justify-center text-center animate-pulse">
      <div className="w-12 h-12 mb-3 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>

      <div className="flex items-center gap-2 text-emerald-900 font-semibold text-base mb-1">
        <span className="text-xl">{currentStep.icon}</span>
        <span>{currentStep.text}</span>
      </div>

      <p className="text-xs text-emerald-600/80">
        AI Vision sedang memproses foto menu Anda...
      </p>

      {/* Progress Dots */}
      <div className="flex items-center gap-1.5 mt-4">
        {steps.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx <= currentStepIndex
                ? 'w-6 bg-emerald-600'
                : 'w-1.5 bg-emerald-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
