import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import type { Transaksi } from "../../types";
import { JENIS_TRANSAKSI } from "../../config";
import { filterTransaksi, formatRentangTanggal, formatRupiah, formatTanggal } from "../../utils/format";
import { laporanKeuangan } from "../../services/pdf";
import { useToast } from "../../contexts/ToastContext";
import { DataTable } from "../ui/DataTable";
import type { Column } from "../ui/DataTable";
import { SearchBar } from "../ui/SearchBar";
import { Filter } from "../ui/Filter";
import { DatePicker } from "../ui/DatePicker";
import { StatusBadge } from "../ui/StatusBadge";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CurrencyInput } from "../ui/CurrencyInput";
import { DownloadPdfButton } from "../ui/DownloadPdfButton";
import { FinancialSummary } from "./FinancialSummary";
import { ActionDropdown } from "../ui/ActionDropdown";


interface KeuanganProps {
  title: string;
  subtitle: string;
  loading: boolean;
  transaksi: Transaksi[];
  onRefresh: () => Promise<void>;
  onSave: (data: Omit<Transaksi, "id">, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

interface FormTransaksi {
  tanggal: string;
  jenis: string;
  keterangan: string;
  nominal: number | string;
}

const FORM_EMPTY: FormTransaksi = {
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: "Pemasukan",
  keterangan: "",
  nominal: "",
};

const PILIHAN_BULAN = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const currentYear = new Date().getFullYear();
const PILIHAN_TAHUN = Array.from({ length: 8 }, (_, i) => currentYear - 4 + i);

type ModalMode = "add" | "edit" | null;
type PdfMode = "" | "bulan" | "custom";

export function Keuangan({ title, subtitle, loading, transaksi, onRefresh, onSave, onDelete }: KeuanganProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [search, setSearch] = useState("");
  const [filterDari, setFilterDari] = useState("");
  const [filterSampai, setFilterSampai] = useState("");
  const [filterJenis, setFilterJenis] = useState("");

  // Summary date range filter
  const [summaryRange, setSummaryRange] = useState<{ dari?: string; sampai?: string; preset?: string }>({
    preset: "bulanIni",
  });

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<FormTransaksi>(FORM_EMPTY);
  const [editing, setEditing] = useState<Transaksi | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Transaksi | null>(null);
  const [deleting, setDeleting] = useState(false);

  // PDF Export Modal State with Month & Year dropdowns
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfMode>("");
  const [pdfSelectedBulan, setPdfSelectedBulan] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [pdfSelectedTahun, setPdfSelectedTahun] = useState(String(new Date().getFullYear()));
  const [pdfDari, setPdfDari] = useState("");
  const [pdfSampai, setPdfSampai] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const filtered = useMemo(() => {
    return filterTransaksi(transaksi, {
      dari: filterDari || undefined,
      sampai: filterSampai || undefined,
      jenis: filterJenis || undefined,
      search: search || undefined,
    }).sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "") || (a.id || "").localeCompare(b.id || ""));
  }, [transaksi, filterDari, filterSampai, filterJenis, search]);

  const pdfRange = useMemo(() => {
    if (pdfMode === "bulan" && pdfSelectedBulan && pdfSelectedTahun) {
      const lastDay = new Date(Number(pdfSelectedTahun), Number(pdfSelectedBulan), 0).getDate();
      const namaBulan = PILIHAN_BULAN.find((b) => b.value === pdfSelectedBulan)?.label || "Bulan";
      return {
        dari: `${pdfSelectedTahun}-${pdfSelectedBulan}-01`,
        sampai: `${pdfSelectedTahun}-${pdfSelectedBulan}-${String(lastDay).padStart(2, "0")}`,
        label: `${namaBulan} ${pdfSelectedTahun}`,
      };
    }
    if (pdfMode === "custom") {
      return {
        dari: pdfDari || undefined,
        sampai: pdfSampai || undefined,
        label: formatRentangTanggal(pdfDari, pdfSampai),
      };
    }
    return { dari: undefined, sampai: undefined, label: "Semua Periode" };
  }, [pdfMode, pdfSelectedBulan, pdfSelectedTahun, pdfDari, pdfSampai]);

  const validate = (f: FormTransaksi): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!f.tanggal) err.tanggal = "Tanggal wajib diisi.";
    if (!f.jenis) err.jenis = "Jenis transaksi wajib dipilih.";
    const nominal = Number(f.nominal);
    if (f.nominal === "" || Number.isNaN(nominal)) err.nominal = "Nominal harus berupa angka.";
    else if (nominal < 0) err.nominal = "Nominal tidak boleh negatif.";
    return err;
  };

  const openAdd = () => {
    setEditing(null);
    setForm(FORM_EMPTY);
    setErrors({});
    setModalMode("add");
  };

  const openEdit = (t: Transaksi) => {
    setEditing(t);
    setForm({
      tanggal: t.tanggal.slice(0, 10),
      jenis: t.jenis,
      keterangan: t.keterangan || "",
      nominal: t.nominal,
    });
    setErrors({});
    setModalMode("edit");
  };

  const handleSubmit = async () => {
    const err = validate(form);
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setSaving(true);
    const payload: Omit<Transaksi, "id"> = {
      tanggal: form.tanggal,
      jenis: form.jenis as Transaksi["jenis"],
      kategori: editing?.kategori || "",
      keterangan: form.keterangan.trim(),
      nominal: Number(form.nominal),
      penanggungJawab: editing?.penanggungJawab || "",
    };

    const ok = await onSave(payload, editing?.id);
    setSaving(false);
    if (ok) {
      setModalMode(null);
      void onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const ok = await onDelete(toDelete.id);
    setDeleting(false);
    if (ok) {
      setToDelete(null);
      void onRefresh();
    }
  };

  const handleGeneratePdf = async () => {
    if (pdfMode === "bulan" && (!pdfSelectedBulan || !pdfSelectedTahun)) {
      toastError("Silakan pilih bulan dan tahun terlebih dahulu.");
      return;
    }
    if (pdfMode === "custom" && (!pdfDari || !pdfSampai)) {
      toastError("Silakan lengkapi tanggal mulai dan tanggal akhir.");
      return;
    }
    if (pdfMode === "custom" && pdfDari > pdfSampai) {
      toastError("Tanggal mulai tidak boleh melebihi tanggal akhir.");
      return;
    }

    setPdfGenerating(true);
    try {
      const dataToExport = filterTransaksi(transaksi, {
        dari: pdfRange.dari,
        sampai: pdfRange.sampai,
      }).sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));

      if (dataToExport.length === 0) {
        toastError("Tidak ada data transaksi pada periode yang dipilih.");
        setPdfGenerating(false);
        return;
      }

      await laporanKeuangan(dataToExport, pdfRange.label, title);
      toastSuccess("Laporan PDF berhasil diunduh.");
      setPdfOpen(false);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const setField = (key: keyof FormTransaksi, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const columns: Column<Transaksi>[] = [
    { key: "no", header: "No", render: (_r, idx) => <>{idx + 1}</> },
    { key: "tanggal", header: "Tanggal", render: (r) => formatTanggal(r.tanggal) },
    { key: "jenis", header: "Jenis", render: (r) => <StatusBadge value={r.jenis} /> },
    { key: "keterangan", header: "Keterangan", render: (r) => r.keterangan || "-" },
    {
      key: "nominal",
      header: "Nominal",
      render: (r) => (
        <span style={{ fontWeight: 600, color: r.jenis === "Pemasukan" ? "var(--green-600)" : "var(--red-700)" }}>
          {formatRupiah(r.nominal)}
        </span>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      render: (r) => (
        <ActionDropdown items={[
          { label: "Edit", icon: <Pencil size={14} />, onClick: () => openEdit(r) },
          { label: "Hapus", icon: <Trash2 size={14} />, onClick: () => setToDelete(r), danger: true },
        ]} />
      ),
    },
  ];

  return (
    <div className="page-grid">
      <FinancialSummary
        title={subtitle}
        transaksi={transaksi}
        summaryRange={summaryRange}
        onRangeChange={setSummaryRange}
      />

      <div className="card">
        <div className="card-header">
          <div>
            <h2>{title}</h2>
            <p>{loading ? "Memuat data..." : `${filtered.length} transaksi`}</p>
          </div>
          <div className="header-actions">
            <DownloadPdfButton onGenerate={() => setPdfOpen(true)} variant="outline" />
            <button className="btn btn-primary" onClick={openAdd}><Plus size={17} /> Tambah Transaksi</button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBar value={search} onChange={setSearch} placeholder="Cari transaksi atau keterangan..." />
          <DatePicker label="Dari" value={filterDari} onChange={setFilterDari} />
          <DatePicker label="Sampai" value={filterSampai} onChange={setFilterSampai} />
          <Filter
            label="Jenis"
            value={filterJenis}
            onChange={setFilterJenis}
            options={JENIS_TRANSAKSI.map((j) => ({ value: j, label: j }))}
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          rowKey={(r) => r.id}
          emptyTitle="Tidak ada data"
          emptyMessage="Tidak ada transaksi."
          fullHeight
        />
        {filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", fontSize: "12px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Menampilkan total {filtered.length} transaksi (scroll vertikal untuk melihat transaksi lainnya)</span>
          </div>
        )}
      </div>

      {/* Modal Unduh PDF Laporan */}
      <Modal
        open={pdfOpen}
        title={`Unduh Laporan PDF ${title}`}
        onClose={() => setPdfOpen(false)}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPdfOpen(false)} disabled={pdfGenerating}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={pdfGenerating}>
              <Download size={16} />
              {pdfGenerating ? "Membuat PDF..." : "Unduh PDF Laporan"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--navy-900)" }}>Pilih Periode Laporan</div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0" }}>
              Tentukan rentang tanggal transaksi yang akan dimasukkan ke dalam dokumen PDF
            </p>
          </div>

          <div
            className="segment-group"
            style={{
              display: "flex",
              gap: 6,
              background: "var(--bg, #f8fafc)",
              padding: 4,
              borderRadius: "var(--radius-sm, 8px)",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <button
              type="button"
              className={`segment-btn ${pdfMode === "" ? "active" : ""}`}
              onClick={() => setPdfMode("")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "var(--radius-xs, 6px)",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                background: pdfMode === "" ? "#ffffff" : "transparent",
                color: pdfMode === "" ? "var(--primary-700, #b91c1c)" : "var(--text-muted)",
                boxShadow: pdfMode === "" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Semua Periode
            </button>
            <button
              type="button"
              className={`segment-btn ${pdfMode === "bulan" ? "active" : ""}`}
              onClick={() => setPdfMode("bulan")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "var(--radius-xs, 6px)",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                background: pdfMode === "bulan" ? "#ffffff" : "transparent",
                color: pdfMode === "bulan" ? "var(--primary-700, #b91c1c)" : "var(--text-muted)",
                boxShadow: pdfMode === "bulan" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Bulan
            </button>
            <button
              type="button"
              className={`segment-btn ${pdfMode === "custom" ? "active" : ""}`}
              onClick={() => setPdfMode("custom")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "var(--radius-xs, 6px)",
                border: "none",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                background: pdfMode === "custom" ? "#ffffff" : "transparent",
                color: pdfMode === "custom" ? "var(--primary-700, #b91c1c)" : "var(--text-muted)",
                boxShadow: pdfMode === "custom" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Custom
            </button>
          </div>

          {pdfMode === "bulan" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>Pilih Bulan</label>
                <select
                  value={pdfSelectedBulan}
                  onChange={(e) => setPdfSelectedBulan(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "14px" }}
                >
                  {PILIHAN_BULAN.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>Pilih Tahun</label>
                <select
                  value={pdfSelectedTahun}
                  onChange={(e) => setPdfSelectedTahun(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "14px" }}
                >
                  {PILIHAN_TAHUN.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {pdfMode === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>Tanggal Dari</label>
                <input
                  type="date"
                  value={pdfDari}
                  max={pdfSampai || undefined}
                  onChange={(e) => setPdfDari(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "14px" }}
                />
              </div>
              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "13px", fontWeight: 500 }}>Tanggal Sampai</label>
                <input
                  type="date"
                  value={pdfSampai}
                  min={pdfDari || undefined}
                  onChange={(e) => setPdfSampai(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "14px" }}
                />
              </div>
            </div>
          )}

          <div
            style={{
              padding: "10px 14px",
              background: "var(--bg, #f8fafc)",
              borderRadius: "var(--radius-sm, 8px)",
              border: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Periode yang dicetak:</span>
            <strong style={{ color: "var(--navy-900)" }}>{pdfRange.label}</strong>
          </div>
        </div>
      </Modal>

      {/* Modal Tambah / Edit Transaksi */}
      <Modal
        open={modalMode !== null}
        title={editing ? "Edit Transaksi" : "Tambah Transaksi"}
        onClose={() => setModalMode(null)}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalMode(null)} disabled={saving}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>Tanggal *</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setField("tanggal", e.target.value)}
            />
            {errors.tanggal && <span className="field-error">{errors.tanggal}</span>}
          </div>
          <div className="form-group">
            <label>Jenis Transaksi *</label>
            <select
              value={form.jenis}
              onChange={(e) => setField("jenis", e.target.value)}
            >
              {JENIS_TRANSAKSI.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            {errors.jenis && <span className="field-error">{errors.jenis}</span>}
          </div>
          <div className="form-group full">
            <label>Nominal (Rupiah) *</label>
            <CurrencyInput value={form.nominal} onChange={(v) => setField("nominal", v)} placeholder="0" />
            {errors.nominal && <span className="field-error">{errors.nominal}</span>}
          </div>
          <div className="form-group full">
            <label>Keterangan / Keperluan</label>
            <input
              value={form.keterangan}
              onChange={(e) => setField("keterangan", e.target.value)}
              placeholder="Keterangan transaksi (opsional)"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Hapus Transaksi"
        message={`Yakin ingin menghapus transaksi "${toDelete?.keterangan || toDelete?.jenis}" (${formatRupiah(toDelete?.nominal ?? 0)})?`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}