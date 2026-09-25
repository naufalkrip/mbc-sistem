import React from "react";

export interface FormFieldProps {
  label?: React.ReactNode;
  required?: boolean;
  description?: React.ReactNode;
  error?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function FormField({
  label,
  required = false,
  description,
  error,
  id,
  className = "",
  style,
  children,
}: FormFieldProps) {
  return (
    <div
      className={`form-field ${error ? "has-error" : ""} ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={id}
          className="form-label"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: error ? "var(--danger, #dc2626)" : "var(--text, #1e293b)",
            lineHeight: 1.4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{label}</span>
          {required && (
            <span
              style={{
                color: "var(--primary-700, #b91c1c)",
                fontWeight: 700,
              }}
              title="Wajib diisi"
            >
              *
            </span>
          )}
        </label>
      )}

      {children}

      {description && !error && (
        <span
          className="form-description"
          style={{
            fontSize: 12,
            color: "var(--text-muted, #64748b)",
            lineHeight: 1.4,
            marginTop: 1,
          }}
        >
          {description}
        </span>
      )}

      {error && (
        <span
          className="form-error"
          role="alert"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--danger, #dc2626)",
            lineHeight: 1.4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginTop: 1,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
