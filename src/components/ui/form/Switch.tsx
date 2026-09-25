import React from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  activeColor?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  activeColor = "var(--primary-700, #b91c1c)",
  className = "",
}: SwitchProps) {
  return (
    <label
      className={`form-switch ${disabled ? "is-disabled" : ""} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: description ? "flex-start" : "center",
        gap: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        userSelect: "none",
      }}
    >
      <div
        role="switch"
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
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 999,
          background: checked ? activeColor : "#cbd5e1",
          transition: "background 0.2s ease, box-shadow 0.2s ease",
          flexShrink: 0,
          outline: "none",
          boxShadow: checked ? "0 2px 6px rgba(185, 28, 28, 0.25)" : "none",
          marginTop: description ? 2 : 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
            transition: "left 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>

      {(label || description) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label && (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text, #1e293b)" }}>
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
