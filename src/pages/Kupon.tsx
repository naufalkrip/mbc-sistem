import { useState, useMemo, useEffect, useRef } from "react";
import {
  Ticket,
  Plus,
  MapPin,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Eye,
  Copy,
  ExternalLink,
  MessageCircle,
  QrCode,
  Share2,
  ToggleLeft,
  ToggleRight,
  Upload,
  Navigation,
  Download,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  getCouponLocationsApi,
  addCouponLocationApi,
  updateCouponLocationApi,
  deleteCouponLocationApi,
  getCouponStatsFromList,
  compressImageToSafeHd,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import { DataTable } from "../components/ui/DataTable";
import type { Column } from "../components/ui/DataTable";
import { SearchBar } from "../components/ui/SearchBar";
import { Filter } from "../components/ui/Filter";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import type { CouponLocation } from "../types";
import { formatNoHp, toWaLink, isValidPhotoUrl } from "../utils/format";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const kuponMarkerIcon = new L.DivIcon({
  html: `<div style="background:#dc2626;color:white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(220,38,38,0.45);border:2px solid white;"><span style="transform:rotate(45deg);font-size:15px;line-height:1;">🎟️</span></div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

interface FormState {
  name: string;
  picName: string;
  whatsapp: string;
  latitude: string;
  longitude: string;
  address: string;
  description: string;
  photoUrl: string;
  status: "aktif" | "nonaktif";
}

const EMPTY_FORM: FormState = {
  name: "",
  picName: "",
  whatsapp: "",
  latitude: "",
  longitude: "",
  address: "",
  description: "",
  photoUrl: "",
  status: "aktif",
};

// Lightbox 100% Fullscreen
function Lightbox({ src, title, onClose }: { src: string; title?: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "#000000",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
        overflow: "hidden",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)",
          zIndex: 10,
        }}
      >
        <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📷</span>
          <span style={{ maxWidth: "70vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title || "Foto Lokasi"}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255, 255, 255, 0.22)",
            border: "1px solid rgba(255, 255, 255, 0.35)",
            color: "#ffffff",
            borderRadius: "50px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          ✕ Tutup
        </button>
      </div>

      <img
        src={src}
        alt={title || "Foto lokasi full"}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: "100vw",
          maxHeight: "100vh",
          objectFit: "contain",
          display: "block",
          userSelect: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 16,
          color: "rgba(255,255,255,0.75)",
          fontSize: "0.8rem",
          background: "rgba(0,0,0,0.6)",
          padding: "6px 14px",
          borderRadius: 20,
          backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}
      >
        Ketuk foto / layar untuk menutup
      </div>
    </div>
  );
}

// ---- Map controller to center view ----
function MapCenterController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
}

// ---- Map click event to pick coordinates ----
function MapClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

export function Kupon() {
  const { success: toastSuccess, error: toastError } = useToast();

  const { data: rawLocations, loading, refresh } = useApi<CouponLocation[]>(
    () => getCouponLocationsApi(false),
    "Gagal memuat data lokasi kupon.",
    CACHE_KEYS.KUPON,
    { pollingInterval: 15000, revalidateOnFocus: true, immediate: true }
  );

  const locations = useMemo(() => rawLocations ?? [], [rawLocations]);
  const stats = useMemo(() => getCouponStatsFromList(locations), [locations]);

  // Filters & State
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CouponLocation | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  // Detail Modal
  const [detailLoc, setDetailLoc] = useState<CouponLocation | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; title: string } | null>(null);

  // Delete Dialog
  const [toDelete, setToDelete] = useState<CouponLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // QR & Share
  const [showQr, setShowQr] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const publicUrl = `${window.location.origin}/kupon`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(publicUrl)}`;

  // Filtered Locations
  const filtered = useMemo(() => {
    let result = locations;
    if (filterStatus !== "semua") {
      result = result.filter((l) => l.status === filterStatus);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.picName.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q) ||
          l.whatsapp.includes(q)
      );
    }
    return result;
  }, [locations, search, filterStatus]);

  // Open Form for Adding
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  };

  // Open Form for Editing
  const openEdit = (loc: CouponLocation) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      picName: loc.picName,
      whatsapp: loc.whatsapp,
      latitude: loc.latitude ? String(loc.latitude) : "",
      longitude: loc.longitude ? String(loc.longitude) : "",
      address: loc.address,
      description: loc.description ?? "",
      photoUrl: loc.photoUrl ?? "",
      status: loc.status,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const setFormField = (field: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((p) => ({ ...p, [field]: "" }));
    }
  };

  // GPS auto detection
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toastError("Browser Anda tidak mendukung deteksi lokasi (GPS).");
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setForm((p) => ({ ...p, latitude: String(lat), longitude: String(lng) }));
        toastSuccess("Titik lokasi GPS Anda berhasil didapatkan!");
      },
      (err) => {
        setDetectingGps(false);
        toastError(`Gagal mengambil titik GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Validate form
  const validateForm = () => {
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = "Nama lokasi penjualan wajib diisi.";
    if (!form.picName.trim()) err.picName = "Nama PIC / penjual wajib diisi.";
    if (!form.whatsapp.trim()) err.whatsapp = "Nomor WhatsApp wajib diisi.";

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!form.latitude.trim() || isNaN(lat) || lat < -90 || lat > 90) {
      err.latitude = "Latitude tidak valid (antara -90 s/d 90).";
    }
    if (!form.longitude.trim() || isNaN(lng) || lng < -180 || lng > 180) {
      err.longitude = "Longitude tidak valid (antara -180 s/d 180).";
    }
    if (!form.address.trim()) err.address = "Alamat lengkap outlet/lokasi wajib diisi.";

    return err;
  };

  // Save (Create or Update)
  const handleSubmitForm = async () => {
    const err = validateForm();
    if (Object.keys(err).length > 0) {
      setFormErrors(err);
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      picName: form.picName.trim(),
      whatsapp: form.whatsapp.trim(),
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      address: form.address.trim(),
      description: form.description.trim(),
      photoUrl: form.photoUrl,
      status: form.status,
    };

    const res = editing
      ? await updateCouponLocationApi({ ...payload, id: editing.id })
      : await addCouponLocationApi(payload);

    setSaving(false);

    if (res.success) {
      toastSuccess(editing ? "Lokasi penjualan berhasil diperbarui." : "Lokasi penjualan baru berhasil ditambahkan.");
      setFormOpen(false);
      setEditing(null);
      void refresh(true);
    } else {
      toastError((res as { success: false; message: string }).message ?? "Gagal menyimpan lokasi kupon.");
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await deleteCouponLocationApi(toDelete.id);
    setDeleting(false);

    if (res.success) {
      toastSuccess(`Lokasi "${toDelete.name}" berhasil dihapus.`);
      setToDelete(null);
      if (detailLoc?.id === toDelete.id) setDetailLoc(null);
      void refresh(true);
    } else {
      toastError((res as { success: false; message: string }).message ?? "Gagal menghapus lokasi.");
    }
  };

  // Toggle Status
  const handleToggleStatus = async (loc: CouponLocation, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: "aktif" | "nonaktif" = loc.status === "aktif" ? "nonaktif" : "aktif";
    const res = await updateCouponLocationApi({ ...loc, status: newStatus });
    if (res.success) {
      toastSuccess(`Status lokasi ${loc.name} diubah menjadi ${newStatus}.`);
      void refresh(true);
    } else {
      toastError("Gagal memperbarui status lokasi.");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
    toastSuccess("Link peta penjualan kupon berhasil disalin!");
  };

  const shareWa = () => {
    const text = `🎟️ *Lokasi Penjualan Kupon Jalan Sehat MB Chondro*\n\nBuka tautan berikut untuk melihat seluruh titik penjualan tiket/kupon terdekat melalui peta interaktif:\n👉 ${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Preview coordinates for map
  const pLat = parseFloat(form.latitude);
  const pLng = parseFloat(form.longitude);
  const isValidCoord = !isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0;

  // Table Columns
  const columns: Column<CouponLocation>[] = [
    {
      key: "no",
      header: "No",
      render: (_r, idx) => <>{idx + 1}</>,
    },
    {
      key: "name",
      header: "Lokasi Penjualan",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {r.photoUrl && isValidPhotoUrl(r.photoUrl) ? (
            <img
              src={r.photoUrl}
              alt={r.name}
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm, 8px)",
                objectFit: "cover",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-sm, 8px)",
                background: "var(--primary-50, #fee2e2)",
                color: "var(--primary-700, #b91c1c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid var(--primary-100, #fecaca)",
              }}
            >
              <Ticket size={22} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{r.name}</span>
            <span
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 260,
              }}
              title={r.address}
            >
              {r.address}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "picName",
      header: "PIC / Penjual",
      render: (r) => <span>{r.picName}</span>,
    },
    {
      key: "whatsapp",
      header: "WhatsApp",
      render: (r) => {
        const waLink = toWaLink(r.whatsapp);
        return (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: "#16a34a",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Kirim pesan WhatsApp"
          >
            <MessageCircle size={14} />
            {formatNoHp(r.whatsapp)}
          </a>
        );
      },
    },
    {
      key: "coordinates",
      header: "Koordinat",
      render: (r) => (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            color: "var(--primary)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title="Buka rute navigasi di Google Maps"
        >
          <MapPin size={13} />
          {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
        </a>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <StatusBadge value={r.status === "aktif" ? "Aktif" : "Tidak Aktif"} />
          <button
            type="button"
            className="action-btn"
            style={{ border: "none", background: "none", padding: 2, cursor: "pointer" }}
            onClick={(e) => handleToggleStatus(r, e)}
            title={r.status === "aktif" ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"}
          >
            {r.status === "aktif" ? (
              <ToggleRight size={22} style={{ color: "#16a34a" }} />
            ) : (
              <ToggleLeft size={22} style={{ color: "var(--text-muted)" }} />
            )}
          </button>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      className: "th-action",
      render: (r) => (
        <div className="action-group">
          <button
            className="action-btn"
            data-tooltip="Detail"
            aria-label="Detail"
            onClick={(e) => {
              e.stopPropagation();
              setDetailLoc(r);
            }}
          >
            <Eye size={16} />
          </button>
          <button
            className="action-btn"
            data-tooltip="Edit"
            aria-label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            <Pencil size={16} />
          </button>
          <button
            className="action-btn danger"
            data-tooltip="Hapus"
            aria-label="Hapus"
            onClick={(e) => {
              e.stopPropagation();
              setToDelete(r);
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-grid">
      {/* 1. SIGNATURE SUMMARY PANEL (Khas MBC Sistem) */}
      <div className="summary-panel animate-fade-slide-up">
        <div className="summary-panel-header">
          <div>
            <h3>Ringkasan Lokasi Penjualan Kupon</h3>
            <p>Kelola titik outlet penjualan tiket & pantau peta publik customer</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "7px 14px",
                background: "rgba(255, 255, 255, 0.16)",
                backdropFilter: "blur(8px)",
                borderRadius: "var(--radius-sm, 8px)",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.28)",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
              title="Buka tampilan peta publik customer di tab baru"
            >
              <ExternalLink size={14} />
              <span>Buka Peta Publik ↗</span>
            </a>
          </div>
        </div>

        {/* 3 Interactive Stat Cards (Bisa diklik untuk filter cepat seperti Rekrutmen & Pesanan) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {/* Card 1: Total Titik Lokasi */}
          <div
            onClick={() => setFilterStatus("semua")}
            className={`rekrutmen-stat-card ${filterStatus === "semua" ? "active" : ""}`}
            title="Klik untuk menampilkan semua titik lokasi penjualan"
          >
            <div className="rekrutmen-stat-head">
              <Ticket size={15} /> Total Titik Lokasi
            </div>
            <div className="rekrutmen-stat-value">
              {loading ? "..." : stats.total}
            </div>
            <span className="rekrutmen-stat-sub">Semua outlet penjualan ↗</span>
          </div>

          {/* Card 2: Lokasi Aktif */}
          <div
            onClick={() => setFilterStatus("aktif")}
            className={`rekrutmen-stat-card ${filterStatus === "aktif" ? "active" : ""}`}
            title="Klik untuk menyaring lokasi yang aktif"
          >
            <div className="rekrutmen-stat-head">
              <CheckCircle2 size={15} /> Lokasi Aktif
            </div>
            <div className="rekrutmen-stat-value">
              {loading ? "..." : stats.aktif}
            </div>
            <span className="rekrutmen-stat-sub">🟢 Tampil di peta publik ↗</span>
          </div>

          {/* Card 3: Lokasi Nonaktif */}
          <div
            onClick={() => setFilterStatus("nonaktif")}
            className={`rekrutmen-stat-card ${filterStatus === "nonaktif" ? "active" : ""}`}
            title="Klik untuk menyaring lokasi nonaktif"
          >
            <div className="rekrutmen-stat-head">
              <XCircle size={15} /> Lokasi Nonaktif
            </div>
            <div className="rekrutmen-stat-value">
              {loading ? "..." : stats.nonaktif}
            </div>
            <span className="rekrutmen-stat-sub">⚪ Disembunyikan sementara ↗</span>
          </div>
        </div>
      </div>

      {/* 2. CARD LINK PETA PUBLIK (Elegan & Terintegrasi) */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "10px",
                background: "var(--primary-50, #fee2e2)",
                color: "var(--primary-700, #b91c1c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid var(--primary-100, #fecaca)",
              }}
            >
              <Share2 size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                Link Peta Publik Customer
              </div>
              <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
                Bagikan tautan ini ke media sosial & WhatsApp agar pembeli dapat menemukan outlet kupon terdekat secara mandiri.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={copyLink}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Copy size={14} />
              {linkCopied ? "Link Tersalin!" : "Salin Link"}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={shareWa}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#16a34a" }}
            >
              <MessageCircle size={14} />
              Bagikan WA
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowQr(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <QrCode size={14} />
              QR Code
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ExternalLink size={14} />
              Buka Peta
            </a>
          </div>
        </div>
      </div>

      {/* 3. CARD UTAMA: DAFTAR LOKASI */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Daftar Lokasi Penjualan Kupon</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
              <p style={{ margin: 0 }}>
                {loading ? "Memuat data..." : `${filtered.length} titik lokasi penjualan ditampilkan`}
              </p>
              {filterStatus !== "semua" && (
                <button
                  type="button"
                  onClick={() => setFilterStatus("semua")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--primary-50, #fee2e2)",
                    color: "var(--primary-700, #b91c1c)",
                    border: "1px solid var(--primary-200, #fecaca)",
                    borderRadius: "20px",
                    padding: "2px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Klik untuk menghapus filter status"
                >
                  <span>Status: {filterStatus === "aktif" ? "Aktif" : "Nonaktif"}</span>
                  <span style={{ fontSize: "14px", lineHeight: 1 }}>×</span>
                </button>
              )}
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => setShowQr(true)}>
              <QrCode size={16} /> QR Code
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={17} /> Tambah Lokasi
            </button>
          </div>
        </div>

        <div className="toolbar">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Cari nama lokasi, PIC, atau alamat..."
          />
          <Filter
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: "semua", label: "Semua Status" },
              { value: "aktif", label: "Aktif" },
              { value: "nonaktif", label: "Nonaktif" },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          rowKey={(r) => r.id}
          emptyTitle="Belum Ada Lokasi Penjualan"
          emptyMessage="Klik tombol 'Tambah Lokasi' untuk menambahkan titik lokasi penjualan kupon pertama Anda."
          onRowClick={(r) => setDetailLoc(r)}
        />

        {filtered.length > 0 && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-soft)",
              fontSize: "12px",
              color: "var(--text-muted)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>Menampilkan {filtered.length} dari {locations.length} titik lokasi penjualan kupon</span>
            <span>💡 Klik salah satu baris untuk melihat rincian lokasi</span>
          </div>
        )}
      </div>

      {/* 4. MODAL POPUP FORMULIR TAMBAH / EDIT LOKASI */}
      <Modal
        open={formOpen}
        title={editing ? "Edit Lokasi Penjualan" : "Tambah Lokasi Penjualan"}
        onClose={closeForm}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={closeForm} disabled={saving}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleSubmitForm} disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Lokasi"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          {/* Foto Lokasi */}
          <div className="form-group full member-photo-upload-group">
            <label>Foto Lokasi / Outlet Penjualan</label>
            <div className="member-photo-uploader">
              <div
                className="member-photo-preview-box"
                onClick={() => fileInputRef.current?.click()}
                title={form.photoUrl ? "Klik untuk ganti foto" : "Klik untuk unggah foto"}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                {form.photoUrl && isValidPhotoUrl(form.photoUrl) ? (
                  <img
                    src={form.photoUrl}
                    alt="Preview Foto"
                    className="member-photo-preview-img"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="member-photo-preview-empty">
                    <Upload size={28} />
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
                      const compressed = await compressImageToSafeHd(file);
                      setFormField("photoUrl", compressed);
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
                    {form.photoUrl ? "Ganti Foto" : "Unggah Foto"}
                  </button>
                  {form.photoUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm member-photo-remove-btn"
                      onClick={() => setFormField("photoUrl", "")}
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

          {/* Nama Lokasi */}
          <div className="form-group">
            <label>Nama Lokasi / Toko / Outlet *</label>
            <input
              value={form.name}
              onChange={(e) => setFormField("name", e.target.value)}
              placeholder="Contoh: Toko Berkah Wonopringgo"
            />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>

          {/* PIC / Penjual */}
          <div className="form-group">
            <label>Nama PIC / Penjual *</label>
            <input
              value={form.picName}
              onChange={(e) => setFormField("picName", e.target.value)}
              placeholder="Contoh: Pak Ahmad / Mas Rizky"
            />
            {formErrors.picName && <span className="field-error">{formErrors.picName}</span>}
          </div>

          {/* WhatsApp */}
          <div className="form-group">
            <label>Nomor WhatsApp PIC *</label>
            <input
              value={form.whatsapp}
              onChange={(e) => setFormField("whatsapp", e.target.value)}
              placeholder="081234567890"
              inputMode="tel"
            />
            {formErrors.whatsapp && <span className="field-error">{formErrors.whatsapp}</span>}
          </div>

          {/* Status */}
          <div className="form-group">
            <label>Status Tampil di Peta *</label>
            <select
              value={form.status}
              onChange={(e) => setFormField("status", e.target.value as "aktif" | "nonaktif")}
            >
              <option value="aktif">Aktif — Tampil di Peta Publik Customer</option>
              <option value="nonaktif">Nonaktif — Disembunyikan Sementara</option>
            </select>
          </div>

          {/* Latitude & Longitude dengan Tombol GPS */}
          <div className="form-group full">
            <div className="form-label-row">
              <label>Koordinat Lokasi (Latitude & Longitude) *</label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleDetectGps}
                disabled={detectingGps}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", fontSize: "11px" }}
              >
                <Navigation size={12} />
                {detectingGps ? "Mendeteksi..." : "Ambil GPS Saya"}
              </button>
            </div>
            <div className="coords-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <input
                  value={form.latitude}
                  onChange={(e) => setFormField("latitude", e.target.value)}
                  placeholder="Latitude (-6.945120)"
                />
                {formErrors.latitude && <span className="field-error">{formErrors.latitude}</span>}
              </div>
              <div>
                <input
                  value={form.longitude}
                  onChange={(e) => setFormField("longitude", e.target.value)}
                  placeholder="Longitude (109.612541)"
                />
                {formErrors.longitude && <span className="field-error">{formErrors.longitude}</span>}
              </div>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
              💡 Tips: Anda dapat mengetik koordinat, menekan tombol <b>Ambil GPS Saya</b>, atau <b>klik langsung pada peta</b> di bawah ini.
            </span>
          </div>

          {/* Interactive Mini Map Picker */}
          <div className="form-group full">
            <label>Pratinjau &amp; Pemilihan Titik pada Peta</label>
            <div
              style={{
                borderRadius: "var(--radius-md, 8px)",
                overflow: "hidden",
                border: "1px solid var(--border)",
                height: 190,
                position: "relative",
              }}
            >
              <MapContainer
                center={isValidCoord ? [pLat, pLng] : [-6.945, 109.61]}
                zoom={isValidCoord ? 15 : 12}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickPicker
                  onPick={(lat, lng) => {
                    setForm((p) => ({ ...p, latitude: String(lat), longitude: String(lng) }));
                  }}
                />
                {isValidCoord && (
                  <>
                    <Marker position={[pLat, pLng]} icon={kuponMarkerIcon}>
                      <Popup>Titik Lokasi Terpilih</Popup>
                    </Marker>
                    <MapCenterController lat={pLat} lng={pLng} />
                  </>
                )}
              </MapContainer>
            </div>
          </div>

          {/* Alamat */}
          <div className="form-group full">
            <label>Alamat Lengkap / Patokan *</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setFormField("address", e.target.value)}
              placeholder="Contoh: Jl. Raya Wonopringgo No. 12 (Depan Balai Desa / Sebelah Alfamart)"
            />
            {formErrors.address && <span className="field-error">{formErrors.address}</span>}
          </div>

          {/* Keterangan Tambahan */}
          <div className="form-group full">
            <label>Keterangan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setFormField("description", e.target.value)}
              placeholder="Contoh: Buka jam 08.00 - 17.00 WIB. Melayani pembayaran cash dan QRIS."
            />
          </div>
        </div>
      </Modal>

      {/* 5. MODAL DETAIL LOKASI */}
      <Modal
        open={Boolean(detailLoc)}
        title="Detail Lokasi Penjualan"
        onClose={() => setDetailLoc(null)}
        size="md"
        footer={
          detailLoc ? (
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${detailLoc.latitude},${detailLoc.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ color: "#1a73e8", borderColor: "#bfdbfe", background: "#eff6ff" }}
                >
                  <MapPin size={14} /> Buka di Google Maps
                </a>
                <a
                  href={toWaLink(detailLoc.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ color: "#16a34a" }}
                >
                  <MessageCircle size={14} /> Hubungi PIC
                </a>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const loc = detailLoc;
                    setDetailLoc(null);
                    openEdit(loc);
                  }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDetailLoc(null)}>
                  Tutup
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {detailLoc && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {detailLoc.photoUrl && isValidPhotoUrl(detailLoc.photoUrl) && (
              <div
                style={{
                  borderRadius: "var(--radius-md, 8px)",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  position: "relative",
                  cursor: "zoom-in",
                  background: "#000",
                }}
                onClick={() => setLightboxPhoto({ src: detailLoc.photoUrl!, title: detailLoc.name })}
                title="Klik untuk melihat foto full screen (layar penuh)"
              >
                <img
                  src={detailLoc.photoUrl}
                  alt={detailLoc.name}
                  style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).parentElement!.style.display = "none";
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    background: "rgba(0,0,0,0.72)",
                    backdropFilter: "blur(4px)",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    border: "1px solid rgba(255,255,255,0.2)",
                    pointerEvents: "none",
                  }}
                >
                  <span>🔍</span> Klik untuk Layar Penuh
                </div>
              </div>
            )}

            <div className="modal-detail-grid">
              <div className="modal-detail-item full">
                <div className="modal-detail-label">Nama Lokasi</div>
                <div className="modal-detail-value" style={{ fontSize: "17px" }}>
                  {detailLoc.name}
                </div>
              </div>

              <div className="modal-detail-item">
                <div className="modal-detail-label">PIC / Penjual</div>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{detailLoc.picName}</div>
              </div>

              <div className="modal-detail-item">
                <div className="modal-detail-label">WhatsApp</div>
                <div style={{ fontWeight: 600, color: "#16a34a" }}>{formatNoHp(detailLoc.whatsapp)}</div>
              </div>

              <div className="modal-detail-item">
                <div className="modal-detail-label">Status Peta</div>
                <StatusBadge value={detailLoc.status === "aktif" ? "Aktif" : "Tidak Aktif"} />
              </div>

              <div className="modal-detail-item">
                <div className="modal-detail-label">Koordinat</div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${detailLoc.latitude},${detailLoc.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    color: "var(--primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Lihat rute Google Maps"
                >
                  <MapPin size={13} />
                  {detailLoc.latitude.toFixed(6)}, {detailLoc.longitude.toFixed(6)}
                </a>
              </div>

              <div className="modal-detail-item full">
                <div className="modal-detail-label">Alamat Lengkap</div>
                <div style={{ color: "var(--text)" }}>{detailLoc.address}</div>
              </div>

              {detailLoc.description && (
                <div className="modal-detail-item full">
                  <div className="modal-detail-label">Keterangan Tambahan</div>
                  <div style={{ color: "var(--text)", whiteSpace: "pre-wrap" }}>{detailLoc.description}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 6. MODAL QR CODE */}
      <Modal
        open={showQr}
        title="QR Code Peta Penjualan Kupon"
        onClose={() => setShowQr(false)}
        size="sm"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <a href={qrUrl} download="qr-kupon-mb-chondro.png" className="btn btn-outline btn-sm">
              <Download size={14} /> Unduh Gambar
            </a>
            <button className="btn btn-primary btn-sm" onClick={() => setShowQr(false)}>
              Selesai
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <img
            src={qrUrl}
            alt="QR Code Kupon"
            style={{
              width: 200,
              height: 200,
              borderRadius: "var(--radius-md, 8px)",
              border: "1px solid var(--border)",
              padding: 8,
              background: "#ffffff",
            }}
          />
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
            Customer dapat memindai QR code ini melalui kamera HP untuk langsung membuka peta seluruh lokasi penjualan.
          </p>
        </div>
      </Modal>

      {/* 7. DIALOG KONFIRMASI HAPUS (Standard ConfirmDialog) */}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus Lokasi Penjualan"
        message={`Apakah Anda yakin ingin menghapus lokasi "${toDelete?.name}"? Titik lokasi ini tidak akan muncul lagi di sistem maupun peta pelanggan.`}
        confirmLabel="Hapus Lokasi"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {/* 8. LIGHTBOX 100% FULLSCREEN */}
      {lightboxPhoto && (
        <Lightbox
          src={lightboxPhoto.src}
          title={lightboxPhoto.title}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}
