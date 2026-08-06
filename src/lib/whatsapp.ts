/**
 * Normalize Indonesian WhatsApp number into 628xxx format
 */
export function normalizePhone(phone: string): string {
  let value = phone.replace(/\D/g, '');

  if (value.startsWith('0')) {
    value = '62' + value.substring(1);
  }

  if (!value.startsWith('62')) {
    value = '62' + value;
  }

  return value;
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Indonesian numbers: 628 followed by 7-11 digits
  return /^628\d{7,11}$/.test(normalized);
}

/**
 * Open WhatsApp via deep link wa.me
 */
export function openWhatsApp(phone: string, caption: string): void {
  const normalized = normalizePhone(phone);
  const url = `https://wa.me/${normalized}?text=` + encodeURIComponent(caption);
  window.open(url, '_blank');
}
