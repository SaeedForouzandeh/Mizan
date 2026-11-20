import React, { useMemo, useState } from 'react';
import { History, TrendingDown, TrendingUp } from 'lucide-react';
import type { CurrencyMode, ProductPurchaseHistory, PurchaseBatch } from '../types/mizan';
import {
  formatJalaliShortDate,
  formatMoney,
  formatPercent,
  formatQty,
} from '../utils/formatters';

interface PurchasePriceHistoryPanelProps {
  history: ProductPurchaseHistory;
  unit: string;
  currency: CurrencyMode;
  showBatchCards?: boolean;
}

const SOURCE_LABELS: Record<PurchaseBatch['source'], string> = {
  initial: 'موجودی اولیه',
  restock: 'ورود انبار',
  adjustment: 'اصلاح موجودی',
};

export function PurchasePriceHistoryPanel({
  history,
  unit,
  currency,
  showBatchCards = true,
}: PurchasePriceHistoryPanelProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'active'>('all');

  const hasDepleted = history.totalBatches > history.activeBatchesCount;
  const visibleEntries = useMemo(() => {
    const base =
      filterMode === 'active'
        ? history.entries.filter((e) => e.status === 'active')
        : history.entries;
    // Show chronological oldest -> newest in chart, newest -> oldest in cards or oldest -> newest?
    // Chronological oldest -> newest matches FIFO batch numbering (بچ ۱، بچ ۲، بچ ۳) clearly.
    return base;
  }, [history.entries, filterMode]);

  if (history.totalBatches === 0) {
    return null;
  }

  // SVG chart dimensions (compact, crisp on 390px mobile)
  const chartEntries = history.entries;
  const svgW = 320;
  const svgH = 122;
  const padX = 28;
  const padTop = 18;
  const padBottom = 26;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padTop - padBottom;

  const maxVal = Math.max(
    1,
    ...chartEntries.map((e) => Math.max(e.unitCost, Math.abs(e.unitGrossProfit)))
  );

  const points = chartEntries.map((entry, idx) => {
    const x =
      chartEntries.length === 1
        ? padX + plotW / 2
        : padX + (idx / (chartEntries.length - 1)) * plotW;
    const costY = padTop + plotH - (entry.unitCost / maxVal) * plotH;
    const profitHeight = Math.max(
      4,
      (Math.max(0, entry.unitGrossProfit) / maxVal) * plotH
    );
    const profitY = padTop + plotH - profitHeight;
    return {
      entry,
      x,
      costY,
      profitY,
      profitHeight,
    };
  });

  const costPath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.costY.toFixed(1)}`)
    .join(' ');

  const barWidth = Math.min(26, Math.max(12, Math.floor(plotW / Math.max(chartEntries.length * 2.2, 3))));

  return (
    <section
      aria-label="تاریخچه قیمت خرید و تأثیر بر سود ناخالص"
      className="rounded-2xl p-4 bg-white/65 dark:bg-[#1E1813]/85 border border-amber-900/15 dark:border-amber-200/15 space-y-3.5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <History
            className="w-4 h-4 text-[#9A5B13] dark:text-amber-400 shrink-0"
            aria-hidden="true"
          />
          <h3 className="text-xs sm:text-sm font-extrabold text-[#261B12] dark:text-[#F5EFE6]">
            تاریخچه قیمت خرید و سود ناخالص
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-[#6E5643] dark:text-[#B8A593] tabular-nums">
          {history.totalBatches} بچ ثبت‌شده ({history.activeBatchesCount} فعال)
        </span>
      </div>

      {/* 3-Metric Summary Strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl p-2 bg-amber-900/6 dark:bg-amber-400/8">
          <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593]">بازه قیمت خرید</p>
          <p className="text-[11px] sm:text-xs font-extrabold tabular-nums mt-0.5 text-[#7F4A0E] dark:text-amber-300">
            {history.minUnitCost === history.maxUnitCost
              ? formatMoney(history.minUnitCost, currency)
              : `${formatMoney(history.minUnitCost, currency)} تا ${formatMoney(history.maxUnitCost, currency)}`}
          </p>
          {history.firstToLatestCostChangePercent !== null &&
            history.firstToLatestCostChangePercent !== 0 && (
              <p
                className={`text-[10px] font-bold tabular-nums mt-0.5 inline-flex items-center justify-center gap-0.5 ${
                  history.firstToLatestCostChangePercent > 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {history.firstToLatestCostChangePercent > 0 ? (
                  <TrendingUp className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-3 h-3" aria-hidden="true" />
                )}
                <span>
                  {history.firstToLatestCostChangePercent > 0 ? '+' : ''}
                  {formatPercent(history.firstToLatestCostChangePercent)}
                </span>
              </p>
            )}
        </div>

        <div className="rounded-xl p-2 bg-emerald-500/10 border border-emerald-700/15">
          <p className="text-[10px] text-emerald-800 dark:text-emerald-300">
            سود ناخالص محقق‌شده
          </p>
          <p
            className={`text-[11px] sm:text-xs font-extrabold tabular-nums mt-0.5 ${
              history.totalRealizedGrossProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatMoney(history.totalRealizedGrossProfit, currency)}
          </p>
          <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] tabular-nums mt-0.5">
            حاشیه کل {formatPercent(history.overallGrossMarginPercent)}
          </p>
        </div>

        <div className="rounded-xl p-2 bg-amber-500/8 border border-amber-700/15">
          <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593]">سود موجودی باقی</p>
          <p
            className={`text-[11px] sm:text-xs font-extrabold tabular-nums mt-0.5 ${
              history.totalProjectedGrossProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatMoney(history.totalProjectedGrossProfit, currency)}
          </p>
          <p className="text-[10px] text-[#6E5643] dark:text-[#B8A593] tabular-nums mt-0.5">
            میانگین خرید {formatMoney(history.weightedAvgCost, currency)}
          </p>
        </div>
      </div>

      {/* Trend Mini-Chart: Unit Buy Price (Amber Line) vs Unit Gross Profit (Emerald Bars) */}
      <div className="rounded-xl p-2.5 bg-amber-900/4 dark:bg-black/20 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-[#6E5643] dark:text-[#B8A593]">
          <span className="font-semibold">روند قیمت خرید و سود ناخالص واحد</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-[#9A5B13] dark:bg-amber-400 inline-block" />
              خرید
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-emerald-600/75 dark:bg-emerald-400/75 inline-block" />
              سود واحد
            </span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          role="img"
          aria-label="نمودار تاریخچه قیمت خرید و سود ناخالص هر بچ"
          className="w-full h-28 overflow-visible"
        >
          {/* Baseline */}
          <line
            x1={padX - 8}
            y1={padTop + plotH}
            x2={svgW - padX + 8}
            y2={padTop + plotH}
            stroke="currentColor"
            className="text-amber-900/15 dark:text-amber-200/15"
            strokeWidth={1}
          />

          {/* Unit Gross Profit Bars */}
          {points.map((pt) => (
            <rect
              key={`bar-${pt.entry.batch.id}`}
              x={pt.x - barWidth / 2}
              y={pt.profitY}
              width={barWidth}
              height={pt.profitHeight}
              rx={4}
              className={
                pt.entry.unitGrossProfit >= 0
                  ? 'fill-emerald-600/35 dark:fill-emerald-400/35'
                  : 'fill-red-600/35 dark:fill-red-400/35'
              }
            />
          ))}

          {/* Unit Buy Price Line */}
          {points.length > 1 && (
            <path
              d={costPath}
              fill="none"
              stroke="currentColor"
              className="text-[#9A5B13] dark:text-amber-400"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Nodes + Labels */}
          {points.map((pt) => (
            <g key={`pt-${pt.entry.batch.id}`}>
              <circle
                cx={pt.x}
                cy={pt.costY}
                r={4}
                className="fill-[#9A5B13] dark:fill-amber-400 stroke-white dark:stroke-[#1E1813]"
                strokeWidth={1.5}
              />
              <text
                x={pt.x}
                y={svgH - 7}
                textAnchor="middle"
                className="fill-[#6E5643] dark:fill-[#B8A593] text-[9px] font-semibold"
              >
                بچ {pt.entry.batchIndex}
              </text>
            </g>
          ))}
        </svg>

        {/* Accessible screen-reader data table */}
        <table className="sr-only">
          <caption>جدول تاریخچه قیمت خرید و تأثیر هر بچ بر سود ناخالص</caption>
          <thead>
            <tr>
              <th>بچ</th>
              <th>تاریخ</th>
              <th>قیمت خرید</th>
              <th>قیمت فروش</th>
              <th>سود واحد</th>
              <th>سود محقق‌شده</th>
              <th>سود باقیمانده</th>
            </tr>
          </thead>
          <tbody>
            {chartEntries.map((entry) => (
              <tr key={entry.batch.id}>
                <td>بچ {entry.batchIndex}</td>
                <td>{formatJalaliShortDate(entry.batch.purchasedAt)}</td>
                <td>{formatMoney(entry.unitCost, currency)}</td>
                <td>{formatMoney(entry.unitSellPrice, currency)}</td>
                <td>{formatMoney(entry.unitGrossProfit, currency)}</td>
                <td>{formatMoney(entry.realizedGrossProfit, currency)}</td>
                <td>{formatMoney(entry.projectedRemainingProfit, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Filter Toggle & Chronological Batch Cards (optional when paired with PurchaseHistoryTable) */}
      {showBatchCards && hasDepleted && (
        <div
          role="group"
          aria-label="فیلتر بچ‌های تاریخچه"
          className="inline-flex p-1 rounded-xl bg-amber-900/8 dark:bg-amber-200/10 text-[11px]"
        >
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            aria-pressed={filterMode === 'all'}
            className={`min-h-[32px] px-3 rounded-lg font-bold transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                : 'text-[#6E5643] dark:text-[#B8A593]'
            }`}
          >
            همه بچ‌ها ({history.totalBatches})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            aria-pressed={filterMode === 'active'}
            className={`min-h-[32px] px-3 rounded-lg font-bold transition-colors cursor-pointer ${
              filterMode === 'active'
                ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                : 'text-[#6E5643] dark:text-[#B8A593]'
            }`}
          >
            فقط فعال ({history.activeBatchesCount})
          </button>
        </div>
      )}

      {/* Chronological Batch Cards */}
      {showBatchCards && (
      <ul className="space-y-2.5">
        {visibleEntries.map((entry) => {
          const shareWidth = Math.min(100, Math.max(4, Math.round(entry.grossProfitSharePercent)));
          return (
            <li
              key={entry.batch.id}
              className={`rounded-xl p-3 border text-xs space-y-2 ${
                entry.status === 'active'
                  ? 'bg-white/80 dark:bg-[#16120E]/85 border-amber-900/12 dark:border-amber-200/12'
                  : 'bg-amber-900/4 dark:bg-[#16120E]/45 border-amber-900/8 dark:border-amber-200/8 opacity-90'
              }`}
            >
              {/* Batch Title + Date + Cost Change */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[#261B12] dark:text-[#F5EFE6]">
                    بچ {entry.batchIndex} · {formatJalaliShortDate(entry.batch.purchasedAt)}
                    <span className="font-normal text-[#6E5643] dark:text-[#B8A593]">
                      {' '}
                      ({SOURCE_LABELS[entry.batch.source]})
                    </span>
                  </p>
                  <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593] mt-0.5">
                    {entry.status === 'active'
                      ? `موجودی فعال: ${formatQty(entry.batch.remainingQty)} از ${formatQty(entry.batch.initialQty)} ${unit}`
                      : `فروخته‌شده کامل (${formatQty(entry.batch.initialQty)} ${unit})`}
                    {entry.batch.supplierName ? ` · ${entry.batch.supplierName}` : ''}
                  </p>
                </div>

                {entry.costDeltaPercent !== null && entry.costDeltaPercent !== 0 && (
                  <span
                    className={`text-[11px] font-bold tabular-nums shrink-0 ${
                      entry.costDeltaPercent > 0
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {entry.costDeltaPercent > 0 ? '↑ +' : '↓ '}
                    {formatPercent(entry.costDeltaPercent)}
                  </span>
                )}
              </div>

              {/* Buy Cost / Sell Price / Unit Gross Profit */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-900/10 dark:border-amber-200/10 tabular-nums text-[11px]">
                <div>
                  <span className="text-[#6E5643] dark:text-[#B8A593] block">قیمت خرید</span>
                  <strong>{formatMoney(entry.unitCost, currency)}</strong>
                </div>
                <div>
                  <span className="text-[#6E5643] dark:text-[#B8A593] block">قیمت فروش</span>
                  <strong>{formatMoney(entry.unitSellPrice, currency)}</strong>
                </div>
                <div>
                  <span className="text-[#6E5643] dark:text-[#B8A593] block">
                    سود واحد ({formatPercent(entry.unitMarginPercent)})
                  </span>
                  <strong
                    className={
                      entry.unitGrossProfit >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }
                  >
                    {formatMoney(entry.unitGrossProfit, currency)}
                  </strong>
                </div>
              </div>

              {/* Gross Profit Impact Row + Share Bar */}
              <div className="pt-2 border-t border-amber-900/10 dark:border-amber-200/10 space-y-1.5 text-[11px] tabular-nums">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-[#6E5643] dark:text-[#B8A593]">
                    تأثیر بر سود ناخالص:
                    {' '}
                    <strong
                      className={
                        entry.totalGrossProfitImpact >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }
                    >
                      {formatMoney(entry.totalGrossProfitImpact, currency)}
                    </strong>
                  </span>
                  <span className="font-bold text-[#7F4A0E] dark:text-amber-300">
                    سهم {formatPercent(entry.grossProfitSharePercent)}
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-amber-900/10 dark:bg-amber-100/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      entry.totalGrossProfitImpact >= 0
                        ? 'bg-emerald-600 dark:bg-emerald-400'
                        : 'bg-red-600 dark:bg-red-400'
                    }`}
                    style={{ width: `${shareWidth}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#6E5643] dark:text-[#B8A593]">
                  <span>
                    محقق‌شده ({formatQty(entry.realizedSoldQty)} {unit}):{' '}
                    <strong className="text-[#261B12] dark:text-[#F5EFE6]">
                      {formatMoney(entry.realizedGrossProfit, currency)}
                    </strong>
                  </span>
                  {entry.batch.remainingQty > 0 && (
                    <span>
                      باقیمانده انبار:{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {formatMoney(entry.projectedRemainingProfit, currency)}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
