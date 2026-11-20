import React from 'react';
import {
  BarChart3,
  Coins,
  DatabaseBackup,
  LayoutDashboard,
  Moon,
  Package,
  ReceiptText,
  Scale,
  Sun,
  Users,
} from 'lucide-react';
import { useLedger } from '../context/LedgerContext';
import type { NavTab } from '../types/mizan';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { id: 'inventory', label: 'انبار', icon: Package },
  { id: 'sales', label: 'فروش‌ها', icon: ReceiptText },
  { id: 'analytics', label: 'تحلیل سود', icon: BarChart3 },
  { id: 'contacts', label: 'مخاطبین', icon: Users },
];

interface LayoutShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenBackup: () => void;
  children: React.ReactNode;
}

export function LayoutShell({
  activeTab,
  onSelectTab,
  onOpenBackup,
  children,
}: LayoutShellProps) {
  const { ledger, setCurrency, setTheme, toastMessage, clearToast } = useLedger();

  const storeName = ledger?.profile.storeName?.trim() || 'میزان';
  const currency = ledger?.profile.currency ?? 'toman';
  const theme = ledger?.profile.theme ?? 'light';

  const toggleCurrency = () => {
    setCurrency(currency === 'toman' ? 'rial' : 'toman');
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="relative min-h-screen bg-[#FAF6F0] dark:bg-[#14110E] text-[#261B12] dark:text-[#F5EFE6]">
      {/* Two subtle blurred amber light orbs in top and bottom corners */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 -right-28 w-[26rem] h-[26rem] rounded-full bg-amber-400/24 dark:bg-amber-600/16 blur-3xl z-0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-36 -left-24 w-[28rem] h-[28rem] rounded-full bg-amber-500/20 dark:bg-amber-800/16 blur-3xl z-0"
      />

      {/* Mobile Floating Top Bar — Deep iOS / Telegram liquid-glass island */}
      <div className="lg:hidden sticky top-2.5 z-30 px-3 pt-[env(safe-area-inset-top)] pointer-events-none">
        <header className="pointer-events-auto h-12 px-2.5 rounded-full mizan-float-glass flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 pr-0.5">
            <div className="w-8 h-8 rounded-full mizan-btn-primary flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-extrabold text-sm truncate">{storeName}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleCurrency}
              aria-label={`تغییر واحد پول، اکنون ${currency === 'toman' ? 'تومان' : 'ریال'}`}
              className="min-h-[36px] px-3 rounded-full bg-amber-900/8 hover:bg-amber-900/14 dark:bg-amber-400/12 dark:hover:bg-amber-400/20 border border-white/60 dark:border-amber-200/12 text-xs font-bold text-[#7F4A0E] dark:text-amber-300 whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              {currency === 'toman' ? 'تومان' : 'ریال'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'تغییر به حالت شب' : 'تغییر به حالت روز'}
              className="min-w-[36px] min-h-[36px] rounded-full bg-amber-900/8 hover:bg-amber-900/14 dark:bg-amber-400/12 dark:hover:bg-amber-400/20 border border-white/60 dark:border-amber-200/12 flex items-center justify-center text-[#7F4A0E] dark:text-amber-300 active:scale-95 transition-all cursor-pointer"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onOpenBackup}
              aria-label="پشتیبان‌گیری و تنظیمات فروشگاه"
              className="min-w-[36px] min-h-[36px] rounded-full bg-amber-900/8 hover:bg-amber-900/14 dark:bg-amber-400/12 dark:hover:bg-amber-400/20 border border-white/60 dark:border-amber-200/12 flex items-center justify-center text-[#7F4A0E] dark:text-amber-300 active:scale-95 transition-all cursor-pointer"
            >
              <DatabaseBackup className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </header>
      </div>

      <OfflineIndicator />

      <div className="relative z-10 flex min-h-screen">
        {/* Desktop Floating Glass Right Sidebar (in RTL, first flex child sits on the RIGHT edge) */}
        <aside
          aria-label="منوی اصلی"
          className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 sticky top-0 h-screen p-4"
        >
          <div className="mizan-float-glass rounded-[30px] flex flex-col justify-between h-full p-4">
            <div className="space-y-6">
              {/* Store Name Brand Header */}
              <div className="flex items-center gap-3 px-2 pt-1">
                <div className="w-10 h-10 rounded-2xl mizan-btn-primary flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-base truncate leading-tight">{storeName}</p>
                  <p className="text-xs text-[#6E5643] dark:text-[#B8A593] truncate">
                    دفتر زنده میزان
                  </p>
                </div>
              </div>

              {/* 5 Navigation Destinations */}
              <nav aria-label="بخش‌های برنامه" className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTab(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full min-h-[46px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        active
                          ? 'mizan-btn-primary font-bold'
                          : 'text-[#544030] dark:text-[#D9C7B6] hover:bg-amber-900/8 dark:hover:bg-amber-400/10 active:scale-[0.98]'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" aria-hidden={true} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Setting Rows: Currency + Display Mode + Install + Backup */}
            <div className="space-y-2.5 pt-4 border-t border-amber-900/10 dark:border-amber-200/10">
              {/* Row 1: Currency */}
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">
                  <Coins className="w-4 h-4" aria-hidden="true" />
                  <span>واحد پول</span>
                </span>
                <div
                  role="group"
                  aria-label="انتخاب واحد پول"
                  className="inline-flex p-0.5 rounded-full bg-amber-900/8 dark:bg-amber-200/10"
                >
                  <button
                    type="button"
                    onClick={() => setCurrency('toman')}
                    aria-pressed={currency === 'toman'}
                    aria-label="واحد پول تومان"
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      currency === 'toman'
                        ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                        : 'text-[#6E5643] dark:text-[#B8A593]'
                    }`}
                  >
                    تومان
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('rial')}
                    aria-pressed={currency === 'rial'}
                    aria-label="واحد پول ریال"
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      currency === 'rial'
                        ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                        : 'text-[#6E5643] dark:text-[#B8A593]'
                    }`}
                  >
                    ریال
                  </button>
                </div>
              </div>

              {/* Row 2: Display Theme */}
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-[#6E5643] dark:text-[#B8A593]">
                  {theme === 'light' ? (
                    <Sun className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Moon className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>حالت نمایش</span>
                </span>
                <div
                  role="group"
                  aria-label="انتخاب حالت نمایش"
                  className="inline-flex p-0.5 rounded-full bg-amber-900/8 dark:bg-amber-200/10"
                >
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    aria-pressed={theme === 'light'}
                    aria-label="حالت روز"
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                        : 'text-[#6E5643] dark:text-[#B8A593]'
                    }`}
                  >
                    روز
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    aria-pressed={theme === 'dark'}
                    aria-label="حالت شب"
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-white dark:bg-[#2E241C] text-[#261B12] dark:text-[#F5EFE6] shadow-xs'
                        : 'text-[#6E5643] dark:text-[#B8A593]'
                    }`}
                  >
                    شب
                  </button>
                </div>
              </div>

              <PWAInstallButton />

              <button
                type="button"
                onClick={onOpenBackup}
                className="w-full min-h-[42px] px-3 rounded-2xl mizan-btn-glass text-xs font-bold text-[#7F4A0E] dark:text-amber-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <DatabaseBackup className="w-4 h-4" aria-hidden="true" />
                <span>پشتیبان‌گیری و بازیابی</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pt-4 pb-32 lg:py-6 lg:pb-10 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Subtle Bottom Edge Scrim so scrolled content melts cleanly beneath the floating dock */}
      <div
        aria-hidden="true"
        className="lg:hidden pointer-events-none fixed bottom-0 inset-x-0 h-24 z-20 bg-gradient-to-t from-[#FAF6F0]/88 via-[#FAF6F0]/40 to-transparent dark:from-[#14110E]/92 dark:via-[#14110E]/45 dark:to-transparent"
      />

      {/* Mobile Floating Golden Circular FAB -> Quick Inventory Access.
          Its bottom offset MUST include env(safe-area-inset-bottom): the
          bottom nav grows taller by the safe-area on gesture-navigation
          phones, so a fixed bottom value lets the nav slide over the FAB. */}
      <button
        type="button"
        onClick={() => onSelectTab('inventory')}
        aria-label="رفتن سریع به انبار"
        className="lg:hidden fixed left-3.5 bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-30 w-12 h-12 rounded-full mizan-fab text-white flex items-center justify-center cursor-pointer"
      >
        <Package className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Mobile Floating Bottom Navigation Capsule — Deep iOS / Telegram Liquid-Glass Dock */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] pointer-events-none">
        <nav
          aria-label="منوی پایین موبایل"
          className="pointer-events-auto max-w-md mx-auto h-[62px] p-1.5 rounded-[31px] mizan-bottom-nav grid grid-cols-5 items-center gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`h-full min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[24px] transition-all duration-150 active:scale-95 cursor-pointer ${
                  active
                    ? 'mizan-nav-pill-active text-[#8A4E0B] dark:text-amber-300 font-extrabold'
                    : 'text-[#6E5643] dark:text-[#B8A593] font-medium hover:bg-amber-900/6 dark:hover:bg-amber-400/8'
                }`}
              >
                <Icon
                  className={`w-[19px] h-[19px] transition-transform duration-150 ${
                    active ? 'scale-105' : ''
                  }`}
                  aria-hidden={true}
                />
                <span className="text-[10.5px] leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Accessible Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] lg:bottom-6 left-4 lg:left-6 z-50 max-w-sm w-[calc(100%-2rem)]"
        >
          <div className="mizan-float-glass rounded-full px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-medium pr-1">{toastMessage}</span>
            <button
              type="button"
              onClick={clearToast}
              aria-label="بستن پیام"
              className="text-xs text-[#9A5B13] dark:text-amber-400 font-bold shrink-0 px-2 py-1 rounded-full hover:bg-amber-900/8 cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
