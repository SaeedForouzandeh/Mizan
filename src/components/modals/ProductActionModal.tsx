import React, { useEffect, useState } from 'react';
import { PackagePlus, Pencil, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import type { ProductMetrics } from '../../types/mizan';
import {
  formatJalaliShortDate,
  formatMoney,
  formatPercent,
  formatQty,
  inputToToman,
  parseNumericInput,
  tomanToDisplayNumber,
} from '../../utils/formatters';
import { ModalFrame } from './ModalFrame';

interface ProductActionModalProps {
  metrics: ProductMetrics | null;
  onClose: () => void;
  onOpenSale: (productId: string, batchId?: string) => void;
  onOpenRestock: (productId: string) => void;
  onOpenEdit: (productId: string) => void;
}

export function ProductActionModal({
  metrics,
  onClose,
  onOpenSale,
  onOpenRestock,
  onOpenEdit,
}: ProductActionModalProps) {
  const { ledger, adjustProductStock } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const currencyLabel = currency === 'toman' ? 'تومان' : 'ریال';

  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [targetStockStr, setTargetStockStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!metrics) return;
    setShowAdjustForm(false);
    setTargetStockStr(String(metrics.currentStock));
    setUnitCostStr(String(tomanToDisplayNumber(metrics.avgBuyCost, currency)));
    setReason('');
    setError(null);
  }, [metrics, currency]);

  if (!metrics) return null;

  const { product, currentStock, avgBuyCost, avgSellPrice, expectedProfit, batchProfits } = metrics;

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetVal = parseNumericInput(targetStockStr);
    const costToman = inputToToman(parseNumericInput(unitCostStr), currency);
    const res = adjustProductStock(product.id, targetVal, costToman, reason);
    if (!res.ok) {
      setError(res.error ?? 'خطا در اصلاح موجودی.');
      return;
    }
    onClose();
  };

  return (
    <ModalFrame
      open={Boolean(metrics)}
      onClose={onClose}
      title={product.name}
      subtitle={`${product.category} · کد ${product.sku}`}
    >
      <div className="space-y-4">
        {/* Key snapshot numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl p-2.5 bg-amber-900/6 dark:bg-amber-400/8">
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">موجودی فعلی</p>
            <p className="text-sm font-extrabold tabular-nums mt-0.5">
              {formatQty(currentStock)} {product.unit}
            </p>
          </div>
          <div className="rounded-2xl p-2.5 bg-amber-900/6 dark:bg-amber-400/8">
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">میانگین خرید</p>
            <p className="text-xs font-bold tabular-nums mt-1">
              {formatMoney(avgBuyCost, currency)}
            </p>
          </div>
          <div className="rounded-2xl p-2.5 bg-amber-900/6 dark:bg-amber-400/8">
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">میانگین فروش</p>
            <p className="text-xs font-bold tabular-nums mt-1 text-[#7F4A0E] dark:text-amber-300">
              {formatMoney(avgSellPrice, currency)}
            </p>
          </div>
          <div className="rounded-2xl p-2.5 bg-emerald-500/10 border border-emerald-700/18">
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">سود کل موجودی</p>
            <p
              className={`text-xs font-extrabold tabular-nums mt-1 ${
                expectedProfit >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {formatMoney(expectedProfit, currency)}
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={currentStock <= 0}
            onClick={() => {
              onClose();
              onOpenSale(product.id);
            }}
            className="min-h-[64px] p-2.5 rounded-2xl mizan-btn-primary disabled:opacity-40 flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer"
          >
            <ReceiptText className="w-5 h-5" aria-hidden="true" />
            <span>ثبت فروش</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRestock(product.id);
            }}
            className="min-h-[64px] p-2.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 hover:brightness-105 text-white border border-emerald-200/30 shadow-lg shadow-emerald-900/35 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer"
          >
            <PackagePlus className="w-5 h-5" aria-hidden="true" />
            <span>ورود سری جدید</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdjustForm((v) => !v)}
            aria-expanded={showAdjustForm}
            className={`min-h-[64px] p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer ${
              showAdjustForm
                ? 'mizan-nav-pill-active text-[#7F4A0E] dark:text-amber-300'
                : 'mizan-btn-glass text-[#544030] dark:text-[#D9C7B6]'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
            <span>اصلاح موجودی</span>
          </button>
        </div>

        {/* Inline Stock Adjustment Form */}
        {showAdjustForm && (
          <form
            onSubmit={handleAdjustSubmit}
            className="rounded-2xl p-4 bg-amber-500/10 border border-amber-700/20 space-y-3"
          >
            <h3 className="text-xs font-bold text-[#7F4A0E] dark:text-amber-300">
              اصلاح مستقیم موجودی انبار
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="adj-target-stock" className="block text-xs font-medium mb-1">
                  موجودی جدید ({product.unit})
                </label>
                <input
                  id="adj-target-stock"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={targetStockStr}
                  onChange={(e) => setTargetStockStr(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-sm tabular-nums text-left"
                />
              </div>
              <div>
                <label htmlFor="adj-unit-cost" className="block text-xs font-medium mb-1">
                  بهای واحد در صورت افزایش ({currencyLabel})
                </label>
                <input
                  id="adj-unit-cost"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={unitCostStr}
                  onChange={(e) => setUnitCostStr(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-sm tabular-nums text-left"
                />
              </div>
            </div>
            <div>
              <label htmlFor="adj-reason" className="block text-xs font-medium mb-1">
                دلیل اصلاح
              </label>
              <input
                id="adj-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثلاً: انبارگردانی یا ضایعات"
                className="w-full min-h-[42px] px-3 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-sm"
              />
            </div>
            {error && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full min-h-[42px] rounded-xl mizan-btn-primary text-xs font-bold cursor-pointer"
            >
              ذخیره اصلاح موجودی
            </button>
          </form>
        )}

        {/* Active Purchase Batches with Buy, Sell, and Per-Batch Profit */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[#6E5643] dark:text-[#B8A593]">
            سری‌های خرید فعال ({batchProfits.length} سری · به ترتیب FIFO)
          </h3>
          {batchProfits.length === 0 ? (
            <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
              موجودی فعالی در هیچ سری خریدی باقی نمانده است.
            </p>
          ) : (
            <ul className="space-y-2">
              {batchProfits.map((bp, idx) => (
                <li
                  key={bp.batch.id}
                  className="rounded-2xl p-3 bg-white/65 dark:bg-[#1A1511]/80 border border-amber-900/10 dark:border-amber-200/10 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">
                        سری {idx + 1} · {formatQty(bp.batch.remainingQty)} از{' '}
                        {formatQty(bp.batch.initialQty)} {product.unit}
                      </p>
                      <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593] truncate">
                        {formatJalaliShortDate(bp.batch.purchasedAt)}
                        {bp.batch.supplierName ? ` · ${bp.batch.supplierName}` : ''}
                        {bp.batch.note ? ` · ${bp.batch.note}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSale(product.id, bp.batch.id);
                      }}
                      className="min-h-[36px] px-3 rounded-xl bg-[#9A5B13]/12 hover:bg-[#9A5B13]/20 text-[#7F4A0E] dark:text-amber-300 text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      فروش از این سری
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-900/10 dark:border-amber-200/10 tabular-nums text-[11px]">
                    <div>
                      <span className="text-[#6E5643] dark:text-[#B8A593] block">خرید واحد</span>
                      <strong>{formatMoney(bp.batch.unitCost, currency)}</strong>
                    </div>
                    <div>
                      <span className="text-[#6E5643] dark:text-[#B8A593] block">فروش واحد</span>
                      <strong>{formatMoney(bp.unitSellPrice, currency)}</strong>
                    </div>
                    <div>
                      <span className="text-[#6E5643] dark:text-[#B8A593] block">
                        سود واحد ({formatPercent(bp.marginPercent)})
                      </span>
                      <strong
                        className={
                          bp.unitProfit >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }
                      >
                        {formatMoney(bp.unitProfit, currency)}
                      </strong>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenEdit(product.id);
          }}
          className="w-full min-h-[44px] rounded-2xl mizan-btn-glass text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
          <span>ویرایش مشخصات کالا</span>
        </button>
      </div>
    </ModalFrame>
  );
}
