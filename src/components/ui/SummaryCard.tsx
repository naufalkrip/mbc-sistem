import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

export type SummaryCardAccent =
  | "red"
  | "green"
  | "blue"
  | "amber"
  | "gold"
  | "purple"
  | "slate";

export interface SummaryCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  accent?: SummaryCardAccent;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  loading?: boolean;
  className?: string;
}

export function SummaryCard({
  label,
  value,
  icon,
  sub,
  accent = "slate",
  active = false,
  onClick,
  title,
  loading = false,
  className = "",
}: SummaryCardProps) {
  const isStringVal = typeof value === "string";
  const isLongVal = isStringVal && (value.length > 11 || value.startsWith("Rp"));

  return (
    <div
      className={`summary-card summary-card-${accent} ${active ? "active" : ""} ${
        onClick ? "clickable" : ""
      } ${className}`}
      onClick={onClick}
      title={title}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="summary-card-header">
        {icon && (
          <div className={`summary-card-icon-box summary-card-icon-${accent}`}>
            {icon}
          </div>
        )}
        <span className="summary-card-label" title={label}>{label}</span>
      </div>

      <div className="summary-card-body">
        {loading ? (
          <Skeleton width={80} height={24} style={{ margin: "2px 0" }} />
        ) : (
          <div className={`summary-card-value ${isLongVal ? "is-long" : ""}`}>
            {value}
          </div>
        )}
        {sub && <div className="summary-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

export interface SummaryGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6 | "auto";
  className?: string;
}

export function SummaryGrid({
  children,
  columns = "auto",
  className = "",
}: SummaryGridProps) {
  const colClass = columns === "auto" ? "summary-grid-auto" : `summary-grid-${columns}`;
  return <div className={`summary-grid ${colClass} ${className}`}>{children}</div>;
}

export interface SummarySectionProps {
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SummarySection({
  title,
  subtitle,
  badge,
  extra,
  children,
  className = "",
}: SummarySectionProps) {
  const hasHeader = Boolean(title || subtitle || badge || extra);
  return (
    <div className={`summary-section ${className}`}>
      {hasHeader && (
        <div className="summary-section-header">
          <div className="summary-section-titles">
            {title && <h3 className="summary-section-title">{title}</h3>}
            {subtitle && <p className="summary-section-sub">{subtitle}</p>}
          </div>
          {(badge || extra) && (
            <div className="summary-section-actions">
              {badge}
              {extra}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

