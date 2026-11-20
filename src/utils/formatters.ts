import type { CurrencyMode } from '../types/mizan';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts Persian/Arabic digits in user input to standard Latin digits for parsing.
 */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,٬\s]/g, '');
}

export function parseNumericInput(input: string): number {
  const cleaned = normalizeDigits(input);
  const val = Number(cleaned);
  return Number.isFinite(val) ? val : 0;
}

/**
 * Normalizes a Persian store/business name for storage.
 *
 * - Converts Arabic Yeh/Kaf (ي / ك, which many Android keyboards produce)
 *   to Persian Yeh/Kaf (ی / ک).
 * - Strips invisible characters (zero-width joiner/non-joiner, BOM) and
 *   whitespace from both ends, so a name typed with the Persian keyboard
 *   is never treated as empty.
 * - Keeps ZWNJ inside the name (e.g. «می‌خواهم») untouched.
 */
export function normalizeStoreName(input: string): string {
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/^[\s\u200B\u200C\u200D\uFEFF]+|[\s\u200B\u200C\u200D\uFEFF]+$/g, '');
}

/**
 * Formats integer/decimal numbers with Latin thousands separators for clean legibility
 * (e.g. "1,200,000").
 */
export function formatCommaNumber(value: number, maxDecimals = 1): string {
  const rounded =
    Math.abs(value - Math.round(value)) < 0.001
      ? Math.round(value)
      : Number(value.toFixed(maxDecimals));
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
  }).format(rounded);
}

/**
 * Converts a canonical Toman amount to the user's selected currency (Toman or Rial)
 * and formats it directly as "1,200,000 تومان" or "12,000,000 ریال".
 */
export function formatMoney(amountInToman: number, currency: CurrencyMode): string {
  const unitLabel = currency === 'toman' ? 'تومان' : 'ریال';
  const multiplier = currency === 'toman' ? 1 : 10;
  const raw = Math.round(amountInToman * multiplier);
  const sign = raw < 0 ? '−' : '';
  const abs = Math.abs(raw);

  if (abs === 0) {
    return `0 ${unitLabel}`;
  }

  return `${sign}${formatCommaNumber(abs, 0)} ${unitLabel}`;
}

/**
 * Converts display-currency user input back into canonical Toman for storage.
 */
export function inputToToman(amountInDisplayCurrency: number, currency: CurrencyMode): number {
  if (!Number.isFinite(amountInDisplayCurrency) || amountInDisplayCurrency < 0) return 0;
  return currency === 'toman'
    ? Math.round(amountInDisplayCurrency)
    : Math.round(amountInDisplayCurrency / 10);
}

/**
 * Converts canonical Toman to display-currency numeric value for editing inputs.
 */
export function tomanToDisplayNumber(amountInToman: number, currency: CurrencyMode): number {
  return currency === 'toman' ? Math.round(amountInToman) : Math.round(amountInToman * 10);
}

/**
 * Formats quantity nicely (up to 2 decimal places when fractional, integer otherwise).
 */
export function formatQty(qty: number): string {
  const rounded = Math.round(qty * 100) / 100;
  return formatCommaNumber(rounded, 2);
}

/**
 * Formats percentage with sign/precision.
 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0٪';
  const rounded = Math.round(value * 10) / 10;
  return `${formatCommaNumber(rounded, 1)}٪`;
}

/**
 * Returns time-of-day Persian greeting based on hour (0-23).
 */
export function getGreetingByHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'صبح بخیر';
  if (hour >= 12 && hour < 19) return 'وقت بخیر';
  return 'شب بخیر';
}

/**
 * Formats a Date into a full Jalali (Shamsi) Persian date string, e.g. "پنجشنبه ۲۹ آبان ۱۴۰۵".
 */
export function formatJalaliFullDate(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const weekday = get('weekday');
    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (weekday && day && month && year) {
      return `${weekday}، ${day} ${month} ${year}`;
    }
    return parts.map((p) => p.value).join('');
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
}

/**
 * Formats a timestamp into a compact Jalali date + time for sales rows and logs.
 */
export function formatJalaliShortDate(timestampMs: number): string {
  const date = new Date(timestampMs);
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
}

export function formatJalaliDayLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

export function formatJalaliMonthLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'short',
      year: '2-digit',
    }).format(date);
  } catch {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
  }
}

export function toPersianDigits(text: string | number): string {
  return String(text).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/**
 * Generates a Firestore-safe ID matching ^[a-zA-Z0-9_\-]+$.
 */
export function createSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}
