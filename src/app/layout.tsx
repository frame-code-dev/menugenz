import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MenuGenZ - AI Menu Caption Generator',
  description:
    'MenuGenZ: Website untuk membaca foto menu makanan menggunakan AI Vision, menghasilkan caption secara otomatis, dan membagikannya ke WhatsApp tanpa database.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="font-sans antialiased bg-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
