import { Link } from "react-router-dom";
import {
  Users,
  CalendarCheck,
  Wallet,
  Layers,
  ArrowLeftRight,
  UserRoundPlus,
  Package,
  Ticket,
} from "lucide-react";
import {
  getDashboard,
  getKeuanganChondro,
  getKeuanganMedia,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import type { DashboardData, Transaksi } from "../types";
import { formatRupiah } from "../utils/format";
import { SummaryCard, SummaryGrid, SummarySection } from "../components/ui/SummaryCard";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import logo from "../aset/logo.png";

const MAIN_MENUS = [
  { to: "/anggota", label: "Anggota", icon: Users },
  { to: "/absensi", label: "Absensi", icon: CalendarCheck },
  { to: "/keuangan", label: "Keuangan", icon: Wallet },
  { to: "/keuangan-media", label: "Keuangan Media", icon: Layers },
  { to: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/rekrutmen", label: "Rekrutmen", icon: UserRoundPlus },
  { to: "/pesanan", label: "Pesanan", icon: Package },
  { to: "/kupon/kelola", label: "Kupon", icon: Ticket },
];

export function Dashboard() {
  const { user } = useAuth();

  // API hooks with cache
  const { data: dashboardData, loading: dashboardLoading } = useApi<DashboardData>(
    getDashboard,
    "Gagal mengambil data dashboard.",
    CACHE_KEYS.DASHBOARD,
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

  const loading = dashboardLoading && !dashboardData;

  // Real data calculations
  const keuanganChondroSaldo = dashboardData?.keuanganChondro.saldo ?? (
    keuanganData?.reduce((acc, t) => {
      const nom = Number(t.nominal) || 0;
      return t.jenis === "Pemasukan" ? acc + nom : acc - nom;
    }, 0) ?? 0
  );

  const keuanganMediaSaldo = dashboardData?.keuanganMedia.saldo ?? (
    keuanganMediaData?.reduce((acc, t) => {
      const nom = Number(t.nominal) || 0;
      return t.jenis === "Pemasukan" ? acc + nom : acc - nom;
    }, 0) ?? 0
  );

  const adminName = user?.nama || "Administrator";

  return (
    <div className="beranda-page-container">
      {/* ============================================================
          B. WELCOME BANNER (RED BANNER DENGAN WATERMARK LOGO SAMAR)
          ============================================================ */}
      <div className="beranda-welcome-banner animate-fade-slide-up">
        <div className="beranda-welcome-content">
          <h2 className="beranda-welcome-title">
            Selamat Datang, {adminName} 👋
          </h2>
          <p className="beranda-welcome-sub">
            Kelola seluruh aktivitas organisasi MB CHONDRO dengan mudah dan efisien.
          </p>
        </div>
        <div className="beranda-welcome-watermark" aria-hidden="true">
          <img src={logo} alt="" className="beranda-watermark-img" />
        </div>
      </div>

      {/* ============================================================
          B. RINGKASAN STATISTIK (DI BAGIAN ATAS SESUAI STANDAR SAAS)
          ============================================================ */}
      <section className="beranda-section animate-fade-slide-up stagger-1">
        <SummarySection
          title="Informasi Singkat"
          subtitle="Ringkasan status data terkini sistem MB Chondro."
        >
          <SummaryGrid columns={4}>
            <SummaryCard
              label="Total Anggota"
              value={dashboardData ? dashboardData.anggota.total.toLocaleString("id-ID") : "0"}
              loading={loading || !dashboardData}
              icon={<Users size={16} />}
              sub={
                loading || !dashboardData
                  ? "Memuat..."
                  : `${dashboardData.anggota.aktif} Aktif · ${dashboardData.anggota.cuti} Cuti`
              }
              accent="red"
            />
            <SummaryCard
              label="Kehadiran"
              value={dashboardData ? `${dashboardData.absensi.persentase}%` : "0%"}
              loading={loading || !dashboardData}
              icon={<CalendarCheck size={16} />}
              sub={
                loading || !dashboardData
                  ? "Memuat..."
                  : `${dashboardData.absensi.hadir} Hadir · ${dashboardData.absensi.izin + dashboardData.absensi.sakit} Izin`
              }
              accent="green"
            />
            <SummaryCard
              label="Kas MBC Sistem"
              value={formatRupiah(keuanganChondroSaldo)}
              loading={loading}
              icon={<Wallet size={16} />}
              sub="Kas utama organisasi"
              accent="blue"
            />
            <SummaryCard
              label="Kas Media"
              value={formatRupiah(keuanganMediaSaldo)}
              loading={loading}
              icon={<Layers size={16} />}
              sub="Publikasi & dokumentasi"
              accent="purple"
            />
          </SummaryGrid>
        </SummarySection>
      </section>

      {/* ============================================================
          C. MENU UTAMA (8 KARTU GRID RESPONSIF: 4 KOLOM PADA MOBILE)
          ============================================================ */}
      <section className="beranda-section animate-fade-slide-up stagger-2">
        <div className="beranda-section-header">
          <h3 className="beranda-section-title">Menu Utama</h3>
          <p className="beranda-section-desc">Akses cepat modul sistem MB Chondro.</p>
        </div>

        <div className="beranda-menu-grid">
          {MAIN_MENUS.map((menu) => {
            const Icon = menu.icon;
            return (
              <Link key={menu.to} to={menu.to} className="beranda-menu-card">
                <div className="beranda-menu-icon-wrap">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <span className="beranda-menu-label">{menu.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
