import { NextRequest, NextResponse } from 'next/server';
import { callGeminiJson } from '@/lib/gemini';
import { ReceiptItem, ReceiptResult } from '@/types/receipt';

interface GeminiReceiptRaw {
  merchant_name?: string | null;
  date?: string | null;
  items?: Array<{
    name?: unknown;
    qty?: unknown;
    unit?: unknown;
    price_per_unit?: unknown;
    total_price?: unknown;
  }>;
  subtotal?: unknown;
  discount?: unknown;
  tax?: unknown;
  total_amount?: unknown;
  payment_method?: string | null;
  receipt_note?: string | null;
}

function parseNumeric(val: unknown): number | null {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (val !== undefined && val !== null && val !== '') {
    const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Foto struk atau nota belanja wajib diunggah.' },
        { status: 400 }
      );
    }

    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Format gambar harus JPG, JPEG, PNG, atau WEBP.' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'Ukuran gambar maksimal 10 MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const systemPrompt = `Kamu adalah AI OCR & Vision Spesialis Analisis Struk dan Nota Belanja Indonesia (Receipt & Invoice Parser).

Tugas utama kamu adalah membaca foto struk kasir, nota belanja, bon kontan, kwitansi, atau faktur pembelian (termasuk struk minimarket seperti Indomaret/Alfamart/Superindo, nota pasar tradisional tulisan tangan, bon warung sembako, dan pembelian bahan pangan).

Ekstrak seluruh informasi rincian belanja secara akurat dengan aturan berikut:
1. "merchant_name": Nama toko, minimarket, pasar, supplier, atau penjual. Jika tidak tertulis, isi null.
2. "date": Tanggal transaksi dalam format "YYYY-MM-DD". Jika tidak terlihat atau tidak ada tahun, perkirakan atau kembalikan null jika benar-benar tidak terbaca.
3. "items": Daftar semua barang atau jasa yang dibeli.
   - "name": Nama item atau nama barang yang dibeli (perbaiki typo jika akibat OCR buram, tapi tetap sesuai konteks barang).
   - "qty": Jumlah/kuantitas (angka atau string seperti 1, 2.5, "2 kg", "1 ikat", dll), null jika tidak tertera.
   - "unit": Satuan (misal: "kg", "pcs", "ikat", "liter", "dus", "bks", "gr"), null jika tidak ada.
   - "price_per_unit": Harga satuan dalam bentuk angka murni (tanpa "Rp" atau titik), null jika tidak tertera.
   - "total_price": Total harga baris item tersebut dalam angka murni (tanpa "Rp" atau titik).
4. "subtotal": Subtotal belanja sebelum diskon/pajak (angka murni), null jika tidak tertera.
5. "discount": Total potongan harga/diskon jika ada (angka murni), null jika tidak ada.
6. "tax": Pajak/PPN jika ada (angka murni), null jika tidak ada.
7. "total_amount": TOTAL AKHIR / TOTAL BAYAR (Grand Total) dalam angka murni. Jika tidak ada angka total bayar yang tertulis jelas, hitung penjumlahan dari seluruh item.
8. "payment_method": Metode pembayaran jika tertulis (contoh: "Tunai / Cash", "QRIS", "BCA", "GoPay", "ShopeePay", dll), null jika tidak ada.
9. "receipt_note": TEPAT 1-2 kalimat ringkasan catatan belanja operasional / bahan makanan program MBG yang formal namun santai dan rapi.
10. Semua angka harga ("price_per_unit", "total_price", "subtotal", "discount", "tax", "total_amount") WAJIB berupa NUMBER numerik (misal 15000 bukan "15.000" atau "Rp 15.000").
11. Pertahankan urutan item sesuai yang tercetak pada struk.
12. Output WAJIB JSON murni valid tanpa teks pengantar tambahan.

Format JSON yang harus dihasilkan:
{
  "merchant_name": "Nama Toko / Minimarket / Pasar atau null",
  "date": "YYYY-MM-DD atau null",
  "items": [
    {
      "name": "Nama Barang",
      "qty": 2,
      "unit": "kg",
      "price_per_unit": 28000,
      "total_price": 56000
    }
  ],
  "subtotal": 56000,
  "discount": null,
  "tax": null,
  "total_amount": 56000,
  "payment_method": "Tunai atau null",
  "receipt_note": "Ringkasan 1-2 kalimat catatan pembelian."
}`;

    const aiResponse = await callGeminiJson<GeminiReceiptRaw>({
      parts: [
        { text: systemPrompt },
        {
          inline_data: {
            mime_type: file.type || 'image/jpeg',
            data: base64Image,
          },
        },
      ],
      temperature: 0.1,
      logContext: 'Gemini Receipt Vision API',
    });

    if (!aiResponse.success || !aiResponse.data) {
      return NextResponse.json(
        {
          success: false,
          isRateLimited: aiResponse.isRateLimited,
          message:
            aiResponse.message ||
            'Gagal membaca struk dengan AI. Silakan coba kembali beberapa saat lagi.',
        },
        { status: aiResponse.status || 500 }
      );
    }

    const parsed = aiResponse.data;
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const formattedItems: ReceiptItem[] = rawItems
      .filter((item) => item && (item.name || item.total_price))
      .map((item) => ({
        name: String(item.name || 'Item Tanpa Nama').trim(),
        qty:
          item.qty !== undefined && item.qty !== null
            ? (item.qty as number | string)
            : null,
        unit: item.unit ? String(item.unit).trim() : null,
        pricePerUnit: parseNumeric(item.price_per_unit),
        totalPrice: parseNumeric(item.total_price),
      }));

    let totalAmount = parseNumeric(parsed.total_amount);

    if (totalAmount === null && formattedItems.length > 0) {
      const sum = formattedItems.reduce(
        (acc, item) => acc + (typeof item.totalPrice === 'number' ? item.totalPrice : 0),
        0
      );
      if (sum > 0) totalAmount = sum;
    }

    const receiptResult: ReceiptResult = {
      merchantName:
        parsed.merchant_name && parsed.merchant_name !== 'null'
          ? String(parsed.merchant_name)
          : null,
      date: parsed.date && parsed.date !== 'null' ? String(parsed.date) : null,
      items: formattedItems,
      subtotal: parseNumeric(parsed.subtotal),
      discount: parseNumeric(parsed.discount),
      tax: parseNumeric(parsed.tax),
      totalAmount,
      paymentMethod:
        parsed.payment_method && parsed.payment_method !== 'null'
          ? String(parsed.payment_method)
          : null,
      receiptNote: parsed.receipt_note || undefined,
    };

    if (receiptResult.items.length === 0 && !receiptResult.totalAmount) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Tidak ditemukan data transaksi atau daftar item pada gambar struk. Pastikan foto struk terlihat terang dan jelas.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: receiptResult,
    });
  } catch (error) {
    console.error('API receipt analyze error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memproses gambar struk.' },
      { status: 500 }
    );
  }
}
