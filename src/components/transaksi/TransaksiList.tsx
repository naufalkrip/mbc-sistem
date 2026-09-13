import { useMemo, useState } from "react";
import {
  Plus,
  Eye,
  Trash2,
  Pencil,
  Download,
  FolderPlus,
  Calendar,
  Layers,
} from "lucide-react";
import type { TransaksiGroupWithStats } from "../../types";
import { formatRupiah, formatTanggal } from "../../utils/format";
import { DataTable } from "../ui/DataTable";
import type { Column } from "../ui/DataTable";
import { SearchBar } from "../ui/SearchBar";
import { DatePicker } from "../ui/DatePicker";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface TransaksiListProps {
  loading: boolean;
  groups: TransaksiGroupWithStats[];
  onRefresh: () => Promise<void>;
  onSave: (
    data: Omit<TransaksiGroupWithStats, "id" | "createdAt" | "updatedAt" | "totalTransaksi" | "totalPemasukan" | "totalPengeluaran" | "saldo">,
    id?: string
  ) => Promise<{ success: boolean; id?: string }>;
  onDelete: (id: string) => Promise<boolean>;
  onNavigateToDetail: (id: string) => void;
  onDownloadPdf?: (group: TransaksiGroupWithStats) => Promise<void>;
}

interface FormGroup {
  judul: string;
  tanggal: string;
  keterangan: string;
}

const FORM_EMPTY: FormGroup = {
  judul: "",
  tanggal: new Date().toISOString().slice(0, 10),
  keterangan: "",
};

type ModalMode = "add" | "edit" | null;

export function TransaksiList({
  loading,
  groups,
  onRefresh,
  onSave,
  onDelete,
  onNavigateToDetail,
  onDownloadPdf,
}: TransaksiListProps) {
  const [search, setSearch] = useState("");
  const [filterDari, setFilterDari] = useState("");
  const [filterSampai, setFilterSampai] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<FormGroup>(FORM_EMPTY);
  const [editing, setEditing] = useState<TransaksiGroupWithStats | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<TransaksiGroupWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return groups
      .filter((g) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!`${g.judul} ${g.keterangan}`.toLowerCase().includes(q)) return false;
        }
        if (filterDari && g.tanggal && g.tanggal < filterDari) return false;
        if (filterSampai && g.tanggal && g.tanggal > filterSampai) return false;
        return true;
      })
      .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "") || (b.id || "").localeCompare(a.id || ""));
  }, [groups, search, filterDari, filterSampai]);

  const totalMutasi = useMemo(() => {
    return filtered.reduce((acc, g) => acc + (Number(g.totalTransaksi) || 0), 0);
  }, [filtered]);

  const validate = (f: FormGroup): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!f.judul.trim()) err.judul = "Nama / Judul transaksi wajib diisi.";
    if (!f.tanggal) err.tanggal = "Tanggal wajib diisi.";
    return err;
  };

  const openAdd = () => {
    setEditing(null);
    setForm(FORM_EMPTY);
    setErrors({});
    setModalMode("add");
  };

  const openEdit = (g: TransaksiGroupWithStats) => {
    setEditing(g);
    setForm({
      judul: g.judul,
      tanggal: g.tanggal.slice(0, 10),
      keterangan: g.keterangan,
    });
    setErrors({});
    setModalMode("edit");
  };

  const handleSubmit = async (openDetailAfterCreate = false) => {
    const err = validate(form);
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setSaving(true);
    const payload: Omit<TransaksiGroupWithStats, "id" | "createdAt" | "updatedAt" | "totalTransaksi" | "totalPemasukan" | "totalPengeluaran" | "saldo"> = {
      judul: form.judul.trim(),
      tanggal: form.tanggal,
      keterangan: form.keterangan.trim(),
    };

    const res = await onSave(payload, editing?.id);
    setSaving(false);
    if (res.success) {
      setModalMode(null);
      void onRefresh();
      if (openDetailAfterCreate && res.id) {
        onNavigateToDetail(res.id);
      }
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

  const handleDownload = async (g: TransaksiGroupWithStats) => {
    if (!onDownloadPdf) return;
    setDownloadingId(g.id);
    try {
      await onDownloadPdf(g);
    } finally {
      setDownloadingId(null);
    }
  };

  const setField = (key: keyof FormGroup, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const columns: Column<TransaksiGroupWithStats>[] = [
    { key: "no", header: "No", render: (_r, idx) => <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{idx + 1}</span> },
    {
      key: "judul",
      header: "Kegiatan / Proyek",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--navy-900)", fontSize: 14 }}>
              {r.judul}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #e2e8f0",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Layers size={11} />
              {r.totalTransaksi} item
            </span>
          </div>
          {r.keterangan && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.3 }}>
              {r.keterangan}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal",
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--navy-900)", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Calendar size={13} style={{ color: "var(--text-muted)" }} />
          {formatTanggal(r.tanggal)}
        </span>
      ),
    },
    {
      key: "totalPemasukan",
      header: "Uang Masuk",
      render: (r) => (
        <span style={{ fontWeight: 600, color: "var(--green-700)", fontVariantNumeric: "tabular-nums" }}>
          +{formatRupiah(r.totalPemasukan)}
        </span>
      ),
    },
    {
      key: "totalPengeluaran",
      header: "Uang Keluar",
      render: (r) => (
        <span style={{ fontWeight: 600, color: "var(--red-700)", fontVariantNumeric: "tabular-nums" }}>
          -{formatRupiah(r.totalPengeluaran)}
        </span>
      ),
    },
    {
      key: "saldo",
      header: "Saldo Sisa",
      render: (r) => (
        <span
          style={{
            fontWeight: 700,
            color: r.saldo >= 0 ? "var(--green-700)" : "var(--red-700)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatRupiah(r.saldo)}
        </span>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      render: (r) => (
        <div className="action-group" onClick={(e) => e.stopPropagation()}>
          <button
            className="action-btn"
            data-tooltip="Buka & Kelola Rincian"
            aria-label="Buka & Kelola Rincian"
            onClick={() => onNavigateToDetail(r.id)}
            style={{ color: "var(--primary-700, #b91c1c)", background: "rgba(185, 28, 28, 0.08)" }}
          >
            <Eye size={16} />
          </button>
          {onDownloadPdf && (
            <button
              className="action-btn"
              data-tooltip="Unduh PDF Laporan"
              aria-label="Unduh PDF Laporan"
              disabled={downloadingId === r.id}
              onClick={() => handleDownload(r)}
            >
              <Download size={16} />
            </button>
          )}
          <button
            className="action-btn"
            data-tooltip="Edit Transaksi"
            aria-label="Edit Transaksi"
            onClick={() => openEdit(r)}
          >
            <Pencil size={16} />
          </button>
          <button
            className="action-btn danger"
            data-tooltip="Hapus"
            aria-label="Hapus"
            onClick={() => setToDelete(r)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid">
      {/* 1. TOP SUMMARY PANEL (HANYA JUMLAH TRANSAKSI) */}
      <div className="summary-panel animate-fade-slide-up">
        <div className="summary-panel-header" style={{ marginBottom: 0 }}>
          <div>
            <h3>Ringkasan Transaksi Temporer</h3>
            <p>Manajemen pencatatan transaksi pos kegiatan & proyek mbc sistem</p>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.16)",
              backdropFilter: "blur(4px)",
              borderRadius: 10,
              padding: "10px 18px",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                flexShrink: 0,
              }}
            >
              <FolderPlus size={18} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.85)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Jumlah Transaksi
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
                {filtered.length.toLocaleString("id-ID")}{" "}
                <span style={{ fontSize: "13px", fontWeight: 500, opacity: 0.9 }}>Transaksi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CARD TABEL TRANSAKSI TEMPORER */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Daftar Transaksi Temporer</h2>
            <p>{loading ? "Memuat data..." : `${filtered.length} kegiatan transaksi dicatat`}</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={17} /> Tambah Transaksi Baru
            </button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBar value={search} onChange={setSearch} placeholder="Cari nama kegiatan atau keterangan..." />
          <DatePicker label="Dari" value={filterDari} onChange={setFilterDari} />
          <DatePicker label="Sampai" value={filterSampai} onChange={setFilterSampai} />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          rowKey={(r) => r.id}
          onRowClick={(r) => onNavigateToDetail(r.id)}
          emptyTitle="Belum ada transaksi temporer"
          emptyMessage="Belum ada transaksi temporer yang dibuat. Klik tombol 'Tambah Transaksi Baru' untuk mulai menginput pos anggaran atau kegiatan."
        />
        {filtered.length > 0 && (
          <div
            style={{
              padding: "11px 16px",
              borderTop: "1px solid var(--border, #e2e8f0)",
              fontSize: "12.5px",
              color: "var(--text-muted, #64748b)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface-hover, #f8fafc)",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>Menampilkan seluruh {filtered.length} transaksi temporer (klik baris untuk membuka rincian)</span>
            <span style={{ fontWeight: 600, color: "var(--navy-900, #0f172a)" }}>
              Total Mutasi: {totalMutasi} item
            </span>
          </div>
        )}
      </div>

      {/* Modal Buat / Edit Transaksi */}
      <Modal
        open={modalMode !== null}
        title={editing ? "Edit Transaksi Temporer" : "Tambah Transaksi Temporer Baru"}
        onClose={() => setModalMode(null)}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalMode(null)} disabled={saving}>
              Batal
            </button>
            {!editing && (
              <button
                className="btn btn-outline"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                title="Simpan lalu langsung buka halaman input uang masuk/keluar"
              >
                <FolderPlus size={16} /> Simpan & Langsung Buka Rincian
              </button>
            )}
            <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>Nama / Judul Transaksi *</label>
            <input
              value={form.judul}
              onChange={(e) => setField("judul", e.target.value)}
              placeholder="Contoh: Pembelian Alat / Konser / Konsumsi Event"
            />
            {errors.judul && <span className="field-error">{errors.judul}</span>}
          </div>
          <div className="form-group">
            <label>Tanggal Kegiatan *</label>
            <input type="date" value={form.tanggal} onChange={(e) => setField("tanggal", e.target.value)} />
            {errors.tanggal && <span className="field-error">{errors.tanggal}</span>}
          </div>
          <div className="form-group full">
            <label>Keterangan / Deskripsi</label>
            <textarea
              value={form.keterangan}
              onChange={(e) => setField("keterangan", e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Hapus Transaksi Temporer"
        message={`Yakin ingin menghapus transaksi "${toDelete?.judul}"? Seluruh daftar rincian uang masuk dan uang keluar di dalamnya juga akan terhapus permanen.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}