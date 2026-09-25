import React from "react";
import { Check } from "lucide-react";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
  style,
}: CheckboxProps) {
  return (
    <label
      className={`form-checkbox ${disabled ? "is-disabled" : ""} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: description ? "flex-start" : "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        userSelect: "none",
        ...style,
      }}
    >
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onChange(!checked);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) onChange(!checked);
          }
        }}
        style={{
          width: 19,
          height: 19,
          borderRadius: 6,
          border: checked ? "1px solid var(--primary-700, #b91c1c)" : "1px solid #cbd5e1",
          background: checked ? "var(--primary-700, #b91c1c)" : "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s ease",
          boxShadow: checked ? "0 1px 3px rgba(185, 28, 28, 0.2)" : "0 1px 2px rgba(0,0,0,0.02)",
          marginTop: description ? 2 : 0,
        }}
      >
        {checked && <Check size={13} color="#ffffff" strokeWidth={3} />}
      </div>

      {(label || description) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label && (
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text, #1e293b)" }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: 12, color: "var(--text-muted, #64748b)" }}>
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
