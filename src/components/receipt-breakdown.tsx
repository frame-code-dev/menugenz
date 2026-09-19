'use client';

import React, { useState } from 'react';
import { ReceiptItem, ReceiptResult } from '@/types/receipt';
import { formatRupiah } from '@/lib/receipt';
import { formatIndonesianDate } from '@/lib/caption';
import { Store, Calendar, CreditCard, ShoppingCart, Copy, Check } from 'lucide-react';

interface ReceiptBreakdownProps {
  data: ReceiptResult;
}

export const ReceiptBreakdown: React.FC<ReceiptBreakdownProps> = ({ data }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyItem = async (item: ReceiptItem, idx: number) => {
    const qtyStr =
      item.qty !== null && item.qty !== undefined ? `${item.qty} ${item.unit || ''}`.trim() : '';
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

    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy item:', err);
    }
  };

  const handleCopyAll = async () => {
    const lines: string[] = [];
    if (data.merchantName) lines.push(`🏪 ${data.merchantName}`);
    if (data.date) lines.push(`📅 Tanggal: ${formatIndonesianDate(data.date)}`);
    if (data.paymentMethod) lines.push(`💳 Pembayaran: ${data.paymentMethod}`);
    if (lines.length > 0) lines.push('');

    lines.push('Daftar Rincian Belanja:');
    data.items.forEach((item, idx) => {
      const qtyStr =
        item.qty !== null && item.qty !== undefined ? `${item.qty} ${item.unit || ''}`.trim() : '';
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

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy all items:', err);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {/* Header Info */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          <Store className="w-4 h-4 text-emerald-600" />
          <span>{data.merchantName || 'Toko / Merchant Tanpa Nama'}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600">
          {data.date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatIndonesianDate(data.date)}
            </span>
          )}
          {data.paymentMethod && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-medium">
              <CreditCard className="w-3.5 h-3.5" />
              {data.paymentMethod}
            </span>
          )}

          {/* Copy All Button */}
          <button
            type="button"
            onClick={handleCopyAll}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              copiedAll
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
            }`}
            title="Salin seluruh rincian belanja struk"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Semua</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table of Items */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100/75 text-slate-500 font-medium uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 w-10 text-center">No</th>
              <th className="py-2.5 px-4">Nama Barang / Item</th>
              <th className="py-2.5 px-4 text-center">Qty</th>
              <th className="py-2.5 px-4 text-right">Harga Satuan</th>
              <th className="py-2.5 px-4 text-right">Total</th>
              <th className="py-2.5 px-3 text-center w-14">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {data.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                <td className="py-2.5 px-4 font-medium text-slate-800">{item.name}</td>
                <td className="py-2.5 px-4 text-center text-slate-600">
                  {item.qty !== null && item.qty !== undefined ? `${item.qty} ${item.unit || ''}`.trim() : '-'}
                </td>
                <td className="py-2.5 px-4 text-right text-slate-600 font-mono">
                  {formatRupiah(item.pricePerUnit)}
                </td>
                <td className="py-2.5 px-4 text-right font-semibold text-slate-900 font-mono">
                  {formatRupiah(item.totalPrice)}
                </td>
                <td className="py-2 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleCopyItem(item, idx)}
                    className={`p-1.5 rounded-md transition-colors inline-flex items-center justify-center ${
                      copiedIndex === idx
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                    }`}
                    title="Salin rincian item ini"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Summary Footer */}
      <div className="p-4 bg-slate-50/60 border-t border-slate-200 flex flex-col items-end gap-1.5 text-xs">
        {data.subtotal !== null && data.subtotal !== undefined && data.subtotal > 0 && (data.discount || data.tax) && (
          <div className="flex justify-between w-full max-w-xs text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono">{formatRupiah(data.subtotal)}</span>
          </div>
        )}
        {data.discount !== null && data.discount !== undefined && data.discount > 0 && (
          <div className="flex justify-between w-full max-w-xs text-emerald-700">
            <span>Diskon:</span>
            <span className="font-mono">-{formatRupiah(data.discount)}</span>
          </div>
        )}
        {data.tax !== null && data.tax !== undefined && data.tax > 0 && (
          <div className="flex justify-between w-full max-w-xs text-slate-600">
            <span>Pajak (PPN):</span>
            <span className="font-mono">{formatRupiah(data.tax)}</span>
          </div>
        )}
        {data.totalAmount !== null && data.totalAmount !== undefined && (
          <div className="flex justify-between w-full max-w-xs pt-2 mt-1 border-t border-slate-200 text-sm font-bold text-slate-900">
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              Total Pembelian:
            </span>
            <span className="font-mono text-emerald-700 text-base">{formatRupiah(data.totalAmount)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

