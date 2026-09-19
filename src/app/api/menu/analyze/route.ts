import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Gambar menu wajib diunggah.' },
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
      return NextResponse.json({
        success: false,
        message: 'AI_API_KEY belum diisi di Environment Variables.',
      }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const systemPrompt = `Kamu adalah AI Vision untuk membaca gambar menu makanan program Makan Bergizi Gratis (MBG).

Tugas utama kamu adalah mengekstrak informasi menu makanan dari gambar yang diberikan dan memberikan narasi singkat seputar MBG.

Analisis gambar dengan teliti dan lakukan:
1. Identifikasi tanggal menu jika tanggal terlihat pada gambar.
2. Identifikasi target penerima jika tersedia.
3. Identifikasi semua nama makanan/minuman yang terlihat atau tertulis pada gambar.
4. Gunakan OCR/teks pada gambar sebagai sumber utama untuk nama makanan.
5. Gunakan konteks visual makanan untuk membantu memahami nama makanan.
6. Jangan mengarang nama makanan yang tidak memiliki dasar dari gambar.
7. Jika tulisan kurang jelas, pilih nama yang paling masuk akal berdasarkan teks dan visual yang tersedia.
8. Jangan memasukkan kandungan gizi sebagai nama makanan.
9. Jangan memasukkan angka kalori, protein, lemak, karbohidrat, serat, vitamin, atau mineral ke daftar menu.
10. Jangan memasukkan dekorasi atau tulisan yang bukan nama makanan.
11. Jangan memasukkan logo sebagai menu.
12. Jangan memasukkan nama kategori makanan sebagai menu kecuali memang tertulis sebagai nama menu.
13. Buat field "mbg_note" yang berisi TEPAT 2 KALIMAT menarik dan edukatif seputar program Makan Bergizi Gratis (MBG) yang relevan dengan menu pada gambar.
14. Pertahankan urutan menu yang paling masuk akal berdasarkan posisi pada gambar.
15. Output harus JSON valid saja.

Format output:
{
  "date": "YYYY-MM-DD atau null",
  "recipients": [],
  "menus": [],
  "mbg_note": "Tepat 2 kalimat menarik tentang Program Makan Bergizi Gratis (MBG)."
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
                temperature: 0.2,
              },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini Vision API error (model: ${modelToTry}, attempt: ${attempt}):`, errorText);
            lastErrorStatus = response.status;

            if (response.status === 429) {
              isRateLimited = true;
              lastErrorMessage = 'Batas penggunaan AI harian/menit telah tercapai. Silakan coba kembali beberapa saat lagi.';
            } else if (response.status === 503) {
              lastErrorMessage = 'Layanan AI sedang mengalami lonjakan beban. Sedang mencoba kembali...';
            }

            if (response.status === 503 || response.status === 429) {
              await new Promise((res) => setTimeout(res, 1200 * attempt));
              continue;
            }

            break;
          }

          const result = await response.json();
          const parts = result.candidates?.[0]?.content?.parts;

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
          message: lastErrorMessage || 'Gagal membaca gambar menu dengan AI. Silakan coba kembali beberapa saat lagi.',
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
        { success: false, message: 'Hasil pembacaan menu dari AI tidak dalam format yang valid. Silakan coba lagi.' },
        { status: 500 }
      );
    }

    const menuResult = {
      date: parsed.date && parsed.date !== 'null' ? parsed.date : null,
      recipients: Array.isArray(parsed.recipients) ? parsed.recipients : [],
      menus: Array.isArray(parsed.menus) ? parsed.menus : [],
      mbgNote: parsed.mbg_note || undefined,
    };

    if (menuResult.menus.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ditemukan menu makanan pada gambar.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: menuResult,
    });
  } catch (error) {
    console.error('API analyze error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses gambar.' },
      { status: 500 }
    );
  }
}
