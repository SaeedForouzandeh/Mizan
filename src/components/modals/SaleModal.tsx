import React, { useEffect, useMemo, useState } from 'react';
import { useLedger } from '../../context/LedgerContext';
import {
  getDefaultCustomerNameForChannel,
  SALE_CHANNELS,
  type SaleChannel,
} from '../../types/mizan';
import {
  computeProductMetrics,
  getBatchSellPrice,
  getProductStock,
  simulateFifoSale,
} from '../../utils/fifo';
import {
  formatMoney,
  formatPercent,
  formatQty,
  inputToToman,
  parseNumericInput,
  tomanToDisplayNumber,
} from '../../utils/formatters';
import { ModalFrame } from './ModalFrame';

interface SaleModalProps {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
  defaultBatchId?: string;
}

export function SaleModal({
  open,
  onClose,
  defaultProductId,
  defaultBatchId,
}: SaleModalProps) {
  const { ledger, recordSale } = useLedger();
  const currency = ledger?.profile.currency ?? 'toman';
  const currencyLabel = currency === 'toman' ? 'تومان' : 'ریال';

  const products = ledger?.products ?? [];
  const batches = ledger?.batches ?? [];
  const customers = useMemo(
    () => (ledger?.contacts ?? []).filter((c) => c.type === 'customer'),
    [ledger?.contacts]
  );

  const [productId, setProductId] = useState('');
  const [targetBatchId, setTargetBatchId] = useState<string>('');
  const [useBatchSellPrices, setUseBatchSellPrices] = useState(true);
  const [qtyStr, setQtyStr] = useState('1');
  const [unitPriceStr, setUnitPriceStr] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [guestCustomerName, setGuestCustomerName] = useState('');
  const [channel, setChannel] = useState<SaleChannel>('آنلاین');
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const selectedMetrics = useMemo(
    () => (selectedProduct ? computeProductMetrics(selectedProduct, batches) : null),
    [selectedProduct, batches]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    const initialProd =
      products.find((p) => p.id === defaultProductId) ??
      products.find((p) => getProductStock(p.id, batches) > 0) ??
      products[0] ??
      null;

    if (initialProd) {
      setProductId(initialProd.id);
      const metrics = computeProductMetrics(initialProd, batches);
      const matchedBatch = defaultBatchId
        ? metrics.activeBatches.find((b) => b.id === defaultBatchId)
        : undefined;

      if (matchedBatch) {
        setTargetBatchId(matchedBatch.id);
        setUseBatchSellPrices(false);
        const batchSell = getBatchSellPrice(matchedBatch, initialProd.sellPrice);
        setUnitPriceStr(String(tomanToDisplayNumber(batchSell, currency)));
      } else {
        setTargetBatchId('');
        const hasDiffSell =
          new Set(metrics.batchProfits.map((bp) => bp.unitSellPrice)).size > 1;
        setUseBatchSellPrices(hasDiffSell);
        const firstBatchSell = metrics.batchProfits[0]?.unitSellPrice ?? initialProd.sellPrice;
        setUnitPriceStr(String(tomanToDisplayNumber(firstBatchSell, currency)));
      }
    } else {
      setProductId('');
      setTargetBatchId('');
      setUseBatchSellPrices(false);
      setUnitPriceStr('');
    }
    setQtyStr('1');
    setCustomerId('');
    setGuestCustomerName('');
    setChannel(ledger?.profile.businessType === 'online' ? 'آنلاین' : 'حضوری');
  }, [open, defaultProductId, defaultBatchId, products, batches, currency, ledger?.profile.businessType]);

  const handleProductChange = (nextId: string) => {
    setProductId(nextId);
    setTargetBatchId('');
    setError(null);
    const prod = products.find((p) => p.id === nextId);
    if (prod) {
      const metrics = computeProductMetrics(prod, batches);
      const hasDiffSell =
        new Set(metrics.batchProfits.map((bp) => bp.unitSellPrice)).size > 1;
      setUseBatchSellPrices(hasDiffSell);
      const firstSell = metrics.batchProfits[0]?.unitSellPrice ?? prod.sellPrice;
      setUnitPriceStr(String(tomanToDisplayNumber(firstSell, currency)));
    }
  };

  const handleBatchChange = (nextBatchId: string) => {
    setTargetBatchId(nextBatchId);
    setError(null);
    if (!selectedProduct || !selectedMetrics) return;
    if (nextBatchId) {
      const chosen = selectedMetrics.activeBatches.find((b) => b.id === nextBatchId);
      if (chosen) {
        const sell = getBatchSellPrice(chosen, selectedProduct.sellPrice);
        setUseBatchSellPrices(false);
        setUnitPriceStr(String(tomanToDisplayNumber(sell, currency)));
      }
    } else {
      const hasDiffSell =
        new Set(selectedMetrics.batchProfits.map((bp) => bp.unitSellPrice)).size > 1;
      setUseBatchSellPrices(hasDiffSell);
      const firstSell = selectedMetrics.batchProfits[0]?.unitSellPrice ?? selectedProduct.sellPrice;
      setUnitPriceStr(String(tomanToDisplayNumber(firstSell, currency)));
    }
  };

  const activeBatches = selectedMetrics?.activeBatches ?? [];
  const batchProfits = selectedMetrics?.batchProfits ?? [];
  const hasMultipleBatches = activeBatches.length > 1;
  const hasDistinctSellPrices =
    new Set(batchProfits.map((bp) => bp.unitSellPrice)).size > 1;

  const qty = parseNumericInput(qtyStr);
  const unitPriceToman = inputToToman(parseNumericInput(unitPriceStr), currency);
  const effectiveUseBatchSell = !targetBatchId && hasDistinctSellPrices && useBatchSellPrices;

  const availableStock = targetBatchId
    ? activeBatches.find((b) => b.id === targetBatchId)?.remainingQty ?? 0
    : selectedProduct
      ? getProductStock(selectedProduct.id, batches)
      : 0;

  const fifoPreview = useMemo(() => {
    if (!selectedProduct) return null;
    return simulateFifoSale(selectedProduct.id, qty, unitPriceToman, batches, {
      useBatchSellPrices: effectiveUseBatchSell,
      targetBatchId: targetBatchId || undefined,
    });
  }, [selectedProduct, qty, unitPriceToman, batches, effectiveUseBatchSell, targetBatchId]);

  const batchIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    activeBatches.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [activeBatches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedProduct) {
      setError('لطفاً ابتدا یک کالا انتخاب کنید.');
      return;
    }
    if (!fifoPreview || !fifoPreview.ok) {
      setError(fifoPreview && !fifoPreview.ok ? fifoPreview.error : 'اطلاعات فروش کامل نیست.');
      return;
    }

    const matchedCustomer = customers.find((c) => c.id === customerId);
    const resolvedCustomerName =
      matchedCustomer?.name ??
      (guestCustomerName.trim() || getDefaultCustomerNameForChannel(channel));
    const res = recordSale({
      productId: selectedProduct.id,
      quantity: qty,
      unitPrice: unitPriceToman,
      useBatchSellPrices: effectiveUseBatchSell,
      targetBatchId: targetBatchId || undefined,
      channel,
      customerId: matchedCustomer?.id ?? '',
      customerName: resolvedCustomerName,
    });

    if (!res.ok) {
      setError(res.error ?? 'خطا در ثبت فروش.');
      return;
    }
    onClose();
  };

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      title="ثبت فروش جدید"
      subtitle="محاسبه خودکار سود بر اساس قیمت خرید و فروش هر سری"
    >
      {products.length === 0 ? (
        <p className="text-sm text-[#6E5643] dark:text-[#B8A593] py-4">
          هنوز کالایی در انبار ثبت نشده است. ابتدا یک کالا به انبار اضافه کنید.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="sale-product" className="block text-xs font-semibold mb-1.5">
              کالا
            </label>
            <select
              id="sale-product"
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full min-h-[46px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            >
              {products.map((p) => {
                const st = getProductStock(p.id, batches);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} — موجود: {formatQty(st)} {p.unit}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Multi-batch selector when product has 2+ active batches */}
          {hasMultipleBatches && (
            <div className="rounded-2xl p-3 bg-amber-500/8 border border-amber-700/18 space-y-2.5">
              <div>
                <label htmlFor="sale-batch-source" className="block text-xs font-semibold mb-1">
                  انتخاب سری موجودی ({batchProfits.length} سری فعال)
                </label>
                <select
                  id="sale-batch-source"
                  value={targetBatchId}
                  onChange={(e) => handleBatchChange(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/90 dark:bg-[#1A1511] border border-amber-800/20 text-xs focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
                >
                  <option value="">خودکار (قدیمی‌ترین سری اول · FIFO)</option>
                  {batchProfits.map((bp, i) => (
                    <option key={bp.batch.id} value={bp.batch.id}>
                      سری {i + 1} · موجود {formatQty(bp.batch.remainingQty)} · خرید{' '}
                      {formatMoney(bp.batch.unitCost, currency)} · فروش{' '}
                      {formatMoney(bp.unitSellPrice, currency)}
                    </option>
                  ))}
                </select>
              </div>

              {!targetBatchId && hasDistinctSellPrices && (
                <div
                  role="group"
                  aria-label="نحوه قیمت‌گذاری فروش"
                  className="grid grid-cols-2 gap-1.5"
                >
                  <button
                    type="button"
                    onClick={() => setUseBatchSellPrices(true)}
                    aria-pressed={useBatchSellPrices}
                    className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      useBatchSellPrices
                        ? 'bg-[#9A5B13] text-white'
                        : 'bg-white/75 dark:bg-[#1A1511] text-[#6E5643] dark:text-[#B8A593]'
                    }`}
                  >
                    نرخ فروش هر سری
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseBatchSellPrices(false)}
                    aria-pressed={!useBatchSellPrices}
                    className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      !useBatchSellPrices
                        ? 'bg-[#9A5B13] text-white'
                        : 'bg-white/75 dark:bg-[#1A1511] text-[#6E5643] dark:text-[#B8A593]'
                    }`}
                  >
                    قیمت فروش دستی
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sale-qty" className="block text-xs font-semibold mb-1.5">
                تعداد ({selectedProduct?.unit ?? 'واحد'}) · موجود: {formatQty(availableStock)}
              </label>
              <input
                id="sale-qty"
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={qtyStr}
                onChange={(e) => {
                  setQtyStr(e.target.value);
                  setError(null);
                }}
                placeholder="1"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
            </div>

            {effectiveUseBatchSell ? (
              <div>
                <span className="block text-xs font-semibold mb-1.5">
                  قیمت فروش (بر اساس هر سری)
                </span>
                <div className="w-full min-h-[44px] px-3.5 rounded-2xl bg-emerald-500/8 border border-emerald-700/20 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between tabular-nums">
                  <span>میانگین:</span>
                  <span>
                    {fifoPreview?.ok
                      ? formatMoney(fifoPreview.effectiveUnitPrice, currency)
                      : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="sale-price" className="block text-xs font-semibold mb-1.5">
                  قیمت فروش هر واحد ({currencyLabel})
                </label>
                <input
                  id="sale-price"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={unitPriceStr}
                  onChange={(e) => setUnitPriceStr(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sale-channel" className="block text-xs font-semibold mb-1.5">
                کانال فروش / سفارش
              </label>
              <select
                id="sale-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as SaleChannel)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              >
                {SALE_CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sale-customer" className="block text-xs font-semibold mb-1.5">
                مشتری (اختیاری)
              </label>
              <select
                id="sale-customer"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  if (e.target.value) setGuestCustomerName('');
                }}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              >
                <option value="">{getDefaultCustomerNameForChannel(channel)} (ثبت سریع)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.handle ? ` (${c.handle})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!customerId && (
            <div>
              <label htmlFor="sale-guest-customer" className="block text-xs font-semibold mb-1.5">
                نام مشتری، آیدی یا کد سفارش (اختیاری)
              </label>
              <input
                id="sale-guest-customer"
                type="text"
                value={guestCustomerName}
                onChange={(e) => setGuestCustomerName(e.target.value)}
                placeholder="مثلاً: سفارش #1042 یا @sara_shop"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/80 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
              />
            </div>
          )}

          {/* Live FIFO Breakdown (with per-batch lines when spanning batches) */}
          {fifoPreview && fifoPreview.ok ? (
            <div className="rounded-2xl p-4 bg-emerald-500/8 dark:bg-emerald-500/12 border border-emerald-700/20 space-y-2.5">
              {fifoPreview.consumedBatches.length > 0 && (
                <div className="space-y-1.5 pb-2 border-b border-emerald-700/15">
                  <p className="text-[11px] font-bold text-[#6E5643] dark:text-[#B8A593]">
                    تفکیک سود به تفکیک سری ({fifoPreview.consumedBatches.length} سری):
                  </p>
                  {fifoPreview.consumedBatches.map((item) => {
                    const sell = item.unitSellPrice ?? unitPriceToman;
                    const batchProfit = Math.round(item.qty * (sell - item.unitCost));
                    const idx = batchIndexMap.get(item.batchId) ?? 1;
                    return (
                      <div
                        key={item.batchId}
                        className="rounded-xl px-2.5 py-1.5 bg-white/55 dark:bg-[#1A1511]/60 space-y-0.5 text-[11px] tabular-nums"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#261B12] dark:text-[#F5EFE6]">
                            سری {idx} · {formatQty(item.qty)} {selectedProduct?.unit}
                          </span>
                          <strong
                            className={`shrink-0 ${
                              batchProfit >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            سود {formatMoney(batchProfit, currency)}
                          </strong>
                        </div>
                        <p className="text-[#6E5643] dark:text-[#B8A593]">
                          خرید {formatMoney(item.unitCost, currency)} ← فروش{' '}
                          {formatMoney(sell, currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E5643] dark:text-[#B8A593]">درآمد کل فروش</span>
                <strong className="tabular-nums">{formatMoney(fifoPreview.revenue, currency)}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6E5643] dark:text-[#B8A593]">بهای تمام‌شده واقعی</span>
                <strong className="tabular-nums">{formatMoney(fifoPreview.cogs, currency)}</strong>
              </div>
              <div className="pt-2 border-t border-emerald-700/15 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  سود خالص و حاشیه
                </span>
                <span
                  className={`tabular-nums text-sm font-extrabold ${
                    fifoPreview.profit >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {formatMoney(fifoPreview.profit, currency)} ·{' '}
                  {formatPercent(fifoPreview.marginPercent)}
                </span>
              </div>
            </div>
          ) : (
            fifoPreview && (
              <div
                role="alert"
                className="rounded-2xl p-3.5 bg-red-500/10 border border-red-600/25 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {fifoPreview.error}
              </div>
            )
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={!fifoPreview?.ok}
              className="flex-1 min-h-[46px] rounded-2xl mizan-btn-primary disabled:opacity-50 text-sm font-bold cursor-pointer"
            >
              تأیید و ثبت فروش
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
