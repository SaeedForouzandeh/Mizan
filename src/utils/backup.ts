import type { LedgerState } from '../types/mizan';

export interface MizanBackupEnvelope {
  app: 'mizan';
  version: 1;
  exportedAt: number;
  data: LedgerState;
}

export function serializeLedgerBackup(ledger: LedgerState, nowMs: number = Date.now()): string {
  const payload: MizanBackupEnvelope = {
    app: 'mizan',
    version: 1,
    exportedAt: nowMs,
    data: {
      ...ledger,
      profile: {
        ...ledger.profile,
        authMode: 'local',
        lastBackupAt: nowMs,
      },
    },
  };
  return JSON.stringify(payload, null, 2);
}

export type BackupParseResult =
  | {
      ok: true;
      exportedAt: number;
      ledger: LedgerState;
      stats: {
        products: number;
        batches: number;
        sales: number;
        contacts: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

export function parseLedgerBackup(rawJson: string): BackupParseResult {
  try {
    const parsed = JSON.parse(rawJson) as Partial<MizanBackupEnvelope>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'ساختار فایل پشتیبان معتبر نیست.' };
    }
    if (parsed.app !== 'mizan' || !parsed.data || typeof parsed.data !== 'object') {
      return { ok: false, error: 'این فایل مربوط به پشتیبان برنامه میزان نیست.' };
    }

    const d = parsed.data as Partial<LedgerState>;
    if (
      !d.profile ||
      typeof d.profile.storeName !== 'string' ||
      !Array.isArray(d.products) ||
      !Array.isArray(d.batches) ||
      !Array.isArray(d.sales) ||
      !Array.isArray(d.contacts)
    ) {
      return { ok: false, error: 'اطلاعات فایل پشتیبان ناقص است و قابل بازیابی نیست.' };
    }

    const sanitizedLedger: LedgerState = {
      profile: {
        ownerId: d.profile.ownerId || 'mizan_store_local',
        storeName: d.profile.storeName.trim() || 'میزان',
        businessType: d.profile.businessType || 'cafe',
        email: d.profile.email || '',
        currency: d.profile.currency === 'rial' ? 'rial' : 'toman',
        theme: d.profile.theme === 'dark' ? 'dark' : 'light',
        authMode: 'local',
        lastBackupAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      },
      products: d.products,
      batches: d.batches,
      sales: d.sales,
      contacts: d.contacts,
      adjustments: Array.isArray(d.adjustments) ? d.adjustments : [],
    };

    return {
      ok: true,
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      ledger: sanitizedLedger,
      stats: {
        products: sanitizedLedger.products.length,
        batches: sanitizedLedger.batches.length,
        sales: sanitizedLedger.sales.length,
        contacts: sanitizedLedger.contacts.length,
      },
    };
  } catch {
    return { ok: false, error: 'فایل انتخاب‌شده JSON معتبر نیست.' };
  }
}

export function buildBackupFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `mizan-backup-${y}-${m}-${d}.json`;
}
