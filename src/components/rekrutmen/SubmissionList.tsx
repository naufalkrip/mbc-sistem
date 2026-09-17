import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  Download,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Bookmark,
  FileText,
  ZoomIn,
  Check,
  LayoutGrid,
  List,
  Camera,
  Calendar,
  Sparkles,
  MessageCircle,
  RotateCw,
  Copy,
  Send,
  Layers,
  X,
  Users,
} from "lucide-react";
import type {
  RekrutmenSubmissionWithAnswers,
  RekrutmenForm,
  RekrutmenSubmissionStatus,
  RekrutmenAnswer,
  RekrutmenField,
} from "../../types";
import {
  formatTanggal,
  formatTanggalPanjang,
  formatRentangTanggal,
  formatNomorHp,
  buatLinkWhatsAppCalon,
  buatPesanWhatsAppLolos,
  buatLinkWhatsAppLolos,
} from "../../utils/format";
import { DataTable } from "../ui/DataTable";
import type { Column } from "../ui/DataTable";
import { SearchBar } from "../ui/SearchBar";
import { Filter as FilterComp } from "../ui/Filter";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { laporanRekrutmen, laporanRekrutmenDetail } from "../../services/pdf";
import {
  getRekrutmenImageBase64Item,
  updateRekrutmenAnswerPhotoItem,
  compressImageToSafeHd,
  extractCandidatePhotoInfo,
  getCachedResolvedPhoto,
  setCachedResolvedPhoto,
} from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

interface SubmissionListProps {
  form: RekrutmenForm;
  submissions: RekrutmenSubmissionWithAnswers[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onViewDetail?: (submission: RekrutmenSubmissionWithAnswers) => void;
  onUpdateStatus: (id: string, status: RekrutmenSubmissionStatus, note: string) => Promise<boolean>;
  onDeleteSubmission: (id: string) => Promise<boolean>;
  initialStatusFilter?: RekrutmenSubmissionStatus | "";
  onStatusFilterChange?: (status: RekrutmenSubmissionStatus | "") => void;
}

const STATUS_CONFIG: Record<
  RekrutmenSubmissionStatus,
  { label: string; bg: string; color: string; border: string; icon: typeof Clock }
> = {
  menunggu: {
    label: "Menunggu",
    bg: "rgba(217, 119, 6, 0.1)",
    color: "#d97706",
    border: "rgba(217, 119, 6, 0.28)",
    icon: Clock,
  },
  lolos: {
    label: "Lolos",
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.3)",
    icon: CheckCircle,
  },
  cadangan: {
    label: "Cadangan",
    bg: "rgba(37, 99, 235, 0.1)",
    color: "#2563eb",
    border: "rgba(37, 99, 235, 0.28)",
    icon: Bookmark,
  },
  tidak_lolos: {
    label: "Tidak Lolos",
    bg: "rgba(220, 38, 38, 0.1)",
    color: "#dc2626",
    border: "rgba(220, 38, 38, 0.28)",
    icon: XCircle,
  },
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

type PdfMode = "" | "bulan" | "custom";

interface CategorizedSubmissionAnswers {
  dataPribadi: Array<RekrutmenAnswer & { field?: RekrutmenField }>;
  pilihanMusik: Array<RekrutmenAnswer & { field?: RekrutmenField }>;
  berkasDokumen: Array<RekrutmenAnswer & { field?: RekrutmenField }>;
  lainnya: Array<RekrutmenAnswer & { field?: RekrutmenField }>;
}

function categorizeCandidateAnswers(
  answers: Array<RekrutmenAnswer & { field?: RekrutmenField }>
): CategorizedSubmissionAnswers {
  const dataPribadi: Array<RekrutmenAnswer & { field?: RekrutmenField }> = [];
  const pilihanMusik: Array<RekrutmenAnswer & { field?: RekrutmenField }> = [];
  const berkasDokumen: Array<RekrutmenAnswer & { field?: RekrutmenField }> = [];
  const lainnya: Array<RekrutmenAnswer & { field?: RekrutmenField }> = [];

  for (const ans of answers) {
    const lbl = (ans.field?.label || "").toLowerCase();
    const isUploadField =
      ans.field?.fieldType === "image" ||
      ans.field?.fieldType === "file" ||
      ans.fileType?.startsWith("image/") ||
      Boolean(ans.fileUrl || ans.fileBase64 || ans.fileName);

    if (
      isUploadField ||
      lbl.includes("foto") ||
      lbl.includes("berkas") ||
      lbl.includes("dokumen") ||
      lbl.includes("ijazah") ||
      lbl.includes("ktp") ||
      lbl.includes("kartu") ||
      lbl.includes("surat") ||
      lbl.includes("lampiran") ||
      lbl.includes("upload")
    ) {
      berkasDokumen.push(ans);
    } else if (
      lbl.includes("alat") ||
      lbl.includes("posisi") ||
      lbl.includes("seksi") ||
      lbl.includes("divisi") ||
      lbl.includes("instrumen") ||
      lbl.includes("musik") ||
      lbl.includes("marching") ||
      lbl.includes("band") ||
      lbl.includes("pengalaman") ||
      lbl.includes("alasan") ||
      lbl.includes("motivasi") ||
      lbl.includes("minat") ||
      lbl.includes("pilihan")
    ) {
      pilihanMusik.push(ans);
    } else if (
      lbl.includes("nama") ||
      lbl.includes("ttl") ||
      lbl.includes("lahir") ||
      lbl.includes("usia") ||
      lbl.includes("umur") ||
      lbl.includes("kelamin") ||
      lbl.includes("gender") ||
      lbl.includes("agama") ||
      lbl.includes("alamat") ||
      lbl.includes("domisili") ||
      lbl.includes("tinggal") ||
      lbl.includes("kota") ||
      lbl.includes("hp") ||
      lbl.includes("wa") ||
      lbl.includes("telepon") ||
      lbl.includes("kontak") ||
      lbl.includes("email") ||
      lbl.includes("sekolah") ||
      lbl.includes("kelas") ||
      lbl.includes("instansi") ||
      lbl.includes("pekerjaan")
    ) {
      dataPribadi.push(ans);
    } else {
      lainnya.push(ans);
    }
  }

  return { dataPribadi, pilihanMusik, berkasDokumen, lainnya };
}

/**
 * Komponen Pas Foto Calon Anggota Cerdas
 * dengan dukungan Multi-Tier Fallback (Base64 -> Google Drive CDN -> Backend Base64 Resolver -> Inisial Elegan).
 */
function CandidatePhotoBadge({
  answers,
  candidateName,
  size = "md",
  onClick,
}: {
  answers: Array<{
    id?: string;
    fieldId?: string;
    value?: string;
    fileUrl?: string | null;
    fileBase64?: string | null;
    fileName?: string | null;
    fileType?: string | null;
    field?: { label?: string; fieldType?: string };
  }>;
  candidateName: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: (url: string, title: string, fileName?: string) => void;
}) {
  const photoInfo = useMemo(() => extractCandidatePhotoInfo(answers), [answers]);
  const [currentSrc, setCurrentSrc] = useState<string | null>(photoInfo.url);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Cek apakah ada foto ter-cache
    if (photoInfo.driveFileId) {
      const cached = getCachedResolvedPhoto(photoInfo.driveFileId);
      if (cached) {
        setCurrentSrc(cached);
        return;
      }
    }
    setCurrentSrc(photoInfo.url);
    setLoadError(false);
  }, [photoInfo]);

  const handleImageError = async () => {
    // Jika link Google Drive standar gagal dimuat, coba gunakan endpoint resolver
    if (photoInfo.driveFileId && !loadingFallback && !loadError) {
      setLoadingFallback(true);
      const res = await getRekrutmenImageBase64Item({
        fileId: photoInfo.driveFileId,
        fileName: photoInfo.fileName || undefined,
      });
      setLoadingFallback(false);
      if (res.success && res.base64) {
        setCachedResolvedPhoto(photoInfo.driveFileId, res.base64);
        setCurrentSrc(res.base64);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } else {
      setLoadError(true);
    }
  };

  const dimensions = {
    sm: { w: 36, h: 46, radius: 6, fontSize: 13, iconSize: 14 },
    md: { w: 46, h: 58, radius: 8, fontSize: 15, iconSize: 16 },
    lg: { w: 72, h: 92, radius: 10, fontSize: 22, iconSize: 22 },
    xl: { w: 120, h: 150, radius: 12, fontSize: 32, iconSize: 32 },
  }[size];

  const initial = (candidateName || "C").trim().charAt(0).toUpperCase();

  const isPhotoAvailable = Boolean(currentSrc && !loadError);

  return (
    <div
      style={{
        position: "relative",
        width: dimensions.w,
        height: dimensions.h,
        borderRadius: dimensions.radius,
        flexShrink: 0,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
        border: isPhotoAvailable ? "1.5px solid #cbd5e1" : "1.5px dashed #cbd5e1",
        background: isPhotoAvailable ? "#0f172a" : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        cursor: isPhotoAvailable && onClick ? "pointer" : "default",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onClick={(e) => {
        if (isPhotoAvailable && onClick && currentSrc) {
          e.stopPropagation();
          onClick(currentSrc, `Pas Foto: ${candidateName}`, photoInfo.fileName || undefined);
        }
      }}
      title={isPhotoAvailable ? `Klik untuk memperbesar Pas Foto ${candidateName}` : `Belum ada pas foto untuk ${candidateName}`}
    >
      {isPhotoAvailable && currentSrc ? (
        <>
          <img
            src={currentSrc}
            alt={`Foto ${candidateName}`}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.3s ease",
            }}
            onMouseEnter={(e) => {
              if (size !== "sm") e.currentTarget.style.transform = "scale(1.08)";
            }}
            onMouseLeave={(e) => {
              if (size !== "sm") e.currentTarget.style.transform = "scale(1)";
            }}
          />
          {/* Zoom Overlay Badge */}
          {size !== "sm" && (
            <div
              style={{
                position: "absolute",
                bottom: 3,
                right: 3,
                background: "rgba(0, 0, 0, 0.65)",
                color: "#ffffff",
                borderRadius: 4,
                padding: "2px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(4px)",
              }}
            >
              <ZoomIn size={11} />
            </div>
          )}
        </>
      ) : loadingFallback ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            color: "#64748b",
          }}
        >
          <RotateCw size={dimensions.iconSize} className="spinning" />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary-700, #b91c1c)",
            fontWeight: 800,
            fontSize: dimensions.fontSize,
            position: "relative",
            background: "linear-gradient(135deg, rgba(185, 28, 28, 0.06) 0%, rgba(185, 28, 28, 0.12) 100%)",
          }}
        >
          <span>{initial}</span>
          <span
            style={{
              position: "absolute",
              bottom: 2,
              fontSize: "8.5px",
              color: "#94a3b8",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.2px",
            }}
          >
            {size !== "sm" ? "No Foto" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * CandidateAvatarCell - Mengadaptasi tampilan avatar anggota (.member-name-cell)
 * lengkap dengan inisial fallback elegan, pas foto, dan penanganan Google Drive resolver.
 */
function CandidateAvatarCell({
  submission,
  nama,
  onAvatarClick,
}: {
  submission: RekrutmenSubmissionWithAnswers;
  nama: string;
  onAvatarClick?: (url: string, title: string, fileName?: string) => void;
}) {
  const photoInfo = useMemo(() => extractCandidatePhotoInfo(submission.answers), [submission.answers]);
  const [currentSrc, setCurrentSrc] = useState<string | null>(photoInfo.url);
  const [loadError, setLoadError] = useState(false);
  const [loadingFallback, setLoadingFallback] = useState(false);

  useEffect(() => {
    if (photoInfo.driveFileId) {
      const cached = getCachedResolvedPhoto(photoInfo.driveFileId);
      if (cached) {
        setCurrentSrc(cached);
        return;
      }
    }
    setCurrentSrc(photoInfo.url);
    setLoadError(false);
  }, [photoInfo]);

  const handleImageError = async () => {
    if (photoInfo.driveFileId && !loadingFallback && !loadError) {
      setLoadingFallback(true);
      const res = await getRekrutmenImageBase64Item({
        fileId: photoInfo.driveFileId,
        fileName: photoInfo.fileName || undefined,
      });
      setLoadingFallback(false);
      if (res.success && res.base64) {
        setCachedResolvedPhoto(photoInfo.driveFileId, res.base64);
        setCurrentSrc(res.base64);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } else {
      setLoadError(true);
    }
  };

  const initial = (nama || "C").trim().charAt(0).toUpperCase();
  const hasPhoto = Boolean(currentSrc && !loadError);

  return (
    <div className="member-name-cell">
      {hasPhoto ? (
        <img
          src={currentSrc!}
          alt={nama}
          className="member-avatar-img"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImageError}
          onClick={(e) => {
            if (onAvatarClick && currentSrc) {
              e.stopPropagation();
              onAvatarClick(currentSrc, `Pas Foto: ${nama}`, photoInfo.fileName || undefined);
            }
          }}
          title={onAvatarClick ? `Klik untuk memperbesar foto ${nama}` : undefined}
          style={{ cursor: onAvatarClick ? "pointer" : "default" }}
        />
      ) : null}
      <div
        className="member-avatar-placeholder"
        style={{ display: hasPhoto ? "none" : "inline-flex" }}
      >
        {initial}
      </div>
      <span className="member-name-text">{nama}</span>
    </div>
  );
}

const STATUS_BADGE_MAP: Record<
  RekrutmenSubmissionStatus,
  { label: string; className: string }
> = {
  menunggu: { label: "Menunggu", className: "badge-warning" },
  lolos: { label: "Lolos", className: "badge-success" },
  cadangan: { label: "Cadangan", className: "badge-info" },
  tidak_lolos: { label: "Tidak Lolos", className: "badge-danger" },
};

export function SubmissionList({
  form,
  submissions,
  loading,
  onRefresh,
  onUpdateStatus,
  onDeleteSubmission,
  initialStatusFilter,
  onStatusFilterChange,
}: SubmissionListProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<RekrutmenSubmissionStatus | "">(initialStatusFilter || "");
  const [filterPosisi, setFilterPosisi] = useState<string>("");
  const [filterPeriode, setFilterPeriode] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [detailOpen, setDetailOpen] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialStatusFilter !== undefined) {
      setFilterStatus(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const handleStatusFilterChange = (st: RekrutmenSubmissionStatus | "") => {
    setFilterStatus(st);
    if (onStatusFilterChange) {
      onStatusFilterChange(st);
    }
  };

  const handleSort = (key: string) => {
    if (sortField === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(key);
      setSortDirection("asc");
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    handleStatusFilterChange("");
    setFilterPosisi("");
    setFilterPeriode("");
    setSortField(null);
    setSortDirection("asc");
  };

  const hasActiveFilters = Boolean(search.trim() || filterStatus || filterPosisi || filterPeriode || sortField);

  // Quick / Detail Status Change State
  const [statusModalSub, setStatusModalSub] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RekrutmenSubmissionStatus>("menunggu");
  const [adminNote, setAdminNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendWaOnLolosSave, setSendWaOnLolosSave] = useState(true);

  // Lightbox Image
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; fileName?: string } | null>(null);
  const [lightboxImgError, setLightboxImgError] = useState(false);
  const [lightboxFetching, setLightboxFetching] = useState(false);

  const openPhotoLightbox = (url: string, title: string, fileName?: string) => {
    setLightboxImage({ url, title, fileName });
    setLightboxImgError(false);
    setLightboxFetching(false);
  };

  // PDF Export Modal State
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfMode>("");
  const [pdfStatus, setPdfStatus] = useState<RekrutmenSubmissionStatus | "">("");
  const [pdfSelectedBulan, setPdfSelectedBulan] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [pdfSelectedTahun, setPdfSelectedTahun] = useState(String(new Date().getFullYear()));
  const [pdfDari, setPdfDari] = useState("");
  const [pdfSampai, setPdfSampai] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Helper untuk mengambil nama & kontak calon
  const getCandidateInfo = (s: RekrutmenSubmissionWithAnswers) => {
    const namaField = s.answers.find((a) => (a.field?.label || "").toLowerCase().includes("nama"));
    const nama = namaField?.value?.trim() || "Calon Anggota";

    const panggilanField = s.answers.find((a) => {
      const lbl = (a.field?.label || "").toLowerCase();
      return lbl.includes("panggilan") || lbl.includes("sapaan") || lbl.includes("alias");
    });
    const namaPanggilan = panggilanField?.value?.trim() || "-";

    const hpField = s.answers.find(
      (a) =>
        (a.field?.label || "").toLowerCase().includes("hp") ||
        (a.field?.label || "").toLowerCase().includes("telepon") ||
        (a.field?.label || "").toLowerCase().includes("whatsapp") ||
        (a.field?.label || "").toLowerCase().includes("wa") ||
        (a.field?.label || "").toLowerCase().includes("kontak")
    );
    const rawHp = hpField?.value?.trim() || "";
    const hp = formatNomorHp(rawHp);

    const pilihanField = s.answers.find((a) => {
      const lbl = (a.field?.label || "").toLowerCase();
      return (
        lbl.includes("alat") ||
        lbl.includes("posisi") ||
        lbl.includes("seksi") ||
        lbl.includes("divisi") ||
        lbl.includes("instrumen") ||
        lbl.includes("pilihan 1") ||
        lbl.includes("pilihan") ||
        lbl.includes("minat")
      );
    });
    const pilihan = pilihanField?.value?.trim() || "-";

    const noteForMsg = s.adminNote || (statusModalSub?.id === s.id ? adminNote : undefined);
    const waUrl = buatLinkWhatsAppCalon(rawHp, nama, form.title);
    const waLolosUrl = buatLinkWhatsAppLolos(rawHp, nama, form.title, noteForMsg);
    const pesanLolos = buatPesanWhatsAppLolos(nama, form.title, noteForMsg);

    return { nama, namaPanggilan, rawHp, hp, pilihan, waUrl, waLolosUrl, pesanLolos };
  };

  const safeSubmissions = useMemo(
    () => (Array.isArray(submissions) ? submissions : []),
    [submissions]
  );

  // Posisi Options untuk Dropdown Filter
  const posisiOptions = useMemo(() => {
    const set = new Set<string>();
    safeSubmissions.forEach((s) => {
      const { pilihan } = getCandidateInfo(s);
      if (pilihan && pilihan !== "-") {
        set.add(pilihan);
      }
    });
    return Array.from(set)
      .sort()
      .map((p) => ({ value: p, label: p }));
  }, [safeSubmissions]);

  // Base list that matches search query, posisi, and date range filter (before status filter)
  const baseFilteredList = useMemo(() => {
    return safeSubmissions
      .filter((s) => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const answersText = (s.answers || [])
            .map((a) => `${a?.field?.label || ""}: ${a?.value || ""}`)
            .join(" ")
            .toLowerCase();
          if (!answersText.includes(q)) return false;
        }

        // Posisi filter
        if (filterPosisi) {
          const { pilihan } = getCandidateInfo(s);
          if (pilihan !== filterPosisi) return false;
        }

        // Periode filter
        if (filterPeriode && s.submittedAt) {
          const subDate = s.submittedAt.slice(0, 10);
          const now = new Date();
          const todayStr = now.toISOString().slice(0, 10);

          if (filterPeriode === "hariIni" && subDate !== todayStr) return false;
          if (filterPeriode === "mingguIni") {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (subDate < weekAgo.toISOString().slice(0, 10)) return false;
          }
          if (filterPeriode === "bulanIni") {
            const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            if (!subDate.startsWith(thisMonth)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || "") || (a.id || "").localeCompare(b.id || ""));
  }, [safeSubmissions, search, filterPosisi, filterPeriode]);

  const filtered = useMemo(() => {
    if (!filterStatus) return baseFilteredList;
    return baseFilteredList.filter((s) => s.status === filterStatus);
  }, [baseFilteredList, filterStatus]);

  // List yang telah diurutkan berdasarkan sortField & sortDirection
  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortField === "nama") {
        valA = getCandidateInfo(a).nama;
        valB = getCandidateInfo(b).nama;
      } else if (sortField === "pilihan") {
        valA = getCandidateInfo(a).pilihan;
        valB = getCandidateInfo(b).pilihan;
      } else if (sortField === "submittedAt") {
        valA = a.submittedAt || "";
        valB = b.submittedAt || "";
      }
      const cmp = valA.localeCompare(valB, "id", { sensitivity: "base" });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDirection]);

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

  const copyToClipboard = async (text: string, label = "Teks") => {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess(`${label} berhasil disalin ke clipboard!`);
    } catch {
      toastError(`Gagal menyalin ${label.toLowerCase()}.`);
    }
  };

  const openStatusChange = (s: RekrutmenSubmissionWithAnswers) => {
    setStatusModalSub(s);
    setSelectedStatus(s.status);
    setAdminNote(s.adminNote || "");
    setSendWaOnLolosSave(true);
  };

  const handleStatusSave = async () => {
    if (!statusModalSub) return;
    const isPassing = selectedStatus === "lolos";
    const subTarget = statusModalSub;
    setSavingStatus(true);
    const ok = await onUpdateStatus(subTarget.id, selectedStatus, adminNote);
    setSavingStatus(false);
    if (ok) {
      toastSuccess("Status calon anggota berhasil diperbarui.");

      // Jika status lolos dan opsi kirim WA aktif, buka tautan WhatsApp otomatis
      if (isPassing && sendWaOnLolosSave) {
        const { nama, rawHp } = getCandidateInfo(subTarget);
        const waUrl = buatLinkWhatsAppLolos(rawHp, nama, form.title, adminNote);
        if (waUrl) {
          window.open(waUrl, "_blank", "noopener,noreferrer");
        }
      }

      setStatusModalSub(null);
      if (detailOpen && detailOpen.id === subTarget.id) {
        setDetailOpen({ ...detailOpen, status: selectedStatus, adminNote });
      }
      await onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteOpen) return;
    setDeleting(true);
    const ok = await onDeleteSubmission(deleteOpen.id);
    setDeleting(false);
    if (ok) {
      toastSuccess("Data calon anggota berhasil dihapus.");
      setDeleteOpen(null);
      if (detailOpen && detailOpen.id === deleteOpen.id) {
        setDetailOpen(null);
      }
      await onRefresh();
    }
  };

  const handleGeneratePdf = async () => {
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
      let dataToExport = [...safeSubmissions];

      if (pdfRange.dari && pdfRange.sampai) {
        dataToExport = dataToExport.filter((s) => {
          const d = s.submittedAt.slice(0, 10);
          return d >= (pdfRange.dari || "") && d <= (pdfRange.sampai || "");
        });
      }

      if (pdfStatus) {
        dataToExport = dataToExport.filter((s) => s.status === pdfStatus);
      }

      dataToExport.sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));

      if (dataToExport.length === 0) {
        toastError("Tidak ada data pendaftar pada filter periode yang dipilih.");
        setPdfGenerating(false);
        return;
      }

      const statusSuffix = pdfStatus ? ` · Status ${STATUS_CONFIG[pdfStatus]?.label}` : "";
      await laporanRekrutmen(form, dataToExport, `${pdfRange.label}${statusSuffix}`);
      setPdfOpen(false);
    } catch {
      toastError("Gagal mencetak dokumen PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadDetailPdf = async (s: RekrutmenSubmissionWithAnswers) => {
    try {
      await laporanRekrutmenDetail(form, s);
    } catch {
      toastError("Gagal mencetak dokumen pendaftar.");
    }
  };

  const handleOpenFile = (ans: RekrutmenAnswer & { field?: RekrutmenField }) => {
    const fileUrl = ans.fileUrl || (ans.value?.startsWith("data:") || ans.value?.startsWith("http") ? ans.value : null);
    if (!fileUrl) return;

    const isImage =
      ans.field?.fieldType === "image" ||
      ans.fileType?.startsWith("image/") ||
      (ans.field?.label || "").toLowerCase().includes("foto") ||
      Boolean(ans.fileName && /\.(jpe?g|png|webp|gif)$/i.test(ans.fileName)) ||
      fileUrl.startsWith("data:image/") ||
      /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(fileUrl) ||
      fileUrl.includes("drive.google.com") ||
      fileUrl.includes("lh3.googleusercontent");

    if (isImage) {
      openPhotoLightbox(
        fileUrl,
        ans.field?.label || ans.fileName || "Foto Calon Anggota",
        ans.fileName || ans.value
      );
    } else {
      try {
        if (fileUrl.startsWith("data:")) {
          const parts = fileUrl.split(";base64,");
          const contentType = parts[0].split(":")[1] || "application/octet-stream";
          const byteCharacters = atob(parts[1] || "");
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: contentType });
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank");
        } else {
          window.open(fileUrl, "_blank");
        }
      } catch {
        window.open(fileUrl, "_blank");
      }
    }
  };

  const handleDownloadImage = (url: string, title?: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || "foto-calon").replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdminUploadPhoto = async (answerId: string, file: File) => {
    try {
      toastSuccess("Mengompres dan memperbarui foto calon...");
      const safeHdBase64 = await compressImageToSafeHd(file);
      const res = await updateRekrutmenAnswerPhotoItem({
        answerId,
        fileBase64: safeHdBase64,
        fileName: file.name,
      });
      if (res.success) {
        toastSuccess("Foto calon anggota berhasil diperbarui!");
        await onRefresh();
        if (detailOpen) {
          setDetailOpen((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              answers: prev.answers.map((a) =>
                a.id === answerId ? { ...a, fileUrl: safeHdBase64, fileName: file.name, value: file.name } : a
              ),
            };
          });
        }
        if (lightboxImage) {
          setLightboxImage({ url: safeHdBase64, title: "Foto Calon Anggota", fileName: file.name });
          setLightboxImgError(false);
        }
      } else {
        toastError(res.message || "Gagal memperbarui foto.");
      }
    } catch {
      toastError("Gagal memproses file foto.");
    }
  };

  // Definisi Kolom Tabel (Diselaraskan persis dengan format halaman Anggota)
  const columns: Column<RekrutmenSubmissionWithAnswers>[] = [
    {
      key: "no",
      header: "No",
      render: (_r, idx) => <>{idx + 1}</>,
    },
    {
      key: "nama",
      header: "Nama Lengkap",
      sortable: true,
      render: (s) => {
        const { nama } = getCandidateInfo(s);
        return (
          <CandidateAvatarCell
            submission={s}
            nama={nama}
            onAvatarClick={(url, title, fileName) => openPhotoLightbox(url, title, fileName)}
          />
        );
      },
    },
    {
      key: "pilihan",
      header: "Pilihan / Posisi",
      sortable: true,
      render: (s) => {
        const { pilihan } = getCandidateInfo(s);
        return pilihan || "-";
      },
    },
    {
      key: "hp",
      header: "No. HP",
      render: (s) => {
        const { hp, waUrl, waLolosUrl, rawHp, nama } = getCandidateInfo(s);
        if (!rawHp && (!hp || hp === "-")) return "-";
        const isLolos = s.status === "lolos";
        const targetUrl = isLolos ? (waLolosUrl || waUrl) : waUrl;
        if (!targetUrl) return <span>{hp}</span>;
        return (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wa-table-link"
            onClick={(e) => e.stopPropagation()}
            title={
              isLolos
                ? `Hubungi ${nama} via WhatsApp (Pengumuman Lolos)`
                : `Hubungi ${nama} via WhatsApp (${hp})`
            }
          >
            <MessageCircle size={14} className="wa-icon" />
            <span>{hp}</span>
          </a>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (s) => {
        const variant = STATUS_BADGE_MAP[s.status] || { label: s.status, className: "badge-neutral" };
        return <span className={`badge ${variant.className}`}>{variant.label}</span>;
      },
    },
    {
      key: "submittedAt",
      header: "Tanggal Mendaftar",
      sortable: true,
      render: (s) => formatTanggal(s.submittedAt),
    },
    {
      key: "aksi",
      header: "Aksi",
      render: (s) => {
        const { waLolosUrl } = getCandidateInfo(s);
        return (
          <div className="action-group" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="action-btn"
              data-tooltip="Detail"
              aria-label="Detail"
              onClick={(e) => {
                e.stopPropagation();
                setDetailOpen(s);
              }}
            >
              <Eye size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              data-tooltip="Ubah Status"
              aria-label="Ubah Status"
              onClick={(e) => {
                e.stopPropagation();
                openStatusChange(s);
              }}
            >
              <Check size={16} />
            </button>
            {s.status === "lolos" && waLolosUrl && (
              <a
                className="action-btn"
                data-tooltip="Kirim WA Lolos"
                aria-label="Kirim WA Lolos"
                href={waLolosUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "#16a34a" }}
              >
                <MessageCircle size={16} />
              </a>
            )}
            <button
              type="button"
              className="action-btn"
              data-tooltip="Unduh PDF"
              aria-label="Unduh PDF"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadDetailPdf(s);
              }}
              style={{ color: "#0284c7" }}
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              className="action-btn danger"
              data-tooltip="Hapus"
              aria-label="Hapus"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteOpen(s);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  const renderCards = (
    data: RekrutmenSubmissionWithAnswers[],
    emptyTitle = "Tidak Ada Data Calon Anggota",
    emptyMsg = "Coba sesuaikan kata kunci pencarian atau filter yang Anda pilih."
  ) => {
    if (data.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <Sparkles size={32} style={{ color: "var(--primary-700, #b91c1c)", margin: "0 auto 12px" }} />
          <h4 style={{ margin: "0 0 6px", color: "var(--navy-900)" }}>{emptyTitle}</h4>
          <p style={{ margin: 0, fontSize: "13px" }}>{emptyMsg}</p>
        </div>
      );
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
          gap: 16,
          maxHeight: "620px",
          overflowY: "auto",
          padding: "4px 2px",
        }}
      >
        {data.map((s) => {
          const { nama, hp, pilihan, waUrl, waLolosUrl } = getCandidateInfo(s);
          const conf = STATUS_CONFIG[s.status] || STATUS_CONFIG.menunggu;
          const Icon = conf.icon;

          return (
            <div
              key={s.id}
              onClick={() => setDetailOpen(s)}
              style={{
                background: "#ffffff",
                borderRadius: "var(--radius-md, 12px)",
                border: "1px solid var(--border, #e2e8f0)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)";
                e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
              }}
            >
              {/* Card Header Profile Banner */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                {/* Big Card Avatar Photo */}
                <CandidatePhotoBadge
                  answers={s.answers}
                  candidateName={nama}
                  size="lg"
                  onClick={(url, title, fileName) => openPhotoLightbox(url, title, fileName)}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: conf.bg,
                        color: conf.color,
                        border: `1px solid ${conf.border}`,
                      }}
                    >
                      <Icon size={11} /> {conf.label}
                    </span>
                    {pilihan && pilihan !== "-" && (
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(185, 28, 28, 0.08)",
                          color: "var(--primary-700, #b91c1c)",
                          fontWeight: 600,
                          border: "1px solid rgba(185, 28, 28, 0.15)",
                          maxWidth: "130px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={pilihan}
                      >
                        🎺 {pilihan}
                      </span>
                    )}
                  </div>
                  <strong
                    style={{
                      fontSize: "14px",
                      color: "var(--navy-900)",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={nama}
                  >
                    {nama}
                  </strong>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Calendar size={11} /> {formatTanggal(s.submittedAt)}
                  </span>
                </div>
              </div>

              {/* Card Body Information */}
              <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Kontak HP/WA:</span>
                  {(() => {
                    const isLolos = s.status === "lolos";
                    const targetWa = isLolos ? (waLolosUrl || waUrl) : waUrl;
                    if (targetWa) {
                      return (
                        <a
                          href={targetWa}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: isLolos ? "#065f46" : "#047857",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 7px",
                            borderRadius: 5,
                            background: isLolos ? "rgba(16, 185, 129, 0.18)" : "rgba(16, 185, 129, 0.1)",
                            border: isLolos ? "1px solid rgba(16, 185, 129, 0.45)" : "1px solid rgba(16, 185, 129, 0.25)",
                          }}
                          title={isLolos ? "Klik untuk kirim pengumuman lolos (Training 3x Penampilan)" : "Klik untuk membuka WhatsApp & kirim pesan skrining"}
                        >
                          <MessageCircle size={13} /> {hp}
                          {isLolos && (
                            <span style={{ fontSize: "9.5px", background: "#059669", color: "#fff", padding: "0 4px", borderRadius: 3, marginLeft: 2 }}>
                              Lolos WA
                            </span>
                          )}
                        </a>
                      );
                    }
                    return <span style={{ fontWeight: 600, color: "#475569" }}>{hp}</span>;
                  })()}
                </div>

                {s.adminNote && (
                  <div
                    style={{
                      padding: "6px 10px",
                      background: "#eff6ff",
                      borderRadius: 6,
                      fontSize: "11.5px",
                      color: "#1e40af",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>Catatan:</strong> {s.adminNote}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div
                style={{
                  padding: "10px 16px",
                  background: "#fafafa",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setDetailOpen(s)}
                  style={{ fontSize: "12px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Eye size={13} /> Detail
                </button>

                <div style={{ display: "flex", gap: 4 }}>
                  {s.status === "lolos" && waLolosUrl && (
                    <a
                      href={waLolosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      title="Kirim Pengumuman Lolos via WA"
                      style={{ color: "#059669", padding: "5px 8px" }}
                    >
                      <MessageCircle size={14} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openStatusChange(s)}
                    title="Ubah Status Seleksi"
                    style={{ color: "var(--primary-700, #b91c1c)", padding: "5px 8px" }}
                  >
                    <Check size={14} /> Status
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDownloadDetailPdf(s)}
                    title="Unduh PDF"
                    style={{ color: "#0284c7", padding: "5px 8px" }}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDeleteOpen(s)}
                    title="Hapus"
                    style={{ color: "#dc2626", padding: "5px 8px" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Daftar Calon Anggota</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <p style={{ margin: 0 }}>
                {loading ? "Memuat data..." : `${sorted.length} data calon anggota ditampilkan`}
              </p>
              {sortField && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    className="sort-active-badge"
                    onClick={() => {
                      setSortField(null);
                      setSortDirection("asc");
                    }}
                    title="Klik untuk reset urutan default"
                  >
                    <span>
                      Urut: {sortField === "nama" ? "Nama Lengkap" : sortField === "pilihan" ? "Pilihan / Posisi" : "Tanggal Mendaftar"} ({sortDirection === "asc" ? "A-Z" : "Z-A"})
                    </span>
                    <span className="sort-badge-close">×</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="header-actions">
            {/* View Mode Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f1f5f9",
                padding: 2,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Tampilan Tabel"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: viewMode === "table" ? "#ffffff" : "transparent",
                  color: viewMode === "table" ? "var(--primary-700, #b91c1c)" : "#64748b",
                  boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <List size={14} /> Tabel
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                title="Tampilan Kartu"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: viewMode === "cards" ? "#ffffff" : "transparent",
                  color: viewMode === "cards" ? "var(--primary-700, #b91c1c)" : "#64748b",
                  boxShadow: viewMode === "cards" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <LayoutGrid size={14} /> Kartu
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPdfOpen(true)}
              title="Cetak Laporan Rekapitulasi PDF Calon Anggota"
            >
              <Download size={16} /> Cetak PDF
            </button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Cari nama / posisi / No. HP..."
          />
          {posisiOptions.length > 0 && (
            <FilterComp
              label="Pilihan / Posisi"
              value={filterPosisi}
              onChange={setFilterPosisi}
              options={posisiOptions}
            />
          )}
          <FilterComp
            label="Status"
            value={filterStatus}
            onChange={(val) => handleStatusFilterChange(val as RekrutmenSubmissionStatus | "")}
            options={[
              { value: "", label: "Semua Status" },
              { value: "menunggu", label: "Menunggu" },
              { value: "lolos", label: "Lolos" },
              { value: "cadangan", label: "Cadangan" },
              { value: "tidak_lolos", label: "Tidak Lolos" },
            ]}
          />
          <FilterComp
            label="Periode"
            value={filterPeriode}
            onChange={setFilterPeriode}
            options={[
              { value: "", label: "Semua Periode" },
              { value: "hariIni", label: "Hari Ini" },
              { value: "mingguIni", label: "7 Hari Terakhir" },
              { value: "bulanIni", label: "Bulan Ini" },
            ]}
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-ghost btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "12px",
                color: "#dc2626",
              }}
              title="Reset semua filter pencarian"
            >
              <X size={13} /> Reset Filter
            </button>
          )}
        </div>

        {viewMode === "table" ? (
          <DataTable
            columns={columns}
            data={sorted}
            loading={loading}
            rowKey={(r) => r.id}
            onRowClick={(r) => setDetailOpen(r)}
            emptyTitle="Belum Ada Calon Anggota"
            emptyMessage="Belum ada pendaftar yang memenuhi kriteria filter saat ini."
            sortKey={sortField ?? undefined}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        ) : (
          renderCards(sorted)
        )}
      </div>

      {/* DETAIL MODAL CALON ANGGOTA & BERKAS LENGKAP */}
      <Modal
        open={detailOpen !== null}
        title="Berkas & Profil Calon Anggota"
        onClose={() => setDetailOpen(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDetailOpen(null)}>
              Tutup
            </button>
            <button
              className="btn btn-outline"
              onClick={() => detailOpen && handleDownloadDetailPdf(detailOpen)}
            >
              <Download size={16} /> Unduh PDF Lembar Calon
            </button>
            <button
              className="btn btn-primary"
              onClick={() => detailOpen && openStatusChange(detailOpen)}
            >
              <Check size={16} /> Ubah Status Seleksi
            </button>
          </>
        }
      >
        {detailOpen && (() => {
          const { nama, namaPanggilan, hp, rawHp, pilihan, waUrl, waLolosUrl, pesanLolos } = getCandidateInfo(detailOpen);
          const isLolos = detailOpen.status === "lolos";
          const statusBadge = STATUS_BADGE_MAP[detailOpen.status] || { label: detailOpen.status, className: "badge-neutral" };
          const photoInfo = extractCandidatePhotoInfo(detailOpen.answers);
          const { dataPribadi, pilihanMusik, berkasDokumen, lainnya } = categorizeCandidateAnswers(detailOpen.answers);

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "72vh", overflowY: "auto", paddingRight: 4 }}>
              {/* Standout Profile Header Card: Diselaraskan dengan layout Detail Anggota */}
              <div
                className="detail-list"
                style={{
                  background: "var(--bg-soft, #f8fafc)",
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border, #e2e8f0)",
                }}
              >
                {photoInfo.url ? (
                  <div className="detail-member-photo-wrap" style={{ flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <img
                      src={photoInfo.url}
                      alt={nama}
                      className="detail-member-photo"
                      onClick={() => openPhotoLightbox(photoInfo.url!, `Pas Foto: ${nama}`, photoInfo.fileName || undefined)}
                      style={{ cursor: "pointer" }}
                      title="Klik untuk memperbesar foto"
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openPhotoLightbox(photoInfo.url!, `Pas Foto: ${nama}`, photoInfo.fileName || undefined)}
                        style={{ fontSize: "11px", padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <ZoomIn size={12} /> Perbesar
                      </button>
                      {photoInfo.answerId && (
                        <label
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "11px", padding: "2px 8px", cursor: "pointer", color: "var(--primary-700, #b91c1c)", display: "inline-flex", alignItems: "center", gap: 4 }}
                          title="Ganti Foto Calon"
                        >
                          <Camera size={12} /> Ganti Foto
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f && photoInfo.answerId) {
                                handleAdminUploadPhoto(photoInfo.answerId, f);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="detail-member-photo-wrap" style={{ flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div className="member-avatar-placeholder" style={{ width: 68, height: 68, fontSize: 24 }}>
                      {(nama || "C").trim().charAt(0).toUpperCase()}
                    </div>
                    {photoInfo.answerId && (
                      <label
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: "11px", padding: "3px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Camera size={12} /> Unggah Foto
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f && photoInfo.answerId) {
                              handleAdminUploadPhoto(photoInfo.answerId, f);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}

                <div className="detail-row"><span className="detail-label">ID Calon</span><span>{detailOpen.id}</span></div>
                <div className="detail-row"><span className="detail-label">Nama Lengkap</span><span>{nama}</span></div>
                {namaPanggilan && namaPanggilan !== "-" && (
                  <div className="detail-row"><span className="detail-label">Nama Panggilan</span><span>{namaPanggilan}</span></div>
                )}
                <div className="detail-row"><span className="detail-label">Pilihan / Posisi</span><span>{pilihan}</span></div>
                <div className="detail-row">
                  <span className="detail-label">No. HP</span>
                  <span>
                    {rawHp || (hp && hp !== "-") ? (
                      <a
                        href={(isLolos ? (waLolosUrl || waUrl) : waUrl) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wa-detail-link"
                        title={`Hubungi ${nama} via WhatsApp`}
                      >
                        <MessageCircle size={15} className="wa-icon" />
                        <span>{hp}</span>
                        <span className="wa-pill">{isLolos ? "Kirim WA Lolos" : "WhatsApp"}</span>
                      </a>
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status Seleksi</span>
                  <span><span className={`badge ${statusBadge.className}`}>{statusBadge.label}</span></span>
                </div>
                <div className="detail-row"><span className="detail-label">Tanggal Mendaftar</span><span>{formatTanggalPanjang(detailOpen.submittedAt)}</span></div>
                {detailOpen.adminNote && (
                  <div className="detail-row"><span className="detail-label">Catatan Seleksi</span><span>{detailOpen.adminNote}</span></div>
                )}
              </div>

              {/* Lolos Announcement Banner */}
              {detailOpen.status === "lolos" && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)",
                    borderRadius: 8,
                    border: "1px solid rgba(16, 185, 129, 0.38)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "13.5px", color: "#065f46" }}>
                      <CheckCircle size={16} style={{ color: "#059669" }} />
                      <span>Calon Anggota Lolos Seleksi mbc sistem</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#047857", display: "block", marginTop: 2 }}>
                      Ketentuan resmi: Wajib mengikuti training &amp; 3x penampilan Chondro Wonopringgo.
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyToClipboard(pesanLolos, "Format Pesan Kelolosan")}
                      style={{ fontSize: "11.5px", padding: "4px 9px", background: "#ffffff", border: "1px solid #a7f3d0", color: "#065f46" }}
                    >
                      <Copy size={12} /> Salin Pesan
                    </button>
                    {waLolosUrl && (
                      <a
                        href={waLolosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{
                          fontSize: "12px",
                          padding: "5px 12px",
                          background: "#059669",
                          color: "#ffffff",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        <Send size={13} /> Kirim Pesan Lolos via WA
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Note Banner */}
              {detailOpen.adminNote && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#eff6ff",
                    borderRadius: 8,
                    border: "1px solid #bfdbfe",
                    fontSize: "12.5px",
                    color: "#1e40af",
                  }}
                >
                  <strong>Catatan Seleksi:</strong>
                  <p style={{ margin: "2px 0 0", color: "#1d4ed8" }}>{detailOpen.adminNote}</p>
                </div>
              )}

              {/* 📁 SECTION 1: BERKAS & DOKUMEN PENDAFTARAN */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Layers size={16} style={{ color: "var(--primary-700, #b91c1c)" }} />
                    <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                      Berkas &amp; Dokumen Lampiran
                    </strong>
                  </div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                    {berkasDokumen.length} Berkas Terlampir
                  </span>
                </div>

                {berkasDokumen.length === 0 ? (
                  <div style={{ padding: "12px", background: "#f8fafc", borderRadius: 8, textAlign: "center", fontSize: "12.5px", color: "#64748b" }}>
                    Pas foto calon anggota telah terlampir pada profil di atas. Tidak ada berkas lampiran tambahan.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                    {berkasDokumen.map((ans, bIdx) => {
                      const fileUrl = ans.fileUrl || (ans.value?.startsWith("data:") || ans.value?.startsWith("http") ? ans.value : null);
                      const isImg =
                        ans.field?.fieldType === "image" ||
                        ans.fileType?.startsWith("image/") ||
                        (ans.field?.label || "").toLowerCase().includes("foto") ||
                        Boolean(ans.fileName && /\.(jpe?g|png|webp|gif)$/i.test(ans.fileName)) ||
                        Boolean(fileUrl && (fileUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(fileUrl) || fileUrl.includes("drive.google.com")));

                      const displayName = ans.fileName || (ans.value && !ans.value.startsWith("data:") && !ans.value.startsWith("http") ? ans.value : (isImg ? "Pas Foto Calon Anggota" : "Berkas Terunggah"));

                      return (
                        <div
                          key={ans.id || bIdx}
                          style={{
                            padding: "12px",
                            background: "#f8fafc",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          {isImg ? (
                            <div
                              style={{ cursor: "pointer", flexShrink: 0 }}
                              onClick={() => openPhotoLightbox(fileUrl || "", ans.field?.label || displayName, displayName)}
                            >
                              <CandidatePhotoBadge
                                answers={[ans]}
                                candidateName={nama}
                                size="sm"
                                onClick={(u, t, fn) => openPhotoLightbox(u, t, fn)}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 46,
                                background: "#eff6ff",
                                borderRadius: 6,
                                border: "1px solid #bfdbfe",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                color: "#2563eb",
                              }}
                            >
                              <FileText size={22} />
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 600 }}>
                              {ans.field?.label || "Berkas"}
                            </span>
                            <strong
                              style={{
                                fontSize: "12.5px",
                                color: "var(--navy-900)",
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginTop: 1,
                              }}
                              title={displayName}
                            >
                              {displayName}
                            </strong>

                            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleOpenFile(ans)}
                                style={{ fontSize: "11px", padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3 }}
                              >
                                <Eye size={11} /> Buka
                              </button>
                              {isImg && fileUrl && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleDownloadImage(fileUrl, displayName)}
                                  style={{ fontSize: "11px", padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3, color: "var(--primary-700, #b91c1c)" }}
                                >
                                  <Download size={11} /> Unduh
                                </button>
                              )}
                              {isImg && (
                                <label
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "11px", padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3, color: "#0284c7", cursor: "pointer", margin: 0 }}
                                  title="Ganti foto ini"
                                >
                                  <Camera size={11} /> Ganti
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleAdminUploadPhoto(ans.id, f);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 🎺 SECTION 2: MINAT & PILIHAN MUSIK (JIKA ADA) */}
              {pilihanMusik.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={16} style={{ color: "var(--primary-700, #b91c1c)" }} />
                    <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                      Pilihan Alat &amp; Minat Musik
                    </strong>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                    {pilihanMusik.map((ans, mIdx) => (
                      <div
                        key={ans.id || mIdx}
                        style={{
                          padding: "10px 14px",
                          background: "#fff9f9",
                          borderRadius: 8,
                          border: "1px solid #fee2e2",
                        }}
                      >
                        <span style={{ fontSize: "11.5px", color: "var(--primary-700, #b91c1c)", fontWeight: 600, display: "block", marginBottom: 3 }}>
                          {ans.field?.label || "Pertanyaan Musik"}
                        </span>
                        <strong style={{ fontSize: "13px", color: "var(--navy-900)", display: "block" }}>
                          {ans.value || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>-</span>}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 👤 SECTION 3: DATA PRIBADI & KONTAK (2-COLUMN CLEAN GRID) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={16} style={{ color: "var(--navy-900)" }} />
                  <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                    Data Pribadi &amp; Kontak Calon
                  </strong>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10,
                  }}
                >
                  {dataPribadi.map((ans, pIdx) => {
                    const isPhone =
                      (ans.field?.label || "").toLowerCase().includes("hp") ||
                      (ans.field?.label || "").toLowerCase().includes("telepon") ||
                      (ans.field?.label || "").toLowerCase().includes("whatsapp") ||
                      (ans.field?.label || "").toLowerCase().includes("wa") ||
                      (ans.field?.label || "").toLowerCase().includes("kontak");

                    return (
                      <div
                        key={ans.id || pIdx}
                        style={{
                          padding: "10px 14px",
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 3 }}>
                          {ans.field?.label || "Data Pribadi"}
                        </span>

                        {isPhone && ans.value ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>
                              {formatNomorHp(ans.value)}
                            </strong>
                            <a
                              href={buatLinkWhatsAppCalon(ans.value, nama, form.title) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: "11px",
                                color: "#047857",
                                fontWeight: 600,
                                textDecoration: "none",
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "rgba(16, 185, 129, 0.12)",
                              }}
                            >
                              <MessageCircle size={11} /> Chat WA
                            </a>
                          </div>
                        ) : (
                          <strong style={{ fontSize: "13px", color: "var(--navy-900)", display: "block", wordBreak: "break-word" }}>
                            {ans.value || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>-</span>}
                          </strong>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 📝 SECTION 4: INFORMASI LAINNYA (JIKA ADA FIELD LAIN) */}
              {lainnya.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={16} style={{ color: "#64748b" }} />
                    <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                      Informasi Tambahan Lainnya
                    </strong>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                    {lainnya.map((ans, lIdx) => (
                      <div
                        key={ans.id || lIdx}
                        style={{
                          padding: "10px 14px",
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 3 }}>
                          {ans.field?.label || "Pertanyaan Lain"}
                        </span>
                        <strong style={{ fontSize: "13px", color: "var(--navy-900)", display: "block" }}>
                          {ans.value || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>-</span>}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* MODAL UBAH STATUS SELEKSI */}
      <Modal
        open={statusModalSub !== null}
        title="Ubah Status Calon Anggota"
        onClose={() => setStatusModalSub(null)}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setStatusModalSub(null)} disabled={savingStatus}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleStatusSave} disabled={savingStatus}>
              {savingStatus ? "Menyimpan..." : "Simpan Status Seleksi"}
            </button>
          </>
        }
      >
        {statusModalSub && (() => {
          const { nama } = getCandidateInfo(statusModalSub);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Calon Anggota Terpilih:</span>
                <strong style={{ fontSize: "15px", color: "var(--navy-900)", display: "block" }}>
                  {nama}
                </strong>
              </div>

              <div className="form-group" style={{ gap: 6 }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Tentukan Status Hasil Seleksi *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["menunggu", "lolos", "cadangan", "tidak_lolos"] as RekrutmenSubmissionStatus[]).map((st) => {
                    const conf = STATUS_CONFIG[st];
                    const Icon = conf.icon;
                    const active = selectedStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSelectedStatus(st)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: active ? `2px solid ${conf.color}` : "1px solid #e2e8f0",
                          background: active ? conf.bg : "#ffffff",
                          color: conf.color,
                          fontWeight: active ? 700 : 500,
                          fontSize: "13px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Icon size={16} />
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ gap: 4 }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Catatan Reviewer / Alasan Keputusan (Opsional)</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Misal: Memenuhi seluruh kriteria instrumen brass / Menjadi cadangan gelombang 1"
                  rows={3}
                  style={{ padding: "8px 12px", fontSize: "13px", resize: "vertical" }}
                />
              </div>

              {/* OPSI & PRATINJAU PENGUMUMAN WHATSAPP UNTUK STATUS LOLOS */}
              {selectedStatus === "lolos" && (() => {
                const { hp, waLolosUrl, pesanLolos } = getCandidateInfo(statusModalSub);
                return (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#10b981",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <MessageCircle size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: "13px", color: "#065f46", display: "block" }}>
                            Opsi Pengumuman Lolos via WhatsApp
                          </strong>
                          <span style={{ fontSize: "11.5px", color: "#047857" }}>
                            Tujuan: {hp || "Nomor belum terdeteksi"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(pesanLolos, "Format Pesan Pengumuman Lolos")}
                          className="btn btn-ghost btn-sm"
                          style={{
                            fontSize: "11.5px",
                            padding: "4px 8px",
                            background: "#ffffff",
                            border: "1px solid #d1fae5",
                            color: "#065f46",
                          }}
                          title="Salin teks pesan ke clipboard"
                        >
                          <Copy size={12} /> Salin Pesan
                        </button>

                        {waLolosUrl && (
                          <a
                            href={waLolosUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{
                              fontSize: "11.5px",
                              padding: "4px 9px",
                              background: "#059669",
                              color: "#ffffff",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              borderRadius: 6,
                              fontWeight: 600,
                            }}
                            title="Buka WhatsApp langsung sekarang"
                          >
                            <Send size={12} /> Buka WA
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Ketentuan 3x Penampilan Highlight Tag */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        background: "rgba(16, 185, 129, 0.12)",
                        borderRadius: 6,
                        fontSize: "11.5px",
                        color: "#065f46",
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={13} style={{ color: "#059669", flexShrink: 0 }} />
                      <span>Ketentuan: Wajib mengikuti proses training &amp; 3x penampilan Chondro Wonopringgo</span>
                    </div>

                    {/* Checkbox Auto-Open WA */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: "12.5px",
                        color: "#064e3b",
                        fontWeight: 600,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sendWaOnLolosSave}
                        onChange={(e) => setSendWaOnLolosSave(e.target.checked)}
                        style={{ cursor: "pointer", accentColor: "#059669", width: 16, height: 16 }}
                      />
                      Buka WhatsApp otomatis untuk kirim pengumuman setelah tombol simpan diklik
                    </label>

                    {/* Preview Box */}
                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1fae5",
                        borderRadius: 6,
                        padding: "8px 10px",
                        fontSize: "11.5px",
                        color: "#1e293b",
                        lineHeight: 1.45,
                        maxHeight: "110px",
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                      }}
                    >
                      {pesanLolos}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
      </Modal>

      {/* MODAL DOWNLOAD PDF REKAPITULASI */}
      <Modal
        open={pdfOpen}
        title="Unduh Laporan Rekapitulasi PDF Calon Anggota"
        onClose={() => setPdfOpen(false)}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPdfOpen(false)} disabled={pdfGenerating}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={pdfGenerating}>
              <Download size={16} />
              {pdfGenerating ? "Membuat PDF..." : "Unduh Laporan PDF"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--navy-900)" }}>
              Pilih Kriteria & Rentang Laporan
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "3px 0 0" }}>
              Cetak dokumen rekapitulasi calon anggota mbc sistem lengkap dengan tabel status dan pas foto.
            </p>
          </div>

          {/* Segmented Period Tabs */}
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

          {/* Month & Year Selection */}
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

          {/* Custom Date Range */}
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

          {/* Filter Status on PDF */}
          <div className="form-group" style={{ gap: 4 }}>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>Filter Status Seleksi</label>
            <select
              value={pdfStatus}
              onChange={(e) => setPdfStatus(e.target.value as RekrutmenSubmissionStatus | "")}
              style={{ height: 38, padding: "6px 10px", fontSize: "13px" }}
            >
              <option value="">Semua Calon Anggota (Seluruh Status)</option>
              <option value="menunggu">Hanya Menunggu (🟡)</option>
              <option value="lolos">Hanya Lolos (🟢)</option>
              <option value="cadangan">Hanya Cadangan (🔵)</option>
              <option value="tidak_lolos">Hanya Tidak Lolos (🔴)</option>
            </select>
          </div>

          {/* Period Preview Card */}
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
            <span style={{ color: "var(--text-muted)" }}>Periode dicetak:</span>
            <strong style={{ color: "var(--navy-900)" }}>
              {pdfRange.label}
              {pdfStatus ? ` · ${STATUS_CONFIG[pdfStatus]?.label}` : ""}
            </strong>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={deleteOpen !== null}
        title="Hapus Data Calon Anggota?"
        message={`Data calon anggota ${
          deleteOpen ? getCandidateInfo(deleteOpen).nama : ""
        } akan dihapus secara permanen dari sistem.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(null)}
      />

      {/* IMAGE LIGHTBOX MODAL (PORTAL TO BODY) */}
      {lightboxImage &&
        createPortal(
          <div
            onClick={() => setLightboxImage(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.88)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999999,
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 640,
                width: "100%",
                background: "#ffffff",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                animation: "modalFadeIn 0.2s ease",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                }}
              >
                <strong style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy-900)" }}>
                  📸 {lightboxImage.title}
                </strong>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDownloadImage(lightboxImage.url, lightboxImage.title)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "12px", padding: "5px 12px", fontWeight: 600 }}
                  >
                    <Download size={14} /> Unduh Foto
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setLightboxImage(null)}
                    style={{ padding: "4px 8px", fontSize: "16px", lineHeight: 1 }}
                    title="Tutup Pratinjau"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div style={{ padding: 24, textAlign: "center", background: "rgba(15, 23, 42, 0.95)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
                {lightboxFetching ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#f8fafc" }}>
                    <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Memulihkan dan memuat foto...</span>
                  </div>
                ) : lightboxImgError ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#f8fafc", padding: "10px" }}>
                    <Camera size={44} style={{ color: "#94a3b8" }} />
                    <strong style={{ fontSize: "14.5px", color: "#f8fafc" }}>Foto Dalam Proses Resolusi</strong>
                    <p style={{ fontSize: "12.5px", color: "#94a3b8", maxWidth: 380, margin: 0, lineHeight: 1.5 }}>
                      Foto ini tersimpan di Google Drive. Klik tombol muat ulang di bawah untuk memproses foto ke resolusi HD instan.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)" }}
                        onClick={async () => {
                          setLightboxFetching(true);
                          setLightboxImgError(false);
                          const match = lightboxImage.url.match(/[\/|=]([a-zA-Z0-9_-]{25,})/);
                          const res = await getRekrutmenImageBase64Item({
                            fileId: match ? match[1] : undefined,
                            fileName: lightboxImage.fileName || lightboxImage.title,
                          });
                          setLightboxFetching(false);
                          if (res.success && res.base64) {
                            setLightboxImage((prev) => prev ? { ...prev, url: res.base64! } : null);
                          } else {
                            setLightboxImgError(true);
                          }
                        }}
                      >
                        🔄 Muat Ulang Foto HD
                      </button>
                    </div>
                  </div>
                ) : (
                  <img
                    src={lightboxImage.url}
                    alt={lightboxImage.title}
                    referrerPolicy="no-referrer"
                    onError={async (e) => {
                      const current = e.currentTarget.src;
                      const match = current.match(/[\/|=]([a-zA-Z0-9_-]{25,})/);
                      const fileId = match ? match[1] : undefined;

                      setLightboxFetching(true);
                      const res = await getRekrutmenImageBase64Item({
                        fileId,
                        fileName: lightboxImage.fileName || lightboxImage.title,
                      });
                      setLightboxFetching(false);

                      if (res.success && res.base64) {
                        setLightboxImage((prev) => prev ? { ...prev, url: res.base64! } : null);
                        setLightboxImgError(false);
                      } else {
                        setLightboxImgError(true);
                      }
                    }}
                    style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}