import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

interface DownloadDropdownProps {
  onExportCsv: () => void;
  onExportPdf: () => void;
  disabled?: boolean;
  className?: string;
}

export function DownloadDropdown({
  onExportCsv,
  onExportPdf,
  disabled = false,
  className = "",
}: DownloadDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className={`download-dropdown-wrap ${className}`} ref={dropdownRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn-download-unified"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        title="Download Data Pesanan (CSV / PDF)"
      >
        <Download size={14} />
        <span>Download</span>
        <ChevronDown
          size={13}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div className="download-dropdown-menu">
          <button
            type="button"
            className="download-dropdown-item"
            onClick={() => {
              setOpen(false);
              onExportCsv();
            }}
          >
            <div className="download-item-icon csv">
              <FileSpreadsheet size={15} />
            </div>
            <div className="download-item-text">
              <span className="download-item-title">Ekspor CSV</span>
              <span className="download-item-desc">Format spreadsheet (.csv)</span>
            </div>
          </button>

          <button
            type="button"
            className="download-dropdown-item"
            onClick={() => {
              setOpen(false);
              onExportPdf();
            }}
          >
            <div className="download-item-icon pdf">
              <FileText size={15} />
            </div>
            <div className="download-item-text">
              <span className="download-item-title">Unduh PDF</span>
              <span className="download-item-desc">Laporan cetak resmi (.pdf)</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

