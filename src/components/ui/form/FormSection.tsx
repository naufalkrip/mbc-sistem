import React from "react";

export interface FormSectionProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function FormSection({
  title,
  description,
  badge,
  children,
  className = "",
  style,
}: FormSectionProps) {
  return (
    <div
      className={`form-section ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        paddingTop: 14,
        borderTop: "1px solid var(--border-soft, #f1f5f9)",
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text, #1e293b)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </h4>
          {description && (
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 12.5,
                color: "var(--text-muted, #64748b)",
                lineHeight: 1.45,
              }}
            >
              {description}
            </p>
          )}
        </div>
        {badge && <div>{badge}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}
