import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const APP_VERSION_TAG = `v${APP_VERSION}`;

export interface AppReleaseNote {
  version: string;
  highlights: string[];
}

export const APP_CHANGELOG: AppReleaseNote = {
  version: APP_VERSION_TAG,
  highlights: [
    'Redesign UI/UX Warm Culinary Editorial dengan navigasi bawah khusus mobile (PWA).',
    'Mendukung instalasi aplikasi ke Home Screen HP (PWA Manifest & Service Worker).',
    'Caption menu bergaya copywriter formal santai ber-emoji dengan 3 pilihan gaya.',
    'Mendukung analisis video menu (MP4/MOV/WEBM) selain foto dengan kompresi otomatis.',
    'Tab baru AI Rekomendasi Menu MBG (Senin–Jumat) lengkap dengan pengubah porsi dinamis, detail resep, dan daftar belanja 5 hari.',
  ],
};
