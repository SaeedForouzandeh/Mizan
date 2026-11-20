import React, { useMemo, useState } from 'react';
import { Award, TableProperties } from 'lucide-react';
import type {
  BatchMarginBadgeInfo,
  BatchMarginBadgeTier,
  CurrencyMode,
  ProductPurchaseHistory,
  PurchaseBatch,
} from '../types/mizan';
import { getBatchMarginContribution } from '../utils/fifo';
import {
  formatJalaliShortDate,
  formatMoney,
  formatPercent,
  formatQty,
} from '../utils/formatters';

export interface PendingBatchPreview {
  quantity: number;
  unitCost: number;
  unitSellPrice: number;
  label?: string;
}

export interface PurchaseHistoryTableProps {
  history: ProductPurchaseHistory | null;
  unit: string;
  currency: CurrencyMode;
  pendingBatch?: PendingBatchPreview | null;
}

const SOURCE_LABELS: Record<PurchaseBatch['source'], string> = {
  initial: 'اولیه',
  restock: 'ورود انبار',
  adjustment: 'اصلاح',
};

const BADGE_STYLES: Record<
  BatchMarginBadgeTier,
  { container: string; dot: string }
> = {
  best: {
    container:
      'bg-emerald-600/14 text-emerald-800 border-emerald-700/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/35',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  strong: {
    container:
      'bg-teal-600/12 text-teal-800 border-teal-700/25 dark:bg-teal-500/18 dark:text-teal-300 dark:border-teal-400/30',
    dot: 'bg-teal-600 dark:bg-teal-400',
  },
  moderate: {
    container:
      'bg-amber-500/15 text-[#7F4A0E] border-amber-700/25 dark:bg-amber-400/18 dark:text-amber-200 dark:border-amber-400/30',
    dot: 'bg-[#9A5B13] dark:bg-amber-400',
  },
  low: {
    container:
      'bg-orange-600/12 text-orange-800 border-orange-700/25 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/30',
    dot: 'bg-orange-600 dark:bg-orange-400',
  },
  loss: {
    container:
      'bg-red-600/12 text-red-700 border-red-600/25 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/35',
    dot: 'bg-red-600 dark:bg-red-400',
  },
};

function MarginContributionBadge({
  badge,
  marginPercent,
  sharePercent,
}: {
  badge: BatchMarginBadgeInfo;
  marginPercent: number;
  sharePercent?: number;
}) {
  const styles = BADGE_STYLES[badge.tier];
  const srText =
    typeof sharePercent === 'number'
      ? `ارزش سودآوری بچ: ${badge.label}، حاشیه سود ${formatPercent(marginPercent)}، سهم از سود ${formatPercent(sharePercent)}`
      : `ارزش سودآوری بچ: ${badge.label}، حاشیه سود ${formatPercent(marginPercent)}`;

  return (
    <span
      aria-label={srText}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold leading-tight whitespace-nowrap ${styles.container}`}
    >
      {badge.tier === 'best' ? (
        <Award className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{badge.label}</span>
    </span>
  );
}

function formatCompactDate(tsMs: number): string {
  const full = formatJalaliShortDate(tsMs);
  return full.split('،')[0]?.trim() || full;
}

export function PurchaseHistoryTable({
  history,
  unit,
  currency,
  pendingBatch = null,
}: PurchaseHistoryTableProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'active'>('all');

  const entries = history?.entries ?? [];
  const totalBatches = history?.totalBatches ?? 0;
  const activeBatchesCount = history?.activeBatchesCount ?? 0;
  const hasDepleted = totalBatches > activeBatchesCount;

  const visibleEntries = useMemo(() => {
    if (filterMode === 'active') {
      return entries.filter((e) => e.status === 'active');
    }
    return entries;
  }, [entries, filterMode]);

  const validPending =
    pendingBatch && pendingBatch.quantity > 0 && pendingBatch.unitCost >= 0
      ? pendingBatch
      : null;

  const pendingUnitProfit = validPending
    ? validPending.unitSellPrice - validPending.unitCost
    : 0;
  const pendingTotalProfit = validPending
    ? Math.round(validPending.quantity * pendingUnitProfit)
    : 0;
  const pendingMarginPercent =
    validPending && validPending.unitSellPrice > 0
      ? Math.round((pendingUnitProfit / validPending.unitSellPrice) * 1000) / 10
      : 0;

  const prevBatchCost =
    entries.length > 0 ? entries[entries.length - 1].unitCost : null;
  const pendingDeltaPercent =
    validPending && prevBatchCost && prevBatchCost > 0
      ? Math.round(((validPending.unitCost - prevBatchCost) / prevBatchCost) * 1000) / 10
      : null;

  // All margins across historical entries (+ pending batch if priced) for relative cost-effectiveness badges
  const allComparableMargins = useMemo(() => {
    const list = entries.map((e) => e.unitMarginPercent);
    if (validPending && validPending.unitSellPrice > 0) {
      list.push(pendingMarginPercent);
    }
    return list;
  }, [entries, validPending, pendingMarginPercent]);

  const totalVisibleRows = visibleEntries.length + (validPending ? 1 : 0);

  const footerTotalQty =
    visibleEntries.reduce((sum, e) => sum + e.batch.initialQty, 0) +
    (validPending ? validPending.quantity : 0);
  const footerRemainingQty =
    visibleEntries.reduce((sum, e) => sum + e.batch.remainingQty, 0) +
    (validPending ? validPending.quantity : 0);
  const footerTotalBuyCost =
    visibleEntries.reduce((sum, e) => sum + e.batch.initialQty * e.unitCost, 0) +
    (validPending ? validPending.quantity * validPending.unitCost : 0);
  const footerWeightedCost =
    footerTotalQty > 0 ? Math.round(footerTotalBuyCost / footerTotalQty) : 0;
  const footerTotalProfitImpact =
    visibleEntries.reduce((sum, e) => sum + e.totalGrossProfitImpact, 0) +
    (validPending && validPending.unitSellPrice > 0 ? pendingTotalProfit : 0);

  return (
    <section
      aria-label="جدول تاریخچه خریدهای قبلی و تأثیر بر سود"
      className="rounded-2xl p-3 sm:p-4 bg-white/70 dark:bg-[#1E1813]/85 border border-amber-900/15 dark:border-amber-200/15 space-y-3"
    >
      {/* Header + Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TableProperties
            className="w-4 h-4 text-[#9A5B13] dark:text-amber-400 shrink-0"
            aria-hidden="true"
          />
          <h3 className="text-xs sm:text-sm font-extrabold text-[#261B12] dark:text-[#F5EFE6]">
            جدول خریدهای قبلی و تأثیر بر سود
          </h3>
        </div>

        {hasDepleted ? (
          <div
            role="group"
            aria-label="فیلتر ردیف‌های جدول خرید"
            className="inline-flex p-0.5 rounded-xl bg-amber-900/8 dark:bg-amber-200/10 text-[11px]"
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              aria-pressed={filterMode === 'all'}
              className={`min-h-[30px] px-2.5 rounded-lg font-bold transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                  : 'text-[#6E5643] dark:text-[#B8A593]'
              }`}
            >
              همه ({totalBatches})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('active')}
              aria-pressed={filterMode === 'active'}
              className={`min-h-[30px] px-2.5 rounded-lg font-bold transition-colors cursor-pointer ${
                filterMode === 'active'
                  ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                  : 'text-[#6E5643] dark:text-[#B8A593]'
              }`}
            >
              فعال ({activeBatchesCount})
            </button>
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-[#6E5643] dark:text-[#B8A593] tabular-nums">
            {totalBatches > 0
              ? `${totalBatches} بچ ثبت‌شده`
              : validPending
                ? 'پیش‌نمایش بچ اول'
                : 'بدون سابقه خرید'}
          </span>
        )}
      </div>

      {/* Compact Color-Coded Efficiency Legend */}
      {totalVisibleRows > 0 && (
        <div
          aria-label="راهنمای نشانگر سودآوری بچ‌ها"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#6E5643] dark:text-[#B8A593]"
        >
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
            به‌صرفه‌ترین
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400" aria-hidden="true" />
            سود بالا / خوب
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#9A5B13] dark:bg-amber-400" aria-hidden="true" />
            متعادل / حاشیه کمتر
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true" />
            کم‌سود / زیان‌ده
          </span>
        </div>
      )}

      {/* Empty State for Brand-New Product Before Stock/Cost Entered */}
      {totalVisibleRows === 0 ? (
        <p className="text-xs text-[#6E5643] dark:text-[#B8A593] rounded-xl p-3 bg-amber-900/5 dark:bg-black/20 leading-relaxed">
          هنوز خرید قبلی برای این کالا ثبت نشده است. با وارد کردن موجودی و قیمت خرید (و قیمت فروش)،
          پیش‌نمایش بچ اول و تأثیر آن بر سود ناخالص در این جدول نمایش داده می‌شود.
        </p>
      ) : (
        <div
          data-testid="purchase-history-scroll"
          className="w-full max-h-[260px] sm:max-h-[340px] overflow-y-auto overscroll-contain rounded-xl border border-amber-900/10 dark:border-amber-200/10 bg-white/50 dark:bg-[#16120E]/50"
        >
          <table className="w-full table-fixed text-right border-collapse text-[11px] sm:text-xs tabular-nums">
            <caption className="sr-only">
              فهرست بچ‌های خرید قبلی کالا با تاریخ، تعداد، قیمت خرید و تأثیر هر بچ بر سود ناخالص
            </caption>
            <thead className="sticky top-0 z-10 bg-[#FAF6F0]/95 dark:bg-[#1E1813]/95 backdrop-blur-xs">
              <tr className="border-b border-amber-900/15 dark:border-amber-200/15 text-[10px] sm:text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                <th scope="col" className="w-[25%] py-2 pr-2 pl-1 font-bold">
                  تاریخ / بچ
                </th>
                <th scope="col" className="w-[17%] py-2 px-1 font-bold">
                  تعداد
                </th>
                <th scope="col" className="w-[26%] py-2 px-1 font-bold">
                  قیمت خرید
                </th>
                <th scope="col" className="w-[32%] py-2 pl-2 pr-1 font-bold text-left">
                  تأثیر بر سود
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-900/10 dark:divide-amber-200/10">
              {visibleEntries.map((entry) => {
                const badge = getBatchMarginContribution(
                  entry.unitMarginPercent,
                  allComparableMargins
                );
                return (
                  <tr
                    key={entry.batch.id}
                    className={
                      entry.status === 'depleted'
                        ? 'opacity-85 bg-amber-900/3 dark:bg-white/[0.02]'
                        : ''
                    }
                  >
                    {/* Date & Batch */}
                    <td className="py-2.5 pr-2 pl-1 align-top break-words">
                      <p className="font-bold text-[#261B12] dark:text-[#F5EFE6] leading-snug">
                        بچ {entry.batchIndex} · {formatCompactDate(entry.batch.purchasedAt)}
                      </p>
                      <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] mt-0.5 truncate">
                        {SOURCE_LABELS[entry.batch.source]}
                        {entry.batch.supplierName ? ` · ${entry.batch.supplierName}` : ''}
                      </p>
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-1 align-top">
                      <p className="font-bold text-[#261B12] dark:text-[#F5EFE6] leading-snug">
                        {formatQty(entry.batch.initialQty)} {unit}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          entry.status === 'active'
                            ? 'text-[#7F4A0E] dark:text-amber-300'
                            : 'text-[#6E5643] dark:text-[#B8A593]'
                        }`}
                      >
                        {entry.status === 'active'
                          ? `باقی ${formatQty(entry.batch.remainingQty)}`
                          : 'تکمیل'}
                      </p>
                    </td>

                    {/* Buy Price & Cost Delta */}
                    <td className="py-2.5 px-1 align-top">
                      <p className="font-bold text-[#261B12] dark:text-[#F5EFE6] leading-snug">
                        {formatMoney(entry.unitCost, currency)}
                      </p>
                      {entry.costDeltaPercent !== null && entry.costDeltaPercent !== 0 ? (
                        <p
                          className={`text-[10px] font-bold mt-0.5 ${
                            entry.costDeltaPercent > 0
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {entry.costDeltaPercent > 0 ? '↑ +' : '↓ '}
                          {formatPercent(entry.costDeltaPercent)}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] mt-0.5">
                          فروش {formatMoney(entry.unitSellPrice, currency)}
                        </p>
                      )}
                    </td>

                    {/* Gross Profit Impact + Color-Coded Margin Contribution Badge */}
                    <td className="py-2.5 pl-2 pr-1 align-top text-left">
                      <p
                        className={`font-extrabold leading-snug ${
                          entry.totalGrossProfitImpact >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(entry.totalGrossProfitImpact, currency)}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <MarginContributionBadge
                          badge={badge}
                          marginPercent={entry.unitMarginPercent}
                          sharePercent={entry.grossProfitSharePercent}
                        />
                      </div>
                      <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] mt-0.5 leading-snug">
                        حاشیه {formatPercent(entry.unitMarginPercent)} · سهم{' '}
                        {formatPercent(entry.grossProfitSharePercent)}
                      </p>
                    </td>
                  </tr>
                );
              })}

              {/* Live Pending New Batch Row (Create or Positive Stock Edit) */}
              {validPending && (
                <tr className="bg-amber-500/10 dark:bg-amber-400/10">
                  <td className="py-2.5 pr-2 pl-1 align-top break-words">
                    <p className="font-bold text-[#7F4A0E] dark:text-amber-300 leading-snug">
                      {validPending.label ?? `بچ ${totalBatches + 1} · جدید`}
                    </p>
                    <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] mt-0.5">
                      پیش‌نمایش
                    </p>
                  </td>

                  <td className="py-2.5 px-1 align-top">
                    <p className="font-bold text-[#261B12] dark:text-[#F5EFE6] leading-snug">
                      +{formatQty(validPending.quantity)} {unit}
                    </p>
                    <p className="text-[10px] text-[#7F4A0E] dark:text-amber-300 mt-0.5">
                      ورودی جدید
                    </p>
                  </td>

                  <td className="py-2.5 px-1 align-top">
                    <p className="font-bold text-[#261B12] dark:text-[#F5EFE6] leading-snug">
                      {formatMoney(validPending.unitCost, currency)}
                    </p>
                    {pendingDeltaPercent !== null && pendingDeltaPercent !== 0 && (
                      <p
                        className={`text-[10px] font-bold mt-0.5 ${
                          pendingDeltaPercent > 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {pendingDeltaPercent > 0 ? '↑ +' : '↓ '}
                        {formatPercent(pendingDeltaPercent)}
                      </p>
                    )}
                  </td>

                  <td className="py-2.5 pl-2 pr-1 align-top text-left">
                    {validPending.unitSellPrice > 0 ? (
                      <>
                        <p
                          className={`font-extrabold leading-snug ${
                            pendingTotalProfit >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {formatMoney(pendingTotalProfit, currency)}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <MarginContributionBadge
                            badge={getBatchMarginContribution(
                              pendingMarginPercent,
                              allComparableMargins
                            )}
                            marginPercent={pendingMarginPercent}
                          />
                        </div>
                        <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] mt-0.5 leading-snug">
                          واحد {formatMoney(pendingUnitProfit, currency)} (
                          {formatPercent(pendingMarginPercent)})
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593]">
                        قیمت فروش وارد شود
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>

            {/* Summary Footer */}
            <tfoot className="sticky bottom-0 z-10 bg-[#F5EFE6]/95 dark:bg-[#19140F]/95 backdrop-blur-xs">
              <tr className="border-t-2 border-amber-900/15 dark:border-amber-200/15 font-bold">
                <td className="py-2 pr-2 pl-1 text-[#6E5643] dark:text-[#B8A593]">جمع / میانگین</td>
                <td className="py-2 px-1">
                  <span>
                    {formatQty(footerTotalQty)} {unit}
                  </span>
                  <span className="block text-[10px] font-normal text-[#6E5643] dark:text-[#B8A593]">
                    باقی {formatQty(footerRemainingQty)}
                  </span>
                </td>
                <td className="py-2 px-1">
                  <span>{formatMoney(footerWeightedCost, currency)}</span>
                  <span className="block text-[10px] font-normal text-[#6E5643] dark:text-[#B8A593]">
                    میانگین خرید
                  </span>
                </td>
                <td className="py-2 pl-2 pr-1 text-left">
                  <span
                    className={
                      footerTotalProfitImpact >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }
                  >
                    {formatMoney(footerTotalProfitImpact, currency)}
                  </span>
                  <span className="block text-[10px] font-normal text-[#6E5643] dark:text-[#B8A593]">
                    کل سود ناخالص
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
