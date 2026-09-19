import { ReceiptResult } from '@/types/receipt';
import { formatIndonesianDate } from '@/lib/caption';

/**
 * Format number to Indonesian Rupiah currency format, e.g. Rp 15.000
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '-';
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('IDR', 'Rp');
}

/**
 * Generate formatted WhatsApp caption / report text from structured ReceiptResult
 */
export function generateReceiptCaption(data: ReceiptResult): string {
  const parts: string[] = [];

  // Header Title
  parts.push('🧾 *LAPORAN RINCIAN BELANJA / STRUK*');

  // Date & Merchant metadata
  const meta: string[] = [];
  const formattedDate = formatIndonesianDate(data.date);
  if (formattedDate) {
    meta.push(`📅 *Tanggal:* ${formattedDate}`);
  }
  if (data.merchantName) {
    meta.push(`🏪 *Toko / Tempat:* ${data.merchantName}`);
  }
  if (data.paymentMethod) {
    meta.push(`💳 *Metode Pembayaran:* ${data.paymentMethod}`);
  }

  if (meta.length > 0) {
    parts.push(meta.join('\n'));
  }

  // Itemized List
  if (data.items && data.items.length > 0) {
    const itemList = data.items.map((item, index) => {
      let itemLine = `${index + 1}. *${item.name}*`;

      const details: string[] = [];
      if (item.qty !== null && item.qty !== undefined && item.qty !== '') {
        const unitStr = item.unit ? ` ${item.unit}` : '';
        const pricePerUnitStr =
          item.pricePerUnit !== null && item.pricePerUnit !== undefined
            ? ` @ ${formatRupiah(item.pricePerUnit)}`
            : '';
        details.push(`(${item.qty}${unitStr}${pricePerUnitStr})`);
      }

      if (item.totalPrice !== null && item.totalPrice !== undefined) {
        details.push(`= ${formatRupiah(item.totalPrice)}`);
      }

      if (details.length > 0) {
        itemLine += ` ${details.join(' ')}`;
      }

      return itemLine;
    }).join('\n');

    parts.push(`📋 *Rincian Item:*\n${itemList}`);
  }

  // Summary / Totals
  const totals: string[] = [];
  if (data.subtotal !== null && data.subtotal !== undefined && data.subtotal > 0 && (data.discount || data.tax)) {
    totals.push(`- Subtotal: ${formatRupiah(data.subtotal)}`);
  }
  if (data.discount !== null && data.discount !== undefined && data.discount > 0) {
    totals.push(`- Diskon / Potongan: -${formatRupiah(data.discount)}`);
  }
  if (data.tax !== null && data.tax !== undefined && data.tax > 0) {
    totals.push(`- Pajak / PPN: ${formatRupiah(data.tax)}`);
  }
  if (data.totalAmount !== null && data.totalAmount !== undefined) {
    totals.push(`💵 *TOTAL AKHIR:* *${formatRupiah(data.totalAmount)}*`);
  }

  if (totals.length > 0) {
    parts.push(`💰 *Ringkasan Biaya:*\n${totals.join('\n')}`);
  }

  // Note / Footer
  const defaultNote =
    data.receiptNote ||
    '✨ Laporan rincian belanja operasional & bahan baku program Makan Bergizi Gratis (MBG). Transaksi telah sesuai dengan bukti fisik struk/nota terlampir.';
  parts.push(defaultNote);

  return parts.join('\n\n');
}
