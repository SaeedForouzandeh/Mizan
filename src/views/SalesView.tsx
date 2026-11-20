import React, { useMemo, useState } from 'react';
import { MoreVertical, Plus, RotateCcw } from 'lucide-react';
import { useLedger } from '../context/LedgerContext';
import {
  filterSalesByRange,
  summarizeSales,
  type SalesDateRange,
} from '../utils/analytics';
import {
  formatJalaliShortDate,
  formatMoney,
  formatPercent,
  formatQty,
} from '../utils/formatters';

interface SalesViewProps {
  onOpenSale: () => void;
}

const RANGE_OPTIONS: Array<{ id: SalesDateRange; label: string }> = [
  { id: 'today', label: 'امروز' },
  { id: '7d', label: '۷ روز اخیر' },
  { id: '30d', label: '۳۰ روز اخیر' },
  { id: 'all', label: 'همه' },
];

export function SalesView({ onOpenSale }: SalesViewProps) {
  const { ledger, voidSale } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const sales = ledger?.sales ?? [];

  const [range, setRange] = useState<SalesDateRange>('30d');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const filteredSales = useMemo(() => filterSalesByRange(sales, range), [sales, range]);
  const summary = useMemo(() => summarizeSales(filteredSales), [filteredSales]);

  const handleVoid = async (saleId: string) => {
    setVoidingId(saleId);
    setOpenMenuId(null);
    await voidSale(saleId);
    setVoidingId(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">فروش‌ها</h1>
          <p className="text-xs sm:text-sm text-[#6E5643] dark:text-[#B8A593]">
            تاریخچه فروش‌ها با محاسبه دقیق FIFO و امکان ابطال و بازگشت موجودی
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSale}
          className="min-h-[46px] px-5 rounded-2xl mizan-btn-primary text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>فروش جدید</span>
        </button>
      </header>

      {/* Date range selector */}
      <div
        role="group"
        aria-label="بازه زمانی فهرست فروش‌ها"
        className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-2xl mizan-segmented-glass"
      >
        {RANGE_OPTIONS.map((opt) => {
          const active = range === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id)}
              aria-pressed={active}
              className={`min-h-[38px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? 'mizan-btn-primary'
                  : 'text-[#544030] dark:text-[#D9C7B6] hover:bg-amber-900/8 dark:hover:bg-amber-400/10'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Three Summary Figures: Revenue, Profit, Count */}
      <section aria-label="خلاصه فروش بازه انتخابی" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <article className="mizan-glass rounded-3xl p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">درآمد بازه</p>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums mt-1.5">
            {formatMoney(summary.revenue, currency)}
          </p>
        </article>

        <article className="mizan-glass rounded-3xl p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">سود خالص بازه</p>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
            {formatMoney(summary.profit, currency)}
          </p>
        </article>

        <article className="mizan-glass rounded-3xl p-5">
          <p className="text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">تعداد فروش فعال</p>
          <p className="text-xl sm:text-2xl font-extrabold tabular-nums mt-1.5">
            {summary.count}
          </p>
        </article>
      </section>

      {/* Sales List */}
      <section className="mizan-glass rounded-3xl p-4 sm:p-5">
        {filteredSales.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm font-semibold">در این بازه فروشی ثبت نشده است.</p>
            <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
              بازه زمانی دیگری را انتخاب کنید یا فروش جدید ثبت کنید.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-amber-900/10 dark:divide-amber-200/10">
            {filteredSales.map((s) => {
              const isVoided = s.status === 'voided';
              const menuOpen = openMenuId === s.id;
              return (
                <li
                  key={s.id}
                  className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 relative"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p
                        className={`text-sm sm:text-base font-bold truncate ${
                          isVoided ? 'line-through opacity-55' : ''
                        }`}
                      >
                        {s.productName}
                      </p>
                      {isVoided && (
                        <span className="text-xs font-bold text-red-700 dark:text-red-400">
                          (باطل‌شده — موجودی برگشت داده شد)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
                      <span>
                        {formatQty(s.quantity)} {s.unit}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>کانال {s.channel}</span>
                      {s.customerName && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{s.customerName}</span>
                        </>
                      )}
                      <span aria-hidden="true"> · </span>
                      <span>{formatJalaliShortDate(s.soldAt)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left tabular-nums">
                      <p
                        className={`text-sm font-extrabold ${
                          isVoided
                            ? 'text-[#6E5643] dark:text-[#B8A593] line-through'
                            : s.profit >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        سود {formatMoney(s.profit, currency)}
                      </p>
                      <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                        درآمد {formatMoney(s.revenue, currency)} · {formatPercent(s.marginPercent)}
                      </p>
                    </div>

                    {!isVoided && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(menuOpen ? null : s.id)}
                          aria-label={`گزینه‌های فروش ${s.productName}`}
                          aria-expanded={menuOpen}
                          aria-haspopup="menu"
                          disabled={voidingId === s.id}
                          className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-amber-900/8 dark:hover:bg-amber-400/12 flex items-center justify-center text-[#6E5643] dark:text-[#B8A593] cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" aria-hidden="true" />
                        </button>

                        {menuOpen && (
                          <div
                            role="menu"
                            className="absolute left-0 top-11 z-20 w-48 mizan-glass-strong rounded-2xl p-1.5 shadow-xl"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void handleVoid(s.id)}
                              className="w-full min-h-[42px] px-3 rounded-xl text-xs font-bold text-red-700 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>ابطال فروش و برگشت موجودی</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
