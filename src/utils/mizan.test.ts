import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductPurchaseHistory,
  computeStockAdjustmentPlan,
  getBatchMarginContribution,
  getProductAvgCost,
  getProductStock,
  getStockStatus,
  restoreVoidedSaleBatches,
  simulateFifoSale,
} from './fifo';
import {
  formatMoney,
  getGreetingByHour,
  inputToToman,
  normalizeDigits,
  normalizeStoreName,
  parseNumericInput,
} from './formatters';
import {
  computeDashboardSummary,
  computeProfitAnalytics,
  filterSalesByRange,
  MS_PER_DAY,
  summarizeSales,
} from './analytics';
import {
  getDefaultCustomerNameForChannel,
  type LedgerState,
  type Product,
  type PurchaseBatch,
  type Sale,
} from '../types/mizan';

const baseProduct: Product = {
  id: 'p1',
  ownerId: 'u1',
  name: 'دانه قهوه',
  sku: 'COF-1',
  category: 'قهوه',
  unit: 'کیلو',
  sellPrice: 1500000,
  reorderLevel: 3,
  notes: '',
  createdAtMs: 1000,
};

const twoBatches: PurchaseBatch[] = [
  {
    id: 'b_old',
    ownerId: 'u1',
    productId: 'p1',
    initialQty: 5,
    remainingQty: 3,
    unitCost: 800000,
    source: 'initial',
    supplierName: '',
    note: '',
    purchasedAt: 1000,
  },
  {
    id: 'b_new',
    ownerId: 'u1',
    productId: 'p1',
    initialQty: 4,
    remainingQty: 4,
    unitCost: 1000000,
    source: 'restock',
    supplierName: '',
    note: '',
    purchasedAt: 2000,
  },
];

test('FIFO consumes oldest purchase batch first and computes exact COGS, profit, and margin', () => {
  const res = simulateFifoSale('p1', 5, 1500000, twoBatches);
  assert.equal(res.ok, true);
  if (res.ok) {
    // 3 from b_old @ 800k = 2,400,000 + 2 from b_new @ 1,000k = 2,000,000 => COGS = 4,400,000
    assert.equal(res.revenue, 7500000);
    assert.equal(res.cogs, 4400000);
    assert.equal(res.profit, 3100000);
    assert.equal(res.marginPercent, 41.3);
    assert.deepEqual(res.consumedBatches, [
      { batchId: 'b_old', qty: 3, unitCost: 800000, unitSellPrice: 1500000 },
      { batchId: 'b_new', qty: 2, unitCost: 1000000, unitSellPrice: 1500000 },
    ]);
    assert.equal(getProductStock('p1', res.updatedBatches), 2);
  }
});

test('FIFO blocks selling more than available stock', () => {
  const res = simulateFifoSale('p1', 8, 1500000, twoBatches);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.availableStock, 7);
    assert.match(res.error, /موجودی کافی نیست/);
  }
});

test('Voiding a sale restores exact quantities back to original FIFO batches', () => {
  const sim = simulateFifoSale('p1', 5, 1500000, twoBatches);
  assert.equal(sim.ok, true);
  if (!sim.ok) return;

  const sale: Sale = {
    id: 's1',
    ownerId: 'u1',
    productId: 'p1',
    productName: 'دانه قهوه',
    unit: 'کیلو',
    quantity: 5,
    unitPrice: 1500000,
    revenue: sim.revenue,
    cogs: sim.cogs,
    profit: sim.profit,
    marginPercent: sim.marginPercent,
    channel: 'حضوری',
    customerId: '',
    customerName: '',
    status: 'completed',
    soldAt: 5000,
    consumedBatches: sim.consumedBatches,
  };

  const restored = restoreVoidedSaleBatches(sale, sim.updatedBatches);
  assert.equal(getProductStock('p1', restored.updatedBatches), 7);
  const oldBatch = restored.updatedBatches.find((b) => b.id === 'b_old');
  const newBatch = restored.updatedBatches.find((b) => b.id === 'b_new');
  assert.equal(oldBatch?.remainingQty, 3);
  assert.equal(newBatch?.remainingQty, 4);
});

test('Weighted average buy cost and stock status thresholds work accurately', () => {
  // (3 * 800k + 4 * 1,000k) / 7 = 6,400,000 / 7 = 914,286
  assert.equal(getProductAvgCost('p1', twoBatches), 914286);
  assert.equal(getStockStatus(0, 3), 'out_of_stock');
  assert.equal(getStockStatus(3, 3), 'low_stock');
  assert.equal(getStockStatus(4, 3), 'in_stock');
});

test('Direct stock adjustment computes positive batch and negative FIFO deduction', () => {
  const posPlan = computeStockAdjustmentPlan('p1', 10, 900000, twoBatches, 'شمارش انبار', 3000);
  assert.equal(posPlan.delta, 3);
  assert.equal(posPlan.newBatch?.initialQty, 3);
  assert.equal(posPlan.newBatch?.source, 'adjustment');

  const negPlan = computeStockAdjustmentPlan('p1', 3, 900000, twoBatches, 'ضایعات', 3000);
  assert.equal(negPlan.delta, -4);
  assert.equal(getProductStock('p1', negPlan.updatedBatches), 3);
});

test('Money formatting uses clean تومان and ریال notation without هزار abbreviation', () => {
  assert.equal(formatMoney(1200000, 'toman'), '1,200,000 تومان');
  assert.equal(formatMoney(1200000, 'rial'), '12,000,000 ریال');
  assert.equal(formatMoney(0, 'toman'), '0 تومان');
  assert.equal(formatMoney(-450000, 'toman'), '−450,000 تومان');
  assert.equal(inputToToman(12000000, 'rial'), 1200000);
  assert.equal(parseNumericInput(normalizeDigits('۱,۲۵۰,۰۰۰')), 1250000);
});

test('Persian store names normalize Arabic Yeh/Kaf and never read as empty', () => {
  // Many Android keyboards produce Arabic ي / ك; they must become Persian ی / ک.
  assert.equal(normalizeStoreName('فروشگاه آفتاب'), 'فروشگاه آفتاب');
  assert.equal(normalizeStoreName('فروشگاه آفتاب '), 'فروشگاه آفتاب');
  assert.equal(normalizeStoreName('كافه ياس'), 'کافه یاس');
  // Invisible characters at the edges must not make the name look empty.
  assert.equal(normalizeStoreName(' فروشگاه آفتاب '), 'فروشگاه آفتاب');
  assert.equal(normalizeStoreName('\u200Cفروشگاه آفتاب\u200C'), 'فروشگاه آفتاب');
  assert.equal(normalizeStoreName('   '), '');
  assert.equal(normalizeStoreName(''), '');
  // ZWNJ inside a word is real Persian and must be kept.
  assert.equal(normalizeStoreName('می‌خواهم'), 'می‌خواهم');
});

test('Online and in-person sale channels resolve appropriate default customer labels', () => {
  assert.equal(getDefaultCustomerNameForChannel('آنلاین'), 'سفارش آنلاین');
  assert.equal(getDefaultCustomerNameForChannel('اینستاگرام'), 'مشتری اینستاگرام');
  assert.equal(getDefaultCustomerNameForChannel('تلگرام / واتساپ'), 'سفارش تلگرام / واتساپ');
  assert.equal(getDefaultCustomerNameForChannel('سایت / باسلام'), 'سفارش سایت');
  assert.equal(getDefaultCustomerNameForChannel('حضوری'), 'مشتری حضوری');
});

test('Greeting changes based on time of day', () => {
  assert.equal(getGreetingByHour(8), 'صبح بخیر');
  assert.equal(getGreetingByHour(14), 'وقت بخیر');
  assert.equal(getGreetingByHour(22), 'شب بخیر');
  assert.equal(getGreetingByHour(2), 'شب بخیر');
});

test('Dashboard and Profit Analytics exclude voided sales and aggregate ranges cleanly', () => {
  const now = new Date('2026-11-19T12:00:00');
  const nowMs = now.getTime();
  const sales: Sale[] = [
    {
      id: 's_today',
      ownerId: 'u1',
      productId: 'p1',
      productName: 'دانه قهوه',
      unit: 'کیلو',
      quantity: 2,
      unitPrice: 1500000,
      revenue: 3000000,
      cogs: 1600000,
      profit: 1400000,
      marginPercent: 46.7,
      channel: 'حضوری',
      customerId: '',
      customerName: '',
      status: 'completed',
      soldAt: nowMs - 1000,
      consumedBatches: [{ batchId: 'b_old', qty: 2, unitCost: 800000 }],
    },
    {
      id: 's_voided',
      ownerId: 'u1',
      productId: 'p1',
      productName: 'دانه قهوه',
      unit: 'کیلو',
      quantity: 1,
      unitPrice: 1500000,
      revenue: 1500000,
      cogs: 800000,
      profit: 700000,
      marginPercent: 46.7,
      channel: 'حضوری',
      customerId: '',
      customerName: '',
      status: 'voided',
      soldAt: nowMs - 2000,
      consumedBatches: [{ batchId: 'b_old', qty: 1, unitCost: 800000 }],
    },
    {
      id: 's_old',
      ownerId: 'u1',
      productId: 'p1',
      productName: 'دانه قهوه',
      unit: 'کیلو',
      quantity: 1,
      unitPrice: 1500000,
      revenue: 1500000,
      cogs: 1000000,
      profit: 500000,
      marginPercent: 33.3,
      channel: 'آنلاین',
      customerId: '',
      customerName: '',
      status: 'completed',
      soldAt: nowMs - 15 * MS_PER_DAY,
      consumedBatches: [{ batchId: 'b_new', qty: 1, unitCost: 1000000 }],
    },
  ];

  const dash = computeDashboardSummary([baseProduct], twoBatches, sales, now);
  assert.equal(dash.today.profit, 1400000);
  assert.equal(dash.totalProfit, 1900000);

  const report7 = computeProfitAnalytics(sales, 7, now);
  assert.equal(report7.revenue, 3000000);
  assert.equal(report7.profit, 1400000);

  const report30 = computeProfitAnalytics(sales, 30, now);
  assert.equal(report30.revenue, 4500000);
  assert.equal(report30.profit, 1900000);

  const filteredToday = filterSalesByRange(sales, 'today', now);
  const summaryToday = summarizeSales(filteredToday);
  assert.equal(summaryToday.count, 1);
  assert.equal(summaryToday.profit, 1400000);
});

import { computeProductMetrics } from './fifo';
import { parseLedgerBackup, serializeLedgerBackup } from './backup';

test('Multi-price batches compute distinct buy/sell profit automatically across FIFO batches', () => {
  const multiBatches: PurchaseBatch[] = [
    {
      id: 'b1',
      ownerId: 'u1',
      productId: 'p1',
      initialQty: 3,
      remainingQty: 3,
      unitCost: 800000,
      unitSellPrice: 1300000,
      source: 'initial',
      supplierName: '',
      note: 'سری ۱',
      purchasedAt: 1000,
    },
    {
      id: 'b2',
      ownerId: 'u1',
      productId: 'p1',
      initialQty: 4,
      remainingQty: 4,
      unitCost: 1000000,
      unitSellPrice: 1600000,
      source: 'restock',
      supplierName: '',
      note: 'سری ۲',
      purchasedAt: 2000,
    },
  ];

  const metrics = computeProductMetrics(baseProduct, multiBatches);
  assert.equal(metrics.hasMixedBatchPrices, true);
  // Batch 1 profit: 3 * (1,300k - 800k) = 1,500k; Batch 2 profit: 4 * (1,600k - 1,000k) = 2,400k -> total 3,900k
  assert.equal(metrics.expectedProfit, 3900000);

  // Selling 5 units using each batch's own sell price:
  // 3 * 1,300k + 2 * 1,600k = 3,900k + 3,200k = 7,100k revenue
  // 3 * 800k + 2 * 1,000k = 2,400k + 2,000k = 4,400k cogs
  // profit = 2,700k
  const sim = simulateFifoSale('p1', 5, 1500000, multiBatches, { useBatchSellPrices: true });
  assert.equal(sim.ok, true);
  if (sim.ok) {
    assert.equal(sim.revenue, 7100000);
    assert.equal(sim.cogs, 4400000);
    assert.equal(sim.profit, 2700000);
    assert.equal(sim.consumedBatches[0].unitSellPrice, 1300000);
    assert.equal(sim.consumedBatches[1].unitSellPrice, 1600000);
  }

  // Selling specifically from Batch 2 only:
  const simBatch2 = simulateFifoSale('p1', 2, 1600000, multiBatches, {
    useBatchSellPrices: true,
    targetBatchId: 'b2',
  });
  assert.equal(simBatch2.ok, true);
  if (simBatch2.ok) {
    assert.equal(simBatch2.revenue, 3200000);
    assert.equal(simBatch2.cogs, 2000000);
    assert.equal(simBatch2.profit, 1200000);
    assert.equal(simBatch2.consumedBatches[0].batchId, 'b2');
  }
});

test('Backup serialization and validated restore round-trips ledger data cleanly', () => {
  const sampleLedger: LedgerState = {
    profile: {
      ownerId: 'u_local',
      storeName: 'فروشگاه آفتاب',
      businessType: 'online',
      email: '',
      currency: 'toman',
      theme: 'light',
      authMode: 'local',
    },
    products: [baseProduct],
    batches: twoBatches,
    sales: [],
    contacts: [],
    adjustments: [],
  };
  const raw = serializeLedgerBackup(sampleLedger, 1700000005000);
  const parsed = parseLedgerBackup(raw);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.ledger.profile.storeName, 'فروشگاه آفتاب');
    assert.equal(parsed.stats.products, 1);
    assert.equal(parsed.stats.batches, 2);
    assert.equal(parsed.stats.sales, 0);
  }

  const badJson = parseLedgerBackup('{broken');
  assert.equal(badJson.ok, false);

  const wrongApp = parseLedgerBackup(JSON.stringify({ app: 'other', data: {} }));
  assert.equal(wrongApp.ok, false);
});

test('Purchase price history computes chronological cost changes and per-batch gross profit impact (excluding voided sales)', () => {
  const histBatches: PurchaseBatch[] = [
    {
      id: 'h2',
      ownerId: 'u1',
      productId: 'p1',
      initialQty: 5,
      remainingQty: 3,
      unitCost: 1000000,
      unitSellPrice: 1500000,
      source: 'restock',
      supplierName: 'تأمین‌کننده ۲',
      note: '',
      purchasedAt: 2000,
    },
    {
      id: 'h1',
      ownerId: 'u1',
      productId: 'p1',
      initialQty: 4,
      remainingQty: 0,
      unitCost: 800000,
      unitSellPrice: 1300000,
      source: 'initial',
      supplierName: 'تأمین‌کننده ۱',
      note: '',
      purchasedAt: 1000,
    },
  ];

  const histSales: Sale[] = [
    {
      id: 's_ok_1',
      ownerId: 'u1',
      productId: 'p1',
      productName: 'دانه قهوه اتیوپی',
      unit: 'کیلو',
      quantity: 4,
      unitPrice: 1300000,
      revenue: 5200000,
      cogs: 3200000,
      profit: 2000000,
      marginPercent: 38.5,
      channel: 'حضوری',
      customerId: '',
      customerName: 'عمومی',
      status: 'completed',
      soldAt: 1500,
      consumedBatches: [{ batchId: 'h1', qty: 4, unitCost: 800000, unitSellPrice: 1300000 }],
    },
    {
      id: 's_ok_2',
      ownerId: 'u1',
      productId: 'p1',
      productName: 'دانه قهوه اتیوپی',
      unit: 'کیلو',
      quantity: 2,
      unitPrice: 1500000,
      revenue: 3000000,
      cogs: 2000000,
      profit: 1000000,
      marginPercent: 33.3,
      channel: 'آنلاین',
      customerId: '',
      customerName: 'عمومی',
      status: 'completed',
      soldAt: 2500,
      consumedBatches: [{ batchId: 'h2', qty: 2, unitCost: 1000000, unitSellPrice: 1500000 }],
    },
    {
      id: 's_void',
      ownerId: 'u1',
      productId: 'p1',
      productName: 'دانه قهوه اتیوپی',
      unit: 'کیلو',
      quantity: 1,
      unitPrice: 1500000,
      revenue: 1500000,
      cogs: 1000000,
      profit: 500000,
      marginPercent: 33.3,
      channel: 'حضوری',
      customerId: '',
      customerName: 'عمومی',
      status: 'voided',
      soldAt: 2600,
      consumedBatches: [{ batchId: 'h2', qty: 1, unitCost: 1000000, unitSellPrice: 1500000 }],
    },
  ];

  const history = buildProductPurchaseHistory('p1', 1400000, histBatches, histSales);

  assert.equal(history.totalBatches, 2);
  assert.equal(history.activeBatchesCount, 1);
  assert.equal(history.minUnitCost, 800000);
  assert.equal(history.maxUnitCost, 1000000);
  assert.equal(history.firstToLatestCostChange, 200000);
  assert.equal(history.firstToLatestCostChangePercent, 25);

  // Sorted oldest -> newest (h1 then h2)
  assert.equal(history.entries[0].batch.id, 'h1');
  assert.equal(history.entries[0].status, 'depleted');
  assert.equal(history.entries[0].costDeltaPercent, null);
  assert.equal(history.entries[0].realizedGrossProfit, 2000000);
  assert.equal(history.entries[0].projectedRemainingProfit, 0);

  assert.equal(history.entries[1].batch.id, 'h2');
  assert.equal(history.entries[1].status, 'active');
  assert.equal(history.entries[1].costDeltaFromPrev, 200000);
  assert.equal(history.entries[1].costDeltaPercent, 25);
  // 2 sold * 500k = 1,000k realized; 3 remaining * 500k = 1,500k projected -> total impact 2,500k
  assert.equal(history.entries[1].realizedGrossProfit, 1000000);
  assert.equal(history.entries[1].projectedRemainingProfit, 1500000);
  assert.equal(history.entries[1].totalGrossProfitImpact, 2500000);

  // Totals: realized = 3,000k, projected = 1,500k, combined = 4,500k
  assert.equal(history.totalRealizedGrossProfit, 3000000);
  assert.equal(history.totalProjectedGrossProfit, 1500000);
  assert.equal(history.totalCombinedGrossProfit, 4500000);
  // Shares: h1 = 2000/4500 = 44.4%, h2 = 2500/4500 = 55.6%
  assert.equal(history.entries[0].grossProfitSharePercent, 44.4);
  assert.equal(history.entries[1].grossProfitSharePercent, 55.6);
});

test('Batch margin contribution badges distinguish most cost-effective, strong, moderate, low, and loss batches', () => {
  const margins = [42.2, 39.3, 38.1];
  assert.equal(getBatchMarginContribution(42.2, margins).tier, 'best');
  assert.equal(getBatchMarginContribution(39.3, margins).tier, 'strong');
  assert.equal(getBatchMarginContribution(38.1, margins).tier, 'moderate');

  // Absolute thresholds
  assert.equal(getBatchMarginContribution(15, margins).tier, 'low');
  assert.equal(getBatchMarginContribution(-5, margins).tier, 'loss');
  assert.equal(getBatchMarginContribution(0, margins).tier, 'loss');

  // Single batch fallback
  assert.equal(getBatchMarginContribution(40, [40]).tier, 'strong');
  assert.equal(getBatchMarginContribution(25, [25]).tier, 'moderate');
});


