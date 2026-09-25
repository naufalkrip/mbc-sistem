import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, options, placeholder, children, className = "", style, ...props }, ref) => {
    return (
      <div
        className="form-select-container"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          width: "100%",
        }}
      >
        <select
          ref={ref}
          className={`form-select ${error ? "is-invalid" : ""} ${className}`}
          style={{
            width: "100%",
            height: 42,
            padding: "8px 36px 8px 14px",
            fontSize: 13.5,
            fontFamily: "var(--font, 'Poppins', sans-serif)",
            color: "var(--text, #1e293b)",
            background: "#ffffff",
            border: error
              ? "1px solid var(--danger, #dc2626)"
              : "1px solid var(--border-soft, #cbd5e1)",
            borderRadius: "var(--radius-sm, 10px)",
            boxShadow: error
              ? "0 0 0 3px rgba(220, 38, 38, 0.12)"
              : "0 1px 2px rgba(0, 0, 0, 0.02)",
            outline: "none",
            transition: "all 0.15s ease",
            boxSizing: "border-box",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            ...style,
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <span
          style={{
            position: "absolute",
            right: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted, #94a3b8)",
            pointerEvents: "none",
          }}
        >
          <ChevronDown size={16} />
        </span>
      </div>
    );
  }
);

Select.displayName = "Select";
