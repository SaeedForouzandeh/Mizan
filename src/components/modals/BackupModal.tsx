import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { BUSINESS_TYPE_LABELS, type BusinessType } from '../../types/mizan';
import { formatJalaliShortDate } from '../../utils/formatters';
import { ModalFrame } from './ModalFrame';

const BUSINESS_TYPES: BusinessType[] = [
  'cafe',
  'restaurant',
  'shop',
  'boutique',
  'online',
  'other',
];

interface BackupModalProps {
  open: boolean;
  onClose: () => void;
}

export function BackupModal({ open, onClose }: BackupModalProps) {
  const {
    ledger,
    exportBackup,
    previewBackup,
    restoreBackup,
    updateStoreProfile,
  } = useLedger();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('cafe');
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [pendingSummary, setPendingSummary] = useState<{
    storeName: string;
    products: number;
    batches: number;
    sales: number;
    contacts: number;
    exportedAt: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ledger) return;
    setStoreName(ledger.profile.storeName);
    setBusinessType(ledger.profile.businessType);
    setPendingJson(null);
    setPendingSummary(null);
    setError(null);
  }, [open, ledger]);

  const handleDownloadBackup = () => {
    setError(null);
    const result = exportBackup();
    if (!result) return;
    const blob = new Blob([result.content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const text = await file.text();
    const parsed = previewBackup(text);
    if (!parsed.ok) {
      setPendingJson(null);
      setPendingSummary(null);
      setError(parsed.error);
    } else {
      setPendingJson(text);
      setPendingSummary({
        storeName: parsed.ledger.profile.storeName,
        products: parsed.stats.products,
        batches: parsed.stats.batches,
        sales: parsed.stats.sales,
        contacts: parsed.stats.contacts,
        exportedAt: parsed.exportedAt,
      });
    }
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!pendingJson) return;
    const res = restoreBackup(pendingJson);
    if (!res.ok) {
      setError(res.error ?? 'خطا در بازیابی پشتیبان.');
      return;
    }
    onClose();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateStoreProfile(storeName, businessType);
  };

  const lastBackupAt = ledger?.profile.lastBackupAt;

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      title="پشتیبان‌گیری و فروشگاه"
      subtitle="دانلود بکاپ، بازیابی فایل و تنظیم نام فروشگاه"
    >
      <div className="space-y-5">
        {/* Backup & Restore Card */}
        <section className="rounded-2xl p-4 bg-amber-500/10 dark:bg-amber-500/12 border border-amber-700/20 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#7F4A0E] dark:text-amber-300">
              نسخه پشتیبان (Backup)
            </h3>
            <span className="text-[11px] text-[#6E5643] dark:text-[#B8A593]">
              {lastBackupAt
                ? `آخرین بکاپ: ${formatJalaliShortDate(lastBackupAt)}`
                : 'هنوز بکاپ گرفته نشده'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="min-h-[46px] px-4 rounded-xl mizan-btn-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>دانلود فایل پشتیبان</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => void handleSelectBackupFile(e)}
              className="sr-only"
              id="modal-backup-file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[46px] px-4 rounded-xl mizan-btn-glass text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>بازیابی از فایل</span>
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          {pendingSummary && (
            <div className="rounded-xl p-3.5 bg-emerald-500/12 border border-emerald-700/25 space-y-2.5">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>فایل پشتیبان «{pendingSummary.storeName}» معتبر است</span>
              </p>
              <p className="text-xs text-[#544030] dark:text-[#D9C7B6] tabular-nums">
                {pendingSummary.products} کالا · {pendingSummary.batches} سری خرید · {pendingSummary.sales} فروش · {pendingSummary.contacts} مخاطب
              </p>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="w-full min-h-[42px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تأیید و جایگزینی اطلاعات فعلی</span>
              </button>
            </div>
          )}
        </section>

        {/* Store Profile Quick Edit */}
        <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
          <h3 className="text-xs font-bold text-[#6E5643] dark:text-[#B8A593]">
            مشخصات فروشگاه
          </h3>

          <div>
            <label htmlFor="settings-store-name" className="block text-xs font-semibold mb-1">
              نام فروشگاه
            </label>
            <input
              id="settings-store-name"
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/85 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {BUSINESS_TYPES.map((bt) => {
              const active = businessType === bt;
              return (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBusinessType(bt)}
                  aria-pressed={active}
                  className={`min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#9A5B13] text-white border-[#9A5B13]'
                      : 'bg-white/60 dark:bg-[#1A1511] border-amber-900/12 dark:border-amber-200/12'
                  }`}
                >
                  {BUSINESS_TYPE_LABELS[bt]}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl mizan-btn-glass text-xs font-bold text-[#7F4A0E] dark:text-amber-300 cursor-pointer"
          >
            ذخیره مشخصات فروشگاه
          </button>
        </form>
      </div>
    </ModalFrame>
  );
}
