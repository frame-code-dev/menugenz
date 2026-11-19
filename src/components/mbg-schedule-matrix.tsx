'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChefHat,
  ChevronRight,
  GripVertical,
  ArrowLeftRight,
  FileText,
} from 'lucide-react';
import {
  DailyMenuPlan,
  DayKey,
  MbgTargetGroupOption,
  MealCategoryKey,
} from '@/types/recommendation';
import { MEAL_CATEGORIES, sumDailyNutrition } from '@/lib/mbg-menus';

interface MbgScheduleMatrixProps {
  days: DailyMenuPlan[];
  weekDates: Record<DayKey, string>;
  targetGroup: MbgTargetGroupOption;
  categoryFilter: MealCategoryKey | 'all';
  searchQuery: string;
  onSelectDish: (day: DailyMenuPlan, category: MealCategoryKey) => void;
  onSwapDish: (
    category: MealCategoryKey,
    fromDayKey: DayKey,
    toDayKey: DayKey
  ) => void;
  onUseDayAsCaption?: (day: DailyMenuPlan) => void;
}

interface ActivePointerDrag {
  category: MealCategoryKey;
  fromDayKey: DayKey;
  dishName: string;
  fromDayLabel: string;
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  currentX: number;
  currentY: number;
  dx: number;
  dy: number;
  targetDayKey: DayKey | null;
  started: boolean;
  fromHandle: boolean;
  captureEl: HTMLElement | null;
}

interface KeyboardGrabState {
  category: MealCategoryKey;
  currentDayKey: DayKey;
  originDayKey: DayKey;
  dishName: string;
  originDayLabel: string;
}

const MOUSE_DRAG_THRESHOLD_PX = 6;

export function MbgScheduleMatrix({
  days,
  weekDates,
  targetGroup,
  categoryFilter,
  searchQuery,
  onSelectDish,
  onSwapDish,
  onUseDayAsCaption,
}: MbgScheduleMatrixProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const handleRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dragRef = useRef<ActivePointerDrag | null>(null);
  const suppressClickRef = useRef<boolean>(false);
  const movingFocusRef = useRef<boolean>(false);
  const autoScrollRafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const [activeDrag, setActiveDrag] = useState<{
    category: MealCategoryKey;
    fromDayKey: DayKey;
    dx: number;
    dy: number;
    targetDayKey: DayKey | null;
  } | null>(null);

  const [kbGrab, setKbGrab] = useState<KeyboardGrabState | null>(null);
  const [recentSwapKeys, setRecentSwapKeys] = useState<string[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const canReorder = days.length > 1;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleCategories =
    categoryFilter === 'all'
      ? MEAL_CATEGORIES
      : MEAL_CATEGORIES.filter((c) => c.key === categoryFilter);

  const cellKey = (cat: MealCategoryKey, dayKey: DayKey) => `${cat}::${dayKey}`;

  const flashSwappedCells = useCallback(
    (category: MealCategoryKey, dayA: DayKey, dayB: DayKey) => {
      const keys = [cellKey(category, dayA), cellKey(category, dayB)];
      setRecentSwapKeys(keys);
      window.setTimeout(() => {
        setRecentSwapKeys((prev) =>
          prev[0] === keys[0] && prev[1] === keys[1] ? [] : prev
        );
      }, 700);
    },
    []
  );

  const announce = useCallback((message: string) => {
    setLiveAnnouncement('');
    window.setTimeout(() => {
      setLiveAnnouncement(message);
    }, 30);
  }, []);

  /**
   * Find destination day in the SAME category row purely from layout bounding boxes
   * (never event.target, because setPointerCapture redirects events to the capturing element).
   */
  const resolveTargetDayFromX = useCallback(
    (category: MealCategoryKey, clientX: number, fromDayKey: DayKey): DayKey | null => {
      const wrapper = wrapperRef.current;
      let clampedX = clientX;
      if (wrapper) {
        const wr = wrapper.getBoundingClientRect();
        clampedX = Math.max(wr.left + 1, Math.min(wr.right - 1, clientX));
      }

      let nearestDay: DayKey | null = null;
      let minDistance = Infinity;

      for (const day of days) {
        const td = cellRefs.current[cellKey(category, day.dayKey)];
        if (!td) continue;
        const rect = td.getBoundingClientRect();
        if (clampedX >= rect.left && clampedX <= rect.right) {
          return day.dayKey === fromDayKey ? null : day.dayKey;
        }
        const mid = rect.left + rect.width / 2;
        const dist = Math.abs(clampedX - mid);
        if (dist < minDistance) {
          minDistance = dist;
          nearestDay = day.dayKey;
        }
      }

      return nearestDay === fromDayKey ? null : nearestDay;
    },
    [days]
  );

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      window.cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    lastFrameTimeRef.current = 0;
  }, []);

  const cleanupPointerDrag = useCallback(() => {
    stopAutoScroll();
    document.documentElement.classList.remove('mbg-is-dragging');
    const current = dragRef.current;
    if (current?.captureEl && current.captureEl.hasPointerCapture?.(current.pointerId)) {
      try {
        current.captureEl.releasePointerCapture(current.pointerId);
      } catch {
        // Ignore if already released
      }
    }
    dragRef.current = null;
    setActiveDrag(null);
  }, [stopAutoScroll]);

  const startAutoScrollLoop = useCallback(() => {
    if (autoScrollRafRef.current !== null) return;

    const tick = (now: number) => {
      const current = dragRef.current;
      const wrapper = wrapperRef.current;
      if (!current || !current.started || !wrapper) {
        autoScrollRafRef.current = null;
        return;
      }

      const dt = lastFrameTimeRef.current ? Math.min(50, now - lastFrameTimeRef.current) : 16;
      lastFrameTimeRef.current = now;

      const rect = wrapper.getBoundingClientRect();
      const edgeZone = Math.min(84, rect.width / 3);
      let scrollDelta = 0;

      if (current.currentX < rect.left + edgeZone) {
        const ratio = Math.min(1.5, (rect.left + edgeZone - current.currentX) / edgeZone);
        scrollDelta = -ratio * 0.45 * dt;
      } else if (current.currentX > rect.right - edgeZone) {
        const ratio = Math.min(1.5, (current.currentX - (rect.right - edgeZone)) / edgeZone);
        scrollDelta = ratio * 0.45 * dt;
      }

      if (scrollDelta !== 0) {
        const prevScroll = wrapper.scrollLeft;
        wrapper.scrollLeft += scrollDelta;
        if (wrapper.scrollLeft !== prevScroll) {
          const scrollChange = wrapper.scrollLeft - current.startScrollLeft;
          current.dx = current.currentX - current.startX + scrollChange;
          current.targetDayKey = resolveTargetDayFromX(
            current.category,
            current.currentX,
            current.fromDayKey
          );
          setActiveDrag({
            category: current.category,
            fromDayKey: current.fromDayKey,
            dx: current.dx,
            dy: current.dy,
            targetDayKey: current.targetDayKey,
          });
        }
      }

      autoScrollRafRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollRafRef.current = window.requestAnimationFrame(tick);
  }, [resolveTargetDayFromX]);

  // Global pointer & Escape listeners while a pointer drag is active
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const rawDx = event.clientX - current.startX;
      const rawDy = event.clientY - current.startY;

      if (!current.started) {
        const dist = Math.hypot(rawDx, rawDy);
        if (dist < MOUSE_DRAG_THRESHOLD_PX) return;
        current.started = true;
        document.documentElement.classList.add('mbg-is-dragging');
        startAutoScrollLoop();
      }

      current.currentX = event.clientX;
      current.currentY = event.clientY;
      const scrollChange = (wrapperRef.current?.scrollLeft ?? 0) - current.startScrollLeft;
      current.dx = rawDx + scrollChange;
      // Dampen vertical travel so the card clearly glides horizontally along its category row
      current.dy = Math.max(-28, Math.min(28, rawDy * 0.45));
      current.targetDayKey = resolveTargetDayFromX(
        current.category,
        event.clientX,
        current.fromDayKey
      );

      setActiveDrag({
        category: current.category,
        fromDayKey: current.fromDayKey,
        dx: current.dx,
        dy: current.dy,
        targetDayKey: current.targetDayKey,
      });
    };

    const finishPointerDrag = (event: PointerEvent, cancelled: boolean) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const wasStarted = current.started;
      const targetKey = !cancelled ? current.targetDayKey : null;
      const { category, fromDayKey, dishName, fromDayLabel } = current;

      cleanupPointerDrag();

      if (wasStarted) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 80);
      }

      if (wasStarted && targetKey && targetKey !== fromDayKey) {
        const targetDay = days.find((d) => d.dayKey === targetKey);
        const targetDishName = targetDay?.meals[category]?.name || 'hidangan lain';
        onSwapDish(category, fromDayKey, targetKey);
        flashSwappedCells(category, fromDayKey, targetKey);
        announce(
          `${dishName} (${fromDayLabel}) ditukar dengan ${targetDishName} (${targetDay?.dayLabel || targetKey}).`
        );
      } else if (wasStarted && cancelled) {
        announce(`Pemindahan ${dishName} dibatalkan.`);
      }
    };

    const onPointerUp = (e: PointerEvent) => finishPointerDrag(e, false);
    const onPointerCancel = (e: PointerEvent) => finishPointerDrag(e, true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current?.started) {
        e.preventDefault();
        const dishName = dragRef.current.dishName;
        cleanupPointerDrag();
        announce(`Pemindahan ${dishName} dibatalkan.`);
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown);
      cleanupPointerDrag();
    };
  }, [
    days,
    onSwapDish,
    resolveTargetDayFromX,
    cleanupPointerDrag,
    startAutoScrollLoop,
    flashSwappedCells,
    announce,
  ]);

  const beginPointerInteraction = (
    event: React.PointerEvent<HTMLElement>,
    category: MealCategoryKey,
    day: DailyMenuPlan,
    dishName: string,
    fromHandle: boolean
  ) => {
    if (!canReorder) return;
    // Primary button only for mouse; ignore secondary clicks or competing multi-touch pointers
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (dragRef.current) return;
    // On touch/pen, require the dedicated grip handle so table scrolling stays natural
    if (!fromHandle && event.pointerType !== 'mouse') return;

    if (fromHandle) {
      event.stopPropagation();
    }

    const captureEl = event.currentTarget;
    try {
      captureEl.setPointerCapture(event.pointerId);
    } catch {
      // Fallback gracefully if pointer capture unsupported
    }

    const immediateStart = fromHandle;
    dragRef.current = {
      category,
      fromDayKey: day.dayKey,
      dishName,
      fromDayLabel: day.dayLabel,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: wrapperRef.current?.scrollLeft ?? 0,
      currentX: event.clientX,
      currentY: event.clientY,
      dx: 0,
      dy: 0,
      targetDayKey: null,
      started: immediateStart,
      fromHandle,
      captureEl,
    };

    if (immediateStart) {
      document.documentElement.classList.add('mbg-is-dragging');
      setActiveDrag({
        category,
        fromDayKey: day.dayKey,
        dx: 0,
        dy: 0,
        targetDayKey: null,
      });
      startAutoScrollLoop();
    }
  };

  // Keyboard grab–move–drop handler on the dedicated drag handle button
  const handleHandleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    category: MealCategoryKey,
    day: DailyMenuPlan,
    dishName: string
  ) => {
    if (!canReorder) return;

    const isGrabbedHere =
      kbGrab?.category === category && kbGrab?.currentDayKey === day.dayKey;

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!isGrabbedHere) {
        setKbGrab({
          category,
          currentDayKey: day.dayKey,
          originDayKey: day.dayKey,
          dishName,
          originDayLabel: day.dayLabel,
        });
        announce(
          `${dishName} pada hari ${day.dayLabel} dipilih. Gunakan panah kiri atau kanan untuk menukar hari, Spasi untuk lepas, atau Escape untuk batal.`
        );
      } else {
        setKbGrab(null);
        announce(`${dishName} ditempatkan pada hari ${day.dayLabel}.`);
      }
      return;
    }

    if (!isGrabbedHere) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      const { originDayKey, currentDayKey, originDayLabel } = kbGrab;
      setKbGrab(null);
      if (originDayKey !== currentDayKey) {
        movingFocusRef.current = true;
        onSwapDish(category, currentDayKey, originDayKey);
        window.requestAnimationFrame(() => {
          const targetCell = cellRefs.current[cellKey(category, originDayKey)];
          targetCell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          handleRefs.current[cellKey(category, originDayKey)]?.focus({
            preventScroll: true,
          });
          movingFocusRef.current = false;
        });
      }
      announce(`Pemindahan dibatalkan. ${dishName} tetap pada hari ${originDayLabel}.`);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const curIdx = days.findIndex((d) => d.dayKey === day.dayKey);
      if (curIdx === -1) return;
      const nextIdx = event.key === 'ArrowLeft' ? curIdx - 1 : curIdx + 1;
      if (nextIdx < 0 || nextIdx >= days.length) return;

      const targetDay = days[nextIdx];
      const targetDishName = targetDay.meals[category]?.name || 'hidangan lain';
      movingFocusRef.current = true;
      onSwapDish(category, day.dayKey, targetDay.dayKey);
      flashSwappedCells(category, day.dayKey, targetDay.dayKey);
      setKbGrab((prev) =>
        prev ? { ...prev, currentDayKey: targetDay.dayKey } : null
      );

      window.requestAnimationFrame(() => {
        const nextCell = cellRefs.current[cellKey(category, targetDay.dayKey)];
        nextCell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        handleRefs.current[cellKey(category, targetDay.dayKey)]?.focus({
          preventScroll: true,
        });
        movingFocusRef.current = false;
      });

      announce(
        `${dishName} digeser ke ${targetDay.dayLabel}, ditukar dengan ${targetDishName}.`
      );
    }
  };

  return (
    <div className="w-full min-w-0 flex flex-col">
      {/* Subtle Drag Hint Bar */}
      {canReorder && (
        <div className="px-4 sm:px-6 py-2 bg-canvas/70 border-b border-border/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted no-print">
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5 text-forest-700 shrink-0" aria-hidden="true" />
            <span>
              Tarik hidangan (atau ikon <strong className="text-ink">⋮⋮</strong>) ke hari lain pada baris yang sama untuk menukar jadwal — gizi &amp; laporan ikut menyesuaikan otomatis.
            </span>
          </span>
          <span className="hidden lg:inline text-ink-faint">
            Keyboard: Fokus ikon ⋮⋮ → Spasi → ← / → → Spasi
          </span>
        </div>
      )}

      {/* Semantic Responsive Matrix Table */}
      <div
        ref={wrapperRef}
        className="mbg-table-wrapper clean-scroll"
        tabIndex={0}
        role="region"
        aria-labelledby="mbg-schedule-table-title"
      >
        <table className="mbg-matrix-table text-left text-xs sm:text-sm min-w-[740px]">
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
              {days.map((day) => {
                const isTargetColumn = activeDrag?.targetDayKey === day.dayKey;
                return (
                  <th
                    key={day.dayKey}
                    scope="col"
                    className={`py-3 px-3.5 border-b border-r last:border-r-0 border-border align-top transition-colors ${
                      isTargetColumn ? 'bg-forest-50 text-forest-900' : 'bg-subtle'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDish(day, 'protein')}
                      className="w-full text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 rounded-lg"
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
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleCategories.map((cat) => {
              const isRowDragging = activeDrag?.category === cat.key;
              return (
                <tr key={cat.key} data-row-cat={cat.key}>
                  <th
                    scope="row"
                    className={`py-3.5 px-4 border-b border-r border-border font-bold text-xs align-middle transition-colors ${
                      isRowDragging
                        ? 'bg-forest-50 text-forest-900'
                        : 'bg-subtle text-ink'
                    }`}
                  >
                    {cat.label}
                  </th>

                  {days.map((day) => {
                    const dish = day.meals[cat.key];
                    const key = cellKey(cat.key, day.dayKey);
                    const isDraggedSource =
                      activeDrag?.category === cat.key &&
                      activeDrag?.fromDayKey === day.dayKey;
                    const isDropTarget =
                      activeDrag?.category === cat.key &&
                      activeDrag?.targetDayKey === day.dayKey;
                    const isKbGrabbed =
                      kbGrab?.category === cat.key &&
                      kbGrab?.currentDayKey === day.dayKey;
                    const isFlashing = recentSwapKeys.includes(key);

                    const matchesSearch =
                      Boolean(normalizedQuery) &&
                      Boolean(dish) &&
                      (dish.name.toLowerCase().includes(normalizedQuery) ||
                        dish.shortSummary.toLowerCase().includes(normalizedQuery) ||
                        dish.ingredients.some((i) =>
                          i.name.toLowerCase().includes(normalizedQuery)
                        ));

                    return (
                      <td
                        key={`${day.dayKey}-${cat.key}`}
                        ref={(el) => {
                          cellRefs.current[key] = el;
                        }}
                        data-day-key={day.dayKey}
                        data-cat-key={cat.key}
                        className={`p-1.5 border-b border-r last:border-r-0 border-border align-top transition-colors relative ${
                          isDropTarget
                            ? 'bg-forest-50/90'
                            : isFlashing
                            ? 'mbg-swap-flash bg-surface'
                            : 'bg-surface'
                        }`}
                      >
                        {dish ? (
                          <div className="relative h-full min-h-[60px]">
                            {/* Subtle slot outline left behind when card is lifted */}
                            {isDraggedSource && (
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 rounded-xl border-2 border-dashed border-forest-600/35 bg-forest-50/30 pointer-events-none"
                              />
                            )}

                            <div
                              onPointerDown={(e) =>
                                beginPointerInteraction(e, cat.key, day, dish.name, false)
                              }
                              onLostPointerCapture={() => {
                                if (dragRef.current && !dragRef.current.fromHandle) {
                                  cleanupPointerDrag();
                                }
                              }}
                              style={
                                isDraggedSource
                                  ? {
                                      transform: `translate3d(${activeDrag.dx}px, ${activeDrag.dy}px, 0) scale(1.03)`,
                                      zIndex: 30,
                                      pointerEvents: 'none',
                                    }
                                  : undefined
                              }
                              className={`mbg-drag-cell mbg-drag-card relative w-full h-full min-h-[60px] rounded-xl px-2.5 py-2 transition-all flex flex-col justify-between gap-1 ${
                                isDraggedSource
                                  ? 'bg-surface shadow-xl ring-2 ring-forest-700 border border-forest-700'
                                  : isKbGrabbed
                                  ? 'bg-forest-50 shadow-lg ring-2 ring-forest-700 scale-[1.02] z-20'
                                  : isDropTarget
                                  ? 'ring-2 ring-dashed ring-forest-700 bg-forest-50/70'
                                  : matchesSearch
                                  ? 'bg-amber-50/70 ring-1 ring-amber-300 hover:bg-forest-50/70'
                                  : 'hover:bg-forest-50/60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (suppressClickRef.current) return;
                                    onSelectDish(day, cat.key);
                                  }}
                                  className="text-left flex-1 min-w-0 group/cell cursor-pointer focus-visible:outline-none focus-visible:underline"
                                >
                                  <span className="font-semibold text-ink group-hover/cell:text-forest-800 leading-snug text-xs sm:text-[13px] block">
                                    {dish.name}
                                  </span>
                                </button>

                                {canReorder && (
                                  <button
                                    ref={(el) => {
                                      handleRefs.current[key] = el;
                                    }}
                                    type="button"
                                    data-compact-target="true"
                                    aria-label={`Geser ${dish.name} (${day.dayLabel}) ke hari lain`}
                                    aria-pressed={isKbGrabbed}
                                    title="Tarik ke hari lain atau tekan Spasi lalu ← / →"
                                    onPointerDown={(e) =>
                                      beginPointerInteraction(
                                        e,
                                        cat.key,
                                        day,
                                        dish.name,
                                        true
                                      )
                                    }
                                    onLostPointerCapture={() => {
                                      if (dragRef.current?.fromHandle) {
                                        cleanupPointerDrag();
                                      }
                                    }}
                                    onKeyDown={(e) =>
                                      handleHandleKeyDown(e, cat.key, day, dish.name)
                                    }
                                    onBlur={() => {
                                      if (isKbGrabbed && !movingFocusRef.current) {
                                        setKbGrab(null);
                                      }
                                    }}
                                    className={`mbg-drag-handle p-1 -mr-1 -mt-0.5 rounded-lg shrink-0 transition-colors no-print ${
                                      isKbGrabbed
                                        ? 'bg-forest-700 text-white'
                                        : 'text-ink-faint/80 hover:text-forest-800'
                                    }`}
                                  >
                                    <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                )}
                              </div>

                              {isDropTarget ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-forest-800 mt-0.5">
                                  <ArrowLeftRight className="w-3 h-3" aria-hidden="true" />
                                  <span>Lepas untuk tukar</span>
                                </span>
                              ) : isKbGrabbed ? (
                                <span
                                  aria-hidden="true"
                                  className="text-[10px] font-semibold text-forest-800 mt-0.5"
                                >
                                  ← / → geser · Spasi lepas
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  data-compact-target="true"
                                  onClick={() => {
                                    if (suppressClickRef.current) return;
                                    onSelectDish(day, cat.key);
                                  }}
                                  className="self-start text-[11px] text-ink-faint hover:text-forest-700 inline-flex items-center gap-0.5 cursor-pointer no-print"
                                >
                                  <span>Lihat resep</span>
                                  <ChevronRight className="w-3 h-3" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-faint px-2.5 py-2 block">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Daily Nutrition Summary Row (Recalculates live after every drag/swap) */}
            <tr className="bg-subtle/35">
              <th
                scope="row"
                className="py-3 px-4 bg-subtle border-r border-border font-bold text-[11px] uppercase tracking-wider text-ink-muted align-middle"
              >
                Est. Gizi / Porsi
              </th>
              {days.map((day) => {
                const nut = sumDailyNutrition(day, targetGroup.portionMultiplier);
                return (
                  <td
                    key={`nut-${day.dayKey}`}
                    className="py-3 px-3.5 border-r last:border-r-0 border-border align-top"
                  >
                    <div className="font-mono text-xs font-bold text-forest-800">
                      ~{nut.calories} kkal
                    </div>
                    <div className="font-mono text-[11px] text-ink-muted mt-0.5">
                      P {nut.proteinGrams}g · K {nut.carbsGrams}g
                    </div>
                    {onUseDayAsCaption && (
                      <button
                        type="button"
                        data-compact-target="true"
                        onClick={() => onUseDayAsCaption(day)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-forest-700 hover:text-forest-900 hover:underline cursor-pointer no-print"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>Buat Caption</span>
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </p>
    </div>
  );
}
