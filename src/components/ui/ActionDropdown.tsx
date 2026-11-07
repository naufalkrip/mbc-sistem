import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionDropdownProps {
  items: ActionItem[];
  className?: string;
  style?: React.CSSProperties;
  variant?: "primary" | "minimal";
}

export function ActionDropdown({ items, className, style, variant = "primary" }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuPosition = spaceBelow < 160 ? "top" : "bottom";
    
    setDropdownStyle({
      position: "fixed",
      right: Math.max(8, window.innerWidth - rect.right),
      ...(menuPosition === "bottom"
        ? { top: rect.bottom + 6 }
        : { bottom: window.innerHeight - rect.top + 6 }),
    });
  };

  // Update position on open
  useEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open]);

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedButton = buttonRef.current && buttonRef.current.contains(target);
      const clickedMenu = menuRef.current && menuRef.current.contains(target);
      if (!clickedButton && !clickedMenu) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Tutup saat scroll (karena posisi fixed)
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, { capture: true });
    return () => window.removeEventListener("scroll", handler, { capture: true });
  }, [open]);

  // Tutup saat Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        className={`action-dropdown-btn ${variant === "minimal" ? "action-dropdown-btn-minimal" : ""} ${className ?? ""}`}
        onClick={handleToggle}
        aria-label="Aksi"
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          padding: variant === "minimal" ? "0 10px" : "5px 12px",
          height: variant === "minimal" ? 30 : undefined,
          fontSize: 12,
          borderRadius: variant === "minimal" ? 6 : "var(--radius-sm, 8px)",
          background:
            variant === "minimal"
              ? open
                ? "#f1f5f9"
                : "#ffffff"
              : open
              ? "var(--primary-700, #b91c1c)"
              : "var(--primary-600, #dc2626)",
          border: variant === "minimal" ? "1px solid #cbd5e1" : "none",
          color: variant === "minimal" ? "#334155" : "#ffffff",
          fontWeight: variant === "minimal" ? 500 : 600,
          cursor: "pointer",
          boxShadow: variant === "minimal" ? "0 1px 2px rgba(0, 0, 0, 0.04)" : "0 1px 3px rgba(220, 38, 38, 0.3)",
          transition: "all 0.15s ease",
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            if (variant === "minimal") {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "#94a3b8";
            } else {
              e.currentTarget.style.background = "var(--primary-700, #b91c1c)";
            }
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            if (variant === "minimal") {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
            } else {
              e.currentTarget.style.background = "var(--primary-600, #dc2626)";
            }
          }
        }}
      >
        <span>Aksi</span>
        <ChevronDown
          size={variant === "minimal" ? 11 : 13}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            color: variant === "minimal" ? "#64748b" : "currentColor",
          }}
        />
      </button>

      {/* Dropdown Menu via Portal */}
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            ...dropdownStyle,
            background: "#ffffff",
            border: "1px solid var(--border-soft, #e2e8f0)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
            minWidth: 168,
            zIndex: 99999,
            overflow: "hidden",
          }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onClick();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "9px 14px",
                border: "none",
                background: "transparent",
                color: item.danger
                  ? "var(--danger, #ef4444)"
                  : "var(--text, #1e293b)",
                fontSize: 13,
                fontWeight: 500,
                cursor: item.disabled ? "not-allowed" : "pointer",
                opacity: item.disabled ? 0.5 : 1,
                textAlign: "left",
                fontFamily: "inherit",
                transition: "background 0.1s",
                borderTop: idx > 0 ? "1px solid var(--border-soft, #f1f5f9)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  (e.currentTarget as HTMLButtonElement).style.background = item.danger
                    ? "rgba(239,68,68,0.07)"
                    : "var(--bg-soft, #f8fafc)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {item.icon && (
                <span style={{ opacity: 0.75, display: "flex", alignItems: "center" }}>
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
