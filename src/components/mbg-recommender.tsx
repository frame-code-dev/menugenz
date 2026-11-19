'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChefHat,
  Copy,
  Check,
  Loader2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  ShoppingBasket,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutList,
  AlertCircle,
  Clock,
  ChevronRight,
  Users,
} from 'lucide-react';
import {
  DailyMenuPlan,
  DayKey,
  MbgTargetGroupId,
  MealCategoryKey,
  WeeklyMenuPlan,
} from '@/types/recommendation';
import {
  buildWeeklyShoppingList,
  CURATED_MBG_WEEKS,
  formatWeeklyScheduleForWhatsApp,
  getNearestMondayIso,
  getTargetGroupOption,
  getWeekDatesFromMonday,
  MBG_REGION_OPTIONS,
  MBG_TARGET_GROUPS,
  MEAL_CATEGORIES,
  PORTION_PRESETS,
  sumDailyNutrition,
} from '@/lib/mbg-menus';
import { fetchMenuRecommendation } from '@/lib/api';
import { RecipeDetailDialog, ShoppingListDialog } from '@/components/recipe-detail-dialog';

interface MbgRecommenderProps {
  onUseDayAsCaption?: (day: DailyMenuPlan, targetGroupLabel: string, dateIso?: string) => void;
}

export function MbgRecommender({ onUseDayAsCaption }: MbgRecommenderProps) {
  const [plans, setPlans] = useState<WeeklyMenuPlan[]>(CURATED_MBG_WEEKS);
  const [activePlanId, setActivePlanId] = useState<string>(CURATED_MBG_WEEKS[0].id);

  // Portion & Target Group settings
  const [portions, setPortions] = useState<number>(100);
  const [targetGroupId, setTargetGroupId] = useState<MbgTargetGroupId>('sd_4_6');
  const [mondayDate, setMondayDate] = useState<string>('');

  useEffect(() => {
    setMondayDate((prev) => prev || getNearestMondayIso());
  }, []);

  // AI customization controls
  const [showAiOptions, setShowAiOptions] = useState<boolean>(false);
  const [regionPreference, setRegionPreference] = useState<string>('nusantara');
  const [includeMilk, setIncludeMilk] = useState<boolean>(true);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);

  // Mobile display toggle (Card view vs Full Matrix table)
  const [mobileView, setMobileView] = useState<'table' | 'cards'>('cards');
  const [selectedMobileDay, setSelectedMobileDay] = useState<DayKey>('senin');

  // Dialog states
  const [selectedRecipe, setSelectedRecipe] = useState<{
    day: DailyMenuPlan;
    category: MealCategoryKey;
  } | null>(null);
  const [showShoppingList, setShowShoppingList] = useState<boolean>(false);
  const [copiedSchedule, setCopiedSchedule] = useState<boolean>(false);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || plans[0],
    [plans, activePlanId]
  );

  const targetGroup = useMemo(
    () => getTargetGroupOption(targetGroupId),
    [targetGroupId]
  );

  const weekDates = useMemo(
    () => getWeekDatesFromMonday(mondayDate),
    [mondayDate]
  );

  const shoppingList = useMemo(
    () => buildWeeklyShoppingList(activePlan, portions, targetGroup.portionMultiplier),
    [activePlan, portions, targetGroup.portionMultiplier]
  );

  const getIsoDateForDay = (dayIndex: number): string | undefined => {
    const parts = mondayDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return undefined;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + dayIndex);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const handleGenerateAiMenu = async () => {
    setIsGenerating(true);
    setAiError(null);
    setIsRateLimited(false);

    // Gather current protein dish names so AI offers fresh variety
    const avoidDishes = activePlan.days
      .map((d) => d.meals.protein?.name)
      .filter((n): n is string => Boolean(n));

    const response = await fetchMenuRecommendation({
      targetGroup: targetGroupId,
      portions,
      regionPreference,
      includeMilk,
      notes: customNotes,
      avoidDishes,
    });

    setIsGenerating(false);

    if (response.success && response.data) {
      const newPlan = response.data;
      setPlans((prev) => {
        const curatedOnly = prev.filter((p) => p.source === 'curated');
        const aiPlans = prev.filter((p) => p.source === 'ai').slice(0, 2);
        return [...curatedOnly, newPlan, ...aiPlans];
      });
      setActivePlanId(newPlan.id);
      setShowAiOptions(false);
    } else {
      if (response.isRateLimited) setIsRateLimited(true);
      setAiError(
        response.message ||
          'AI belum berhasil menyusun rekomendasi baru. Anda tetap dapat memakai siklus menu MBG terkurasi di bawah.'
      );
    }
  };

  const handleCopyWeeklySchedule = async () => {
    const text = formatWeeklyScheduleForWhatsApp(
      activePlan,
      portions,
      targetGroup,
      weekDates
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2400);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2400);
    }
  };

  const handleUseDayCaption = (day: DailyMenuPlan) => {
    if (!onUseDayAsCaption) return;
    const idx = activePlan.days.findIndex((d) => d.dayKey === day.dayKey);
    const isoDate = idx >= 0 ? getIsoDateForDay(idx) : undefined;
    onUseDayAsCaption(day, targetGroup.label, isoDate);
  };

  const activeMobileDay =
    activePlan.days.find((d) => d.dayKey === selectedMobileDay) || activePlan.days[0];

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Control Card: Target Group, Portions & AI Generator */}
      <section className="bg-surface rounded-2xl border border-border p-4 sm:p-6 flex flex-col gap-5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-terracotta-700">
              Perencana Siklus MBG Indonesia
            </span>
            <h2 className="text-lg sm:text-2xl font-extrabold text-ink tracking-tight mt-0.5">
              Rekomendasi Menu Senin–Jumat
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
              Klik hidangan mana saja untuk membuka resep lengkap beserta takaran bahan yang otomatis dihitung sesuai jumlah porsi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAiOptions((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-subtle hover:bg-border/60 border border-border text-ink text-xs font-semibold transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Filter AI</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateAiMenu}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Menyusun Menu AI...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>Generate Menu AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Optional AI Filters Drawer */}
        {showAiOptions && (
          <div className="p-4 rounded-2xl bg-subtle/70 border border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mbg-region-select"
                className="text-xs font-semibold text-ink"
              >
                Preferensi Pangan / Wilayah
              </label>
              <select
                id="mbg-region-select"
                value={regionPreference}
                onChange={(e) => setRegionPreference(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-surface border border-border text-xs font-medium text-ink focus:border-forest-700 outline-none"
              >
                {MBG_REGION_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mbg-notes-input"
                className="text-xs font-semibold text-ink"
              >
                Catatan Khusus / Alergi (Opsional)
              </label>
              <input
                id="mbg-notes-input"
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Mis: tanpa kacang, tidak pedas, ikan tanpa duri"
                className="px-3 py-2.5 rounded-xl bg-surface border border-border text-xs text-ink placeholder:text-ink-faint focus:border-forest-700 outline-none"
              />
            </div>

            <div className="flex flex-col justify-between gap-2">
              <span className="text-xs font-semibold text-ink">Komponen Susu Harian</span>
              <label className="inline-flex items-center gap-2.5 text-xs text-ink-muted cursor-pointer py-1.5">
                <input
                  type="checkbox"
                  checked={includeMilk}
                  onChange={(e) => setIncludeMilk(e.target.checked)}
                  className="w-4 h-4 rounded accent-forest-700"
                />
                <span>Sertakan susu UHT / segar setiap hari</span>
              </label>
            </div>
          </div>
        )}

        {/* AI Error / Rate Limit Feedback */}
        {aiError && (
          <div
            role="alert"
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              isRateLimited
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {isRateLimited ? (
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
            )}
            <span>{aiError}</span>
          </div>
        )}

        {/* Portion, Target Group & Start Date Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3 border-t border-border">
          {/* Jumlah Porsi */}
          <div className="md:col-span-5 flex flex-col gap-2">
            <label
              htmlFor="mbg-portion-input"
              className="text-xs font-bold text-ink flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
              <span>Jumlah Porsi per Hari</span>
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setPortions((p) => Math.max(1, p > 50 ? p - 10 : p - 1))
                }
                aria-label="Kurangi jumlah porsi"
                className="w-10 h-10 rounded-xl bg-subtle hover:bg-border/60 border border-border flex items-center justify-center text-ink shrink-0 cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>
              <div className="relative flex-1">
                <input
                  id="mbg-portion-input"
                  type="number"
                  min={1}
                  max={10000}
                  value={portions}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n)) {
                      setPortions(Math.max(1, Math.min(10000, n)));
                    }
                  }}
                  className="w-full h-10 pl-3 pr-14 rounded-xl bg-surface border border-border font-mono font-bold text-sm text-ink focus:border-forest-700 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">
                  porsi
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPortions((p) => Math.min(10000, p >= 50 ? p + 10 : p + 1))
                }
                aria-label="Tambah jumlah porsi"
                className="w-10 h-10 rounded-xl bg-subtle hover:bg-border/60 border border-border flex items-center justify-center text-ink shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PORTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPortions(preset)}
                  data-compact-target="true"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors cursor-pointer border ${
                    portions === preset
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'bg-surface hover:bg-subtle text-ink-muted border-border'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Kelompok Sasaran BGN */}
          <div className="md:col-span-4 flex flex-col gap-2">
            <label
              htmlFor="mbg-target-group"
              className="text-xs font-bold text-ink flex items-center justify-between"
            >
              <span>Kelompok Sasaran MBG</span>
              <span className="font-mono text-[11px] font-medium text-forest-800">
                {targetGroup.energyTargetKcal}
              </span>
            </label>
            <select
              id="mbg-target-group"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value as MbgTargetGroupId)}
              className="h-10 px-3 rounded-xl bg-surface border border-border text-xs sm:text-sm font-semibold text-ink focus:border-forest-700 outline-none cursor-pointer"
            >
              {MBG_TARGET_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-muted leading-snug">
              {targetGroup.description}
            </p>
          </div>

          {/* Tanggal Mulai Senin */}
          <div className="md:col-span-3 flex flex-col gap-2">
            <label
              htmlFor="mbg-monday-date"
              className="text-xs font-bold text-ink flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
              <span>Tanggal Mulai (Senin)</span>
            </label>
            <input
              id="mbg-monday-date"
              type="date"
              value={mondayDate}
              onChange={(e) => setMondayDate(e.target.value)}
              className="h-10 px-3 rounded-xl bg-surface border border-border text-xs sm:text-sm font-medium text-ink focus:border-forest-700 outline-none"
            />
            <span className="text-[11px] text-ink-faint">
              Otomatis mengisi tanggal Senin–Jumat
            </span>
          </div>
        </div>
      </section>

      {/* Main Weekly Schedule Card */}
      <section className="bg-surface rounded-2xl border border-border overflow-hidden print-full">
        {/* Cycle Switcher + Utility Actions */}
        <div className="p-4 sm:px-6 border-b border-border bg-subtle/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
          {/* Cycle Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto clean-scroll pb-0.5 lg:pb-0">
            {plans.map((plan) => {
              const isSelected = plan.id === activePlan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setActivePlanId(plan.id)}
                  data-compact-target="true"
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer border inline-flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'bg-surface hover:bg-subtle text-ink-muted border-border'
                  }`}
                >
                  <span>{plan.title}</span>
                  {plan.source === 'ai' && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-terracotta-50 text-terracotta-700'
                      }`}
                    >
                      AI
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions: Shopping List, Copy WA, Print, Mobile Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile View Mode Toggle */}
            <div className="inline-flex md:hidden p-0.5 rounded-xl bg-surface border border-border">
              <button
                type="button"
                onClick={() => setMobileView('cards')}
                data-compact-target="true"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                  mobileView === 'cards'
                    ? 'bg-forest-700 text-white'
                    : 'text-ink-muted'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Harian</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('table')}
                data-compact-target="true"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                  mobileView === 'table'
                    ? 'bg-forest-700 text-white'
                    : 'text-ink-muted'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tabel</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowShoppingList(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-100 text-terracotta-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ShoppingBasket className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Daftar Belanja</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWeeklySchedule}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-subtle border border-border text-ink text-xs font-semibold transition-colors cursor-pointer"
            >
              {copiedSchedule ? (
                <>
                  <Check className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Salin Jadwal WA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-subtle border border-border text-ink text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Plan Title Banner (Also visible in print!) */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-surface">
          <div>
            <h3 id="mbg-schedule-table-title" className="text-sm sm:text-base font-bold text-ink">
              {activePlan.title} — Menu MBG Senin s.d. Jumat
            </h3>
            <p className="text-xs text-ink-muted">{activePlan.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-forest-50 text-forest-800 border border-forest-100 font-semibold">
              {portions} porsi/hari
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-subtle text-ink-muted border border-border">
              {targetGroup.shortLabel}
            </span>
          </div>
        </div>

        {/* MOBILE CARD VIEW (Shown on < md when mobileView === 'cards') */}
        <div className={`${mobileView === 'cards' ? 'block md:hidden' : 'hidden'} p-4 no-print`}>
          {/* Day selector pills */}
          <div
            className="grid grid-cols-5 gap-1.5 mb-4"
            role="group"
            aria-label="Pilih hari jadwal menu"
          >
            {activePlan.days.map((day) => {
              const active = day.dayKey === activeMobileDay.dayKey;
              return (
                <button
                  key={day.dayKey}
                  type="button"
                  onClick={() => setSelectedMobileDay(day.dayKey)}
                  className={`py-2 px-1 rounded-xl border text-center transition-colors cursor-pointer ${
                    active
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'bg-subtle/60 text-ink-muted border-border'
                  }`}
                >
                  <span className="block text-xs font-bold">
                    {day.dayLabel.slice(0, 3)}
                  </span>
                  {weekDates[day.dayKey] && (
                    <span
                      className={`block text-[10px] mt-0.5 ${
                        active ? 'text-forest-100' : 'text-ink-faint'
                      }`}
                    >
                      {weekDates[day.dayKey].split(' ')[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Day Summary Header */}
          {activeMobileDay && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-base font-extrabold text-ink">
                    {activeMobileDay.dayLabel}
                    {weekDates[activeMobileDay.dayKey]
                      ? `, ${weekDates[activeMobileDay.dayKey]}`
                      : ''}
                  </h4>
                  <span className="text-xs font-mono text-ink-muted">
                    Estimasi{' '}
                    {sumDailyNutrition(activeMobileDay, targetGroup.portionMultiplier).calories}{' '}
                    kkal / porsi
                  </span>
                </div>
                {onUseDayAsCaption && (
                  <button
                    type="button"
                    onClick={() => handleUseDayCaption(activeMobileDay)}
                    className="px-3 py-1.5 rounded-xl bg-forest-50 border border-forest-100 text-forest-800 text-xs font-semibold"
                  >
                    Buat Caption
                  </button>
                )}
              </div>

              {/* 5 Category Cards */}
              <div className="flex flex-col gap-2">
                {MEAL_CATEGORIES.map((cat) => {
                  const dish = activeMobileDay.meals[cat.key];
                  if (!dish) return null;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() =>
                        setSelectedRecipe({ day: activeMobileDay, category: cat.key })
                      }
                      className="w-full text-left p-3.5 rounded-2xl bg-surface border border-border hover:border-forest-600/50 active:bg-subtle/50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint block">
                          {cat.label}
                        </span>
                        <span className="text-sm font-bold text-ink block mt-0.5">
                          {dish.name}
                        </span>
                        <span className="text-xs text-ink-muted line-clamp-1 mt-0.5 block">
                          {dish.shortSummary}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 shrink-0">
                        <span>Resep</span>
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* MATRIX TABLE VIEW (Always visible on md+ and in print, toggleable on mobile) */}
        <div
          className={`${
            mobileView === 'table' ? 'block' : 'hidden md:block'
          } mbg-table-wrapper clean-scroll`}
          tabIndex={0}
          role="region"
          aria-labelledby="mbg-schedule-table-title"
        >
          <table className="mbg-matrix-table text-left text-xs sm:text-sm min-w-[700px]">
            <thead>
              <tr className="bg-subtle text-ink border-b border-border">
                <th
                  scope="col"
                  className="py-3 px-4 w-36 bg-subtle border-b border-r border-border font-bold text-xs uppercase tracking-wider text-ink-muted"
                >
                  <div>Hari / Tgl.</div>
                  <div className="text-[11px] font-normal normal-case text-ink-faint mt-0.5">
                    Jenis Makanan
                  </div>
                </th>
                {activePlan.days.map((day) => (
                  <th
                    key={day.dayKey}
                    scope="col"
                    className="py-3 px-3.5 bg-subtle border-b border-r last:border-r-0 border-border align-top"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRecipe({ day, category: 'protein' })
                      }
                      className="w-full text-left group cursor-pointer"
                      title={`Lihat detail resep hari ${day.dayLabel}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-ink group-hover:text-forest-700 transition-colors">
                          {day.dayLabel}
                        </span>
                        <ChefHat
                          className="w-3.5 h-3.5 text-ink-faint group-hover:text-forest-700 transition-colors no-print"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="text-[11px] font-mono font-normal text-ink-muted mt-0.5">
                        {weekDates[day.dayKey] || '—'}
                      </div>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEAL_CATEGORIES.map((cat) => (
                <tr key={cat.key} className="group/row">
                  <th
                    scope="row"
                    className="py-3.5 px-4 bg-subtle border-b border-r border-border font-bold text-xs text-ink align-middle"
                  >
                    {cat.label}
                  </th>
                  {activePlan.days.map((day) => {
                    const dish = day.meals[cat.key];
                    return (
                      <td
                        key={`${day.dayKey}-${cat.key}`}
                        className="p-1.5 border-b border-r last:border-r-0 border-border align-top bg-surface"
                      >
                        {dish ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedRecipe({ day, category: cat.key })
                            }
                            className="w-full h-full min-h-[54px] text-left px-2.5 py-2 rounded-xl hover:bg-forest-50/70 focus-visible:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 transition-colors flex flex-col justify-between gap-1 group/cell cursor-pointer"
                          >
                            <span className="font-semibold text-ink group-hover/cell:text-forest-800 leading-snug text-xs sm:text-[13px]">
                              {dish.name}
                            </span>
                            <span className="text-[11px] text-ink-faint group-hover/cell:text-forest-700 inline-flex items-center gap-0.5 no-print">
                              <span>Lihat resep</span>
                              <ChevronRight className="w-3 h-3" aria-hidden="true" />
                            </span>
                          </button>
                        ) : (
                          <span className="text-ink-faint px-2.5 py-2 block">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Daily Nutrition Summary Row */}
              <tr className="bg-subtle/35">
                <th
                  scope="row"
                  className="py-3 px-4 bg-subtle border-r border-border font-bold text-[11px] uppercase tracking-wider text-ink-muted"
                >
                  Est. Gizi / Porsi
                </th>
                {activePlan.days.map((day) => {
                  const totalNut = sumDailyNutrition(
                    day,
                    targetGroup.portionMultiplier
                  );
                  return (
                    <td
                      key={`${day.dayKey}-nutrition`}
                      className="py-2.5 px-3.5 border-r last:border-r-0 border-border text-[11px] font-mono text-ink-muted"
                    >
                      <div className="font-bold text-ink">
                        ~{totalNut.calories} kkal
                      </div>
                      <div>
                        P {totalNut.proteinGrams}g · K {totalNut.carbsGrams}g
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Native <dialog> Recipe Detail */}
      <RecipeDetailDialog
        isOpen={Boolean(selectedRecipe)}
        onClose={() => setSelectedRecipe(null)}
        day={selectedRecipe?.day || null}
        dayDateLabel={
          selectedRecipe ? weekDates[selectedRecipe.day.dayKey] : undefined
        }
        initialCategory={selectedRecipe?.category || 'protein'}
        portions={portions}
        onPortionsChange={setPortions}
        targetGroup={targetGroup}
        onUseDayAsCaption={handleUseDayCaption}
      />

      {/* Native <dialog> Weekly Aggregated Shopping List */}
      <ShoppingListDialog
        isOpen={showShoppingList}
        onClose={() => setShowShoppingList(false)}
        planTitle={activePlan.title}
        portions={portions}
        targetGroup={targetGroup}
        items={shoppingList}
      />
    </div>
  );
}
