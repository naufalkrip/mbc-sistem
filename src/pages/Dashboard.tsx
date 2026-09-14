import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  ClipboardCheck,
  Wallet,
  WalletCards,
  X,
  ExternalLink,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  PlusCircle,
  TrendingUp,
} from "lucide-react";
import {
  getAbsensi,
  getAnggota,
  getDashboard,
  getKeuanganChondro,
  getKeuanganMedia,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import type { Absensi, Anggota, DashboardData, Transaksi } from "../types";
import {
  buatSesiAbsensi,
  formatTanggalPendek,
  formatRupiah,
} from "../utils/format";
import { Skeleton } from "../components/ui/Skeleton";
import { DonutChart } from "../components/ui/Chart";
import { useApi } from "../hooks/useApi";

interface AktivitasItem {
  id: string;
  tanggal: string;
  warna: string;
  iconType: "absensi" | "anggota" | "keuangan_in" | "keuangan_out";
  judul: string;
  deskripsi: string;
}

const DIVISION_COLORS: Record<string, string> = {
  Brass: "#0284c7",
  Percussion: "#7c3aed",
  "Battery Percussion": "#7c3aed",
  "Pit Instrument": "#d97706",
  "Color Guard": "#db2777",
  Management: "#059669",
  Staff: "#475569",
  Official: "#475569",
  Lainnya: "#64748b",
};

const PALETTE = [
  "#0284c7",
  "#7c3aed",
  "#059669",
  "#db2777",
  "#d97706",
  "#ea580c",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
  "#64748b",
];

function SummaryCard({
  label,
  value,
  sub,
  badge,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  sub: string;
  badge?: string;
  icon: ReactNode;
  iconClass: string;
}) {
  return (
    <div className="summary-card animate-fade-slide-up" style={{ minWidth: 0, border: "1px solid var(--border, #e2e8f0)" }}>
      <div className="summary-card-head">
        <span className="summary-card-label" style={{ color: "var(--text-muted, #64748b)", fontWeight: 600 }}>{label}</span>
        <span className={`summary-card-icon ${iconClass}`}>{icon}</span>
      </div>
      <span className="summary-card-value" style={{ color: "var(--navy-900, #0f172a)" }}>{value}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4 }}>
        <span className="summary-card-sub">{sub}</span>
        {badge && (
          <span
            style={{
              fontSize: "10.5px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="summary-card summary-card-skeleton animate-fade-slide-up">
      <div className="summary-card-head">
        <Skeleton width={120} height={14} />
        <Skeleton width={44} height={44} borderRadius={12} />
      </div>
      <Skeleton width={100} height={32} />
      <Skeleton width={140} height={13} />
    </div>
  );
}

export function Dashboard() {
  // Use useApi hooks for instant cache rendering + background sync
  const { data: dashboardData, loading: dashboardLoading } = useApi<DashboardData>(
    getDashboard,
    "Gagal mengambil data dashboard.",
    CACHE_KEYS.DASHBOARD,
    { pollingInterval: 15000, revalidateOnFocus: true, immediate: true }
  );

  const { data: absensiData } = useApi<Absensi[]>(
    getAbsensi,
    "Gagal mengambil data absensi.",
    CACHE_KEYS.ABSENSI,
    { pollingInterval: 15000, revalidateOnFocus: true, immediate: true }
  );

  const { data: anggotaData } = useApi<Anggota[]>(
    getAnggota,
    "Gagal mengambil data anggota.",
    CACHE_KEYS.ANGGOTA,
    { pollingInterval: 15000, revalidateOnFocus: true, immediate: true }
  );

  const { data: keuanganData } = useApi<Transaksi[]>(
    getKeuanganChondro,
    "Gagal mengambil data keuangan Chondro.",
    CACHE_KEYS.KEUANGAN_CHONDRO,
    { pollingInterval: 15000, revalidateOnFocus: true, immediate: true }
  );

  const { data: keuanganMediaData } = useApi<Transaksi[]>(
    getKeuanganMedia,
    "Gagal mengambil data keuangan Media.",
    CACHE_KEYS.KEUANGAN_MEDIA,
    { pollingInterval: 15000, revalidateOnFocus: true, immediate: true }
  );

  const [financeModal, setFinanceModal] = useState<{ type: "chondro" | "media" } | null>(null);
  const [memberViewMode, setMemberViewMode] = useState<"status" | "divisi">("status");

  // Combined loading state - show skeleton only if no cached data at all
  const loading = dashboardLoading && !dashboardData;

  const closeFinanceModal = () => setFinanceModal(null);

  // Status Keanggotaan Data (Clean Natural Colors)
  const statusDonutData = useMemo(() => {
    if (!dashboardData) return [];
    return [
      { label: "Aktif", value: dashboardData.anggota.aktif, color: "#16a34a" },
      { label: "Cuti", value: dashboardData.anggota.cuti, color: "#f59e0b" },
      { label: "Tidak Aktif", value: dashboardData.anggota.tidakAktif, color: "#dc2626" },
    ];
  }, [dashboardData]);

  // Distribusi Divisi Data (Vibrant Multi-palette)
  const divisionDonutData = useMemo(() => {
    if (!anggotaData || anggotaData.length === 0) return [];
    const divMap = new Map<string, number>();
    anggotaData.forEach((a) => {
      const divName = (a.divisi || "Belum Ditentukan").trim();
      divMap.set(divName, (divMap.get(divName) || 0) + 1);
    });

    const sorted = Array.from(divMap.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.map(([divName, count], idx) => {
      const color = DIVISION_COLORS[divName] || PALETTE[idx % PALETTE.length];
      return {
        label: divName,
        value: count,
        color,
      };
    });
  }, [anggotaData]);

  // Feed Aktivitas Terbaru
  const aktivitas = useMemo<AktivitasItem[]>(() => {
    const items: AktivitasItem[] = [];

    const sesiList = buatSesiAbsensi(absensiData ?? []);
    for (const s of sesiList.slice(-4)) {
      items.push({
        id: `ab-${s.key}`,
        tanggal: s.tanggal,
        warna: "#0284c7",
        iconType: "absensi",
        judul: `Absensi ${s.kegiatan}`,
        deskripsi: `${s.jumlahAnggota} anggota · ${s.waktu}`,
      });
    }

    const anggotaBaru = [...(anggotaData ?? [])]
      .filter((a) => a.tanggalBergabung)
      .sort((a, b) => b.tanggalBergabung.localeCompare(a.tanggalBergabung))
      .slice(0, 4);
    for (const a of anggotaBaru) {
      items.push({
        id: `ag-${a.id}`,
        tanggal: a.tanggalBergabung,
        warna: "#10b981",
        iconType: "anggota",
        judul: "Anggota baru bergabung",
        deskripsi: `${a.nama} (${a.divisi || "Umum"})`,
      });
    }

    const transaksiBaru = [...(keuanganData ?? []), ...(keuanganMediaData ?? [])]
      .filter((t) => t.tanggal)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      .slice(0, 6);
    for (const t of transaksiBaru) {
      const masuk = t.jenis === "Pemasukan";
      items.push({
        id: `tr-${t.id}`,
        tanggal: t.tanggal,
        warna: masuk ? "#10b981" : "#ef4444",
        iconType: masuk ? "keuangan_in" : "keuangan_out",
        judul: masuk ? "Pemasukan Kas" : "Pengeluaran Kas",
        deskripsi: `${t.kategori || t.keterangan || "Transaksi"} · ${formatRupiah(t.nominal)}`,
      });
    }

    return items.sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 6);
  }, [absensiData, anggotaData, keuanganData, keuanganMediaData]);

  const keuanganChondroSaldo = dashboardData?.keuanganChondro.saldo ?? 0;
  const keuanganMediaSaldo = dashboardData?.keuanganMedia.saldo ?? 0;
  const keuanganChondroPemasukan = dashboardData?.keuanganChondro.pemasukan ?? 0;
  const keuanganChondroPengeluaran = dashboardData?.keuanganChondro.pengeluaran ?? 0;
  const keuanganMediaPemasukan = dashboardData?.keuanganMedia.pemasukan ?? 0;
  const keuanganMediaPengeluaran = dashboardData?.keuanganMedia.pengeluaran ?? 0;
  const totalLikuiditas = keuanganChondroSaldo + keuanganMediaSaldo;

  // Calculate Cash Ratio
  const chondroFlowTotal = keuanganChondroPemasukan + keuanganChondroPengeluaran;
  const chondroInflowPct = chondroFlowTotal > 0 ? Math.round((keuanganChondroPemasukan / chondroFlowTotal) * 100) : 50;
  const chondroOutflowPct = 100 - chondroInflowPct;

  const mediaFlowTotal = keuanganMediaPemasukan + keuanganMediaPengeluaran;
  const mediaInflowPct = mediaFlowTotal > 0 ? Math.round((keuanganMediaPemasukan / mediaFlowTotal) * 100) : 50;
  const mediaOutflowPct = 100 - mediaInflowPct;

  return (
    <div className="page-grid" style={{ gap: 22 }}>
      {/* 1. GREETING BANNER (PROUD SIGNATURE RED BOX) */}
      <div className="dash-greeting-banner animate-fade-slide-up">
        <div>
          <h1 className="dash-greeting-title">
            Selamat Datang Di Portal Sistem MB Chondro
          </h1>
          <div className="dash-greeting-sub" />
        </div>

        <div className="dash-quick-shortcuts">
          <Link to="/absensi" className="dash-quick-btn">
            <PlusCircle size={14} />
            Absensi
          </Link>
          <Link to="/keuangan" className="dash-quick-btn">
            <PlusCircle size={14} />
            Kas Chondro
          </Link>
          <Link to="/keuangan-media" className="dash-quick-btn">
            <PlusCircle size={14} />
            Kas Media
          </Link>
          <Link to="/anggota" className="dash-quick-btn">
            <PlusCircle size={14} />
            Anggota
          </Link>
        </div>
      </div>

      {/* 2. 4 ELEVATED SUMMARY CARDS (CLEAN MINIMALIST) */}
      <div className="dash-summary-grid">
        {loading || !dashboardData ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              label="Total Anggota"
              value={dashboardData.anggota.total.toLocaleString("id-ID")}
              sub={`${dashboardData.anggota.aktif} Aktif · ${dashboardData.anggota.cuti} Cuti`}
              badge={`${dashboardData.anggota.total > 0 ? Math.round((dashboardData.anggota.aktif / dashboardData.anggota.total) * 100) : 0}% Aktif`}
              icon={<Users size={20} />}
              iconClass="summary-card-icon-primary"
            />
            <SummaryCard
              label="Kehadiran Anggota"
              value={`${dashboardData.absensi.persentase}%`}
              sub={`${dashboardData.absensi.hadir} Hadir · ${dashboardData.absensi.izin + dashboardData.absensi.sakit} Izin`}
              badge={dashboardData.absensi.persentase >= 80 ? "Sangat Baik" : "Stabil"}
              icon={<ClipboardCheck size={20} />}
              iconClass="summary-card-icon-green"
            />
            <SummaryCard
              label="Saldo Kas mbc sistem"
              value={formatRupiah(keuanganChondroSaldo)}
              sub="Kas utama organisasi"
              badge="Kas Utama"
              icon={<Wallet size={20} />}
              iconClass="summary-card-icon-primary"
            />
            <SummaryCard
              label="Saldo Kas Media"
              value={formatRupiah(keuanganMediaSaldo)}
              sub="Publikasi & media"
              badge="Kas Media"
              icon={<WalletCards size={20} />}
              iconClass="summary-card-icon-primary"
            />
          </>
        )}
      </div>

      {/* 3. REKAPITULASI KEUANGAN ORGANISASI (FULL WIDTH - CLEAN WHITE) */}
      <div className="card animate-fade-slide-up stagger-2" style={{ width: "100%" }}>
        <div className="card-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2>Rekapitulasi Keuangan Organisasi</h2>
            <p>Arus kas masuk, keluar, dan saldo likuiditas operasional mbc sistem</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/keuangan" className="btn btn-outline" style={{ fontSize: "12px", padding: "6px 12px" }}>
              Buku Kas Chondro <ExternalLink size={13} />
            </Link>
            <Link to="/keuangan-media" className="btn btn-outline" style={{ fontSize: "12px", padding: "6px 12px" }}>
              Buku Kas Media <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {loading || !dashboardData ? (
          <div className="rekap-keuangan-skeleton" style={{ padding: "16px 0" }}>
            <Skeleton height={46} borderRadius={12} style={{ marginBottom: 16 }} />
            <Skeleton height={140} borderRadius={14} style={{ marginBottom: 12 }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* TOP LIQUIDITY BANNER */}
            <div className="liquidity-banner">
              <div className="liquidity-banner-info">
                <span className="liquidity-banner-label">Total Saldo Likuiditas (Chondro + Media)</span>
                <span className="liquidity-banner-value">{formatRupiah(totalLikuiditas)}</span>
              </div>
              <div className="liquidity-banner-badge">
                <TrendingUp size={14} />
                Total Kas Tersedia
              </div>
            </div>

            {/* 2 PROPORTIONAL FINANCE CARDS FULL WIDTH GRID */}
            <div className="rekap-keuangan-grid">
              {/* 1. KAS MB CHONDRO */}
              <div className="finance-modern-card chondro">
                <div className="finance-card-top">
                  <div className="finance-card-title-group">
                    <div className="finance-card-icon">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h3 className="finance-card-name">Kas mbc sistem</h3>
                      <div className="finance-card-tag">Kas Utama Organisasi</div>
                    </div>
                  </div>
                </div>

                <div className="finance-card-balance-block">
                  <span className="finance-balance-label">Saldo Kas</span>
                  <span className="finance-balance-value" style={{ color: "var(--primary-700, #b91c1c)" }}>
                    {formatRupiah(keuanganChondroSaldo)}
                  </span>
                </div>

                <div className="finance-flow-grid">
                  <div className="finance-flow-item inflow">
                    <span className="finance-flow-label">
                      <ArrowUpRight size={13} style={{ color: "#16a34a" }} /> Pemasukan
                    </span>
                    <span className="finance-flow-value positive">
                      +{formatRupiah(keuanganChondroPemasukan)}
                    </span>
                  </div>
                  <div className="finance-flow-item outflow">
                    <span className="finance-flow-label">
                      <ArrowDownRight size={13} style={{ color: "#dc2626" }} /> Pengeluaran
                    </span>
                    <span className="finance-flow-value negative">
                      -{formatRupiah(keuanganChondroPengeluaran)}
                    </span>
                  </div>
                </div>

                {/* Flow Ratio Bar */}
                <div className="finance-ratio-bar-wrapper">
                  <div className="finance-ratio-bar-track">
                    <div className="finance-ratio-bar-fill-in" style={{ width: `${chondroInflowPct}%` }} title={`Pemasukan: ${chondroInflowPct}%`} />
                    <div className="finance-ratio-bar-fill-out" style={{ width: `${chondroOutflowPct}%` }} title={`Pengeluaran: ${chondroOutflowPct}%`} />
                  </div>
                  <div className="finance-ratio-bar-labels">
                    <span style={{ color: "#16a34a" }}>Masuk {chondroInflowPct}%</span>
                    <span style={{ color: "#dc2626" }}>Keluar {chondroOutflowPct}%</span>
                  </div>
                </div>

                <div className="finance-card-footer">
                  <button
                    type="button"
                    className="finance-action-btn"
                    onClick={() => setFinanceModal({ type: "chondro" })}
                  >
                    Detail Rincian
                  </button>
                  <Link to="/keuangan" className="finance-action-btn" style={{ fontWeight: 700, color: "var(--primary-700, #b91c1c)" }}>
                    Kelola Transaksi <ExternalLink size={12} />
                  </Link>
                </div>
              </div>

              {/* 2. KAS MEDIA */}
              <div className="finance-modern-card media">
                <div className="finance-card-top">
                  <div className="finance-card-title-group">
                    <div className="finance-card-icon">
                      <WalletCards size={18} />
                    </div>
                    <div>
                      <h3 className="finance-card-name">Kas Media</h3>
                      <div className="finance-card-tag">Publikasi & Dokumentasi</div>
                    </div>
                  </div>
                </div>

                <div className="finance-card-balance-block">
                  <span className="finance-balance-label">Saldo Kas</span>
                  <span className="finance-balance-value" style={{ color: "var(--primary-700, #b91c1c)" }}>
                    {formatRupiah(keuanganMediaSaldo)}
                  </span>
                </div>

                <div className="finance-flow-grid">
                  <div className="finance-flow-item inflow">
                    <span className="finance-flow-label">
                      <ArrowUpRight size={13} style={{ color: "#16a34a" }} /> Pemasukan
                    </span>
                    <span className="finance-flow-value positive">
                      +{formatRupiah(keuanganMediaPemasukan)}
                    </span>
                  </div>
                  <div className="finance-flow-item outflow">
                    <span className="finance-flow-label">
                      <ArrowDownRight size={13} style={{ color: "#dc2626" }} /> Pengeluaran
                    </span>
                    <span className="finance-flow-value negative">
                      -{formatRupiah(keuanganMediaPengeluaran)}
                    </span>
                  </div>
                </div>

                {/* Flow Ratio Bar */}
                <div className="finance-ratio-bar-wrapper">
                  <div className="finance-ratio-bar-track">
                    <div className="finance-ratio-bar-fill-in" style={{ width: `${mediaInflowPct}%` }} title={`Pemasukan: ${mediaInflowPct}%`} />
                    <div className="finance-ratio-bar-fill-out" style={{ width: `${mediaOutflowPct}%` }} title={`Pengeluaran: ${mediaOutflowPct}%`} />
                  </div>
                  <div className="finance-ratio-bar-labels">
                    <span style={{ color: "#16a34a" }}>Masuk {mediaInflowPct}%</span>
                    <span style={{ color: "#dc2626" }}>Keluar {mediaOutflowPct}%</span>
                  </div>
                </div>

                <div className="finance-card-footer">
                  <button
                    type="button"
                    className="finance-action-btn"
                    onClick={() => setFinanceModal({ type: "media" })}
                  >
                    Detail Rincian
                  </button>
                  <Link to="/keuangan-media" className="finance-action-btn" style={{ fontWeight: 700, color: "var(--primary-700, #b91c1c)" }}>
                    Kelola Transaksi <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. STRUKTUR ANGGOTA & LOG AKTIVITAS TERKINI (2-COLUMN GRID - CLEAN WHITE) */}
      <div className="dash-main-grid" style={{ alignItems: "stretch" }}>
        {/* LEFT COLUMN: STATUS & DISTRIBUSI ANGGOTA */}
        <div className="card animate-fade-slide-up stagger-3" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2>Struktur & Distribusi Anggota</h2>
              <p>Visualisasi sebaran anggota mbc sistem</p>
            </div>

            {/* SEGMENTED TAB SWITCHER */}
            <div className="card-segmented-tabs">
              <button
                type="button"
                className={`card-tab-btn ${memberViewMode === "status" ? "active" : ""}`}
                onClick={() => setMemberViewMode("status")}
              >
                Status
              </button>
              <button
                type="button"
                className={`card-tab-btn ${memberViewMode === "divisi" ? "active" : ""}`}
                onClick={() => setMemberViewMode("divisi")}
              >
                Divisi / Sektor
              </button>
            </div>
          </div>

          {loading || !dashboardData ? (
            <div className="status-section-skeleton" style={{ padding: "20px 0" }}>
              <Skeleton width={180} height={180} borderRadius={9999} style={{ margin: "0 auto 16px" }} />
              <Skeleton height={20} width="80%" style={{ margin: "0 auto" }} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, justifyContent: "space-between" }}>
              {/* INTERACTIVE DONUT CHART */}
              <div style={{ padding: "8px 0" }}>
                <DonutChart
                  data={memberViewMode === "status" ? statusDonutData : divisionDonutData}
                  size={210}
                  thickness={24}
                  centerSubtitle={memberViewMode === "status" ? "Anggota" : "Total Divisi"}
                  showLegend={true}
                  legendPosition="right"
                />
              </div>

              {/* HEALTH INDICATOR PILL AT BOTTOM */}
              {memberViewMode === "status" ? (
                <div
                  style={{
                    background: "var(--surface-hover, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={16} style={{ color: "var(--primary-700, #b91c1c)" }} />
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--navy-900, #0f172a)" }}>
                      Rasio Keaktifan: {dashboardData.anggota.total > 0 ? Math.round((dashboardData.anggota.aktif / dashboardData.anggota.total) * 100) : 0}%
                    </span>
                  </div>
                  <Link
                    to="/anggota"
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "var(--primary-700, #b91c1c)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Kelola Anggota <ExternalLink size={12} />
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--surface-hover, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Layers size={16} style={{ color: "var(--primary-700, #b91c1c)" }} />
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--navy-900, #0f172a)" }}>
                      {divisionDonutData.length} Sektor Divisi Aktif
                    </span>
                  </div>
                  <Link
                    to="/anggota"
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: "var(--primary-700, #b91c1c)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Lihat Daftar <ExternalLink size={12} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LOG & AKTIVITAS TERKINI */}
        <div className="card animate-fade-slide-up stagger-4" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div>
              <h2>Log & Aktivitas Terkini</h2>
              <p>Riwayat kegiatan & mutasi mbc sistem</p>
            </div>
          </div>
          {loading ? (
            <div className="aktivitas-list">
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          ) : aktivitas.length === 0 ? (
            <div className="aktivitas-empty">
              <Activity size={32} style={{ color: "#98a1b0", marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: "#98a1b0", margin: 0 }}>Belum ada aktivitas terbaru</p>
              <p style={{ fontSize: 11, color: "#98a1b0", marginTop: 4 }}>
                Seluruh mutasi keuangan, sesi absensi, dan data anggota baru akan tercatat di sini.
              </p>
            </div>
          ) : (
            <div className="aktivitas-list" style={{ flex: 1 }}>
              {aktivitas.map((a) => (
                <div key={a.id} className="aktivitas-item">
                  <span
                    className="aktivitas-dot"
                    style={{
                      background: a.warna,
                      boxShadow: `0 0 0 3px ${a.warna}20`,
                    }}
                  />
                  <div className="aktivitas-body">
                    <div className="aktivitas-title" style={{ fontWeight: 600, color: "var(--navy-900, #0f172a)" }}>
                      {a.judul}
                    </div>
                    <div className="aktivitas-desc">{a.deskripsi}</div>
                  </div>
                  <span className="aktivitas-date">{formatTanggalPendek(a.tanggal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. FINANCE DETAIL MODAL */}
      {financeModal && (
        <div
          className="modal-overlay"
          onClick={closeFinanceModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-modal-title"
        >
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="finance-modal-title">
                {financeModal.type === "chondro" ? "Rincian Kas mbc sistem" : "Rincian Kas Media"}
              </h3>
              <button className="modal-close" onClick={closeFinanceModal} aria-label="Tutup">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-detail-grid">
                <div className="modal-detail-item">
                  <div className="modal-detail-label">Total Pemasukan</div>
                  <div className="modal-detail-value positive">
                    +{formatRupiah(financeModal.type === "chondro" ? keuanganChondroPemasukan : keuanganMediaPemasukan)}
                  </div>
                </div>
                <div className="modal-detail-item">
                  <div className="modal-detail-label">Total Pengeluaran</div>
                  <div className="modal-detail-value negative">
                    -{formatRupiah(financeModal.type === "chondro" ? keuanganChondroPengeluaran : keuanganMediaPengeluaran)}
                  </div>
                </div>
                <div className="modal-detail-item full">
                  <div className="modal-detail-label">Sisa Saldo Kas</div>
                  <div
                    className="modal-detail-value"
                    style={{
                      fontSize: "1.4rem",
                      color: financeModal.type === "chondro" ? "var(--primary-700, #b91c1c)" : "var(--blue-700, #0284c7)",
                    }}
                  >
                    {formatRupiah(financeModal.type === "chondro" ? keuanganChondroSaldo : keuanganMediaSaldo)}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeFinanceModal}>
                Tutup
              </button>
              <Link
                to={financeModal.type === "chondro" ? "/keuangan" : "/keuangan-media"}
                className="btn btn-primary"
                onClick={closeFinanceModal}
              >
                Buka Buku Kas <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}