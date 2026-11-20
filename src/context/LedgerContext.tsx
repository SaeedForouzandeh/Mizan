import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDefaultCustomerNameForChannel,
  type BusinessType,
  type Contact,
  type ContactType,
  type CurrencyMode,
  type LedgerState,
  type Product,
  type ProductUnit,
  type PurchaseBatch,
  type Sale,
  type SaleChannel,
  type ThemeMode,
} from '../types/mizan';
import {
  buildBackupFilename,
  parseLedgerBackup,
  serializeLedgerBackup,
  type BackupParseResult,
} from '../utils/backup';
import {
  computeStockAdjustmentPlan,
  getProductAvgCost,
  restoreVoidedSaleBatches,
  simulateFifoSale,
} from '../utils/fifo';
import { createSafeId } from '../utils/formatters';

const LOCAL_LEDGER_KEY = 'mizan_store_ledger_v2';

export interface AddProductInput {
  name: string;
  sku: string;
  initialStock: number;
  unitCost: number;
  category: string;
  unit: ProductUnit;
  sellPrice: number;
  reorderLevel: number;
  notes: string;
}

export interface UpdateProductInput {
  name: string;
  sku: string;
  targetStock: number;
  unitCostForPositive: number;
  category: string;
  unit: ProductUnit;
  sellPrice: number;
  reorderLevel: number;
  notes: string;
  adjustmentReason?: string;
}

export interface RecordSaleInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  useBatchSellPrices?: boolean;
  targetBatchId?: string;
  channel: SaleChannel;
  customerId: string;
  customerName: string;
}

export interface SaveContactInput {
  id?: string;
  type: ContactType;
  name: string;
  handle: string;
  phone: string;
  notes: string;
}

interface LedgerContextValue {
  ready: boolean;
  isConfigured: boolean;
  ledger: LedgerState | null;
  toastMessage: string | null;
  clearToast: () => void;
  showToast: (msg: string) => void;
  // Store Setup & Backup
  startStore: (storeName: string, businessType: BusinessType) => void;
  exportBackup: () => { filename: string; content: string } | null;
  previewBackup: (rawJson: string) => BackupParseResult;
  restoreBackup: (rawJson: string) => { ok: boolean; error?: string };
  // Store Preferences
  setCurrency: (currency: CurrencyMode) => void;
  setTheme: (theme: ThemeMode) => void;
  updateStoreProfile: (storeName: string, businessType: BusinessType) => void;
  // Ledger Operations
  addProduct: (input: AddProductInput) => { ok: boolean; error?: string };
  updateProduct: (productId: string, input: UpdateProductInput) => { ok: boolean; error?: string };
  restockProduct: (
    productId: string,
    quantity: number,
    unitCost: number,
    unitSellPrice: number,
    supplierName: string,
    note: string
  ) => { ok: boolean; error?: string };
  adjustProductStock: (
    productId: string,
    targetStock: number,
    unitCost: number,
    reason: string
  ) => { ok: boolean; error?: string };
  recordSale: (input: RecordSaleInput) => { ok: boolean; error?: string; sale?: Sale };
  voidSale: (saleId: string) => { ok: boolean; error?: string };
  saveContact: (input: SaveContactInput) => { ok: boolean; error?: string };
  deleteContact: (contactId: string) => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

const LEGACY_LOCAL_KEYS = ['mizan_local_ledger_v1', 'mizan_demo_ledger'];

function isLegacyCafeDemoLedger(state: LedgerState): boolean {
  const ownerId = state.profile.ownerId ?? '';
  const storeName = (state.profile.storeName ?? '').trim();
  const authMode = (state.profile as { authMode?: string }).authMode;
  return (
    authMode === 'demo' ||
    ownerId === 'demo-cafe-mizan' ||
    ownerId.startsWith('demo_') ||
    storeName.includes('کافه رُستری میزان') ||
    storeName.includes('کافه رستری میزان') ||
    storeName === 'کافه میزان'
  );
}

function readStoredLedger(): LedgerState | null {
  try {
    LEGACY_LOCAL_KEYS.forEach((legacyKey) => localStorage.removeItem(legacyKey));
    const raw = localStorage.getItem(LOCAL_LEDGER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LedgerState;
    if (!parsed || !parsed.profile || !Array.isArray(parsed.products)) return null;
    if (isLegacyCafeDemoLedger(parsed)) {
      localStorage.removeItem(LOCAL_LEDGER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredLedger(state: LedgerState): void {
  try {
    localStorage.setItem(LOCAL_LEDGER_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Hydrate ledger on startup from localStorage
  useEffect(() => {
    const existing = readStoredLedger();
    if (existing) {
      setLedger(existing);
    }
    setReady(true);
  }, []);

  // Apply light/dark theme to <html>
  const activeTheme: ThemeMode = ledger?.profile.theme ?? 'light';
  useEffect(() => {
    const root = document.documentElement;
    if (activeTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', activeTheme === 'dark' ? '#14110E' : '#FAF6F0');
    }
  }, [activeTheme]);

  const mutateLedger = useCallback((updater: (prev: LedgerState) => LedgerState) => {
    setLedger((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      writeStoredLedger(next);
      return next;
    });
  }, []);

  // --- Setup & Backup ---
  const startStore = useCallback(
    (storeName: string, businessType: BusinessType) => {
      const cleanName = storeName.trim() || 'میزان';
      const uid = createSafeId('store');
      const nextState: LedgerState = {
        profile: {
          ownerId: uid,
          storeName: cleanName,
          businessType,
          email: '',
          currency: 'toman',
          theme: 'light',
          authMode: 'local',
        },
        products: [],
        batches: [],
        sales: [],
        contacts: [],
        adjustments: [],
      };

      writeStoredLedger(nextState);
      setLedger(nextState);
      showToast(`دفتر «${cleanName}» آماده کار است.`);
    },
    [showToast]
  );

  const exportBackup = useCallback((): { filename: string; content: string } | null => {
    if (!ledger) return null;
    const nowMs = Date.now();
    const content = serializeLedgerBackup(ledger, nowMs);
    const filename = buildBackupFilename(new Date(nowMs));
    mutateLedger((prev) => ({
      ...prev,
      profile: { ...prev.profile, lastBackupAt: nowMs },
    }));
    showToast('فایل پشتیبان با موفقیت ذخیره شد.');
    return { filename, content };
  }, [ledger, mutateLedger, showToast]);

  const previewBackup = useCallback((rawJson: string): BackupParseResult => {
    return parseLedgerBackup(rawJson);
  }, []);

  const restoreBackup = useCallback(
    (rawJson: string): { ok: boolean; error?: string } => {
      const parsed = parseLedgerBackup(rawJson);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }
      writeStoredLedger(parsed.ledger);
      setLedger(parsed.ledger);
      showToast(
        `پشتیبان «${parsed.ledger.profile.storeName}» بازیابی شد (${parsed.stats.products} کالا، ${parsed.stats.sales} فروش).`
      );
      return { ok: true };
    },
    [showToast]
  );

  // --- Preferences ---
  const setCurrency = useCallback(
    (currency: CurrencyMode) => {
      mutateLedger((prev) => ({
        ...prev,
        profile: { ...prev.profile, currency },
      }));
    },
    [mutateLedger]
  );

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      mutateLedger((prev) => ({
        ...prev,
        profile: { ...prev.profile, theme },
      }));
    },
    [mutateLedger]
  );

  const updateStoreProfile = useCallback(
    (storeName: string, businessType: BusinessType) => {
      const trimmed = storeName.trim() || 'میزان';
      mutateLedger((prev) => ({
        ...prev,
        profile: { ...prev.profile, storeName: trimmed, businessType },
      }));
      showToast('نام و مشخصات فروشگاه ذخیره شد.');
    },
    [mutateLedger, showToast]
  );

  // --- Products ---
  const addProduct = useCallback(
    (input: AddProductInput): { ok: boolean; error?: string } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      const name = input.name.trim();
      const sku = input.sku.trim();
      if (!name) return { ok: false, error: 'نام کالا الزامی است.' };
      if (!sku) return { ok: false, error: 'کد محصول الزامی است.' };
      if (input.initialStock < 0) return { ok: false, error: 'موجودی نمی‌تواند منفی باشد.' };
      if (input.unitCost < 0) return { ok: false, error: 'قیمت خرید نامعتبر است.' };

      const uid = ledger.profile.ownerId;
      const productId = createSafeId('prod');
      const nowMs = Date.now();
      const sellPrice = Math.max(0, Math.round(input.sellPrice));

      const newProduct: Product = {
        id: productId,
        ownerId: uid,
        name: name.slice(0, 120),
        sku: sku.slice(0, 48),
        category: (input.category.trim() || 'عمومی').slice(0, 60),
        unit: input.unit,
        sellPrice,
        reorderLevel: Math.max(0, input.reorderLevel),
        notes: input.notes.trim().slice(0, 500),
        createdAtMs: nowMs,
      };

      const initialBatch: PurchaseBatch | null =
        input.initialStock > 0
          ? {
              id: createSafeId('bat'),
              ownerId: uid,
              productId,
              initialQty: input.initialStock,
              remainingQty: input.initialStock,
              unitCost: Math.max(0, Math.round(input.unitCost)),
              unitSellPrice: sellPrice,
              source: 'initial',
              supplierName: '',
              note: 'سری اولیه',
              purchasedAt: nowMs,
            }
          : null;

      mutateLedger((prev) => ({
        ...prev,
        products: [newProduct, ...prev.products],
        batches: initialBatch ? [...prev.batches, initialBatch] : prev.batches,
      }));

      showToast(`«${newProduct.name}» اضافه شد.`);
      return { ok: true };
    },
    [ledger, mutateLedger, showToast]
  );

  const updateProduct = useCallback(
    (productId: string, input: UpdateProductInput): { ok: boolean; error?: string } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      const name = input.name.trim();
      const sku = input.sku.trim();
      if (!name) return { ok: false, error: 'نام کالا الزامی است.' };
      if (!sku) return { ok: false, error: 'کد محصول الزامی است.' };

      const uid = ledger.profile.ownerId;
      const nowMs = Date.now();
      const sellPrice = Math.max(0, Math.round(input.sellPrice));
      const reason = (input.adjustmentReason || 'اصلاح موجودی در ویرایش کالا').slice(0, 300);

      const adjPlan = computeStockAdjustmentPlan(
        productId,
        input.targetStock,
        input.unitCostForPositive || getProductAvgCost(productId, ledger.batches),
        ledger.batches,
        reason,
        nowMs,
        sellPrice
      );

      const newBatchId = adjPlan.newBatch ? createSafeId('bat') : null;
      const adjId = adjPlan.delta !== 0 ? createSafeId('adj') : null;

      mutateLedger((prev) => {
        const nextBatches = [...adjPlan.updatedBatches];
        if (adjPlan.newBatch && newBatchId) {
          nextBatches.push({
            id: newBatchId,
            ownerId: uid,
            ...adjPlan.newBatch,
          });
        }
        const nextAdjustments =
          adjPlan.delta !== 0 && adjId
            ? [
                {
                  id: adjId,
                  ownerId: uid,
                  productId,
                  delta: adjPlan.delta,
                  unitCost: Math.max(0, Math.round(input.unitCostForPositive)),
                  reason,
                  adjustedAt: nowMs,
                },
                ...prev.adjustments,
              ]
            : prev.adjustments;

        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  name: name.slice(0, 120),
                  sku: sku.slice(0, 48),
                  category: (input.category.trim() || 'عمومی').slice(0, 60),
                  unit: input.unit,
                  sellPrice,
                  reorderLevel: Math.max(0, input.reorderLevel),
                  notes: input.notes.trim().slice(0, 500),
                }
              : p
          ),
          batches: nextBatches,
          adjustments: nextAdjustments,
        };
      });

      showToast(
        adjPlan.delta !== 0
          ? `کالا ویرایش شد و اختلاف ${adjPlan.delta > 0 ? `+${adjPlan.delta}` : adjPlan.delta} به‌عنوان اصلاح موجودی ثبت شد.`
          : `تغییرات «${name}» ذخیره شد.`
      );
      return { ok: true };
    },
    [ledger, mutateLedger, showToast]
  );

  const restockProduct = useCallback(
    (
      productId: string,
      quantity: number,
      unitCost: number,
      unitSellPrice: number,
      supplierName: string,
      note: string
    ): { ok: boolean; error?: string } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, error: 'تعداد ورود باید بیشتر از صفر باشد.' };
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return { ok: false, error: 'قیمت خرید واحد نامعتبر است.' };
      }
      if (!Number.isFinite(unitSellPrice) || unitSellPrice < 0) {
        return { ok: false, error: 'قیمت فروش واحد نامعتبر است.' };
      }

      const uid = ledger.profile.ownerId;
      const nowMs = Date.now();
      const newBatch: PurchaseBatch = {
        id: createSafeId('bat'),
        ownerId: uid,
        productId,
        initialQty: quantity,
        remainingQty: quantity,
        unitCost: Math.round(unitCost),
        unitSellPrice: Math.round(unitSellPrice),
        source: 'restock',
        supplierName: supplierName.trim().slice(0, 120),
        note: note.trim().slice(0, 300),
        purchasedAt: nowMs,
      };

      mutateLedger((prev) => ({
        ...prev,
        batches: [...prev.batches, newBatch],
      }));

      const prod = ledger.products.find((p) => p.id === productId);
      showToast(`سری جدید برای «${prod?.name ?? 'کالا'}» ثبت شد.`);
      return { ok: true };
    },
    [ledger, mutateLedger, showToast]
  );

  const adjustProductStock = useCallback(
    (
      productId: string,
      targetStock: number,
      unitCost: number,
      reason: string
    ): { ok: boolean; error?: string } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      if (!Number.isFinite(targetStock) || targetStock < 0) {
        return { ok: false, error: 'موجودی هدف نمی‌تواند منفی باشد.' };
      }
      const product = ledger.products.find((p) => p.id === productId);
      const uid = ledger.profile.ownerId;
      const nowMs = Date.now();
      const safeReason = (reason.trim() || 'اصلاح دستی موجودی').slice(0, 300);

      const plan = computeStockAdjustmentPlan(
        productId,
        targetStock,
        unitCost || getProductAvgCost(productId, ledger.batches),
        ledger.batches,
        safeReason,
        nowMs,
        product?.sellPrice
      );

      if (plan.delta === 0) {
        return { ok: false, error: 'موجودی واردشده با موجودی فعلی برابر است.' };
      }

      const newBatchId = plan.newBatch ? createSafeId('bat') : null;
      const adjId = createSafeId('adj');

      mutateLedger((prev) => {
        const nextBatches = [...plan.updatedBatches];
        if (plan.newBatch && newBatchId) {
          nextBatches.push({
            id: newBatchId,
            ownerId: uid,
            ...plan.newBatch,
          });
        }
        return {
          ...prev,
          batches: nextBatches,
          adjustments: [
            {
              id: adjId,
              ownerId: uid,
              productId,
              delta: plan.delta,
              unitCost: Math.max(0, Math.round(unitCost)),
              reason: safeReason,
              adjustedAt: nowMs,
            },
            ...prev.adjustments,
          ],
        };
      });

      showToast('اصلاح موجودی ثبت شد.');
      return { ok: true };
    },
    [ledger, mutateLedger, showToast]
  );

  // --- Sales (Multi-price FIFO + Void Restore) ---
  const recordSale = useCallback(
    (input: RecordSaleInput): { ok: boolean; error?: string; sale?: Sale } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      const product = ledger.products.find((p) => p.id === input.productId);
      if (!product) return { ok: false, error: 'کالا یافت نشد.' };

      const sim = simulateFifoSale(
        product.id,
        input.quantity,
        input.unitPrice,
        ledger.batches,
        {
          useBatchSellPrices: input.useBatchSellPrices,
          targetBatchId: input.targetBatchId,
        }
      );

      if (!sim.ok) {
        return { ok: false, error: sim.error };
      }

      const uid = ledger.profile.ownerId;
      const newSale: Sale = {
        id: createSafeId('sale'),
        ownerId: uid,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: input.quantity,
        unitPrice: sim.effectiveUnitPrice,
        revenue: sim.revenue,
        cogs: sim.cogs,
        profit: sim.profit,
        marginPercent: sim.marginPercent,
        channel: input.channel,
        customerId: input.customerId.slice(0, 128),
        customerName: (
          input.customerName.trim() || getDefaultCustomerNameForChannel(input.channel)
        ).slice(0, 120),
        status: 'completed',
        soldAt: Date.now(),
        consumedBatches: sim.consumedBatches,
      };

      mutateLedger((prev) => ({
        ...prev,
        batches: sim.updatedBatches,
        sales: [newSale, ...prev.sales],
      }));

      showToast(`فروش «${product.name}» ثبت شد.`);
      return { ok: true, sale: newSale };
    },
    [ledger, mutateLedger, showToast]
  );

  const voidSale = useCallback(
    (saleId: string): { ok: boolean; error?: string } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      const target = ledger.sales.find((s) => s.id === saleId);
      if (!target) return { ok: false, error: 'فروش مورد نظر یافت نشد.' };
      if (target.status === 'voided') return { ok: false, error: 'این فروش قبلاً باطل شده است.' };

      const restored = restoreVoidedSaleBatches(target, ledger.batches);

      mutateLedger((prev) => ({
        ...prev,
        batches: restored.updatedBatches,
        sales: prev.sales.map((s) => (s.id === saleId ? { ...s, status: 'voided' } : s)),
      }));

      showToast(`فروش «${target.productName}» باطل شد و موجودی برگشت.`);
      return { ok: true };
    },
    [ledger, mutateLedger, showToast]
  );

  // --- Contacts ---
  const saveContact = useCallback(
    (input: SaveContactInput): { ok: boolean; error?: string } => {
      if (!ledger) return { ok: false, error: 'دفتری باز نیست.' };
      const name = input.name.trim();
      if (!name) return { ok: false, error: 'نام مخاطب الزامی است.' };

      const uid = ledger.profile.ownerId;
      const isEdit = Boolean(input.id);
      const contactId = input.id ?? createSafeId('cnt');

      const payload: Contact = {
        id: contactId,
        ownerId: uid,
        type: input.type,
        name: name.slice(0, 120),
        handle: input.handle.trim().slice(0, 80),
        phone: input.phone.trim().slice(0, 32),
        notes: input.notes.trim().slice(0, 500),
        createdAtMs: Date.now(),
      };

      mutateLedger((prev) => ({
        ...prev,
        contacts: isEdit
          ? prev.contacts.map((c) => (c.id === contactId ? { ...c, ...payload } : c))
          : [payload, ...prev.contacts],
      }));

      showToast(isEdit ? `«${payload.name}» ویرایش شد.` : `«${payload.name}» اضافه شد.`);
      return { ok: true };
    },
    [ledger, mutateLedger, showToast]
  );

  const deleteContact = useCallback(
    (contactId: string) => {
      mutateLedger((prev) => ({
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== contactId),
      }));
      showToast('مخاطب حذف شد.');
    },
    [mutateLedger, showToast]
  );

  const value = useMemo<LedgerContextValue>(
    () => ({
      ready,
      isConfigured: Boolean(ledger),
      ledger,
      toastMessage,
      clearToast,
      showToast,
      startStore,
      exportBackup,
      previewBackup,
      restoreBackup,
      setCurrency,
      setTheme,
      updateStoreProfile,
      addProduct,
      updateProduct,
      restockProduct,
      adjustProductStock,
      recordSale,
      voidSale,
      saveContact,
      deleteContact,
    }),
    [
      ready,
      ledger,
      toastMessage,
      clearToast,
      showToast,
      startStore,
      exportBackup,
      previewBackup,
      restoreBackup,
      setCurrency,
      setTheme,
      updateStoreProfile,
      addProduct,
      updateProduct,
      restockProduct,
      adjustProductStock,
      recordSale,
      voidSale,
      saveContact,
      deleteContact,
    ]
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used inside LedgerProvider');
  return ctx;
}
