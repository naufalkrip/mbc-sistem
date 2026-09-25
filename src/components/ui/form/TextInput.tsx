import React, { forwardRef } from "react";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ error = false, leftIcon, rightIcon, className = "", style, ...props }, ref) => {
    return (
      <div
        className="form-input-container"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          width: "100%",
        }}
      >
        {leftIcon && (
          <span
            style={{
              position: "absolute",
              left: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted, #94a3b8)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          className={`form-input ${error ? "is-invalid" : ""} ${className}`}
          style={{
            width: "100%",
            height: 42,
            padding: leftIcon ? "8px 12px 8px 38px" : rightIcon ? "8px 38px 8px 12px" : "8px 14px",
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
            ...style,
          }}
          {...props}
        />

        {rightIcon && (
          <span
            style={{
              position: "absolute",
              right: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted, #94a3b8)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";
