import React, { forwardRef } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, rows = 3, className = "", style, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`form-textarea ${error ? "is-invalid" : ""} ${className}`}
        style={{
          width: "100%",
          padding: "10px 14px",
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
          resize: "vertical",
          minHeight: 80,
          ...style,
        }}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
