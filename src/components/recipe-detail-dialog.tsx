'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Clock,
  Users,
  Copy,
  Check,
  ChefHat,
  Info,
  ShoppingBasket,
  FileText,
  Minus,
  Plus,
} from 'lucide-react';
import {
  AggregatedShoppingItem,
  DailyMenuPlan,
  MbgTargetGroupOption,
  MealCategoryKey,
} from '@/types/recommendation';
import {
  formatRecipeTextForShare,
  formatScaledIngredient,
  MEAL_CATEGORIES,
  scaleNutrition,
} from '@/lib/mbg-menus';

/**
 * Attach Safari-compatible light-dismiss fallback for native <dialog closedby="any">
 */
export function useDialogLightDismiss(
  dialogRef: React.RefObject<HTMLDialogElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [dialogRef, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback light-dismiss where HTMLDialogElement.prototype.closedBy is unsupported (e.g. Safari)
    const supportsClosedBy =
      typeof HTMLDialogElement !== 'undefined' &&
      'closedBy' in HTMLDialogElement.prototype;

    let pressedOutside = false;

    const isOutside = (e: PointerEvent) => {
      const panel = dialog.firstElementChild;
      if (!panel) return false;
      const r = panel.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      }
    };
  }, [dialogRef, onClose]);
}

interface RecipeDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  day: DailyMenuPlan | null;
  dayDateLabel?: string;
  initialCategory: MealCategoryKey;
  portions: number;
  onPortionsChange: (nextPortions: number) => void;
  targetGroup: MbgTargetGroupOption;
  onUseDayAsCaption?: (day: DailyMenuPlan) => void;
}

export function RecipeDetailDialog({
  isOpen,
  onClose,
  day,
  dayDateLabel,
  initialCategory,
  portions,
  onPortionsChange,
  targetGroup,
  onUseDayAsCaption,
}: RecipeDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeCategory, setActiveCategory] = useState<MealCategoryKey>(initialCategory);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveCategory(initialCategory);
    setCopied(false);
  }, [initialCategory, day]);

  useDialogLightDismiss(dialogRef, isOpen && Boolean(day), onClose);

  const dish = day ? day.meals[activeCategory] : null;
  const scaledNutrition = dish
    ? scaleNutrition(dish.nutritionPerPortion, targetGroup.portionMultiplier)
    : null;

  const handleCopyRecipe = async () => {
    if (!dish || !day) return;
    const text = formatRecipeTextForShare(dish, day.dayLabel, portions, targetGroup);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const adjustPortion = (delta: number) => {
    onPortionsChange(Math.max(1, Math.min(10000, portions + delta)));
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="recipe-dialog-title"
      className="app-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      {day && dish && (
        <div className="bg-surface w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden text-ink">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-subtle/50 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mb-1">
                <span className="px-2 py-0.5 rounded-md bg-forest-50 text-forest-800 border border-forest-100 font-semibold">
                  {day.dayLabel}
                  {dayDateLabel ? `, ${dayDateLabel}` : ''}
                </span>
                <span className="capitalize font-medium text-terracotta-700">
                  {activeCategory}
                </span>
                <span className="text-ink-faint">•</span>
                <span>{targetGroup.shortLabel}</span>
              </div>
              <h2
                id="recipe-dialog-title"
                className="text-lg sm:text-xl font-extrabold text-ink leading-snug"
              >
                {dish.name}
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-0.5 leading-relaxed">
                {dish.shortSummary}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail resep"
              className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-subtle transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Day Component Switcher */}
          <div className="px-5 py-2.5 border-b border-border bg-surface overflow-x-auto clean-scroll">
            <div className="flex items-center gap-1.5 min-w-max">
              {MEAL_CATEGORIES.map((cat) => {
                const isSelected = cat.key === activeCategory;
                const itemName = day.meals[cat.key]?.name;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    data-compact-target="true"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-forest-700 text-white border-forest-700'
                        : 'bg-subtle/60 text-ink-muted hover:text-ink border-transparent hover:border-border'
                    }`}
                  >
                    <span>{cat.shortLabel}</span>
                    {itemName && (
                      <span
                        className={`ml-1.5 font-normal ${
                          isSelected ? 'text-forest-100' : 'text-ink-faint'
                        }`}
                      >
                        · {itemName.length > 16 ? `${itemName.slice(0, 16)}…` : itemName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
            {/* Live Portion Scaler + Meta */}
            <div className="p-4 rounded-2xl bg-forest-50/60 border border-forest-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-forest-700 text-white flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-xs font-bold text-forest-900 block">
                    Skala Jumlah Porsi Live
                  </span>
                  <span className="text-[11px] text-forest-800/80">
                    Takaran bahan otomatis menyesuaikan ({targetGroup.shortLabel})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => adjustPortion(portions > 50 ? -10 : -1)}
                  aria-label="Kurangi porsi"
                  className="w-9 h-9 rounded-xl bg-surface border border-border hover:bg-subtle flex items-center justify-center text-ink cursor-pointer"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={portions}
                  aria-label="Jumlah porsi resep"
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      onPortionsChange(Math.max(1, Math.min(10000, parsed)));
                    }
                  }}
                  className="w-20 h-9 px-2 text-center font-mono font-bold text-sm rounded-xl bg-surface border border-border text-ink focus:border-forest-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustPortion(portions >= 50 ? 10 : 1)}
                  aria-label="Tambah porsi"
                  className="w-9 h-9 rounded-xl bg-surface border border-border hover:bg-subtle flex items-center justify-center text-ink cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-xs font-semibold text-forest-900 ml-1">porsi</span>
              </div>
            </div>

            {/* Quick Facts: Cook time & Estimated Nutrition per 1 portion */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-3 rounded-xl bg-subtle/60 border border-border flex flex-col">
                <span className="text-[11px] text-ink-muted inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  Waktu
                </span>
                <span className="text-sm font-bold font-mono text-ink mt-0.5">
                  {dish.prepMinutes + dish.cookMinutes} mnt
                </span>
              </div>
              {scaledNutrition && (
                <>
                  <div className="p-3 rounded-xl bg-subtle/60 border border-border flex flex-col">
                    <span className="text-[11px] text-ink-muted">Energi / porsi</span>
                    <span className="text-sm font-bold font-mono text-ink mt-0.5">
                      {scaledNutrition.calories} kkal
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-subtle/60 border border-border flex flex-col">
                    <span className="text-[11px] text-ink-muted">Protein</span>
                    <span className="text-sm font-bold font-mono text-forest-800 mt-0.5">
                      {scaledNutrition.proteinGrams} g
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-subtle/60 border border-border flex flex-col">
                    <span className="text-[11px] text-ink-muted">Karbohidrat</span>
                    <span className="text-sm font-bold font-mono text-ink mt-0.5">
                      {scaledNutrition.carbsGrams} g
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-subtle/60 border border-border flex flex-col col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-ink-muted">Lemak</span>
                    <span className="text-sm font-bold font-mono text-ink mt-0.5">
                      {scaledNutrition.fatGrams} g
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Ingredients List */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <ShoppingBasket className="w-4 h-4 text-forest-700" aria-hidden="true" />
                  <span>Bahan &amp; Takaran ({portions} Porsi)</span>
                </h3>
                <span className="text-[11px] text-ink-faint">
                  Satuan otomatis ke kg / L
                </span>
              </div>

              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface overflow-hidden">
                {dish.ingredients.map((ing, idx) => {
                  const totalScaled = formatScaledIngredient(
                    ing.amountPerPortion,
                    ing.unit,
                    portions,
                    targetGroup.portionMultiplier
                  );
                  const singleScaled = formatScaledIngredient(
                    ing.amountPerPortion,
                    ing.unit,
                    1,
                    targetGroup.portionMultiplier
                  );
                  return (
                    <li
                      key={`${ing.name}-${idx}`}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-ink block">{ing.name}</span>
                        {portions > 1 && (
                          <span className="text-[11px] text-ink-faint font-mono">
                            1 porsi: {singleScaled.display}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-forest-800 bg-forest-50 border border-forest-100 px-2.5 py-1 rounded-lg text-xs sm:text-sm shrink-0">
                        {totalScaled.display}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Cooking Steps */}
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 mb-2.5">
                <ChefHat className="w-4 h-4 text-terracotta-600" aria-hidden="true" />
                <span>Cara Pengolahan &amp; Penyajian</span>
              </h3>
              <ol className="flex flex-col gap-2.5">
                {dish.steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-sm text-ink-muted leading-relaxed"
                  >
                    <span className="w-6 h-6 rounded-full bg-subtle border border-border text-ink font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-ink">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Kitchen Tip */}
            {dish.kitchenTips && (
              <div className="p-3.5 rounded-2xl bg-terracotta-50 border border-terracotta-100 text-xs text-terracotta-700 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-terracotta-600" aria-hidden="true" />
                <div>
                  <strong className="font-bold text-ink block mb-0.5">
                    Catatan Dapur MBG
                  </strong>
                  <span>{dish.kitchenTips}</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-ink-faint leading-relaxed">
              Nilai gizi dan gramasi bersifat estimasi referensi berdasarkan standar gizi seimbang
              dan dapat disesuaikan dengan kondisi bahan lokal oleh ahli gizi SPPG setempat.
            </p>
          </div>

          {/* Sticky Footer Actions */}
          <div className="px-5 py-3.5 border-t border-border bg-subtle/40 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleCopyRecipe}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border hover:bg-subtle text-ink text-xs font-semibold transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-forest-700" aria-hidden="true" />
                  <span>Resep Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  <span>Salin Resep ({portions} Porsi)</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              {onUseDayAsCaption && (
                <button
                  type="button"
                  onClick={() => {
                    onUseDayAsCaption(day);
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span>Buat Caption Hari {day.dayLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

interface ShoppingListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planTitle: string;
  portions: number;
  targetGroup: MbgTargetGroupOption;
  items: AggregatedShoppingItem[];
}

export function ShoppingListDialog({
  isOpen,
  onClose,
  planTitle,
  portions,
  targetGroup,
  items,
}: ShoppingListDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useDialogLightDismiss(dialogRef, isOpen, onClose);

  const grouped: { key: 'utama' | 'bumbu' | 'pelengkap'; label: string }[] = [
    { key: 'utama', label: 'Bahan Pangan Utama' },
    { key: 'bumbu', label: 'Bumbu & Rempah' },
    { key: 'pelengkap', label: 'Pelengkap & Minyak' },
  ];

  const handleCopyAll = async () => {
    const lines: string[] = [];
    lines.push(`*Daftar Belanja Bahan MBG — ${planTitle}*`);
    lines.push(`Senin–Jumat | ${portions} porsi/hari (${targetGroup.shortLabel})`);
    lines.push('');

    for (const g of grouped) {
      const groupItems = items.filter((i) => i.group === g.key);
      if (groupItems.length === 0) continue;
      lines.push(`*${g.label}:*`);
      groupItems.forEach((item) => {
        lines.push(`• ${item.name}: ${item.formattedTotal} (${item.usedInDays.join(', ')})`);
      });
      lines.push('');
    }

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="shopping-list-title"
      className="app-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="bg-surface w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden text-ink">
        <div className="px-5 py-4 border-b border-border bg-subtle/50 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-terracotta-700">
              Total Kebutuhan Senin–Jumat
            </span>
            <h2 id="shopping-list-title" className="text-lg font-extrabold text-ink">
              Daftar Belanja ({portions} Porsi / Hari)
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {planTitle} • Target {targetGroup.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup daftar belanja"
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          {grouped.map((g) => {
            const list = items.filter((i) => i.group === g.key);
            if (list.length === 0) return null;
            return (
              <section key={g.key}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  {g.label} ({list.length})
                </h3>
                <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                  {list.map((item, idx) => (
                    <li
                      key={`${item.name}-${idx}`}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm bg-surface"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-ink block">{item.name}</span>
                        <span className="text-[11px] text-ink-faint">
                          Dipakai: {item.usedInDays.join(', ')}
                        </span>
                      </div>
                      <span className="font-mono text-xs sm:text-sm font-bold text-forest-800 bg-forest-50 border border-forest-100 px-2.5 py-1 rounded-lg shrink-0">
                        {item.formattedTotal}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-border bg-subtle/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-surface border border-border hover:bg-subtle text-xs font-semibold text-ink cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Daftar Belanja Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Salin Daftar Belanja</span>
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
