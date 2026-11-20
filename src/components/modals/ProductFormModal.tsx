import React, { useEffect, useMemo, useState } from 'react';
import { useLedger } from '../../context/LedgerContext';
import { PRODUCT_UNITS, type Product, type ProductUnit } from '../../types/mizan';
import {
  buildProductPurchaseHistory,
  getProductAvgCost,
  getProductStock,
} from '../../utils/fifo';
import {
  formatQty,
  inputToToman,
  parseNumericInput,
  tomanToDisplayNumber,
} from '../../utils/formatters';
import { PurchaseHistoryTable } from '../PurchaseHistoryTable';
import { PurchasePriceHistoryPanel } from '../PurchasePriceHistoryPanel';
import { ModalFrame } from './ModalFrame';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  editingProduct: Product | null;
}

export function ProductFormModal({ open, onClose, editingProduct }: ProductFormModalProps) {
  const { ledger, addProduct, updateProduct } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const currencyLabel = currency === 'toman' ? 'تومان' : 'ریال';

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    (ledger?.products ?? []).forEach((p) => {
      if (p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [ledger?.products]);

  const currentStock = useMemo(() => {
    if (!editingProduct || !ledger) return 0;
    return getProductStock(editingProduct.id, ledger.batches);
  }, [editingProduct, ledger]);

  const currentAvgCostToman = useMemo(() => {
    if (!editingProduct || !ledger) return 0;
    return getProductAvgCost(editingProduct.id, ledger.batches);
  }, [editingProduct, ledger]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [stockStr, setStockStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('');
  const [categorySelect, setCategorySelect] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [unit, setUnit] = useState<ProductUnit>('عدد');
  const [sellPriceStr, setSellPriceStr] = useState('');
  const [reorderStr, setReorderStr] = useState('');
  const [notes, setNotes] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAdjustmentReason('');
    if (editingProduct) {
      setName(editingProduct.name);
      setSku(editingProduct.sku);
      setStockStr(String(currentStock));
      setUnitCostStr(String(tomanToDisplayNumber(currentAvgCostToman, currency)));
      setCategorySelect(editingProduct.category || '');
      setNewCategory('');
      setUnit(editingProduct.unit);
      setSellPriceStr(
        editingProduct.sellPrice > 0
          ? String(tomanToDisplayNumber(editingProduct.sellPrice, currency))
          : ''
      );
      setReorderStr(String(editingProduct.reorderLevel));
      setNotes(editingProduct.notes);
    } else {
      setName('');
      setSku('');
      setStockStr('');
      setUnitCostStr('');
      setCategorySelect(existingCategories[0] ?? '');
      setNewCategory('');
      setUnit('عدد');
      setSellPriceStr('');
      setReorderStr('3');
      setNotes('');
    }
  }, [open, editingProduct, currentStock, currentAvgCostToman, currency, existingCategories]);

  const parsedStock = parseNumericInput(stockStr);
  const parsedUnitCostToman = inputToToman(parseNumericInput(unitCostStr), currency);
  const parsedSellPriceToman = inputToToman(parseNumericInput(sellPriceStr), currency);
  const stockDelta = editingProduct
    ? Math.round((parsedStock - currentStock) * 1000) / 1000
    : 0;

  const purchaseHistory = useMemo(() => {
    if (!editingProduct || !ledger) return null;
    const effectiveSell =
      parsedSellPriceToman > 0 ? parsedSellPriceToman : editingProduct.sellPrice;
    return buildProductPurchaseHistory(
      editingProduct.id,
      effectiveSell,
      ledger.batches,
      ledger.sales
    );
  }, [editingProduct, ledger, parsedSellPriceToman]);

  const effectiveSellPriceToman =
    parsedSellPriceToman > 0
      ? parsedSellPriceToman
      : editingProduct?.sellPrice ?? 0;

  const pendingBatchPreview = useMemo(() => {
    if (!editingProduct || stockDelta <= 0) return null;
    return {
      quantity: stockDelta,
      unitCost: parsedUnitCostToman,
      unitSellPrice: effectiveSellPriceToman,
      label: `بچ ${(purchaseHistory?.totalBatches ?? 0) + 1} · افزایش موجودی`,
    };
  }, [
    editingProduct,
    parsedUnitCostToman,
    effectiveSellPriceToman,
    stockDelta,
    purchaseHistory?.totalBatches,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const resolvedCategory = newCategory.trim() || categorySelect.trim() || 'عمومی';
    const stockVal = parseNumericInput(stockStr);
    const unitCostToman = inputToToman(parseNumericInput(unitCostStr), currency);
    const sellPriceToman = inputToToman(parseNumericInput(sellPriceStr), currency);
    const reorderVal = Math.max(0, parseNumericInput(reorderStr));

    if (!name.trim()) {
      setError('نام کالا الزامی است.');
      return;
    }
    if (!sku.trim()) {
      setError('کد محصول الزامی است.');
      return;
    }
    if (stockStr.trim() === '' || stockVal < 0) {
      setError('موجودی فعلی را به‌درستی وارد کنید.');
      return;
    }
    if (unitCostStr.trim() === '' || unitCostToman < 0) {
      setError('قیمت خرید هر واحد را وارد کنید.');
      return;
    }

    setSaving(true);
    const res = editingProduct
      ? await updateProduct(editingProduct.id, {
          name,
          sku,
          targetStock: stockVal,
          unitCostForPositive: unitCostToman,
          category: resolvedCategory,
          unit,
          sellPrice: sellPriceToman,
          reorderLevel: reorderVal,
          notes,
          adjustmentReason: adjustmentReason.trim() || 'اصلاح موجودی در ویرایش کالا',
        })
      : await addProduct({
          name,
          sku,
          initialStock: stockVal,
          unitCost: unitCostToman,
          category: resolvedCategory,
          unit,
          sellPrice: sellPriceToman,
          reorderLevel: reorderVal,
          notes,
        });
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? 'خطا در ذخیره کالا.');
      return;
    }
    onClose();
  };

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      title={editingProduct ? `ویرایش ${editingProduct.name}` : 'ثبت کالای جدید'}
      subtitle="نام، کد محصول و اطلاعات کادر کهربایی الزامی هستند"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Required Name + SKU */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-name" className="block text-xs font-semibold mb-1.5">
              نام کالا <span className="text-red-600">*</span>
            </label>
            <input
              id="prod-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: کیف دوشی چرم"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>

          <div>
            <label htmlFor="prod-sku" className="block text-xs font-semibold mb-1.5">
              کد محصول <span className="text-red-600">*</span>
            </label>
            <input
              id="prod-sku"
              type="text"
              dir="ltr"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="PRD-105"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm text-left tabular-nums focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>
        </div>

        {/* Amber-framed Current Stock & Unit Buy Cost */}
        <div className="rounded-2xl p-4 bg-amber-500/10 dark:bg-amber-500/12 border border-amber-700/25 dark:border-amber-400/25 space-y-3">
          <p className="text-xs font-bold text-[#7F4A0E] dark:text-amber-300">
            موجودی و بهای خرید اولیه (مبنای محاسبه FIFO)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-stock" className="block text-xs font-semibold mb-1.5">
                موجودی فعلی ({unit}) <span className="text-red-600">*</span>
              </label>
              <input
                id="prod-stock"
                type="text"
                inputMode="decimal"
                dir="ltr"
                required
                value={stockStr}
                onChange={(e) => setStockStr(e.target.value)}
                placeholder="10"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
            </div>

            <div>
              <label htmlFor="prod-unit-cost" className="block text-xs font-semibold mb-1.5">
                قیمت خرید هر واحد ({currencyLabel}) <span className="text-red-600">*</span>
              </label>
              <input
                id="prod-unit-cost"
                type="text"
                inputMode="numeric"
                dir="ltr"
                required
                value={unitCostStr}
                onChange={(e) => setUnitCostStr(e.target.value)}
                placeholder="850000"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
            </div>
          </div>

          {editingProduct && stockDelta !== 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-[#7F4A0E] dark:text-amber-200">
                اختلاف موجودی ({stockDelta > 0 ? `+${formatQty(stockDelta)}` : formatQty(stockDelta)} {unit}) به‌عنوان{' '}
                <strong>اصلاح موجودی</strong> ثبت می‌شود.
              </p>
              <div>
                <label htmlFor="prod-adj-reason" className="block text-xs font-medium mb-1">
                  دلیل اصلاح موجودی (اختیاری)
                </label>
                <input
                  id="prod-adj-reason"
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="مثلاً: انبارگردانی هفتگی"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-xs focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-category" className="block text-xs font-semibold mb-1.5">
              دسته (اختیاری)
            </label>
            <select
              id="prod-category"
              value={categorySelect}
              onChange={(e) => setCategorySelect(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            >
              <option value="">عمومی</option>
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prod-new-category" className="block text-xs font-semibold mb-1.5">
              یا دسته جدید (اختیاری)
            </label>
            <input
              id="prod-new-category"
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="نام دسته جدید..."
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="prod-unit" className="block text-xs font-semibold mb-1.5">
              واحد
            </label>
            <select
              id="prod-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as ProductUnit)}
              className="w-full min-h-[44px] px-3 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prod-sell-price" className="block text-xs font-semibold mb-1.5">
              قیمت فروش ({currencyLabel})
            </label>
            <input
              id="prod-sell-price"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={sellPriceStr}
              onChange={(e) => setSellPriceStr(e.target.value)}
              placeholder="1350000"
              className="w-full min-h-[44px] px-3 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>

          <div>
            <label htmlFor="prod-reorder" className="block text-xs font-semibold mb-1.5">
              حد نصاب سفارش
            </label>
            <input
              id="prod-reorder"
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={reorderStr}
              onChange={(e) => setReorderStr(e.target.value)}
              placeholder="3"
              className="w-full min-h-[44px] px-3 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="prod-notes" className="block text-xs font-semibold mb-1.5">
            یادداشت (اختیاری)
          </label>
          <textarea
            id="prod-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="توضیحات، رنگ‌بندی، سایز یا برند..."
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
          />
        </div>

        {/* Batch Purchase History Table — directly beneath product input fields (edit mode only) */}
        {editingProduct && (
          <div
            aria-label="بخش تاریخچه بچ‌های خرید کالا"
            className="pt-2 space-y-4"
          >
            <PurchaseHistoryTable
              history={purchaseHistory}
              unit={unit}
              currency={currency}
              pendingBatch={pendingBatchPreview}
            />

            {purchaseHistory && purchaseHistory.totalBatches > 0 && (
              <PurchasePriceHistoryPanel
                history={purchaseHistory}
                unit={unit}
                currency={currency}
                showBatchCards={false}
              />
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[46px] rounded-2xl mizan-btn-primary disabled:opacity-50 text-sm font-bold cursor-pointer"
          >
            {saving ? 'در حال ذخیره...' : editingProduct ? 'ذخیره تغییرات کالا' : 'ثبت کالا در انبار'}
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
    </ModalFrame>
  );
}
