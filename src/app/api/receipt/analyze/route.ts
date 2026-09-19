import { NextRequest, NextResponse } from 'next/server';
import { ReceiptItem, ReceiptResult } from '@/types/receipt';

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

    const apiKey = (process.env.AI_API_KEY || '').trim();
    const model = process.env.AI_MODEL || 'gemini-flash-latest';
    const baseUrl = process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'AI_API_KEY belum diatur di Environment Variables.',
        },
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
9. "receipt_note": TEPAT 1-2 kalimat ringkasan catatan belanja operasional / bahan makanan program MBG yang edukatif dan profesional.
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

    const primaryModel = (process.env.AI_MODEL || 'gemini-flash-latest').trim();
    const candidateModels = Array.from(
      new Set([primaryModel, 'gemini-3.5-flash', 'gemini-flash-lite-latest'])
    );

    let rawText: string | null = null;
    let lastErrorStatus: number = 500;
    let lastErrorMessage: string = 'Layanan AI sedang sibuk. Silakan coba beberapa saat lagi.';
    let isRateLimited = false;

    for (const modelToTry of candidateModels) {
      let modelSuccess = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const endpoint = `${baseUrl}/models/${modelToTry}:generateContent?key=${apiKey}`;

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    {
                      inline_data: {
                        mime_type: file.type || 'image/jpeg',
                        data: base64Image,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.1,
              },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini Receipt Vision API error (model: ${modelToTry}, attempt: ${attempt}):`, errorText);
            lastErrorStatus = response.status;

            if (response.status === 429) {
              isRateLimited = true;
              lastErrorMessage = 'Batas penggunaan AI harian/menit telah tercapai. Silakan coba kembali beberapa saat lagi.';
            } else if (response.status === 503) {
              lastErrorMessage = 'Layanan AI sedang mengalami lonjakan beban. Sedang mencoba kembali...';
            }

            // If 503 or 429, wait briefly before retrying
            if (response.status === 503 || response.status === 429) {
              await new Promise((res) => setTimeout(res, 1200 * attempt));
              continue;
            }

            // For other HTTP errors (e.g. 404), break to try next model immediately
            break;
          }

          const result = await response.json();
          const parts = result.candidates?.[0]?.content?.parts;

          // Helper to extract clean JSON string
          if (Array.isArray(parts) && parts.length > 0) {
            let combined = '';
            for (const p of parts) {
              if (p && typeof p.text === 'string') {
                combined += p.text;
              }
            }
            combined = combined.trim();

            const fenceMatch = combined.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (fenceMatch && fenceMatch[1]) {
              rawText = fenceMatch[1].trim();
            } else {
              const start = combined.indexOf('{');
              const end = combined.lastIndexOf('}');
              if (start !== -1 && end > start) {
                rawText = combined.substring(start, end + 1).trim();
              } else {
                rawText = combined;
              }
            }
          }

          if (rawText) {
            modelSuccess = true;
            break;
          }
        } catch (fetchErr: any) {
          console.warn(`Fetch attempt ${attempt} for model ${modelToTry} failed:`, fetchErr?.message || fetchErr);
          if (attempt < 2) {
            await new Promise((res) => setTimeout(res, 1000 * attempt));
          }
        }
      }

      if (modelSuccess && rawText) {
        break;
      }
    }

    if (!rawText) {
      if (isRateLimited) {
        return NextResponse.json(
          {
            success: false,
            isRateLimited: true,
            message: lastErrorMessage,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: lastErrorMessage || 'Gagal membaca struk dengan AI. Silakan coba kembali beberapa saat lagi.',
        },
        { status: lastErrorStatus || 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('JSON parse error from Gemini output:', parseErr, 'Raw:', rawText);
      return NextResponse.json(
        { success: false, message: 'Hasil pembacaan struk dari AI tidak dalam format yang valid. Silakan coba lagi.' },
        { status: 500 }
      );
    }

    // Format and sanitize items
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const formattedItems: ReceiptItem[] = rawItems
      .filter((item: any) => item && (item.name || item.total_price))
      .map((item: any) => ({
        name: String(item.name || 'Item Tanpa Nama').trim(),
        qty: item.qty !== undefined && item.qty !== null ? item.qty : null,
        unit: item.unit ? String(item.unit).trim() : null,
        pricePerUnit:
          typeof item.price_per_unit === 'number'
            ? item.price_per_unit
            : item.price_per_unit
            ? parseFloat(String(item.price_per_unit).replace(/[^\d.-]/g, '')) || null
            : null,
        totalPrice:
          typeof item.total_price === 'number'
            ? item.total_price
            : item.total_price
            ? parseFloat(String(item.total_price).replace(/[^\d.-]/g, '')) || null
            : null,
      }));

    // Calculate total if missing
    let totalAmount =
      typeof parsed.total_amount === 'number'
        ? parsed.total_amount
        : parsed.total_amount
        ? parseFloat(String(parsed.total_amount).replace(/[^\d.-]/g, '')) || null
        : null;

    if (totalAmount === null && formattedItems.length > 0) {
      const sum = formattedItems.reduce(
        (acc, item) => acc + (typeof item.totalPrice === 'number' ? item.totalPrice : 0),
        0
      );
      if (sum > 0) totalAmount = sum;
    }

    const receiptResult: ReceiptResult = {
      merchantName: parsed.merchant_name && parsed.merchant_name !== 'null' ? parsed.merchant_name : null,
      date: parsed.date && parsed.date !== 'null' ? parsed.date : null,
      items: formattedItems,
      subtotal:
        typeof parsed.subtotal === 'number'
          ? parsed.subtotal
          : parsed.subtotal
          ? parseFloat(String(parsed.subtotal).replace(/[^\d.-]/g, '')) || null
          : null,
      discount:
        typeof parsed.discount === 'number'
          ? parsed.discount
          : parsed.discount
          ? parseFloat(String(parsed.discount).replace(/[^\d.-]/g, '')) || null
          : null,
      tax:
        typeof parsed.tax === 'number'
          ? parsed.tax
          : parsed.tax
          ? parseFloat(String(parsed.tax).replace(/[^\d.-]/g, '')) || null
          : null,
      totalAmount,
      paymentMethod:
        parsed.payment_method && parsed.payment_method !== 'null' ? parsed.payment_method : null,
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
