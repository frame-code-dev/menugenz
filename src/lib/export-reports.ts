import { APP_VERSION_TAG } from '@/lib/version';
import {
  buildWeeklyShoppingList,
  computeWeeklyNutritionAnalysis,
  formatScaledIngredient,
  MEAL_CATEGORIES,
  scaleNutrition,
  sumDailyNutrition,
} from '@/lib/mbg-menus';
import { formatIndonesianDate } from '@/lib/caption';
import { formatRupiah } from '@/lib/receipt';
import { MenuResult } from '@/types/menu';
import { ReceiptResult } from '@/types/receipt';
import {
  DailyMenuPlan,
  DayKey,
  MbgTargetGroupOption,
  MealCategoryKey,
  WeeklyMenuPlan,
} from '@/types/recommendation';

export interface MbgExportPayload {
  plan: WeeklyMenuPlan;
  filteredDays: DailyMenuPlan[];
  weekDates: Record<DayKey, string>;
  portions: number;
  targetGroup: MbgTargetGroupOption;
  categoryFilter: MealCategoryKey | 'all';
  searchQuery: string;
}

export interface MenuAnalysisExportPayload {
  result: MenuResult;
  caption: string;
  captionStyleLabel: string;
  sourceFileName?: string | null;
}

export interface ReceiptAnalysisExportPayload {
  result: ReceiptResult;
  caption: string;
}

const FOREST_RGB: [number, number, number] = [27, 67, 50];
const FOREST_LIGHT_RGB: [number, number, number] = [237, 245, 240];
const SUBTLE_RGB: [number, number, number] = [243, 239, 232];
const INK_RGB: [number, number, number] = [28, 25, 23];
const MUTED_RGB: [number, number, number] = [87, 83, 78];

/**
 * Strip emoji & unsupported surrogate chars for built-in PDF Helvetica font
 * while preserving Indonesian punctuation, dashes, currency, and Latin letters.
 */
export function sanitizePdfText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const cleaned = String(value)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0E}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cleaned || '-';
}

export function formatReportTimestamp(date = new Date()): string {
  const datePart = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart}, ${timePart}`;
}

export function formatFilenameTimestamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}`;
}

function slugifyFileSegment(input: string, fallback: string): string {
  const clean = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return clean || fallback;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadPdfModules() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default || (autoTableMod as unknown as typeof autoTableMod.default);
  return { jsPDF, autoTable };
}

async function loadExcelModule() {
  const mod = await import('exceljs');
  return mod.default || mod;
}

function decoratePdfPages(
  doc: InstanceType<Awaited<ReturnType<typeof loadPdfModules>>['jsPDF']>,
  reportTitle: string,
  timestampLabel: string
) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Subtle header on continuation pages (page 2+)
    if (p > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...FOREST_RGB);
      doc.text(`MenuGenZ ${APP_VERSION_TAG} - ${sanitizePdfText(reportTitle)}`, 14, 10);
      doc.setDrawColor(230, 225, 216);
      doc.setLineWidth(0.3);
      doc.line(14, 12.5, pageWidth - 14, 12.5);
    }

    // Footer on every page
    doc.setDrawColor(230, 225, 216);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_RGB);
    doc.text(
      `MenuGenZ ${APP_VERSION_TAG} | Dibuat: ${timestampLabel}`,
      14,
      pageHeight - 8
    );
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: 'right' }
    );
  }
}

function styleExcelHeaderRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet: any,
  rowNumber = 1
) {
  const row = sheet.getRow(rowNumber);
  row.height = 24;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF143326' } },
      bottom: { style: 'thin', color: { argb: 'FF143326' } },
      left: { style: 'thin', color: { argb: 'FF2D6A4F' } },
      right: { style: 'thin', color: { argb: 'FF2D6A4F' } },
    };
  });
}

function autoFitExcelColumns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet: any,
  minWidth = 12,
  maxWidth = 44
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet.columns?.forEach((column: any) => {
    let maxLen = minWidth;
    if (column.header) {
      maxLen = Math.max(maxLen, String(column.header).length + 3);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    column.eachCell?.({ includeEmpty: false }, (cell: any) => {
      const val = cell.value;
      const text =
        val === null || val === undefined
          ? ''
          : typeof val === 'object' && 'richText' in val
          ? ''
          : String(val);
      const longestLine = text
        .split('\n')
        .reduce((acc, line) => Math.max(acc, line.length), 0);
      maxLen = Math.max(maxLen, longestLine + 3);
    });
    column.width = Math.min(maxWidth, Math.max(minWidth, maxLen));
  });
}

// ============================================================================
// 1. MBG RECOMMENDATION REPORT (PDF & EXCEL)
// ============================================================================

export async function buildMbgPdfBuffer(
  payload: MbgExportPayload
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { plan, filteredDays, weekDates, portions, targetGroup, categoryFilter, searchQuery } =
    payload;

  if (!filteredDays || filteredDays.length === 0) {
    throw new Error('Tidak ada data rekomendasi menu untuk diekspor sesuai filter saat ini.');
  }

  const { jsPDF, autoTable } = await loadPdfModules();
  const now = new Date();
  const timestamp = formatReportTimestamp(now);
  const analysis = computeWeeklyNutritionAnalysis(filteredDays, portions, targetGroup);
  const filteredPlan: WeeklyMenuPlan = { ...plan, days: filteredDays };
  const shoppingItems = buildWeeklyShoppingList(
    filteredPlan,
    portions,
    targetGroup.portionMultiplier
  );

  const visibleCats =
    categoryFilter === 'all'
      ? MEAL_CATEGORIES
      : MEAL_CATEGORIES.filter((c) => c.key === categoryFilter);
  const q = searchQuery.trim().toLowerCase();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Report Identity Banner
  doc.setFillColor(...FOREST_RGB);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN REKOMENDASI & ANALISIS MENU MBG', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `MenuGenZ ${APP_VERSION_TAG} | ${sanitizePdfText(plan.title)} | Dibuat: ${timestamp}`,
    14,
    20
  );

  // Report Metadata Box
  let y = 35;
  const activeFilterDesc = [
    categoryFilter !== 'all' ? `Kategori: ${categoryFilter}` : 'Kategori: Semua (5 komponen)',
    searchQuery.trim() ? `Pencarian: "${searchQuery.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 8.8, cellPadding: 2.2, textColor: INK_RGB, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, textColor: MUTED_RGB },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 38, textColor: MUTED_RGB },
      3: { cellWidth: 51 },
    },
    body: [
      [
        'Siklus Menu',
        sanitizePdfText(plan.title),
        'Kelompok Sasaran',
        sanitizePdfText(targetGroup.label),
      ],
      [
        'Jumlah Porsi/Hari',
        `${portions.toLocaleString('id-ID')} porsi`,
        'Total Porsi Terjadwal',
        `${analysis.totalPortionsPerWeek.toLocaleString('id-ID')} porsi (${analysis.daysCount} hari)`,
      ],
      [
        'Target Energi AKG',
        sanitizePdfText(targetGroup.energyTargetKcal),
        'Filter Aktif',
        sanitizePdfText(activeFilterDesc),
      ],
    ],
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY || 56) + 5;

  // Analysis & Conclusion Box
  doc.setFillColor(...FOREST_LIGHT_RGB);
  doc.setDrawColor(213, 232, 220);
  const conclusionLines = doc.splitTextToSize(
    sanitizePdfText(analysis.conclusion),
    pageWidth - 36
  );
  const boxHeight = 16 + conclusionLines.length * 4.4;
  doc.roundedRect(14, y, pageWidth - 28, boxHeight, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...FOREST_RGB);
  doc.text(
    `ANALISIS GIZI & KESIMPULAN (${sanitizePdfText(analysis.alignmentLabel.toUpperCase())})`,
    18,
    y + 6.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(...INK_RGB);
  doc.text(
    `Rata-rata/porsi: ${analysis.avgCalories} kkal | Protein ${analysis.avgProteinGrams} g | Karbo ${analysis.avgCarbsGrams} g | Lemak ${analysis.avgFatGrams} g`,
    18,
    y + 12
  );
  doc.text(conclusionLines, 18, y + 17);

  y = y + boxHeight + 7;

  // Section 1: Jadwal Rekomendasi Menu Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...FOREST_RGB);
  doc.text('1. Jadwal Rekomendasi Menu Harian', 14, y);
  y += 3;

  const scheduleRows: string[][] = [];
  for (const day of filteredDays) {
    const dayNut = sumDailyNutrition(day, targetGroup.portionMultiplier);
    const dateStr = weekDates[day.dayKey] || '-';
    for (const cat of visibleCats) {
      const dish = day.meals[cat.key];
      if (!dish) continue;
      if (
        q &&
        !day.dayLabel.toLowerCase().includes(q) &&
        !dish.name.toLowerCase().includes(q) &&
        !dish.shortSummary.toLowerCase().includes(q) &&
        !dish.ingredients.some((i) => i.name.toLowerCase().includes(q))
      ) {
        continue;
      }
      const nut = scaleNutrition(dish.nutritionPerPortion, targetGroup.portionMultiplier);
      scheduleRows.push([
        `${day.dayLabel}\n(${dateStr})`,
        cat.label,
        sanitizePdfText(dish.name),
        `${nut.calories} kkal\n(P ${nut.proteinGrams}g | K ${nut.carbsGrams}g)`,
        `${dish.prepMinutes + dish.cookMinutes} mnt`,
        `${dayNut.calories} kkal/hr`,
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: [['Hari / Tgl', 'Kategori', 'Nama Hidangan', 'Gizi / Porsi', 'Waktu', 'Total Hari']],
    body: scheduleRows,
    theme: 'grid',
    headStyles: {
      fillColor: FOREST_RGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.2,
      cellPadding: 2.4,
      textColor: INK_RGB,
      overflow: 'linebreak',
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 23 },
      2: { cellWidth: 58 },
      3: { cellWidth: 36 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 23, halign: 'right' },
    },
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
  });

  // Section 2: Rekap Daftar Belanja Bahan (Scaled to Portions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextY = ((doc as any).lastAutoTable?.finalY || y) + 9;
  if (nextY > 240) {
    doc.addPage();
    nextY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...FOREST_RGB);
  doc.text(
    `2. Rekap Kebutuhan Bahan Belanja (${portions.toLocaleString('id-ID')} Porsi/Hari)`,
    14,
    nextY
  );

  const groupLabels = {
    utama: 'Bahan Utama',
    bumbu: 'Bumbu & Rempah',
    pelengkap: 'Pelengkap',
  };

  autoTable(doc, {
    startY: nextY + 3,
    head: [['No', 'Kelompok', 'Nama Bahan', 'Total Kebutuhan', 'Digunakan pada Hari']],
    body: shoppingItems.map((item, idx) => [
      String(idx + 1),
      groupLabels[item.group],
      sanitizePdfText(item.name),
      sanitizePdfText(item.formattedTotal),
      item.usedInDays.join(', '),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: FOREST_RGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.2,
      cellPadding: 2.3,
      textColor: INK_RGB,
      overflow: 'linebreak',
    },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 66 },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 48 },
    },
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
  });

  // Section 3: Ringkasan Resep & Cara Olah
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recipeY = ((doc as any).lastAutoTable?.finalY || nextY) + 9;
  if (recipeY > 240) {
    doc.addPage();
    recipeY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...FOREST_RGB);
  doc.text('3. Panduan Singkat Resep & Pengolahan Dapur', 14, recipeY);

  const recipeRows: string[][] = [];
  for (const day of filteredDays) {
    for (const cat of visibleCats) {
      const dish = day.meals[cat.key];
      if (!dish) continue;
      if (
        q &&
        !day.dayLabel.toLowerCase().includes(q) &&
        !dish.name.toLowerCase().includes(q) &&
        !dish.shortSummary.toLowerCase().includes(q) &&
        !dish.ingredients.some((i) => i.name.toLowerCase().includes(q))
      ) {
        continue;
      }
      const ingSummary = dish.ingredients
        .map((ing) => {
          const scaled = formatScaledIngredient(
            ing.amountPerPortion,
            ing.unit,
            portions,
            targetGroup.portionMultiplier
          );
          return `${sanitizePdfText(ing.name)} (${scaled.display})`;
        })
        .join(', ');
      const stepsSummary = dish.steps
        .map((st, i) => `${i + 1}. ${sanitizePdfText(st)}`)
        .join(' ');
      recipeRows.push([
        `${day.dayLabel}\n${cat.shortLabel}`,
        sanitizePdfText(dish.name),
        ingSummary,
        stepsSummary,
      ]);
    }
  }

  autoTable(doc, {
    startY: recipeY + 3,
    head: [['Hari / Kat', 'Hidangan', `Bahan (${portions} Porsi)`, 'Langkah Memasak']],
    body: recipeRows,
    theme: 'grid',
    headStyles: {
      fillColor: FOREST_RGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.3,
    },
    styles: {
      fontSize: 7.8,
      cellPadding: 2.2,
      textColor: INK_RGB,
      overflow: 'linebreak',
    },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 58 },
      3: { cellWidth: 72 },
    },
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
  });

  decoratePdfPages(doc, `Rekomendasi Menu MBG (${plan.title})`, timestamp);

  const safeTitle = slugifyFileSegment(plan.title, 'Menu_MBG');
  const filename = `MenuGenZ_Laporan_MBG_${safeTitle}_${portions}Porsi_${formatFilenameTimestamp(now)}.pdf`;
  return {
    buffer: doc.output('arraybuffer'),
    filename,
  };
}

export async function exportMbgPlanToPdf(payload: MbgExportPayload): Promise<string> {
  const { buffer, filename } = await buildMbgPdfBuffer(payload);
  triggerBlobDownload(new Blob([buffer], { type: 'application/pdf' }), filename);
  return filename;
}

export async function buildMbgExcelBuffer(
  payload: MbgExportPayload
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { plan, filteredDays, weekDates, portions, targetGroup, categoryFilter, searchQuery } =
    payload;

  if (!filteredDays || filteredDays.length === 0) {
    throw new Error('Tidak ada data rekomendasi menu untuk diekspor sesuai filter saat ini.');
  }

  const ExcelJS = await loadExcelModule();
  const workbook = new ExcelJS.Workbook();
  const now = new Date();
  const timestamp = formatReportTimestamp(now);

  workbook.creator = `MenuGenZ ${APP_VERSION_TAG}`;
  workbook.created = now;

  const analysis = computeWeeklyNutritionAnalysis(filteredDays, portions, targetGroup);
  const filteredPlan: WeeklyMenuPlan = { ...plan, days: filteredDays };
  const shoppingItems = buildWeeklyShoppingList(
    filteredPlan,
    portions,
    targetGroup.portionMultiplier
  );
  const visibleCats =
    categoryFilter === 'all'
      ? MEAL_CATEGORIES
      : MEAL_CATEGORIES.filter((c) => c.key === categoryFilter);
  const q = searchQuery.trim().toLowerCase();

  // Sheet 1: Ringkasan & Analisis
  const summarySheet = workbook.addWorksheet('Ringkasan & Analisis');
  summarySheet.columns = [
    { header: 'Parameter Laporan', key: 'param', width: 30 },
    { header: 'Nilai / Hasil Analisis', key: 'value', width: 58 },
  ];
  styleExcelHeaderRow(summarySheet, 1);

  const summaryRows: Array<{ param: string; value: string | number }> = [
    { param: 'Judul Laporan', value: `Laporan Rekomendasi & Analisis Menu MBG - ${plan.title}` },
    { param: 'Aplikasi / Versi', value: `MenuGenZ ${APP_VERSION_TAG}` },
    { param: 'Tanggal & Waktu Dibuat', value: timestamp },
    { param: 'Sumber Siklus', value: plan.source === 'ai' ? 'Rekomendasi AI' : 'Siklus Terkurasi Indonesia' },
    { param: 'Kelompok Sasaran BGN', value: targetGroup.label },
    { param: 'Target Energi AKG', value: targetGroup.energyTargetKcal },
    { param: 'Jumlah Porsi per Hari', value: portions },
    { param: 'Jumlah Hari Terjadwal', value: analysis.daysCount },
    { param: 'Total Porsi Mingguan', value: analysis.totalPortionsPerWeek },
    { param: 'Filter Kategori', value: categoryFilter === 'all' ? 'Semua Kategori' : categoryFilter },
    { param: 'Kata Kunci Pencarian', value: searchQuery.trim() || '-' },
    { param: 'Rata-rata Energi per Porsi (kkal)', value: analysis.avgCalories },
    { param: 'Rata-rata Protein per Porsi (g)', value: analysis.avgProteinGrams },
    { param: 'Rata-rata Karbohidrat per Porsi (g)', value: analysis.avgCarbsGrams },
    { param: 'Rata-rata Lemak per Porsi (g)', value: analysis.avgFatGrams },
    { param: 'Status Kesesuaian AKG', value: analysis.alignmentLabel },
    { param: 'Variasi Protein Utama', value: analysis.uniqueProteinSources.join(', ') || '-' },
    { param: 'Kesimpulan Analisis', value: analysis.conclusion },
  ];

  summaryRows.forEach((r) => {
    const row = summarySheet.addRow(r);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
    if (typeof r.value === 'number') {
      row.getCell(2).numFmt = Number.isInteger(r.value) ? '#,##0' : '#,##0.0';
    }
  });
  summarySheet.views = [{ state: 'frozen', ySplit: 1 }];
  autoFitExcelColumns(summarySheet, 22, 60);

  // Sheet 2: Jadwal Menu (filterable & sortable)
  const scheduleSheet = workbook.addWorksheet('Jadwal Menu');
  scheduleSheet.columns = [
    { header: 'Hari', key: 'day', width: 12 },
    { header: 'Tanggal', key: 'date', width: 14 },
    { header: 'Kategori', key: 'category', width: 15 },
    { header: 'Nama Hidangan', key: 'dish', width: 28 },
    { header: 'Energi (kkal)', key: 'calories', width: 15 },
    { header: 'Protein (g)', key: 'protein', width: 13 },
    { header: 'Karbohidrat (g)', key: 'carbs', width: 15 },
    { header: 'Lemak (g)', key: 'fat', width: 13 },
    { header: 'Waktu Olah (mnt)', key: 'time', width: 16 },
    { header: 'Ringkasan Sajian', key: 'summary', width: 42 },
  ];
  styleExcelHeaderRow(scheduleSheet, 1);

  for (const day of filteredDays) {
    for (const cat of visibleCats) {
      const dish = day.meals[cat.key];
      if (!dish) continue;
      if (
        q &&
        !day.dayLabel.toLowerCase().includes(q) &&
        !dish.name.toLowerCase().includes(q) &&
        !dish.shortSummary.toLowerCase().includes(q) &&
        !dish.ingredients.some((i) => i.name.toLowerCase().includes(q))
      ) {
        continue;
      }
      const nut = scaleNutrition(dish.nutritionPerPortion, targetGroup.portionMultiplier);
      const row = scheduleSheet.addRow({
        day: day.dayLabel,
        date: weekDates[day.dayKey] || '-',
        category: cat.label,
        dish: dish.name,
        calories: nut.calories,
        protein: nut.proteinGrams,
        carbs: nut.carbsGrams,
        fat: nut.fatGrams,
        time: dish.prepMinutes + dish.cookMinutes,
        summary: dish.shortSummary,
      });
      row.getCell('calories').numFmt = '#,##0';
      row.getCell('protein').numFmt = '#,##0.0';
      row.getCell('carbs').numFmt = '#,##0.0';
      row.getCell('fat').numFmt = '#,##0.0';
      row.getCell('time').numFmt = '#,##0';
      row.getCell('summary').alignment = { wrapText: true };
    }
  }
  scheduleSheet.views = [{ state: 'frozen', ySplit: 1 }];
  scheduleSheet.autoFilter = 'A1:J1';
  autoFitExcelColumns(scheduleSheet, 12, 44);

  // Sheet 3: Daftar Belanja (Scaled numeric quantities + unit)
  const shopSheet = workbook.addWorksheet('Daftar Belanja');
  shopSheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Kelompok Bahan', key: 'group', width: 18 },
    { header: 'Nama Bahan', key: 'name', width: 32 },
    { header: 'Jumlah Total', key: 'totalAmount', width: 15 },
    { header: 'Satuan', key: 'unit', width: 12 },
    { header: 'Takaran Tampilan', key: 'formatted', width: 18 },
    { header: 'Dipakai pada Hari', key: 'days', width: 28 },
  ];
  styleExcelHeaderRow(shopSheet, 1);

  const groupLabels = {
    utama: 'Bahan Pangan Utama',
    bumbu: 'Bumbu & Rempah',
    pelengkap: 'Pelengkap & Minyak',
  };

  shoppingItems.forEach((item, idx) => {
    const row = shopSheet.addRow({
      no: idx + 1,
      group: groupLabels[item.group],
      name: item.name,
      totalAmount: item.totalAmount,
      unit: item.unit,
      formatted: item.formattedTotal,
      days: item.usedInDays.join(', '),
    });
    row.getCell('no').numFmt = '#,##0';
    row.getCell('totalAmount').numFmt = Number.isInteger(item.totalAmount) ? '#,##0' : '#,##0.00';
  });
  shopSheet.views = [{ state: 'frozen', ySplit: 1 }];
  shopSheet.autoFilter = 'A1:G1';
  autoFitExcelColumns(shopSheet, 10, 40);

  // Sheet 4: Detail Resep
  const recipeSheet = workbook.addWorksheet('Detail Resep');
  recipeSheet.columns = [
    { header: 'Hari', key: 'day', width: 12 },
    { header: 'Kategori', key: 'category', width: 14 },
    { header: 'Nama Hidangan', key: 'dish', width: 24 },
    { header: 'Bahan', key: 'ingredient', width: 28 },
    { header: 'Takaran 1 Porsi', key: 'perOne', width: 16 },
    { header: `Total (${portions} Porsi)`, key: 'perTotal', width: 18 },
    { header: 'Catatan Dapur / Langkah', key: 'steps', width: 46 },
  ];
  styleExcelHeaderRow(recipeSheet, 1);

  for (const day of filteredDays) {
    for (const cat of visibleCats) {
      const dish = day.meals[cat.key];
      if (!dish) continue;
      if (
        q &&
        !day.dayLabel.toLowerCase().includes(q) &&
        !dish.name.toLowerCase().includes(q) &&
        !dish.shortSummary.toLowerCase().includes(q) &&
        !dish.ingredients.some((i) => i.name.toLowerCase().includes(q))
      ) {
        continue;
      }
      const stepsText = dish.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      dish.ingredients.forEach((ing, idx) => {
        const single = formatScaledIngredient(
          ing.amountPerPortion,
          ing.unit,
          1,
          targetGroup.portionMultiplier
        );
        const total = formatScaledIngredient(
          ing.amountPerPortion,
          ing.unit,
          portions,
          targetGroup.portionMultiplier
        );
        const row = recipeSheet.addRow({
          day: day.dayLabel,
          category: cat.label,
          dish: dish.name,
          ingredient: ing.name,
          perOne: single.display,
          perTotal: total.display,
          steps: idx === 0 ? stepsText : '',
        });
        row.getCell('steps').alignment = { wrapText: true, vertical: 'top' };
      });
    }
  }
  recipeSheet.views = [{ state: 'frozen', ySplit: 1 }];
  recipeSheet.autoFilter = 'A1:G1';
  autoFitExcelColumns(recipeSheet, 12, 48);

  const rawBuf = await workbook.xlsx.writeBuffer();
  const arrayBuffer =
    rawBuf instanceof ArrayBuffer
      ? rawBuf
      : (rawBuf as Uint8Array).buffer.slice(
          (rawBuf as Uint8Array).byteOffset,
          (rawBuf as Uint8Array).byteOffset + (rawBuf as Uint8Array).byteLength
        );

  const safeTitle = slugifyFileSegment(plan.title, 'Menu_MBG');
  const filename = `MenuGenZ_Data_MBG_${safeTitle}_${portions}Porsi_${formatFilenameTimestamp(now)}.xlsx`;
  return { buffer: arrayBuffer as ArrayBuffer, filename };
}

export async function exportMbgPlanToExcel(payload: MbgExportPayload): Promise<string> {
  const { buffer, filename } = await buildMbgExcelBuffer(payload);
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
  return filename;
}

// ============================================================================
// 2. MENU ANALYSIS REPORT (PDF & EXCEL)
// ============================================================================

export async function buildMenuAnalysisPdfBuffer(
  payload: MenuAnalysisExportPayload
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { result, caption, captionStyleLabel, sourceFileName } = payload;

  if (!result || !result.menus || result.menus.length === 0) {
    throw new Error('Tidak ada hasil analisis menu untuk diekspor.');
  }

  const { jsPDF, autoTable } = await loadPdfModules();
  const now = new Date();
  const timestamp = formatReportTimestamp(now);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...FOREST_RGB);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN ANALISIS MENU & CAPTION MBG', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`MenuGenZ ${APP_VERSION_TAG} | Dibuat: ${timestamp}`, 14, 20);

  autoTable(doc, {
    startY: 34,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.3, textColor: INK_RGB, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42, textColor: MUTED_RGB },
      1: { cellWidth: 140 },
    },
    body: [
      ['Tanggal Menu', sanitizePdfText(formatIndonesianDate(result.date) || 'Tidak tertera')],
      [
        'Target Penerima',
        sanitizePdfText(result.recipients.length > 0 ? result.recipients.join(', ') : 'Umum'),
      ],
      [
        'Sumber Media',
        sanitizePdfText(
          `${result.mediaType === 'video' ? 'Video Menu' : 'Foto / Jadwal Menu'}${
            sourceFileName ? ` (${sourceFileName})` : ''
          }`
        ),
      ],
      ['Jumlah Item Terdeteksi', `${result.menus.length} hidangan`],
      ['Gaya Copywriting', sanitizePdfText(captionStyleLabel)],
    ],
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = ((doc as any).lastAutoTable?.finalY || 72) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...FOREST_RGB);
  doc.text('1. Daftar Hidangan Terdeteksi', 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['No', 'Nama Hidangan / Komponen Menu']],
    body: result.menus.map((m, i) => [String(i + 1), sanitizePdfText(m)]),
    theme: 'grid',
    headStyles: { fillColor: FOREST_RGB, textColor: [255, 255, 255], fontSize: 8.8 },
    styles: { fontSize: 8.8, cellPadding: 2.6, textColor: INK_RGB, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 168 } },
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY || y + 30) + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...FOREST_RGB);
  doc.text('2. Kesimpulan Analisis & Draft Caption Siap Bagikan', 14, y);

  autoTable(doc, {
    startY: y + 3,
    head: [['Bagian', 'Isi Teks']],
    body: [
      ['Catatan Analisis Gizi', sanitizePdfText(result.closingNote || result.mbgNote || '-')],
      ['Draft Caption Final', sanitizePdfText(caption || '-')],
    ],
    theme: 'grid',
    headStyles: { fillColor: SUBTLE_RGB, textColor: INK_RGB, fontSize: 8.8 },
    styles: { fontSize: 8.6, cellPadding: 3, textColor: INK_RGB, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 140 } },
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
  });

  decoratePdfPages(doc, 'Analisis Menu MBG', timestamp);

  const filename = `MenuGenZ_Analisis_Menu_${formatFilenameTimestamp(now)}.pdf`;
  return { buffer: doc.output('arraybuffer'), filename };
}

export async function exportMenuAnalysisToPdf(
  payload: MenuAnalysisExportPayload
): Promise<string> {
  const { buffer, filename } = await buildMenuAnalysisPdfBuffer(payload);
  triggerBlobDownload(new Blob([buffer], { type: 'application/pdf' }), filename);
  return filename;
}

export async function buildMenuAnalysisExcelBuffer(
  payload: MenuAnalysisExportPayload
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { result, caption, captionStyleLabel, sourceFileName } = payload;

  if (!result || !result.menus || result.menus.length === 0) {
    throw new Error('Tidak ada hasil analisis menu untuk diekspor.');
  }

  const ExcelJS = await loadExcelModule();
  const workbook = new ExcelJS.Workbook();
  const now = new Date();
  const timestamp = formatReportTimestamp(now);
  workbook.creator = `MenuGenZ ${APP_VERSION_TAG}`;
  workbook.created = now;

  const summarySheet = workbook.addWorksheet('Ringkasan Analisis');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 26 },
    { header: 'Nilai', key: 'val', width: 62 },
  ];
  styleExcelHeaderRow(summarySheet, 1);

  [
    { field: 'Aplikasi / Versi', val: `MenuGenZ ${APP_VERSION_TAG}` },
    { field: 'Waktu Export', val: timestamp },
    { field: 'Tanggal Menu', val: formatIndonesianDate(result.date) || '-' },
    { field: 'Target Penerima', val: result.recipients.join(', ') || '-' },
    { field: 'Jenis Media', val: result.mediaType === 'video' ? 'Video' : 'Foto / Jadwal' },
    { field: 'Nama File Sumber', val: sourceFileName || '-' },
    { field: 'Total Item Terdeteksi', val: result.menus.length },
    { field: 'Gaya Copywriting', val: captionStyleLabel },
    { field: 'Catatan Analisis', val: result.closingNote || result.mbgNote || '-' },
    { field: 'Draft Caption Final', val: caption || '-' },
  ].forEach((r) => {
    const row = summarySheet.addRow(r);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });
  summarySheet.views = [{ state: 'frozen', ySplit: 1 }];
  autoFitExcelColumns(summarySheet, 20, 64);

  const menuSheet = workbook.addWorksheet('Daftar Menu Terdeteksi');
  menuSheet.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Nama Hidangan', key: 'name', width: 42 },
  ];
  styleExcelHeaderRow(menuSheet, 1);
  result.menus.forEach((m, idx) => {
    const row = menuSheet.addRow({ no: idx + 1, name: m });
    row.getCell('no').numFmt = '#,##0';
  });
  menuSheet.views = [{ state: 'frozen', ySplit: 1 }];
  menuSheet.autoFilter = 'A1:B1';
  autoFitExcelColumns(menuSheet, 10, 48);

  const rawBuf = await workbook.xlsx.writeBuffer();
  const arrayBuffer =
    rawBuf instanceof ArrayBuffer
      ? rawBuf
      : (rawBuf as Uint8Array).buffer.slice(
          (rawBuf as Uint8Array).byteOffset,
          (rawBuf as Uint8Array).byteOffset + (rawBuf as Uint8Array).byteLength
        );

  const filename = `MenuGenZ_Analisis_Menu_${formatFilenameTimestamp(now)}.xlsx`;
  return { buffer: arrayBuffer as ArrayBuffer, filename };
}

export async function exportMenuAnalysisToExcel(
  payload: MenuAnalysisExportPayload
): Promise<string> {
  const { buffer, filename } = await buildMenuAnalysisExcelBuffer(payload);
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
  return filename;
}

// ============================================================================
// 3. RECEIPT / STRUK ANALYSIS REPORT (PDF & EXCEL)
// ============================================================================

export async function buildReceiptPdfBuffer(
  payload: ReceiptAnalysisExportPayload
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { result } = payload;

  if (!result || (result.items.length === 0 && !result.totalAmount)) {
    throw new Error('Tidak ada data rincian struk untuk diekspor.');
  }

  const { jsPDF, autoTable } = await loadPdfModules();
  const now = new Date();
  const timestamp = formatReportTimestamp(now);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...FOREST_RGB);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN ANALISIS STRUK & RINCIAN BELANJA', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `MenuGenZ ${APP_VERSION_TAG} | ${sanitizePdfText(result.merchantName || 'Belanja Operasional')} | Dibuat: ${timestamp}`,
    14,
    20
  );

  autoTable(doc, {
    startY: 34,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.2, textColor: INK_RGB, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40, textColor: MUTED_RGB },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', cellWidth: 40, textColor: MUTED_RGB },
      3: { cellWidth: 47 },
    },
    body: [
      [
        'Toko / Merchant',
        sanitizePdfText(result.merchantName || '-'),
        'Tanggal Transaksi',
        sanitizePdfText(formatIndonesianDate(result.date) || '-'),
      ],
      [
        'Metode Pembayaran',
        sanitizePdfText(result.paymentMethod || '-'),
        'Jumlah Item',
        `${result.items.length} item`,
      ],
    ],
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = ((doc as any).lastAutoTable?.finalY || 56) + 5;

  if (result.receiptNote) {
    doc.setFillColor(...FOREST_LIGHT_RGB);
    doc.setDrawColor(213, 232, 220);
    const noteLines = doc.splitTextToSize(sanitizePdfText(result.receiptNote), pageWidth - 36);
    const boxH = 11 + noteLines.length * 4.3;
    doc.roundedRect(14, y, pageWidth - 28, boxH, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...FOREST_RGB);
    doc.text('RINGKASAN ANALISIS BELANJA', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_RGB);
    doc.text(noteLines, 18, y + 11);
    y += boxH + 6;
  }

  autoTable(doc, {
    startY: y,
    head: [['No', 'Nama Barang / Item', 'Qty', 'Harga Satuan', 'Total Harga']],
    body: result.items.map((item, idx) => [
      String(idx + 1),
      sanitizePdfText(item.name),
      item.qty !== null && item.qty !== undefined
        ? sanitizePdfText(`${item.qty} ${item.unit || ''}`.trim())
        : '-',
      formatRupiah(item.pricePerUnit),
      formatRupiah(item.totalPrice),
    ]),
    theme: 'grid',
    headStyles: { fillColor: FOREST_RGB, textColor: [255, 255, 255], fontSize: 8.6 },
    styles: { fontSize: 8.4, cellPadding: 2.5, textColor: INK_RGB, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 79 },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 34, halign: 'right' },
      4: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
    },
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalsY = ((doc as any).lastAutoTable?.finalY || y + 30) + 5;
  const summaryBody: string[][] = [];
  if (result.subtotal !== null && result.subtotal !== undefined && result.subtotal > 0) {
    summaryBody.push(['Subtotal', formatRupiah(result.subtotal)]);
  }
  if (result.discount !== null && result.discount !== undefined && result.discount > 0) {
    summaryBody.push(['Diskon / Potongan', `-${formatRupiah(result.discount)}`]);
  }
  if (result.tax !== null && result.tax !== undefined && result.tax > 0) {
    summaryBody.push(['Pajak / PPN', formatRupiah(result.tax)]);
  }
  summaryBody.push(['TOTAL PEMBELIAN', formatRupiah(result.totalAmount)]);

  autoTable(doc, {
    startY: totalsY,
    body: summaryBody,
    theme: 'plain',
    styles: { fontSize: 9.2, cellPadding: 2.2, textColor: INK_RGB },
    columnStyles: {
      0: { cellWidth: 120, halign: 'right', fontStyle: 'bold' },
      1: { cellWidth: 62, halign: 'right', fontStyle: 'bold', textColor: FOREST_RGB },
    },
    margin: { left: 14, right: 14 },
  });

  decoratePdfPages(doc, 'Laporan Struk Belanja', timestamp);

  const merchantSlug = slugifyFileSegment(result.merchantName || 'Struk', 'Struk');
  const filename = `MenuGenZ_Struk_${merchantSlug}_${formatFilenameTimestamp(now)}.pdf`;
  return { buffer: doc.output('arraybuffer'), filename };
}

export async function exportReceiptAnalysisToPdf(
  payload: ReceiptAnalysisExportPayload
): Promise<string> {
  const { buffer, filename } = await buildReceiptPdfBuffer(payload);
  triggerBlobDownload(new Blob([buffer], { type: 'application/pdf' }), filename);
  return filename;
}

export async function buildReceiptExcelBuffer(
  payload: ReceiptAnalysisExportPayload
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { result, caption } = payload;

  if (!result || (result.items.length === 0 && !result.totalAmount)) {
    throw new Error('Tidak ada data rincian struk untuk diekspor.');
  }

  const ExcelJS = await loadExcelModule();
  const workbook = new ExcelJS.Workbook();
  const now = new Date();
  const timestamp = formatReportTimestamp(now);
  workbook.creator = `MenuGenZ ${APP_VERSION_TAG}`;
  workbook.created = now;

  // Sheet 1: Ringkasan Belanja
  const summarySheet = workbook.addWorksheet('Ringkasan Belanja');
  summarySheet.columns = [
    { header: 'Keterangan', key: 'label', width: 26 },
    { header: 'Nilai', key: 'val', width: 46 },
  ];
  styleExcelHeaderRow(summarySheet, 1);

  const idrFmt = '"Rp" #,##0';
  const rows: Array<{ label: string; val: string | number; isCurrency?: boolean }> = [
    { label: 'Toko / Merchant', val: result.merchantName || '-' },
    { label: 'Tanggal Transaksi', val: formatIndonesianDate(result.date) || '-' },
    { label: 'Metode Pembayaran', val: result.paymentMethod || '-' },
    { label: 'Waktu Export', val: timestamp },
    { label: 'Jumlah Item', val: result.items.length },
    { label: 'Subtotal', val: result.subtotal ?? 0, isCurrency: true },
    { label: 'Diskon / Potongan', val: result.discount ?? 0, isCurrency: true },
    { label: 'Pajak / PPN', val: result.tax ?? 0, isCurrency: true },
    { label: 'Total Akhir', val: result.totalAmount ?? 0, isCurrency: true },
    { label: 'Catatan Analisis', val: result.receiptNote || '-' },
    { label: 'Laporan Teks WhatsApp', val: caption || '-' },
  ];

  rows.forEach((r) => {
    const row = summarySheet.addRow({ label: r.label, val: r.val });
    row.getCell(1).font = { bold: true };
    if (r.isCurrency) {
      row.getCell(2).numFmt = idrFmt;
      if (r.label === 'Total Akhir') {
        row.getCell(2).font = { bold: true, color: { argb: 'FF1B4332' } };
      }
    } else if (typeof r.val === 'number') {
      row.getCell(2).numFmt = '#,##0';
    } else {
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    }
  });
  summarySheet.views = [{ state: 'frozen', ySplit: 1 }];
  autoFitExcelColumns(summarySheet, 18, 56);

  // Sheet 2: Rincian Item Belanja
  const itemsSheet = workbook.addWorksheet('Rincian Item Belanja');
  itemsSheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Nama Barang / Item', key: 'name', width: 36 },
    { header: 'Qty', key: 'qty', width: 10 },
    { header: 'Satuan', key: 'unit', width: 12 },
    { header: 'Harga Satuan (Rp)', key: 'unitPrice', width: 20 },
    { header: 'Total Harga (Rp)', key: 'totalPrice', width: 20 },
  ];
  styleExcelHeaderRow(itemsSheet, 1);

  result.items.forEach((item, idx) => {
    const numericQty =
      typeof item.qty === 'number'
        ? item.qty
        : item.qty !== null && item.qty !== undefined && !Number.isNaN(Number(item.qty))
        ? Number(item.qty)
        : item.qty ?? '-';
    const row = itemsSheet.addRow({
      no: idx + 1,
      name: item.name,
      qty: numericQty,
      unit: item.unit || '-',
      unitPrice: item.pricePerUnit ?? null,
      totalPrice: item.totalPrice ?? null,
    });
    row.getCell('no').numFmt = '#,##0';
    if (typeof numericQty === 'number') {
      row.getCell('qty').numFmt = Number.isInteger(numericQty) ? '#,##0' : '#,##0.##';
    }
    if (typeof item.pricePerUnit === 'number') {
      row.getCell('unitPrice').numFmt = idrFmt;
    }
    if (typeof item.totalPrice === 'number') {
      row.getCell('totalPrice').numFmt = idrFmt;
    }
  });
  itemsSheet.views = [{ state: 'frozen', ySplit: 1 }];
  itemsSheet.autoFilter = 'A1:F1';
  autoFitExcelColumns(itemsSheet, 10, 44);

  const rawBuf = await workbook.xlsx.writeBuffer();
  const arrayBuffer =
    rawBuf instanceof ArrayBuffer
      ? rawBuf
      : (rawBuf as Uint8Array).buffer.slice(
          (rawBuf as Uint8Array).byteOffset,
          (rawBuf as Uint8Array).byteOffset + (rawBuf as Uint8Array).byteLength
        );

  const merchantSlug = slugifyFileSegment(result.merchantName || 'Struk', 'Struk');
  const filename = `MenuGenZ_Struk_${merchantSlug}_${formatFilenameTimestamp(now)}.xlsx`;
  return { buffer: arrayBuffer as ArrayBuffer, filename };
}

export async function exportReceiptAnalysisToExcel(
  payload: ReceiptAnalysisExportPayload
): Promise<string> {
  const { buffer, filename } = await buildReceiptExcelBuffer(payload);
  triggerBlobDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
  return filename;
}
