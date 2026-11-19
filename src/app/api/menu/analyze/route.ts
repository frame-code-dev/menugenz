import { NextRequest, NextResponse } from 'next/server';
import { callGeminiJson, GeminiPart } from '@/lib/gemini';
import { MenuMediaType } from '@/types/menu';

const VALID_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VALID_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/3gpp',
  'video/x-m4v',
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIRECT_VIDEO_BYTES = 15 * 1024 * 1024; // 15 MB direct video cap
const MAX_FRAMES_COUNT = 8;

interface GeminiMenuRaw {
  date?: string | null;
  recipients?: unknown;
  menus?: unknown;
  opening_hook?: string;
  closing_note?: string;
  mbg_note?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Backwards-compatible inputs:
    // 1. 'image' (legacy single image upload)
    // 2. 'media' (direct small video upload)
    // 3. 'frames' (multiple HD keyframes extracted client-side from a video)
    const imageFile = formData.get('image') as File | null;
    const directMediaFile = formData.get('media') as File | null;
    const frameFiles = formData
      .getAll('frames')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const requestedType = String(formData.get('mediaType') || '').toLowerCase();
    let mediaType: MenuMediaType = 'image';
    const mediaParts: GeminiPart[] = [];

    if (frameFiles.length > 0) {
      mediaType = 'video';
      const cappedFrames = frameFiles.slice(0, MAX_FRAMES_COUNT);
      for (const frame of cappedFrames) {
        if (!VALID_IMAGE_MIMES.includes(frame.type || 'image/jpeg')) {
          return NextResponse.json(
            { success: false, message: 'Format frame video tidak valid.' },
            { status: 400 }
          );
        }
        if (frame.size > 4 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, message: 'Ukuran frame video terlalu besar.' },
            { status: 400 }
          );
        }
        const buf = await frame.arrayBuffer();
        mediaParts.push({
          inline_data: {
            mime_type: frame.type || 'image/jpeg',
            data: Buffer.from(buf).toString('base64'),
          },
        });
      }
    } else if (directMediaFile && directMediaFile.size > 0) {
      const mime = directMediaFile.type || 'video/mp4';
      const isVid = VALID_VIDEO_MIMES.includes(mime) || mime.startsWith('video/');
      if (!isVid) {
        return NextResponse.json(
          { success: false, message: 'Format video harus MP4, MOV, atau WEBM.' },
          { status: 400 }
        );
      }
      if (directMediaFile.size > MAX_DIRECT_VIDEO_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: 'Ukuran video langsung terlalu besar. Gunakan mode ekstraksi frame otomatis.',
          },
          { status: 400 }
        );
      }
      mediaType = 'video';
      const buf = await directMediaFile.arrayBuffer();
      mediaParts.push({
        inline_data: {
          mime_type: mime,
          data: Buffer.from(buf).toString('base64'),
        },
      });
    } else if (imageFile && imageFile.size > 0) {
      if (!VALID_IMAGE_MIMES.includes(imageFile.type)) {
        return NextResponse.json(
          { success: false, message: 'Format gambar harus JPG, JPEG, PNG, atau WEBP.' },
          { status: 400 }
        );
      }
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { success: false, message: 'Ukuran gambar maksimal 10 MB.' },
          { status: 400 }
        );
      }
      mediaType = requestedType === 'video' ? 'video' : 'image';
      const buf = await imageFile.arrayBuffer();
      mediaParts.push({
        inline_data: {
          mime_type: imageFile.type || 'image/jpeg',
          data: Buffer.from(buf).toString('base64'),
        },
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Foto atau video menu wajib diunggah.' },
        { status: 400 }
      );
    }

    const mediaContextInstruction =
      mediaType === 'video'
        ? 'Kamu menerima video (atau beberapa frame berurutan dari video) yang menampilkan sajian/daftar menu makanan program Makan Bergizi Gratis (MBG). Gabungkan semua nama makanan/minuman, tanggal, dan penerima yang terlihat (atau terdengar bila berupa video langsung) dari seluruh bagian video tanpa duplikasi.'
        : 'Kamu menerima foto/poster menu makanan program Makan Bergizi Gratis (MBG).';

    const systemPrompt = `Kamu adalah AI Vision sekaligus Copywriter Bahasa Indonesia profesional untuk program Makan Bergizi Gratis (MBG).

${mediaContextInstruction}

Tugas utama:
1. Identifikasi tanggal menu jika terlihat (format YYYY-MM-DD, atau null jika tidak ada).
2. Identifikasi target penerima jika tersedia (contoh: "Siswa SD", "PAUD/TK", "SMP", dll).
3. Identifikasi semua nama makanan/minuman yang terlihat atau tertulis.
4. Gunakan OCR/teks sebagai sumber utama jika ada, lalu lengkapi dengan pengamatan visual makanan secara akurat.
5. Jangan mengarang nama makanan yang tidak berdasar pada media.
6. Jangan memasukkan angka gizi/kalori/gramasi, logo, dekorasi, atau nama kategori generik sebagai nama makanan kecuali memang nama sajiannya.
7. Pertahankan urutan menu yang logis (Karbohidrat → Protein → Sayuran → Buah → Susu/Minuman).
8. Tulis "opening_hook" (1–2 kalimat) dan "closing_note" (2 kalimat) dengan gaya COPYWRITER FORMAL TAPI SANTAI:
   - Sopan, rapi, dan layak untuk grup WhatsApp sekolah/wali murid/instansi SPPG.
   - Hangat, mengalir, manusiawi, komunikatif — BUKAN bahasa birokratis kaku, BUKAN bahasa iklan berlebihan, dan BUKAN bahasa gaul/alay.
   - Hindari klise AI seperti "hadir mendukung generasi emas penerus bangsa".
   - Gunakan 1–2 emoji yang hangat, rapi, dan relevan secara proporsional (misal 🍽️, ✨, 💚) agar enak dibaca di WhatsApp tanpa terkesan ramai/spammy.
   - Kaitkan "closing_note" secara natural dengan menu spesifik yang benar-benar ada (misalnya menyinggung sumber protein, sayur, atau buah pada sajian tersebut).
9. Output WAJIB berupa JSON valid saja tanpa teks lain.

Format JSON:
{
  "date": "YYYY-MM-DD atau null",
  "recipients": [],
  "menus": [],
  "opening_hook": "1-2 kalimat pembuka copywriter formal tapi santai.",
  "closing_note": "2 kalimat penutup hangat dan edukatif yang relevan dengan menu."
}`;

    const aiResponse = await callGeminiJson<GeminiMenuRaw>({
      parts: [{ text: systemPrompt }, ...mediaParts],
      temperature: 0.35,
      logContext: 'Gemini Menu Vision API',
    });

    if (!aiResponse.success || !aiResponse.data) {
      return NextResponse.json(
        {
          success: false,
          isRateLimited: aiResponse.isRateLimited,
          message:
            aiResponse.message ||
            'Gagal membaca media menu dengan AI. Silakan coba kembali beberapa saat lagi.',
        },
        { status: aiResponse.status || 500 }
      );
    }

    const parsed = aiResponse.data;
    const menus = Array.isArray(parsed.menus)
      ? parsed.menus.map((m) => String(m).trim()).filter(Boolean)
      : [];
    const recipients = Array.isArray(parsed.recipients)
      ? parsed.recipients.map((r) => String(r).trim()).filter(Boolean)
      : [];

    if (menus.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            mediaType === 'video'
              ? 'Tidak ditemukan menu makanan yang jelas pada video. Pastikan makanan atau tulisan menu terlihat terang dan tidak terlalu cepat.'
              : 'Tidak ditemukan menu makanan pada gambar. Pastikan foto menu terlihat jelas.',
        },
        { status: 422 }
      );
    }

    const closingNote =
      (typeof parsed.closing_note === 'string' && parsed.closing_note.trim()) ||
      (typeof parsed.mbg_note === 'string' && parsed.mbg_note.trim()) ||
      undefined;
    const openingHook =
      typeof parsed.opening_hook === 'string' && parsed.opening_hook.trim()
        ? parsed.opening_hook.trim()
        : undefined;

    return NextResponse.json({
      success: true,
      data: {
        date: parsed.date && parsed.date !== 'null' ? String(parsed.date) : null,
        recipients,
        menus,
        mbgNote: closingNote,
        openingHook,
        closingNote,
        mediaType,
      },
    });
  } catch (error) {
    console.error('API menu analyze error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses media menu.' },
      { status: 500 }
    );
  }
}
