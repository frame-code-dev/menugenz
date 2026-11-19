export type MbgTargetGroupId =
  | 'paud_tk'
  | 'sd_1_3'
  | 'sd_4_6'
  | 'smp'
  | 'sma_smk'
  | 'ibu_hamil_menyusui';

export interface MbgTargetGroupOption {
  id: MbgTargetGroupId;
  label: string;
  shortLabel: string;
  /** Multiplier relative to base portion (SD kelas 4-6 = 1.0) */
  portionMultiplier: number;
  energyTargetKcal: string;
  description: string;
}

export type MealCategoryKey =
  | 'karbohidrat'
  | 'protein'
  | 'sayuran'
  | 'buah'
  | 'susu';

export type DayKey = 'senin' | 'selasa' | 'rabu' | 'kamis' | 'jumat';

export interface RecipeIngredient {
  name: string;
  /** Base amount for 1 standard portion (SD 4-6 scale) */
  amountPerPortion: number;
  /** Standard unit: 'g', 'ml', 'butir', 'buah', 'potong', 'siung', 'lembar', 'batang', 'sdm', 'sdt', 'kotak', 'ikat' */
  unit: string;
  group?: 'utama' | 'bumbu' | 'pelengkap';
}

export interface NutritionEstimate {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface DishRecipe {
  id: string;
  name: string;
  category: MealCategoryKey;
  shortSummary: string;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  kitchenTips?: string;
  nutritionPerPortion: NutritionEstimate;
}

export interface DailyMenuPlan {
  dayKey: DayKey;
  dayLabel: string;
  meals: Record<MealCategoryKey, DishRecipe>;
}

export interface WeeklyMenuPlan {
  id: string;
  title: string;
  subtitle: string;
  source: 'curated' | 'ai';
  regionLabel?: string;
  days: DailyMenuPlan[];
}

export interface RecommendMenuRequest {
  targetGroup: MbgTargetGroupId;
  portions: number;
  regionPreference: string;
  includeMilk: boolean;
  notes?: string;
  avoidDishes?: string[];
}

export interface RecommendMenuApiResponse {
  success: boolean;
  data?: WeeklyMenuPlan;
  message?: string;
  isRateLimited?: boolean;
}

export interface AggregatedShoppingItem {
  name: string;
  unit: string;
  totalAmount: number;
  formattedTotal: string;
  group: 'utama' | 'bumbu' | 'pelengkap';
  usedInDays: string[];
}
