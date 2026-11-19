'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Copy,
  Check,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBasket,
  SlidersHorizontal,
  AlertCircle,
  Clock,
  Users,
  Search,
  X,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  Activity,
  Table2,
  LayoutGrid,
  Undo2,
  RotateCcw,
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
  computeWeeklyNutritionAnalysis,
  CURATED_MBG_WEEKS,
  filterWeeklyDays,
  formatWeeklyScheduleForWhatsApp,
  getNearestMondayIso,
  getTargetGroupOption,
  getWeekDatesFromMonday,
  MBG_REGION_OPTIONS,
  MBG_TARGET_GROUPS,
  MEAL_CATEGORIES,
  PORTION_PRESETS,
  swapDishBetweenDays,
} from '@/lib/mbg-menus';
import { fetchMenuRecommendation } from '@/lib/api';
import { copyTextToClipboard } from '@/lib/clipboard';
import { exportMbgPlanToExcel, exportMbgPlanToPdf } from '@/lib/export-reports';
import { MbgScheduleMatrix } from '@/components/mbg-schedule-matrix';
import { RecommendationCarousel } from '@/components/recommendation-carousel';
import { RecipeDetailDialog, ShoppingListDialog } from '@/components/recipe-detail-dialog';

interface SwapRecord {
  category: MealCategoryKey;
  fromDayKey: DayKey;
  toDayKey: DayKey;
}

interface MbgRecommenderProps {
  onUseDayAsCaption?: (
    day: DailyMenuPlan,
    targetGroupLabel: string,
    dateIso?: string
  ) => void;
}

export function MbgRecommender({ onUseDayAsCaption }: MbgRecommenderProps) {
  const [plans, setPlans] = useState<WeeklyMenuPlan[]>(CURATED_MBG_WEEKS);
  const [activePlanId, setActivePlanId] = useState<string>(CURATED_MBG_WEEKS[0].id);
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');

  // Original snapshots & swap history per cycle for Undo / Reset Urutan
  const originalPlansRef = useRef<Record<string, WeeklyMenuPlan>>(
    Object.fromEntries(CURATED_MBG_WEEKS.map((p) => [p.id, p]))
  );
  const [swapHistoryByPlan, setSwapHistoryByPlan] = useState<
    Record<string, SwapRecord[]>
  >({});
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);

  // Portion, Target Group & Date controls
  const [portions, setPortions] = useState<number>(100);
  const [portionInput, setPortionInput] = useState<string>('100');
  const [portionError, setPortionError] = useState<string | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<MbgTargetGroupId>('sd_4_6');
  const [mondayDate, setMondayDate] = useState<string>('');

  // Search & Category filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<MealCategoryKey | 'all'>('all');

  // AI customization controls
  const [showAiOptions, setShowAiOptions] = useState<boolean>(false);
  const [regionPreference, setRegionPreference] = useState<string>('nusantara');
  const [includeMilk, setIncludeMilk] = useState<boolean>(true);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const generateLockRef = useRef<boolean>(false);

  // Export states
  const [exportingType, setExportingType] = useState<'pdf' | 'excel' | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Dialog & copy states (store dayKey so RecipeDetailDialog always shows latest swapped dish)
  const [selectedRecipe, setSelectedRecipe] = useState<{
    dayKey: DayKey;
    category: MealCategoryKey;
  } | null>(null);
  const [showShoppingList, setShowShoppingList] = useState<boolean>(false);
  const [copiedSchedule, setCopiedSchedule] = useState<boolean>(false);

  useEffect(() => {
    setMondayDate((prev) => prev || getNearestMondayIso());
  }, []);

  // Sync external portion changes (e.g. from RecipeDetailDialog) back to text input
  const applyPortions = (nextVal: number) => {
    const clamped = Math.max(1, Math.min(10000, Math.round(nextVal)));
    setPortions(clamped);
    setPortionInput(String(clamped));
    setPortionError(null);
  };

  const handlePortionInputChange = (raw: string) => {
    setPortionInput(raw);
    if (raw.trim() === '') {
      setPortionError('Masukkan jumlah porsi antara 1 sampai 10.000.');
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setPortionError('Jumlah porsi harus berupa bilangan bulat.');
      return;
    }
    if (parsed < 1 || parsed > 10000) {
      setPortionError('Rentang porsi yang didukung adalah 1 hingga 10.000 porsi.');
      return;
    }
    setPortionError(null);
    setPortions(parsed);
  };

  const handlePortionBlur = () => {
    const parsed = parseInt(portionInput, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      applyPortions(1);
    } else if (parsed > 10000) {
      applyPortions(10000);
    } else {
      applyPortions(parsed);
    }
  };

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

  const filteredDays = useMemo(
    () => filterWeeklyDays(activePlan.days, searchQuery, categoryFilter),
    [activePlan.days, searchQuery, categoryFilter]
  );

  const nutritionAnalysis = useMemo(
    () => computeWeeklyNutritionAnalysis(filteredDays, portions, targetGroup),
    [filteredDays, portions, targetGroup]
  );

  const shoppingList = useMemo(
    () =>
      buildWeeklyShoppingList(
        { ...activePlan, days: filteredDays },
        portions,
        targetGroup.portionMultiplier
      ),
    [activePlan, filteredDays, portions, targetGroup.portionMultiplier]
  );

  const hasActiveFilter = searchQuery.trim().length > 0 || categoryFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
  };

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
    if (generateLockRef.current) return;
    generateLockRef.current = true;
    setIsGenerating(true);
    setAiError(null);
    setIsRateLimited(false);
    setExportFeedback(null);

    try {
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

      if (response.success && response.data) {
        const newPlan = response.data;
        originalPlansRef.current[newPlan.id] = newPlan;
        setPlans((prev) => {
          const curatedOnly = prev.filter((p) => p.source === 'curated');
          const aiPlans = prev.filter((p) => p.source === 'ai').slice(0, 2);
          return [...curatedOnly, newPlan, ...aiPlans];
        });
        setActivePlanId(newPlan.id);
        setShowAiOptions(false);
        resetFilters();
        setSwapFeedback(null);
      } else {
        if (response.isRateLimited) setIsRateLimited(true);
        setAiError(
          response.message ||
            'AI belum berhasil menyusun rekomendasi baru. Anda tetap dapat memakai siklus menu MBG terkurasi di bawah.'
        );
      }
    } finally {
      setIsGenerating(false);
      generateLockRef.current = false;
    }
  };

  const handleDeleteAiPlan = (planId: string) => {
    delete originalPlansRef.current[planId];
    setSwapHistoryByPlan((prev) => {
      const next = { ...prev };
      delete next[planId];
      return next;
    });
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== planId);
      if (activePlanId === planId && next.length > 0) {
        setActivePlanId(next[0].id);
      }
      return next;
    });
  };

  const activeSwapHistory = swapHistoryByPlan[activePlan.id] || [];

  const handleSwapDish = (
    category: MealCategoryKey,
    fromDayKey: DayKey,
    toDayKey: DayKey
  ) => {
    if (fromDayKey === toDayKey) return;
    const fromDay = activePlan.days.find((d) => d.dayKey === fromDayKey);
    const toDay = activePlan.days.find((d) => d.dayKey === toDayKey);
    const fromDishName = fromDay?.meals[category]?.name;
    const toDishName = toDay?.meals[category]?.name;

    setPlans((prev) =>
      prev.map((p) =>
        p.id === activePlan.id
          ? swapDishBetweenDays(p, category, fromDayKey, toDayKey)
          : p
      )
    );
    setSwapHistoryByPlan((prev) => ({
      ...prev,
      [activePlan.id]: [
        ...(prev[activePlan.id] || []),
        { category, fromDayKey, toDayKey },
      ],
    }));

    if (fromDishName && toDishName && fromDay && toDay) {
      setSwapFeedback(
        `${fromDishName} (${fromDay.dayLabel}) ditukar dengan ${toDishName} (${toDay.dayLabel}).`
      );
    }
  };

  const handleUndoSwap = () => {
    const history = swapHistoryByPlan[activePlan.id] || [];
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setPlans((prev) =>
      prev.map((p) =>
        p.id === activePlan.id
          ? swapDishBetweenDays(p, last.category, last.toDayKey, last.fromDayKey)
          : p
      )
    );
    setSwapHistoryByPlan((prev) => ({
      ...prev,
      [activePlan.id]: history.slice(0, -1),
    }));
    setSwapFeedback('Perubahan urutan terakhir dibatalkan.');
  };

  const handleResetOrder = () => {
    const original = originalPlansRef.current[activePlan.id];
    if (!original) return;
    setPlans((prev) =>
      prev.map((p) => (p.id === activePlan.id ? original : p))
    );
    setSwapHistoryByPlan((prev) => ({
      ...prev,
      [activePlan.id]: [],
    }));
    setSwapFeedback('Urutan jadwal dikembalikan ke susunan awal siklus.');
  };

  const handleCopyWeeklySchedule = async () => {
    if (filteredDays.length === 0) return;
    const text = formatWeeklyScheduleForWhatsApp(
      { ...activePlan, days: filteredDays },
      portions,
      targetGroup,
      weekDates
    );
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2400);
    }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (exportingType || filteredDays.length === 0) return;
    setExportingType(type);
    setExportFeedback(null);

    try {
      const payload = {
        plan: activePlan,
        filteredDays,
        weekDates,
        portions,
        targetGroup,
        categoryFilter,
        searchQuery,
      };
      const filename =
        type === 'pdf'
          ? await exportMbgPlanToPdf(payload)
          : await exportMbgPlanToExcel(payload);

      setExportFeedback({
        type: 'success',
        message: `${type === 'pdf' ? 'Laporan PDF' : 'File Excel'} berhasil diunduh: ${filename}`,
      });
    } catch (err) {
      setExportFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : `Gagal mengekspor ${type === 'pdf' ? 'PDF' : 'Excel'}. Silakan coba kembali.`,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleUseDayCaption = (day: DailyMenuPlan) => {
    if (!onUseDayAsCaption) return;
    const idx = activePlan.days.findIndex((d) => d.dayKey === day.dayKey);
    const isoDate = idx >= 0 ? getIsoDateForDay(idx) : undefined;
    onUseDayAsCaption(day, targetGroup.label, isoDate);
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-5">
      {/* Control Card: Target Group, Portions & AI Generator */}
      <section className="bg-surface rounded-2xl border border-border p-4 sm:p-6 flex flex-col gap-5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-terracotta-700">
              Perencana Siklus MBG Indonesia
            </span>
            <h1 className="text-lg sm:text-2xl font-extrabold text-ink tracking-tight mt-0.5">
              Rekomendasi Menu Senin–Jumat
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
              Geser &amp; tukar hidangan antar-hari langsung di tabel, ubah jumlah porsi secara live, klik untuk detail resep, atau ekspor laporan ke PDF &amp; Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAiOptions((v) => !v)}
              aria-expanded={showAiOptions}
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
                maxLength={240}
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
                onClick={() => applyPortions(portions > 50 ? portions - 10 : portions - 1)}
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
                  value={portionInput}
                  aria-invalid={portionError ? 'true' : undefined}
                  aria-describedby={portionError ? 'mbg-portion-error' : undefined}
                  onChange={(e) => handlePortionInputChange(e.target.value)}
                  onBlur={handlePortionBlur}
                  className={`w-full h-10 pl-3 pr-14 rounded-xl bg-surface border font-mono font-bold text-sm text-ink outline-none ${
                    portionError
                      ? 'border-rose-400 focus:border-rose-600'
                      : 'border-border focus:border-forest-700'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint pointer-events-none">
                  porsi
                </span>
              </div>
              <button
                type="button"
                onClick={() => applyPortions(portions >= 50 ? portions + 10 : portions + 1)}
                aria-label="Tambah jumlah porsi"
                className="w-10 h-10 rounded-xl bg-subtle hover:bg-border/60 border border-border flex items-center justify-center text-ink shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {portionError && (
              <p id="mbg-portion-error" role="alert" className="text-[11px] text-rose-700 font-medium">
                {portionError}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {PORTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPortions(preset)}
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

      {/* Main Interactive Recommendation Workspace */}
      <section className="bg-surface rounded-2xl border border-border overflow-hidden min-w-0">
        {/* Cycle Switcher + Export & Utility Actions */}
        <div className="p-4 sm:px-6 border-b border-border bg-subtle/40 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Cycle Pills (with Delete action for AI-generated cycles) */}
          <div className="flex items-center gap-1.5 overflow-x-auto clean-scroll pb-0.5 xl:pb-0">
            {plans.map((plan) => {
              const isSelected = plan.id === activePlan.id;
              return (
                <div
                  key={plan.id}
                  className={`inline-flex items-center rounded-xl border shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'bg-surface hover:bg-subtle text-ink-muted border-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActivePlanId(plan.id)}
                    data-compact-target="true"
                    className="px-3.5 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
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
                  {plan.source === 'ai' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAiPlan(plan.id)}
                      aria-label={`Hapus ${plan.title}`}
                      data-compact-target="true"
                      className={`pr-2.5 pl-1 py-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'text-forest-100 hover:text-white'
                          : 'text-ink-faint hover:text-rose-700'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Toolbar: Shopping List, Copy WA, Export PDF, Export Excel */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShoppingList(true)}
              disabled={filteredDays.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-100 text-terracotta-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingBasket className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Daftar Belanja ({shoppingList.length})</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWeeklySchedule}
              disabled={filteredDays.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-subtle border border-border text-ink text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiedSchedule ? (
                <>
                  <Check className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Salin WA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exportingType !== null || filteredDays.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingType === 'pdf' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={exportingType !== null || filteredDays.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest-50 hover:bg-forest-100 border border-forest-200 text-forest-900 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingType === 'excel' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Membuat Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
                  <span>Export Excel</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Export Feedback Banner */}
        {exportFeedback && (
          <div
            role={exportFeedback.type === 'error' ? 'alert' : 'status'}
            className={`mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              exportFeedback.type === 'success'
                ? 'bg-forest-50 border-forest-200 text-forest-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {exportFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-forest-700 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{exportFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportFeedback(null)}
              aria-label="Tutup notifikasi export"
              data-compact-target="true"
              className="p-1 rounded-lg hover:bg-black/5 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Executive Nutrition & Operational Analysis Strip */}
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-border flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="mbg-schedule-table-title"
                className="text-sm sm:text-base font-bold text-ink"
              >
                {activePlan.title} — Menu MBG Senin s.d. Jumat
              </h2>
              <p className="text-xs text-ink-muted">{activePlan.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-forest-50 text-forest-800 border border-forest-100 font-mono text-xs font-semibold">
                {portions.toLocaleString('id-ID')} porsi/hari
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-subtle text-ink-muted border border-border font-mono text-xs">
                {targetGroup.shortLabel}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  nutritionAnalysis.alignmentStatus === 'sesuai'
                    ? 'bg-forest-50 text-forest-800 border-forest-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{nutritionAnalysis.alignmentLabel}</span>
              </span>
            </div>
          </div>

          {filteredDays.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-canvas border border-border">
                <span className="text-[11px] text-ink-muted block">Rata-rata Energi / Porsi</span>
                <span className="text-sm sm:text-base font-mono font-bold text-ink mt-0.5 block">
                  {nutritionAnalysis.avgCalories} kkal
                </span>
                <span className="text-[10px] text-ink-faint">
                  Target {targetGroup.energyTargetKcal}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-canvas border border-border">
                <span className="text-[11px] text-ink-muted block">Rata-rata Protein / Porsi</span>
                <span className="text-sm sm:text-base font-mono font-bold text-forest-800 mt-0.5 block">
                  {nutritionAnalysis.avgProteinGrams} g
                </span>
                <span className="text-[10px] text-ink-faint">
                  K {nutritionAnalysis.avgCarbsGrams}g · L {nutritionAnalysis.avgFatGrams}g
                </span>
              </div>
              <div className="p-3 rounded-xl bg-canvas border border-border">
                <span className="text-[11px] text-ink-muted block">Total Porsi Terjadwal</span>
                <span className="text-sm sm:text-base font-mono font-bold text-ink mt-0.5 block">
                  {nutritionAnalysis.totalPortionsPerWeek.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-ink-faint">
                  {nutritionAnalysis.daysCount} hari × {portions.toLocaleString('id-ID')} porsi
                </span>
              </div>
              <div className="p-3 rounded-xl bg-canvas border border-border">
                <span className="text-[11px] text-ink-muted block">Kebutuhan Bahan Baku</span>
                <span className="text-sm sm:text-base font-mono font-bold text-terracotta-700 mt-0.5 block">
                  {shoppingList.length} item
                </span>
                <span className="text-[10px] text-ink-faint">
                  {nutritionAnalysis.uniqueProteinSources.length} variasi protein utama
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Search, Category Filter & View Mode Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-border bg-subtle/25 flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari hidangan, bahan, atau hari (mis. ayam, ikan, telur)..."
              aria-label="Cari hidangan atau bahan menu MBG"
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-surface border border-border text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-forest-700 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                data-compact-target="true"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            <div
              className="flex items-center gap-1.5 overflow-x-auto clean-scroll py-0.5 max-w-full"
              role="group"
              aria-label="Filter kategori makanan"
            >
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                data-compact-target="true"
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors shrink-0 cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-forest-700 text-white border-forest-700'
                    : 'bg-surface hover:bg-subtle text-ink-muted border-border'
                }`}
              >
                Semua (5)
              </button>
              {MEAL_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  data-compact-target="true"
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors shrink-0 cursor-pointer ${
                    categoryFilter === cat.key
                      ? 'bg-forest-700 text-white border-forest-700'
                      : 'bg-surface hover:bg-subtle text-ink-muted border-border'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Compact View Switcher: Interactive Matrix Table (Default) vs Card Carousel */}
            <div
              className="inline-flex p-0.5 rounded-xl bg-surface border border-border shrink-0"
              role="group"
              aria-label="Pilih tampilan jadwal menu"
            >
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                aria-pressed={viewMode === 'matrix'}
                data-compact-target="true"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'matrix'
                    ? 'bg-forest-700 text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
                data-compact-target="true"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-forest-700 text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Kartu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Swap Status & Undo/Reset Urutan Bar */}
        {(activeSwapHistory.length > 0 || swapFeedback) && (
          <div
            role="status"
            className="px-4 sm:px-6 py-2.5 border-b border-forest-100 bg-forest-50/70 text-xs text-forest-900 flex flex-wrap items-center justify-between gap-2 no-print"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-forest-700 shrink-0" aria-hidden="true" />
              <span className="font-medium">
                {swapFeedback ||
                  `Jadwal disesuaikan (${activeSwapHistory.length} pertukaran pada ${activePlan.title}).`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {activeSwapHistory.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoSwap}
                    data-compact-target="true"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-subtle border border-border text-ink text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <Undo2 className="w-3 h-3" aria-hidden="true" />
                    <span>Urungkan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetOrder}
                    data-compact-target="true"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-subtle border border-border text-ink text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Reset Urutan</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSwapFeedback(null)}
                aria-label="Tutup informasi pertukaran"
                data-compact-target="true"
                className="p-1 rounded-lg hover:bg-forest-100 text-forest-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Interactive Drag-and-Drop Matrix Table (Default) OR Interactive Cards Carousel OR Empty State */}
        <div className="min-w-0">
          {filteredDays.length === 0 ? (
            <div className="p-4 sm:p-6">
              <div className="py-12 px-4 text-center rounded-2xl bg-canvas border border-dashed border-border flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-subtle text-ink-muted flex items-center justify-center">
                  <Search className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    Tidak ada menu yang cocok dengan filter
                  </h3>
                  <p className="text-xs text-ink-muted mt-1 max-w-sm">
                    Tidak ditemukan hidangan atau bahan untuk kata kunci{' '}
                    <strong>&ldquo;{searchQuery}&rdquo;</strong>
                    {categoryFilter !== 'all' ? ` pada kategori ${categoryFilter}` : ''}.
                  </p>
                </div>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'matrix' ? (
            <MbgScheduleMatrix
              days={filteredDays}
              weekDates={weekDates}
              targetGroup={targetGroup}
              categoryFilter={categoryFilter}
              searchQuery={searchQuery}
              onSelectDish={(day, category) =>
                setSelectedRecipe({ dayKey: day.dayKey, category })
              }
              onSwapDish={handleSwapDish}
              onUseDayAsCaption={handleUseDayCaption}
            />
          ) : (
            <div className="p-4 sm:p-6">
              <RecommendationCarousel
                days={filteredDays}
                weekDates={weekDates}
                targetGroup={targetGroup}
                portions={portions}
                categoryFilter={categoryFilter}
                searchQuery={searchQuery}
                onSelectDish={(day, category) =>
                  setSelectedRecipe({ dayKey: day.dayKey, category })
                }
                onUseDayAsCaption={handleUseDayCaption}
              />
            </div>
          )}
        </div>
      </section>

      {/* Native <dialog> Recipe Detail */}
      <RecipeDetailDialog
        isOpen={Boolean(selectedRecipe)}
        onClose={() => setSelectedRecipe(null)}
        day={
          selectedRecipe
            ? activePlan.days.find((d) => d.dayKey === selectedRecipe.dayKey) || null
            : null
        }
        dayDateLabel={
          selectedRecipe ? weekDates[selectedRecipe.dayKey] : undefined
        }
        initialCategory={selectedRecipe?.category || 'protein'}
        portions={portions}
        onPortionsChange={applyPortions}
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
