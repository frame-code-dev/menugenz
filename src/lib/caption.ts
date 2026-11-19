import { CaptionStyle, MenuResult } from '@/types/menu';

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

const STARTS_WITH_EMOJI_RE = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const HAS_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function withLeadingEmoji(text: string, emoji: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return STARTS_WITH_EMOJI_RE.test(trimmed) ? trimmed : `${emoji} ${trimmed}`;
}

function withWarmClosingEmoji(text: string, leadingEmoji: string, trailingEmoji?: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (HAS_EMOJI_RE.test(trimmed)) return trimmed;
  return trailingEmoji
    ? `${leadingEmoji} ${trimmed} ${trailingEmoji}`
    : `${leadingEmoji} ${trimmed}`;
}

/**
 * Pick a tasteful, dish-matched emoji for Indonesian MBG food items.
 */
export function getMenuItemEmoji(menuName: string): string {
  const lower = menuName.toLowerCase();

  if (/\b(susu|milk|yogurt|yoghurt)\b/.test(lower)) return '🥛';
  if (/\b(nasi|beras|lontong|ketupat|bubur)\b/.test(lower)) return '🍚';
  if (/\b(mie|mi |bihun|kwetiau|spaghetti|pasta)\b/.test(lower)) return '🍜';
  if (/\b(roti|kentang|ubi|singkong|jagung rebus)\b/.test(lower)) return '🥔';

  if (/\b(ayam|bebek|unggas|nugget|katsu)\b/.test(lower)) return '🍗';
  if (/\b(ikan|lele|patin|kembung|tongkol|tuna|nila|bandeng|cakalang|pindang|udang)\b/.test(lower)) {
    return '🐟';
  }
  if (/\b(telur|telor|fuyunghai|dadar|ceplok|balado telur)\b/.test(lower)) return '🥚';
  if (/\b(daging|sapi|rendang|empal|semur daging|bakso|soto daging|abon)\b/.test(lower)) {
    return '🍖';
  }

  if (/\b(sup|sop|sayur asem|sayur lodeh|soto|kuah|bening)\b/.test(lower)) return '🍲';
  if (/\b(tumis|capcay|orak|kangkung|bayam|buncis|wortel|sawi|pakcoy|kacang panjang|labu|oyong|tauge|daun singkong|brokoli|kol|sayur|lalap|tahu|tempe)\b/.test(lower)) {
    return '🥬';
  }

  if (/\b(pisang)\b/.test(lower)) return '🍌';
  if (/\b(semangka)\b/.test(lower)) return '🍉';
  if (/\b(jeruk)\b/.test(lower)) return '🍊';
  if (/\b(melon)\b/.test(lower)) return '🍈';
  if (/\b(apel)\b/.test(lower)) return '🍎';
  if (/\b(anggur)\b/.test(lower)) return '🍇';
  if (/\b(mangga)\b/.test(lower)) return '🥭';
  if (/\b(pepaya|buah|salak|pir|jambu|nanas|kelengkeng)\b/.test(lower)) return '🍉';

  if (/\b(air|teh|jus|minum)\b/.test(lower)) return '🥤';

  return '🍽️';
}

/**
 * Generate copywriter-crafted caption text with tasteful emojis from structured MenuResult.
 * Default style: 'formal_santai' (sopan, hangat, komunikatif, tidak kaku).
 */
export function generateCaption(
  data: MenuResult,
  style: CaptionStyle = 'formal_santai'
): string {
  const formattedDate = formatIndonesianDate(data.date);
  const recipientStr =
    data.recipients && data.recipients.length > 0
      ? data.recipients.join(', ')
      : '';
  const hasMenus = data.menus && data.menus.length > 0;

  const baseClosing =
    data.closingNote ||
    data.mbgNote ||
    'Kombinasi sajian hari ini disiapkan dengan gizi seimbang agar tetap bertenaga dan nyaman dinikmati. Semoga santapan hari ini membawa kebaikan untuk aktivitas bersama.';

  if (style === 'ringkas') {
    const parts: string[] = [];
    const headerLine = [
      '🍱 *Info Menu MBG*',
      formattedDate ? `— ${formattedDate}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    parts.push(headerLine);

    if (recipientStr) {
      parts.push(`👥 Sasaran: ${recipientStr}`);
    }

    if (hasMenus) {
      const list = data.menus
        .map((menu) => `${getMenuItemEmoji(menu)} ${menu}`)
        .join('\n');
      parts.push(list);
    }

    parts.push(withWarmClosingEmoji(baseClosing, '✨'));
    return parts.join('\n\n');
  }

  if (style === 'sosmed') {
    const parts: string[] = [];
    const hook = data.openingHook
      ? withLeadingEmoji(data.openingHook, '🍽️')
      : formattedDate
      ? `🍽️ Hari ${formattedDate} makin semangat dengan sajian bergizi pilihan hari ini!`
      : '🍽️ Saatnya isi energi dengan sajian bergizi dan seimbang hari ini!';
    parts.push(hook);

    const metaLines: string[] = [];
    if (formattedDate) metaLines.push(`📅 Jadwal: ${formattedDate}`);
    if (recipientStr) metaLines.push(`👥 Untuk: ${recipientStr}`);
    if (metaLines.length > 0) {
      parts.push(metaLines.join('\n'));
    }

    if (hasMenus) {
      const list = data.menus
        .map((menu) => `${getMenuItemEmoji(menu)} ${menu}`)
        .join('\n');
      parts.push(`📋 *Menu Sajian Hari Ini:*\n${list}`);
    }

    parts.push(withWarmClosingEmoji(baseClosing, '✨', '💚'));
    parts.push('#MakanBergiziGratis #MenuMBG #GiziSeimbang');
    return parts.join('\n\n');
  }

  // Default: 'formal_santai' (Copywriter formal tapi santai, hangat, dengan emoji proporsional)
  const parts: string[] = [];

  const introSubject = formattedDate ? `hari ${formattedDate}` : 'hari ini';
  const introRecipient = recipientStr ? ` bagi ${recipientStr}` : '';

  const opening = data.openingHook
    ? withLeadingEmoji(data.openingHook, '🍽️')
    : `🍽️ Halo Bapak, Ibu, dan rekan-rekan sekalian. Berikut kami sampaikan sajian Menu Makan Bergizi Gratis (MBG) untuk ${introSubject}${introRecipient}:`;

  parts.push(opening);

  // If AI provided a custom openingHook, include clean date/recipient summary lines
  if (data.openingHook && (formattedDate || recipientStr)) {
    const metaLines: string[] = [];
    if (formattedDate) metaLines.push(`📅 *Hari/Tanggal:* ${formattedDate}`);
    if (recipientStr) metaLines.push(`👥 *Penerima:* ${recipientStr}`);
    parts.push(metaLines.join('\n'));
  }

  if (hasMenus) {
    const list = data.menus
      .map((menu) => `${getMenuItemEmoji(menu)} ${menu}`)
      .join('\n');
    parts.push(`📋 *Menu Sajian Hari Ini:*\n${list}`);
  }

  parts.push(withWarmClosingEmoji(baseClosing, '✨', '💚'));

  return parts.join('\n\n');
}
