export type CurrencyMode = 'toman' | 'rial';
export type ThemeMode = 'light' | 'dark';

export type BusinessType = 'cafe' | 'restaurant' | 'shop' | 'boutique' | 'online' | 'other';

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  cafe: 'کافه',
  restaurant: 'رستوران',
  shop: 'فروشگاه',
  boutique: 'بوتیک',
  online: 'فروش آنلاین',
  other: 'سایر',
};

export type ProductUnit = 'عدد' | 'کیلو' | 'گرم' | 'لیتر' | 'میلی‌لیتر' | 'جعبه' | 'بسته';

export const PRODUCT_UNITS: ProductUnit[] = [
  'عدد',
  'کیلو',
  'گرم',
  'لیتر',
  'میلی‌لیتر',
  'جعبه',
  'بسته',
];

export type SaleChannel =
  | 'آنلاین'
  | 'اینستاگرام'
  | 'تلگرام / واتساپ'
  | 'سایت / باسلام'
  | 'حضوری'
  | 'عمده'
  | 'سایر';

export const SALE_CHANNELS: SaleChannel[] = [
  'آنلاین',
  'اینستاگرام',
  'تلگرام / واتساپ',
  'سایت / باسلام',
  'حضوری',
  'عمده',
  'سایر',
];

export function getDefaultCustomerNameForChannel(channel: SaleChannel): string {
  switch (channel) {
    case 'آنلاین':
      return 'سفارش آنلاین';
    case 'اینستاگرام':
      return 'مشتری اینستاگرام';
    case 'تلگرام / واتساپ':
      return 'سفارش تلگرام / واتساپ';
    case 'سایت / باسلام':
      return 'سفارش سایت';
    case 'عمده':
      return 'مشتری عمده';
    case 'حضوری':
      return 'مشتری حضوری';
    default:
      return 'مشتری عمومی';
  }
}

export type NavTab = 'dashboard' | 'inventory' | 'sales' | 'analytics' | 'contacts';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type StockFilter = 'all' | StockStatus;

export type ContactType = 'customer' | 'supplier';

export interface StoreProfile {
  ownerId: string;
  storeName: string;
  businessType: BusinessType;
  email: string;
  currency: CurrencyMode;
  theme: ThemeMode;
  authMode?: 'firebase' | 'local';
  lastBackupAt?: number;
}

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  category: string;
  unit: ProductUnit;
  /** Default sell price stored in Toman as canonical base currency */
  sellPrice: number;
  reorderLevel: number;
  notes: string;
  createdAtMs: number;
}

export interface PurchaseBatch {
  id: string;
  ownerId: string;
  productId: string;
  initialQty: number;
  remainingQty: number;
  /** Unit buy cost stored in Toman */
  unitCost: number;
  /** Optional batch-specific unit sell price stored in Toman (falls back to product.sellPrice) */
  unitSellPrice?: number;
  source: 'initial' | 'restock' | 'adjustment';
  supplierName: string;
  note: string;
  purchasedAt: number;
}

export interface ConsumedBatchRef {
  batchId: string;
  qty: number;
  unitCost: number;
  unitSellPrice?: number;
}

export interface Sale {
  id: string;
  ownerId: string;
  productId: string;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  /** Effective average unit sell price stored in Toman */
  unitPrice: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  channel: SaleChannel;
  customerId: string;
  customerName: string;
  status: 'completed' | 'voided';
  soldAt: number;
  consumedBatches: ConsumedBatchRef[];
}

export interface Contact {
  id: string;
  ownerId: string;
  type: ContactType;
  name: string;
  handle: string;
  phone: string;
  notes: string;
  createdAtMs: number;
}

export interface StockAdjustment {
  id: string;
  ownerId: string;
  productId: string;
  delta: number;
  unitCost: number;
  reason: string;
  adjustedAt: number;
}

export interface BatchProfitInfo {
  batch: PurchaseBatch;
  unitSellPrice: number;
  unitProfit: number;
  marginPercent: number;
  remainingProfit: number;
  remainingRevenue: number;
}

export interface ProductMetrics {
  product: Product;
  currentStock: number;
  avgBuyCost: number;
  avgSellPrice: number;
  inventoryValue: number;
  expectedProfit: number;
  hasMixedBatchPrices: boolean;
  status: StockStatus;
  activeBatches: PurchaseBatch[];
  batchProfits: BatchProfitInfo[];
}

export interface PurchaseHistoryEntry {
  batch: PurchaseBatch;
  batchIndex: number;
  status: 'active' | 'depleted';
  unitCost: number;
  unitSellPrice: number;
  costDeltaFromPrev: number | null;
  costDeltaPercent: number | null;
  unitGrossProfit: number;
  unitMarginPercent: number;
  realizedSoldQty: number;
  realizedRevenue: number;
  realizedCogs: number;
  realizedGrossProfit: number;
  salesCount: number;
  projectedRemainingRevenue: number;
  projectedRemainingProfit: number;
  totalGrossProfitImpact: number;
  grossProfitSharePercent: number;
}

export interface ProductPurchaseHistory {
  entries: PurchaseHistoryEntry[];
  totalBatches: number;
  activeBatchesCount: number;
  minUnitCost: number;
  maxUnitCost: number;
  weightedAvgCost: number;
  firstToLatestCostChange: number | null;
  firstToLatestCostChangePercent: number | null;
  totalRealizedGrossProfit: number;
  totalProjectedGrossProfit: number;
  totalCombinedGrossProfit: number;
  overallGrossMarginPercent: number;
}

export type BatchMarginBadgeTier = 'best' | 'strong' | 'moderate' | 'low' | 'loss';

export interface BatchMarginBadgeInfo {
  tier: BatchMarginBadgeTier;
  label: string;
}

export interface LedgerState {
  profile: StoreProfile;
  products: Product[];
  batches: PurchaseBatch[];
  sales: Sale[];
  contacts: Contact[];
  adjustments: StockAdjustment[];
}
