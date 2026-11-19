'use client';

import React, { useState } from 'react';
import { ReceiptItem, ReceiptResult } from '@/types/receipt';
import { formatRupiah } from '@/lib/receipt';
import { formatIndonesianDate } from '@/lib/caption';
import { copyTextToClipboard } from '@/lib/clipboard';
import {
  exportReceiptAnalysisToExcel,
  exportReceiptAnalysisToPdf,
} from '@/lib/export-reports';
import {
  Store,
  Calendar,
  CreditCard,
  ShoppingCart,
  Copy,
  Check,
  FileDown,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

interface ReceiptBreakdownProps {
  data: ReceiptResult;
  caption?: string;
}

export const ReceiptBreakdown: React.FC<ReceiptBreakdownProps> = ({
  data,
  caption = '',
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [exportingType, setExportingType] = useState<'pdf' | 'excel' | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleCopyItem = async (item: ReceiptItem, idx: number) => {
    const qtyStr =
      item.qty !== null && item.qty !== undefined
        ? `${item.qty} ${item.unit || ''}`.trim()
        : '';
    const priceStr = item.pricePerUnit ? formatRupiah(item.pricePerUnit) : '';
    const totalStr = formatRupiah(item.totalPrice);

    let text = item.name;
    if (qtyStr && priceStr) {
      text += ` (${qtyStr} @ ${priceStr}) = ${totalStr}`;
    } else if (qtyStr) {
      text += ` (${qtyStr}) = ${totalStr}`;
    } else if (totalStr && totalStr !== '-') {
      text += ` = ${totalStr}`;
    }

    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    const lines: string[] = [];
    if (data.merchantName) lines.push(`Toko: ${data.merchantName}`);
    if (data.date) lines.push(`Tanggal: ${formatIndonesianDate(data.date)}`);
    if (data.paymentMethod) lines.push(`Pembayaran: ${data.paymentMethod}`);
    if (lines.length > 0) lines.push('');

    lines.push('Daftar Rincian Belanja:');
    data.items.forEach((item, idx) => {
      const qtyStr =
        item.qty !== null && item.qty !== undefined
          ? `${item.qty} ${item.unit || ''}`.trim()
          : '';
      const priceStr = item.pricePerUnit ? formatRupiah(item.pricePerUnit) : '';
      const totalStr = formatRupiah(item.totalPrice);

      let itemLine = `${idx + 1}. ${item.name}`;
      if (qtyStr && priceStr) {
        itemLine += ` (${qtyStr} @ ${priceStr}) = ${totalStr}`;
      } else if (qtyStr) {
        itemLine += ` (${qtyStr}) = ${totalStr}`;
      } else if (totalStr && totalStr !== '-') {
        itemLine += ` = ${totalStr}`;
      }
      lines.push(itemLine);
    });

    lines.push('');
    if (
      data.subtotal !== null &&
      data.subtotal !== undefined &&
      data.subtotal > 0 &&
      (data.discount || data.tax)
    ) {
      lines.push(`Subtotal: ${formatRupiah(data.subtotal)}`);
    }
    if (data.discount !== null && data.discount !== undefined && data.discount > 0) {
      lines.push(`Diskon: -${formatRupiah(data.discount)}`);
    }
    if (data.tax !== null && data.tax !== undefined && data.tax > 0) {
      lines.push(`Pajak (PPN): ${formatRupiah(data.tax)}`);
    }
    if (data.totalAmount !== null && data.totalAmount !== undefined) {
      lines.push(`Total Pembelian: ${formatRupiah(data.totalAmount)}`);
    }

    const ok = await copyTextToClipboard(lines.join('\n'));
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (exportingType) return;
    setExportingType(type);
    setExportFeedback(null);

    try {
      const filename =
        type === 'pdf'
          ? await exportReceiptAnalysisToPdf({ result: data, caption })
          : await exportReceiptAnalysisToExcel({ result: data, caption });
      setExportFeedback({
        type: 'success',
        message: `${type === 'pdf' ? 'PDF' : 'Excel'} struk diunduh: ${filename}`,
      });
    } catch (err) {
      setExportFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : `Gagal mengekspor laporan struk ke ${type.toUpperCase()}.`,
      });
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-surface border border-border overflow-hidden">
      {/* Header Info */}
      <div className="p-4 bg-subtle/60 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-ink font-bold text-sm">
          <Store className="w-4 h-4 text-forest-700" aria-hidden="true" />
          <span id="receipt-table-heading">
            {data.merchantName || 'Toko / Merchant Tanpa Nama'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {data.date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-ink-faint" aria-hidden="true" />
              {formatIndonesianDate(data.date)}
            </span>
          )}
          {data.paymentMethod && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-forest-50 border border-forest-100 text-forest-800 font-semibold">
              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
              {data.paymentMethod}
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyAll}
            data-compact-target="true"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              copiedAll
                ? 'bg-forest-700 text-white border-forest-700'
                : 'bg-surface hover:bg-forest-50 text-forest-800 border-border'
            }`}
            title="Salin seluruh rincian belanja struk"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Salin</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={exportingType !== null}
            data-compact-target="true"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {exportingType === 'pdf' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={exportingType !== null}
            data-compact-target="true"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-forest-50 hover:bg-forest-100 border border-forest-200 text-forest-900 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {exportingType === 'excel' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-forest-700" aria-hidden="true" />
            )}
            <span>Excel</span>
          </button>
        </div>
      </div>

      {exportFeedback && (
        <div
          role={exportFeedback.type === 'error' ? 'alert' : 'status'}
          className={`px-4 py-2.5 border-b text-xs flex items-center justify-between gap-2 ${
            exportFeedback.type === 'success'
              ? 'bg-forest-50 border-forest-100 text-forest-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="inline-flex items-center gap-1.5 truncate">
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-forest-700 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{exportFeedback.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            aria-label="Tutup notifikasi"
            data-compact-target="true"
            className="p-0.5 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Responsive Semantic Table of Items OR Empty State */}
      {data.items.length === 0 ? (
        <div className="p-6 text-center text-xs text-ink-muted">
          Tidak ada rincian baris item terpisah yang terdeteksi pada struk ini.
        </div>
      ) : (
        <div
          className="mbg-table-wrapper clean-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="receipt-table-heading"
        >
          <table className="w-full text-left text-xs text-ink min-w-[540px]">
            <thead className="bg-subtle/40 text-ink-muted font-semibold uppercase tracking-wider text-[11px] border-b border-border">
              <tr>
                <th scope="col" className="py-2.5 px-4 w-10 text-center">
                  No
                </th>
                <th scope="col" className="py-2.5 px-4">
                  Nama Barang / Item
                </th>
                <th scope="col" className="py-2.5 px-4 text-center">
                  Qty
                </th>
                <th scope="col" className="py-2.5 px-4 text-right">
                  Harga Satuan
                </th>
                <th scope="col" className="py-2.5 px-4 text-right">
                  Total
                </th>
                <th scope="col" className="py-2.5 px-3 text-center w-14">
                  Salin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {data.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-subtle/35 transition-colors">
                  <td className="py-2.5 px-4 text-center text-ink-faint font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-ink">{item.name}</td>
                  <td className="py-2.5 px-4 text-center text-ink-muted">
                    {item.qty !== null && item.qty !== undefined
                      ? `${item.qty} ${item.unit || ''}`.trim()
                      : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right text-ink-muted font-mono">
                    {formatRupiah(item.pricePerUnit)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-ink font-mono">
                    {formatRupiah(item.totalPrice)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleCopyItem(item, idx)}
                      aria-label={`Salin ${item.name}`}
                      data-compact-target="true"
                      className={`p-1.5 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer ${
                        copiedIndex === idx
                          ? 'bg-forest-50 text-forest-700'
                          : 'text-ink-faint hover:text-forest-700 hover:bg-forest-50'
                      }`}
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals Summary Footer */}
      <div className="p-4 bg-subtle/40 border-t border-border flex flex-col items-end gap-1.5 text-xs">
        {data.subtotal !== null &&
          data.subtotal !== undefined &&
          data.subtotal > 0 &&
          (data.discount || data.tax) && (
            <div className="flex justify-between w-full max-w-xs text-ink-muted">
              <span>Subtotal:</span>
              <span className="font-mono">{formatRupiah(data.subtotal)}</span>
            </div>
          )}
        {data.discount !== null && data.discount !== undefined && data.discount > 0 && (
          <div className="flex justify-between w-full max-w-xs text-forest-800">
            <span>Diskon:</span>
            <span className="font-mono">-{formatRupiah(data.discount)}</span>
          </div>
        )}
        {data.tax !== null && data.tax !== undefined && data.tax > 0 && (
          <div className="flex justify-between w-full max-w-xs text-ink-muted">
            <span>Pajak (PPN):</span>
            <span className="font-mono">{formatRupiah(data.tax)}</span>
          </div>
        )}
        {data.totalAmount !== null && data.totalAmount !== undefined && (
          <div className="flex justify-between w-full max-w-xs pt-2 mt-1 border-t border-border text-sm font-bold text-ink">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-forest-700" aria-hidden="true" />
              <span>Total Pembelian:</span>
            </span>
            <span className="font-mono text-forest-800 text-base">
              {formatRupiah(data.totalAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
