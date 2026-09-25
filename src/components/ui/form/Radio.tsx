import React from "react";

export interface RadioProps {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Radio({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
  style,
}: RadioProps) {
  return (
    <label
      className={`form-radio ${disabled ? "is-disabled" : ""} ${className}`}
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
        role="radio"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled && !checked) onChange();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !checked) onChange();
          }
        }}
        style={{
          width: 19,
          height: 19,
          borderRadius: "50%",
          border: checked ? "2px solid var(--primary-700, #b91c1c)" : "1px solid #cbd5e1",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s ease",
          marginTop: description ? 2 : 0,
        }}
      >
        {checked && (
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--primary-700, #b91c1c)",
            }}
          />
        )}
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
