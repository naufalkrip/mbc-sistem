import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown, Wallet, Calendar, ChevronDown, X, TrendingUp } from "lucide-react";
import { formatRupiah, hitungSaldo } from "../../utils/format";
import type { Transaksi } from "../../types";

const PRESET_OPTIONS = [
  { value: "hariIni", label: "Hari Ini" },
  { value: "mingguIni", label: "Minggu Ini" },
  { value: "bulanIni", label: "Bulan Ini" },
  { value: "bulanLalu", label: "Bulan Lalu" },
  { value: "3bulan", label: "3 Bulan Terakhir" },
  { value: "tahunIni", label: "Tahun Ini" },
  { value: "custom", label: "Custom" },
] as const;

function computePresetRange(preset: string): { dari: string; sampai: string } {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  switch (preset) {
    case "hariIni":
      return { dari: today, sampai: today };
    case "mingguIni": {
      const d = new Date();
      d.setDate(new Date().getDate() - 6);
      return { dari: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, sampai: today };
    }
    case "bulanIni":
      return { dari: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`, sampai: today };
    case "bulanLalu": {
      const last = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
      return {
        dari: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-01`,
        sampai: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`,
      };
    }
    case "3bulan": {
      const d = new Date();
      d.setMonth(new Date().getMonth() - 2);
      return { dari: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`, sampai: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}` };
    }
    case "tahunIni":
      return { dari: `${new Date().getFullYear()}-01-01`, sampai: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}` };
    default:
      return { dari: "", sampai: "" };
  }
}

interface FinancialSummaryProps {
  title: string;
  transaksi: Transaksi[];
  summaryRange: { dari?: string; sampai?: string; preset?: string };
  onRangeChange: (range: { dari?: string; sampai?: string; preset?: string }) => void;
}

export function FinancialSummary(props: FinancialSummaryProps) {
  const [open, setOpen] = useState(false);
  const [customDari, setCustomDari] = useState("");
  const [customSampai, setCustomSampai] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const filteredTransaksi = useMemo(() => {
    return props.transaksi.filter((t) => {
      if (props.summaryRange.dari && t.tanggal && t.tanggal < props.summaryRange.dari) return false;
      if (props.summaryRange.sampai && t.tanggal && t.tanggal > props.summaryRange.sampai) return false;
      return true;
    });
  }, [props.transaksi, props.summaryRange.dari, props.summaryRange.sampai]);

  const saldo = useMemo(() => hitungSaldo(filteredTransaksi), [filteredTransaksi]);
  const filteredCount = filteredTransaksi.length;
  const percentage = saldo.pemasukan > 0 ? Math.round((saldo.pengeluaran / saldo.pemasukan) * 100) : 0;

  const displayText = useMemo(() => {
    if (!props.summaryRange.dari && !props.summaryRange.sampai) return "Pilih Periode";
    if (props.summaryRange.preset && props.summaryRange.preset !== "custom") {
      const preset = PRESET_OPTIONS.find(p => p.value === props.summaryRange.preset);
      return preset?.label || "Pilih Periode";
    }
    if (props.summaryRange.dari && props.summaryRange.sampai) {
      const d1 = new Date(props.summaryRange.dari);
      const d2 = new Date(props.summaryRange.sampai);
      if (d1.getTime() === d2.getTime()) return d1.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      return `${d1.getDate()} ${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][d1.getMonth()]} ${d1.getFullYear()} – ${d2.getDate()} ${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][d2.getMonth()]} ${d2.getFullYear()}`;
    }
    if (props.summaryRange.dari) return `Dari ${new Date(props.summaryRange.dari).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
    if (props.summaryRange.sampai) return `Sampai ${new Date(props.summaryRange.sampai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
    return "Pilih Periode";
  }, [props.summaryRange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetClick = (preset: string) => {
    if (preset === "custom") {
      setActivePreset("custom");
      return;
    }
    const range = computePresetRange(preset);
    setActivePreset(preset);
    props.onRangeChange({ ...range, preset });
    setOpen(false);
  };

  const handleCustomChange = () => {
    if (!customDari || !customSampai) return;
    if (customDari > customSampai) return;
    setActivePreset("custom");
    props.onRangeChange({ dari: customDari, sampai: customSampai, preset: "custom" });
    setOpen(false);
  };

  const handleClear = () => {
    props.onRangeChange({ dari: undefined, sampai: undefined, preset: undefined });
    setActivePreset(null);
    setCustomDari("");
    setCustomSampai("");
    setOpen(false);
  };

  return (
    <div className="financial-summary" ref={ref}>
      <div className="financial-summary-header">
        <div className="financial-summary-title">
          <h3>Ringkasan {props.title}</h3>
          <p>Pilih rentang waktu untuk melihat ringkasan data</p>
        </div>
        <div className="financial-summary-period">
          <button
            type="button"
            className={`financial-summary-period-trigger ${open ? "open" : ""}`}
            onClick={() => setOpen(!open)}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <Calendar size={16} />
            <span>{displayText}</span>
            <ChevronDown size={16} className="chevron" />
            {(props.summaryRange.dari || props.summaryRange.sampai) && (
              <button
                type="button"
                className="financial-summary-period-clear"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
                aria-label="Hapus rentang"
              >
                <X size={12} />
              </button>
            )}
          </button>

          {open && (
            <div className="financial-summary-period-dropdown" role="menu">
              <div className="financial-summary-presets">
                {PRESET_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`financial-summary-preset ${props.summaryRange.preset === p.value ? "active" : ""}`}
                    onClick={() => handlePresetClick(p.value)}
                    role="menuitem"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {activePreset === "custom" && (
                <div className="financial-summary-custom">
                  <div className="financial-summary-custom-inputs">
                    <div className="financial-summary-custom-input">
                      <label>Dari</label>
                      <input
                        type="date"
                        value={customDari}
                        onChange={(e) => setCustomDari(e.target.value)}
                        max={customSampai || undefined}
                      />
                    </div>
                    <div className="financial-summary-custom-input">
                      <label>Sampai</label>
                      <input
                        type="date"
                        value={customSampai}
                        onChange={(e) => setCustomSampai(e.target.value)}
                        min={customDari || undefined}
                      />
                    </div>
                  </div>
                  {customDari && customSampai && customDari > customSampai && (
                    <p className="financial-summary-error">Tanggal akhir harus setelah tanggal mulai</p>
                  )}
                  <div className="financial-summary-custom-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActivePreset(null)}>Batal</button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleCustomChange}
                      disabled={!customDari || !customSampai || customDari > customSampai}
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div
        className="financial-cards-grid"
      >
        {/* Total Pemasukan */}
        <div className="financial-stat-card-custom">
          <div className="financial-stat-head">
            <div className="financial-stat-icon-wrap">
              <ArrowUp size={15} />
            </div>
            <span>Total Pemasukan</span>
          </div>
          <div className="financial-stat-value-custom positive">
            {formatRupiah(saldo.pemasukan)}
          </div>
        </div>

        {/* Total Pengeluaran */}
        <div className="financial-stat-card-custom">
          <div className="financial-stat-head">
            <div className="financial-stat-icon-wrap">
              <ArrowDown size={15} />
            </div>
            <span>Total Pengeluaran</span>
          </div>
          <div className="financial-stat-value-custom negative">
            {formatRupiah(saldo.pengeluaran)}
          </div>
        </div>

        {/* Saldo Kas */}
        <div className="financial-stat-card-custom highlight">
          <div className="financial-stat-head">
            <div className="financial-stat-icon-wrap">
              <Wallet size={15} />
            </div>
            <span>Sisa Saldo Kas</span>
          </div>
          <div className="financial-stat-value-custom highlight-text">
            {formatRupiah(saldo.saldo)}
          </div>
        </div>

        {/* Persentase Penggunaan */}
        <div className="financial-stat-card-custom">
          <div className="financial-stat-head">
            <div className="financial-stat-icon-wrap">
              <TrendingUp size={15} />
            </div>
            <span>Pengeluaran ({filteredCount} trx)</span>
          </div>
          <div className="financial-stat-value-custom">
            {percentage}%
          </div>
        </div>
      </div>
    </div>
  );
}