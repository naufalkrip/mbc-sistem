import { useState, useMemo, useRef, useEffect } from "react";
import { formatRupiah } from "../../utils/format";

export interface MonthlyBalanceData {
  monthIndex: number; // 0 - 11
  monthName: string;  // "Januari", "Februari", ...
  shortName: string;  // "Jan", "Feb", ...
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
}

interface FinancialBarChartProps {
  title: string;
  subtitle: string;
  year: number;
  data: MonthlyBalanceData[];
  barColor?: string;
  height?: number;
}

/** Format nominal kompak untuk sumbu Y: Rp 0, Rp 1 Jt, Rp 2 Jt, dst. */
export function formatRupiahCompact(value: number): string {
  if (value === 0) return "Rp 0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    const m = abs / 1_000_000_000;
    return `${sign}Rp ${m % 1 === 0 ? m : m.toFixed(1)} M`;
  }
  if (abs >= 1_000_000) {
    const jt = abs / 1_000_000;
    return `${sign}Rp ${jt % 1 === 0 ? jt : jt.toFixed(1)} Jt`;
  }
  if (abs >= 1_000) {
    const rb = abs / 1_000;
    return `${sign}Rp ${rb % 1 === 0 ? rb : rb.toFixed(0)} Rb`;
  }
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

/** Hitung skala Y yang bulat dan rapi */
function getNiceYScale(maxValue: number, ticksCount = 4) {
  if (maxValue <= 0) {
    return {
      max: 1_000_000,
      ticks: [0, 250_000, 500_000, 750_000, 1_000_000],
    };
  }

  const roughStep = maxValue / ticksCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;

  let niceNormalized = 1;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  const step = niceNormalized * magnitude;
  const max = Math.max(step * ticksCount, Math.ceil(maxValue / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 0.001; v += step) {
    ticks.push(Math.round(v));
  }
  return { max, ticks };
}

export function FinancialBarChart({
  title,
  subtitle,
  year,
  data,
  barColor = "#dc2626",
  height = 290,
}: FinancialBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // Animasi halus saat data berganti / komponen pertama kali muncul
  useEffect(() => {
    setAnimatedProgress(0);
    let start: number | null = null;
    const duration = 450;

    let frameId: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedProgress(eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [data, year]);

  const maxSaldo = useMemo(() => {
    return Math.max(...data.map((d) => d.saldo), 0);
  }, [data]);

  const { max: yMax, ticks: yTicks } = useMemo(() => {
    return getNiceYScale(maxSaldo, 4);
  }, [maxSaldo]);

  // Dimensi visual SVG internal viewBox
  const viewBoxWidth = 560;
  const viewBoxHeight = 200;
  const chartTopPadding = 18;
  const chartBottomPadding = 16;
  const chartEffectiveHeight = viewBoxHeight - chartTopPadding - chartBottomPadding;

  const colWidth = viewBoxWidth / 12;
  const barWidth = Math.min(24, colWidth * 0.58);

  const activeItem = hoveredIdx !== null && data[hoveredIdx] ? data[hoveredIdx] : null;

  return (
    <div className="financial-bar-card">
      {/* Header Grafik */}
      <div className="financial-bar-head">
        <div className="financial-bar-titles">
          <h3 className="financial-bar-title">{title}</h3>
          <p className="financial-bar-subtitle">{subtitle}</p>
        </div>
      </div>

      {/* Area Grafik dengan Sumbu Y & Diagram Batang */}
      <div
        className="financial-bar-body"
        ref={chartWrapperRef}
        style={{ height }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Sumbu Y (Compact Labels) */}
        <div className="financial-bar-y-axis">
          {yTicks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick} className="financial-bar-y-label">
                {formatRupiahCompact(tick)}
              </span>
            ))}
        </div>

        {/* SVG Drawing Canvas */}
        <div className="financial-bar-canvas-wrap">
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="none"
            className="financial-bar-svg"
          >
            <defs>
              {/* Halus gradient untuk batang utama */}
              <linearGradient id={`bar-grad-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={barColor} stopOpacity="0.95" />
                <stop offset="100%" stopColor={barColor} stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id={`bar-hover-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#991b1c" stopOpacity="1" />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.88" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            <g className="financial-bar-grid">
              {yTicks.map((tick) => {
                const yNorm = tick / yMax;
                const yPos =
                  chartTopPadding + (1 - yNorm) * chartEffectiveHeight;
                return (
                  <line
                    key={tick}
                    x1="0"
                    y1={yPos}
                    x2={viewBoxWidth}
                    y2={yPos}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? "none" : "2 2"}
                  />
                );
              })}
            </g>

            {/* Diagram Batang (12 Bulan) */}
            {data.map((item, idx) => {
              const xCenter = (idx + 0.5) * colWidth;
              const xLeft = xCenter - barWidth / 2;
              const ratio = yMax > 0 ? Math.max(0, item.saldo) / yMax : 0;
              const targetBarHeight = ratio * chartEffectiveHeight;
              const animatedBarHeight = Math.max(
                item.saldo > 0 ? 3 : 0,
                targetBarHeight * animatedProgress
              );
              const yPos =
                chartTopPadding + chartEffectiveHeight - animatedBarHeight;
              const isHovered = hoveredIdx === idx;

              return (
                <g key={item.monthIndex} className="financial-bar-group">
                  {/* Invisible Hit Area for Easy Hovering */}
                  <rect
                    x={idx * colWidth}
                    y="0"
                    width={colWidth}
                    height={viewBoxHeight}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                  />

                  {/* Batang Saldo */}
                  {item.saldo > 0 ? (
                    <rect
                      x={xLeft}
                      y={yPos}
                      width={barWidth}
                      height={animatedBarHeight}
                      rx="4"
                      ry="4"
                      fill={
                        isHovered
                          ? `url(#bar-hover-${title.replace(/\s+/g, "-")})`
                          : `url(#bar-grad-${title.replace(/\s+/g, "-")})`
                      }
                      style={{
                        transition: "filter 0.2s ease, opacity 0.2s ease",
                        filter: isHovered
                          ? "drop-shadow(0 4px 8px rgba(185, 28, 28, 0.3))"
                          : "none",
                        opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                        pointerEvents: "none",
                      }}
                    />
                  ) : (
                    /* Indikator Garis Tipis jika Saldo 0 */
                    <rect
                      x={xLeft}
                      y={chartTopPadding + chartEffectiveHeight - 2}
                      width={barWidth}
                      height={2}
                      rx="1"
                      fill="#cbd5e1"
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip Modern & Minimal */}
          {activeItem && hoveredIdx !== null && (
            <div
              className="financial-bar-tooltip"
              style={{
                left: `${((hoveredIdx + 0.5) / 12) * 100}%`,
              }}
            >
              <div className="financial-tooltip-content">
                <span className="financial-tooltip-period">
                  {activeItem.monthName} {year}
                </span>
                <span className="financial-tooltip-label">Saldo Akhir</span>
                <span className="financial-tooltip-value">
                  {formatRupiah(activeItem.saldo)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sumbu X (Label 12 Bulan) */}
      <div className="financial-bar-x-axis">
        {data.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={item.monthIndex}
              className={`financial-bar-x-item ${isHovered ? "active" : ""}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <span className="financial-bar-x-text full-name">{item.monthName}</span>
              <span className="financial-bar-x-text short-name">{item.shortName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
