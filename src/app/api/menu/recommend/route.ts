import { NextRequest, NextResponse } from 'next/server';
import { callGeminiJson } from '@/lib/gemini';
import {
  getTargetGroupOption,
  MBG_REGION_OPTIONS,
  MEAL_CATEGORIES,
  sanitizeIngredients,
} from '@/lib/mbg-menus';
import {
  DailyMenuPlan,
  DayKey,
  DishRecipe,
  MbgTargetGroupId,
  MealCategoryKey,
  RecommendMenuRequest,
  WeeklyMenuPlan,
} from '@/types/recommendation';

const DAY_META: { key: DayKey; label: string }[] = [
  { key: 'senin', label: 'Senin' },
  { key: 'selasa', label: 'Selasa' },
  { key: 'rabu', label: 'Rabu' },
  { key: 'kamis', label: 'Kamis' },
  { key: 'jumat', label: 'Jumat' },
];

interface RawAiDish {
  name?: string;
  short_summary?: string;
  prep_minutes?: number;
  cook_minutes?: number;
  ingredients?: unknown[];
  steps?: unknown[];
  kitchen_tips?: string;
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
}

interface RawAiPlan {
  title?: string;
  subtitle?: string;
  days?: Record<string, Record<string, RawAiDish>>;
}

function normalizeDish(
  raw: RawAiDish | undefined,
  dayKey: DayKey,
  category: MealCategoryKey,
  includeMilk: boolean
): DishRecipe {
  if (category === 'susu' && !includeMilk && !raw?.name) {
    return {
      id: `${dayKey}-susu-pengganti`,
      name: 'Air Mineral & Telur/Kalsium Lokal',
      category: 'susu',
      shortSummary: 'Alternatif pengganti susu untuk wilayah non-susu sesuai panduan BGN.',
      prepMinutes: 5,
      cookMinutes: 0,
      ingredients: [
        { name: 'Air mineral kemasan/matang', amountPerPortion: 200, unit: 'ml', group: 'utama' },
      ],
      steps: ['Sajikan air minum higienis bersama tambahan sumber protein/kalsium lokal pada lauk.'],
      nutritionPerPortion: { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 },
    };
  }

  const name = (raw?.name || (category === 'susu' ? 'Susu' : 'Menu MBG')).trim();
  const ingredients = sanitizeIngredients(raw?.ingredients);
  const steps = Array.isArray(raw?.steps)
    ? raw.steps.map((s) => String(s).trim()).filter(Boolean)
    : ['Siapkan seluruh bahan segar, cuci bersih, lalu olah hingga matang sempurna sesuai standar higienitas dapur MBG.'];

  const fallbackNutrition: Record<MealCategoryKey, { c: number; p: number; k: number; f: number }> = {
    karbohidrat: { c: 265, p: 5, k: 58, f: 0.8 },
    protein: { c: 180, p: 16, k: 4, f: 11 },
    sayuran: { c: 60, p: 2.8, k: 7, f: 2.5 },
    buah: { c: 50, p: 0.8, k: 12, f: 0.2 },
    susu: { c: 80, p: 4, k: 6.5, f: 4 },
  };
  const fb = fallbackNutrition[category];

  return {
    id: `ai-${dayKey}-${category}-${Date.now()}`,
    name,
    category,
    shortSummary:
      (raw?.short_summary && String(raw.short_summary).trim()) ||
      `Sajian ${category} bergizi seimbang untuk menu MBG hari ${dayKey}.`,
    prepMinutes: Math.max(0, Number(raw?.prep_minutes) || (category === 'buah' || category === 'susu' ? 5 : 20)),
    cookMinutes: Math.max(0, Number(raw?.cook_minutes) || (category === 'buah' || category === 'susu' ? 0 : 25)),
    ingredients:
      ingredients.length > 0
        ? ingredients
        : [
            {
              name,
              amountPerPortion: category === 'susu' ? 1 : 70,
              unit: category === 'susu' ? 'kotak' : 'g',
              group: 'utama',
            },
          ],
    steps,
    kitchenTips: raw?.kitchen_tips ? String(raw.kitchen_tips).trim() : undefined,
    nutritionPerPortion: {
      calories: Math.max(0, Math.round(Number(raw?.nutrition?.calories) || fb.c)),
      proteinGrams: Math.max(0, Math.round((Number(raw?.nutrition?.protein_g) || fb.p) * 10) / 10),
      carbsGrams: Math.max(0, Math.round((Number(raw?.nutrition?.carbs_g) || fb.k) * 10) / 10),
      fatGrams: Math.max(0, Math.round((Number(raw?.nutrition?.fat_g) || fb.f) * 10) / 10),
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<RecommendMenuRequest>;
    const targetGroupId: MbgTargetGroupId = body.targetGroup || 'sd_4_6';
    const targetGroup = getTargetGroupOption(targetGroupId);
    const regionObj =
      MBG_REGION_OPTIONS.find((r) => r.id === body.regionPreference) ||
      MBG_REGION_OPTIONS[0];
    const includeMilk = body.includeMilk !== false;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 240) : '';
    const avoidDishes = Array.isArray(body.avoidDishes)
      ? body.avoidDishes.slice(0, 15).map((d) => String(d).trim()).filter(Boolean)
      : [];

    const systemPrompt = `Kamu adalah Ahli Gizi & Perencana Siklus Menu Program Makan Bergizi Gratis (MBG) Badan Gizi Nasional (BGN) Indonesia.

Rancang 1 siklus menu MBG selama 5 hari kerja (Senin sampai Jumat) yang realistis, lazim dimasak dapur SPPG Indonesia, bergizi seimbang (Isi Piringku & AKG Kemenkes), rendah gula-garam-lemak berlebih, tidak pedas menyengat, dan variatif setiap hari (protein tidak berulang berturut-turut).

Konteks permintaan:
- Kelompok sasaran utama: ${targetGroup.label} (${targetGroup.energyTargetKcal})
- Preferensi pangan / wilayah: ${regionObj.label}
- Susu harian: ${includeMilk ? 'Ya, sertakan Susu (plain/rendah gula) setiap hari' : 'Tanpa susu kemasan; isi kategori susu dengan pengganti kalsium/minuman sehat lokal (mis. puding tahu, susu kedelai, atau tambahan protein lokal)'}
${notes ? `- Catatan khusus / alergi / pantangan: ${notes}` : ''}
${avoidDishes.length > 0 ? `- Hindari mengulang persis menu berikut agar segar: ${avoidDishes.join(', ')}` : ''}

ATURAN PENTING TAKARAN:
- SEMUA "amount_per_portion" pada ingredients WAJIB ditulis sebagai berat/jumlah mentah untuk TEPAT 1 PORSI STANDAR (acuan SD kelas 4–6, karena sistem akan mengalikan otomatis sesuai jumlah porsi & kelompok usia di frontend!).
- Gunakan satuan dapur standar Indonesia yang jelas: "g", "ml", "butir", "buah", "kotak", "lembar", "batang".
- Nama menu singkat, jelas, dan rapi seperti tabel siklus MBG resmi (contoh: "Nasi Putih", "Ayam Kecap Mentega", "Ikan Tongkol Balado Ringan", "Tumis Buncis Tempe", "Pisang Ambon", "Susu").
- Setiap dish wajib punya: name, short_summary (1 kalimat), prep_minutes, cook_minutes, ingredients (3-6 item untuk masakan utama/sayur, 1-2 item untuk buah/susu), steps (3-4 langkah praktis untuk masakan, 1-2 langkah untuk buah/susu), kitchen_tips (1 tips singkat keamanan pangan/masak massal), nutrition { calories, protein_g, carbs_g, fat_g }.
- Output WAJIB JSON valid murni tanpa teks pengantar.

Struktur JSON wajib:
{
  "title": "Siklus Rekomendasi AI — ...",
  "subtitle": "Ringkasan 1 kalimat fokus gizi & variasi pekan ini",
  "days": {
    "senin": { "karbohidrat": {...}, "protein": {...}, "sayuran": {...}, "buah": {...}, "susu": {...} },
    "selasa": { "karbohidrat": {...}, "protein": {...}, "sayuran": {...}, "buah": {...}, "susu": {...} },
    "rabu": { "karbohidrat": {...}, "protein": {...}, "sayuran": {...}, "buah": {...}, "susu": {...} },
    "kamis": { "karbohidrat": {...}, "protein": {...}, "sayuran": {...}, "buah": {...}, "susu": {...} },
    "jumat": { "karbohidrat": {...}, "protein": {...}, "sayuran": {...}, "buah": {...}, "susu": {...} }
  }
}`;

    const aiResponse = await callGeminiJson<RawAiPlan>({
      parts: [{ text: systemPrompt }],
      temperature: 0.7,
      maxOutputTokens: 8192,
      timeoutMs: 25000,
      logContext: 'Gemini MBG Menu Recommender API',
    });

    if (!aiResponse.success || !aiResponse.data) {
      return NextResponse.json(
        {
          success: false,
          isRateLimited: aiResponse.isRateLimited,
          message:
            aiResponse.message ||
            'AI gagal menyusun rekomendasi menu MBG saat ini. Silakan coba kembali.',
        },
        { status: aiResponse.status || 500 }
      );
    }

    const rawPlan = aiResponse.data;
    const rawDays = rawPlan.days || {};

    const days: DailyMenuPlan[] = DAY_META.map(({ key, label }) => {
      const rawDay = rawDays[key] || rawDays[label] || rawDays[label.toLowerCase()] || {};
      const meals = {} as Record<MealCategoryKey, DishRecipe>;
      for (const cat of MEAL_CATEGORIES) {
        meals[cat.key] = normalizeDish(rawDay[cat.key], key, cat.key, includeMilk);
      }
      return {
        dayKey: key,
        dayLabel: label,
        meals,
      };
    });

    const weeklyPlan: WeeklyMenuPlan = {
      id: `ai-week-${Date.now()}`,
      title: (rawPlan.title && rawPlan.title.trim()) || `Rekomendasi AI (${regionObj.label})`,
      subtitle:
        (rawPlan.subtitle && rawPlan.subtitle.trim()) ||
        `Siklus menu MBG Senin–Jumat disesuaikan untuk ${targetGroup.shortLabel}.`,
      source: 'ai',
      regionLabel: regionObj.label,
      days,
    };

    return NextResponse.json({
      success: true,
      data: weeklyPlan,
    });
  } catch (error) {
    console.error('API menu recommend error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat menyusun rekomendasi menu MBG.' },
      { status: 500 }
    );
  }
}
