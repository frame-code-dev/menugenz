'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithInstall extends Navigator {
  install?: (options?: { manifest?: string; manifestId?: string }) => Promise<void>;
}

export function PwaInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const supportsWebInstallRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register lightweight PWA Service Worker and immediately check for updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          // Ignore registration errors in unsupported contexts
        });
    }

    // Already running in installed standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      return;
    }

    const supportsWebInstall =
      typeof (Navigator.prototype as unknown as NavigatorWithInstall).install === 'function';
    supportsWebInstallRef.current = supportsWebInstall;

    if (supportsWebInstall) {
      setCanInstall(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      if (!supportsWebInstallRef.current) {
        setCanInstall(true);
      }
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setStatusMessage('MenuGenZ berhasil terpasang di perangkat.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalling) return;
    setIsInstalling(true);

    try {
      const nav = navigator as NavigatorWithInstall;
      if (supportsWebInstallRef.current && typeof nav.install === 'function') {
        await nav.install();
        setStatusMessage('Aplikasi dipasang atau dibuka.');
        setCanInstall(false);
      } else if (deferredPromptRef.current) {
        const promptEvent = deferredPromptRef.current;
        deferredPromptRef.current = null;
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        setStatusMessage(
          outcome === 'accepted'
            ? 'Aplikasi sedang dipasang ke layar utama.'
            : 'Pemasangan aplikasi dibatalkan.'
        );
        if (!deferredPromptRef.current) {
          setCanInstall(false);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatusMessage('Pemasangan dibatalkan.');
      } else {
        setStatusMessage('Pemasangan belum dapat dijalankan di browser ini.');
        console.error('PWA install error:', error);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <>
      <button
        type="button"
        hidden={!canInstall}
        aria-disabled={isInstalling ? 'true' : undefined}
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer aria-disabled:opacity-60"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install App</span>
      </button>
      <span className="sr-only" role="status">
        {statusMessage}
      </span>
    </>
  );
}
