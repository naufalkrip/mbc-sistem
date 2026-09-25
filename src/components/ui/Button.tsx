import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      className = "",
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    // Map variant to base classes
    const variantClass =
      variant === "primary"
        ? "btn-primary"
        : variant === "outline" || variant === "secondary"
        ? "btn-outline"
        : variant === "danger"
        ? "btn-danger"
        : "btn-ghost";

    const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

    const combinedClassName = ["btn", variantClass, sizeClass, className].filter(Boolean).join(" ");

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        style={style}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 size={size === "sm" ? 13 : 16} className="animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && <span className="btn-icon-wrapper">{icon}</span>}
            {children && <span>{children}</span>}
            {icon && iconPosition === "right" && <span className="btn-icon-wrapper">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
