import React, { useState } from 'react';
import type { CurrencyMode } from '../types/mizan';
import type { SalesChartPoint } from '../utils/analytics';
import { formatMoney } from '../utils/formatters';

interface SparklineProps {
  points: Array<{ label: string; profit: number; revenue: number }>;
  currency: CurrencyMode;
}

export function ProfitSparkline({ points, currency }: SparklineProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 360;
  const height = 56;
  const padX = 8;
  const padY = 10;

  const values = points.map((p) => p.profit);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1, ...values);
  const span = Math.max(1, maxVal - minVal);

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (idx / (points.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (p.profit - minVal) / span) * (height - padY * 2);
    return { x, y, ...p };
  });

  const pathD = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaD =
    coords.length > 1
      ? `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`
      : '';

  const activePoint = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="w-full pt-3 border-t border-amber-900/10 dark:border-amber-200/10">
      <div className="flex items-center justify-between text-xs text-[#6E5643] dark:text-[#B8A593] mb-1.5">
        <span>روند سود ۷ روز گذشته</span>
        {activePoint && (
          <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
            {activePoint.label}: {formatMoney(activePoint.profit, currency)}
          </span>
        )}
      </div>
      <div className="relative w-full h-14">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`نمودار خطی سود هفت روز گذشته. بیشترین سود روزانه ${formatMoney(maxVal, currency)}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sparkProfitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {areaD && <path d={areaD} fill="url(#sparkProfitFill)" />}
          <path
            d={pathD}
            fill="none"
            stroke="#16A34A"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map((c, idx) => (
            <g key={c.label}>
              <circle
                cx={c.x}
                cy={c.y}
                r={hoveredIdx === idx ? 4.5 : 2.5}
                className="fill-emerald-600 dark:fill-emerald-400 transition-all"
              />
              <rect
                x={Math.max(0, c.x - 20)}
                y={0}
                width={40}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          ))}
        </svg>
      </div>
      {/* Screen-reader textual summary */}
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.label}>
            {p.label}: سود {formatMoney(p.profit, currency)}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SalesChartProps {
  points: SalesChartPoint[];
  currency: CurrencyMode;
  mode: 'daily' | 'monthly';
}

export function SalesChart({ points, currency, mode }: SalesChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const width = 640;
  const height = 210;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 34;

  const maxRev = Math.max(1, ...points.map((p) => p.revenue));
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const slotW = chartW / Math.max(1, points.length);
  const barW = Math.min(32, Math.max(10, slotW * 0.52));

  const highlighted =
    activeIdx !== null ? points[activeIdx] : points[points.length - 1] ?? null;

  return (
    <div className="w-full space-y-3">
      {highlighted && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E5643] dark:text-[#B8A593]">
          <span>
            بازه انتخابی ({mode === 'daily' ? '۱۴ روز اخیر' : '۶ ماه اخیر'}):{' '}
            <strong className="text-[#261B12] dark:text-[#F5EFE6]">{highlighted.label}</strong>
          </span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>
              درآمد:{' '}
              <strong className="text-[#9A5B13] dark:text-amber-400">
                {formatMoney(highlighted.revenue, currency)}
              </strong>
            </span>
            <span>
              سود:{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatMoney(highlighted.profit, currency)}
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[320px] h-52"
          role="img"
          aria-label={`نمودار فروش ${mode === 'daily' ? 'روزانه' : 'ماهانه'}`}
        >
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + chartH * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-amber-900/10 dark:text-amber-100/10"
                strokeDasharray="3 4"
              />
            );
          })}

          {points.map((pt, idx) => {
            const centerX = padLeft + slotW * idx + slotW / 2;
            const revH = (pt.revenue / maxRev) * chartH;
            const profH = Math.max(0, (pt.profit / maxRev) * chartH);
            const revY = padTop + chartH - revH;
            const profY = padTop + chartH - profH;
            const isHovered = activeIdx === idx;
            const showLabel =
              points.length <= 7 || idx % 2 === 0 || idx === points.length - 1;

            return (
              <g
                key={`${pt.label}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => setActiveIdx(idx)}
              >
                <rect
                  x={centerX - slotW / 2}
                  y={padTop}
                  width={slotW}
                  height={chartH}
                  fill={isHovered ? 'rgba(180, 105, 23, 0.08)' : 'transparent'}
                  rx={8}
                />
                {/* Revenue bar */}
                <rect
                  x={centerX - barW / 2}
                  y={revY}
                  width={barW}
                  height={Math.max(2, revH)}
                  rx={6}
                  className={
                    isHovered
                      ? 'fill-[#9A5B13] dark:fill-amber-400 transition-colors'
                      : 'fill-[#C98532]/75 dark:fill-amber-500/60 transition-colors'
                  }
                />
                {/* Profit inner accent bar */}
                {profH > 1 && (
                  <rect
                    x={centerX - barW / 2 + 2}
                    y={profY}
                    width={Math.max(4, barW - 4)}
                    height={Math.max(2, profH)}
                    rx={4}
                    className="fill-emerald-600/85 dark:fill-emerald-400/85"
                  />
                )}
                {showLabel && (
                  <text
                    x={centerX}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#6E5643] dark:fill-[#B8A593] text-[10px]"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-5 text-xs text-[#6E5643] dark:text-[#B8A593]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm bg-[#C98532]" aria-hidden="true" />
          درآمد فروش
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm bg-emerald-600" aria-hidden="true" />
          سود خالص
        </span>
      </div>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>جدول داده‌های نمودار فروش</caption>
        <thead>
          <tr>
            <th>تاریخ</th>
            <th>درآمد</th>
            <th>سود خالص</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt, i) => (
            <tr key={`${pt.label}-${i}`}>
              <td>{pt.label}</td>
              <td>{formatMoney(pt.revenue, currency)}</td>
              <td>{formatMoney(pt.profit, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DualLineChartProps {
  points: SalesChartPoint[];
  currency: CurrencyMode;
}

export function DualLineProfitChart({ points, currency }: DualLineChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const width = 640;
  const height = 230;
  const padX = 24;
  const padTop = 20;
  const padBottom = 36;

  const maxVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.revenue, p.profit, 0))
  );
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const mapped = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (idx / (points.length - 1)) * chartW;
    const revY = padTop + chartH - (Math.max(0, p.revenue) / maxVal) * chartH;
    const profY = padTop + chartH - (Math.max(0, p.profit) / maxVal) * chartH;
    return { x, revY, profY, ...p };
  });

  const revPath = mapped
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${m.x.toFixed(1)} ${m.revY.toFixed(1)}`)
    .join(' ');
  const profPath = mapped
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${m.x.toFixed(1)} ${m.profY.toFixed(1)}`)
    .join(' ');

  const current = activeIdx !== null ? mapped[activeIdx] : mapped[mapped.length - 1];

  return (
    <div className="w-full space-y-3">
      {current && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E5643] dark:text-[#B8A593]">
          <span>
            نقطه انتخاب‌شده:{' '}
            <strong className="text-[#261B12] dark:text-[#F5EFE6]">{current.label}</strong>
          </span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>
              درآمد:{' '}
              <strong className="text-[#9A5B13] dark:text-amber-400">
                {formatMoney(current.revenue, currency)}
              </strong>
            </span>
            <span>
              سود خالص:{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatMoney(current.profit, currency)}
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[320px] h-56"
          role="img"
          aria-label="نمودار دوخطی مقایسه درآمد و سود خالص"
        >
          {[0.25, 0.5, 0.75, 1].map((r) => {
            const y = padTop + chartH * (1 - r);
            return (
              <line
                key={r}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-amber-900/10 dark:text-amber-100/10"
                strokeDasharray="3 4"
              />
            );
          })}

          <path
            d={revPath}
            fill="none"
            stroke="#B46917"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={profPath}
            fill="none"
            stroke="#16A34A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {mapped.map((m, idx) => {
            const isHovered = activeIdx === idx;
            const showLabel =
              mapped.length <= 8 || idx % 2 === 0 || idx === mapped.length - 1;
            const hitWidth = chartW / Math.max(1, mapped.length);
            return (
              <g
                key={`${m.label}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => setActiveIdx(idx)}
              >
                {isHovered && (
                  <line
                    x1={m.x}
                    x2={m.x}
                    y1={padTop}
                    y2={padTop + chartH}
                    stroke="#B46917"
                    strokeOpacity="0.3"
                    strokeDasharray="2 3"
                  />
                )}
                <circle
                  cx={m.x}
                  cy={m.revY}
                  r={isHovered ? 5 : 3}
                  className="fill-[#B46917] dark:fill-amber-400"
                />
                <circle
                  cx={m.x}
                  cy={m.profY}
                  r={isHovered ? 5 : 3}
                  className="fill-emerald-600 dark:fill-emerald-400"
                />
                <rect
                  x={m.x - hitWidth / 2}
                  y={padTop}
                  width={hitWidth}
                  height={chartH}
                  fill="transparent"
                />
                {showLabel && (
                  <text
                    x={m.x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#6E5643] dark:fill-[#B8A593] text-[10px]"
                  >
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-5 text-xs text-[#6E5643] dark:text-[#B8A593]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#B46917]" aria-hidden="true" />
          درآمد
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-emerald-600" aria-hidden="true" />
          سود خالص
        </span>
      </div>

      <table className="sr-only">
        <caption>جدول مقایسه درآمد و سود خالص</caption>
        <thead>
          <tr>
            <th>تاریخ</th>
            <th>درآمد</th>
            <th>سود خالص</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, idx) => (
            <tr key={`${p.label}-${idx}`}>
              <td>{p.label}</td>
              <td>{formatMoney(p.revenue, currency)}</td>
              <td>{formatMoney(p.profit, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
