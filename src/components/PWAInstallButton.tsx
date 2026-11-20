import React, { useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="نصب اپلیکیشن میزان روی گوشی"
        className={
          compact
            ? 'min-w-[36px] min-h-[36px] rounded-full bg-[#9A5B13] text-white shadow-sm shadow-amber-900/25 flex items-center justify-center active:scale-95 transition-transform cursor-pointer'
            : 'w-full min-h-[42px] px-3 rounded-2xl bg-[#9A5B13] hover:bg-[#7F4A0E] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer'
        }
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        {!compact && <span>نصب اپلیکیشن</span>}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="راهنمای نصب میزان روی آیفون"
          className={
            compact
              ? 'min-w-[36px] min-h-[36px] rounded-full bg-amber-900/10 dark:bg-amber-400/14 text-[#7F4A0E] dark:text-amber-300 flex items-center justify-center active:scale-95 transition-transform cursor-pointer'
              : 'w-full min-h-[42px] px-3 rounded-2xl bg-amber-900/8 hover:bg-amber-900/14 dark:bg-amber-400/12 text-xs font-bold text-[#7F4A0E] dark:text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer'
          }
        >
          <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!compact && <span>نصب در آیفون</span>}
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="راهنمای نصب روی آیفون"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm mizan-float-glass rounded-3xl p-5 space-y-3.5 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold">نصب میزان روی آیفون</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="بستن"
                  className="min-w-[36px] min-h-[36px] rounded-full bg-amber-900/8 dark:bg-amber-400/12 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="space-y-2 text-xs text-[#544030] dark:text-[#D9C7B6] leading-relaxed list-decimal pr-4">
                <li>
                  در مرورگر Safari روی دکمه اشتراک‌گذاری (
                  <Share className="inline w-3.5 h-3.5 mx-0.5" aria-hidden="true" /> Share) بزنید.
                </li>
                <li>
                  گزینه <strong>Add to Home Screen</strong> را انتخاب کنید.
                </li>
                <li>
                  روی <strong>Add</strong> بزنید تا آیکون میزان به صفحه اصلی اضافه شود.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-2xl bg-[#9A5B13] text-white text-xs font-bold cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-18 left-3.5 lg:top-5 lg:left-6 z-40 mizan-float-glass rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs font-bold text-[#7F4A0E] dark:text-amber-300"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>حالت آفلاین فعال است</span>
    </div>
  );
}
