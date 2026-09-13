import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { addAnggota, deleteAnggota, getAnggota, updateAnggota } from "../services/api";
import { CACHE_KEYS, cacheMutate } from "../services/cache";
import { laporanAnggota } from "../services/pdf";
import type { Anggota } from "../types";
import { STATUS_ANGGOTA } from "../config";
import { formatTanggal } from "../utils/format";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";
import { SearchBar } from "../components/ui/SearchBar";
import { Filter } from "../components/ui/Filter";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DownloadPdfButton } from "../components/ui/DownloadPdfButton";

interface FormAnggota {
  nama: string;
  divisi: string;
  jabatan: string;
  noHp: string;
  status: string;
  tanggalBergabung: string;
  keterangan: string;
}

const FORM_EMPTY: FormAnggota = {
  nama: "",
  divisi: "",
  jabatan: "",
  noHp: "",
  status: "Aktif",
  tanggalBergabung: new Date().toISOString().slice(0, 10),
  keterangan: "",
};

type ModalMode = "add" | "edit" | null;

export function Anggota() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { data, loading, refresh } = useApi<Anggota[]>(getAnggota, "Gagal mengambil data.", CACHE_KEYS.ANGGOTA);

  const [search, setSearch] = useState("");
  const [filterDivisi, setFilterDivisi] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<FormAnggota>(FORM_EMPTY);
  const [editing, setEditing] = useState<Anggota | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = false;
  const [extraDivisi, setExtraDivisi] = useState<string[]>([]);
  const [newDivisi, setNewDivisi] = useState("");
  const [showDivisiInput, setShowDivisiInput] = useState(false);

  const [detail, setDetail] = useState<Anggota | null>(null);
  const [toDelete, setToDelete] = useState<Anggota | null>(null);
  const deleting = false;

  const anggota = data ?? [];

  const divisiOptions = useMemo(() => {
    const set = new Set(anggota.map((a) => a.divisi).filter(Boolean));
    return Array.from(set).sort().map((d) => ({ value: d, label: d }));
  }, [anggota]);

  const allDivisiOptions = useMemo(() => {
    const set = new Set<string>(divisiOptions.map((d) => d.value));
    extraDivisi.forEach((d) => set.add(d));
    return Array.from(set).sort().map((d) => ({ value: d, label: d }));
  }, [divisiOptions, extraDivisi]);

  const tambahDivisi = () => {
    const v = newDivisi.trim();
    if (!v) return;
    setField("divisi", v);
    setExtraDivisi((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewDivisi("");
    setShowDivisiInput(false);
  };

  const filtered = useMemo(() => {
    return anggota
      .filter((a) => {
        if (search) {
          const q = search.toLowerCase();
          if (
            !`${a.id} ${a.nama} ${a.divisi} ${a.jabatan} ${a.noHp}`.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (filterDivisi && a.divisi !== filterDivisi) return false;
        if (filterStatus && a.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const divisiA = a.divisi ?? "";
        const divisiB = b.divisi ?? "";
        const divisiCompare = divisiA.localeCompare(divisiB);
        if (divisiCompare !== 0) return divisiCompare;
        return (a.nama ?? "").localeCompare(b.nama ?? "");
      });
  }, [anggota, search, filterDivisi, filterStatus]);

  const validate = (f: FormAnggota): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!f.nama.trim()) err.nama = "Nama wajib diisi.";
    if (!f.status) err.status = "Status anggota wajib dipilih.";
    if (!f.tanggalBergabung) err.tanggalBergabung = "Tanggal bergabung wajib diisi.";
    return err;
  };

  const openAdd = () => {
    setEditing(null);
    setForm(FORM_EMPTY);
    setErrors({});
    setShowDivisiInput(false);
    setNewDivisi("");
    setModalMode("add");
  };

  const openEdit = (a: Anggota) => {
    setEditing(a);
    setForm({
      nama: a.nama,
      divisi: a.divisi,
      jabatan: a.jabatan,
      noHp: a.noHp,
      status: a.status,
      tanggalBergabung: a.tanggalBergabung.slice(0, 10),
      keterangan: a.keterangan,
    });
    setErrors({});
    setShowDivisiInput(false);
    setNewDivisi("");
    setModalMode("edit");
  };

  const handleSubmit = async () => {
    const err = validate(form);
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    const payload = {
      nama: form.nama.trim(),
      divisi: form.divisi.trim(),
      jabatan: form.jabatan.trim(),
      noHp: form.noHp.trim(),
      status: form.status as Anggota["status"],
      tanggalBergabung: form.tanggalBergabung,
      keterangan: form.keterangan.trim(),
    };

    const isEdit = Boolean(editing);
    const targetId = editing ? editing.id : `MB${Date.now().toString().slice(-4)}`;
    const optimisticItem: Anggota = {
      ...payload,
      id: targetId,
    };

    // 1. INSTAN 0-ms: Update UI & Cache seketika + tutup modal
    cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) => {
      const list = prev ?? [];
      if (isEdit) {
        return list.map((a) => (a.id === editing!.id ? optimisticItem : a));
      }
      return [optimisticItem, ...list];
    });

    setModalMode(null);
    toastSuccess(isEdit ? "Perubahan anggota berhasil disimpan." : "Anggota baru berhasil ditambahkan.");

    // 2. Background Sync ke server
    try {
      const result = isEdit
        ? await updateAnggota(editing!.id, payload)
        : await addAnggota(payload);

      if (!result.success) {
        toastError(result.message || "Gagal menyimpan ke server.");
        void refresh(true);
      } else {
        void refresh(true);
      }
    } catch {
      toastError("Gagal menghubungi server.");
      void refresh(true);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const deletedId = toDelete.id;
    const deletedItem = toDelete;

    // 1. INSTAN 0-ms: Hapus dari UI & Cache seketika + tutup dialog
    cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) =>
      (prev ?? []).filter((a) => a.id !== deletedId)
    );
    setToDelete(null);
    toastSuccess("Data anggota berhasil dihapus.");

    // 2. Background Sync ke server
    try {
      const result = await deleteAnggota(deletedId);
      if (!result.success) {
        toastError(result.message || "Gagal menghapus data di server.");
        cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) => [deletedItem, ...(prev ?? [])]);
      } else {
        void refresh(true);
      }
    } catch {
      toastError("Gagal menghubungi server.");
      cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) => [deletedItem, ...(prev ?? [])]);
    }
  };

  const handleDownloadPdf = async () => {
    const parts: string[] = [];
    if (filterDivisi) parts.push(`Divisi: ${filterDivisi}`);
    if (filterStatus) parts.push(`Status: ${filterStatus}`);
    if (search.trim()) parts.push(`Pencarian: "${search.trim()}"`);
    const periode = parts.length ? parts.join(" · ") : "Seluruh data anggota";
    await laporanAnggota(filtered, periode);
  };

  const setField = (key: keyof FormAnggota, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const columns: Column<Anggota>[] = [
    { key: "no", header: "No", render: (_r, idx) => <>{idx + 1}</> },
    { key: "nama", header: "Nama Lengkap" },
    { key: "divisi", header: "Divisi" },
    { key: "jabatan", header: "Jabatan" },
    { key: "noHp", header: "No. HP" },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "tanggalBergabung", header: "Tanggal Bergabung", render: (r) => formatTanggal(r.tanggalBergabung) },
    {
      key: "aksi",
      header: "Aksi",
      render: (r) => (
        <div className="action-group">
          <button className="action-btn" data-tooltip="Detail" aria-label="Detail" onClick={(e) => { e.stopPropagation(); setDetail(r); }}><Eye size={16} /></button>
          <button className="action-btn" data-tooltip="Edit" aria-label="Edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil size={16} /></button>
          <button className="action-btn danger" data-tooltip="Hapus" aria-label="Hapus" onClick={(e) => { e.stopPropagation(); setToDelete(r); }}><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Daftar Anggota</h2>
            <p>{loading ? "Memuat data..." : `${filtered.length} data anggota ditampilkan`}</p>
          </div>
          <div className="header-actions">
            <DownloadPdfButton onGenerate={handleDownloadPdf} />
            <button className="btn btn-primary" onClick={openAdd}><Plus size={17} /> Tambah Anggota</button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBar value={search} onChange={setSearch} placeholder="Cari nama / divisi / No. HP..." />
          <Filter label="Divisi" value={filterDivisi} onChange={setFilterDivisi} options={divisiOptions} />
          <Filter
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_ANGGOTA.map((s) => ({ value: s, label: s }))}
          />
        </div>

        <DataTable columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id} emptyMessage="Tidak ada anggota ditemukan." />
      </div>

      <Modal
        open={modalMode !== null}
        title={editing ? "Edit Anggota" : "Tambah Anggota"}
        onClose={() => setModalMode(null)}
        size="lg"
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
            <label>Nama *</label>
            <input value={form.nama} onChange={(e) => setField("nama", e.target.value)} placeholder="Nama lengkap anggota" />
            {errors.nama && <span className="field-error">{errors.nama}</span>}
          </div>
          <div className="form-group">
            <label>Divisi</label>
            <div className="divisi-field">
              <select value={form.divisi} onChange={(e) => setField("divisi", e.target.value)}>
                <option value="">— Tanpa divisi —</option>
                {allDivisiOptions.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <button type="button" className="btn btn-outline divisi-add-btn" onClick={() => setShowDivisiInput((v) => !v)} aria-label="Tambah divisi baru" title="Tambah divisi baru">
                <Plus size={16} />
              </button>
            </div>
            {showDivisiInput && (
              <div className="divisi-add-inline">
                <input
                  value={newDivisi}
                  onChange={(e) => setNewDivisi(e.target.value)}
                  placeholder="Nama divisi baru"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); tambahDivisi(); } }}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={tambahDivisi}>Tambah</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>No. HP</label>
            <input value={form.noHp} onChange={(e) => setField("noHp", e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" />
          </div>
          <div className="form-group">
            <label>Status *</label>
            <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
              {STATUS_ANGGOTA.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.status && <span className="field-error">{errors.status}</span>}
          </div>
          <div className="form-group">
            <label>Tanggal Bergabung *</label>
            <input type="date" value={form.tanggalBergabung} onChange={(e) => setField("tanggalBergabung", e.target.value)} />
            {errors.tanggalBergabung && <span className="field-error">{errors.tanggalBergabung}</span>}
          </div>
          <div className="form-group full">
            <label>Keterangan</label>
            <textarea value={form.keterangan} onChange={(e) => setField("keterangan", e.target.value)} placeholder="Keterangan tambahan (opsional)" />
          </div>
        </div>
      </Modal>

      <Modal open={detail !== null} title="Detail Anggota" onClose={() => setDetail(null)} size="sm"
        footer={<button className="btn btn-primary" onClick={() => setDetail(null)}>Tutup</button>}
      >
        {detail && (
          <div className="detail-list">
            <div className="detail-row"><span className="detail-label">Nama</span><span>{detail.nama}</span></div>
            <div className="detail-row"><span className="detail-label">Divisi</span><span>{detail.divisi}</span></div>
            <div className="detail-row"><span className="detail-label">Jabatan</span><span>{detail.jabatan}</span></div>
            <div className="detail-row"><span className="detail-label">No. HP</span><span>{detail.noHp}</span></div>
            <div className="detail-row"><span className="detail-label">Status</span><span><StatusBadge value={detail.status} /></span></div>
            <div className="detail-row"><span className="detail-label">Tanggal Bergabung</span><span>{formatTanggal(detail.tanggalBergabung)}</span></div>
            <div className="detail-row"><span className="detail-label">Keterangan</span><span>{detail.keterangan || "-"}</span></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Hapus Anggota"
        message={`Yakin ingin menghapus anggota "${toDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}