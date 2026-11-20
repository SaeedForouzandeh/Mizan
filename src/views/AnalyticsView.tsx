import React, { useMemo, useState } from 'react';
import { DualLineProfitChart } from '../components/Charts';
import { useLedger } from '../context/LedgerContext';
import {
  computeProfitAnalytics,
  type AnalyticsRangeDays,
} from '../utils/analytics';
import { formatMoney, formatPercent, formatQty } from '../utils/formatters';

const RANGE_DAYS: AnalyticsRangeDays[] = [7, 30, 90];

export function AnalyticsView() {
  const { ledger } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const sales = ledger?.sales ?? [];

  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30);

  const report = useMemo(
    () => computeProfitAnalytics(sales, rangeDays),
    [sales, rangeDays]
  );

  const maxProfit = Math.max(1, ...report.ranking.map((r) => Math.abs(r.profit)));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">تحلیل سود</h1>
          <p className="text-xs sm:text-sm text-[#6E5643] dark:text-[#B8A593]">
            گزارش دقیق درآمد، بهای تمام‌شده FIFO و سودآورترین کالاها
          </p>
        </div>

        <div
          role="group"
          aria-label="بازه زمانی تحلیل سود"
          className="inline-flex gap-1.5 p-1.5 rounded-2xl mizan-segmented-glass"
        >
          {RANGE_DAYS.map((days) => {
            const active = rangeDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                aria-pressed={active}
                className={`min-h-[38px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'mizan-btn-primary'
                    : 'text-[#544030] dark:text-[#D9C7B6] hover:bg-amber-900/8 dark:hover:bg-amber-400/10'
                }`}
              >
                {days} روز
              </button>
            );
          })}
        </div>
      </header>

      {/* Four KPI Cards: Revenue, COGS, Net Profit, Margin */}
      <section aria-label="شاخص‌های سودآوری" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <article className="mizan-glass rounded-3xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">درآمد</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-1.5">
            {formatMoney(report.revenue, currency)}
          </p>
        </article>

        <article className="mizan-glass rounded-3xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">بهای تمام‌شده</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-1.5">
            {formatMoney(report.cogs, currency)}
          </p>
        </article>

        <article className="mizan-glass rounded-3xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">سود خالص</p>
          <p
            className={`text-lg sm:text-xl font-extrabold tabular-nums mt-1.5 ${
              report.profit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatMoney(report.profit, currency)}
          </p>
        </article>

        <article className="mizan-glass rounded-3xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">حاشیه سود</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums text-[#7F4A0E] dark:text-amber-300 mt-1.5">
            {formatPercent(report.marginPercent)}
          </p>
        </article>
      </section>

      {/* Dual-Line Revenue & Profit Chart */}
      <section className="mizan-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold">نمودار دوخطی درآمد و سود خالص ({rangeDays} روز اخیر)</h2>
          <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
            مجموع {report.salesCount} فروش تکمیل‌شده در این بازه
          </p>
        </div>
        <DualLineProfitChart points={report.series} currency={currency} />
      </section>

      {/* Product Profitability Ranking */}
      <section className="mizan-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold">رتبه‌بندی کالاها بر اساس سود خالص</h2>

        {report.ranking.length === 0 ? (
          <p className="text-sm text-[#6E5643] dark:text-[#B8A593]">
            در بازه {rangeDays} روز اخیر فروشی ثبت نشده است.
          </p>
        ) : (
          <ol className="space-y-4">
            {report.ranking.map((item, idx) => {
              const widthPct = Math.max(
                6,
                Math.round((Math.abs(item.profit) / maxProfit) * 100)
              );
              return (
                <li
                  key={item.productId}
                  className="pb-4 border-b border-amber-900/10 dark:border-amber-200/10 last:border-b-0 last:pb-0 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-amber-900/10 dark:bg-amber-400/15 text-[#7F4A0E] dark:text-amber-300 text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{item.productName}</p>
                        <p className="text-xs text-[#6E5643] dark:text-[#B8A593] tabular-nums">
                          فروش: {formatQty(item.unitsSold)} واحد · درآمد {formatMoney(item.revenue, currency)} · بها {formatMoney(item.cogs, currency)}
                        </p>
                      </div>
                    </div>

                    <div className="text-left tabular-nums shrink-0">
                      <p
                        className={`text-sm font-extrabold ${
                          item.profit >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {formatMoney(item.profit, currency)}
                      </p>
                      <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                        حاشیه {formatPercent(item.marginPercent)}
                      </p>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-amber-900/8 dark:bg-amber-100/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.profit >= 0
                          ? 'bg-emerald-600 dark:bg-emerald-400'
                          : 'bg-red-600 dark:bg-red-400'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
