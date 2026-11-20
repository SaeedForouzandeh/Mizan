import React, { useRef, useState } from 'react';
import { ArrowLeft, Scale, Upload } from 'lucide-react';
import { useLedger } from '../context/LedgerContext';
import { BUSINESS_TYPE_LABELS, type BusinessType } from '../types/mizan';

const BUSINESS_TYPES: BusinessType[] = [
  'shop',
  'online',
  'boutique',
  'cafe',
  'restaurant',
  'other',
];

export function WelcomeScreen() {
  const { startStore, restoreBackup } = useLedger();
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('online');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleStart = () => {
    setError(null);
    const chosenName = storeName.trim();
    if (!chosenName) {
      setError('نام فروشگاه یا کسب‌وکار خود را بنویسید.');
      return;
    }
    startStore(chosenName, businessType);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const text = await file.text();
    const res = restoreBackup(text);
    if (!res.ok) {
      setError(res.error ?? 'بازیابی فایل پشتیبان ناموفق بود.');
    }
    e.target.value = '';
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#FAF6F0] dark:bg-[#14110E] text-[#261B12] dark:text-[#F5EFE6] overflow-hidden">
      {/* Two soft blurred amber orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-24 -right-24 w-80 h-80 rounded-full bg-amber-400/24 dark:bg-amber-600/16 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-28 -left-24 w-80 h-80 rounded-full bg-amber-600/20 dark:bg-amber-800/16 blur-3xl"
      />

      <main className="relative z-10 w-full max-w-sm mizan-float-glass rounded-3xl p-6 space-y-5">
        {/* Compact Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl mizan-btn-primary flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">میزان</h1>
            <p className="text-xs text-[#6E5643] dark:text-[#B8A593]">
              موجودی انبار و سود فروش
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleStart();
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <label htmlFor="welcome-store-name" className="block text-xs font-bold mb-1.5">
              نام فروشگاه یا پیج شما
            </label>
            <input
              id="welcome-store-name"
              type="text"
              value={storeName}
              onChange={(e) => {
                setStoreName(e.target.value);
                setError(null);
              }}
              placeholder="مثلاً: فروشگاه آفتاب"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-white/85 dark:bg-[#1A1511] border border-amber-900/15 dark:border-amber-200/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A5B13]"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold">نوع کسب‌وکار</legend>
            <div className="grid grid-cols-3 gap-2">
              {BUSINESS_TYPES.map((bt) => {
                const active = businessType === bt;
                return (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setBusinessType(bt)}
                    aria-pressed={active}
                    className={`min-h-[42px] px-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#9A5B13] text-white border-[#9A5B13]'
                        : 'bg-white/65 dark:bg-[#1A1511]/85 border-amber-900/12 dark:border-amber-200/12'
                    }`}
                  >
                    {BUSINESS_TYPE_LABELS[bt]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl mizan-btn-primary text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>شروع کار</span>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>

        <div className="pt-3 border-t border-amber-900/10 dark:border-amber-200/10">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleFileChange(e)}
            className="sr-only"
            id="welcome-backup-file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] rounded-2xl mizan-btn-glass text-xs font-bold text-[#6E5643] dark:text-[#D9C7B6] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>بازیابی از فایل پشتیبان</span>
          </button>
        </div>
      </main>
    </div>
  );
}
