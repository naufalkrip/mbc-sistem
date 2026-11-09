import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Bookmark,
  FileText,
  Check,
  Camera,
  Sparkles,
  MessageCircle,
  Copy,
  Send,
  X,
  User,
  Users,
  FileSpreadsheet,
  ChevronDown,
  Plus,
  QrCode,
  Settings,
  Maximize2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { PhotoLightboxModal, LightboxItem } from "../ui/PhotoLightboxModal";
import type {
  RekrutmenSubmissionWithAnswers,
  RekrutmenForm,
  RekrutmenSubmissionStatus,
  RekrutmenAnswer,
  RekrutmenField,
} from "../../types";
import {
  formatTanggalPanjang,
  formatRentangTanggal,
  formatNomorHp,
  formatNomorWhatsAppUrl,
  buatLinkWhatsAppCalon,
  buatLinkWhatsAppLolos,
  buatLinkWhatsAppTidakLolos,
} from "../../utils/format";
import {
  buildRekrutmenWaMessage,
  buildRekrutmenWaLink,
  getRekrutmenWaSettings,
} from "../../utils/rekrutmenWaTemplate";
import { RekrutmenWhatsAppBroadcastModal } from "./RekrutmenWhatsAppBroadcastModal";
import { SearchBar } from "../ui/SearchBar";
import { Filter as FilterComp } from "../ui/Filter";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ActionDropdown } from "../ui/ActionDropdown";
import { Loading } from "../ui/Loading";
import { EmptyState } from "../ui/EmptyState";
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
  onOpenQr?: () => void;
  onAddForm?: () => void;
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
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
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            border: "1.5px solid var(--border, #e2e8f0)",
            cursor: onAvatarClick ? "pointer" : "default",
          }}
        />
      ) : (
        <div
          className="member-avatar-placeholder"
          style={{
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: "50%",
            background: "#f1f5f9",
            color: "#475569",
            fontWeight: 700,
            fontSize: "11px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid var(--border, #e2e8f0)",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          {initial}
        </div>
      )}
      <div className="order-customer-name" title={nama}>
        {nama}
      </div>
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
  onOpenQr,
  onAddForm,
}: SubmissionListProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<RekrutmenSubmissionStatus | "">(initialStatusFilter || "");
  const [filterPosisi, setFilterPosisi] = useState<string>("");
  const [filterPeriode, setFilterPeriode] = useState<string>("");

  const [detailOpen, setDetailOpen] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setIsActionMenuOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

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

  const handleResetFilters = () => {
    setSearch("");
    handleStatusFilterChange("");
    setFilterPosisi("");
    setFilterPeriode("");
  };

  const hasActiveFilters = Boolean(search.trim() || filterStatus || filterPosisi || filterPeriode);

  // Quick / Detail Status Change State
  const [statusModalSub, setStatusModalSub] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RekrutmenSubmissionStatus>("menunggu");
  const [adminNote, setAdminNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendWaOnLolosSave, setSendWaOnLolosSave] = useState(true);
  const [sendWaOnTidakLolosSave, setSendWaOnTidakLolosSave] = useState(true);

  // States for Refactored OrderDetail-style Candidate Detail Modal
  const [detailTab, setDetailTab] = useState<"detail" | "whatsapp">("detail");
  const [detailWaType, setDetailWaType] = useState<"skrining" | "lolos" | "tidak_lolos" | "general">("skrining");
  const [detailWaMessage, setDetailWaMessage] = useState("");
  const [isDetailWaDirty, setIsDetailWaDirty] = useState(false);
  const [copiedDetailWa, setCopiedDetailWa] = useState(false);
  const [copiedDetailHp, setCopiedDetailHp] = useState(false);
  const [detailStatus, setDetailStatus] = useState<RekrutmenSubmissionStatus>("menunggu");
  const [detailNote, setDetailNote] = useState("");
  const [detailSavingStatus, setDetailSavingStatus] = useState(false);
  const [detailSendWaLolos, setDetailSendWaLolos] = useState(true);
  const [detailSendWaTidakLolos, setDetailSendWaTidakLolos] = useState(true);
  const [detailOverrideTempat, setDetailOverrideTempat] = useState("");
  const [detailOverrideGmaps, setDetailOverrideGmaps] = useState("");
  const [detailOverrideWaktu, setDetailOverrideWaktu] = useState("");

  // State Khusus Fitur Kirim WhatsApp Calon Anggota Tidak Lolos
  const [waTidakLolosPreviewSub, setWaTidakLolosPreviewSub] = useState<RekrutmenSubmissionWithAnswers | null>(null);
  const [waTidakLolosText, setWaTidakLolosText] = useState("");
  const [copiedWaTidakLolos, setCopiedWaTidakLolos] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [customLightboxItems, setCustomLightboxItems] = useState<LightboxItem[] | null>(null);

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

  // WhatsApp Broadcast Modal State
  const [waBroadcastModalData, setWaBroadcastModalData] = useState<{
    sub?: RekrutmenSubmissionWithAnswers | null;
    mode?: "skrining" | "lolos" | "tidak_lolos" | "general";
    tab?: "broadcast" | "settings";
  } | null>(null);

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

    const pilihanField =
      // Prioritas 1: label "bakat" — paling spesifik, tidak ambigu
      s.answers.find((a) => {
        const lbl = (a.field?.label || "").toLowerCase();
        return lbl.includes("bakat");
      }) ||
      // Prioritas 2: label instrumen/posisi/seksi/divisi/alat
      s.answers.find((a) => {
        const lbl = (a.field?.label || "").toLowerCase();
        return (
          lbl.includes("instrumen") ||
          lbl.includes("alat") ||
          lbl.includes("seksi") ||
          lbl.includes("divisi") ||
          lbl.includes("posisi") ||
          lbl.includes("pilihan 1") ||
          lbl.includes("minat")
        );
      }) ||
      // Prioritas 3: "marching" tapi BUKAN field pengalaman
      s.answers.find((a) => {
        const lbl = (a.field?.label || "").toLowerCase();
        return lbl.includes("marching") && !lbl.includes("pengalaman");
      });

    const pilihan = pilihanField?.value?.trim() || "-";

    const noteForMsg = s.adminNote || (statusModalSub?.id === s.id ? adminNote : undefined);
    const waUrl = buildRekrutmenWaLink(rawHp, "skrining", { nama, judulForm: form.title, posisi: pilihan }) || buatLinkWhatsAppCalon(rawHp, nama, form.title);
    const waLolosUrl = buildRekrutmenWaLink(rawHp, "lolos", { nama, judulForm: form.title, posisi: pilihan, catatan: noteForMsg }) || buatLinkWhatsAppLolos(rawHp, nama, form.title, noteForMsg);
    const pesanLolos = buildRekrutmenWaMessage("lolos", { nama, judulForm: form.title, posisi: pilihan, catatan: noteForMsg });
    const waTidakLolosUrl = buildRekrutmenWaLink(rawHp, "tidak_lolos", { nama, judulForm: form.title, posisi: pilihan, catatan: noteForMsg }) || buatLinkWhatsAppTidakLolos(rawHp, nama, form.title, pilihan, noteForMsg);
    const pesanTidakLolos = buildRekrutmenWaMessage("tidak_lolos", { nama, judulForm: form.title, posisi: pilihan, catatan: noteForMsg });

    return { nama, namaPanggilan, rawHp, hp, pilihan, waUrl, waLolosUrl, pesanLolos, waTidakLolosUrl, pesanTidakLolos };
  };

  const safeSubmissions = useMemo(
    () => (Array.isArray(submissions) ? submissions : []),
    [submissions]
  );

  // List semua foto calon anggota yang tersedia untuk Lightbox / Galeri Full Photo
  const candidatePhotoItems = useMemo<LightboxItem[]>(() => {
    const list: LightboxItem[] = [];
    for (const s of safeSubmissions) {
      const { nama, pilihan } = getCandidateInfo(s);
      const photoInfo = extractCandidatePhotoInfo(s.answers);
      if (photoInfo.url) {
        list.push({
          id: s.id,
          url: photoInfo.url,
          title: `Pas Foto: ${nama}`,
          subtitle: pilihan && pilihan !== "-" ? `Posisi / Instrument: ${pilihan}` : undefined,
          status: s.status,
          fileName: photoInfo.fileName || `${nama.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`,
          driveFileId: photoInfo.driveFileId,
        });
      }
    }
    return list;
  }, [safeSubmissions]);

  const activeLightboxItems = customLightboxItems || candidatePhotoItems;

  const openPhotoLightbox = (url: string, title: string, fileName?: string, submissionId?: string) => {
    const idx = candidatePhotoItems.findIndex(
      (item) => (submissionId && item.id === submissionId) || item.url === url
    );

    if (idx !== -1) {
      setCustomLightboxItems(null);
      setLightboxIndex(idx);
      setLightboxOpen(true);
    } else {
      const singleItem: LightboxItem = {
        url,
        title,
        fileName,
      };
      setCustomLightboxItems([singleItem]);
      setLightboxIndex(0);
      setLightboxOpen(true);
    }
  };

  const handleResolveDrivePhoto = async (item: LightboxItem): Promise<string | null> => {
    const match = item.url ? item.url.match(/[\/|=]([a-zA-Z0-9_-]{25,})/) : null;
    const fileId = item.driveFileId || (match ? match[1] : undefined);
    const res = await getRekrutmenImageBase64Item({
      fileId,
      fileName: item.fileName || item.title,
    });
    if (res.success && res.base64) {
      if (fileId) {
        setCachedResolvedPhoto(fileId, res.base64);
      }
      return res.base64;
    }
    return null;
  };

  // Posisi Options untuk Dropdown Filter
  const posisiOptions = useMemo(() => {
    return [
      { value: "Brass / Terompet", label: "Brass / Terompet" },
      { value: "Battery / Percussion", label: "Battery / Percussion (Snare, Bass, Quard)" },
      { value: "Pit Instrument", label: "Pit Instrument (Marimba, Vibraphone, Xylophone)" },
      { value: "Color Guard (CG)", label: "Color Guard (Bendera & Rifle)" },
      { value: "Field Commander / Drum Major", label: "Field Commander / Drum Major" },
    ];
  }, []);

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

  const sorted = filtered;

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
    setSendWaOnTidakLolosSave(true);
  };

  const handleStatusSave = async () => {
    if (!statusModalSub) return;
    const isPassing = selectedStatus === "lolos";
    const isRejecting = selectedStatus === "tidak_lolos";
    const subTarget = statusModalSub;
    setSavingStatus(true);
    const ok = await onUpdateStatus(subTarget.id, selectedStatus, adminNote);
    setSavingStatus(false);
    if (ok) {
      toastSuccess(`Status calon anggota berhasil diperbarui menjadi ${STATUS_CONFIG[selectedStatus].label}.`);

      // Jika status lolos dan opsi kirim WA aktif, buka tautan WhatsApp otomatis
      if (isPassing && sendWaOnLolosSave) {
        const { waLolosUrl } = getCandidateInfo(subTarget);
        if (waLolosUrl) {
          window.open(waLolosUrl, "_blank", "noopener,noreferrer");
        }
      } else if (isRejecting && sendWaOnTidakLolosSave) {
        const { waTidakLolosUrl } = getCandidateInfo(subTarget);
        if (waTidakLolosUrl) {
          window.open(waTidakLolosUrl, "_blank", "noopener,noreferrer");
        }
      }

      setStatusModalSub(null);
      if (detailOpen && detailOpen.id === subTarget.id) {
        setDetailOpen({ ...detailOpen, status: selectedStatus, adminNote });
      }
      await onRefresh();
    } else {
      toastError("Gagal memperbarui status seleksi.");
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

  // Sync state when detailOpen changes
  useEffect(() => {
    if (detailOpen) {
      setDetailTab("detail");
      setDetailStatus(detailOpen.status);
      setDetailNote(detailOpen.adminNote || "");
      setDetailSendWaLolos(true);
      setDetailSendWaTidakLolos(true);
      setIsDetailWaDirty(false);

      const s = getRekrutmenWaSettings();
      setDetailOverrideTempat(s.namaTempat);
      setDetailOverrideGmaps(s.titikGmaps);
      setDetailOverrideWaktu(s.tanggalWaktu);

      let initialMode: "skrining" | "lolos" | "tidak_lolos" | "general" = "skrining";
      if (detailOpen.status === "lolos") initialMode = "lolos";
      else if (detailOpen.status === "tidak_lolos") initialMode = "tidak_lolos";
      setDetailWaType(initialMode);
    }
  }, [detailOpen]);

  // Lock body scroll when detailOpen is active
  useEffect(() => {
    if (detailOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [detailOpen]);

  // Template WA yang di-generate secara live berdasarkan jenis pesan & override tempat
  const generatedDetailWaTemplate = useMemo(() => {
    if (!detailOpen) return "";
    const { nama, pilihan } = getCandidateInfo(detailOpen);
    return buildRekrutmenWaMessage(detailWaType, {
      nama,
      judulForm: form.title,
      posisi: pilihan,
      catatan: detailNote || detailOpen.adminNote,
      customSettings: {
        namaTempat: detailOverrideTempat,
        titikGmaps: detailOverrideGmaps,
        tanggalWaktu: detailOverrideWaktu,
      },
    });
  }, [
    detailOpen,
    detailWaType,
    form.title,
    detailNote,
    detailOverrideTempat,
    detailOverrideGmaps,
    detailOverrideWaktu,
  ]);

  useEffect(() => {
    if (!isDetailWaDirty) {
      setDetailWaMessage(generatedDetailWaTemplate);
    }
  }, [generatedDetailWaTemplate, isDetailWaDirty]);

  const handleCopyDetailCandidateHp = () => {
    if (!detailOpen) return;
    const { rawHp, hp } = getCandidateInfo(detailOpen);
    const target = hp || rawHp;
    if (target) {
      navigator.clipboard.writeText(target);
      setCopiedDetailHp(true);
      setTimeout(() => setCopiedDetailHp(false), 2000);
      toastSuccess("Nomor WhatsApp berhasil disalin!");
    }
  };

  const handleCopyDetailWaMessage = () => {
    if (!detailWaMessage) return;
    navigator.clipboard.writeText(detailWaMessage);
    setCopiedDetailWa(true);
    setTimeout(() => setCopiedDetailWa(false), 2000);
    toastSuccess("Pesan WhatsApp berhasil disalin ke clipboard!");
  };

  const handleSendDetailWa = () => {
    if (!detailOpen) return;
    const { rawHp, hp } = getCandidateInfo(detailOpen);
    const clean = formatNomorWhatsAppUrl(rawHp || hp);
    if (!clean) {
      toastError("Nomor WhatsApp calon anggota tidak valid.");
      return;
    }
    const encoded = encodeURIComponent(detailWaMessage);
    const url = `https://wa.me/${clean}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDetailSaveStatus = async () => {
    if (!detailOpen || detailSavingStatus) return;
    setDetailSavingStatus(true);
    const ok = await onUpdateStatus(detailOpen.id, detailStatus, detailNote);
    setDetailSavingStatus(false);
    if (ok) {
      toastSuccess(`Status seleksi berhasil diubah menjadi ${STATUS_CONFIG[detailStatus].label}.`);

      if (detailStatus === "lolos" && detailSendWaLolos) {
        const { waLolosUrl } = getCandidateInfo({ ...detailOpen, adminNote: detailNote });
        if (waLolosUrl) {
          window.open(waLolosUrl, "_blank", "noopener,noreferrer");
        }
      } else if (detailStatus === "tidak_lolos" && detailSendWaTidakLolos) {
        const { waTidakLolosUrl } = getCandidateInfo({ ...detailOpen, adminNote: detailNote });
        if (waTidakLolosUrl) {
          window.open(waTidakLolosUrl, "_blank", "noopener,noreferrer");
        }
      }

      setDetailOpen((prev) => (prev ? { ...prev, status: detailStatus, adminNote: detailNote } : null));
      await onRefresh();
    } else {
      toastError("Gagal memperbarui status seleksi.");
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

  const handleExportCSV = () => {
    try {
      if (sorted.length === 0) {
        toastError("Tidak ada data pendaftar untuk diekspor.");
        return;
      }
      const headers = ["No", "Nama Lengkap", "Pilihan / Posisi", "Nomor WhatsApp", "Status Seleksi", "Tanggal Daftar", "Catatan Admin"];
      const rows = sorted.map((s, idx) => {
        const { nama, hp, pilihan } = getCandidateInfo(s);
        const statusLabel = STATUS_CONFIG[s.status]?.label || s.status;
        const dateStr = s.submittedAt ? s.submittedAt.slice(0, 10) : "";
        const note = (s.adminNote || "").replace(/"/g, '""');
        return [
          idx + 1,
          `"${nama.replace(/"/g, '""')}"`,
          `"${pilihan.replace(/"/g, '""')}"`,
          `"${hp.replace(/"/g, '""')}"`,
          `"${statusLabel}"`,
          `"${dateStr}"`,
          `"${note}"`,
        ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `data-calon-anggota-${filterStatus || "semua"}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastSuccess("Data calon anggota berhasil diekspor ke CSV!");
    } catch {
      toastError("Gagal mengekspor data ke CSV.");
    }
  };

  const handleDownloadDetailPdf = async (s: RekrutmenSubmissionWithAnswers) => {
    try {
      await laporanRekrutmenDetail(form, s);
    } catch {
      toastError("Gagal mencetak dokumen pendaftar.");
    }
  };

  /** Template pesan WhatsApp khusus calon anggota tidak lolos seleksi sesuai instruksi MB Chondro */
  const generatePesanTidakLolosSpecific = (namaPeserta: string, posisiPeserta: string): string => {
    const cleanNama = (namaPeserta || "Calon Anggota").trim();
    const cleanPosisi = (posisiPeserta && posisiPeserta !== "-" ? posisiPeserta : "Calon Anggota").trim();
    return (
      `Halo Kak *${cleanNama}* 🙏\n\n` +
      `Terima kasih telah berpartisipasi dalam seleksi calon anggota *MB Chondro Wonopringgo 2026* untuk posisi *${cleanPosisi}*.\n\n` +
      `Setelah melalui proses evaluasi tim seleksi, kami informasikan bahwa untuk saat ini Kakak *belum dapat diterima* sebagai anggota MB Chondro.\n\n` +
      `Keputusan ini mempertimbangkan kebutuhan formasi dan kuota anggota pada periode ini, bukan berarti mengurangi apresiasi kami terhadap potensi dan semangat Kakak.\n\n` +
      `Tetap semangat berkarya dan mengembangkan kemampuan. Semoga ada kesempatan untuk bertemu kembali dalam kegiatan MB Chondro di masa mendatang.\n\n` +
      `Terima kasih atas partisipasinya. Sukses selalu untuk Kakak 🙏✨\n\n` +
      `*Pengurus & Tim Seleksi MB Chondro Wonopringgo*`
    );
  };

  const handleOpenWaTidakLolos = (sub: RekrutmenSubmissionWithAnswers) => {
    const { nama, pilihan } = getCandidateInfo(sub);
    setWaTidakLolosPreviewSub(sub);
    setWaTidakLolosText(generatePesanTidakLolosSpecific(nama, pilihan));
    setCopiedWaTidakLolos(false);
  };

  const handleSendWaTidakLolosDirect = () => {
    if (!waTidakLolosPreviewSub) return;
    const { rawHp, hp, nama } = getCandidateInfo(waTidakLolosPreviewSub);
    const cleanNumber = formatNomorWhatsAppUrl(rawHp || hp);
    if (!cleanNumber) {
      toastError(`Nomor WhatsApp untuk calon anggota ${nama} tidak valid.`);
      return;
    }
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(waTidakLolosText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setWaTidakLolosPreviewSub(null);
  };

  const handleCopyWaTidakLolosDirect = () => {
    if (!waTidakLolosText) return;
    navigator.clipboard.writeText(waTidakLolosText);
    setCopiedWaTidakLolos(true);
    setTimeout(() => setCopiedWaTidakLolos(false), 2000);
    toastSuccess("Pesan WhatsApp berhasil disalin!");
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
        if (lightboxOpen) {
          setCustomLightboxItems([{ url: safeHdBase64, title: "Foto Calon Anggota", fileName: file.name }]);
          setLightboxIndex(0);
        }
      } else {
        toastError(res.message || "Gagal memperbarui foto.");
      }
    } catch {
      toastError("Gagal memproses file foto.");
    }
  };



  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 1. SATU PANEL FILTER & TOOLBAR TERPADU (SAMA SEPERTI KELOLA PESANAN) */}
        <div className="pesanan-filter-panel">
          {/* Baris 1 (Desktop): Pencarian, Periode, Status, Posisi, Aksi */}
          <div className="pesanan-filter-row-desktop">
            <div className="pesanan-filter-search">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Cari nama calon / pilihan / no. WhatsApp..."
              />
            </div>

            <div className="pesanan-filter-select">
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
            </div>

            <div className="pesanan-filter-select">
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
            </div>

            {posisiOptions.length > 0 && (
              <div className="pesanan-filter-select">
                <FilterComp
                  label="Pilihan / Posisi"
                  value={filterPosisi}
                  onChange={setFilterPosisi}
                  options={[
                    { value: "", label: "Semua Pilihan" },
                    ...posisiOptions,
                  ]}
                />
              </div>
            )}

            <div className="pesanan-filter-actions">
              <button
                type="button"
                className="btn-tambah-pesanan"
                onClick={() => {
                  if (form) {
                    window.open(`/rekrutmen/form/${form.id}`, "_blank");
                  } else if (onAddForm) {
                    onAddForm();
                  }
                }}
                title="Buka Formulir Pendaftaran Publik"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Buka Formulir</span>
              </button>

              <div className="pesanan-more-dropdown-container">
                <button
                  type="button"
                  className="btn-ekspor-dropdown"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsActionMenuOpen((prev) => !prev);
                  }}
                  title="Menu Opsi & Ekspor"
                >
                  <span>Opsi / Ekspor</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isActionMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>

                {isActionMenuOpen && (
                  <div
                    className="pesanan-more-menu"
                    onClick={(e) => e.stopPropagation()}
                    style={{ zIndex: 9999, minWidth: 210 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        handleExportCSV();
                      }}
                    >
                      <FileSpreadsheet size={15} color="#16A34A" />
                      <span>Ekspor ke CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setPdfOpen(true);
                      }}
                    >
                      <FileText size={15} color="#DC2626" />
                      <span>Ekspor Laporan PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        if (candidatePhotoItems.length > 0) {
                          setCustomLightboxItems(null);
                          setLightboxIndex(0);
                          setLightboxOpen(true);
                        } else {
                          toastError("Belum ada calon anggota yang mengunggah pas foto.");
                        }
                      }}
                    >
                      <Camera size={15} color="#7C3AED" />
                      <span>Galeri Pas Foto ({candidatePhotoItems.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setWaBroadcastModalData({ sub: null, mode: "skrining", tab: "broadcast" });
                      }}
                    >
                      <MessageCircle size={15} color="#25D366" />
                      <span>Broadcast WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setWaBroadcastModalData({ sub: null, mode: "skrining", tab: "settings" });
                      }}
                    >
                      <Settings size={15} color="#2563EB" />
                      <span>Pengaturan Template WA</span>
                    </button>
                    {onOpenQr && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          onOpenQr();
                        }}
                      >
                        <QrCode size={15} color="#D97706" />
                        <span>QR Code & Tautan Publik</span>
                      </button>
                    )}
                    {onAddForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          onAddForm();
                        }}
                      >
                        <Plus size={15} color="#C71920" />
                        <span>Kelola Formulir Baru</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Baris 1 (Mobile): Layout Vertikal Responsif */}
          <div className="pesanan-filter-row-mobile">
            <div className="pesanan-mobile-search-row">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Cari nama calon / posisi / no. WhatsApp..."
              />
            </div>

            <div className="pesanan-mobile-filters-row">
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
            </div>

            <div className="pesanan-mobile-actions-row">
              <button
                type="button"
                className="btn-tambah-pesanan full-width"
                onClick={() => {
                  if (form) {
                    window.open(`/rekrutmen/form/${form.id}`, "_blank");
                  } else if (onAddForm) {
                    onAddForm();
                  }
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Buka Formulir</span>
              </button>

              <div className="pesanan-more-dropdown-container">
                <button
                  type="button"
                  className="btn-ekspor-dropdown"
                  style={{ height: 42, padding: "0 12px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsActionMenuOpen((prev) => !prev);
                  }}
                  title="Menu Opsi & Ekspor"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: isActionMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>

                {isActionMenuOpen && (
                  <div
                    className="pesanan-more-menu"
                    onClick={(e) => e.stopPropagation()}
                    style={{ zIndex: 9999, minWidth: 210 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        handleExportCSV();
                      }}
                    >
                      <FileSpreadsheet size={15} color="#16A34A" />
                      <span>Ekspor ke CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setPdfOpen(true);
                      }}
                    >
                      <FileText size={15} color="#DC2626" />
                      <span>Ekspor Laporan PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        if (candidatePhotoItems.length > 0) {
                          setCustomLightboxItems(null);
                          setLightboxIndex(0);
                          setLightboxOpen(true);
                        } else {
                          toastError("Belum ada calon anggota yang mengunggah pas foto.");
                        }
                      }}
                    >
                      <Camera size={15} color="#7C3AED" />
                      <span>Galeri Pas Foto ({candidatePhotoItems.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setWaBroadcastModalData({ sub: null, mode: "skrining", tab: "broadcast" });
                      }}
                    >
                      <MessageCircle size={15} color="#25D366" />
                      <span>Broadcast WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setWaBroadcastModalData({ sub: null, mode: "skrining", tab: "settings" });
                      }}
                    >
                      <Settings size={15} color="#2563EB" />
                      <span>Pengaturan Template WA</span>
                    </button>
                    {onOpenQr && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          onOpenQr();
                        }}
                      >
                        <QrCode size={15} color="#D97706" />
                        <span>QR Code & Tautan Publik</span>
                      </button>
                    )}
                    {onAddForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          onAddForm();
                        }}
                      >
                        <Plus size={15} color="#C71920" />
                        <span>Kelola Formulir Baru</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reset Filter Button jika ada filter aktif */}
        {hasActiveFilters && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
          </div>
        )}

        {/* 2. TABEL DAFTAR CALON ANGGOTA (DESKTOP 6 KOLOM & MOBILE 4 KOLOM TANPA OVERFLOW-X) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "2px 4px",
            }}
          >
            <span style={{ fontSize: "12.5px", color: "var(--text-muted, #64748b)" }}>
              Menampilkan <strong style={{ color: "var(--navy-900, #0f172a)" }}>{sorted.length}</strong> dari{" "}
              <strong>{safeSubmissions.length}</strong> total pendaftar
              {filterStatus && (
                <span style={{ marginLeft: 6, fontWeight: 600, color: "#C71920" }}>
                  • Status: {STATUS_CONFIG[filterStatus]?.label.toUpperCase()}
                </span>
              )}
            </span>
          </div>

          <div className="orders-table-container">
            {loading ? (
              <div className="orders-table-wrapper-box">
                <Loading label="Memuat data calon anggota..." />
              </div>
            ) : sorted.length === 0 ? (
              <div className="orders-table-wrapper-box">
                <EmptyState
                  title="Belum Ada Calon Anggota"
                  message="Belum ada pendaftar yang memenuhi kriteria pencarian atau filter saat ini."
                />
              </div>
            ) : (
              <>
                {/* DESKTOP TABLE (>= 768px, 6 KOLOM LENGKAP DENGAN STICKY HEADER) */}
                <div className="orders-table-desktop-view" style={{ maxHeight: "none", overflowY: "visible" }}>
                  <table className="orders-table-minimal">
                    <colgroup>
                      <col style={{ width: "5%" }} />
                      <col style={{ width: "32%" }} />
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "17%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                    </colgroup>

                    <thead>
                      <tr>
                        <th className="th-center">No.</th>
                        <th className="th-left">Nama Calon Anggota</th>
                        <th className="th-left">Pilihan / Posisi</th>
                        <th className="th-center">No. WhatsApp</th>
                        <th className="th-center">Status</th>
                        <th className="th-center">Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sorted.map((s, idx) => {
                        const { nama, hp, pilihan, waUrl, waLolosUrl, rawHp } = getCandidateInfo(s);
                        const isLolos = s.status === "lolos";
                        const targetWa = isLolos ? (waLolosUrl || waUrl) : waUrl;

                        return (
                          <tr
                            key={s.id}
                            className="orders-row-clickable"
                            onClick={() => setDetailOpen(s)}
                          >
                            <td className="td-center order-no-col">
                              <span className="order-no-text">{idx + 1}</span>
                            </td>

                            <td className="td-left">
                              <CandidateAvatarCell
                                submission={s}
                                nama={nama}
                                onAvatarClick={(url, title, fileName) =>
                                  openPhotoLightbox(url, title, fileName, s.id)
                                }
                              />
                            </td>

                            <td className="td-left">
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#334155",
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={pilihan || "-"}
                              >
                                {pilihan || "-"}
                              </div>
                            </td>

                            <td className="td-center">
                              {rawHp ? (
                                <a
                                  href={targetWa || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="wa-table-link"
                                  onClick={(e) => e.stopPropagation()}
                                  title={`Hubungi ${nama} via WhatsApp (${hp})`}
                                >
                                  <MessageCircle size={13} className="wa-icon" />
                                  <span>{hp}</span>
                                </a>
                              ) : (
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>-</span>
                              )}
                            </td>

                            <td className="td-center">
                              <span
                                className={`order-status-badge status-${s.status}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStatusChange(s);
                                }}
                                style={{ cursor: "pointer" }}
                                title="Klik untuk mengubah status seleksi"
                              >
                                {STATUS_CONFIG[s.status]?.label || s.status}
                              </span>
                            </td>

                            <td className="td-center">
                              <div
                                className="orders-action-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ActionDropdown
                                  variant="minimal"
                                  style={{ width: 68, height: 30 }}
                                  items={[
                                    ...(s.status === "tidak_lolos"
                                      ? [
                                          {
                                            label: "Kirim WA Tidak Lolos",
                                            icon: <MessageCircle size={13} style={{ color: "#DC2626" }} />,
                                            onClick: () => handleOpenWaTidakLolos(s),
                                          },
                                        ]
                                      : []),
                                    {
                                      label: "Download PDF",
                                      icon: <Download size={13} />,
                                      onClick: () => handleDownloadDetailPdf(s),
                                    },
                                    {
                                      label: "Hapus",
                                      icon: <Trash2 size={13} />,
                                      onClick: () => setDeleteOpen(s),
                                      danger: true,
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE TABLE (< 768px, 4 KOLOM PRIORITAS TANPA SCROLLBAR HORIZONTAL) */}
                <div className="orders-table-mobile-view" style={{ maxHeight: "none", overflowY: "visible" }}>
                  <table className="orders-table-mobile-compact">
                    <colgroup>
                      <col style={{ width: "26px" }} />
                      <col style={{ width: "auto" }} />
                      <col style={{ width: "62px" }} />
                      <col style={{ width: "44px" }} />
                    </colgroup>

                    <thead>
                      <tr>
                        <th className="th-mobile-no">No.</th>
                        <th className="th-mobile-cust">Calon Anggota</th>
                        <th className="th-mobile-status">Status</th>
                        <th style={{ textAlign: "center", fontSize: 11, fontWeight: 600, padding: "8px 4px" }}>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sorted.map((s, idx) => {
                        const { nama, pilihan } = getCandidateInfo(s);

                        return (
                          <tr
                            key={s.id}
                            className="orders-mobile-row"
                            onClick={() => setDetailOpen(s)}
                          >
                            <td className="td-mobile-no">
                              <span>{idx + 1}</span>
                            </td>

                            <td className="td-mobile-cust">
                              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                <span
                                  className="mobile-customer-name"
                                  title={nama}
                                  style={{ fontSize: "12px", fontWeight: 600, color: "#0F172A" }}
                                >
                                  {nama}
                                </span>
                                <span
                                  style={{
                                    fontSize: "10.5px",
                                    color: "#64748B",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    marginTop: "1px",
                                  }}
                                  title={pilihan}
                                >
                                  {pilihan || "-"}
                                </span>
                              </div>
                            </td>

                            <td
                              className="td-mobile-status"
                              style={{ textAlign: "center", padding: "6px 2px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openStatusChange(s);
                              }}
                            >
                              <span
                                className={`order-status-badge compact status-${s.status}`}
                                title="Klik untuk mengubah status seleksi"
                              >
                                {STATUS_CONFIG[s.status]?.label || s.status}
                              </span>
                            </td>

                            <td style={{ textAlign: "center", padding: "4px 2px" }} onClick={(e) => e.stopPropagation()}>
                              <ActionDropdown
                                variant="minimal"
                                style={{ width: 44, height: 26, fontSize: "11px", padding: "0 4px" }}
                                items={[
                                  ...(s.status === "tidak_lolos"
                                    ? [
                                        {
                                          label: "Kirim WA Tidak Lolos",
                                          icon: <MessageCircle size={12} style={{ color: "#DC2626" }} />,
                                          onClick: () => handleOpenWaTidakLolos(s),
                                        },
                                      ]
                                    : []),
                                  {
                                    label: "Download PDF",
                                    icon: <Download size={12} />,
                                    onClick: () => handleDownloadDetailPdf(s),
                                  },
                                  {
                                    label: "Hapus",
                                    icon: <Trash2 size={12} />,
                                    onClick: () => setDeleteOpen(s),
                                    danger: true,
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL MODAL CALON ANGGOTA & BERKAS LENGKAP (ORDER-DETAIL STYLE) */}
      {detailOpen &&
        createPortal(
          <div className="order-detail-overlay" onClick={() => setDetailOpen(null)}>
            <div
              className="order-detail-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Detail Calon Anggota"
            >
              {(() => {
                const {
                  nama,
                  namaPanggilan,
                  hp,
                  rawHp,
                  pilihan,
                  waLolosUrl,
                  pesanLolos,
                  waTidakLolosUrl,
                  pesanTidakLolos,
                } = getCandidateInfo(detailOpen);
                const statusBadge =
                  STATUS_BADGE_MAP[detailOpen.status] || {
                    label: detailOpen.status,
                    className: "badge-neutral",
                  };
                const photoInfo = extractCandidatePhotoInfo(detailOpen.answers);
                const { dataPribadi, pilihanMusik, lainnya } =
                  categorizeCandidateAnswers(detailOpen.answers);
                const candidateInitial = (nama || "C").trim().charAt(0).toUpperCase();

                return (
                  <>
                    {/* 1. HEADER MODAL */}
                    <div className="order-detail-header">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: "#FEF2F2",
                            color: "#DC1717",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Users size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
                              Profil Calon Anggota
                            </h3>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "#F1F5F9",
                                color: "#334155",
                                fontFamily: "monospace",
                              }}
                            >
                              #{detailOpen.id.substring(0, 8)}
                            </span>
                            <span
                              className={`status-pill status-${detailOpen.status}`}
                              style={{
                                textTransform: "uppercase",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                              }}
                            >
                              {statusBadge.label}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: "#64748B", display: "block" }}>
                            Pusat evaluasi calon pendaftar, berkas lampiran, status seleksi, dan komunikasi WhatsApp
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => setDetailOpen(null)}
                        aria-label="Tutup modal"
                        style={{
                          background: "#F1F5F9",
                          border: "none",
                          borderRadius: 8,
                          width: 32,
                          height: 32,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#64748B",
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* 2. SUBHEADER: DUA TAB UTAMA */}
                    <div className="order-detail-nav-tabs">
                      <button
                        type="button"
                        className={`order-detail-tab-btn ${detailTab === "detail" ? "active" : ""}`}
                        onClick={() => setDetailTab("detail")}
                      >
                        <FileText size={16} />
                        <span>Profil &amp; Berkas Calon</span>
                      </button>
                      <button
                        type="button"
                        className={`order-detail-tab-btn ${detailTab === "whatsapp" ? "active" : ""}`}
                        onClick={() => setDetailTab("whatsapp")}
                      >
                        <MessageCircle size={16} />
                        <span>Kirim Pesan WhatsApp</span>
                      </button>
                    </div>

                    {/* 3. MODAL BODY */}
                    <div className="order-detail-body">
                      {detailTab === "detail" ? (
                        /* ============================================================
                           TAB 1: PROFIL & BERKAS LENGKAP CALON
                           ============================================================ */
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {/* A. KARTU INFORMASI CALON ANGGOTA */}
                          <div
                            style={{
                              background: "#FFFFFF",
                              borderRadius: 12,
                              padding: "16px 18px",
                              border: "1px solid #E2E8F0",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                              <User size={16} style={{ color: "#DC1717" }} />
                              <span
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  color: "#0F172A",
                                  letterSpacing: "0.3px",
                                  textTransform: "uppercase",
                                }}
                              >
                                Informasi Calon Anggota
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 16,
                                  flexWrap: "wrap",
                                  background: "#F8FAFC",
                                  padding: "14px 16px",
                                  borderRadius: 10,
                                  border: "1px solid #F1F5F9",
                                }}
                              >
                                {photoInfo.url ? (
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                    <img
                                      src={photoInfo.url}
                                      alt={nama}
                                      onClick={() => openPhotoLightbox(photoInfo.url!, `Pas Foto: ${nama}`, photoInfo.fileName || undefined)}
                                      style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 10,
                                        objectFit: "cover",
                                        border: "2px solid #E2E8F0",
                                        cursor: "pointer",
                                      }}
                                      title="Klik untuk memperbesar foto"
                                    />
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button
                                        type="button"
                                        onClick={() => openPhotoLightbox(photoInfo.url!, `Pas Foto: ${nama}`, photoInfo.fileName || undefined, detailOpen.id)}
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: 11,
                                          borderRadius: 4,
                                          border: "1px solid #CBD5E1",
                                          background: "#FFFFFF",
                                          color: "#334155",
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 3,
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Maximize2 size={11} /> Lihat
                                      </button>
                                      {photoInfo.answerId && (
                                        <label
                                          style={{
                                            padding: "3px 8px",
                                            fontSize: 11,
                                            borderRadius: 4,
                                            border: "1px solid #FCA5A5",
                                            background: "#FEF2F2",
                                            color: "#B91C1C",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 3,
                                            fontWeight: 600,
                                          }}
                                          title="Ganti foto calon"
                                        >
                                          <Camera size={11} /> Ganti
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
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                    <div
                                      style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 10,
                                        background: "#E2E8F0",
                                        color: "#475569",
                                        fontWeight: 800,
                                        fontSize: 26,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {candidateInitial}
                                    </div>
                                    {photoInfo.answerId && (
                                      <label
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: 11,
                                          borderRadius: 4,
                                          border: "1px solid #CBD5E1",
                                          background: "#FFFFFF",
                                          color: "#334155",
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 3,
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Camera size={11} /> Unggah
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

                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <h4 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                                    {nama}
                                  </h4>
                                  {namaPanggilan && namaPanggilan !== "-" && (
                                    <span style={{ fontSize: 12, color: "#64748B", display: "block", marginBottom: 6 }}>
                                      Nama Panggilan: <strong>{namaPanggilan}</strong>
                                    </span>
                                  )}
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: "3px 10px",
                                        borderRadius: 6,
                                        background: "#EFF6FF",
                                        color: "#1E40AF",
                                        border: "1px solid #DBEAFE",
                                      }}
                                    >
                                      Instrumen: {pilihan}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: "#64748B",
                                      }}
                                    >
                                      Mendaftar pada: {formatTanggalPanjang(detailOpen.submittedAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                  gap: 12,
                                }}
                              >
                                <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                                  <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 2 }}>ID Pendaftaran</span>
                                  <strong style={{ fontSize: 13.5, color: "#0F172A", fontFamily: "monospace" }}>{detailOpen.id}</strong>
                                </div>

                                <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                                  <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 2 }}>Kontak WhatsApp</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <strong style={{ fontSize: 13.5, color: "#0F172A" }}>{hp || rawHp || "-"}</strong>
                                    {(hp || rawHp) && (
                                      <button
                                        type="button"
                                        onClick={handleCopyDetailCandidateHp}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          padding: 2,
                                          cursor: "pointer",
                                          color: copiedDetailHp ? "#16A34A" : "#64748B",
                                        }}
                                        title="Salin nomor WhatsApp"
                                      >
                                        {copiedDetailHp ? <Check size={14} /> : <Copy size={14} />}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                                  <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 2 }}>Status Seleksi Saat Ini</span>
                                  <span
                                    className={`status-pill status-${detailOpen.status}`}
                                    style={{
                                      textTransform: "uppercase",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "3px 10px",
                                      borderRadius: 6,
                                      display: "inline-block",
                                    }}
                                  >
                                    {statusBadge.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* B. KARTU KEPUTUSAN STATUS SELEKSI & CATATAN */}
                          <div
                            style={{
                              background: "#FFFFFF",
                              borderRadius: 12,
                              padding: "18px 20px",
                              border: "1px solid #E2E8F0",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 16,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <CheckCircle size={16} style={{ color: "#DC1717" }} />
                                <span
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: "#0F172A",
                                    letterSpacing: "0.3px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Keputusan Status Seleksi &amp; Catatan Reviewer
                                </span>
                              </div>
                              <span style={{ fontSize: 11.5, color: "#64748B" }}>
                                Pilih status lalu klik simpan untuk memperbarui database
                              </span>
                            </div>

                            {/* 4 Status Seleksi Buttons */}
                            <div>
                              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                                Tentukan Status Hasil Seleksi:
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                                {(["menunggu", "lolos", "cadangan", "tidak_lolos"] as RekrutmenSubmissionStatus[]).map((st) => {
                                  const conf = STATUS_CONFIG[st];
                                  const Icon = conf.icon;
                                  const active = detailStatus === st;
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => setDetailStatus(st)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 7,
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: active ? `2px solid ${conf.color}` : "1px solid #E2E8F0",
                                        background: active ? conf.bg : "#FFFFFF",
                                        color: conf.color,
                                        fontWeight: active ? 700 : 500,
                                        fontSize: 12.5,
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                      }}
                                    >
                                      <Icon size={15} />
                                      <span>{conf.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Catatan Reviewer */}
                            <div>
                              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                                Catatan Reviewer / Alasan Keputusan (Opsional)
                              </label>
                              <textarea
                                rows={3}
                                value={detailNote}
                                onChange={(e) => setDetailNote(e.target.value)}
                                placeholder="Tuliskan catatan teknis hasil penilaian seleksi calon pendaftar..."
                                style={{
                                  width: "100%",
                                  fontSize: 13,
                                  padding: "10px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #CBD5E1",
                                  background: "#F8FAFC",
                                  color: "#0F172A",
                                  outline: "none",
                                  boxSizing: "border-box",
                                  resize: "vertical",
                                }}
                              />
                            </div>

                            {/* OPSI NOTIFIKASI WA UNTUK STATUS LOLOS */}
                            {detailStatus === "lolos" && (
                              <div
                                style={{
                                  padding: 14,
                                  borderRadius: 10,
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
                                        background: "#10B981",
                                        color: "#FFFFFF",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <MessageCircle size={16} />
                                    </div>
                                    <div>
                                      <strong style={{ fontSize: 13, color: "#065F46", display: "block" }}>
                                        Opsi Pengumuman Lolos via WhatsApp
                                      </strong>
                                      <span style={{ fontSize: 11.5, color: "#047857" }}>
                                        Tujuan: {hp || rawHp || "Nomor belum terdeteksi"}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(pesanLolos, "Format Pesan Pengumuman Lolos")}
                                      style={{
                                        fontSize: 11.5,
                                        padding: "4px 8px",
                                        background: "#FFFFFF",
                                        border: "1px solid #D1FAE5",
                                        color: "#065F46",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <Copy size={12} /> Salin Pesan
                                    </button>
                                    {waLolosUrl && (
                                      <a
                                        href={waLolosUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: 11.5,
                                          padding: "4px 9px",
                                          background: "#059669",
                                          color: "#FFFFFF",
                                          textDecoration: "none",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          borderRadius: 6,
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Send size={12} /> Buka WA
                                      </a>
                                    )}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 10px",
                                    background: "rgba(16, 185, 129, 0.12)",
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    color: "#065F46",
                                    fontWeight: 600,
                                  }}
                                >
                                  <Sparkles size={13} style={{ color: "#059669", flexShrink: 0 }} />
                                  <span>Ketentuan resmi: Wajib mengikuti training &amp; 3x penampilan Chondro Wonopringgo</span>
                                </div>

                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 12.5,
                                    color: "#064E3B",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    userSelect: "none",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={detailSendWaLolos}
                                    onChange={(e) => setDetailSendWaLolos(e.target.checked)}
                                    style={{ cursor: "pointer", accentColor: "#059669", width: 16, height: 16 }}
                                  />
                                  Buka WhatsApp otomatis untuk kirim pengumuman setelah tombol simpan diklik
                                </label>
                              </div>
                            )}

                            {/* OPSI NOTIFIKASI WA UNTUK STATUS TIDAK LOLOS (BAHASA SANTUN) */}
                            {detailStatus === "tidak_lolos" && (
                              <div
                                style={{
                                  padding: 14,
                                  borderRadius: 10,
                                  background: "linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0%, rgba(185, 28, 28, 0.04) 100%)",
                                  border: "1px solid rgba(220, 38, 38, 0.35)",
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
                                        background: "#DC2626",
                                        color: "#FFFFFF",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <MessageCircle size={16} />
                                    </div>
                                    <div>
                                      <strong style={{ fontSize: 13, color: "#991B1B", display: "block" }}>
                                        Opsi Pemberitahuan Tidak Lolos via WhatsApp
                                      </strong>
                                      <span style={{ fontSize: 11.5, color: "#B91C1C" }}>
                                        Tujuan: {hp || rawHp || "Nomor belum terdeteksi"}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(pesanTidakLolos, "Format Pesan Pemberitahuan Tidak Lolos")}
                                      style={{
                                        fontSize: 11.5,
                                        padding: "4px 8px",
                                        background: "#FFFFFF",
                                        border: "1px solid #FECACA",
                                        color: "#991B1B",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <Copy size={12} /> Salin Pesan
                                    </button>
                                    {waTidakLolosUrl && (
                                      <a
                                        href={waTidakLolosUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: 11.5,
                                          padding: "4px 9px",
                                          background: "#DC2626",
                                          color: "#FFFFFF",
                                          textDecoration: "none",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          borderRadius: 6,
                                          fontWeight: 600,
                                        }}
                                      >
                                        <Send size={12} /> Buka WA
                                      </a>
                                    )}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 10px",
                                    background: "rgba(220, 38, 38, 0.12)",
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    color: "#991B1B",
                                    fontWeight: 600,
                                  }}
                                >
                                  <Sparkles size={13} style={{ color: "#DC2626", flexShrink: 0 }} />
                                  <span>Bahasa santun &amp; apresiatif: Mengapresiasi dedikasi, menerangkan kuota terbatas, dan memotivasi</span>
                                </div>

                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 12.5,
                                    color: "#7F1D1D",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    userSelect: "none",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={detailSendWaTidakLolos}
                                    onChange={(e) => setDetailSendWaTidakLolos(e.target.checked)}
                                    style={{ cursor: "pointer", accentColor: "#DC2626", width: 16, height: 16 }}
                                  />
                                  Buka WhatsApp otomatis untuk kirim pemberitahuan santun setelah tombol simpan diklik
                                </label>
                              </div>
                            )}

                            {/* Tombol Simpan Perubahan Status */}
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                disabled={detailSavingStatus}
                                onClick={handleDetailSaveStatus}
                                style={{
                                  background: "#DC1717",
                                  color: "#FFFFFF",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "9px 18px",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: detailSavingStatus ? "not-allowed" : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  boxShadow: "0 2px 6px rgba(220, 23, 23, 0.25)",
                                }}
                              >
                                {detailSavingStatus ? (
                                  <Loader2 size={15} className="spinning" />
                                ) : (
                                  <Check size={15} />
                                )}
                                <span>Simpan Status Seleksi</span>
                              </button>
                            </div>
                          </div>

                          {/* C. KARTU PILIHAN ALAT & MINAT MUSIK */}
                          {pilihanMusik.length > 0 && (
                            <div
                              style={{
                                background: "#FFFFFF",
                                borderRadius: 12,
                                padding: "16px 18px",
                                border: "1px solid #E2E8F0",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <Sparkles size={16} style={{ color: "#DC1717" }} />
                                <span
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: "#0F172A",
                                    letterSpacing: "0.3px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Pilihan Alat &amp; Minat Musik
                                </span>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                                {pilihanMusik.map((ans, mIdx) => (
                                  <div
                                    key={ans.id || mIdx}
                                    style={{
                                      padding: "10px 14px",
                                      background: "#FFF9F9",
                                      borderRadius: 8,
                                      border: "1px solid #FEE2E2",
                                    }}
                                  >
                                    <span style={{ fontSize: 11.5, color: "#B91C1C", fontWeight: 600, display: "block", marginBottom: 3 }}>
                                      {ans.field?.label || "Pertanyaan Musik"}
                                    </span>
                                    <strong style={{ fontSize: 13, color: "#0F172A", display: "block" }}>
                                      {ans.value || <span style={{ color: "#94A3B8", fontWeight: 400 }}>-</span>}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* D. KARTU DATA PRIBADI & KONTAK */}
                          {dataPribadi.length > 0 && (
                            <div
                              style={{
                                background: "#FFFFFF",
                                borderRadius: 12,
                                padding: "16px 18px",
                                border: "1px solid #E2E8F0",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <Users size={16} style={{ color: "#DC1717" }} />
                                <span
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: "#0F172A",
                                    letterSpacing: "0.3px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Data Pribadi &amp; Kontak Calon
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                                  gap: 10,
                                }}
                              >
                                {dataPribadi.map((ans, pIdx) => (
                                  <div
                                    key={ans.id || pIdx}
                                    style={{
                                      padding: "10px 14px",
                                      background: "#F8FAFC",
                                      borderRadius: 8,
                                      border: "1px solid #F1F5F9",
                                    }}
                                  >
                                    <span style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 3 }}>
                                      {ans.field?.label || "Data"}
                                    </span>
                                    <strong style={{ fontSize: 13, color: "#0F172A", display: "block", wordBreak: "break-word" }}>
                                      {ans.value || <span style={{ color: "#94A3B8", fontWeight: 400 }}>-</span>}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* E. KARTU INFORMASI TAMBAHAN LAINNYA */}
                          {lainnya.length > 0 && (
                            <div
                              style={{
                                background: "#FFFFFF",
                                borderRadius: 12,
                                padding: "16px 18px",
                                border: "1px solid #E2E8F0",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <FileText size={16} style={{ color: "#DC1717" }} />
                                <span
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color: "#0F172A",
                                    letterSpacing: "0.3px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Informasi Tambahan Lainnya
                                </span>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                                {lainnya.map((ans, lIdx) => (
                                  <div
                                    key={ans.id || lIdx}
                                    style={{
                                      padding: "10px 14px",
                                      background: "#F8FAFC",
                                      borderRadius: 8,
                                      border: "1px solid #F1F5F9",
                                    }}
                                  >
                                    <span style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 3 }}>
                                      {ans.field?.label || "Pertanyaan"}
                                    </span>
                                    <strong style={{ fontSize: 13, color: "#0F172A", display: "block", wordBreak: "break-word" }}>
                                      {ans.value || <span style={{ color: "#94A3B8", fontWeight: 400 }}>-</span>}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* ============================================================
                           TAB 2: KIRIM PESAN WHATSAPP (ORDER-DETAIL STYLE)
                           ============================================================ */
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          {/* A. HEADER RINGKASAN CALON ANGGOTA */}
                          <div
                            style={{
                              background: "#FFFFFF",
                              borderRadius: 12,
                              padding: "16px 18px",
                              border: "1px solid #E2E8F0",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 12,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 10,
                                  background: "#22C55E",
                                  color: "#FFFFFF",
                                  fontWeight: 800,
                                  fontSize: 18,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {candidateInitial}
                              </div>
                              <div>
                                <strong style={{ fontSize: 15, color: "#0F172A", display: "block" }}>
                                  {nama}
                                </strong>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                  <span style={{ fontSize: 12, color: "#64748B" }}>
                                    WhatsApp: {hp || rawHp || "Tidak tersedia"}
                                  </span>
                                  {(hp || rawHp) && (
                                    <button
                                      type="button"
                                      onClick={handleCopyDetailCandidateHp}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        padding: 1,
                                        cursor: "pointer",
                                        color: copiedDetailHp ? "#16A34A" : "#64748B",
                                      }}
                                      title="Salin nomor"
                                    >
                                      {copiedDetailHp ? <Check size={13} /> : <Copy size={13} />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: 11.5, color: "#64748B", display: "block" }}>Pilihan / Posisi Calon</span>
                              <strong style={{ fontSize: 13.5, color: "#0F172A" }}>
                                {pilihan}
                              </strong>
                            </div>
                          </div>

                          {/* B. PILIHAN JENIS PESAN & PENGATURAN TEMPLATE */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 10,
                            }}
                          >
                            {/* 4 PILIHAN JENIS PESAN */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, flex: 1 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailWaType("skrining");
                                  setIsDetailWaDirty(false);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  padding: "9px 12px",
                                  borderRadius: 8,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: detailWaType === "skrining" ? "2px solid #2563EB" : "1px solid #CBD5E1",
                                  background: detailWaType === "skrining" ? "#EFF6FF" : "#FFFFFF",
                                  color: detailWaType === "skrining" ? "#1E40AF" : "#475569",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>📅 Skrining / Audisi</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDetailWaType("lolos");
                                  setIsDetailWaDirty(false);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  padding: "9px 12px",
                                  borderRadius: 8,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: detailWaType === "lolos" ? "2px solid #059669" : "1px solid #CBD5E1",
                                  background: detailWaType === "lolos" ? "#ECFDF5" : "#FFFFFF",
                                  color: detailWaType === "lolos" ? "#065F46" : "#475569",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>🎉 Pengumuman Lolos</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDetailWaType("tidak_lolos");
                                  setIsDetailWaDirty(false);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  padding: "9px 12px",
                                  borderRadius: 8,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: detailWaType === "tidak_lolos" ? "2px solid #DC2626" : "1px solid #CBD5E1",
                                  background: detailWaType === "tidak_lolos" ? "#FEF2F2" : "#FFFFFF",
                                  color: detailWaType === "tidak_lolos" ? "#991B1B" : "#475569",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>💌 Tidak Lolos (Santun)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDetailWaType("general");
                                  setIsDetailWaDirty(false);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  padding: "9px 12px",
                                  borderRadius: 8,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  border: detailWaType === "general" ? "2px solid #D97706" : "1px solid #CBD5E1",
                                  background: detailWaType === "general" ? "#FFFBEB" : "#FFFFFF",
                                  color: detailWaType === "general" ? "#92400E" : "#475569",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span>💬 Pesan Umum / Info</span>
                              </button>
                            </div>

                            {/* TOMBOL PENGATURAN TEMPLATE */}
                            <button
                              type="button"
                              onClick={() => {
                                setWaBroadcastModalData({
                                  sub: detailOpen,
                                  mode: detailWaType,
                                  tab: "settings",
                                });
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 14px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 600,
                                background: "#FFFFFF",
                                border: "1px solid #CBD5E1",
                                color: "#334155",
                                cursor: "pointer",
                              }}
                              title="Atur template pesan & lokasi bawaan rekrutmen"
                            >
                              <Settings size={14} />
                              <span>Pengaturan Template</span>
                            </button>
                          </div>

                          {/* C. PENGATURAN LOKASI & JADWAL DINAMIS */}
                          {detailWaType !== "tidak_lolos" && (
                            <div
                              style={{
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                borderRadius: 10,
                                padding: 14,
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                                📍 Penyesuaian Lokasi &amp; Waktu ({detailWaType === "skrining" ? "Skrining / Audisi" : "Training Perdana"})
                              </span>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                                <div>
                                  <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 3 }}>
                                    Nama Tempat
                                  </label>
                                  <input
                                    type="text"
                                    value={detailOverrideTempat}
                                    onChange={(e) => setDetailOverrideTempat(e.target.value)}
                                    placeholder="Basecamp MB Chondro..."
                                    style={{
                                      width: "100%",
                                      fontSize: 12.5,
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      border: "1px solid #CBD5E1",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 3 }}>
                                    Titik GMaps (Link)
                                  </label>
                                  <input
                                    type="text"
                                    value={detailOverrideGmaps}
                                    onChange={(e) => setDetailOverrideGmaps(e.target.value)}
                                    placeholder="https://maps.app.goo.gl/..."
                                    style={{
                                      width: "100%",
                                      fontSize: 12.5,
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      border: "1px solid #CBD5E1",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 3 }}>
                                    Tanggal &amp; Waktu
                                  </label>
                                  <input
                                    type="text"
                                    value={detailOverrideWaktu}
                                    onChange={(e) => setDetailOverrideWaktu(e.target.value)}
                                    placeholder="Sabtu, 15 Oktober 2026..."
                                    style={{
                                      width: "100%",
                                      fontSize: 12.5,
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      border: "1px solid #CBD5E1",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* D. PREVIEW & EDITOR PESAN WHATSAPP */}
                          <div
                            style={{
                              background: "#FFFFFF",
                              borderRadius: 12,
                              padding: 18,
                              border: "1px solid #E2E8F0",
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <MessageCircle size={16} style={{ color: "#22C55E" }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                                  Preview Pesan WhatsApp (Dapat Diedit)
                                </span>
                              </div>
                              {isDetailWaDirty && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsDetailWaDirty(false);
                                    setDetailWaMessage(generatedDetailWaTemplate);
                                    toastSuccess("Pesan telah direset ke template bawaan.");
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#DC1717",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <RotateCcw size={12} /> Reset Template
                                </button>
                              )}
                            </div>

                            <textarea
                              rows={11}
                              value={detailWaMessage}
                              onChange={(e) => {
                                setDetailWaMessage(e.target.value);
                                setIsDetailWaDirty(true);
                              }}
                              placeholder="Ketik atau edit pesan WhatsApp di sini..."
                              style={{
                                width: "100%",
                                fontSize: 13,
                                padding: "12px 14px",
                                borderRadius: 8,
                                border: "1px solid #CBD5E1",
                                background: "#F8FAFC",
                                color: "#0F172A",
                                lineHeight: 1.5,
                                fontFamily: "inherit",
                                outline: "none",
                                boxSizing: "border-box",
                                resize: "vertical",
                              }}
                            />

                            {/* ACTION BUTTONS: SALIN & KIRIM KE WHATSAPP */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 10,
                                paddingTop: 4,
                              }}
                            >
                              <button
                                type="button"
                                onClick={handleCopyDetailWaMessage}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "9px 18px",
                                  borderRadius: 8,
                                  border: "1px solid #CBD5E1",
                                  background: "#FFFFFF",
                                  color: "#334155",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                {copiedDetailWa ? (
                                  <Check size={14} style={{ color: "#16A34A" }} />
                                ) : (
                                  <Copy size={14} />
                                )}
                                <span>{copiedDetailWa ? "Tersalin!" : "Salin Pesan"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={handleSendDetailWa}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "9px 22px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: "#22C55E",
                                  color: "#FFFFFF",
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  boxShadow: "0 2px 6px rgba(34, 197, 94, 0.3)",
                                }}
                              >
                                <Send size={15} />
                                <span>Kirim ke WhatsApp</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. MODAL FOOTER */}
                    <div className="order-detail-footer">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setDetailOpen(null)}
                      >
                        Tutup
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleDownloadDetailPdf(detailOpen)}
                        >
                          <Download size={15} />
                          <span>Unduh PDF Lembar Calon</span>
                        </button>

                        {detailTab === "detail" ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setDetailTab("whatsapp")}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <MessageCircle size={15} />
                            <span>Beralih ke WhatsApp</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendDetailWa}
                            style={{
                              background: "#22C55E",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 18px",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Send size={14} />
                            <span>Buka WhatsApp Sekarang</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

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

              {/* OPSI & PRATINJAU PENGUMUMAN WHATSAPP UNTUK STATUS TIDAK LOLOS (BAHASA SANTUN) */}
              {selectedStatus === "tidak_lolos" && (() => {
                const { hp, waTidakLolosUrl, pesanTidakLolos } = getCandidateInfo(statusModalSub);
                return (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0%, rgba(185, 28, 28, 0.04) 100%)",
                      border: "1px solid rgba(220, 38, 38, 0.35)",
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
                            background: "#dc2626",
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
                          <strong style={{ fontSize: "13px", color: "#991b1b", display: "block" }}>
                            Opsi Pemberitahuan Tidak Lolos via WhatsApp
                          </strong>
                          <span style={{ fontSize: "11.5px", color: "#b91c1c" }}>
                            Tujuan: {hp || "Nomor belum terdeteksi"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(pesanTidakLolos, "Format Pesan Pemberitahuan Tidak Lolos")}
                          className="btn btn-ghost btn-sm"
                          style={{
                            fontSize: "11.5px",
                            padding: "4px 8px",
                            background: "#ffffff",
                            border: "1px solid #fecaca",
                            color: "#991b1b",
                          }}
                          title="Salin teks pesan ke clipboard"
                        >
                          <Copy size={12} /> Salin Pesan
                        </button>

                        {waTidakLolosUrl && (
                          <a
                            href={waTidakLolosUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{
                              fontSize: "11.5px",
                              padding: "4px 9px",
                              background: "#dc2626",
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

                    {/* Santun & Apresiatif Highlight Tag */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        background: "rgba(220, 38, 38, 0.12)",
                        borderRadius: 6,
                        fontSize: "11.5px",
                        color: "#991b1b",
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
                      <span>Bahasa santun &amp; apresiatif: Mengapresiasi dedikasi, menerangkan kuota terbatas, dan memotivasi</span>
                    </div>

                    {/* Checkbox Auto-Open WA */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: "12.5px",
                        color: "#7f1d1d",
                        fontWeight: 600,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sendWaOnTidakLolosSave}
                        onChange={(e) => setSendWaOnTidakLolosSave(e.target.checked)}
                        style={{ cursor: "pointer", accentColor: "#dc2626", width: 16, height: 16 }}
                      />
                      Buka WhatsApp otomatis untuk kirim pemberitahuan santun setelah tombol simpan diklik
                    </label>

                    {/* Preview Box */}
                    <div
                      style={{
                        background: "#ffffff",
                        border: "1px solid #fecaca",
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
                      {pesanTidakLolos}
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

      {/* MODAL PREVIEW WHATSAPP KHUSUS CALON ANGGOTA TIDAK LOLOS SELEKSI */}
      <Modal
        open={waTidakLolosPreviewSub !== null}
        title="Kirim WhatsApp Calon Tidak Lolos"
        onClose={() => setWaTidakLolosPreviewSub(null)}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWaTidakLolosPreviewSub(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopyWaTidakLolosDirect}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {copiedWaTidakLolos ? (
                <Check size={14} style={{ color: "#16A34A" }} />
              ) : (
                <Copy size={14} />
              )}
              <span>{copiedWaTidakLolos ? "Tersalin!" : "Salin Pesan"}</span>
            </button>
            <button
              type="button"
              onClick={handleSendWaTidakLolosDirect}
              style={{
                background: "#22C55E",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(34, 197, 94, 0.3)",
              }}
            >
              <Send size={14} />
              <span>Kirim via WhatsApp</span>
            </button>
          </>
        }
      >
        {waTidakLolosPreviewSub && (() => {
          const { nama, hp, rawHp, pilihan } = getCandidateInfo(waTidakLolosPreviewSub);
          const cleanNumber = formatNomorWhatsAppUrl(rawHp || hp);

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Header Box Calon */}
              <div
                style={{
                  background: "#F8FAFC",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px", color: "#0F172A", display: "block" }}>
                    {nama}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Posisi / Instrumen: <strong>{pilihan}</strong>
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: cleanNumber ? "#059669" : "#DC2626",
                      fontWeight: 600,
                      background: cleanNumber ? "#ECFDF5" : "#FEF2F2",
                      border: cleanNumber ? "1px solid #A7F3D0" : "1px solid #FECACA",
                      padding: "4px 10px",
                      borderRadius: 6,
                      display: "inline-block",
                    }}
                  >
                    WA: {cleanNumber ? `+${cleanNumber}` : (hp || rawHp || "Nomor tidak valid")}
                  </span>
                </div>
              </div>

              {/* Santun & Apresiatif Highlight Tag */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  background: "rgba(220, 38, 38, 0.08)",
                  borderRadius: 8,
                  fontSize: "12px",
                  color: "#991B1B",
                  fontWeight: 600,
                  border: "1px solid rgba(220, 38, 38, 0.2)",
                }}
              >
                <Sparkles size={14} style={{ color: "#DC2626", flexShrink: 0 }} />
                <span>Bahasa santun &amp; apresiatif: Menghargai waktu peserta, menerangkan kuota terbatas, dan memotivasi</span>
              </div>

              {/* Textarea Preview Pesan */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                  Pratinjau Pesan WhatsApp (Dapat Diedit Sebelum Dikirim):
                </label>
                <textarea
                  rows={10}
                  value={waTidakLolosText}
                  onChange={(e) => setWaTidakLolosText(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: "12.5px",
                    lineHeight: "1.5",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#0F172A",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* FULL PHOTO LIGHTBOX MODAL */}
      <PhotoLightboxModal
        isOpen={lightboxOpen}
        items={activeLightboxItems}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={(idx) => setLightboxIndex(idx)}
        onResolveDrivePhoto={handleResolveDrivePhoto}
      />

      {/* WhatsApp Broadcast & Template Settings Modal */}
      <RekrutmenWhatsAppBroadcastModal
        open={Boolean(waBroadcastModalData)}
        onClose={() => setWaBroadcastModalData(null)}
        formTitle={form.title}
        submissions={safeSubmissions}
        initialSubmission={waBroadcastModalData?.sub || null}
        initialMode={waBroadcastModalData?.mode || "skrining"}
        initialTab={waBroadcastModalData?.tab || "broadcast"}
      />
    </>
  );
}