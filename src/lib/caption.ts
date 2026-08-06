import { MenuResult } from '@/types/menu';

/**
 * Format YYYY-MM-DD into Indonesian date string, e.g. "Kamis, 06 Agustus 2026"
 */
export function formatIndonesianDate(dateString: string | null): string {
  if (!dateString) return '';

  try {
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const dateObj = new Date(year, month, day);
    if (isNaN(dateObj.getTime())) return dateString;

    const formatter = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    return formatter.format(dateObj);
  } catch {
    return dateString;
  }
}

/**
 * Generate formatted caption text from structured MenuResult
 */
export function generateCaption(data: MenuResult): string {
  const parts: string[] = [];

  const formattedDate = formatIndonesianDate(data.date);
  if (formattedDate) {
    parts.push(formattedDate);
  }

  if (data.recipients && data.recipients.length > 0) {
    parts.push(data.recipients.join(', '));
  }

  if (data.menus && data.menus.length > 0) {
    const menuList = data.menus.map((menu) => `- ${menu}`).join('\n');
    parts.push(menuList);
  }

  const defaultMbgNote = '✨ Program Makan Bergizi Gratis (MBG) hadir mendukung kesehatan dan tumbuh kembang generasi penerus bangsa. Mari penuhi gizi seimbang harian untuk Indonesia yang lebih sehat dan kuat!';
  parts.push(data.mbgNote || defaultMbgNote);

  return parts.join('\n\n');
}
