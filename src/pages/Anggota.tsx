import { useMemo, useRef, useState } from "react";
import {
  Eye,
  ListOrdered,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { addAnggota, deleteAnggota, getAnggota, updateAnggota } from "../services/api";
import { CACHE_KEYS, cacheMutate } from "../services/cache";
import { saveMemberPhoto, getMemberPhoto, deleteMemberPhoto } from "../services/photoStorage";
import { laporanAnggota } from "../services/pdf";
import type { Anggota } from "../types";
import { STATUS_ANGGOTA } from "../config";
import { formatNoHp, formatTanggal, normalizeStatusAnggota, toWaLink } from "../utils/format";
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
  namaPanggilan: string;
  divisi: string;
  jabatan: string;
  noHp: string;
  status: string;
  tanggalBergabung: string;
  keterangan: string;
  foto: string;
}

const FORM_EMPTY: FormAnggota = {
  nama: "",
  namaPanggilan: "",
  divisi: "",
  jabatan: "",
  noHp: "",
  status: "Aktif",
  tanggalBergabung: new Date().toISOString().slice(0, 10),
  keterangan: "",
  foto: "",
};

function compressImage(file: File, maxWidth = 260, maxHeight = 260, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        try {
          const webpData = canvas.toDataURL("image/webp", quality);
          if (webpData.startsWith("data:image/webp")) {
            resolve(webpData);
            return;
          }
        } catch {
          // fallback
        }
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type ModalMode = "add" | "edit" | null;

export function Anggota() {
  const { success: toastSuccess, error: toastError } = useToast();
  // Faster polling (5s) for real-time feel on anggota page
  const { data, loading, refresh } = useApi<Anggota[]>(
    getAnggota,
    "Gagal mengambil data anggota.",
    CACHE_KEYS.ANGGOTA,
    { pollingInterval: 5000, revalidateOnFocus: true, immediate: true }
  );

  const [search, setSearch] = useState("");
  const [filterDivisi, setFilterDivisi] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  type SortField = "nama" | "namaPanggilan" | "divisi";
  type SortDirection = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showDivisiModal, setShowDivisiModal] = useState(false);
  const [customDivisiOrder, setCustomDivisiOrder] = useState<string[]>([]);
  const [tempDivisiOrder, setTempDivisiOrder] = useState<string[]>([]);

  const handleSort = (key: string) => {
    if (key === "divisi") {
      openDivisiSortModal();
      return;
    }
    if (key !== "nama" && key !== "namaPanggilan") return;
    if (sortField === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        // Siklus: Ascending -> Descending -> Reset Default
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(key as SortField);
      setSortDirection("asc");
    }
  };

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<FormAnggota>(FORM_EMPTY);
  const [editing, setEditing] = useState<Anggota | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = false;
  const [extraDivisi, setExtraDivisi] = useState<string[]>([]);
  const [newDivisi, setNewDivisi] = useState("");
  const [showDivisiInput, setShowDivisiInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Daftar divisi unik untuk modal urutan
  const uniqueDivisiList = useMemo(() => {
    const set = new Set<string>();
    anggota.forEach((a) => {
      const d = (a.divisi || "").trim();
      if (d) set.add(d);
    });
    extraDivisi.forEach((d) => {
      const trimmed = d.trim();
      if (trimmed) set.add(trimmed);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [anggota, extraDivisi]);

  const openDivisiSortModal = () => {
    const baseList = customDivisiOrder.length > 0 ? [...customDivisiOrder] : [...uniqueDivisiList];
    uniqueDivisiList.forEach((d) => {
      if (!baseList.includes(d)) baseList.push(d);
    });
    const validOrder = baseList.filter((d) => uniqueDivisiList.includes(d));
    setTempDivisiOrder(validOrder);
    setShowDivisiModal(true);
  };

  const handleChangeRank = (currentIndex: number, newRank: number) => {
    const targetIndex = newRank - 1;
    if (currentIndex === targetIndex) return;
    setTempDivisiOrder((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(currentIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
  };

  const handlePresetAZ = () => {
    setTempDivisiOrder((prev) => [...prev].sort((a, b) => a.localeCompare(b, "id")));
  };

  const handlePresetZA = () => {
    setTempDivisiOrder((prev) => [...prev].sort((a, b) => b.localeCompare(a, "id")));
  };

  const applyDivisiOrder = () => {
    setCustomDivisiOrder(tempDivisiOrder);
    setSortField("divisi");
    setSortDirection("asc");
    setShowDivisiModal(false);
    toastSuccess("Urutan prioritas divisi berhasil diterapkan!");
  };

  const resetDivisiOrder = () => {
    setCustomDivisiOrder([]);
    setTempDivisiOrder([...uniqueDivisiList]);
    if (sortField === "divisi") {
      setSortField(null);
    }
    setShowDivisiModal(false);
    toastSuccess("Urutan divisi dikembalikan ke default.");
  };

  const tambahDivisi = () => {
    const v = newDivisi.trim();
    if (!v) return;
    setField("divisi", v);
    setExtraDivisi((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewDivisi("");
    setShowDivisiInput(false);
  };

  const filtered = useMemo(() => {
    const list = anggota.filter((a) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${a.id} ${a.nama} ${a.namaPanggilan ?? ""} ${a.divisi} ${a.jabatan} ${a.noHp}`.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filterDivisi && a.divisi !== filterDivisi) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });

    if (sortField === "divisi") {
      const activeOrder = customDivisiOrder.length > 0 ? customDivisiOrder : uniqueDivisiList;
      const rankMap = new Map(activeOrder.map((d, i) => [d.trim().toLowerCase(), i + 1]));

      return [...list].sort((a, b) => {
        const divA = (a.divisi ?? "").trim().toLowerCase();
        const divB = (b.divisi ?? "").trim().toLowerCase();
        const rankA = rankMap.get(divA) ?? 9999;
        const rankB = rankMap.get(divB) ?? 9999;
        if (rankA !== rankB) {
          return sortDirection === "asc" ? rankA - rankB : rankB - rankA;
        }
        return (a.nama ?? "").localeCompare(b.nama ?? "", "id", { sensitivity: "base" });
      });
    }

    if (sortField) {
      return [...list].sort((a, b) => {
        const valA = String(a[sortField] ?? "").trim();
        const valB = String(b[sortField] ?? "").trim();
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        const cmp = valA.localeCompare(valB, "id", { sensitivity: "base", numeric: true });
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    // Default: Urut berdasarkan divisi lalu nama lengkap
    return [...list].sort((a, b) => {
      const divisiA = a.divisi ?? "";
      const divisiB = b.divisi ?? "";
      const divisiCompare = divisiA.localeCompare(divisiB);
      if (divisiCompare !== 0) return divisiCompare;
      return (a.nama ?? "").localeCompare(b.nama ?? "");
    });
  }, [anggota, search, filterDivisi, filterStatus, sortField, sortDirection, customDivisiOrder, uniqueDivisiList]);

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
    const existingPhoto = a.foto || getMemberPhoto(a.id, a.nama) || "";
    setForm({
      nama: a.nama,
      namaPanggilan: a.namaPanggilan || "",
      divisi: a.divisi,
      jabatan: a.jabatan,
      noHp: formatNoHp(a.noHp),
      status: normalizeStatusAnggota(a.status),
      tanggalBergabung: a.tanggalBergabung ? a.tanggalBergabung.slice(0, 10) : new Date().toISOString().slice(0, 10),
      keterangan: a.keterangan,
      foto: existingPhoto,
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
      namaPanggilan: form.namaPanggilan.trim(),
      divisi: form.divisi.trim(),
      jabatan: form.jabatan.trim(),
      noHp: formatNoHp(form.noHp),
      status: normalizeStatusAnggota(form.status),
      tanggalBergabung: form.tanggalBergabung,
      keterangan: form.keterangan.trim(),
      foto: form.foto || "",
    };

    const isEdit = Boolean(editing);
    const targetId = editing ? editing.id : `MB${Date.now().toString().slice(-4)}`;
    const optimisticItem: Anggota = {
      ...payload,
      id: targetId,
    };

    // Simpan foto di hybrid client storage seketika
    saveMemberPhoto(targetId, payload.nama, payload.foto);

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
        if (result.data?.id) {
          saveMemberPhoto(result.data.id, result.data.nama || payload.nama, payload.foto);
        }
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

    deleteMemberPhoto(deletedId, deletedItem.nama);

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
    if (sortField) {
      const fieldName =
        sortField === "nama"
          ? "Nama Lengkap"
          : sortField === "namaPanggilan"
          ? "Nama Panggilan"
          : customDivisiOrder.length > 0
          ? "Urutan Prioritas Divisi"
          : "Divisi";
      parts.push(`Urut: ${fieldName} (${sortDirection === "asc" ? "A-Z" : "Z-A"})`);
    }
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
    {
      key: "nama",
      header: "Nama Lengkap",
      sortable: true,
      render: (r) => {
        const photoUrl = r.foto || getMemberPhoto(r.id, r.nama);
        return (
          <div className="member-name-cell">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={r.nama}
                className="member-avatar-img"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "inline-flex";
                }}
              />
            ) : null}
            <div
              className="member-avatar-placeholder"
              style={{ display: photoUrl ? "none" : "inline-flex" }}
            >
              {r.nama ? r.nama.trim().charAt(0).toUpperCase() : "A"}
            </div>
            <span className="member-name-text">{r.nama}</span>
          </div>
        );
      },
    },
    {
      key: "namaPanggilan",
      header: "Nama Panggilan",
      sortable: true,
      render: (r) => r.namaPanggilan || "-",
    },
    { key: "divisi", header: "Divisi", sortable: true },
    {
      key: "noHp",
      header: "No. HP",
      render: (r) => {
        if (!r.noHp) return "-";
        return (
          <a
            href={toWaLink(r.noHp)}
            target="_blank"
            rel="noopener noreferrer"
            className="wa-table-link"
            onClick={(e) => e.stopPropagation()}
            title={`Hubungi ${r.nama} via WhatsApp (${r.noHp})`}
          >
            <MessageCircle size={14} className="wa-icon" />
            <span>{r.noHp}</span>
          </a>
        );
      },
    },
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <p style={{ margin: 0 }}>{loading ? "Memuat data..." : `${filtered.length} data anggota ditampilkan`}</p>
              {sortField && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    className="sort-active-badge"
                    onClick={() => {
                      if (sortField === "divisi") setCustomDivisiOrder([]);
                      setSortField(null);
                      setSortDirection("asc");
                    }}
                    title="Klik untuk reset urutan default"
                  >
                    <span>
                      Urut: {sortField === "nama" ? "Nama Lengkap" : sortField === "namaPanggilan" ? "Nama Panggilan" : customDivisiOrder.length > 0 ? "Divisi (Pilihan Urutan)" : "Divisi"} ({sortDirection === "asc" ? "A-Z" : "Z-A"})
                    </span>
                    <span className="sort-badge-close">×</span>
                  </button>
                  {sortField === "divisi" && (
                    <button
                      type="button"
                      className="divisi-preset-btn"
                      style={{ padding: "0.2rem 0.55rem" }}
                      onClick={openDivisiSortModal}
                      title="Ubah urutan divisi"
                    >
                      <ListOrdered size={12} /> Ubah
                    </button>
                  )}
                </div>
              )}
            </div>
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
          <button
            type="button"
            className={`btn ${sortField === "divisi" ? "btn-primary" : "btn-secondary"}`}
            onClick={openDivisiSortModal}
            title="Buka popup untuk memilih urutan divisi"
            style={{ whiteSpace: "nowrap" }}
          >
            <ListOrdered size={16} />
            <span>Urutan Divisi</span>
            {customDivisiOrder.length > 0 && (
              <span style={{
                marginLeft: "4px",
                fontSize: "0.72rem",
                backgroundColor: sortField === "divisi" ? "rgba(255,255,255,0.3)" : "rgba(14,165,233,0.18)",
                color: sortField === "divisi" ? "#fff" : "var(--primary)",
                padding: "1px 6px",
                borderRadius: "9999px",
                fontWeight: 600
              }}>
                {customDivisiOrder.length}
              </span>
            )}
          </button>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          rowKey={(r) => r.id}
          emptyMessage="Tidak ada anggota ditemukan."
          sortKey={sortField ?? undefined}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
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
          <div className="form-group full member-photo-upload-group">
            <label>Foto Profil Anggota</label>
            <div className="member-photo-uploader">
              <div
                className="member-photo-preview-box"
                onClick={() => fileInputRef.current?.click()}
                title={form.foto ? "Klik untuk ganti foto" : "Klik untuk unggah foto"}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                {form.foto ? (
                  <img src={form.foto} alt="Preview Foto" className="member-photo-preview-img" />
                ) : (
                  <div className="member-photo-preview-empty">
                    <User size={28} />
                  </div>
                )}
              </div>
              <div className="member-photo-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      toastError("Harap pilih file gambar (JPG, PNG, WebP).");
                      return;
                    }
                    try {
                      const compressed = await compressImage(file);
                      setField("foto", compressed);
                    } catch {
                      toastError("Gagal memproses file foto.");
                    }
                    e.target.value = "";
                  }}
                />
                <div className="member-photo-btn-row">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm member-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    {form.foto ? "Ganti Foto" : "Unggah Foto"}
                  </button>
                  {form.foto && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm member-photo-remove-btn"
                      onClick={() => setField("foto", "")}
                      title="Hapus foto"
                    >
                      <Trash2 size={14} />
                      Hapus
                    </button>
                  )}
                </div>
                <span className="member-photo-hint">
                  JPG, PNG atau WebP (maks. 5MB). Otomatis dioptimalkan untuk performa cepat.
                </span>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Nama Lengkap *</label>
            <input value={form.nama} onChange={(e) => setField("nama", e.target.value)} placeholder="Nama lengkap anggota" />
            {errors.nama && <span className="field-error">{errors.nama}</span>}
          </div>
          <div className="form-group">
            <label>Nama Panggilan</label>
            <input value={form.namaPanggilan} onChange={(e) => setField("namaPanggilan", e.target.value)} placeholder="Nama panggilan / sapaan" />
          </div>
          <div className="form-group">
            <div className="form-label-row">
              <label>Divisi</label>
              <button
                type="button"
                className="divisi-add-toggle-btn"
                onClick={() => setShowDivisiInput((v) => !v)}
                title="Tambah divisi baru"
              >
                <Plus size={13} /> {showDivisiInput ? "Batal" : "Tambah Divisi"}
              </button>
            </div>
            <select value={form.divisi} onChange={(e) => setField("divisi", e.target.value)}>
              <option value="">— Tanpa divisi —</option>
              {allDivisiOptions.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
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
            <label>Status *</label>
            <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
              {STATUS_ANGGOTA.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.status && <span className="field-error">{errors.status}</span>}
          </div>
          <div className="form-group">
            <label>No. HP</label>
            <input value={form.noHp} onChange={(e) => setField("noHp", e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" />
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

      {/* Modal Popup Pilihan Urutan Divisi (Minimalis) */}
      <Modal
        open={showDivisiModal}
        title="Urutan Divisi"
        onClose={() => setShowDivisiModal(false)}
        size="sm"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetDivisiOrder}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}
            >
              Reset
            </button>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowDivisiModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={applyDivisiOrder}
              >
                Terapkan
              </button>
            </div>
          </div>
        }
      >
        <div className="divisi-sort-modal-body">
          {tempDivisiOrder.length > 1 && (
            <div className="divisi-sort-presets">
              <span className="divisi-sort-preset-label">Atur cepat:</span>
              <button
                type="button"
                className="divisi-preset-btn"
                onClick={handlePresetAZ}
                title="Urutkan A ke Z"
              >
                A - Z
              </button>
              <button
                type="button"
                className="divisi-preset-btn"
                onClick={handlePresetZA}
                title="Urutkan Z ke A"
              >
                Z - A
              </button>
            </div>
          )}

          {tempDivisiOrder.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Belum ada data divisi.
            </div>
          ) : (
            <div className="divisi-sort-list">
              {tempDivisiOrder.map((divisiName, index) => (
                <div key={divisiName} className="divisi-sort-row">
                  <span className="divisi-name-text">{divisiName}</span>
                  <select
                    className="divisi-rank-select"
                    value={index + 1}
                    onChange={(e) => handleChangeRank(index, Number(e.target.value))}
                    title={`Urutan ${divisiName}`}
                  >
                    {tempDivisiOrder.map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={detail !== null} title="Detail Anggota" onClose={() => setDetail(null)} size="sm"
        footer={<button className="btn btn-primary" onClick={() => setDetail(null)}>Tutup</button>}
      >
        {detail && (
          <div className="detail-list">
            {Boolean(detail.foto || getMemberPhoto(detail.id, detail.nama)) && (
              <div className="detail-member-photo-wrap">
                <img
                  src={detail.foto || getMemberPhoto(detail.id, detail.nama)}
                  alt={detail.nama}
                  className="detail-member-photo"
                />
              </div>
            )}
            <div className="detail-row"><span className="detail-label">Nama Lengkap</span><span>{detail.nama}</span></div>
            {detail.namaPanggilan && (
              <div className="detail-row"><span className="detail-label">Nama Panggilan</span><span>{detail.namaPanggilan}</span></div>
            )}
            <div className="detail-row"><span className="detail-label">Divisi</span><span>{detail.divisi}</span></div>
            {detail.jabatan ? (
              <div className="detail-row"><span className="detail-label">Jabatan</span><span>{detail.jabatan}</span></div>
            ) : null}
            <div className="detail-row">
              <span className="detail-label">No. HP</span>
              <span>
                {detail.noHp ? (
                  <a
                    href={toWaLink(detail.noHp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wa-detail-link"
                    title={`Hubungi ${detail.nama} via WhatsApp`}
                  >
                    <MessageCircle size={15} className="wa-icon" />
                    <span>{detail.noHp}</span>
                    <span className="wa-pill">WhatsApp</span>
                  </a>
                ) : (
                  "-"
                )}
              </span>
            </div>
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