/**
 * Normalize Indonesian WhatsApp number into 628xxx format
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    return '62' + digits.substring(1);
  }

  if (digits.startsWith('62')) {
    return digits;
  }

  return '62' + digits;
}

/**
 * Validate Indonesian mobile phone number (628 followed by 7-11 digits)
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^628\d{7,11}$/.test(normalized);
}

/**
 * Return local YYYY-MM-DD date string (avoids UTC midnight drift)
 */
export function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Open WhatsApp via deep link wa.me securely with noopener,noreferrer
 */
export function openWhatsApp(phone: string, caption: string): void {
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  const url = `https://wa.me/${normalized}?text=` + encodeURIComponent(caption);
  window.open(url, '_blank', 'noopener,noreferrer');
}
