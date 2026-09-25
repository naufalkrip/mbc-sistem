import React, { useRef } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";

export interface FileUploadProps {
  value?: string | null;
  onChange: (file: File | null) => void;
  onClear?: () => void;
  accept?: string;
  label?: string;
  hint?: string;
  isImage?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function FileUpload({
  value,
  onChange,
  onClear,
  accept = "image/jpeg,image/png,image/webp",
  label = "Pilih atau seret berkas ke sini",
  hint = "Format JPG, PNG, atau WebP (Maks. 5MB)",
  isImage = true,
  disabled = false,
  loading = false,
  className = "",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (file) {
      onChange(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || loading) return;
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  return (
    <div className={`form-upload-component ${className}`} style={{ width: "100%" }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled || loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          handleFile(file);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />

      {value ? (
        <div
          className="form-upload-preview-card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            padding: "12px 14px",
            background: "#ffffff",
            borderRadius: "var(--radius-sm, 12px)",
            border: "1px solid var(--border-soft, #e2e8f0)",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            {isImage ? (
              <img
                src={value}
                alt="Preview"
                style={{
                  width: 52,
                  height: 52,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: "1px solid var(--border-soft, #cbd5e1)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: "var(--bg-soft, #f1f5f9)",
                  color: "var(--primary-700, #b91c1c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText size={22} />
              </div>
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text, #1e293b)",
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Berkas Terpilih
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--green-700, #15803d)",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                ✓ Siap diunggah / tersimpan
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={disabled || loading}
              onClick={() => inputRef.current?.click()}
              style={{ fontSize: 12, padding: "5px 12px" }}
            >
              Ganti
            </button>
            {onClear && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={disabled || loading}
                onClick={onClear}
                style={{ fontSize: 12, padding: "5px 10px", color: "var(--danger, #dc2626)" }}
              >
                <X size={14} />
                <span>Hapus</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => {
            if (!disabled && !loading) inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled && !loading) inputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            padding: "20px 16px",
            background: "var(--bg-soft, #f8fafc)",
            border: "1.5px dashed var(--border-soft, #cbd5e1)",
            borderRadius: "var(--radius-sm, 12px)",
            textAlign: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s ease",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            if (!disabled && !loading) {
              e.currentTarget.style.borderColor = "var(--primary-600, #dc2626)";
              e.currentTarget.style.background = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !loading) {
              e.currentTarget.style.borderColor = "var(--border-soft, #cbd5e1)";
              e.currentTarget.style.background = "var(--bg-soft, #f8fafc)";
            }
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#ffffff",
              color: "var(--primary-700, #b91c1c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            {isImage ? <ImageIcon size={20} /> : <Upload size={20} />}
          </div>

          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text, #1e293b)", display: "block" }}>
              {loading ? "Memproses berkas..." : label}
            </span>
            {hint && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", display: "block", marginTop: 2 }}>
                {hint}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
