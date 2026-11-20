import React, { useEffect, useMemo, useState } from 'react';
import { useLedger } from '../../context/LedgerContext';
import { getProductAvgCost, getProductStock } from '../../utils/fifo';
import {
  formatMoney,
  formatPercent,
  formatQty,
  inputToToman,
  parseNumericInput,
  tomanToDisplayNumber,
} from '../../utils/formatters';
import { ModalFrame } from './ModalFrame';

interface RestockModalProps {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
}

export function RestockModal({ open, onClose, defaultProductId }: RestockModalProps) {
  const { ledger, restockProduct } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const currencyLabel = currency === 'toman' ? 'تومان' : 'ریال';

  const products = ledger?.products ?? [];
  const batches = ledger?.batches ?? [];
  const suppliers = useMemo(
    () => (ledger?.contacts ?? []).filter((c) => c.type === 'supplier'),
    [ledger?.contacts]
  );

  const [productId, setProductId] = useState('');
  const [qtyStr, setQtyStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [unitSellPriceStr, setUnitSellPriceStr] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    const initial =
      products.find((p) => p.id === defaultProductId) ?? products[0] ?? null;
    if (initial) {
      setProductId(initial.id);
      const avgCost = getProductAvgCost(initial.id, batches);
      setUnitCostStr(avgCost > 0 ? String(tomanToDisplayNumber(avgCost, currency)) : '');
      setUnitSellPriceStr(
        initial.sellPrice > 0 ? String(tomanToDisplayNumber(initial.sellPrice, currency)) : ''
      );
    } else {
      setProductId('');
      setUnitCostStr('');
      setUnitSellPriceStr('');
    }
    setQtyStr('5');
    setSupplierName('');
    setNote('');
  }, [open, defaultProductId, products, batches, currency]);

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    const avgCost = getProductAvgCost(nextId, batches);
    const nextProd = products.find((p) => p.id === nextId);
    setUnitCostStr(avgCost > 0 ? String(tomanToDisplayNumber(avgCost, currency)) : '');
    setUnitSellPriceStr(
      nextProd && nextProd.sellPrice > 0
        ? String(tomanToDisplayNumber(nextProd.sellPrice, currency))
        : ''
    );
  };

  const qty = parseNumericInput(qtyStr);
  const unitCostToman = inputToToman(parseNumericInput(unitCostStr), currency);
  const unitSellToman = inputToToman(parseNumericInput(unitSellPriceStr), currency);
  const totalBuyCost = Math.round(qty * unitCostToman);
  const unitProfit = unitSellToman - unitCostToman;
  const totalBatchProfit = Math.round(qty * unitProfit);
  const marginPercent =
    unitSellToman > 0 ? Math.round((unitProfit / unitSellToman) * 1000) / 10 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedProduct) {
      setError('کالایی انتخاب نشده است.');
      return;
    }
    if (qty <= 0) {
      setError('تعداد ورود انبار باید بیشتر از صفر باشد.');
      return;
    }

    const res = restockProduct(
      selectedProduct.id,
      qty,
      unitCostToman,
      unitSellToman > 0 ? unitSellToman : selectedProduct.sellPrice,
      supplierName,
      note
    );

    if (!res.ok) {
      setError(res.error ?? 'خطا در ثبت ورود انبار.');
      return;
    }
    onClose();
  };

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      title="ورود انبار (سری خرید جدید)"
      subtitle="خرید و فروش این سری می‌تواند با سری‌های قبلی متفاوت باشد"
    >
      {products.length === 0 ? (
        <p className="text-sm text-[#6E5643] dark:text-[#B8A593] py-4">
          ابتدا از بخش انبار یک کالا تعریف کنید.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="restock-product" className="block text-xs font-semibold mb-1.5">
              کالا
            </label>
            <select
              id="restock-product"
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full min-h-[46px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — موجود: {formatQty(getProductStock(p.id, batches))} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="restock-qty" className="block text-xs font-semibold mb-1.5">
              تعداد ورودی ({selectedProduct?.unit ?? 'واحد'})
            </label>
            <input
              id="restock-qty"
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value)}
              placeholder="5"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="restock-cost" className="block text-xs font-semibold mb-1.5">
                قیمت خرید هر واحد ({currencyLabel})
              </label>
              <input
                id="restock-cost"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={unitCostStr}
                onChange={(e) => setUnitCostStr(e.target.value)}
                placeholder="850000"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
            </div>

            <div>
              <label htmlFor="restock-sell-price" className="block text-xs font-semibold mb-1.5">
                قیمت فروش این سری ({currencyLabel})
              </label>
              <input
                id="restock-sell-price"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={unitSellPriceStr}
                onChange={(e) => setUnitSellPriceStr(e.target.value)}
                placeholder="1400000"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-emerald-700/25 dark:border-emerald-400/25 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="restock-supplier" className="block text-xs font-semibold mb-1.5">
                تأمین‌کننده (اختیاری)
              </label>
              <input
                id="restock-supplier"
                list="mizan-suppliers-list"
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="نام تأمین‌کننده..."
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
              <datalist id="mizan-suppliers-list">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="restock-note" className="block text-xs font-semibold mb-1.5">
                یادداشت سری (اختیاری)
              </label>
              <input
                id="restock-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="مثلاً: خرید جدید اردیبهشت"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
            </div>
          </div>

          {/* Live Batch Cost & Profit Preview */}
          {qty > 0 && (
            <div className="rounded-2xl p-3.5 bg-amber-500/10 border border-amber-700/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6E5643] dark:text-[#B8A593]">جمع خرید این سری</span>
                <strong className="tabular-nums text-[#7F4A0E] dark:text-amber-300">
                  {formatMoney(totalBuyCost, currency)}
                </strong>
              </div>
              {unitSellToman > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[#6E5643] dark:text-[#B8A593]">سود هر واحد</span>
                    <strong
                      className={`tabular-nums ${
                        unitProfit >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatMoney(unitProfit, currency)} · {formatPercent(marginPercent)}
                    </strong>
                  </div>
                  <div className="pt-1.5 border-t border-amber-700/15 flex items-center justify-between">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      سود پیش‌بینی‌شده کل این سری
                    </span>
                    <strong
                      className={`tabular-nums text-sm ${
                        totalBatchProfit >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatMoney(totalBatchProfit, currency)}
                    </strong>
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              className="flex-1 min-h-[46px] rounded-2xl mizan-btn-primary text-sm font-bold cursor-pointer"
            >
              ثبت ورود انبار
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] px-5 rounded-2xl mizan-btn-glass text-sm font-semibold cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}
