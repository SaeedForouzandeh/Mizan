import type {
  BatchMarginBadgeInfo,
  BatchProfitInfo,
  ConsumedBatchRef,
  Product,
  ProductMetrics,
  ProductPurchaseHistory,
  PurchaseBatch,
  PurchaseHistoryEntry,
  Sale,
  StockStatus,
} from '../types/mizan';

const EPSILON = 1e-6;

/**
 * Returns active purchase batches for a product sorted strictly oldest-first (FIFO).
 */
export function getOrderedBatches(productId: string, batches: PurchaseBatch[]): PurchaseBatch[] {
  return batches
    .filter((b) => b.productId === productId && b.remainingQty > EPSILON)
    .sort((a, b) => a.purchasedAt - b.purchasedAt || a.id.localeCompare(b.id));
}

export function getBatchSellPrice(batch: PurchaseBatch, fallbackSellPrice: number): number {
  if (typeof batch.unitSellPrice === 'number' && Number.isFinite(batch.unitSellPrice) && batch.unitSellPrice >= 0) {
    return Math.round(batch.unitSellPrice);
  }
  return Math.max(0, Math.round(fallbackSellPrice));
}

export function getBatchProfitInfo(
  batch: PurchaseBatch,
  fallbackSellPrice: number
): BatchProfitInfo {
  const unitSellPrice = getBatchSellPrice(batch, fallbackSellPrice);
  const unitProfit = unitSellPrice - Math.round(batch.unitCost);
  const marginPercent =
    unitSellPrice > 0 ? Math.round((unitProfit / unitSellPrice) * 1000) / 10 : 0;
  const remainingRevenue = Math.round(batch.remainingQty * unitSellPrice);
  const remainingProfit = Math.round(batch.remainingQty * unitProfit);

  return {
    batch,
    unitSellPrice,
    unitProfit,
    marginPercent,
    remainingProfit,
    remainingRevenue,
  };
}

export function getProductStock(productId: string, batches: PurchaseBatch[]): number {
  const total = batches
    .filter((b) => b.productId === productId && b.remainingQty > EPSILON)
    .reduce((sum, b) => sum + b.remainingQty, 0);
  return Math.round(total * 1000) / 1000;
}

export function getProductInventoryValue(productId: string, batches: PurchaseBatch[]): number {
  const value = batches
    .filter((b) => b.productId === productId && b.remainingQty > EPSILON)
    .reduce((sum, b) => sum + b.remainingQty * b.unitCost, 0);
  return Math.round(value);
}

/**
 * Weighted average buy cost across remaining stock; falls back to the latest batch cost if out of stock.
 */
export function getProductAvgCost(productId: string, batches: PurchaseBatch[]): number {
  const active = getOrderedBatches(productId, batches);
  const stock = active.reduce((sum, b) => sum + b.remainingQty, 0);
  if (stock > EPSILON) {
    const totalCost = active.reduce((sum, b) => sum + b.remainingQty * b.unitCost, 0);
    return Math.round(totalCost / stock);
  }
  const latest = batches
    .filter((b) => b.productId === productId)
    .sort((a, b) => b.purchasedAt - a.purchasedAt)[0];
  return latest ? Math.round(latest.unitCost) : 0;
}

export function getStockStatus(stock: number, reorderLevel: number): StockStatus {
  if (stock <= EPSILON) return 'out_of_stock';
  if (reorderLevel > 0 && stock <= reorderLevel + EPSILON) return 'low_stock';
  return 'in_stock';
}

export function computeProductMetrics(
  product: Product,
  batches: PurchaseBatch[]
): ProductMetrics {
  const activeBatches = getOrderedBatches(product.id, batches);
  const currentStock = getProductStock(product.id, batches);
  const avgBuyCost = getProductAvgCost(product.id, batches);
  const inventoryValue = getProductInventoryValue(product.id, batches);
  const status = getStockStatus(currentStock, product.reorderLevel);

  const batchProfits = activeBatches.map((b) => getBatchProfitInfo(b, product.sellPrice));
  const expectedProfit = batchProfits.reduce((sum, bp) => sum + bp.remainingProfit, 0);
  const avgSellPrice =
    currentStock > EPSILON
      ? Math.round(
          batchProfits.reduce((sum, bp) => sum + bp.remainingRevenue, 0) / currentStock
        )
      : product.sellPrice;

  const uniqueCostSet = new Set(activeBatches.map((b) => Math.round(b.unitCost)));
  const uniqueSellSet = new Set(batchProfits.map((bp) => bp.unitSellPrice));
  const hasMixedBatchPrices =
    activeBatches.length > 1 && (uniqueCostSet.size > 1 || uniqueSellSet.size > 1);

  return {
    product,
    currentStock,
    avgBuyCost,
    avgSellPrice,
    inventoryValue,
    expectedProfit,
    hasMixedBatchPrices,
    status,
    activeBatches,
    batchProfits,
  };
}

export interface FifoSaleOptions {
  /**
   * When true, uses each consumed batch's own `unitSellPrice` (falling back to `unitPrice`).
   * Allows a single product with 2 batches at different buy & sell prices to price each batch accurately.
   */
  useBatchSellPrices?: boolean;
  /**
   * Optional specific batch ID to sell strictly from that batch (e.g. choosing Batch 1 vs Batch 2).
   */
  targetBatchId?: string;
}

export interface FifoSaleSimulation {
  ok: true;
  effectiveUnitPrice: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  consumedBatches: ConsumedBatchRef[];
  updatedBatches: PurchaseBatch[];
  touchedBatchUpdates: Array<{ batchId: string; newRemainingQty: number }>;
}

export interface FifoSaleError {
  ok: false;
  error: string;
  availableStock: number;
}

/**
 * Simulates and computes a FIFO sale (or specific-batch sale).
 * Deducts strictly from oldest purchase batches first (or the chosen batch),
 * supporting both uniform manual price and per-batch distinct sell prices.
 * Refuses to sell more than available stock.
 */
export function simulateFifoSale(
  productId: string,
  quantity: number,
  unitPrice: number,
  batches: PurchaseBatch[],
  options: FifoSaleOptions = {}
): FifoSaleSimulation | FifoSaleError {
  const { useBatchSellPrices = false, targetBatchId } = options;

  const candidateBatches = targetBatchId
    ? batches.filter(
        (b) => b.id === targetBatchId && b.productId === productId && b.remainingQty > EPSILON
      )
    : getOrderedBatches(productId, batches);

  const availableStock = Math.round(
    candidateBatches.reduce((sum, b) => sum + b.remainingQty, 0) * 1000
  ) / 1000;

  if (!Number.isFinite(quantity) || quantity <= EPSILON) {
    return {
      ok: false,
      error: 'تعداد فروش باید بیشتر از صفر باشد.',
      availableStock,
    };
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return {
      ok: false,
      error: 'قیمت فروش نامعتبر است.',
      availableStock,
    };
  }

  if (quantity > availableStock + EPSILON) {
    return {
      ok: false,
      error: targetBatchId
        ? `موجودی این سری کافی نیست. حداکثر ${availableStock} موجود است.`
        : `موجودی کافی نیست. حداکثر موجودی قابل فروش ${availableStock} است.`,
      availableStock,
    };
  }

  let remainingToConsume = quantity;
  const consumedBatches: ConsumedBatchRef[] = [];
  const touchedMap = new Map<string, number>();

  for (const batch of candidateBatches) {
    if (remainingToConsume <= EPSILON) break;
    const take = Math.min(batch.remainingQty, remainingToConsume);
    const roundedTake = Math.round(take * 1000) / 1000;
    const newRemaining = Math.max(0, Math.round((batch.remainingQty - roundedTake) * 1000) / 1000);
    const appliedSellPrice = useBatchSellPrices
      ? getBatchSellPrice(batch, unitPrice)
      : Math.round(unitPrice);

    consumedBatches.push({
      batchId: batch.id,
      qty: roundedTake,
      unitCost: batch.unitCost,
      unitSellPrice: appliedSellPrice,
    });
    touchedMap.set(batch.id, newRemaining);
    remainingToConsume = Math.max(0, Math.round((remainingToConsume - roundedTake) * 1000) / 1000);
  }

  const revenue = Math.round(
    consumedBatches.reduce(
      (sum, item) => sum + item.qty * (item.unitSellPrice ?? unitPrice),
      0
    )
  );
  const cogs = Math.round(
    consumedBatches.reduce((sum, item) => sum + item.qty * item.unitCost, 0)
  );
  const profit = revenue - cogs;
  const marginPercent = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
  const effectiveUnitPrice = quantity > EPSILON ? Math.round(revenue / quantity) : Math.round(unitPrice);

  const updatedBatches = batches.map((b) => {
    if (!touchedMap.has(b.id)) return b;
    return {
      ...b,
      remainingQty: touchedMap.get(b.id)!,
    };
  });

  const touchedBatchUpdates = Array.from(touchedMap.entries()).map(([batchId, newRemainingQty]) => ({
    batchId,
    newRemainingQty,
  }));

  return {
    ok: true,
    effectiveUnitPrice,
    revenue,
    cogs,
    profit,
    marginPercent,
    consumedBatches,
    updatedBatches,
    touchedBatchUpdates,
  };
}

/**
 * Restores exact FIFO batch quantities when a sale is voided.
 */
export function restoreVoidedSaleBatches(
  sale: Sale,
  batches: PurchaseBatch[]
): {
  updatedBatches: PurchaseBatch[];
  touchedBatchUpdates: Array<{ batchId: string; newRemainingQty: number }>;
} {
  const restoreByBatch = new Map<string, number>();
  for (const item of sale.consumedBatches) {
    restoreByBatch.set(item.batchId, (restoreByBatch.get(item.batchId) ?? 0) + item.qty);
  }

  const touchedBatchUpdates: Array<{ batchId: string; newRemainingQty: number }> = [];

  const updatedBatches = batches.map((b) => {
    const addBack = restoreByBatch.get(b.id);
    if (!addBack) return b;
    const restored = Math.min(
      b.initialQty,
      Math.round((b.remainingQty + addBack) * 1000) / 1000
    );
    touchedBatchUpdates.push({ batchId: b.id, newRemainingQty: restored });
    return {
      ...b,
      remainingQty: restored,
    };
  });

  return { updatedBatches, touchedBatchUpdates };
}

export interface StockAdjustmentPlan {
  delta: number;
  newBatch?: Omit<PurchaseBatch, 'id' | 'ownerId'>;
  touchedBatchUpdates: Array<{ batchId: string; newRemainingQty: number }>;
  updatedBatches: PurchaseBatch[];
}

/**
 * Computes FIFO batch mutations when inventory is adjusted directly (e.g., via edit form or adjustment modal).
 */
export function computeStockAdjustmentPlan(
  productId: string,
  targetStock: number,
  unitCostForPositive: number,
  batches: PurchaseBatch[],
  reason: string,
  nowMs: number,
  unitSellPriceForPositive?: number
): StockAdjustmentPlan {
  const safeTarget = Math.max(0, Math.round(targetStock * 1000) / 1000);
  const currentStock = getProductStock(productId, batches);
  const delta = Math.round((safeTarget - currentStock) * 1000) / 1000;

  if (Math.abs(delta) <= EPSILON) {
    return {
      delta: 0,
      touchedBatchUpdates: [],
      updatedBatches: batches,
    };
  }

  if (delta > 0) {
    return {
      delta,
      newBatch: {
        productId,
        initialQty: delta,
        remainingQty: delta,
        unitCost: Math.max(0, Math.round(unitCostForPositive)),
        ...(typeof unitSellPriceForPositive === 'number'
          ? { unitSellPrice: Math.max(0, Math.round(unitSellPriceForPositive)) }
          : {}),
        source: 'adjustment',
        supplierName: '',
        note: reason || 'اصلاح موجودی انبار',
        purchasedAt: nowMs,
      },
      touchedBatchUpdates: [],
      updatedBatches: batches,
    };
  }

  // Negative adjustment: deduct FIFO from oldest active batches
  let toDeduct = Math.abs(delta);
  const ordered = getOrderedBatches(productId, batches);
  const touchedMap = new Map<string, number>();

  for (const b of ordered) {
    if (toDeduct <= EPSILON) break;
    const take = Math.min(b.remainingQty, toDeduct);
    const newRemaining = Math.max(0, Math.round((b.remainingQty - take) * 1000) / 1000);
    touchedMap.set(b.id, newRemaining);
    toDeduct = Math.max(0, Math.round((toDeduct - take) * 1000) / 1000);
  }

  const updatedBatches = batches.map((b) =>
    touchedMap.has(b.id) ? { ...b, remainingQty: touchedMap.get(b.id)! } : b
  );

  const touchedBatchUpdates = Array.from(touchedMap.entries()).map(([batchId, newRemainingQty]) => ({
    batchId,
    newRemainingQty,
  }));

  return {
    delta,
    touchedBatchUpdates,
    updatedBatches,
  };
}

/**
 * Builds chronological purchase price history and per-batch gross profit impact
 * (combining realized gross profit from completed sales + projected gross profit from remaining stock).
 */
export function buildProductPurchaseHistory(
  productId: string,
  fallbackSellPrice: number,
  batches: PurchaseBatch[],
  sales: Sale[]
): ProductPurchaseHistory {
  const productBatches = batches
    .filter((b) => b.productId === productId)
    .sort((a, b) => a.purchasedAt - b.purchasedAt || a.id.localeCompare(b.id));

  if (productBatches.length === 0) {
    return {
      entries: [],
      totalBatches: 0,
      activeBatchesCount: 0,
      minUnitCost: 0,
      maxUnitCost: 0,
      weightedAvgCost: 0,
      firstToLatestCostChange: null,
      firstToLatestCostChangePercent: null,
      totalRealizedGrossProfit: 0,
      totalProjectedGrossProfit: 0,
      totalCombinedGrossProfit: 0,
      overallGrossMarginPercent: 0,
    };
  }

  // Aggregate realized sales per batch (strictly excluding voided sales)
  const realizedByBatch = new Map<
    string,
    { qty: number; revenue: number; cogs: number; salesCount: number }
  >();

  for (const sale of sales) {
    if (sale.status === 'voided' || sale.productId !== productId) continue;
    for (const ref of sale.consumedBatches) {
      const prev = realizedByBatch.get(ref.batchId) ?? {
        qty: 0,
        revenue: 0,
        cogs: 0,
        salesCount: 0,
      };
      const appliedSell =
        typeof ref.unitSellPrice === 'number' && Number.isFinite(ref.unitSellPrice)
          ? ref.unitSellPrice
          : sale.unitPrice;
      realizedByBatch.set(ref.batchId, {
        qty: Math.round((prev.qty + ref.qty) * 1000) / 1000,
        revenue: prev.revenue + Math.round(ref.qty * appliedSell),
        cogs: prev.cogs + Math.round(ref.qty * ref.unitCost),
        salesCount: prev.salesCount + 1,
      });
    }
  }

  let totalInitialQty = 0;
  let totalInitialCost = 0;
  let totalRealizedRevenue = 0;
  let totalRealizedGrossProfit = 0;
  let totalProjectedGrossProfit = 0;
  let totalProjectedRevenue = 0;

  const rawEntries: Omit<PurchaseHistoryEntry, 'grossProfitSharePercent'>[] = productBatches.map(
    (batch, idx) => {
      const unitCost = Math.round(batch.unitCost);
      const unitSellPrice = getBatchSellPrice(batch, fallbackSellPrice);
      const prevBatch = idx > 0 ? productBatches[idx - 1] : null;
      const costDeltaFromPrev = prevBatch ? unitCost - Math.round(prevBatch.unitCost) : null;
      const costDeltaPercent =
        prevBatch && prevBatch.unitCost > 0
          ? Math.round(((unitCost - prevBatch.unitCost) / prevBatch.unitCost) * 1000) / 10
          : null;

      const unitGrossProfit = unitSellPrice - unitCost;
      const unitMarginPercent =
        unitSellPrice > 0 ? Math.round((unitGrossProfit / unitSellPrice) * 1000) / 10 : 0;

      const realized = realizedByBatch.get(batch.id) ?? {
        qty: 0,
        revenue: 0,
        cogs: 0,
        salesCount: 0,
      };
      const realizedGrossProfit = realized.revenue - realized.cogs;
      const projectedRemainingRevenue = Math.round(batch.remainingQty * unitSellPrice);
      const projectedRemainingProfit = Math.round(batch.remainingQty * unitGrossProfit);
      const totalGrossProfitImpact = realizedGrossProfit + projectedRemainingProfit;

      totalInitialQty += batch.initialQty;
      totalInitialCost += batch.initialQty * unitCost;
      totalRealizedRevenue += realized.revenue;
      totalRealizedGrossProfit += realizedGrossProfit;
      totalProjectedRevenue += projectedRemainingRevenue;
      totalProjectedGrossProfit += projectedRemainingProfit;

      return {
        batch,
        batchIndex: idx + 1,
        status: batch.remainingQty > EPSILON ? 'active' : 'depleted',
        unitCost,
        unitSellPrice,
        costDeltaFromPrev,
        costDeltaPercent,
        unitGrossProfit,
        unitMarginPercent,
        realizedSoldQty: realized.qty,
        realizedRevenue: realized.revenue,
        realizedCogs: realized.cogs,
        realizedGrossProfit,
        salesCount: realized.salesCount,
        projectedRemainingRevenue,
        projectedRemainingProfit,
        totalGrossProfitImpact,
      };
    }
  );

  const totalAbsImpact = rawEntries.reduce(
    (sum, item) => sum + Math.max(0, item.totalGrossProfitImpact),
    0
  );

  const entries: PurchaseHistoryEntry[] = rawEntries.map((item) => ({
    ...item,
    grossProfitSharePercent:
      totalAbsImpact > 0 && item.totalGrossProfitImpact > 0
        ? Math.round((item.totalGrossProfitImpact / totalAbsImpact) * 1000) / 10
        : 0,
  }));

  const costs = entries.map((e) => e.unitCost);
  const minUnitCost = Math.min(...costs);
  const maxUnitCost = Math.max(...costs);
  const weightedAvgCost =
    totalInitialQty > EPSILON ? Math.round(totalInitialCost / totalInitialQty) : entries[0].unitCost;

  const firstCost = entries[0].unitCost;
  const latestCost = entries[entries.length - 1].unitCost;
  const firstToLatestCostChange = entries.length > 1 ? latestCost - firstCost : null;
  const firstToLatestCostChangePercent =
    entries.length > 1 && firstCost > 0
      ? Math.round(((latestCost - firstCost) / firstCost) * 1000) / 10
      : null;

  const totalCombinedGrossProfit = totalRealizedGrossProfit + totalProjectedGrossProfit;
  const totalCombinedRevenue = totalRealizedRevenue + totalProjectedRevenue;
  const overallGrossMarginPercent =
    totalCombinedRevenue > 0
      ? Math.round((totalCombinedGrossProfit / totalCombinedRevenue) * 1000) / 10
      : 0;

  return {
    entries,
    totalBatches: entries.length,
    activeBatchesCount: entries.filter((e) => e.status === 'active').length,
    minUnitCost,
    maxUnitCost,
    weightedAvgCost,
    firstToLatestCostChange,
    firstToLatestCostChangePercent,
    totalRealizedGrossProfit,
    totalProjectedGrossProfit,
    totalCombinedGrossProfit,
    overallGrossMarginPercent,
  };
}

/**
 * Classifies a purchase batch's profit-margin contribution relative to sibling batches
 * and absolute margin health so users immediately spot the most cost-effective shipments.
 */
export function getBatchMarginContribution(
  unitMarginPercent: number,
  siblingMargins: number[] = []
): BatchMarginBadgeInfo {
  if (!Number.isFinite(unitMarginPercent) || unitMarginPercent <= 0) {
    return { tier: 'loss', label: 'زیان‌ده' };
  }
  if (unitMarginPercent < 20) {
    return { tier: 'low', label: 'حاشیه کم' };
  }

  const validSiblings = siblingMargins.filter((m) => Number.isFinite(m));
  if (validSiblings.length >= 2) {
    const maxMargin = Math.max(...validSiblings);
    const minMargin = Math.min(...validSiblings);
    const spread = maxMargin - minMargin;

    if (spread >= 1) {
      if (unitMarginPercent >= maxMargin - 0.05) {
        return { tier: 'best', label: 'به‌صرفه‌ترین' };
      }
      if (unitMarginPercent <= minMargin + 0.05 && maxMargin - unitMarginPercent >= 2) {
        return { tier: 'moderate', label: 'حاشیه کمتر' };
      }
      if (unitMarginPercent >= 35) {
        return { tier: 'strong', label: 'سود خوب' };
      }
      return { tier: 'moderate', label: 'متعادل' };
    }
  }

  if (unitMarginPercent >= 35) {
    return { tier: 'strong', label: 'سود بالا' };
  }
  return { tier: 'moderate', label: 'متعادل' };
}
