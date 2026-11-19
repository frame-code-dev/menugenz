import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MenuGenZ — Asisten Menu MBG & Copywriter',
    short_name: 'MenuGenZ',
    description:
      'Caption foto & video menu MBG, rekomendasi menu mingguan Senin–Jumat lengkap dengan porsi dan resep, pembaca struk belanja, dan studio pas foto.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#FAF8F5',
    theme_color: '#1B4332',
    lang: 'id',
    categories: ['food', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
