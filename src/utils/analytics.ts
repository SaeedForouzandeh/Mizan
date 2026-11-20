import type { Product, ProductMetrics, PurchaseBatch, Sale } from '../types/mizan';
import { computeProductMetrics } from './fifo';
import { formatJalaliDayLabel, formatJalaliMonthLabel } from './formatters';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfLocalDay(date: Date): number {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return copy.getTime();
}

export interface TodaySummary {
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  salesCount: number;
  sevenDayProfit: Array<{ label: string; profit: number; revenue: number; dateMs: number }>;
}

export interface DashboardSummary {
  today: TodaySummary;
  totalProfit: number;
  totalInventoryValue: number;
  lowStockItems: ProductMetrics[];
  outOfStockItems: ProductMetrics[];
  alertItems: ProductMetrics[];
  totalProducts: number;
  productMetrics: ProductMetrics[];
  productProfitBreakdown: Array<{
    productId: string;
    productName: string;
    revenue: number;
    cogs: number;
    profit: number;
    marginPercent: number;
    unitsSold: number;
  }>;
  overallNetProfit: number;
  averageMarginPercent: number;
}

export function computeDashboardSummary(
  products: Product[],
  batches: PurchaseBatch[],
  sales: Sale[],
  now: Date = new Date()
): DashboardSummary {
  const activeSales = sales.filter((s) => s.status === 'completed');
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = todayStart + MS_PER_DAY;

  const todaySales = activeSales.filter(
    (s) => s.soldAt >= todayStart && s.soldAt < tomorrowStart
  );

  const todayRevenue = todaySales.reduce((acc, s) => acc + s.revenue, 0);
  const todayCogs = todaySales.reduce((acc, s) => acc + s.cogs, 0);
  const todayProfit = todaySales.reduce((acc, s) => acc + s.profit, 0);
  const todayMargin =
    todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 1000) / 10 : 0;

  const sevenDayProfit: TodaySummary['sevenDayProfit'] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = todayStart - i * MS_PER_DAY;
    const dayEnd = dayStart + MS_PER_DAY;
    const daySales = activeSales.filter((s) => s.soldAt >= dayStart && s.soldAt < dayEnd);
    sevenDayProfit.push({
      label: formatJalaliDayLabel(dayStart),
      profit: daySales.reduce((acc, s) => acc + s.profit, 0),
      revenue: daySales.reduce((acc, s) => acc + s.revenue, 0),
      dateMs: dayStart,
    });
  }

  const productMetrics = products.map((p) => computeProductMetrics(p, batches));
  const totalInventoryValue = productMetrics.reduce((acc, m) => acc + m.inventoryValue, 0);
  const lowStockItems = productMetrics.filter((m) => m.status === 'low_stock');
  const outOfStockItems = productMetrics.filter((m) => m.status === 'out_of_stock');
  const alertItems = productMetrics.filter((m) => m.status !== 'in_stock');

  const totalProfit = activeSales.reduce((acc, s) => acc + s.profit, 0);
  const totalRevenue = activeSales.reduce((acc, s) => acc + s.revenue, 0);
  const averageMarginPercent =
    totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  const byProduct = new Map<
    string,
    {
      productId: string;
      productName: string;
      revenue: number;
      cogs: number;
      profit: number;
      unitsSold: number;
    }
  >();

  for (const s of activeSales) {
    const existing = byProduct.get(s.productId);
    if (existing) {
      existing.revenue += s.revenue;
      existing.cogs += s.cogs;
      existing.profit += s.profit;
      existing.unitsSold += s.quantity;
    } else {
      byProduct.set(s.productId, {
        productId: s.productId,
        productName: s.productName,
        revenue: s.revenue,
        cogs: s.cogs,
        profit: s.profit,
        unitsSold: s.quantity,
      });
    }
  }

  const productProfitBreakdown = Array.from(byProduct.values())
    .map((item) => ({
      ...item,
      marginPercent:
        item.revenue > 0 ? Math.round((item.profit / item.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    today: {
      revenue: todayRevenue,
      cogs: todayCogs,
      profit: todayProfit,
      marginPercent: todayMargin,
      salesCount: todaySales.length,
      sevenDayProfit,
    },
    totalProfit,
    totalInventoryValue,
    lowStockItems,
    outOfStockItems,
    alertItems,
    totalProducts: products.length,
    productMetrics,
    productProfitBreakdown,
    overallNetProfit: totalProfit,
    averageMarginPercent,
  };
}

export interface SalesChartPoint {
  label: string;
  revenue: number;
  profit: number;
  cogs: number;
}

export function buildSalesChartSeries(
  sales: Sale[],
  mode: 'daily' | 'monthly',
  now: Date = new Date()
): SalesChartPoint[] {
  const activeSales = sales.filter((s) => s.status === 'completed');

  if (mode === 'daily') {
    const todayStart = startOfLocalDay(now);
    const points: SalesChartPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const start = todayStart - i * MS_PER_DAY;
      const end = start + MS_PER_DAY;
      const slice = activeSales.filter((s) => s.soldAt >= start && s.soldAt < end);
      points.push({
        label: formatJalaliDayLabel(start),
        revenue: slice.reduce((a, s) => a + s.revenue, 0),
        profit: slice.reduce((a, s) => a + s.profit, 0),
        cogs: slice.reduce((a, s) => a + s.cogs, 0),
      });
    }
    return points;
  }

  // Monthly: last 6 calendar months
  const points: SalesChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const startMs = monthStart.getTime();
    const endMs = monthEnd.getTime();
    const slice = activeSales.filter((s) => s.soldAt >= startMs && s.soldAt < endMs);
    points.push({
      label: formatJalaliMonthLabel(startMs),
      revenue: slice.reduce((a, s) => a + s.revenue, 0),
      profit: slice.reduce((a, s) => a + s.profit, 0),
      cogs: slice.reduce((a, s) => a + s.cogs, 0),
    });
  }
  return points;
}

export type AnalyticsRangeDays = 7 | 30 | 90;

export interface ProfitAnalyticsReport {
  rangeDays: AnalyticsRangeDays;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  salesCount: number;
  series: SalesChartPoint[];
  ranking: Array<{
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPercent: number;
  }>;
}

export function computeProfitAnalytics(
  sales: Sale[],
  rangeDays: AnalyticsRangeDays,
  now: Date = new Date()
): ProfitAnalyticsReport {
  const todayStart = startOfLocalDay(now);
  const rangeStart = todayStart - (rangeDays - 1) * MS_PER_DAY;
  const rangeEnd = todayStart + MS_PER_DAY;

  const activeInRange = sales.filter(
    (s) => s.status === 'completed' && s.soldAt >= rangeStart && s.soldAt < rangeEnd
  );

  const revenue = activeInRange.reduce((a, s) => a + s.revenue, 0);
  const cogs = activeInRange.reduce((a, s) => a + s.cogs, 0);
  const profit = activeInRange.reduce((a, s) => a + s.profit, 0);
  const marginPercent = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

  // Group into readable buckets: 7 points for 7d, 10 points (3-day) for 30d, 15 points (6-day) for 90d
  const bucketSizeDays = rangeDays === 7 ? 1 : rangeDays === 30 ? 3 : 6;
  const bucketCount = Math.ceil(rangeDays / bucketSizeDays);
  const series: SalesChartPoint[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = rangeStart + i * bucketSizeDays * MS_PER_DAY;
    const end = Math.min(rangeEnd, start + bucketSizeDays * MS_PER_DAY);
    const slice = activeInRange.filter((s) => s.soldAt >= start && s.soldAt < end);
    series.push({
      label: formatJalaliDayLabel(start),
      revenue: slice.reduce((a, s) => a + s.revenue, 0),
      profit: slice.reduce((a, s) => a + s.profit, 0),
      cogs: slice.reduce((a, s) => a + s.cogs, 0),
    });
  }

  const byProduct = new Map<
    string,
    {
      productId: string;
      productName: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      profit: number;
    }
  >();

  for (const s of activeInRange) {
    const existing = byProduct.get(s.productId);
    if (existing) {
      existing.unitsSold += s.quantity;
      existing.revenue += s.revenue;
      existing.cogs += s.cogs;
      existing.profit += s.profit;
    } else {
      byProduct.set(s.productId, {
        productId: s.productId,
        productName: s.productName,
        unitsSold: s.quantity,
        revenue: s.revenue,
        cogs: s.cogs,
        profit: s.profit,
      });
    }
  }

  const ranking = Array.from(byProduct.values())
    .map((item) => ({
      ...item,
      marginPercent:
        item.revenue > 0 ? Math.round((item.profit / item.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    rangeDays,
    revenue,
    cogs,
    profit,
    marginPercent,
    salesCount: activeInRange.length,
    series,
    ranking,
  };
}

export type SalesDateRange = 'today' | '7d' | '30d' | 'all';

export function filterSalesByRange(
  sales: Sale[],
  range: SalesDateRange,
  now: Date = new Date()
): Sale[] {
  const sorted = [...sales].sort((a, b) => b.soldAt - a.soldAt);
  if (range === 'all') return sorted;

  const todayStart = startOfLocalDay(now);
  const cutoff =
    range === 'today'
      ? todayStart
      : range === '7d'
        ? todayStart - 6 * MS_PER_DAY
        : todayStart - 29 * MS_PER_DAY;

  return sorted.filter((s) => s.soldAt >= cutoff);
}

export function summarizeSales(sales: Sale[]): {
  revenue: number;
  profit: number;
  count: number;
} {
  const completed = sales.filter((s) => s.status === 'completed');
  return {
    revenue: completed.reduce((acc, s) => acc + s.revenue, 0),
    profit: completed.reduce((acc, s) => acc + s.profit, 0),
    count: completed.length,
  };
}
