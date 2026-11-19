'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  ChefHat,
  Utensils,
} from 'lucide-react';
import {
  DailyMenuPlan,
  DayKey,
  MbgTargetGroupOption,
  MealCategoryKey,
} from '@/types/recommendation';
import { MEAL_CATEGORIES, sumDailyNutrition } from '@/lib/mbg-menus';

interface RecommendationCarouselProps {
  days: DailyMenuPlan[];
  weekDates: Record<DayKey, string>;
  targetGroup: MbgTargetGroupOption;
  portions: number;
  categoryFilter: MealCategoryKey | 'all';
  searchQuery: string;
  onSelectDish: (day: DailyMenuPlan, category: MealCategoryKey) => void;
  onUseDayAsCaption?: (day: DailyMenuPlan) => void;
}

const CATEGORY_BADGE_TONE: Record<MealCategoryKey, string> = {
  karbohidrat: 'bg-amber-50 text-amber-900 border-amber-200/80',
  protein: 'bg-terracotta-50 text-terracotta-700 border-terracotta-100',
  sayuran: 'bg-forest-50 text-forest-800 border-forest-100',
  buah: 'bg-rose-50 text-rose-800 border-rose-200/80',
  susu: 'bg-sky-50 text-sky-900 border-sky-200/80',
};

export function RecommendationCarousel({
  days,
  weekDates,
  targetGroup,
  portions,
  categoryFilter,
  searchQuery,
  onSelectDish,
  onUseDayAsCaption,
}: RecommendationCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const lastAnnouncedIndexRef = useRef<number>(0);
  const userInteractedRef = useRef<boolean>(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef<number>(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(days.length > 1);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  // Reset active slide when days list changes (e.g., switching cycle or filter)
  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    lastAnnouncedIndexRef.current = 0;
    pendingIndexRef.current = null;
    userInteractedRef.current = false;
    setStatusAnnouncement('');
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
    setCanScrollPrev(false);
    setCanScrollNext(days.length > 1);
  }, [days]);

  const computeNearestSlideIndex = useCallback((): number => {
    const track = trackRef.current;
    if (!track || days.length === 0) return 0;

    const trackLeft = track.getBoundingClientRect().left;
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < days.length; i++) {
      const el = slideRefs.current[i];
      if (!el) continue;
      const dist = Math.abs(el.getBoundingClientRect().left - trackLeft);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  }, [days.length]);

  const syncEdgeState = useCallback(
    (idxOverride?: number) => {
      const track = trackRef.current;
      if (!track || days.length <= 1) {
        setCanScrollPrev(false);
        setCanScrollNext(false);
        return;
      }
      const idx = idxOverride ?? activeIndexRef.current;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const prevEnabled = idx > 0 || track.scrollLeft > 4;
      const nextEnabled = idx < days.length - 1 || track.scrollLeft < maxScroll - 4;

      // Redirect focus if the currently focused prev/next button becomes disabled (WCAG)
      if (!prevEnabled && document.activeElement === prevBtnRef.current && nextEnabled) {
        nextBtnRef.current?.focus();
      } else if (!nextEnabled && document.activeElement === nextBtnRef.current && prevEnabled) {
        prevBtnRef.current?.focus();
      }

      setCanScrollPrev(prevEnabled);
      setCanScrollNext(nextEnabled);
    },
    [days.length]
  );

  const announceIndexIfChanged = useCallback(
    (idx: number) => {
      if (
        userInteractedRef.current &&
        idx !== lastAnnouncedIndexRef.current &&
        days[idx]
      ) {
        lastAnnouncedIndexRef.current = idx;
        setStatusAnnouncement(
          `Menampilkan kartu ${idx + 1} dari ${days.length}: ${days[idx].dayLabel}`
        );
      }
    },
    [days]
  );

  const handleScrollSettled = useCallback(() => {
    const track = trackRef.current;
    const pending = pendingIndexRef.current;
    pendingIndexRef.current = null;

    let settledIdx: number;
    if (pending !== null && track) {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const atEdge = track.scrollLeft <= 4 || track.scrollLeft >= maxScroll - 4;
      settledIdx = atEdge ? pending : computeNearestSlideIndex();
    } else {
      settledIdx = computeNearestSlideIndex();
    }

    activeIndexRef.current = settledIdx;
    setActiveIndex(settledIdx);
    syncEdgeState(settledIdx);
    announceIndexIfChanged(settledIdx);
  }, [computeNearestSlideIndex, syncEdgeState, announceIndexIfChanged]);

  // Attach scroll + scrollend (with debounced fallback where scrollend is unsupported)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    syncEdgeState(activeIndexRef.current);
    const supportsScrollEnd = 'onscrollend' in window;

    const onScroll = () => {
      userInteractedRef.current = true;
      if (pendingIndexRef.current === null && rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          const nearest = computeNearestSlideIndex();
          activeIndexRef.current = nearest;
          setActiveIndex((prev) => (prev === nearest ? prev : nearest));
          syncEdgeState(nearest);
        });
      }

      if (!supportsScrollEnd) {
        if (settleTimerRef.current !== null) {
          window.clearTimeout(settleTimerRef.current);
        }
        settleTimerRef.current = window.setTimeout(handleScrollSettled, 130);
      }
    };

    const onScrollEnd = () => {
      handleScrollSettled();
    };

    const resizeObserver = new ResizeObserver(() => {
      syncEdgeState(activeIndexRef.current);
    });
    resizeObserver.observe(track);

    track.addEventListener('scroll', onScroll, { passive: true });
    if (supportsScrollEnd) {
      track.addEventListener('scrollend', onScrollEnd);
    }

    return () => {
      track.removeEventListener('scroll', onScroll);
      if (supportsScrollEnd) {
        track.removeEventListener('scrollend', onScrollEnd);
      }
      resizeObserver.disconnect();
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, [computeNearestSlideIndex, handleScrollSettled, syncEdgeState]);

  const scrollToSlide = useCallback(
    (targetIdx: number) => {
      const track = trackRef.current;
      const slide = slideRefs.current[targetIdx];
      if (!track || !slide) return;

      const clamped = Math.max(0, Math.min(days.length - 1, targetIdx));
      userInteractedRef.current = true;
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      syncEdgeState(clamped);
      announceIndexIfChanged(clamped);

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const trackRect = track.getBoundingClientRect();
      const slideRect = slide.getBoundingClientRect();
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const desiredLeft = Math.max(
        0,
        Math.min(maxScroll, track.scrollLeft + (slideRect.left - trackRect.left))
      );

      if (Math.abs(desiredLeft - track.scrollLeft) < 2) {
        pendingIndexRef.current = null;
        return;
      }

      pendingIndexRef.current = clamped;
      track.scrollTo({
        left: desiredLeft,
        behavior: prefersReduced ? 'auto' : 'smooth',
      });
    },
    [days.length, syncEdgeState, announceIndexIfChanged]
  );

  const handleStep = (direction: -1 | 1) => {
    const base =
      pendingIndexRef.current !== null
        ? pendingIndexRef.current
        : activeIndexRef.current;
    const nextIdx = Math.max(0, Math.min(days.length - 1, base + direction));
    scrollToSlide(nextIdx);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleCategories =
    categoryFilter === 'all'
      ? MEAL_CATEGORIES
      : MEAL_CATEGORIES.filter((c) => c.key === categoryFilter);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Kartu rekomendasi menu harian MBG"
      className="w-full min-w-0 flex flex-col gap-4"
    >
      {/* Navigation Bar: Day Markers + Prev/Next Controls (before track in DOM order) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Marker Pills for Direct Slide Jump */}
        <nav
          aria-label="Pilih hari pada carousel menu"
          className="flex items-center gap-1.5 overflow-x-auto clean-scroll max-w-full py-0.5"
        >
          {days.map((day, idx) => {
            const isActive = idx === activeIndex;
            const dateBadge = weekDates[day.dayKey];
            return (
              <button
                key={day.dayKey}
                type="button"
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Buka kartu ${day.dayLabel} (${idx + 1} dari ${days.length})`}
                onClick={() => scrollToSlide(idx)}
                data-compact-target="true"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 ${
                  isActive
                    ? 'bg-forest-700 text-white border-forest-700 ring-2 ring-forest-700/20'
                    : 'bg-surface hover:bg-subtle text-ink-muted hover:text-ink border-border'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 rounded-full transition-all ${
                    isActive ? 'w-3.5 bg-terracotta-100' : 'w-1.5 bg-ink-faint/50'
                  }`}
                />
                <span>{day.dayLabel}</span>
                {dateBadge && (
                  <span
                    className={`hidden sm:inline font-mono text-[10px] ${
                      isActive ? 'text-forest-100' : 'text-ink-faint'
                    }`}
                  >
                    {dateBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Previous / Next Controls */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className="text-xs font-mono text-ink-muted hidden sm:inline">
            {activeIndex + 1} / {days.length}
          </span>
          <button
            ref={prevBtnRef}
            type="button"
            onClick={() => handleStep(-1)}
            disabled={!canScrollPrev}
            aria-label="Kartu hari sebelumnya"
            className="w-10 h-10 rounded-xl bg-surface hover:bg-subtle active:scale-95 border border-border text-ink inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            ref={nextBtnRef}
            type="button"
            onClick={() => handleStep(1)}
            disabled={!canScrollNext}
            aria-label="Kartu hari berikutnya"
            className="w-10 h-10 rounded-xl bg-surface hover:bg-subtle active:scale-95 border border-border text-ink inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Swipeable Horizontal Track */}
      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label="Daftar kartu menu Senin sampai Jumat — geser horizontal untuk melihat hari lain"
        className="mbg-carousel-track"
      >
        {days.map((day, idx) => {
          const dailyNutrition = sumDailyNutrition(day, targetGroup.portionMultiplier);
          const totalCookMinutes = MEAL_CATEGORIES.reduce((acc, c) => {
            const d = day.meals[c.key];
            return acc + (d ? d.prepMinutes + d.cookMinutes : 0);
          }, 0);
          const dateLabel = weekDates[day.dayKey];

          const categoriesToShow = visibleCategories.filter((cat) => {
            const dish = day.meals[cat.key];
            if (!dish) return false;
            if (!normalizedQuery) return true;
            const matchesName = dish.name.toLowerCase().includes(normalizedQuery);
            const matchesSummary = dish.shortSummary.toLowerCase().includes(normalizedQuery);
            const matchesIng = dish.ingredients.some((ing) =>
              ing.name.toLowerCase().includes(normalizedQuery)
            );
            const matchesDay = day.dayLabel.toLowerCase().includes(normalizedQuery);
            return matchesName || matchesSummary || matchesIng || matchesDay;
          });

          const primaryCategoryForDetails =
            categoriesToShow[0]?.key ||
            (categoryFilter !== 'all' ? categoryFilter : 'protein');

          const isSelectedCard = idx === activeIndex;

          return (
            <article
              key={day.dayKey}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${idx + 1} dari ${days.length} — ${day.dayLabel}`}
              className={`mbg-carousel-slide shrink-0 w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(44%-0.5rem)] xl:w-[calc(38%-0.5rem)] bg-surface rounded-2xl border transition-all flex flex-col overflow-hidden shadow-sm ${
                isSelectedCard
                  ? 'border-forest-700/60 ring-1 ring-forest-700/20'
                  : 'border-border hover:border-forest-600/50'
              }`}
            >
              {/* Card Header */}
              <div className="px-4 py-3.5 bg-subtle/60 border-b border-border flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-ink tracking-tight">
                      {day.dayLabel}
                    </h4>
                    {dateLabel && (
                      <span className="px-2 py-0.5 rounded-md bg-surface border border-border font-mono text-[11px] font-semibold text-ink-muted">
                        {dateLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted font-mono">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-ink-faint" aria-hidden="true" />
                      ±{totalCookMinutes} mnt
                    </span>
                    <span>{portions} porsi</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-forest-50 border border-forest-100 font-mono text-xs font-bold text-forest-800">
                    ~{dailyNutrition.calories} kkal
                  </span>
                  <span className="block text-[10px] text-ink-faint mt-0.5">
                    per porsi ({targetGroup.shortLabel})
                  </span>
                </div>
              </div>

              {/* Macro Nutrition Bar */}
              <div className="px-4 py-2 bg-canvas/70 border-b border-border/80 grid grid-cols-3 gap-2 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
                    Protein
                  </span>
                  <span className="text-xs font-mono font-bold text-forest-800">
                    {dailyNutrition.proteinGrams} g
                  </span>
                </div>
                <div className="flex flex-col border-x border-border/70">
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
                    Karbohidrat
                  </span>
                  <span className="text-xs font-mono font-bold text-ink">
                    {dailyNutrition.carbsGrams} g
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
                    Lemak
                  </span>
                  <span className="text-xs font-mono font-bold text-ink">
                    {dailyNutrition.fatGrams} g
                  </span>
                </div>
              </div>

              {/* Dish Items (All 5 MBG categories preserved & clickable) */}
              <div className="p-3.5 flex-1 flex flex-col gap-2">
                {categoriesToShow.map((cat) => {
                  const dish = day.meals[cat.key];
                  if (!dish) return null;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => onSelectDish(day, cat.key)}
                      className="w-full text-left px-3 py-2.5 rounded-xl bg-canvas/60 hover:bg-forest-50/80 active:scale-[0.995] border border-border/70 hover:border-forest-600/40 transition-all flex items-center justify-between gap-2.5 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${CATEGORY_BADGE_TONE[cat.key]}`}
                          >
                            {cat.shortLabel}
                          </span>
                          <span className="font-bold text-ink group-hover:text-forest-800 text-xs sm:text-[13px] truncate">
                            {dish.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted line-clamp-1">
                          {dish.shortSummary}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-forest-700 shrink-0">
                        <span>Resep</span>
                        <ChevronRight
                          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Card Footer Actions */}
              <div className="px-3.5 py-3 bg-subtle/40 border-t border-border flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDish(day, primaryCategoryForDetails)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface hover:bg-subtle border border-border text-ink text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                >
                  <ChefHat className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
                  <span>Lihat Resep</span>
                </button>

                {onUseDayAsCaption && (
                  <button
                    type="button"
                    onClick={() => onUseDayAsCaption(day)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 focus-visible:ring-offset-1"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Buat Caption</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Swipe Hint (mobile) + Screen Reader Polite Status */}
      <div className="flex items-center justify-between text-[11px] text-ink-faint px-0.5">
        <span className="inline-flex items-center gap-1.5">
          <Utensils className="w-3 h-3 text-forest-700" aria-hidden="true" />
          <span>Geser kartu ke samping atau gunakan tombol panah untuk berpindah hari</span>
        </span>
        <span className="font-mono sm:hidden">
          {activeIndex + 1}/{days.length}
        </span>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {statusAnnouncement}
      </p>
    </section>
  );
}
