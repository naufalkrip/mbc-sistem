import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import type { TransaksiGroupWithStats, TransaksiDetail } from "../../types";
import { formatRupiah, formatTanggal } from "../../utils/format";
import { laporanTransaksi } from "../../services/pdf";
import { DataTable } from "../ui/DataTable";
import type { Column } from "../ui/DataTable";
import { SearchBar } from "../ui/SearchBar";
import { DatePicker } from "../ui/DatePicker";
import { Filter } from "../ui/Filter";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CurrencyInput } from "../ui/CurrencyInput";
import { DownloadPdfButton } from "../ui/DownloadPdfButton";
import {
  getTransaksiGroups,
  getTransaksiDetails,
  addTransaksiDetailItem,
  updateTransaksiDetailItem,
  deleteTransaksiDetailItem,
} from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useApi } from "../../hooks/useApi";
import { CACHE_KEYS } from "../../services/cache";

interface FormDetail {
  tanggal: string;
  jenis: "Pemasukan" | "Pengeluaran";
  kategori: string;
  nominal: number | string;
  keterangan: string;
}

const FORM_EMPTY: FormDetail = {
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: "Pengeluaran",
  kategori: "",
  nominal: "",
  keterangan: "",
};

const KATEGORI_SARAN_MASUK = ["Kas Awal", "Iuran Anggota", "Donasi / Sponsor", "Dana Organisasi", "Penjualan / Usaha", "Lainnya"];
const KATEGORI_SARAN_KELUAR = ["Peralatan / Aset", "Logistik & Perlengkapan", "Konsumsi", "Transportasi", "Honor / Jasa", "ATK & Cetak", "Lainnya"];

type ModalMode = "add" | "edit" | null;

export function TransaksiDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();

  const [group, setGroup] = useState<TransaksiGroupWithStats | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  // Use useApi for details with fast polling and cache
  const { data: details, loading: loadingDetails, refresh: refreshDetails } = useApi<TransaksiDetail[]>(
    useCallback(() => id ? getTransaksiDetails(id) : Promise.resolve([]), [id]),
    "Gagal memuat rincian transaksi.",
    id ? `${CACHE_KEYS.TRANSAKSI_DETAIL}:${id}` : undefined,
    { pollingInterval: 5000, revalidateOnFocus: true, immediate: true }
  );

  // Filter & Search state
  const [search, setSearch] = useState("");
  const [filterDari, setFilterDari] = useState("");
  const [filterSampai, setFilterSampai] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterKategori, setFilterKategori] = useState("");

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<FormDetail>(FORM_EMPTY);
  const [editing, setEditing] = useState<TransaksiDetail | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [toDelete, setToDelete] = useState<TransaksiDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingGroup(true);
      const groups = await getTransaksiGroups();
      const current = groups.find((g) => g.id === id);
      if (!current) {
        toastError("Transaksi tidak ditemukan.");
        navigate("/transaksi");
        return;
      }
      setGroup(current);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal memuat informasi grup transaksi.");
    } finally {
      setLoadingGroup(false);
    }
  }, [id, navigate, toastError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Kategori options for filter
  const kategoriOptions = useMemo(() => {
    const data = details ?? [];
    const set = new Set(data.map((t) => t.kategori).filter(Boolean));
    return Array.from(set).sort().map((k) => ({ value: k, label: k }));
  }, [details]);

  // Hitung running balance untuk setiap baris
  const chronologicalDetails = useMemo(() => {
    const data = details ?? [];
    return [...data].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "") || (a.id || "").localeCompare(b.id || ""));
  }, [details]);

  const runningBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    let bal = 0;
    for (const item of chronologicalDetails) {
      const nom = Number(item.nominal) || 0;
      if (item.jenis === "Pemasukan") {
        bal += nom;
      } else {
        bal -= nom;
      }
      map.set(item.id, bal);
    }
    return map;
  }, [chronologicalDetails]);

  const filtered = useMemo(() => {
    const data = details ?? [];
    return data
      .filter((t) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!`${t.keterangan} ${t.kategori}`.toLowerCase().includes(q)) return false;
        }
        if (filterDari && t.tanggal && t.tanggal < filterDari) return false;
        if (filterSampai && t.tanggal && t.tanggal > filterSampai) return false;
        if (filterJenis && t.jenis !== filterJenis) return false;
        if (filterKategori && t.kategori !== filterKategori) return false;
        return true;
      })
      .sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || "") || (a.id || "").localeCompare(b.id || ""));
  }, [details, search, filterDari, filterSampai, filterJenis, filterKategori]);

  const stats = useMemo(() => {
    const data = details ?? [];
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    data.forEach((t) => {
      const nom = Number(t.nominal) || 0;
      if (t.jenis === "Pemasukan") totalPemasukan += nom;
      else totalPengeluaran += nom;
    });
    return {
      totalTransaksi: data.length,
      totalPemasukan,
      totalPengeluaran,
      saldo: totalPemasukan - totalPengeluaran,
    };
  }, [details]);

  const validate = (f: FormDetail): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!f.tanggal) err.tanggal = "Tanggal wajib diisi.";
    if (!f.jenis) err.jenis = "Jenis transaksi wajib dipilih.";
    const nominal = Number(f.nominal);
    if (f.nominal === "" || Number.isNaN(nominal) || nominal <= 0) {
      err.nominal = "Nominal harus berupa angka lebih dari 0.";
    }
    if (!f.keterangan.trim()) {
      err.keterangan = "Keterangan / rincian penggunaan wajib diisi.";
    }
    return err;
  };

  const openAdd = (defaultJenis: "Pemasukan" | "Pengeluaran" = "Pengeluaran") => {
    setEditing(null);
    setForm({
      ...FORM_EMPTY,
      jenis: defaultJenis,
    });
    setErrors({});
    setModalMode("add");
  };

  const openEdit = (t: TransaksiDetail) => {
    setEditing(t);
    setForm({
      tanggal: t.tanggal.slice(0, 10),
      jenis: t.jenis,
      kategori: t.kategori,
      nominal: t.nominal,
      keterangan: t.keterangan,
    });
    setErrors({});
    setModalMode("edit");
  };

  const handleSubmit = async () => {
    if (!id) return;
    const err = validate(form);
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    setSaving(true);
    const payload: Omit<TransaksiDetail, "id" | "createdAt" | "updatedAt"> = {
      transaksiGroupId: id,
      tanggal: form.tanggal,
      jenis: form.jenis,
      kategori: form.kategori.trim() || "Lainnya",
      nominal: Number(form.nominal),
      keterangan: form.keterangan.trim(),
    };

    try {
      let result;
      if (editing) {
        result = await updateTransaksiDetailItem(editing.id, payload);
      } else {
        result = await addTransaksiDetailItem(payload);
      }

      setSaving(false);
      if (result.success) {
        toastSuccess(editing ? "Rincian transaksi berhasil diperbarui." : "Transaksi berhasil ditambahkan.");
        setModalMode(null);
        void refreshDetails(true);
      } else {
        toastError(result.message);
      }
    } catch (e) {
      setSaving(false);
      toastError(e instanceof Error ? e.message : "Gagal menyimpan transaksi.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteTransaksiDetailItem(toDelete.id);
    setDeleting(false);
    if (result.success) {
      toastSuccess("Rincian transaksi berhasil dihapus.");
      setToDelete(null);
      void refreshDetails(true);
    } else {
      toastError(result.message);
    }
  };

  const handleDownloadPdf = async () => {
    if (!group) return;
    const updatedGroup: TransaksiGroupWithStats = {
      ...group,
      totalTransaksi: stats.totalTransaksi,
      totalPemasukan: stats.totalPemasukan,
      totalPengeluaran: stats.totalPengeluaran,
      saldo: stats.saldo,
    };
    await laporanTransaksi(updatedGroup, details ?? []);
  };

  const setField = (key: keyof FormDetail, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  if (loadingGroup && !group) {
    return (
      <div className="page-grid">
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 18, color: "var(--muted)" }}>Memuat data transaksi...</div>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  const columns: Column<TransaksiDetail>[] = [
    { key: "no", header: "No", render: (_r, idx) => <>{idx + 1}</> },
    { key: "tanggal", header: "Tanggal", render: (r) => formatTanggal(r.tanggal) },
    {
      key: "keterangan",
      header: "Rincian / Keterangan",
      render: (r) => (
        <div>
          <strong>{r.keterangan || "-"}</strong>
          {r.kategori && (
            <div style={{ marginTop: 2 }}>
              <span className="badge" style={{ background: "var(--slate-100)", color: "var(--slate-600)", fontSize: 11 }}>
                {r.kategori}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "jenis",
      header: "Jenis",
      render: (r) => (
        <span
          className={`badge ${r.jenis === "Pemasukan" ? "badge-success" : "badge-danger"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {r.jenis === "Pemasukan" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
          {r.jenis === "Pemasukan" ? "Uang Masuk" : "Uang Keluar"}
        </span>
      ),
    },
    {
      key: "pemasukan",
      header: "Uang Masuk",
      render: (r) => (
        <span style={{ fontWeight: 600, color: r.jenis === "Pemasukan" ? "var(--green-700)" : "var(--slate-400)" }}>
          {r.jenis === "Pemasukan" ? formatRupiah(r.nominal) : "-"}
        </span>
      ),
    },
    {
      key: "pengeluaran",
      header: "Uang Keluar",
      render: (r) => (
        <span style={{ fontWeight: 600, color: r.jenis === "Pengeluaran" ? "var(--red-700)" : "var(--slate-400)" }}>
          {r.jenis === "Pengeluaran" ? formatRupiah(r.nominal) : "-"}
        </span>
      ),
    },
    {
      key: "saldoBerjalan",
      header: "Saldo",
      render: (r) => {
        const bal = runningBalancesMap.get(r.id) ?? 0;
        return (
          <span style={{ fontWeight: 700, color: bal >= 0 ? "var(--navy-900)" : "var(--red-700)" }}>
            {formatRupiah(bal)}
          </span>
        );
      },
    },
    {
      key: "aksi",
      header: "Aksi",
      render: (r) => (
        <div className="action-group">
          <button
            className="action-btn"
            data-tooltip="Edit Transaksi"
            aria-label="Edit Transaksi"
            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          >
            <Pencil size={16} />
          </button>
          <button
            className="action-btn danger"
            data-tooltip="Hapus"
            aria-label="Hapus"
            onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid">
      {/* Header Info & Actions */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button
              className="btn btn-ghost"
              onClick={() => navigate("/transaksi")}
              style={{ padding: "8px 12px", border: "1px solid var(--slate-200)" }}
              title="Kembali ke Daftar Transaksi"
            >
              <ArrowLeft size={18} />
              <span>Kembali</span>
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0 }}>{group.judul}</h2>
                <span className="badge badge-neutral" style={{ fontSize: 12 }}>
                  {formatTanggal(group.tanggal)}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.5 }}>
                {group.keterangan || "Rincian pemasukan & pengeluaran untuk kegiatan/transaksi ini"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <DownloadPdfButton onGenerate={handleDownloadPdf} variant="outline" label="Download PDF Laporan" />
            <button className="btn btn-primary" onClick={() => openAdd("Pengeluaran")}>
              <Plus size={17} /> Input Uang Keluar / Masuk
            </button>
          </div>
        </div>

        {/* Ringkasan Keuangan Transaksi - Panel Merah Standout Seperti Absensi */}
        <div className="summary-panel" style={{ marginTop: 16 }}>
          <div className="summary-panel-header">
            <div>
              <h3>Ringkasan Uang Masuk & Keluar</h3>
              <p>Total rekap keuangan untuk transaksi ini</p>
            </div>
            <span
              style={{
                fontSize: "12px",
                color: "#ffffff",
                background: "rgba(255, 255, 255, 0.18)",
                border: "1px solid rgba(255, 255, 255, 0.28)",
                padding: "4px 12px",
                borderRadius: 20,
                fontWeight: 500,
              }}
            >
              {stats.totalTransaksi} Rincian Transaksi
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
              gap: 12,
            }}
          >
            {/* Total Uang Masuk */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(4px)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: "13px", fontWeight: 500 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    flexShrink: 0,
                  }}
                >
                  <TrendingUp size={16} />
                </div>
                <span>Total Uang Masuk</span>
              </div>
              <div style={{ fontSize: "clamp(16px, 3.5vw, 22px)", fontWeight: 700, color: "#ffffff", marginTop: 4, wordBreak: "break-word" }}>
                {formatRupiah(stats.totalPemasukan)}
              </div>
            </div>

            {/* Total Uang Keluar */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(4px)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: "13px", fontWeight: 500 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    flexShrink: 0,
                  }}
                >
                  <TrendingDown size={16} />
                </div>
                <span>Total Uang Keluar</span>
              </div>
              <div style={{ fontSize: "clamp(16px, 3.5vw, 22px)", fontWeight: 700, color: "#ffffff", marginTop: 4, wordBreak: "break-word" }}>
                {formatRupiah(stats.totalPengeluaran)}
              </div>
            </div>

            {/* Sisa Saldo Kas */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.16)",
                backdropFilter: "blur(4px)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: "13px", fontWeight: 500 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    flexShrink: 0,
                  }}
                >
                  <Wallet size={16} />
                </div>
                <span>Sisa Saldo Kas</span>
              </div>
              <div style={{ fontSize: "clamp(16px, 3.5vw, 22px)", fontWeight: 700, color: "#ffffff", marginTop: 4, wordBreak: "break-word" }}>
                {formatRupiah(stats.saldo)}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="toolbar" style={{ marginTop: 20 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cari rincian keperluan atau kategori..." />
          <DatePicker label="Dari" value={filterDari} onChange={setFilterDari} />
          <DatePicker label="Sampai" value={filterSampai} onChange={setFilterSampai} />
          <Filter
            label="Jenis"
            value={filterJenis}
            onChange={setFilterJenis}
            options={[
              { value: "Pemasukan", label: "Uang Masuk" },
              { value: "Pengeluaran", label: "Uang Keluar" },
            ]}
          />
          <Filter label="Kategori" value={filterKategori} onChange={setFilterKategori} options={kategoriOptions} />
        </div>

        {/* Table Details */}
        <DataTable
          columns={columns}
          data={filtered}
          loading={loadingDetails}
          rowKey={(r) => r.id}
          emptyTitle="Belum ada transaksi uang masuk / keluar"
          emptyMessage="Klik tombol 'Input Uang Keluar / Masuk' di atas untuk mulai mencatat rincian transaksi ini."
        />
        {filtered.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-soft)", fontSize: "12px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Menampilkan total {filtered.length} rincian transaksi (scroll vertikal untuk melihat transaksi lainnya)</span>
          </div>
        )}
      </div>

      {/* Modal Input Transaksi Uang Masuk / Keluar */}
      <Modal
        open={modalMode !== null}
        title={editing ? "Edit Transaksi" : "Input Transaksi (Uang Masuk / Keluar)"}
        onClose={() => setModalMode(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalMode(null)} disabled={saving}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan Transaksi"}
            </button>
          </>
        }
      >
        <div className="form-grid" style={{ gap: 10 }}>
          {/* Baris 1: Segmented Switcher for Jenis Transaksi */}
          <div className="form-group" style={{ gridColumn: "1 / -1", gap: 3 }}>
            <label style={{ fontWeight: 500, fontSize: "13px", color: "var(--slate-700)" }}>Jenis Transaksi *</label>
            <div className="type-toggle-group" style={{ gap: 8 }}>
              <button
                type="button"
                className={`type-toggle-btn ${form.jenis === "Pemasukan" ? "active-masuk" : ""}`}
                style={{ padding: "6px 12px", height: 34, fontSize: "13px" }}
                onClick={() => setField("jenis", "Pemasukan")}
              >
                <span className="type-toggle-icon" style={{ width: 18, height: 18 }}>
                  <ArrowDownLeft size={13} />
                </span>
                <span>Uang Masuk (Pemasukan)</span>
              </button>

              <button
                type="button"
                className={`type-toggle-btn ${form.jenis === "Pengeluaran" ? "active-keluar" : ""}`}
                style={{ padding: "6px 12px", height: 34, fontSize: "13px" }}
                onClick={() => setField("jenis", "Pengeluaran")}
              >
                <span className="type-toggle-icon" style={{ width: 18, height: 18 }}>
                  <ArrowUpRight size={13} />
                </span>
                <span>Uang Keluar (Pengeluaran)</span>
              </button>
            </div>
            {errors.jenis && <span className="field-error">{errors.jenis}</span>}
          </div>

          {/* Baris 2: Tanggal & Nominal */}
          <div className="form-group" style={{ gap: 3 }}>
            <label style={{ fontWeight: 500, fontSize: "13px", color: "var(--slate-700)" }}>Tanggal Transaksi *</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setField("tanggal", e.target.value)}
              style={{ height: 36, padding: "5px 10px", fontSize: "14px" }}
            />
            {errors.tanggal && <span className="field-error">{errors.tanggal}</span>}
          </div>

          <div className="form-group" style={{ gap: 3 }}>
            <label style={{ fontWeight: 500, fontSize: "13px", color: "var(--slate-700)" }}>Nominal (Rupiah) *</label>
            <CurrencyInput value={form.nominal} onChange={(v) => setField("nominal", v)} placeholder="0" />
            {errors.nominal && <span className="field-error">{errors.nominal}</span>}
          </div>

          {/* Baris 3: Kategori & Keterangan Rincian */}
          <div className="form-group" style={{ gap: 3 }}>
            <label style={{ fontWeight: 500, fontSize: "13px", color: "var(--slate-700)" }}>Kategori</label>
            <input
              list="kategori-suggestions"
              value={form.kategori}
              onChange={(e) => setField("kategori", e.target.value)}
              placeholder="Pilih atau ketik kategori..."
              style={{ height: 36, padding: "5px 10px", fontSize: "14px" }}
            />
            <datalist id="kategori-suggestions">
              {(form.jenis === "Pemasukan" ? KATEGORI_SARAN_MASUK : KATEGORI_SARAN_KELUAR).map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </div>

          <div className="form-group" style={{ gap: 3 }}>
            <label style={{ fontWeight: 500, fontSize: "13px", color: "var(--slate-700)" }}>Keterangan / Rincian *</label>
            <input
              type="text"
              value={form.keterangan}
              onChange={(e) => setField("keterangan", e.target.value)}
              placeholder={
                form.jenis === "Pemasukan"
                  ? "Contoh: Iuran anggota, Donasi alumni A..."
                  : "Contoh: Beli stik drum, Nasi kotak 15 porsi..."
              }
              style={{ height: 36, padding: "5px 10px", fontSize: "14px" }}
            />
            {errors.keterangan && <span className="field-error">{errors.keterangan}</span>}
          </div>

          {/* Baris 4: Quick Category Pills */}
          <div className="form-group" style={{ gridColumn: "1 / -1", marginTop: -2, gap: 3 }}>
            <div className="category-pill-group" style={{ margin: 0, gap: 5 }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", marginRight: 2 }}>Pilihan Cepat:</span>
              {(form.jenis === "Pemasukan" ? KATEGORI_SARAN_MASUK : KATEGORI_SARAN_KELUAR).map((kat) => (
                <button
                  key={kat}
                  type="button"
                  className={`category-pill ${form.kategori === kat ? "active" : ""}`}
                  onClick={() => setField("kategori", kat)}
                  style={{ padding: "3px 8px", fontSize: "12px" }}
                >
                  {kat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Hapus Rincian Transaksi"
        message={`Yakin ingin menghapus transaksi "${toDelete?.keterangan}" (${formatRupiah(toDelete?.nominal ?? 0)})?`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}