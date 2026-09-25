import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionDropdownProps {
  items: ActionItem[];
}

export function ActionDropdown({ items }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<"bottom" | "top">("bottom");

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuPosition(spaceBelow < 160 ? "top" : "bottom");
    }
    setOpen((v) => !v);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Aksi"
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 8,
          background: open ? "var(--bg-soft, #f1f5f9)" : "#ffffff",
          color: "var(--text-secondary, #64748b)",
          cursor: "pointer",
          transition: "all 0.15s",
          boxShadow: open ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          role="menu"
          style={{
            position: "fixed",
            background: "#ffffff",
            border: "1px solid var(--border-soft, #e2e8f0)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
            minWidth: 168,
            zIndex: 99999,
            overflow: "hidden",
            right: (() => {
              if (!containerRef.current) return 0;
              const rect = containerRef.current.getBoundingClientRect();
              return window.innerWidth - rect.right;
            })(),
            ...(menuPosition === "bottom"
              ? { top: containerRef.current ? containerRef.current.getBoundingClientRect().bottom + 6 : 0 }
              : { bottom: containerRef.current ? window.innerHeight - containerRef.current.getBoundingClientRect().top + 6 : 0 }),
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
        </div>
      )}
    </div>
  );
}
