import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  PackagePlus,
  ReceiptText,
  TrendingUp,
} from 'lucide-react';
import { ProfitSparkline, SalesChart } from '../components/Charts';
import { useLedger } from '../context/LedgerContext';
import type { NavTab } from '../types/mizan';
import { buildSalesChartSeries, computeDashboardSummary } from '../utils/analytics';
import {
  formatJalaliFullDate,
  formatJalaliShortDate,
  formatMoney,
  formatPercent,
  formatQty,
  getGreetingByHour,
} from '../utils/formatters';

interface DashboardViewProps {
  onOpenSale: (productId?: string) => void;
  onOpenRestock: (productId?: string) => void;
  onOpenNewProduct: () => void;
  onNavigate: (tab: NavTab) => void;
}

const BAR_COLORS = [
  'bg-[#9A5B13] dark:bg-amber-400',
  'bg-emerald-600 dark:bg-emerald-400',
  'bg-amber-600 dark:bg-amber-300',
  'bg-teal-600 dark:bg-teal-400',
  'bg-orange-600 dark:bg-orange-400',
];

export function DashboardView({
  onOpenSale,
  onOpenRestock,
  onOpenNewProduct,
  onNavigate,
}: DashboardViewProps) {
  const { ledger } = useLedger();
  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily');

  const now = useMemo(() => new Date(), []);
  const jalaliDate = useMemo(() => formatJalaliFullDate(now), [now]);
  const greeting = useMemo(() => getGreetingByHour(now.getHours()), [now]);

  const currency = ledger?.profile.currency ?? 'toman';
  const products = ledger?.products ?? [];
  const batches = ledger?.batches ?? [];
  const sales = ledger?.sales ?? [];

  const summary = useMemo(
    () => computeDashboardSummary(products, batches, sales, now),
    [products, batches, sales, now]
  );

  const chartSeries = useMemo(
    () => buildSalesChartSeries(sales, chartMode, now),
    [sales, chartMode, now]
  );

  const recentSales = useMemo(
    () => [...sales].sort((a, b) => b.soldAt - a.soldAt).slice(0, 6),
    [sales]
  );

  const maxProductProfit = Math.max(
    1,
    ...summary.productProfitBreakdown.map((p) => Math.abs(p.profit))
  );

  const alertSentence = useMemo(() => {
    if (summary.alertItems.length === 0) return null;
    const names = summary.alertItems
      .slice(0, 3)
      .map(
        (m) =>
          `${m.product.name} (${
            m.currentStock <= 0
              ? 'ناموجود'
              : `${formatQty(m.currentStock)} ${m.product.unit}`
          })`
      )
      .join('، ');
    const more =
      summary.alertItems.length > 3 ? ` و ${summary.alertItems.length - 3} کالای دیگر` : '';
    return `${summary.alertItems.length} کالا به حد نصاب سفارش رسیده یا ناموجود است: ${names}${more}.`;
  }, [summary.alertItems]);

  return (
    <div className="space-y-6">
      {/* 1. Shamsi Date + Time Greeting + Two Primary Counter Buttons */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium text-[#6E5643] dark:text-[#B8A593]">
            {jalaliDate}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
            {greeting}، {ledger?.profile.storeName || 'میزان'}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenRestock()}
            className="min-h-[46px] px-4 sm:px-5 rounded-2xl mizan-btn-glass text-sm font-bold text-[#7F4A0E] dark:text-amber-300 flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <PackagePlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>ورود انبار</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSale()}
            className="min-h-[46px] px-4 sm:px-5 rounded-2xl mizan-btn-primary text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <ReceiptText className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>فروش جدید</span>
          </button>
        </div>
      </section>

      {/* Concise Empty Store Onboarding Banner */}
      {products.length === 0 && (
        <section className="mizan-glass rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold">انبار شما هنوز خالی است</h2>
            <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
              اولین کالا را ثبت کنید تا موجودی انبار و سود فروش شما به‌صورت خودکار محاسبه شود.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNewProduct}
              className="min-h-[44px] px-4 rounded-2xl mizan-btn-primary text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              ثبت اولین کالا
            </button>
          </div>
        </section>
      )}

      {/* 2. Low-Stock Warning Banner (Full Sentence, Not Color Alone) */}
      {alertSentence && (
        <section
          role="status"
          aria-label="هشدار کمبود موجودی"
          className="rounded-3xl p-4 bg-red-500/10 dark:bg-red-500/15 border border-red-600/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-xs sm:text-sm font-medium text-red-900 dark:text-red-200 leading-relaxed">
              {alertSentence}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="min-h-[40px] px-3.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold whitespace-nowrap self-end sm:self-center cursor-pointer"
          >
            بررسی در انبار
          </button>
        </section>
      )}

      {/* 3. Hero Card ("سود خالص امروز") + 4 Compact KPI Cards Alongside */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Hero Card: Today's Net Profit */}
        <article className="lg:col-span-7 mizan-glass-strong rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[#6E5643] dark:text-[#B8A593]">
                سود خالص امروز
              </h2>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                حاشیه سود {formatPercent(summary.today.marginPercent)}
              </span>
            </div>

            <p
              className={`text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight ${
                summary.today.profit >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {formatMoney(summary.today.profit, currency)}
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-amber-900/10 dark:border-amber-200/10">
              <div>
                <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">درآمد امروز</p>
                <p className="text-base sm:text-lg font-bold tabular-nums mt-0.5">
                  {formatMoney(summary.today.revenue, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">بهای تمام‌شده (FIFO)</p>
                <p className="text-base sm:text-lg font-bold tabular-nums mt-0.5">
                  {formatMoney(summary.today.cogs, currency)}
                </p>
              </div>
            </div>
          </div>

          <ProfitSparkline points={summary.today.sevenDayProfit} currency={currency} />
        </article>

        {/* 4 Compact KPI Cards */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <article className="mizan-glass rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">جمع سود کل</p>
            <p className="text-base sm:text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatMoney(summary.totalProfit, currency)}
            </p>
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
              میانگین حاشیه {formatPercent(summary.averageMarginPercent)}
            </p>
          </article>

          <article className="mizan-glass rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">ارزش موجودی</p>
            <p className="text-base sm:text-xl font-extrabold tabular-nums text-[#7F4A0E] dark:text-amber-300">
              {formatMoney(summary.totalInventoryValue, currency)}
            </p>
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">بر اساس بهای خرید بچ‌ها</p>
          </article>

          <article className="mizan-glass rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">کالاهای کم‌موجود</p>
            <p
              className={`text-2xl font-extrabold tabular-nums ${
                summary.alertItems.length > 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {summary.alertItems.length}
            </p>
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
              {summary.outOfStockItems.length} ناموجود · {summary.lowStockItems.length} کم
            </p>
          </article>

          <article className="mizan-glass rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">تعداد کالاها</p>
            <p className="text-2xl font-extrabold tabular-nums">{summary.totalProducts}</p>
            <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
              قلم ثبت‌شده در انبار
            </p>
          </article>
        </div>
      </section>

      {/* 4. Sales Chart (Daily / Monthly Toggle) */}
      <section className="mizan-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">نمودار فروش و سود</h2>
            <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
              مقایسه درآمد و سود خالص ثبت‌شده
            </p>
          </div>
          <div
            role="group"
            aria-label="بازه زمانی نمودار فروش"
            className="inline-flex gap-1 p-1 rounded-2xl mizan-segmented-glass"
          >
            <button
              type="button"
              onClick={() => setChartMode('daily')}
              aria-pressed={chartMode === 'daily'}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'daily'
                  ? 'mizan-btn-primary'
                  : 'text-[#6E5643] dark:text-[#B8A593] hover:bg-amber-900/6 dark:hover:bg-amber-400/10'
              }`}
            >
              روزانه
            </button>
            <button
              type="button"
              onClick={() => setChartMode('monthly')}
              aria-pressed={chartMode === 'monthly'}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'monthly'
                  ? 'mizan-btn-primary'
                  : 'text-[#6E5643] dark:text-[#B8A593] hover:bg-amber-900/6 dark:hover:bg-amber-400/10'
              }`}
            >
              ماهانه
            </button>
          </div>
        </div>

        <SalesChart points={chartSeries} currency={currency} mode={chartMode} />
      </section>

      {/* 5. Three Quick Shortcuts */}
      <section aria-label="میانبرهای سریع" className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onOpenSale()}
          className="mizan-btn-glass rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 text-center min-h-[72px] cursor-pointer"
        >
          <ReceiptText className="w-5 h-5 text-[#9A5B13] dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">ثبت فروش</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenRestock()}
          className="mizan-btn-glass rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 text-center min-h-[72px] cursor-pointer"
        >
          <PackagePlus className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">ورود انبار</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="mizan-btn-glass rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 text-center min-h-[72px] cursor-pointer"
        >
          <BarChart3 className="w-5 h-5 text-[#9A5B13] dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">تحلیل سود</span>
        </button>
      </section>

      {/* 6. Net Profit Per Product Card */}
      <section className="mizan-glass rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-900/10 dark:border-amber-200/10">
          <div>
            <h2 className="text-base font-bold">سود خالص هر کالا</h2>
            <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
              عملکرد سودآوری بر اساس بهای تمام‌شده واقعی
            </p>
          </div>
          <div className="flex items-center gap-5 tabular-nums text-xs sm:text-sm">
            <div>
              <span className="text-[#6E5643] dark:text-[#B8A593]">جمع سود خالص: </span>
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatMoney(summary.overallNetProfit, currency)}
              </strong>
            </div>
            <div>
              <span className="text-[#6E5643] dark:text-[#B8A593]">میانگین حاشیه: </span>
              <strong className="text-[#7F4A0E] dark:text-amber-300">
                {formatPercent(summary.averageMarginPercent)}
              </strong>
            </div>
          </div>
        </div>

        {summary.productProfitBreakdown.length === 0 ? (
          <p className="text-sm text-[#6E5643] dark:text-[#B8A593]">
            هنوز فروشی برای محاسبه سود هر کالا ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {summary.productProfitBreakdown.map((item, idx) => {
              const pctWidth = Math.max(
                6,
                Math.round((Math.abs(item.profit) / maxProductProfit) * 100)
              );
              const barColor =
                item.profit < 0
                  ? 'bg-red-600 dark:bg-red-400'
                  : BAR_COLORS[idx % BAR_COLORS.length];
              return (
                <li key={item.productId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-semibold truncate">{item.productName}</span>
                    <span
                      className={`tabular-nums font-bold shrink-0 ${
                        item.profit >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatMoney(item.profit, currency)} · {formatPercent(item.marginPercent)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-amber-900/8 dark:bg-amber-100/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${pctWidth}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 7. Bottom Grid: Inventory Alert Card + Recent Sales Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory Alert Card */}
        <section className="mizan-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">هشدار موجودی</h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-[#9A5B13] dark:text-amber-400 hover:underline cursor-pointer"
            >
              مشاهده انبار
            </button>
          </div>

          {summary.alertItems.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              همه کالاهای انبار بالای حد نصاب سفارش هستند و کمبودی وجود ندارد.
            </p>
          ) : (
            <ul className="divide-y divide-amber-900/10 dark:divide-amber-200/10">
              {summary.alertItems.map((m) => (
                <li
                  key={m.product.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{m.product.name}</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                      {m.currentStock <= 0
                        ? `ناموجود است (حد نصاب ${formatQty(m.product.reorderLevel)} ${m.product.unit})`
                        : `تنها ${formatQty(m.currentStock)} ${m.product.unit} باقی مانده است (حد نصاب ${formatQty(m.product.reorderLevel)})`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenRestock(m.product.id)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-amber-900/8 hover:bg-amber-900/14 dark:bg-amber-400/12 text-xs font-bold text-[#7F4A0E] dark:text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ورود انبار
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Sales Card */}
        <section className="mizan-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">فروش‌های اخیر</h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-semibold text-[#9A5B13] dark:text-amber-400 hover:underline cursor-pointer"
            >
              همه فروش‌ها
            </button>
          </div>

          {recentSales.length === 0 ? (
            <p className="text-sm text-[#6E5643] dark:text-[#B8A593]">
              هنوز فروشی ثبت نشده است. با دکمه «فروش جدید» اولین فروش را ثبت کنید.
            </p>
          ) : (
            <ul className="divide-y divide-amber-900/10 dark:divide-amber-200/10">
              {recentSales.map((s) => (
                <li
                  key={s.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-bold truncate ${
                        s.status === 'voided' ? 'line-through opacity-60' : ''
                      }`}
                    >
                      {s.productName}
                    </p>
                    <p className="text-xs text-[#6E5643] dark:text-[#B8A593] mt-0.5">
                      {formatQty(s.quantity)} {s.unit} · {s.channel} · {formatJalaliShortDate(s.soldAt)}
                    </p>
                  </div>
                  <div className="text-left shrink-0 tabular-nums">
                    {s.status === 'voided' ? (
                      <span className="text-xs font-bold text-red-700 dark:text-red-400">
                        باطل‌شده
                      </span>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{formatMoney(s.profit, currency)}</span>
                        </p>
                        <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                          درآمد {formatMoney(s.revenue, currency)}
                        </p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
