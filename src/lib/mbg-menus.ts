import {
  AggregatedShoppingItem,
  DailyMenuPlan,
  DayKey,
  DishRecipe,
  MbgTargetGroupId,
  MbgTargetGroupOption,
  MealCategoryKey,
  NutritionEstimate,
  RecipeIngredient,
  WeeklyMenuPlan,
  WeeklyNutritionAnalysis,
} from '@/types/recommendation';

export const MBG_TARGET_GROUPS: MbgTargetGroupOption[] = [
  {
    id: 'paud_tk',
    label: 'PAUD / TK (4–6 Tahun)',
    shortLabel: 'PAUD / TK',
    portionMultiplier: 0.7,
    energyTargetKcal: '350–450 kkal',
    description: 'Porsi lebih kecil dengan tekstur lembut dan bumbu tidak pedas.',
  },
  {
    id: 'sd_1_3',
    label: 'SD Kelas 1–3 (7–9 Tahun)',
    shortLabel: 'SD Kls 1–3',
    portionMultiplier: 0.85,
    energyTargetKcal: '450–550 kkal',
    description: 'Porsi anak sekolah dasar awal dengan fokus protein & kalsium.',
  },
  {
    id: 'sd_4_6',
    label: 'SD Kelas 4–6 (10–12 Tahun)',
    shortLabel: 'SD Kls 4–6',
    portionMultiplier: 1.0,
    energyTargetKcal: '550–650 kkal',
    description: 'Standar porsi dasar acuan MBG anak sekolah dasar lanjutan.',
  },
  {
    id: 'smp',
    label: 'SMP (13–15 Tahun)',
    shortLabel: 'SMP',
    portionMultiplier: 1.2,
    energyTargetKcal: '650–750 kkal',
    description: 'Kebutuhan energi & protein meningkat untuk masa pertumbuhan remaja.',
  },
  {
    id: 'sma_smk',
    label: 'SMA / SMK (16–18 Tahun)',
    shortLabel: 'SMA / SMK',
    portionMultiplier: 1.3,
    energyTargetKcal: '700–850 kkal',
    description: 'Porsi penuh remaja akhir untuk mendukung aktivitas belajar padat.',
  },
  {
    id: 'ibu_hamil_menyusui',
    label: 'Ibu Hamil & Menyusui',
    shortLabel: 'Bumil / Busui',
    portionMultiplier: 1.25,
    energyTargetKcal: '700–820 kkal',
    description: 'Prioritas protein hewani, zat besi, asam folat, dan kalsium tinggi.',
  },
];

export const MEAL_CATEGORIES: {
  key: MealCategoryKey;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'karbohidrat', label: 'Karbohidrat', shortLabel: 'Karbo' },
  { key: 'protein', label: 'Protein', shortLabel: 'Protein' },
  { key: 'sayuran', label: 'Sayuran', shortLabel: 'Sayur' },
  { key: 'buah', label: 'Buah', shortLabel: 'Buah' },
  { key: 'susu', label: 'Susu', shortLabel: 'Susu' },
];

export const MBG_REGION_OPTIONS = [
  { id: 'nusantara', label: 'Nusantara (Umum)' },
  { id: 'jawa', label: 'Jawa & Sekitarnya' },
  { id: 'sumatera', label: 'Sumatera (Bumbu Rempah)' },
  { id: 'pesisir', label: 'Pesisir / Sulawesi (Dominan Ikan)' },
  { id: 'ekonomis', label: 'Hemat Bahan Lokal' },
];

export const PORTION_PRESETS = [1, 10, 50, 100, 300, 500, 1000];

export function getTargetGroupOption(id: MbgTargetGroupId): MbgTargetGroupOption {
  return MBG_TARGET_GROUPS.find((g) => g.id === id) || MBG_TARGET_GROUPS[2];
}

function roundFriendly(value: number): number {
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

function formatNumberId(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: num >= 100 ? 0 : num >= 10 ? 1 : 2,
  }).format(num);
}

/**
 * Scale an ingredient amount from 1 standard portion to N portions * targetGroup multiplier,
 * converting kitchen units cleanly (g -> kg, ml -> L, sdt -> sdm -> ml when large).
 */
export function formatScaledIngredient(
  amountPerPortion: number,
  unit: string,
  portions: number,
  multiplier = 1
): { value: number; unit: string; display: string } {
  const safePortions = Math.max(1, portions);
  const rawTotal = amountPerPortion * safePortions * multiplier;
  const normalizedUnit = unit.trim().toLowerCase();

  if (normalizedUnit === 'g' || normalizedUnit === 'gr' || normalizedUnit === 'gram') {
    if (rawTotal >= 1000) {
      const kg = roundFriendly(rawTotal / 1000);
      return { value: kg, unit: 'kg', display: `${formatNumberId(kg)} kg` };
    }
    const g = roundFriendly(rawTotal);
    return { value: g, unit: 'g', display: `${formatNumberId(g)} g` };
  }

  if (normalizedUnit === 'ml') {
    if (rawTotal >= 1000) {
      const liter = roundFriendly(rawTotal / 1000);
      return { value: liter, unit: 'L', display: `${formatNumberId(liter)} L` };
    }
    const ml = roundFriendly(rawTotal);
    return { value: ml, unit: 'ml', display: `${formatNumberId(ml)} ml` };
  }

  if (normalizedUnit === 'sdt') {
    // 1 sdt ~ 5 ml; when scaled large (>12 sdt) convert to sdm or ml/L
    if (rawTotal >= 60) {
      const mlTotal = rawTotal * 5;
      if (mlTotal >= 1000) {
        const l = roundFriendly(mlTotal / 1000);
        return { value: l, unit: 'L', display: `${formatNumberId(l)} L` };
      }
      const ml = Math.round(mlTotal);
      return { value: ml, unit: 'ml', display: `${formatNumberId(ml)} ml` };
    }
    if (rawTotal >= 6) {
      const sdm = roundFriendly(rawTotal / 3);
      return { value: sdm, unit: 'sdm', display: `${formatNumberId(sdm)} sdm` };
    }
    const sdt = roundFriendly(rawTotal);
    return { value: sdt, unit: 'sdt', display: `${formatNumberId(sdt)} sdt` };
  }

  if (normalizedUnit === 'sdm') {
    // 1 sdm ~ 15 ml; when >= 20 sdm show ml/L
    if (rawTotal >= 20) {
      const mlTotal = rawTotal * 15;
      if (mlTotal >= 1000) {
        const l = roundFriendly(mlTotal / 1000);
        return { value: l, unit: 'L', display: `${formatNumberId(l)} L` };
      }
      const ml = Math.round(mlTotal);
      return { value: ml, unit: 'ml', display: `${formatNumberId(ml)} ml` };
    }
    const sdm = roundFriendly(rawTotal);
    return { value: sdm, unit: 'sdm', display: `${formatNumberId(sdm)} sdm` };
  }

  // Discrete items (butir, buah, kotak, potong, siung, lembar, batang, ikat)
  const rounded =
    rawTotal >= 10 ? Math.ceil(rawTotal) : roundFriendly(rawTotal);
  return {
    value: rounded,
    unit: unit.trim(),
    display: `${formatNumberId(rounded)} ${unit.trim()}`,
  };
}

export function scaleNutrition(
  base: NutritionEstimate,
  multiplier: number
): NutritionEstimate {
  return {
    calories: Math.round(base.calories * multiplier),
    proteinGrams: Math.round(base.proteinGrams * multiplier * 10) / 10,
    carbsGrams: Math.round(base.carbsGrams * multiplier * 10) / 10,
    fatGrams: Math.round(base.fatGrams * multiplier * 10) / 10,
  };
}

export function sumDailyNutrition(
  day: DailyMenuPlan,
  multiplier: number
): NutritionEstimate {
  const totals = MEAL_CATEGORIES.reduce(
    (acc, cat) => {
      const n = day.meals[cat.key]?.nutritionPerPortion;
      if (!n) return acc;
      acc.calories += n.calories;
      acc.proteinGrams += n.proteinGrams;
      acc.carbsGrams += n.carbsGrams;
      acc.fatGrams += n.fatGrams;
      return acc;
    },
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
  return scaleNutrition(totals, multiplier);
}

/**
 * Aggregate all raw ingredients across Senin–Jumat scaled to portions & target group.
 */
export function buildWeeklyShoppingList(
  plan: WeeklyMenuPlan,
  portions: number,
  multiplier: number
): AggregatedShoppingItem[] {
  const map = new Map<
    string,
    {
      name: string;
      unit: string;
      rawBaseSum: number;
      group: 'utama' | 'bumbu' | 'pelengkap';
      days: Set<string>;
    }
  >();

  for (const day of plan.days) {
    for (const cat of MEAL_CATEGORIES) {
      const dish = day.meals[cat.key];
      if (!dish) continue;
      for (const ing of dish.ingredients) {
        const key = `${ing.name.trim().toLowerCase()}__${ing.unit.trim().toLowerCase()}`;
        const existing = map.get(key);
        if (existing) {
          existing.rawBaseSum += ing.amountPerPortion;
          existing.days.add(day.dayLabel);
        } else {
          map.set(key, {
            name: ing.name.trim(),
            unit: ing.unit.trim(),
            rawBaseSum: ing.amountPerPortion,
            group: ing.group || 'utama',
            days: new Set([day.dayLabel]),
          });
        }
      }
    }
  }

  const groupOrder = { utama: 0, bumbu: 1, pelengkap: 2 };
  const items: AggregatedShoppingItem[] = [];

  for (const entry of map.values()) {
    const scaled = formatScaledIngredient(
      entry.rawBaseSum,
      entry.unit,
      portions,
      multiplier
    );
    items.push({
      name: entry.name,
      unit: scaled.unit,
      totalAmount: scaled.value,
      formattedTotal: scaled.display,
      group: entry.group,
      usedInDays: Array.from(entry.days),
    });
  }

  return items.sort((a, b) => {
    if (groupOrder[a.group] !== groupOrder[b.group]) {
      return groupOrder[a.group] - groupOrder[b.group];
    }
    return a.name.localeCompare(b.name, 'id');
  });
}

/**
 * Calculate Monday-Friday date labels starting from a given YYYY-MM-DD Monday date.
 */
export function getWeekDatesFromMonday(mondayIso: string): Record<DayKey, string> {
  const keys: DayKey[] = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
  const result = {} as Record<DayKey, string>;

  const parts = mondayIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    keys.forEach((k) => (result[k] = ''));
    return result;
  }

  const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const fmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' });

  keys.forEach((k, idx) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + idx);
    result[k] = fmt.format(d);
  });

  return result;
}

export function getNearestMondayIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const CATEGORY_EMOJI: Record<MealCategoryKey, string> = {
  karbohidrat: '🍚',
  protein: '🍗',
  sayuran: '🥬',
  buah: '🍉',
  susu: '🥛',
};

export function formatWeeklyScheduleForWhatsApp(
  plan: WeeklyMenuPlan,
  portions: number,
  targetGroup: MbgTargetGroupOption,
  weekDates?: Record<DayKey, string>
): string {
  const lines: string[] = [];
  lines.push(`🍱 *Jadwal Menu MBG — ${plan.title}*`);
  lines.push(`👥 Sasaran: ${targetGroup.label} | 🍽️ ${portions} porsi/hari`);
  lines.push('');

  for (const day of plan.days) {
    const dateStr = weekDates?.[day.dayKey] ? ` (${weekDates[day.dayKey]})` : '';
    lines.push(`📅 *${day.dayLabel}${dateStr}*`);
    for (const cat of MEAL_CATEGORIES) {
      const dish = day.meals[cat.key];
      if (dish) {
        lines.push(`${CATEGORY_EMOJI[cat.key]} ${cat.label}: ${dish.name}`);
      }
    }
    lines.push('');
  }

  lines.push(
    '✨ Seluruh menu dirancang mengikuti prinsip gizi seimbang harian agar asupan energi, protein, serat, dan vitamin terpenuhi optimal. 💚'
  );
  return lines.join('\n');
}

export function formatRecipeTextForShare(
  dish: DishRecipe,
  dayLabel: string,
  portions: number,
  targetGroup: MbgTargetGroupOption
): string {
  const lines: string[] = [];
  lines.push(`👨‍🍳 *Resep MBG — ${dish.name}*`);
  lines.push(
    `📅 ${dayLabel} | 👥 ${targetGroup.shortLabel} | 🍽️ ${portions} porsi`
  );
  lines.push('');
  lines.push('🛒 *Daftar Bahan:*');
  for (const ing of dish.ingredients) {
    const scaled = formatScaledIngredient(
      ing.amountPerPortion,
      ing.unit,
      portions,
      targetGroup.portionMultiplier
    );
    lines.push(`• ${ing.name}: ${scaled.display}`);
  }
  lines.push('');
  lines.push('🍳 *Langkah Memasak:*');
  dish.steps.forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step}`);
  });
  if (dish.kitchenTips) {
    lines.push('');
    lines.push(`💡 *Catatan Dapur:* ${dish.kitchenTips}`);
  }
  return lines.join('\n');
}

// ============================================================================
// Reusable Dish Library (Directly aligned with Indonesian MBG weekly tables)
// ============================================================================

const DISHES: Record<string, DishRecipe> = {
  // --- KARBOHIDRAT ---
  nasi_putih: {
    id: 'nasi_putih',
    name: 'Nasi Putih',
    category: 'karbohidrat',
    shortSummary: 'Nasi pulen hangat dari beras pilihan berstandar mutu baik.',
    prepMinutes: 15,
    cookMinutes: 35,
    ingredients: [
      { name: 'Beras putih medium/premium', amountPerPortion: 75, unit: 'g', group: 'utama' },
      { name: 'Air bersih untuk menanak', amountPerPortion: 115, unit: 'ml', group: 'pelengkap' },
      { name: 'Daun pandan (opsional aroma)', amountPerPortion: 0.05, unit: 'lembar', group: 'bumbu' },
    ],
    steps: [
      'Cuci beras maksimal 2 kali bilas dengan air mengalir agar vitamin B1 tetap terjaga.',
      'Masukkan beras dan air bersih ke dalam rice steamer atau dandang kukus dengan takaran 1 : 1,5.',
      'Tambahkan simpul daun pandan bila tersedia, lalu masak/kukus hingga matang dan tanak.',
      'Aduk perlahan saat matang agar uap merata dan nasi tetap pulen saat pemorsian.',
    ],
    kitchenTips: 'Untuk skala ≥100 porsi, gunakan metode aron lalu kukus di steamer agar nasi tidak mudah lembek atau basi di kotak makan.',
    nutritionPerPortion: { calories: 265, proteinGrams: 5, carbsGrams: 58, fatGrams: 0.5 },
  },
  nasi_gurih: {
    id: 'nasi_gurih',
    name: 'Nasi Gurih',
    category: 'karbohidrat',
    shortSummary: 'Nasi uduk gurih wangi serai dan daun salam dengan santan ringan.',
    prepMinutes: 20,
    cookMinutes: 40,
    ingredients: [
      { name: 'Beras putih', amountPerPortion: 75, unit: 'g', group: 'utama' },
      { name: 'Santan encer (rendah lemak)', amountPerPortion: 45, unit: 'ml', group: 'utama' },
      { name: 'Air bersih', amountPerPortion: 75, unit: 'ml', group: 'pelengkap' },
      { name: 'Serai memarkan', amountPerPortion: 0.1, unit: 'batang', group: 'bumbu' },
      { name: 'Daun salam', amountPerPortion: 0.1, unit: 'lembar', group: 'bumbu' },
      { name: 'Garam halus beryodium', amountPerPortion: 0.6, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Cuci bersih beras, tiriskan.',
      'Didihkan santan encer bersama air, serai, daun salam, dan garam sambil diaduk agar santan tidak pecah.',
      'Masukkan beras ke rebusan santan dan aron hingga cairan terserap rata.',
      'Kukus beras aron selama 25–30 menit hingga matang pulen dan aromatik.',
    ],
    kitchenTips: 'Jaga santan tetap encer dan kukus sampai benar-benar tanak agar nasi gurih awet hingga jam makan siang sekolah.',
    nutritionPerPortion: { calories: 295, proteinGrams: 5.5, carbsGrams: 57, fatGrams: 4.5 },
  },

  // --- PROTEIN ---
  ayam_goreng_telur: {
    id: 'ayam_goreng_telur',
    name: 'Ayam Goreng Telur',
    category: 'protein',
    shortSummary: 'Potongan ayam ungkep bumbu kuning dibalut kocokan telur gurih lalu digoreng matang.',
    prepMinutes: 25,
    cookMinutes: 35,
    ingredients: [
      { name: 'Daging ayam potong (dada/paha)', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Telur ayam (untuk balutan)', amountPerPortion: 0.25, unit: 'butir', group: 'utama' },
      { name: 'Bawang putih', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Kunyit segar / bubuk', amountPerPortion: 1.5, unit: 'g', group: 'bumbu' },
      { name: 'Ketumbar bubuk', amountPerPortion: 0.5, unit: 'g', group: 'bumbu' },
      { name: 'Daun salam & serai', amountPerPortion: 0.1, unit: 'lembar', group: 'bumbu' },
      { name: 'Garam beryodium', amountPerPortion: 0.8, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 8, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Haluskan bawang putih, kunyit, ketumbar, dan garam.',
      'Ungkep potongan ayam bersama bumbu halus, daun salam, serai, dan sedikit air hingga bumbu meresap dan ayam matang sempurna.',
      'Angkat dan tiriskan ayam hingga hangat. Kocok lepas telur dengan sedikit garam.',
      'Celupkan ayam ungkep ke kocokan telur, lalu goreng dalam minyak panas suhu sedang hingga kuning keemasan. Tiriskan di rak peniris minyak.',
    ],
    kitchenTips: 'Ungkep ayam hingga suhu inti >75°C terlebih dahulu sehingga proses penggorengan cepat dan matang merata untuk ratusan porsi.',
    nutritionPerPortion: { calories: 195, proteinGrams: 17.5, carbsGrams: 1.5, fatGrams: 13 },
  },
  semur_telur: {
    id: 'semur_telur',
    name: 'Semur Telur',
    category: 'protein',
    shortSummary: 'Telur rebus dimasak kuah kecap manis beraroma pala dan bawang yang ramah anak.',
    prepMinutes: 20,
    cookMinutes: 30,
    ingredients: [
      { name: 'Telur ayam rebus kupas', amountPerPortion: 1, unit: 'butir', group: 'utama' },
      { name: 'Bawang merah', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Bawang putih', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Kemiri sangrai', amountPerPortion: 2, unit: 'g', group: 'bumbu' },
      { name: 'Kecap manis', amountPerPortion: 8, unit: 'ml', group: 'bumbu' },
      { name: 'Pala bubuk & lada halus', amountPerPortion: 0.2, unit: 'g', group: 'bumbu' },
      { name: 'Tomat merah cincang', amountPerPortion: 8, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng (menumis)', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Rebus telur hingga matang penuh (10–12 menit), rendam air dingin lalu kupas bersih.',
      'Haluskan bawang merah, bawang putih, dan kemiri sangrai. Tumis bersama tomat hingga harum dan matang.',
      'Tuang air secukupnya, masukkan kecap manis, pala, lada, dan garam secukupnya.',
      'Masukkan telur rebus, masak dengan api kecil hingga kuah menyusut kental dan bumbu meresap.',
    ],
    kitchenTips: 'Sebaiknya goreng sebentar telur rebus atau kerat tipis permukaannya agar bumbu semur lebih meresap dan telur tidak mudah pecah saat distribusi.',
    nutritionPerPortion: { calories: 145, proteinGrams: 8.5, carbsGrams: 7, fatGrams: 9 },
  },
  ikan_kembung_goreng: {
    id: 'ikan_kembung_goreng',
    name: 'Ikan Kembung Goreng',
    category: 'protein',
    shortSummary: 'Ikan kembung kaya omega-3 dimarinasi bumbu kuning jeruk nipis dan digoreng renyah.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Ikan kembung segar (bersih isi perut)', amountPerPortion: 75, unit: 'g', group: 'utama' },
      { name: 'Jeruk nipis', amountPerPortion: 3, unit: 'ml', group: 'bumbu' },
      { name: 'Bawang putih halus', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Kunyit & jahe halus', amountPerPortion: 2, unit: 'g', group: 'bumbu' },
      { name: 'Ketumbar bubuk', amountPerPortion: 0.5, unit: 'g', group: 'bumbu' },
      { name: 'Garam beryodium', amountPerPortion: 0.8, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 9, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Bersihkan ikan kembung, buang insang dan isi perut, kerat kedua sisinya, lalu lumuri jeruk nipis 10 menit dan bilas.',
      'Lumuri ikan dengan campuran bawang putih, kunyit, jahe, ketumbar, dan garam. Diamkan 20 menit agar meresap.',
      'Goreng ikan dalam minyak panas yang cukup hingga kering keemasan dan matang merata.',
      'Tiriskan minyak dengan baik sebelum dikemas ke wadah makan.',
    ],
    kitchenTips: 'Untuk anak PAUD/TK atau SD kelas 1–3, pertimbangkan fillet ikan kembung tanpa duri agar aman disantap.',
    nutritionPerPortion: { calories: 185, proteinGrams: 18, carbsGrams: 1, fatGrams: 12 },
  },
  ayam_asam_manis: {
    id: 'ayam_asam_manis',
    name: 'Ayam Asam Manis',
    category: 'protein',
    shortSummary: 'Fillet ayam potong dadu bersalut tipis dengan saus tomat nanas asam manis segar.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Fillet dada ayam potong dadu', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Tepung maizena / serbaguna', amountPerPortion: 10, unit: 'g', group: 'pelengkap' },
      { name: 'Saus tomat', amountPerPortion: 12, unit: 'g', group: 'bumbu' },
      { name: 'Bawang bombay iris', amountPerPortion: 8, unit: 'g', group: 'bumbu' },
      { name: 'Bawang putih cincang', amountPerPortion: 2.5, unit: 'g', group: 'bumbu' },
      { name: 'Nanas potong kecil (opsional)', amountPerPortion: 10, unit: 'g', group: 'pelengkap' },
      { name: 'Gula pasir & garam', amountPerPortion: 2, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 8, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Marinasi potongan fillet ayam dengan sedikit garam dan bawang putih, balur tipis dengan tepung lalu goreng hingga matang keemasan.',
      'Tumis bawang putih dan bawang bombay hingga wangi dan layu.',
      'Masukkan saus tomat, sedikit air, gula, garam, dan potongan nanas. Masak hingga mendidih.',
      'Kentalkan saus dengan sedikit larutan maizena, lalu campurkan ayam sesaat sebelum disajikan atau kemas saus terpisah bila perlu.',
    ],
    kitchenTips: 'Batasi gula dan gunakan saus tomat berkualitas tanpa pewarna sintetis agar seimbang sesuai prinsip GGL MBG.',
    nutritionPerPortion: { calories: 205, proteinGrams: 16.5, carbsGrams: 13, fatGrams: 9.5 },
  },
  telur_dadar: {
    id: 'telur_dadar',
    name: 'Telur Dadar',
    category: 'protein',
    shortSummary: 'Telur dadar tebal gurih dengan irisan daun bawang dan sedikit wortel parut.',
    prepMinutes: 15,
    cookMinutes: 20,
    ingredients: [
      { name: 'Telur ayam', amountPerPortion: 1, unit: 'butir', group: 'utama' },
      { name: 'Daun bawang iris halus', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Bawang merah iris tipis', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Wortel parut halus (opsional)', amountPerPortion: 5, unit: 'g', group: 'pelengkap' },
      { name: 'Garam & lada bubuk', amountPerPortion: 0.6, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 5, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Kocok lepas telur bersama daun bawang, bawang merah, wortel parut, garam, dan sedikit lada hingga berbusa halus.',
      'Panaskan wajan datar atau loyang kukus anti lengket dengan sedikit minyak.',
      'Masak adonan telur hingga kedua sisi matang kecokelatan (atau panggang/kukus di loyang kotak untuk skala besar, lalu potong seragam).',
      'Potong per porsi sama besar dan tiriskan sebelum dikemas.',
    ],
    kitchenTips: 'Untuk produksi >100 porsi, tuang adonan telur ke loyang persegi beralas daun/baking paper lalu kukus 20 menit dan panggang singkat — jauh lebih cepat dan seragam.',
    nutritionPerPortion: { calories: 135, proteinGrams: 7.5, carbsGrams: 1.5, fatGrams: 10.5 },
  },
  ikan_lele_goreng: {
    id: 'ikan_lele_goreng',
    name: 'Ikan Lele Goreng',
    category: 'protein',
    shortSummary: 'Ikan lele segar bumbu kunyit ketumbar digoreng garing luarnya dan lembut dalamnya.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Ikan lele segar (bersih, ukuran 7–8 ekor/kg)', amountPerPortion: 80, unit: 'g', group: 'utama' },
      { name: 'Jeruk nipis', amountPerPortion: 3, unit: 'ml', group: 'bumbu' },
      { name: 'Bawang putih & kunyit halus', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Ketumbar & garam', amountPerPortion: 1.2, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 10, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Cuci bersih lele dengan garam dan jeruk nipis untuk menghilangkan lendir dan bau tanah, lalu bilas.',
      'Kerat badan ikan dan lumuri bumbu halus (bawang putih, kunyit, ketumbar, garam). Diamkan 20 menit.',
      'Goreng dalam minyak panas hingga garing keemasan dan matang sempurna.',
      'Tiriskan di rak kawat hingga minyak turun sebelum dikemas.',
    ],
    kitchenTips: 'Untuk kelas bawah (PAUD/SD 1–3), gunakan lele fillet goreng tepung agar aman tanpa duri.',
    nutritionPerPortion: { calories: 190, proteinGrams: 16, carbsGrams: 1, fatGrams: 13 },
  },
  ayam_opor: {
    id: 'ayam_opor',
    name: 'Ayam Opor',
    category: 'protein',
    shortSummary: 'Ayam dimasak kuah opor putih lembut kaya rempah serai, daun jeruk, dan santan ringan.',
    prepMinutes: 25,
    cookMinutes: 35,
    ingredients: [
      { name: 'Daging ayam potong', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Santan encer', amountPerPortion: 50, unit: 'ml', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 7, unit: 'g', group: 'bumbu' },
      { name: 'Kemiri & ketumbar sangrai', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Serai, lengkuas & daun salam', amountPerPortion: 2, unit: 'g', group: 'bumbu' },
      { name: 'Garam & sedikit gula', amountPerPortion: 1, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng (menumis)', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Haluskan bawang merah, bawang putih, kemiri, dan ketumbar. Tumis bersama serai, lengkuas, dan daun salam hingga matang wangi.',
      'Masukkan potongan ayam, aduk hingga berubah warna dan keluar sari dagingnya.',
      'Tuang santan encer dan sedikit air, masak dengan api sedang sambil sesekali diaduk agar santan tidak pecah.',
      'Bumbui garam dan sedikit gula, masak hingga ayam empuk dan kuah sedikit mengental.',
    ],
    kitchenTips: 'Masak santan hingga benar-benar mendidih tanak dan dinginkan sebentar sebelum tutup wadah dirapatkan agar kuah opor tidak cepat basi.',
    nutritionPerPortion: { calories: 200, proteinGrams: 16, carbsGrams: 3, fatGrams: 14 },
  },
  sup_ayam: {
    id: 'sup_ayam',
    name: 'Sup Ayam',
    category: 'protein',
    shortSummary: 'Sup bening potongan ayam empuk dengan kaldu gurih hangat beraroma seledri dan pala.',
    prepMinutes: 20,
    cookMinutes: 35,
    ingredients: [
      { name: 'Daging ayam potong kecil / fillet', amountPerPortion: 60, unit: 'g', group: 'utama' },
      { name: 'Air kaldu / air bersih', amountPerPortion: 150, unit: 'ml', group: 'pelengkap' },
      { name: 'Bawang putih & bawang merah goreng', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Daun bawang & seledri', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Garam, lada & pala bubuk', amountPerPortion: 0.9, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Rebus potongan ayam dalam air mendidih 5 menit pertama untuk membuang kotoran, tiriskan, lalu rebus kembali dengan air bersih untuk kaldu bening.',
      'Tumis bawang putih halus hingga harum, masukkan ke dalam panci kaldu ayam.',
      'Bumbui garam, lada halus, dan sedikit pala. Masak hingga ayam empuk.',
      'Masukkan irisan daun bawang, seledri, dan taburan bawang goreng menjelang diangkat.',
    ],
    kitchenTips: 'Sajikan kuah terpisah atau gunakan wadah anti-tumpah khusus sup agar nasi tetap nikmat saat disantap.',
    nutritionPerPortion: { calories: 130, proteinGrams: 15, carbsGrams: 2, fatGrams: 6.5 },
  },
  pindang_patin: {
    id: 'pindang_patin',
    name: 'Pindang Patin',
    category: 'protein',
    shortSummary: 'Ikan patin segar kuah kuning asam segar beraroma serai, kunyit, tomat, dan kemangi.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Ikan patin potong bersih', amountPerPortion: 75, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 6, unit: 'g', group: 'bumbu' },
      { name: 'Kunyit, jahe & lengkuas', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Tomat merah & belimbing wuluh / asam jawa', amountPerPortion: 10, unit: 'g', group: 'bumbu' },
      { name: 'Daun kemangi & serai', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Garam & sedikit gula', amountPerPortion: 1, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Lumuri potongan patin dengan jeruk nipis 10 menit lalu bilas bersih.',
      'Didihkan air bersama irisan/geprekan bawang merah, bawang putih, kunyit bakar, jahe, lengkuas, dan serai hingga harum.',
      'Masukkan ikan patin, tomat, asam jawa/belimbing wuluh, garam, dan sedikit gula. Masak perlahan tanpa sering diaduk agar ikan tidak hancur.',
      'Tambahkan daun kemangi sesaat sebelum api dimatikan.',
    ],
    kitchenTips: 'Jangan mengaduk ikan patin terlalu keras saat mendidih karena dagingnya sangat lembut.',
    nutritionPerPortion: { calories: 155, proteinGrams: 16.5, carbsGrams: 3.5, fatGrams: 8 },
  },
  telur_balado: {
    id: 'telur_balado',
    name: 'Telur Balado',
    category: 'protein',
    shortSummary: 'Telur rebus goreng dibalut sambal tomat merah lembut yang tidak pedas menyengat.',
    prepMinutes: 20,
    cookMinutes: 25,
    ingredients: [
      { name: 'Telur ayam rebus kupas', amountPerPortion: 1, unit: 'butir', group: 'utama' },
      { name: 'Cabai merah besar (buang biji)', amountPerPortion: 8, unit: 'g', group: 'bumbu' },
      { name: 'Tomat merah matang', amountPerPortion: 12, unit: 'g', group: 'bumbu' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 6, unit: 'g', group: 'bumbu' },
      { name: 'Daun jeruk', amountPerPortion: 0.1, unit: 'lembar', group: 'bumbu' },
      { name: 'Garam & sedikit gula', amountPerPortion: 1, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 6, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Rebus telur hingga matang, kupas, lalu goreng sebentar dalam minyak panas sampai berkulit tipis.',
      'Haluskan cabai merah besar tanpa biji, tomat, bawang merah, dan bawang putih.',
      'Tumis bumbu halus bersama daun jeruk hingga matang tanak dan tidak langu.',
      'Bumbui garam dan sedikit gula, masukkan telur, aduk rata hingga bumbu menyelimuti telur.',
    ],
    kitchenTips: 'Buang biji cabai merah besar dan perbanyak tomat agar warna balado merah menggugah selera tapi tetap aman bagi perut anak sekolah.',
    nutritionPerPortion: { calories: 155, proteinGrams: 8, carbsGrams: 5.5, fatGrams: 11 },
  },
  fuyunghai: {
    id: 'fuyunghai',
    name: 'Fuyunghai',
    category: 'protein',
    shortSummary: 'Telur goreng isi ayam cincang, kol, dan wortel dengan siraman saus asam manis hangat.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Telur ayam', amountPerPortion: 1, unit: 'butir', group: 'utama' },
      { name: 'Ayam cincang halus', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Kol & wortel iris halus', amountPerPortion: 15, unit: 'g', group: 'pelengkap' },
      { name: 'Tepung tapioka / terigu', amountPerPortion: 8, unit: 'g', group: 'pelengkap' },
      { name: 'Saus tomat & bawang bombay (saus)', amountPerPortion: 15, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 8, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Campur telur, ayam cincang, kol, wortel, tepung, garam, dan lada hingga rata.',
      'Goreng adonan per porsi atau di loyang cetakan hingga matang keemasan kedua sisinya, tiriskan.',
      'Buat saus: tumis bawang putih & bombay, tambahkan saus tomat, air, sedikit gula, garam, lalu kentalkan dengan maizena.',
      'Sajikan potongan fuyunghai dengan siraman saus asam manis di atasnya.',
    ],
    kitchenTips: 'Saus fuyunghai sebaiknya disiram saat pemorsian akhir agar fuyunghai tetap bertekstur baik.',
    nutritionPerPortion: { calories: 205, proteinGrams: 13.5, carbsGrams: 12, fatGrams: 11.5 },
  },
  ikan_bumbu_kuning: {
    id: 'ikan_bumbu_kuning',
    name: 'Ikan Bumbu Kuning',
    category: 'protein',
    shortSummary: 'Ikan laut/air tawar dimasak pesmol bumbu kuning kunyit, kemiri, dan tomat segar.',
    prepMinutes: 25,
    cookMinutes: 30,
    ingredients: [
      { name: 'Ikan tongkol/kembung/nila potong', amountPerPortion: 75, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 7, unit: 'g', group: 'bumbu' },
      { name: 'Kunyit, jahe & kemiri', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Serai, daun salam & daun jeruk', amountPerPortion: 1.5, unit: 'g', group: 'bumbu' },
      { name: 'Tomat potong', amountPerPortion: 8, unit: 'g', group: 'pelengkap' },
      { name: 'Minyak goreng', amountPerPortion: 7, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Lumuri ikan dengan jeruk nipis dan garam, lalu goreng setengah kering agar daging kokoh.',
      'Haluskan bawang merah, bawang putih, kunyit, jahe, dan kemiri. Tumis dengan serai, daun salam, dan daun jeruk hingga matang harum.',
      'Tuang sedikit air, bumbui garam dan sedikit gula, lalu masukkan ikan goreng dan potongan tomat.',
      'Masak hingga bumbu kuning meresap dan kuah menyusut nyemek.',
    ],
    kitchenTips: 'Memasak bumbu kuning sampai benar-benar matang menghilangkan rasa langu kunyit sehingga anak-anak lebih menyukainya.',
    nutritionPerPortion: { calories: 180, proteinGrams: 17.5, carbsGrams: 3.5, fatGrams: 10.5 },
  },
  telur_ceplok_kecap: {
    id: 'telur_ceplok_kecap',
    name: 'Telur Ceplok Kecap',
    category: 'protein',
    shortSummary: 'Telur mata sapi matang penuh ditumis bumbu bawang bombay dan kecap manis gurih.',
    prepMinutes: 15,
    cookMinutes: 20,
    ingredients: [
      { name: 'Telur ayam', amountPerPortion: 1, unit: 'butir', group: 'utama' },
      { name: 'Bawang merah & bawang putih iris', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Bawang bombay iris', amountPerPortion: 8, unit: 'g', group: 'bumbu' },
      { name: 'Kecap manis', amountPerPortion: 8, unit: 'ml', group: 'bumbu' },
      { name: 'Tomat potong dadu', amountPerPortion: 8, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 6, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Goreng telur mata sapi hingga kuning dan putih telur matang penuh (well-done demi keamanan pangan).',
      'Tumis bawang merah, bawang putih, dan bawang bombay hingga harum kecokelatan.',
      'Masukkan kecap manis, tomat, sedikit air, garam, dan lada. Masak hingga saus mengental.',
      'Masukkan telur ceplok perlahan, aduk lembut hingga terbalut saus kecap.',
    ],
    kitchenTips: 'Pastikan kuning telur matang sempurna untuk standar higienitas makanan massal MBG.',
    nutritionPerPortion: { calories: 150, proteinGrams: 8, carbsGrams: 6.5, fatGrams: 10 },
  },
  ayam_bumbu_kuning: {
    id: 'ayam_bumbu_kuning',
    name: 'Ayam Bumbu Kuning',
    category: 'protein',
    shortSummary: 'Ayam ungkep rempah kuning gurih beraroma lengkuas, serai, dan daun jeruk.',
    prepMinutes: 25,
    cookMinutes: 35,
    ingredients: [
      { name: 'Daging ayam potong', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 7, unit: 'g', group: 'bumbu' },
      { name: 'Kunyit, jahe, lengkuas & kemiri', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Ketumbar bubuk, serai & daun jeruk', amountPerPortion: 1.5, unit: 'g', group: 'bumbu' },
      { name: 'Garam beryodium', amountPerPortion: 0.8, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng (menumis)', amountPerPortion: 4, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Haluskan bawang merah, bawang putih, kunyit, jahe, kemiri, dan ketumbar.',
      'Tumis bumbu halus bersama lengkuas geprek, serai, dan daun jeruk sampai wangi matang.',
      'Masukkan potongan ayam dan sedikit air, bumbui garam. Masak tertutup hingga ayam empuk dan bumbu kuning meresap kental.',
      'Opsional: panggang singkat atau sajikan langsung dengan bumbu kuning kentalnya.',
    ],
    kitchenTips: 'Tanpa deep-fry berlebih membuat menu ini lebih rendah lemak namun tetap kaya rasa.',
    nutritionPerPortion: { calories: 175, proteinGrams: 17, carbsGrams: 3, fatGrams: 10.5 },
  },

  // --- SAYURAN ---
  orak_arik_buncis_wortel: {
    id: 'orak_arik_buncis_wortel',
    name: 'Orak-Arik Buncis Wortel',
    category: 'sayuran',
    shortSummary: 'Tumisan buncis muda dan wortel manis dengan orak-arik telur gurih.',
    prepMinutes: 20,
    cookMinutes: 15,
    ingredients: [
      { name: 'Buncis segar iris serong', amountPerPortion: 35, unit: 'g', group: 'utama' },
      { name: 'Wortel iris korek api', amountPerPortion: 30, unit: 'g', group: 'utama' },
      { name: 'Telur (orak-arik campuran)', amountPerPortion: 0.15, unit: 'butir', group: 'pelengkap' },
      { name: 'Bawang putih & bawang merah', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Garam, lada & sedikit saus tiram', amountPerPortion: 1.5, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Tumis bawang putih dan bawang merah hingga harum, sisihkan di pinggir wajan lalu buat orak-arik telur.',
      'Masukkan irisan wortel dan sedikit air, masak 3 menit hingga setengah empuk.',
      'Masukkan buncis, bumbui garam, lada, dan sedikit saus tiram.',
      'Aduk cepat dengan api besar hingga buncis matang cerah dan tetap renyah.',
    ],
    kitchenTips: 'Masak sayuran mendekati waktu pengemasan agar warna hijau buncis tetap segar dan vitamin C terjaga.',
    nutritionPerPortion: { calories: 65, proteinGrams: 2.8, carbsGrams: 7, fatGrams: 3 },
  },
  capcay_bakso: {
    id: 'capcay_bakso',
    name: 'Capcay Bakso',
    category: 'sayuran',
    shortSummary: 'Aneka sayuran warna-warni (wortel, kembang kol, sawi) dimasak kuah ringan bersama irisan bakso.',
    prepMinutes: 25,
    cookMinutes: 15,
    ingredients: [
      { name: 'Wortel, kembang kol & sawi hijau/putih', amountPerPortion: 60, unit: 'g', group: 'utama' },
      { name: 'Bakso sapi/ayam iris tipis', amountPerPortion: 15, unit: 'g', group: 'pelengkap' },
      { name: 'Bawang putih & bawang bombay', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Saus tiram, garam & lada', amountPerPortion: 2, unit: 'g', group: 'bumbu' },
      { name: 'Maizena (pengental ringan)', amountPerPortion: 1.5, unit: 'g', group: 'pelengkap' },
      { name: 'Minyak goreng', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Tumis bawang putih dan bombay hingga harum, masukkan irisan bakso lalu aduk rata.',
      'Masukkan wortel dan kembang kol terlebih dahulu dengan sedikit air, masak 3 menit.',
      'Tambahkan sawi, saus tiram, garam, dan lada. Aduk rata.',
      'Tuang sedikit larutan maizena agar bumbu membalut sayuran dengan cantik lalu angkat.',
    ],
    kitchenTips: 'Gunakan bakso bersertifikat halal tanpa boraks/pengawet berlebih.',
    nutritionPerPortion: { calories: 80, proteinGrams: 4, carbsGrams: 8.5, fatGrams: 3.5 },
  },
  tumis_kangkung: {
    id: 'tumis_kangkung',
    name: 'Tumis Kangkung',
    category: 'sayuran',
    shortSummary: 'Tumis kangkung bawang putih sederhana yang segar, kaya zat besi dan serat.',
    prepMinutes: 15,
    cookMinutes: 10,
    ingredients: [
      { name: 'Kangkung segar siangi', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih iris', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Tomat potong', amountPerPortion: 6, unit: 'g', group: 'bumbu' },
      { name: 'Saus tiram & garam', amountPerPortion: 1.5, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Cuci bersih kangkung yang sudah dipetik dan dibelah batangnya pada air mengalir.',
      'Tumis bawang merah, bawang putih, dan tomat hingga harum.',
      'Masukkan kangkung dengan api besar, tambahkan saus tiram dan garam.',
      'Aduk cepat 2–3 menit sampai layu cerah, segera angkat agar tidak menghitam.',
    ],
    kitchenTips: 'Kangkung sebaiknya dimasak paling akhir dan didinginkan terbuka sebentar agar warna tetap hijau cerah.',
    nutritionPerPortion: { calories: 48, proteinGrams: 2.2, carbsGrams: 4.5, fatGrams: 2.5 },
  },
  tumis_sawi_putih_tahu: {
    id: 'tumis_sawi_putih_tahu',
    name: 'Tumis Sawi Putih Tahu',
    category: 'sayuran',
    shortSummary: 'Perpaduan sawi putih lembut dan tahu putih sebagai tambahan protein nabati.',
    prepMinutes: 20,
    cookMinutes: 15,
    ingredients: [
      { name: 'Sawi putih potong sedang', amountPerPortion: 50, unit: 'g', group: 'utama' },
      { name: 'Tahu putih potong dadu', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Wortel iris tipis', amountPerPortion: 10, unit: 'g', group: 'pelengkap' },
      { name: 'Bawang putih & bawang merah', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Garam, lada & minyak goreng', amountPerPortion: 3.5, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Goreng tahu dadu setengah matang atau kukus agar tidak mudah hancur saat ditumis.',
      'Tumis bawang merah dan bawang putih hingga harum, masukkan wortel dan sedikit air.',
      'Masukkan batang sawi putih terlebih dahulu, disusul daun sawi dan tahu.',
      'Bumbui garam dan lada, aduk perlahan hingga matang merata.',
    ],
    kitchenTips: 'Memisahkan bagian batang dan daun sawi putih saat menumis membuat tingkat kematangan lebih pas.',
    nutritionPerPortion: { calories: 68, proteinGrams: 4.2, carbsGrams: 5.5, fatGrams: 3.2 },
  },
  tumis_labu_siam_wortel: {
    id: 'tumis_labu_siam_wortel',
    name: 'Tumis Labu Siam Wortel',
    category: 'sayuran',
    shortSummary: 'Irisan labu siam dan wortel manis ditumis gurih ringan dengan daun salam.',
    prepMinutes: 20,
    cookMinutes: 15,
    ingredients: [
      { name: 'Labu siam iris korek api', amountPerPortion: 45, unit: 'g', group: 'utama' },
      { name: 'Wortel iris korek api', amountPerPortion: 20, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Daun salam & lengkuas', amountPerPortion: 0.5, unit: 'g', group: 'bumbu' },
      { name: 'Garam & minyak goreng', amountPerPortion: 3.5, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Remas ringan irisan labu siam dengan sedikit garam untuk menghilangkan getah, lalu bilas bersih.',
      'Tumis bawang merah, bawang putih, daun salam, dan lengkuas hingga wangi.',
      'Masukkan wortel dan labu siam beserta sedikit air, bumbui garam.',
      'Masak hingga empuk namun tidak lembek, angkat dan tiriskan bila berkuah berlebih.',
    ],
    kitchenTips: 'Labu siam sangat awet dan tidak mudah berubah warna saat dikemas dalam boks makan siang.',
    nutritionPerPortion: { calories: 52, proteinGrams: 1.4, carbsGrams: 6.5, fatGrams: 2.5 },
  },
  tumis_kacang_panjang: {
    id: 'tumis_kacang_panjang',
    name: 'Tumis Kacang Panjang',
    category: 'sayuran',
    shortSummary: 'Tumisan kacang panjang segar dengan potongan tempe/tahu dan bumbu kecap ringan.',
    prepMinutes: 15,
    cookMinutes: 15,
    ingredients: [
      { name: 'Kacang panjang potong 3 cm', amountPerPortion: 55, unit: 'g', group: 'utama' },
      { name: 'Tempe potong dadu kecil (opsional)', amountPerPortion: 15, unit: 'g', group: 'pelengkap' },
      { name: 'Bawang merah, bawang putih & tomat', amountPerPortion: 6, unit: 'g', group: 'bumbu' },
      { name: 'Kecap manis & garam', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Tumis bawang merah, bawang putih, dan tomat sampai harum.',
      'Masukkan potongan tempe, aduk hingga matang ringan.',
      'Masukkan kacang panjang dan sedikit air, bumbui kecap manis dan garam.',
      'Masak hingga kacang panjang matang empuk dan warna tetap hijau segar.',
    ],
    kitchenTips: 'Potong kacang panjang sepanjang 2–3 cm agar mudah disendok anak-anak.',
    nutritionPerPortion: { calories: 72, proteinGrams: 4.5, carbsGrams: 7.5, fatGrams: 3 },
  },
  tumis_buncis_tahu: {
    id: 'tumis_buncis_tahu',
    name: 'Tumis Buncis Tahu',
    category: 'sayuran',
    shortSummary: 'Buncis segar ditumis bersama potongan tahu kuning/putih dan bawang putih harum.',
    prepMinutes: 20,
    cookMinutes: 15,
    ingredients: [
      { name: 'Buncis segar iris serong', amountPerPortion: 45, unit: 'g', group: 'utama' },
      { name: 'Tahu putih/kuning potong dadu', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Saus tiram & garam', amountPerPortion: 1.8, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Kukus atau goreng tahu sebentar agar berkulit dan tidak hancur.',
      'Tumis bawang merah dan bawang putih sampai harum.',
      'Masukkan buncis dan sedikit air, masak 3 menit lalu masukkan tahu, saus tiram, dan garam.',
      'Aduk rata hingga bumbu meresap lalu angkat.',
    ],
    kitchenTips: 'Tambahan tahu melengkapi kombinasi protein hewani + nabati sesuai standar Isi Piringku.',
    nutritionPerPortion: { calories: 70, proteinGrams: 4.4, carbsGrams: 6, fatGrams: 3.2 },
  },
  wortel_kol_buncis: {
    id: 'wortel_kol_buncis',
    name: 'Wortel, Kol, Buncis (Sayur Sup)',
    category: 'sayuran',
    shortSummary: 'Isian sayuran sup segar terdiri dari wortel, kol, dan buncis rebus kaldu bening.',
    prepMinutes: 20,
    cookMinutes: 15,
    ingredients: [
      { name: 'Wortel potong bulat', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Kol potong kotak', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Buncis potong 2 cm', amountPerPortion: 20, unit: 'g', group: 'utama' },
      { name: 'Daun bawang & seledri', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Garam & sedikit lada', amountPerPortion: 0.6, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Masukkan potongan wortel ke dalam kaldu sup mendidih selama 4 menit.',
      'Tambahkan buncis dan kol, masak 2–3 menit hingga empuk cerah.',
      'Koreksi rasa bersama kuah sup ayam dan taburi daun bawang seledri.',
    ],
    kitchenTips: 'Rebus sayuran jangan terlalu lama agar tekstur kol dan buncis tetap segar saat tiba di sekolah.',
    nutritionPerPortion: { calories: 35, proteinGrams: 1.5, carbsGrams: 7, fatGrams: 0.3 },
  },
  tumis_pakcoy: {
    id: 'tumis_pakcoy',
    name: 'Tumis Pakcoy',
    category: 'sayuran',
    shortSummary: 'Pakcoy renyah saus bawang putih tiram ringan, kaya kalsium nabati dan folat.',
    prepMinutes: 15,
    cookMinutes: 10,
    ingredients: [
      { name: 'Pakcoy segar potong', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Bawang putih cincang', amountPerPortion: 3, unit: 'g', group: 'bumbu' },
      { name: 'Saus tiram & sedikit minyak wijen', amountPerPortion: 2.5, unit: 'g', group: 'bumbu' },
      { name: 'Garam & minyak goreng', amountPerPortion: 3, unit: 'g', group: 'pelengkap' },
    ],
    steps: [
      'Cuci pakcoy helai demi helai hingga pangkal bebas tanah, lalu potong 2–3 bagian.',
      'Tumis bawang putih cincang hingga kuning harum.',
      'Masukkan batang pakcoy terlebih dahulu 1 menit, disusul daunnya, saus tiram, dan sedikit air.',
      'Aduk cepat hingga layu cerah dan segera angkat.',
    ],
    kitchenTips: 'Blansir singkat pakcoy di air mendidih 45 detik sebelum disiram saus bawang putih sangat efektif untuk produksi besar.',
    nutritionPerPortion: { calories: 42, proteinGrams: 1.8, carbsGrams: 3.5, fatGrams: 2.4 },
  },
  sayur_asem: {
    id: 'sayur_asem',
    name: 'Sayur Asem',
    category: 'sayuran',
    shortSummary: 'Sayur kuah asam segar berisi labu siam, kacang panjang, jagung manis, dan kacang tanah.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Labu siam, kacang panjang & jagung manis', amountPerPortion: 65, unit: 'g', group: 'utama' },
      { name: 'Kacang tanah kupas', amountPerPortion: 6, unit: 'g', group: 'pelengkap' },
      { name: 'Bawang merah, kemiri & lengkuas', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Asam jawa & daun salam', amountPerPortion: 2.5, unit: 'g', group: 'bumbu' },
      { name: 'Garam & gula merah sedikit', amountPerPortion: 2, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Didihkan air bersama kacang tanah, potongan jagung manis, lengkuas, dan daun salam hingga empuk.',
      'Masukkan bumbu halus (bawang merah, kemiri, sedikit terasi opsional) serta air asam jawa.',
      'Masukkan labu siam dan kacang panjang, bumbui garam dan sedikit gula merah.',
      'Masak hingga semua sayuran empuk dan kuah terasa segar seimbang.',
    ],
    kitchenTips: 'Cek catatan alergi kacang di sekolah sasaran; kacang tanah bisa dihilangkan tanpa mengurangi kesegaran sayur asem.',
    nutritionPerPortion: { calories: 62, proteinGrams: 2.5, carbsGrams: 11, fatGrams: 1.2 },
  },
  tumis_oyong_jagung: {
    id: 'tumis_oyong_jagung',
    name: 'Tumis Oyong Jagung',
    category: 'sayuran',
    shortSummary: 'Tumisan lembut gambas/oyong dan jagung manis pipil yang manis alami dan disukai anak.',
    prepMinutes: 20,
    cookMinutes: 12,
    ingredients: [
      { name: 'Oyong / gambas kupas potong bulat', amountPerPortion: 45, unit: 'g', group: 'utama' },
      { name: 'Jagung manis pipil', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Garam, lada & minyak goreng', amountPerPortion: 3, unit: 'g', group: 'pelengkap' },
    ],
    steps: [
      'Kupas bagian kulit keras oyong, cuci bersih lalu potong bulat sedang.',
      'Tumis bawang merah dan bawang putih hingga harum, masukkan jagung pipil dan sedikit air.',
      'Setelah jagung matang 3 menit, masukkan potongan oyong, garam, dan sedikit lada.',
      'Masak singkat 2–3 menit sampai oyong empuk bening lalu segera angkat.',
    ],
    kitchenTips: 'Jangan memasak oyong terlalu lama karena kadar airnya tinggi dan cepat terlalu lembek.',
    nutritionPerPortion: { calories: 55, proteinGrams: 1.8, carbsGrams: 8.5, fatGrams: 2 },
  },
  sayur_lodeh: {
    id: 'sayur_lodeh',
    name: 'Sayur Lodeh',
    category: 'sayuran',
    shortSummary: 'Sayur santan encer tradisional berisi labu siam, kacang panjang, terong, dan tempe.',
    prepMinutes: 25,
    cookMinutes: 25,
    ingredients: [
      { name: 'Labu siam, kacang panjang & terong', amountPerPortion: 60, unit: 'g', group: 'utama' },
      { name: 'Tempe potong dadu', amountPerPortion: 15, unit: 'g', group: 'pelengkap' },
      { name: 'Santan encer', amountPerPortion: 45, unit: 'ml', group: 'utama' },
      { name: 'Bawang merah, bawang putih, kemiri & lengkuas', amountPerPortion: 6, unit: 'g', group: 'bumbu' },
      { name: 'Daun salam, garam & sedikit gula', amountPerPortion: 1.5, unit: 'g', group: 'bumbu' },
    ],
    steps: [
      'Didihkan air bersama bumbu halus (bawang merah, bawang putih, kemiri), daun salam, lengkuas, dan potongan tempe.',
      'Masukkan labu siam dan kacang panjang, masak hingga setengah empuk.',
      'Tuang santan encer dan masukkan terong, aduk perlahan agar santan tidak pecah.',
      'Bumbui garam dan sedikit gula, masak hingga matang tanak.',
    ],
    kitchenTips: 'Gunakan santan encer dan pastikan benar-benar mendidih tanak agar aman hingga waktu santap.',
    nutritionPerPortion: { calories: 95, proteinGrams: 4.2, carbsGrams: 8, fatGrams: 5.5 },
  },
  tumis_daun_singkong: {
    id: 'tumis_daun_singkong',
    name: 'Tumis Daun Singkong',
    category: 'sayuran',
    shortSummary: 'Daun singkong rebus empuk dicincang kasar lalu ditumis bumbu bawang dan teri/tempe ringan.',
    prepMinutes: 25,
    cookMinutes: 15,
    ingredients: [
      { name: 'Daun singkong muda rebus peras', amountPerPortion: 60, unit: 'g', group: 'utama' },
      { name: 'Bawang merah & bawang putih iris', amountPerPortion: 5, unit: 'g', group: 'bumbu' },
      { name: 'Lengkuas & daun salam', amountPerPortion: 1, unit: 'g', group: 'bumbu' },
      { name: 'Garam & sedikit gula', amountPerPortion: 1, unit: 'g', group: 'bumbu' },
      { name: 'Minyak goreng', amountPerPortion: 3, unit: 'ml', group: 'pelengkap' },
    ],
    steps: [
      'Rebus daun singkong muda dalam air mendidih dengan sedikit garam hingga empuk, peras airnya lalu iris kasar.',
      'Tumis bawang merah, bawang putih, lengkuas, dan daun salam hingga harum.',
      'Masukkan irisan daun singkong dan sedikit air, bumbui garam dan sedikit gula.',
      'Aduk merata 4–5 menit hingga bumbu meresap.',
    ],
    kitchenTips: 'Pilih pucuk daun singkong muda dan iris cukup halus agar mudah dikunyah siswa.',
    nutritionPerPortion: { calories: 58, proteinGrams: 3.5, carbsGrams: 6.5, fatGrams: 2.6 },
  },
  tumis_sawi_tauge: {
    id: 'tumis_sawi_tauge',
    name: 'Tumis Sawi Tauge',
    category: 'sayuran',
    shortSummary: 'Sawi hijau segar dan tauge pendek renyah ditumis cepat dengan bawang putih.',
    prepMinutes: 15,
    cookMinutes: 10,
    ingredients: [
      { name: 'Sawi hijau (caisim) potong', amountPerPortion: 40, unit: 'g', group: 'utama' },
      { name: 'Tauge segar cuci bersih', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Bawang putih & bawang merah', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Saus tiram, garam & minyak', amountPerPortion: 3.5, unit: 'g', group: 'pelengkap' },
    ],
    steps: [
      'Cuci bersih sawi hijau dan tauge, tiriskan sempurna.',
      'Tumis bawang merah dan bawang putih hingga harum.',
      'Masukkan sawi terlebih dahulu 1 menit, lalu masukkan tauge, saus tiram, dan garam.',
      'Aduk cepat 1–2 menit lalu segera angkat agar tauge tetap renyah.',
    ],
    kitchenTips: 'Pastikan tauge dimasak matang penuh (tidak mentah) sesuai keamanan pangan sekolah.',
    nutritionPerPortion: { calories: 46, proteinGrams: 2.3, carbsGrams: 4.5, fatGrams: 2.4 },
  },
  tumis_buncis_jagung: {
    id: 'tumis_buncis_jagung',
    name: 'Tumis Buncis Jagung',
    category: 'sayuran',
    shortSummary: 'Tumis buncis hijau dan jagung manis pipil gurih manis yang cerah menggugah selera.',
    prepMinutes: 15,
    cookMinutes: 12,
    ingredients: [
      { name: 'Buncis segar iris serong', amountPerPortion: 40, unit: 'g', group: 'utama' },
      { name: 'Jagung manis pipil', amountPerPortion: 25, unit: 'g', group: 'utama' },
      { name: 'Bawang putih & bawang merah', amountPerPortion: 4, unit: 'g', group: 'bumbu' },
      { name: 'Garam, lada & minyak goreng', amountPerPortion: 3.5, unit: 'g', group: 'pelengkap' },
    ],
    steps: [
      'Tumis bawang putih dan bawang merah hingga harum.',
      'Masukkan jagung manis pipil dan sedikit air, masak 3 menit.',
      'Masukkan buncis, garam, dan sedikit lada. Aduk cepat dengan api besar sampai buncis matang cerah.',
      'Angkat dan tiriskan bila ada kelebihan air sebelum dikemas.',
    ],
    kitchenTips: 'Perpaduan hijau buncis dan kuning jagung meningkatkan daya tarik visual kotak MBG.',
    nutritionPerPortion: { calories: 58, proteinGrams: 2, carbsGrams: 8.5, fatGrams: 2.2 },
  },

  // --- BUAH ---
  pisang_muli: {
    id: 'pisang_muli',
    name: 'Pisang Muli',
    category: 'buah',
    shortSummary: 'Buah pisang muli/ambon matang pohon kaya kalium dan serat alami, higienis berkulit utuh.',
    prepMinutes: 5,
    cookMinutes: 0,
    ingredients: [
      { name: 'Pisang muli / pisang lokal matang segar', amountPerPortion: 1, unit: 'buah', group: 'utama' },
    ],
    steps: [
      'Pilih pisang berkulit kuning cerah, tidak memar, dan tingkat kematangan pas.',
      'Pisahkan per buah tanpa merobek pangkal kulit agar bagian dalam tetap steril.',
      'Lap bersih kulit luar dengan air matang/food-grade cloth, keringkan lalu tata di kotak makan.',
    ],
    kitchenTips: 'Pisang adalah buah paling praktis dan higienis untuk distribusi MBG karena terlindung kulit alami.',
    nutritionPerPortion: { calories: 85, proteinGrams: 1, carbsGrams: 22, fatGrams: 0.2 },
  },
  pepaya: {
    id: 'pepaya',
    name: 'Pepaya',
    category: 'buah',
    shortSummary: 'Potongan pepaya California matang manis kaya vitamin A, C, dan enzim pencernaan.',
    prepMinutes: 15,
    cookMinutes: 0,
    ingredients: [
      { name: 'Pepaya matang segar (berat bersih kupas)', amountPerPortion: 90, unit: 'g', group: 'utama' },
    ],
    steps: [
      'Cuci kulit luar pepaya di air mengalir sebelum dikupas agar kontaminasi tidak berpindah ke daging buah.',
      'Kupas kulit tipis, belah, dan bersihkan seluruh biji serta selaput dalamnya.',
      'Potong dadu atau balok seragam (±90 g/porsi) menggunakan pisau dan talenan khusus buah.',
      'Simpan di wadah tertutup dingin hingga waktu pemorsian.',
    ],
    kitchenTips: 'Gunakan talenan khusus buah (kode warna berbeda dari daging/bumbu) agar rasa buah tetap segar murni.',
    nutritionPerPortion: { calories: 42, proteinGrams: 0.5, carbsGrams: 10.5, fatGrams: 0.1 },
  },
  jeruk: {
    id: 'jeruk',
    name: 'Jeruk',
    category: 'buah',
    shortSummary: 'Buah jeruk manis lokal segar sumber vitamin C untuk membantu penyerapan zat besi.',
    prepMinutes: 5,
    cookMinutes: 0,
    ingredients: [
      { name: 'Jeruk manis lokal (ukuran sedang ~100 g)', amountPerPortion: 1, unit: 'buah', group: 'utama' },
    ],
    steps: [
      'Sortir jeruk yang segar, kulit kencang, dan tidak busuk atau memar.',
      'Cuci seluruh buah jeruk dengan air mengalir dan tiriskan hingga benar-benar kering.',
      'Sajikan utuh agar vitamin C dan kesegaran terjaga sampai jam makan siang.',
    ],
    kitchenTips: 'Vitamin C pada jeruk sangat efektif membantu penyerapan zat besi dari ikan, telur, dan sayuran hijau.',
    nutritionPerPortion: { calories: 48, proteinGrams: 0.9, carbsGrams: 12, fatGrams: 0.2 },
  },
  semangka: {
    id: 'semangka',
    name: 'Semangka',
    category: 'buah',
    shortSummary: 'Potongan semangka merah segar tinggi kadar air untuk hidrasi alami anak sekolah.',
    prepMinutes: 15,
    cookMinutes: 0,
    ingredients: [
      { name: 'Semangka merah segar (berat bersih)', amountPerPortion: 100, unit: 'g', group: 'utama' },
    ],
    steps: [
      'Cuci bersih kulit semangka di bawah air mengalir sebelum dibelah.',
      'Belah dan potong segitiga atau dadu seragam (~100 g berat bersih daging buah).',
      'Tiriskan cairan berlebih dan kemas dalam sekat buah terpisah agar tidak membasahi nasi.',
    ],
    kitchenTips: 'Pilih semangka non-biji atau buang biji mayoritas agar aman bagi anak usia dini.',
    nutritionPerPortion: { calories: 32, proteinGrams: 0.6, carbsGrams: 8, fatGrams: 0.1 },
  },
  melon: {
    id: 'melon',
    name: 'Melon',
    category: 'buah',
    shortSummary: 'Potongan buah melon segar manis beraroma lembut, kaya vitamin C dan kalium.',
    prepMinutes: 15,
    cookMinutes: 0,
    ingredients: [
      { name: 'Melon segar (berat bersih kupas)', amountPerPortion: 90, unit: 'g', group: 'utama' },
    ],
    steps: [
      'Cuci dan sikat perlahan kulit luar melon di air mengalir sebelum dipotong.',
      'Belah, buang biji, kupas kulitnya, lalu potong dadu/iris seragam.',
      'Simpan di wadah tertutup dingin hingga menjelang pengemasan kotak makan.',
    ],
    kitchenTips: 'Jangan memotong melon terlalu awal (>3 jam sebelum distribusi) agar tekstur tetap renyah dan segar.',
    nutritionPerPortion: { calories: 34, proteinGrams: 0.7, carbsGrams: 8.2, fatGrams: 0.1 },
  },

  // --- SUSU ---
  susu_uht: {
    id: 'susu_uht',
    name: 'Susu',
    category: 'susu',
    shortSummary: 'Susu UHT plain / rendah gula siap minum (115–125 ml) sumber kalsium dan protein.',
    prepMinutes: 2,
    cookMinutes: 0,
    ingredients: [
      { name: 'Susu UHT Plain / Rendah Gula (kemasan 125 ml)', amountPerPortion: 1, unit: 'kotak', group: 'utama' },
    ],
    steps: [
      'Periksa tanggal kedaluwarsa, kondisi kemasan tidak penyok/kembung, dan nomor izin edar BPOM/Halal.',
      'Lap bagian luar kemasan bila diperlukan, pastikan sedotan menempel rapi.',
      'Distribusikan dalam suhu sejuk (tidak terpapar matahari langsung).',
    ],
    kitchenTips: 'Prioritaskan susu plain atau kadar gula tambahan minimal sesuai pedoman gizi BGN; untuk daerah non-susu dapat diganti tambahan telur/pangan sumber kalsium lokal.',
    nutritionPerPortion: { calories: 80, proteinGrams: 4, carbsGrams: 6.5, fatGrams: 4 },
  },
};

function makeDay(
  dayKey: DayKey,
  dayLabel: string,
  karbo: string,
  protein: string,
  sayur: string,
  buah: string,
  susu = 'susu_uht'
): DailyMenuPlan {
  return {
    dayKey,
    dayLabel,
    meals: {
      karbohidrat: DISHES[karbo],
      protein: DISHES[protein],
      sayuran: DISHES[sayur],
      buah: DISHES[buah],
      susu: DISHES[susu],
    },
  };
}

/**
 * 3 curated weekly cycles matching Indonesian MBG menu rotation tables (Senin–Jumat).
 */
export const CURATED_MBG_WEEKS: WeeklyMenuPlan[] = [
  {
    id: 'pekan-1',
    title: 'Siklus Pekan 1',
    subtitle: 'Variasi ayam, telur & ikan kembung — pola standar MBG Indonesia',
    source: 'curated',
    regionLabel: 'Nusantara',
    days: [
      makeDay('senin', 'Senin', 'nasi_putih', 'ayam_goreng_telur', 'orak_arik_buncis_wortel', 'pisang_muli'),
      makeDay('selasa', 'Selasa', 'nasi_putih', 'semur_telur', 'capcay_bakso', 'pepaya'),
      makeDay('rabu', 'Rabu', 'nasi_putih', 'ikan_kembung_goreng', 'tumis_kangkung', 'jeruk'),
      makeDay('kamis', 'Kamis', 'nasi_putih', 'ayam_asam_manis', 'tumis_sawi_putih_tahu', 'semangka'),
      makeDay('jumat', 'Jumat', 'nasi_gurih', 'telur_dadar', 'tumis_labu_siam_wortel', 'melon'),
    ],
  },
  {
    id: 'pekan-2',
    title: 'Siklus Pekan 2',
    subtitle: 'Variasi lele, ayam opor, sup ayam, pindang patin & telur balado',
    source: 'curated',
    regionLabel: 'Nusantara',
    days: [
      makeDay('senin', 'Senin', 'nasi_putih', 'ikan_lele_goreng', 'tumis_kacang_panjang', 'jeruk'),
      makeDay('selasa', 'Selasa', 'nasi_putih', 'ayam_opor', 'tumis_buncis_tahu', 'pisang_muli'),
      makeDay('rabu', 'Rabu', 'nasi_putih', 'sup_ayam', 'wortel_kol_buncis', 'semangka'),
      makeDay('kamis', 'Kamis', 'nasi_putih', 'pindang_patin', 'tumis_pakcoy', 'jeruk'),
      makeDay('jumat', 'Jumat', 'nasi_putih', 'telur_balado', 'sayur_asem', 'pepaya'),
    ],
  },
  {
    id: 'pekan-3',
    title: 'Siklus Pekan 3',
    subtitle: 'Variasi fuyunghai, ikan bumbu kuning, telur ceplok kecap & ayam kuning',
    source: 'curated',
    regionLabel: 'Nusantara',
    days: [
      makeDay('senin', 'Senin', 'nasi_putih', 'fuyunghai', 'tumis_oyong_jagung', 'pisang_muli'),
      makeDay('selasa', 'Selasa', 'nasi_putih', 'ayam_goreng_telur', 'sayur_lodeh', 'pepaya'),
      makeDay('rabu', 'Rabu', 'nasi_putih', 'ikan_bumbu_kuning', 'tumis_daun_singkong', 'jeruk'),
      makeDay('kamis', 'Kamis', 'nasi_putih', 'telur_ceplok_kecap', 'tumis_sawi_tauge', 'semangka'),
      makeDay('jumat', 'Jumat', 'nasi_putih', 'ayam_bumbu_kuning', 'tumis_buncis_jagung', 'melon'),
    ],
  },
];

export function sanitizeIngredientUnit(rawUnit: unknown): string {
  const s = String(rawUnit || 'g').trim();
  return s || 'g';
}

export function sanitizeIngredients(raw: unknown): RecipeIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item): RecipeIngredient => {
      const group: 'utama' | 'bumbu' | 'pelengkap' =
        item.group === 'bumbu'
          ? 'bumbu'
          : item.group === 'pelengkap'
          ? 'pelengkap'
          : 'utama';
      return {
        name: String(item.name || 'Bahan').trim(),
        amountPerPortion: Math.max(
          0.05,
          Number(item.amountPerPortion ?? item.amount_per_portion ?? 10) || 10
        ),
        unit: sanitizeIngredientUnit(item.unit),
        group,
      };
    })
    .filter((item) => item.name.length > 0);
}

/**
 * Filter weekly days by keyword and/or meal category.
 * Returns only days that have at least one matching dish.
 */
export function filterWeeklyDays(
  days: DailyMenuPlan[],
  searchQuery: string,
  categoryFilter: MealCategoryKey | 'all'
): DailyMenuPlan[] {
  const q = searchQuery.trim().toLowerCase();
  const categories =
    categoryFilter === 'all'
      ? MEAL_CATEGORIES
      : MEAL_CATEGORIES.filter((c) => c.key === categoryFilter);

  return days.filter((day) => {
    if (!q) {
      return categories.some((c) => Boolean(day.meals[c.key]));
    }
    if (day.dayLabel.toLowerCase().includes(q)) {
      return categories.some((c) => Boolean(day.meals[c.key]));
    }
    return categories.some((c) => {
      const dish = day.meals[c.key];
      if (!dish) return false;
      return (
        dish.name.toLowerCase().includes(q) ||
        dish.shortSummary.toLowerCase().includes(q) ||
        dish.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
      );
    });
  });
}

function parseKcalRange(rangeLabel: string): [number, number] {
  const nums = rangeLabel.match(/\d+/g)?.map(Number) || [];
  if (nums.length >= 2) return [nums[0], nums[1]];
  if (nums.length === 1) return [nums[0] - 50, nums[0] + 50];
  return [500, 700];
}

/**
 * Compute real nutritional & operational analysis for a weekly (or filtered) plan.
 */
export function computeWeeklyNutritionAnalysis(
  days: DailyMenuPlan[],
  portions: number,
  targetGroup: MbgTargetGroupOption
): WeeklyNutritionAnalysis {
  const [targetMinKcal, targetMaxKcal] = parseKcalRange(targetGroup.energyTargetKcal);
  const safePortions = Math.max(1, portions);

  if (days.length === 0) {
    return {
      daysCount: 0,
      totalPortionsPerWeek: 0,
      avgCalories: 0,
      avgProteinGrams: 0,
      avgCarbsGrams: 0,
      avgFatGrams: 0,
      minCalories: 0,
      maxCalories: 0,
      uniqueProteinSources: [],
      targetMinKcal,
      targetMaxKcal,
      alignmentStatus: 'di_bawah',
      alignmentLabel: 'Belum ada data menu sesuai filter',
      conclusion: 'Tidak ada data hari yang memenuhi kriteria filter saat ini.',
    };
  }

  const dailyTotals = days.map((d) =>
    sumDailyNutrition(d, targetGroup.portionMultiplier)
  );
  const sumCal = dailyTotals.reduce((a, b) => a + b.calories, 0);
  const sumProt = dailyTotals.reduce((a, b) => a + b.proteinGrams, 0);
  const sumCarb = dailyTotals.reduce((a, b) => a + b.carbsGrams, 0);
  const sumFat = dailyTotals.reduce((a, b) => a + b.fatGrams, 0);

  const avgCalories = Math.round(sumCal / days.length);
  const avgProteinGrams = Math.round((sumProt / days.length) * 10) / 10;
  const avgCarbsGrams = Math.round((sumCarb / days.length) * 10) / 10;
  const avgFatGrams = Math.round((sumFat / days.length) * 10) / 10;
  const minCalories = Math.min(...dailyTotals.map((t) => t.calories));
  const maxCalories = Math.max(...dailyTotals.map((t) => t.calories));

  const uniqueProteinSources = Array.from(
    new Set(
      days
        .map((d) => d.meals.protein?.name?.trim())
        .filter((n): n is string => Boolean(n))
    )
  );

  let alignmentStatus: 'sesuai' | 'di_bawah' | 'di_atas' = 'sesuai';
  let alignmentLabel = 'Sesuai Rentang AKG Sasaran';
  if (avgCalories < targetMinKcal) {
    alignmentStatus = 'di_bawah';
    alignmentLabel = 'Sedikit di Bawah Target Energi';
  } else if (avgCalories > targetMaxKcal) {
    alignmentStatus = 'di_atas';
    alignmentLabel = 'Sedikit di Atas Target Energi';
  }

  const varietyNote =
    uniqueProteinSources.length >= days.length
      ? `Variasi protein hewani sangat baik (${uniqueProteinSources.length} jenis berbeda pada ${days.length} hari).`
      : `Terdapat ${uniqueProteinSources.length} variasi protein utama pada ${days.length} hari.`;

  const alignmentSentence =
    alignmentStatus === 'sesuai'
      ? `Rata-rata energi ${avgCalories} kkal/porsi berada tepat dalam kisaran acuan ${targetGroup.label} (${targetGroup.energyTargetKcal}).`
      : alignmentStatus === 'di_bawah'
      ? `Rata-rata energi ${avgCalories} kkal/porsi sedikit di bawah kisaran ${targetGroup.energyTargetKcal}; dapat ditambah porsi karbohidrat atau lauk pendamping.`
      : `Rata-rata energi ${avgCalories} kkal/porsi sedikit melampaui kisaran ${targetGroup.energyTargetKcal}; perhatikan takaran nasi/minyak saat pemorsian.`;

  return {
    daysCount: days.length,
    totalPortionsPerWeek: days.length * safePortions,
    avgCalories,
    avgProteinGrams,
    avgCarbsGrams,
    avgFatGrams,
    minCalories,
    maxCalories,
    uniqueProteinSources,
    targetMinKcal,
    targetMaxKcal,
    alignmentStatus,
    alignmentLabel,
    conclusion: `${alignmentSentence} Rata-rata protein mencapai ${avgProteinGrams} g/porsi. ${varietyNote}`,
  };
}

/**
 * Immutably swap a dish between two days within the same MBG meal category row
 * (e.g. moving "Nasi Gurih" from Jumat to Selasa swaps it with Selasa's karbohidrat).
 */
export function swapDishBetweenDays(
  plan: WeeklyMenuPlan,
  category: MealCategoryKey,
  fromDayKey: DayKey,
  toDayKey: DayKey
): WeeklyMenuPlan {
  if (fromDayKey === toDayKey) return plan;

  const fromIdx = plan.days.findIndex((d) => d.dayKey === fromDayKey);
  const toIdx = plan.days.findIndex((d) => d.dayKey === toDayKey);
  if (fromIdx === -1 || toIdx === -1) return plan;

  const fromDish = plan.days[fromIdx].meals[category];
  const toDish = plan.days[toIdx].meals[category];
  if (!fromDish || !toDish) return plan;

  const nextDays = plan.days.map((day, idx) => {
    if (idx === fromIdx) {
      return {
        ...day,
        meals: {
          ...day.meals,
          [category]: toDish,
        },
      };
    }
    if (idx === toIdx) {
      return {
        ...day,
        meals: {
          ...day.meals,
          [category]: fromDish,
        },
      };
    }
    return day;
  });

  return {
    ...plan,
    days: nextDays,
  };
}
