import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { ProductActionModal } from '../components/modals/ProductActionModal';
import { useLedger } from '../context/LedgerContext';
import type { Product, ProductMetrics, StockFilter } from '../types/mizan';
import { computeProductMetrics } from '../utils/fifo';
import { formatMoney, formatQty } from '../utils/formatters';

interface InventoryViewProps {
  onOpenNewProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onOpenSale: (productId: string, batchId?: string) => void;
  onOpenRestock: (productId: string) => void;
}

const STATUS_LABELS = {
  in_stock: 'موجود',
  low_stock: 'کم‌موجود',
  out_of_stock: 'ناموجود',
} as const;

export function InventoryView({
  onOpenNewProduct,
  onOpenEditProduct,
  onOpenSale,
  onOpenRestock,
}: InventoryViewProps) {
  const { ledger } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const products = ledger?.products ?? [];
  const batches = ledger?.batches ?? [];

  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pressedProductId, setPressedProductId] = useState<string | null>(null);

  const triggerHapticTap = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(8);
      } catch {
        // Ignore on devices/browsers without vibration permission
      }
    }
  };

  const metricsList = useMemo(
    () => products.map((p) => computeProductMetrics(p, batches)),
    [products, batches]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [products]);

  const lowCount = useMemo(
    () => metricsList.filter((m) => m.status === 'low_stock').length,
    [metricsList]
  );

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return metricsList.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (selectedCategory !== 'all' && m.product.category !== selectedCategory) return false;
      if (q) {
        const hay = `${m.product.name} ${m.product.category} ${m.product.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [metricsList, statusFilter, selectedCategory, queryText]);

  const activeModalMetrics: ProductMetrics | null = useMemo(
    () => metricsList.find((m) => m.product.id === selectedProductId) ?? null,
    [metricsList, selectedProductId]
  );

  return (
    <div className="space-y-5">
      {/* Header + New Product CTA */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">انبار کالاها</h1>
          <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
            روی هر کالا بزنید تا فروش، ورود سری جدید و سود هر سری را ببینید
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewProduct}
          className="min-h-[46px] px-5 rounded-2xl mizan-btn-primary text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>کالای جدید</span>
        </button>
      </header>

      {/* Search + 4 Status Filters + Category Chips */}
      <section className="mizan-glass rounded-3xl p-4 sm:p-5 space-y-3.5">
        <div className="relative">
          <label htmlFor="inventory-search" className="sr-only">
            جستجو بر اساس نام کالا، دسته یا کد محصول
          </label>
          <Search
            className="w-4 h-4 text-[#6E5643] dark:text-[#B8A593] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="inventory-search"
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="جستجو در نام کالا، دسته‌بندی یا کد محصول..."
            className="w-full min-h-[46px] pr-11 pl-4 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/12 dark:border-amber-200/12 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
          />
        </div>

        {/* 4 Status Filter Buttons */}
        <div
          role="group"
          aria-label="فیلتر وضعیت موجودی"
          className="flex flex-wrap items-center gap-2"
        >
          {(
            [
              { id: 'all', label: 'همه' },
              { id: 'in_stock', label: 'موجود' },
              { id: 'low_stock', label: `کم (${lowCount})` },
              { id: 'out_of_stock', label: 'ناموجود' },
            ] as const
          ).map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                aria-pressed={active}
                className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'mizan-btn-primary'
                    : 'mizan-btn-glass text-[#544030] dark:text-[#D9C7B6]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Category Filter Buttons */}
        {categories.length > 0 && (
          <div
            role="group"
            aria-label="فیلتر دسته‌بندی کالا"
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              aria-pressed={selectedCategory === 'all'}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'border-[#9A5B13] bg-amber-500/14 text-[#7F4A0E] dark:text-amber-300'
                  : 'border-amber-900/12 dark:border-amber-200/12 text-[#6E5643] dark:text-[#B8A593] hover:border-[#9A5B13]/40'
              }`}
            >
              همه دسته‌ها
            </button>
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={active}
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#9A5B13] bg-amber-500/14 text-[#7F4A0E] dark:text-amber-300'
                      : 'border-amber-900/12 dark:border-amber-200/12 text-[#6E5643] dark:text-[#B8A593] hover:border-[#9A5B13]/40'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Product Card Grid */}
      {filtered.length === 0 ? (
        <section className="mizan-glass rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold">کالایی مطابق جستجو یا فیلتر فعلی پیدا نشد.</p>
          <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
            می‌توانید فیلترها را پاک کنید یا کالای جدیدی ثبت کنید.
          </p>
        </section>
      ) : (
        <section
          aria-label="فهرست کالاهای انبار"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filtered.map((m) => {
            const statusTextColor =
              m.status === 'out_of_stock'
                ? 'text-red-700 dark:text-red-400'
                : m.status === 'low_stock'
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-400';

            const isPressed = pressedProductId === m.product.id;

            return (
              <article
                key={m.product.id}
                className={`relative mizan-glass mizan-glass-card rounded-3xl p-5 select-none ${
                  isPressed ? 'is-pressed' : ''
                }`}
              >
                <button
                  type="button"
                  data-card-edit="true"
                  onClick={() => {
                    triggerHapticTap();
                    onOpenEditProduct(m.product);
                  }}
                  aria-label={`ویرایش ${m.product.name}`}
                  className="absolute top-4 left-4 z-10 min-w-[40px] min-h-[40px] rounded-xl mizan-btn-glass flex items-center justify-center text-[#7F4A0E] dark:text-amber-300 active:scale-90 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  data-card-main="true"
                  onPointerDown={() => setPressedProductId(m.product.id)}
                  onPointerUp={() => setPressedProductId(null)}
                  onPointerCancel={() => setPressedProductId(null)}
                  onPointerLeave={() => setPressedProductId(null)}
                  onClick={() => {
                    triggerHapticTap();
                    setSelectedProductId(m.product.id);
                  }}
                  aria-label={`عملیات انبار برای ${m.product.name}، موجودی ${formatQty(m.currentStock)} ${m.product.unit}، وضعیت ${STATUS_LABELS[m.status]}`}
                  className="w-full h-full text-right flex flex-col justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9A5B13] rounded-2xl touch-manipulation cursor-pointer"
                >
                  <div className="pl-12 min-w-0">
                    <h2 className="text-base font-extrabold leading-snug truncate">
                      {m.product.name}
                    </h2>
                    <p className="text-xs text-[#6E5643] dark:text-[#B8A593] mt-1 truncate">
                      <span>{m.product.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span dir="ltr" className="tabular-nums">
                        {m.product.sku}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold tabular-nums">
                          {formatQty(m.currentStock)}
                        </span>
                        <span className="text-xs font-semibold text-[#6E5643] dark:text-[#B8A593]">
                          {m.product.unit}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${statusTextColor}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                    </div>

                    {m.hasMixedBatchPrices && (
                      <p className="text-[11px] font-semibold text-[#7F4A0E] dark:text-amber-300">
                        {m.activeBatches.length} سری با قیمت خرید/فروش متفاوت
                      </p>
                    )}

                    {m.status !== 'in_stock' && (
                      <p className="text-[11px] text-red-700 dark:text-red-400">
                        {m.status === 'out_of_stock'
                          ? 'موجودی این کالا به پایان رسیده و نیازمند سفارش است.'
                          : `موجودی به حد نصاب سفارش (${formatQty(m.product.reorderLevel)} ${m.product.unit}) رسیده است.`}
                      </p>
                    )}

                    <div className="pt-3 border-t border-amber-900/10 dark:border-amber-200/10 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                          میانگین خرید
                        </p>
                        <p className="font-bold tabular-nums mt-0.5 truncate">
                          {formatMoney(m.avgBuyCost, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                          {m.hasMixedBatchPrices ? 'میانگین فروش' : 'قیمت فروش'}
                        </p>
                        <p className="font-bold tabular-nums mt-0.5 truncate">
                          {formatMoney(m.avgSellPrice, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
                          سود موجودی
                        </p>
                        <p
                          className={`font-bold tabular-nums mt-0.5 truncate ${
                            m.expectedProfit >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {formatMoney(m.expectedProfit, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              </article>
            );
          })}
        </section>
      )}

      <ProductActionModal
        metrics={activeModalMetrics}
        onClose={() => setSelectedProductId(null)}
        onOpenSale={onOpenSale}
        onOpenRestock={onOpenRestock}
        onOpenEdit={(prodId) => {
          const found = products.find((p) => p.id === prodId);
          if (found) onOpenEditProduct(found);
        }}
      />
    </div>
  );
}
