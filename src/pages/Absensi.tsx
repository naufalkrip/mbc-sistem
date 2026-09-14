import { Fragment, useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  CalendarOff,
  Download,
  Eye,
  FileText,
  Pencil,
  Percent,
  Save,
  Thermometer,
  Trash2,
  XCircle,
} from "lucide-react";
import { deleteAbsensiBatch, getAbsensi, getAnggota, saveAbsensiBatch, updateAbsensiBatch } from "../services/api";
import { CACHE_KEYS, cacheMutate } from "../services/cache";
import { laporanAbsensiRekap } from "../services/pdf";
import type { Absensi, Anggota, SesiAbsensi } from "../types";
import { STATUS_KEHADIRAN, WAKTU_ABSENSI } from "../config";
import type { StatusKehadiran, WaktuAbsensi } from "../config";
import {
  buatRingkasanSesi,
  buatSesiAbsensi,
  filterAbsensiPeriode,
  formatRentangTanggal,
  formatTanggal,
  formatTanggalPanjang,
  hitungStatKehadiran,
} from "../utils/format";
import { useApi, usePagination } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";
import { SearchBar } from "../components/ui/SearchBar";
import { Filter } from "../components/ui/Filter";
import { DatePicker } from "../components/ui/DatePicker";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Pagination } from "../components/ui/Pagination";
import { DownloadPdfButton } from "../components/ui/DownloadPdfButton";
import { EmptyState } from "../components/ui/EmptyState";

const KEGIATAN_SUGGEST = [
  "Rapat Rutin",
  "Latihan",
  "Pertemuan Mingguan",
  "Acara Desa Lambur",
  "Sekretariat mbc sistem",
];

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

type PeriodeType = "" | "bulanIni" | "bulanLalu" | "custom";

function StatusSelect({
  value,
  onChange,
  sm = false,
}: {
  value: StatusKehadiran;
  onChange: (s: StatusKehadiran) => void;
  sm?: boolean;
}) {
  return (
    <select
      className={`status-select status-${value.toLowerCase()}${sm ? " status-select-sm" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value as StatusKehadiran)}
      aria-label="Status kehadiran"
    >
      {STATUS_KEHADIRAN.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function Absensi() {
  const { success: toastSuccess, error: toastError } = useToast();
  // Faster polling (5s) for real-time feel on absensi page
  const { data: anggotaData, loading: loadingAnggota } = useApi<Anggota[]>(
    getAnggota,
    "Gagal mengambil data anggota.",
    CACHE_KEYS.ANGGOTA,
    { pollingInterval: 5000, revalidateOnFocus: true, immediate: true }
  );
  const { data: absensiData, loading: loadingAbsensi, refresh } = useApi<Absensi[]>(
    getAbsensi,
    "Gagal mengambil data absensi.",
    CACHE_KEYS.ABSENSI,
    { pollingInterval: 5000, revalidateOnFocus: true, immediate: true }
  );

  const anggota = useMemo(() => anggotaData ?? [], [anggotaData]);
  const absensi = useMemo(() => absensiData ?? [], [absensiData]);
  const loading = loadingAnggota || loadingAbsensi;
  const today = new Date().toISOString().slice(0, 10);

  // Helper waktu otomatis sesuai jam saat ini
  const getWaktuOtomatis = (): WaktuAbsensi => {
    const jam = new Date().getHours();
    if (jam >= 5 && jam < 12) return "Pagi";
    if (jam >= 12 && jam < 18) return "Siang";
    return "Malam";
  };

  // Form input absensi
  const [formTanggal, setFormTanggal] = useState(today);
  const [formKegiatan, setFormKegiatan] = useState("");
  const [formWaktu, setFormWaktu] = useState<WaktuAbsensi | "">(getWaktuOtomatis());
  const [formStatus, setFormStatus] = useState<Record<string, StatusKehadiran>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Search & filter daftar anggota
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDivisi, setMemberDivisi] = useState("");

  // Filter riwayat
  const [riwayatSearch, setRiwayatSearch] = useState("");
  const [periode, setPeriode] = useState<PeriodeType>("");
  const [customDari, setCustomDari] = useState("");
  const [customSampai, setCustomSampai] = useState("");

  // Ringkasan kehadiran - filter rentang waktu
  const [summaryRange, setSummaryRange] = useState<{ dari?: string; sampai?: string; preset?: string }>({
    preset: "bulanIni",
  });

  // Modal detail / edit / delete
  const [detailSesi, setDetailSesi] = useState<SesiAbsensi | null>(null);
  const [editSesi, setEditSesi] = useState<SesiAbsensi | null>(null);
  const [editForm, setEditForm] = useState({ tanggal: "", kegiatan: "", waktu: "" as WaktuAbsensi | "" });
  const [editStatus, setEditStatus] = useState<Record<string, StatusKehadiran>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [toDelete, setToDelete] = useState<SesiAbsensi | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal pilih rentang PDF
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState<"" | "bulan" | "custom">("");
  const [pdfSelectedBulan, setPdfSelectedBulan] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [pdfSelectedTahun, setPdfSelectedTahun] = useState(String(new Date().getFullYear()));
  const [pdfDari, setPdfDari] = useState("");
  const [pdfSampai, setPdfSampai] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Ringkasan kehadiran berdasarkan filter rentang waktu
  const summaryStat = useMemo(() => {
    const filtered = filterAbsensiPeriode(absensi, summaryRange.dari, summaryRange.sampai);
    return hitungStatKehadiran(filtered);
  }, [absensi, summaryRange.dari, summaryRange.sampai]);

  const divisiOptions = useMemo(() => {
    const set = new Set(anggota.map((a) => a.divisi).filter(Boolean));
    return Array.from(set).sort().map((d) => ({ value: d, label: d }));
  }, [anggota]);

  // Anggota diurutkan berkelompok sesuai divisi, lalu abjad per nama
  const anggotaTerurut = useMemo(() => {
    return [...anggota].sort((a, b) => {
      const da = a.divisi || "Lainnya";
      const db = b.divisi || "Lainnya";
      if (da !== db) return da.localeCompare(db);
      return a.nama.localeCompare(b.nama);
    });
  }, [anggota]);

  const anggotaFiltered = useMemo(() => {
    return anggotaTerurut.filter((a) => {
      if (memberSearch.trim()) {
        const q = memberSearch.toLowerCase();
        if (!`${a.id} ${a.nama} ${a.divisi}`.toLowerCase().includes(q)) return false;
      }
      if (memberDivisi && a.divisi !== memberDivisi) return false;
      return true;
    });
  }, [anggotaTerurut, memberSearch, memberDivisi]);

  const periodeRange = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    if (periode === "bulanIni") {
      return { dari: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, sampai: undefined as string | undefined };
    }
    if (periode === "bulanLalu") {
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        dari: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-01`,
        sampai: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
      };
    }
    if (periode === "custom") {
      return { dari: customDari || undefined, sampai: customSampai || undefined };
    }
    return { dari: undefined, sampai: undefined };
  }, [periode, customDari, customSampai]);

  const absensiPeriode = useMemo(
    () => filterAbsensiPeriode(absensi, periodeRange.dari, periodeRange.sampai),
    [absensi, periodeRange]
  );

  const sesiAll = useMemo(() => buatSesiAbsensi(absensiPeriode), [absensiPeriode]);

  const sesiFiltered = useMemo(() => {
    if (!riwayatSearch.trim()) return sesiAll;
    const q = riwayatSearch.toLowerCase();
    return sesiAll.filter(
      (s) =>
        s.kegiatan.toLowerCase().includes(q) ||
        s.waktu.toLowerCase().includes(q) ||
        s.tanggal.includes(q) ||
        formatTanggal(s.tanggal).includes(q)
    );
  }, [sesiAll, riwayatSearch]);

  const sesiPagination = usePagination(sesiFiltered.length, 8);
  const pagedSesi = sesiFiltered.slice(sesiPagination.start, sesiPagination.end);

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

  const handleDownloadPdf = useCallback(() => {
    setPdfOpen(true);
  }, []);

  const handleGeneratePdf = async () => {
    if (pdfMode === "bulan" && (!pdfSelectedBulan || !pdfSelectedTahun)) {
      toastError("Silakan pilih bulan dan tahun terlebih dahulu.");
      return;
    }
    if (pdfMode === "custom" && (!pdfDari || !pdfSampai)) {
      toastError("Silakan lengkapi rentang tanggal (dari & sampai).");
      return;
    }
    setPdfGenerating(true);
    try {
      const data = filterAbsensiPeriode(absensi, pdfRange.dari, pdfRange.sampai);
      await laporanAbsensiRekap(anggota, data, pdfRange.label);
      setPdfOpen(false);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const validateForm = () => {
    const err: Record<string, string> = {};
    if (!formTanggal) err.tanggal = "Tanggal wajib diisi.";
    if (!formKegiatan.trim()) err.kegiatan = "Tempat atau kegiatan wajib diisi.";
    if (!formWaktu) err.waktu = "Silakan pilih waktu absensi.";
    if (anggota.length === 0) err.anggota = "Belum ada anggota yang terdaftar.";
    return err;
  };

  const cekDuplikat = (tanggal: string, kegiatan: string, waktu: string, excludeIds?: Set<string>) => {
    const existing = new Set(
      absensi
        .filter((a) => !excludeIds || !excludeIds.has(a.id))
        .map((a) => `${a.tanggal}|${a.kegiatan.trim().toLowerCase()}|${a.waktu}|${a.idAnggota}`)
    );
    return anggota.filter((a) =>
      existing.has(`${tanggal}|${kegiatan.trim().toLowerCase()}|${waktu}|${a.id}`)
    );
  };

  const handleSave = async () => {
    const err = validateForm();
    setFormErrors(err);
    if (Object.keys(err).length > 0) {
      if (err.anggota) {
        toastError(err.anggota);
      } else if (err.kegiatan && err.waktu) {
        toastError("Mohon lengkapi Tempat/Kegiatan dan pilih Waktu Absensi.");
      } else if (err.kegiatan) {
        toastError(err.kegiatan);
      } else if (err.waktu) {
        toastError(err.waktu);
      } else if (err.tanggal) {
        toastError(err.tanggal);
      }
      return;
    }

    setSaving(true);
    const sessionKey = `${formTanggal}|${formKegiatan.trim().toLowerCase()}|${formWaktu as string}`;
    const existingByMember = new Map<string, Absensi>();
    for (const a of absensi) {
      if (`${a.tanggal}|${a.kegiatan.trim().toLowerCase()}|${a.waktu}` === sessionKey) {
        existingByMember.set(a.idAnggota, a);
      }
    }

    const toAdd: Omit<Absensi, "id" | "nama">[] = [];
    const toUpdate: Omit<Absensi, "nama">[] = [];
    const optimisticAbsensiList: Absensi[] = [];

    for (const a of anggota) {
      const payload = {
        idAnggota: a.id,
        nama: a.nama,
        tanggal: formTanggal,
        kegiatan: formKegiatan.trim(),
        waktu: formWaktu as WaktuAbsensi,
        status: formStatus[a.id] ?? "Hadir",
        keterangan: "",
      };
      const existing = existingByMember.get(a.id);
      if (existing) {
        toUpdate.push({ ...payload, id: existing.id });
        optimisticAbsensiList.push({ ...payload, id: existing.id });
      } else {
        const tempId = `ABS${Date.now().toString().slice(-4)}_${a.id}`;
        toAdd.push({ ...payload });
        optimisticAbsensiList.push({ ...payload, id: tempId });
      }
    }

    // 1. INSTAN 0-ms: Update UI & Cache seketika
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => {
      const existing = (prev ?? []).filter(
        (item) =>
          !optimisticAbsensiList.some(
            (n) =>
              n.id === item.id ||
              (n.idAnggota === item.idAnggota &&
                n.tanggal === item.tanggal &&
                n.kegiatan.toLowerCase() === item.kegiatan.toLowerCase() &&
                n.waktu === item.waktu)
          )
      );
      return [...existing, ...optimisticAbsensiList];
    });

    setFormStatus({});
    toastSuccess(
      toAdd.length === 0 && toUpdate.length > 0
        ? "Absensi berhasil diperbarui."
        : "Absensi berhasil disimpan."
    );

    // 2. Background Sync ke server
    try {
      let isSuccess = true;
      let errorMsg = "";
      if (toAdd.length > 0) {
        const res = await saveAbsensiBatch(toAdd);
        if (!res.success) {
          isSuccess = false;
          errorMsg = res.message || "Gagal menyimpan absensi ke server.";
        }
      }
      if (toUpdate.length > 0) {
        const res = await updateAbsensiBatch(toUpdate);
        if (!res.success) {
          isSuccess = false;
          errorMsg = res.message || "Gagal memperbarui absensi di server.";
        }
      }
      if (!isSuccess) {
        toastError(errorMsg);
      }
      await refresh(true);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal menghubungi server.");
      await refresh(true);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (sesi: SesiAbsensi) => {
    setEditSesi(sesi);
    setEditForm({ tanggal: sesi.tanggal, kegiatan: sesi.kegiatan, waktu: sesi.waktu });
    const statusMap: Record<string, StatusKehadiran> = {};
    for (const r of sesi.daftar) statusMap[r.idAnggota] = r.status;
    setEditStatus(statusMap);
  };

  const handleSaveEdit = async () => {
    if (!editSesi) return;
    if (!editForm.tanggal) {
      toastError("Tanggal wajib diisi.");
      return;
    }
    if (!editForm.kegiatan.trim()) {
      toastError("Tempat atau kegiatan wajib diisi.");
      return;
    }
    if (!editForm.waktu) {
      toastError("Silakan pilih waktu absensi.");
      return;
    }

    const excludeIds = new Set(editSesi.daftar.map((r) => r.id));
    const dup = cekDuplikat(editForm.tanggal, editForm.kegiatan, editForm.waktu, excludeIds);
    if (dup.length > 0) {
      toastError("Absensi untuk tanggal, kegiatan, waktu, dan anggota tersebut sudah tersedia.");
      return;
    }

    setEditSaving(true);
    const oldByMember = new Map(editSesi.daftar.map((r) => [r.idAnggota, r] as const));
    const toUpdate: Omit<Absensi, "nama">[] = [];
    const toAdd: Omit<Absensi, "id" | "nama">[] = [];
    const optimisticUpdated: Absensi[] = [];

    for (const a of anggota) {
      const payload = {
        idAnggota: a.id,
        nama: a.nama,
        tanggal: editForm.tanggal,
        kegiatan: editForm.kegiatan.trim(),
        waktu: editForm.waktu as WaktuAbsensi,
        status: editStatus[a.id] ?? "Hadir",
        keterangan: "",
      };
      const old = oldByMember.get(a.id);
      if (old) {
        toUpdate.push({ ...payload, id: old.id });
        optimisticUpdated.push({ ...payload, id: old.id });
      } else {
        const tempId = `ABS${Date.now().toString().slice(-4)}_${a.id}`;
        toAdd.push(payload);
        optimisticUpdated.push({ ...payload, id: tempId });
      }
    }

    // 1. INSTAN 0-ms: Update UI & Cache seketika + tutup modal
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => {
      const filtered = (prev ?? []).filter((item) => !excludeIds.has(item.id));
      return [...optimisticUpdated, ...filtered];
    });

    setEditSesi(null);
    toastSuccess("Riwayat absensi berhasil diperbarui.");

    // 2. Background Sync ke server
    try {
      let isSuccess = true;
      let errorMsg = "";
      if (toUpdate.length > 0) {
        const res = await updateAbsensiBatch(toUpdate);
        if (!res.success) {
          isSuccess = false;
          errorMsg = res.message || "Gagal memperbarui absensi di server.";
        }
      }
      if (toAdd.length > 0) {
        const res = await saveAbsensiBatch(toAdd);
        if (!res.success) {
          isSuccess = false;
          errorMsg = res.message || "Gagal menyimpan absensi ke server.";
        }
      }
      if (!isSuccess) {
        toastError(errorMsg);
      }
      await refresh(true);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal menghubungi server.");
      await refresh(true);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSesi = async () => {
    if (!toDelete) return;
    const sessionItemIds = new Set(toDelete.daftar.map((r) => r.id));
    const idsToDelete = toDelete.daftar.map((r) => r.id);
    const backupList = toDelete.daftar;

    setDeleting(true);
    // 1. INSTAN 0-ms: Hapus dari UI & Cache seketika + tutup dialog
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) =>
      (prev ?? []).filter((a) => !sessionItemIds.has(a.id))
    );
    setToDelete(null);
    toastSuccess("Riwayat absensi berhasil dihapus.");

    // 2. Background Sync ke server
    try {
      const res = await deleteAbsensiBatch(idsToDelete);
      if (!res.success) {
        toastError(res.message || "Gagal menghapus di server.");
        cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => [...(prev ?? []), ...backupList]);
      } else {
        await refresh(true);
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal menghubungi server.");
      cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => [...(prev ?? []), ...backupList]);
    } finally {
      setDeleting(false);
    }
  };

  const riwayatColumns: Column<SesiAbsensi>[] = [
    { key: "no", header: "No", render: (_r, idx) => <>{sesiPagination.start + idx + 1}</> },
    { key: "tanggal", header: "Tanggal", render: (r) => formatTanggal(r.tanggal) },
    { key: "kegiatan", header: "Tempat/Kegiatan" },
    { key: "waktu", header: "Waktu" },
    {
      key: "jumlahAnggota",
      header: "Jumlah Anggota",
      render: (r) => (
        <span className="text-muted-sm">
          {r.jumlahAnggota} anggota
        </span>
      ),
    },
    {
      key: "ringkasan",
      header: "Ringkasan",
      render: (r) => <span className="text-muted-sm">{buatRingkasanSesi(r.daftar)}</span>,
    },
    {
      key: "aksi",
      header: "Aksi",
      render: (r) => (
        <div className="action-group">
          <button className="action-btn" data-tooltip="Detail" aria-label="Detail" onClick={(e) => { e.stopPropagation(); setDetailSesi(r); }}><Eye size={16} /></button>
          <button className="action-btn" data-tooltip="Edit" aria-label="Edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil size={16} /></button>
          <button className="action-btn danger" data-tooltip="Hapus" aria-label="Hapus" onClick={(e) => { e.stopPropagation(); setToDelete(r); }}><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid">
      {/* RINGKASAN KEHADIRAN - SATU PANEL MERAH */}
      <div className="summary-panel">
        <div className="summary-panel-header">
          <div>
            <h3>Ringkasan Kehadiran</h3>
            <p>Pilih rentang waktu untuk melihat ringkasan data</p>
          </div>
          <DateRangePicker
            value={summaryRange}
            onChange={setSummaryRange}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
            gap: 12,
          }}
        >
          {/* Hadir */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, fontWeight: 600 }}>
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
                <CheckCircle2 size={16} />
              </div>
              <span>Hadir</span>
            </div>
            <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              {summaryStat.hadir.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Izin */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, fontWeight: 600 }}>
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
                <FileText size={16} />
              </div>
              <span>Izin</span>
            </div>
            <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              {summaryStat.izin.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Sakit */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, fontWeight: 600 }}>
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
                <Thermometer size={16} />
              </div>
              <span>Sakit</span>
            </div>
            <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              {summaryStat.sakit.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Cuti */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, fontWeight: 600 }}>
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
                <CalendarOff size={16} />
              </div>
              <span>Cuti</span>
            </div>
            <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              {summaryStat.cuti.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Alpa */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, fontWeight: 600 }}>
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
                <XCircle size={16} />
              </div>
              <span>Alpa</span>
            </div>
            <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              {summaryStat.alpa.toLocaleString("id-ID")}
            </div>
          </div>

          {/* Persentase Kehadiran */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, fontWeight: 600 }}>
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
                <Percent size={16} />
              </div>
              <span>Kehadiran ({summaryStat.total} catatan)</span>
            </div>
            <div style={{ fontSize: "clamp(18px, 4vw, 24px)", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
              {summaryStat.persentase}%
            </div>
          </div>
        </div>
      </div>

      {/* INPUT ABSENSI */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Input Absensi</h2>
            <p>Tentukan tanggal, kegiatan, dan waktu absensi</p>
          </div>
        </div>

        <div className="absensi-field-grid">
          <div className="form-group">
            <label>Tanggal</label>
            <input type="date" value={formTanggal} onChange={(e) => setFormTanggal(e.target.value)} />
            {formErrors.tanggal && <span className="field-error">{formErrors.tanggal}</span>}
          </div>
          <div className="form-group">
            <label>Tempat / Kegiatan</label>
            <input
              value={formKegiatan}
              onChange={(e) => setFormKegiatan(e.target.value)}
              placeholder="Masukkan tempat atau nama kegiatan"
              list="kegiatan-suggest"
            />
            <datalist id="kegiatan-suggest">
              {KEGIATAN_SUGGEST.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            {formErrors.kegiatan && <span className="field-error">{formErrors.kegiatan}</span>}
          </div>
          <div className="form-group">
            <label>Waktu</label>
            <select
              className="waktu-select"
              value={formWaktu}
              onChange={(e) => setFormWaktu(e.target.value as WaktuAbsensi | "")}
            >
              <option value="" disabled>
                Pilih waktu absensi
              </option>
              {WAKTU_ABSENSI.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            {formErrors.waktu && <span className="field-error">{formErrors.waktu}</span>}
          </div>
        </div>

        <hr className="form-section-divider" />

        <div className="form-section-title">Daftar Anggota</div>
        <p className="form-section-sub">Tentukan status kehadiran setiap anggota</p>

        <div className="toolbar">
          <SearchBar value={memberSearch} onChange={setMemberSearch} placeholder="Cari anggota..." />
          <Filter label="Divisi" value={memberDivisi} onChange={setMemberDivisi} options={divisiOptions} />
        </div>

        {anggotaFiltered.length === 0 && !loading ? (
          <EmptyState
            title={anggota.length === 0 ? "Belum ada anggota yang terdaftar" : "Tidak ada anggota yang cocok"}
            message={
              anggota.length === 0
                ? "Tambahkan anggota terlebih dahulu melalui menu Anggota."
                : "Ubah pencarian atau filter divisi untuk melihat anggota."
            }
          />
        ) : (
          <div className="member-table">
            <div className="member-table-head">
              <span className="member-cell no">No</span>
              <span className="member-cell name">Nama</span>
              <span className="member-cell divisi">Divisi</span>
              <span className="member-cell status">Status Kehadiran</span>
            </div>
            {anggotaFiltered.map((a, i) => {
              const prev = i > 0 ? anggotaFiltered[i - 1] : null;
              const grupBerubah = !prev || (prev.divisi || "Lainnya") !== (a.divisi || "Lainnya");
              return (
                <Fragment key={a.id}>
                  {grupBerubah && (
                    <div className="member-divisi-header">{a.divisi || "Lainnya"}</div>
                  )}
                  <div className="member-row">
                    <span className="member-cell no">{i + 1}</span>
                    <span className="member-cell name">{a.nama}</span>
                    <span className="member-cell divisi">{a.divisi || "-"}</span>
                    <span className="member-cell status">
                      <StatusSelect
                        value={formStatus[a.id] ?? "Hadir"}
                        onChange={(s) => setFormStatus((prev) => ({ ...prev, [a.id]: s }))}
                      />
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        {formErrors.anggota && (
          <p className="field-error" style={{ marginTop: 12 }}>{formErrors.anggota}</p>
        )}

        <div className="absensi-save">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            <Save size={17} />
            {saving ? "Menyimpan..." : "Simpan Absensi"}
          </button>
        </div>
      </div>

      {/* RIWAYAT ABSENSI */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Riwayat Absensi</h2>
            <p>Daftar absensi yang telah dibuat</p>
          </div>
          <div className="header-actions">
            <DownloadPdfButton onGenerate={handleDownloadPdf} />
          </div>
        </div>

        <div className="toolbar">
          <SearchBar value={riwayatSearch} onChange={setRiwayatSearch} placeholder="Cari riwayat..." />
          <Filter
            label="Periode"
            value={periode}
            onChange={(v) => setPeriode(v as PeriodeType)}
            options={[
              { value: "bulanIni", label: "Bulan ini" },
              { value: "bulanLalu", label: "Bulan lalu" },
              { value: "custom", label: "Custom" },
            ]}
            allLabel="Semua"
          />
          {periode === "custom" && (
            <>
              <DatePicker label="Dari" value={customDari} onChange={setCustomDari} />
              <DatePicker label="Sampai" value={customSampai} onChange={setCustomSampai} />
            </>
          )}
        </div>

        <DataTable
          columns={riwayatColumns}
          data={pagedSesi}
          loading={loading}
          rowKey={(r) => r.key}
          emptyMessage="Belum ada riwayat absensi. Silakan buat absensi pertama menggunakan form di atas."
        />
        <Pagination
          page={sesiPagination.page}
          totalPages={sesiPagination.totalPages}
          totalItems={sesiFiltered.length}
          pageSize={sesiPagination.pageSize}
          onPageChange={sesiPagination.setPage}
        />
      </div>

      <Modal
        open={detailSesi !== null}
        title="Detail Absensi"
        onClose={() => setDetailSesi(null)}
        size="md"
        footer={
          <button className="btn btn-primary" onClick={() => setDetailSesi(null)}>
            Tutup
          </button>
        }
      >
        {detailSesi && (
          <>
            <div className="detail-list">
              <div className="detail-row"><span className="detail-label">Tanggal</span><span>{formatTanggalPanjang(detailSesi.tanggal)}</span></div>
              <div className="detail-row"><span className="detail-label">Tempat/Kegiatan</span><span>{detailSesi.kegiatan}</span></div>
              <div className="detail-row"><span className="detail-label">Waktu</span><span>{detailSesi.waktu}</span></div>
            </div>
            <div className="detail-section table-wrapper">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Nama</th>
                      <th>Divisi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailSesi.daftar.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.nama}</td>
                        <td>{anggota.find((x) => x.id === r.idAnggota)?.divisi || "-"}</td>
                        <td><StatusBadge value={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={editSesi !== null}
        title="Edit Absensi"
        onClose={() => setEditSesi(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditSesi(null)} disabled={editSaving}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </>
        }
      >
        {editSesi && (
          <>
            <div className="absensi-field-grid">
              <div className="form-group">
                <label>Tanggal</label>
                <input type="date" value={editForm.tanggal} onChange={(e) => setEditForm((p) => ({ ...p, tanggal: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Tempat / Kegiatan</label>
                <input
                  value={editForm.kegiatan}
                  onChange={(e) => setEditForm((p) => ({ ...p, kegiatan: e.target.value }))}
                  placeholder="Masukkan tempat atau nama kegiatan"
                  list="kegiatan-suggest-edit"
                />
                <datalist id="kegiatan-suggest-edit">
                  {KEGIATAN_SUGGEST.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Waktu</label>
                <select
                  className="waktu-select"
                  value={editForm.waktu}
                  onChange={(e) => setEditForm((p) => ({ ...p, waktu: e.target.value as WaktuAbsensi | "" }))}
                >
                  <option value="" disabled>
                    Pilih waktu absensi
                  </option>
                  {WAKTU_ABSENSI.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="form-section-divider" />

            <div className="form-section-title">Status Kehadiran Anggota</div>
            <p className="form-section-sub">Ubah status kehadiran setiap anggota</p>

            <div className="member-edit-list">
              {anggotaTerurut.map((a, i) => {
                const prev = i > 0 ? anggotaTerurut[i - 1] : null;
                const grupBerubah = !prev || (prev.divisi || "Lainnya") !== (a.divisi || "Lainnya");
                return (
                  <Fragment key={a.id}>
                    {grupBerubah && (
                      <div className="member-edit-divisi">{a.divisi || "Lainnya"}</div>
                    )}
                    <div className="member-edit-row">
                      <div className="member-edit-info">
                        <strong>{a.nama}</strong>
                        <span>{a.id} · {a.divisi || "-"}</span>
                      </div>
                      <StatusSelect
                        sm
                        value={editStatus[a.id] ?? "Hadir"}
                        onChange={(s) => setEditStatus((prev) => ({ ...prev, [a.id]: s }))}
                      />
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </>
        )}
      </Modal>

      {/* Modal Unduh PDF Laporan Absensi */}
      <Modal
        open={pdfOpen}
        title="Unduh Laporan PDF Absensi"
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
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0" }}>
              Tentukan rentang tanggal absensi yang akan dimasukkan ke dalam dokumen PDF
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
                fontWeight: 600,
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
                fontWeight: 600,
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
                fontWeight: 600,
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
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Pilih Bulan</label>
                <select
                  value={pdfSelectedBulan}
                  onChange={(e) => setPdfSelectedBulan(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "13px" }}
                >
                  {PILIHAN_BULAN.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Pilih Tahun</label>
                <select
                  value={pdfSelectedTahun}
                  onChange={(e) => setPdfSelectedTahun(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "13px" }}
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
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Tanggal Dari</label>
                <input
                  type="date"
                  value={pdfDari}
                  max={pdfSampai || undefined}
                  onChange={(e) => setPdfDari(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "13px" }}
                />
              </div>
              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Tanggal Sampai</label>
                <input
                  type="date"
                  value={pdfSampai}
                  min={pdfDari || undefined}
                  onChange={(e) => setPdfSampai(e.target.value)}
                  style={{ height: 38, padding: "6px 10px", fontSize: "13px" }}
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
              fontSize: "12.5px",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Periode yang dicetak:</span>
            <strong style={{ color: "var(--navy-900)" }}>{pdfRange.label}</strong>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Hapus Riwayat Absensi?"
        message={`Data absensi ${toDelete?.kegiatan} (${toDelete ? formatTanggal(toDelete.tanggal) : "-"} · ${toDelete?.waktu}) akan dihapus dan tidak dapat dikembalikan.`}
        loading={deleting}
        onConfirm={handleDeleteSesi}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
