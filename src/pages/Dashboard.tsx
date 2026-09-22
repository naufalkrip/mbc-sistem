import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  ClipboardCheck,
  Wallet,
  WalletCards,
  X,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  ArrowRight,
  Calendar,
} from "lucide-react";
import {
  getDashboard,
  getKeuanganChondro,
  getKeuanganMedia,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import type { DashboardData, Transaksi } from "../types";
import {
  formatRupiah,
} from "../utils/format";
import { Skeleton } from "../components/ui/Skeleton";
import { FinancialBarChart, type MonthlyBalanceData } from "../components/ui/FinancialBarChart";
import { useApi } from "../hooks/useApi";

const MONTH_NAMES_FULL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Hitung saldo kumulatif bulanan per kas */
function computeMonthlyBalances(transaksi: Transaksi[], year: number): MonthlyBalanceData[] {
  // 1. Hitung saldo kumulatif sebelum tahun berjalan
  let carriedBalance = 0;
  for (const t of transaksi) {
    if (!t.tanggal) continue;
    const d = new Date(t.tanggal);
    if (isNaN(d.getTime())) continue;
    if (d.getFullYear() < year) {
      const nominal = Number(t.nominal) || 0;
      if (t.jenis === "Pemasukan") carriedBalance += nominal;
      else if (t.jenis === "Pengeluaran") carriedBalance -= nominal;
    }
  }

  // 2. Hitung pemasukan & pengeluaran per bulan di tahun berjalan
  const monthlyIn = new Array(12).fill(0);
  const monthlyOut = new Array(12).fill(0);

  for (const t of transaksi) {
    if (!t.tanggal) continue;
    const d = new Date(t.tanggal);
    if (isNaN(d.getTime())) continue;
    if (d.getFullYear() === year) {
      const m = d.getMonth();
      if (m >= 0 && m < 12) {
        const nominal = Number(t.nominal) || 0;
        if (t.jenis === "Pemasukan") monthlyIn[m] += nominal;
        else if (t.jenis === "Pengeluaran") monthlyOut[m] += nominal;
      }
    }
  }

  // 3. Saldo akhir kumulatif per bulan:
  // Saldo bulan ini = Saldo bulan sebelumnya + Pemasukan - Pengeluaran
  let runningSaldo = carriedBalance;
  const result: MonthlyBalanceData[] = [];

  for (let m = 0; m < 12; m++) {
    runningSaldo = runningSaldo + monthlyIn[m] - monthlyOut[m];
    result.push({
      monthIndex: m,
      monthName: MONTH_NAMES_FULL[m],
      shortName: MONTH_NAMES_SHORT[m],
      pemasukan: monthlyIn[m],
      pengeluaran: monthlyOut[m],
      saldo: runningSaldo,
    });
  }

  return result;
}

export function Dashboard() {
  // Use useApi hooks for instant cache rendering + background sync
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

  const [financeModal, setFinanceModal] = useState<{ type: "chondro" | "media" } | null>(null);

  // Combined loading state - show skeleton only if no cached data at all
  const loading = dashboardLoading && !dashboardData;

  const closeFinanceModal = () => setFinanceModal(null);

  const keuanganChondroSaldo = dashboardData?.keuanganChondro.saldo ?? 0;
  const keuanganMediaSaldo = dashboardData?.keuanganMedia.saldo ?? 0;
  const keuanganChondroPemasukan = dashboardData?.keuanganChondro.pemasukan ?? 0;
  const keuanganChondroPengeluaran = dashboardData?.keuanganChondro.pengeluaran ?? 0;
  const keuanganMediaPemasukan = dashboardData?.keuanganMedia.pemasukan ?? 0;
  const keuanganMediaPengeluaran = dashboardData?.keuanganMedia.pengeluaran ?? 0;
  const chondroNetFlow = keuanganChondroPemasukan - keuanganChondroPengeluaran;
  const mediaNetFlow = keuanganMediaPemasukan - keuanganMediaPengeluaran;

  // Filter tahun dinamis dari data transaksi yang tersedia
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);

    [...(keuanganData ?? []), ...(keuanganMediaData ?? [])].forEach((t) => {
      if (t.tanggal) {
        const d = new Date(t.tanggal);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          if (y >= 2000 && y <= 2100) {
            years.add(y);
          }
        }
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [keuanganData, keuanganMediaData]);

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Data saldo bulanan untuk Kas MBC System dan Kas Media
  const chondroMonthlyData = useMemo(() => {
    return computeMonthlyBalances(keuanganData ?? [], selectedYear);
  }, [keuanganData, selectedYear]);

  const mediaMonthlyData = useMemo(() => {
    return computeMonthlyBalances(keuanganMediaData ?? [], selectedYear);
  }, [keuanganMediaData, selectedYear]);

  return (
    <div className="page-grid dash-page-grid">
      {/* 1. RINGKASAN DASHBOARD UTAMA (SIGNATURE SUMMARY PANEL SESUAI HALAMAN LAIN) */}
      <div className="summary-panel animate-fade-slide-up">
        <div className="summary-panel-header">
          <div>
            <h3>Ringkasan Dashboard MB CHONDRO</h3>
            <p>Selamat Datang di Portal Sistem MB Chondro</p>
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

        <div className="dash-summary-cards-grid">
          {loading || !dashboardData ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="dash-stat-card" style={{ opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Skeleton width={24} height={24} borderRadius={7} />
                    <Skeleton width={90} height={13} />
                  </div>
                  <Skeleton width={110} height={24} style={{ margin: "4px 0" }} />
                  <Skeleton width={80} height={11} />
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Card 1: Total Anggota */}
              <div className="dash-stat-card">
                <div className="dash-stat-head">
                  <div className="dash-stat-icon-wrap">
                    <Users size={15} />
                  </div>
                  <span>Total Anggota</span>
                </div>
                <div className="dash-stat-value">
                  {dashboardData.anggota.total.toLocaleString("id-ID")}
                </div>
                <div className="dash-stat-sub">
                  {dashboardData.anggota.aktif} Aktif · {dashboardData.anggota.cuti} Cuti
                </div>
              </div>

              {/* Card 2: Kehadiran Anggota */}
              <div className="dash-stat-card">
                <div className="dash-stat-head">
                  <div className="dash-stat-icon-wrap">
                    <ClipboardCheck size={15} />
                  </div>
                  <span>Kehadiran Anggota</span>
                </div>
                <div className="dash-stat-value">
                  {dashboardData.absensi.persentase}%
                </div>
                <div className="dash-stat-sub">
                  {dashboardData.absensi.hadir} Hadir · {dashboardData.absensi.izin + dashboardData.absensi.sakit} Izin
                </div>
              </div>

              {/* Card 3: Saldo Kas Chondro */}
              <div className="dash-stat-card highlight">
                <div className="dash-stat-head">
                  <div className="dash-stat-icon-wrap">
                    <Wallet size={15} />
                  </div>
                  <span>Kas mbc sistem</span>
                </div>
                <div className="dash-stat-value">
                  {formatRupiah(keuanganChondroSaldo)}
                </div>
                <div className="dash-stat-sub">
                  Kas utama organisasi
                </div>
              </div>

              {/* Card 4: Saldo Kas Media */}
              <div className="dash-stat-card highlight">
                <div className="dash-stat-head">
                  <div className="dash-stat-icon-wrap">
                    <WalletCards size={15} />
                  </div>
                  <span>Kas Media</span>
                </div>
                <div className="dash-stat-value">
                  {formatRupiah(keuanganMediaSaldo)}
                </div>
                <div className="dash-stat-sub">
                  Publikasi & dokumentasi
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. REKAPITULASI KEUANGAN ORGANISASI (CLEAN MINIMAL + PREMIUM DASHBOARD) */}
      <div className="rekap-card-container animate-fade-slide-up stagger-2">
        {/* HEADER */}
        <div className="rekap-header">
          <div className="rekap-header-titles">
            <h2 className="rekap-title">Rekapitulasi Keuangan Organisasi</h2>
            <p className="rekap-subtitle">Arus kas masuk, keluar, dan saldo likuiditas operasional mbc sistem</p>
          </div>
          <div className="rekap-header-actions">
            <Link to="/keuangan" className="rekap-action-btn">
              <span>Buku Kas Chondro</span>
              <ExternalLink size={12} />
            </Link>
            <Link to="/keuangan-media" className="rekap-action-btn">
              <span>Buku Kas Media</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* SECTION 1: TREN SALDO KEUANGAN */}
        <div className="rekap-tren-section">
          <div className="rekap-tren-header">
            <div className="rekap-tren-titles">
              <h3 className="rekap-tren-title">Tren Saldo Keuangan</h3>
              <p className="rekap-tren-subtitle">
                Perkembangan saldo kas MBC System dan pemasukan bulanan Kas Media
              </p>
            </div>
            <div className="rekap-year-filter">
              <label htmlFor="rekap-year-select" className="rekap-year-label">
                <Calendar size={13} />
                <span>Periode:</span>
              </label>
              <select
                id="rekap-year-select"
                className="rekap-year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Filter tahun tren saldo keuangan"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TWO SIDE-BY-SIDE BAR CHARTS */}
          {loading ? (
            <div className="rekap-charts-grid">
              <Skeleton height={200} borderRadius={16} />
              <Skeleton height={200} borderRadius={16} />
            </div>
          ) : (
            <div className="rekap-charts-grid">
              <FinancialBarChart
                title="Kas MBC System"
                subtitle={`Tren saldo kas per bulan (${selectedYear})`}
                year={selectedYear}
                data={chondroMonthlyData}
                valueKey="saldo"
                metricLabel="Saldo Kas"
                barColor="#dc2626"
                height={200}
              />
              <FinancialBarChart
                title="Kas Media"
                subtitle={`Pemasukan kas per bulan (${selectedYear})`}
                year={selectedYear}
                data={mediaMonthlyData}
                valueKey="pemasukan"
                metricLabel="Pemasukan Kas"
                barColor="#b91c1c"
                height={200}
              />
            </div>
          )}
        </div>

        {/* SECTION 2: RINGKASAN KEUANGAN */}
        <div className="rekap-summary-section">
          <div className="rekap-summary-header">
            <div>
              <h3 className="rekap-summary-title">Ringkasan Keuangan</h3>
              <p className="rekap-summary-subtitle">Posisi likuiditas dan ringkasan mutasi kas operasional</p>
            </div>
          </div>

          {loading || !dashboardData ? (
            <div className="rekap-kas-grid">
              <Skeleton height={160} borderRadius={14} />
              <Skeleton height={160} borderRadius={14} />
            </div>
          ) : (
            <div className="rekap-kas-grid">
              {/* 1. KAS MBC SYSTEM */}
              <div className="rekap-kas-card compact">
                <div className="rekap-kas-compact-top">
                  <div className="rekap-kas-header">
                    <div className="rekap-kas-icon">
                      <Wallet size={17} />
                    </div>
                    <div>
                      <h4 className="rekap-kas-name">Kas MBC System</h4>
                      <p className="rekap-kas-desc">Kas utama organisasi</p>
                    </div>
                  </div>
                  <div className="rekap-kas-balance compact">
                    <span className="rekap-kas-balance-label">Saldo Saat Ini</span>
                    <span className="rekap-kas-balance-value">
                      {formatRupiah(keuanganChondroSaldo)}
                    </span>
                  </div>
                </div>

                <div className="rekap-kas-flows compact">
                  <div className="rekap-kas-flow-row">
                    <span className="rekap-kas-flow-label">
                      <ArrowUpRight size={13} style={{ color: "#16a34a" }} /> Pemasukan
                    </span>
                    <span className="rekap-kas-flow-value positive">
                      +{formatRupiah(keuanganChondroPemasukan)}
                    </span>
                  </div>
                  <div className="rekap-kas-flow-row">
                    <span className="rekap-kas-flow-label">
                      <ArrowDownRight size={13} style={{ color: "#dc2626" }} /> Pengeluaran
                    </span>
                    <span className="rekap-kas-flow-value negative">
                      -{formatRupiah(keuanganChondroPengeluaran)}
                    </span>
                  </div>
                  <div className="rekap-kas-flow-row rekap-kas-flow-net">
                    <span className="rekap-kas-flow-label">Arus Kas Bersih</span>
                    <span className={`rekap-kas-flow-value ${chondroNetFlow >= 0 ? "positive" : "negative"}`}>
                      {chondroNetFlow >= 0 ? "+" : ""}{formatRupiah(chondroNetFlow)}
                    </span>
                  </div>
                </div>

                <div className="rekap-kas-footer compact">
                  <button
                    type="button"
                    className="rekap-kas-detail-link"
                    onClick={() => setFinanceModal({ type: "chondro" })}
                  >
                    <span>Lihat Detail</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* 2. KAS MEDIA */}
              <div className="rekap-kas-card compact">
                <div className="rekap-kas-compact-top">
                  <div className="rekap-kas-header">
                    <div className="rekap-kas-icon">
                      <WalletCards size={17} />
                    </div>
                    <div>
                      <h4 className="rekap-kas-name">Kas Media</h4>
                      <p className="rekap-kas-desc">Publikasi & dokumentasi</p>
                    </div>
                  </div>
                  <div className="rekap-kas-balance compact">
                    <span className="rekap-kas-balance-label">Saldo Saat Ini</span>
                    <span className="rekap-kas-balance-value">
                      {formatRupiah(keuanganMediaSaldo)}
                    </span>
                  </div>
                </div>

                <div className="rekap-kas-flows compact">
                  <div className="rekap-kas-flow-row">
                    <span className="rekap-kas-flow-label">
                      <ArrowUpRight size={13} style={{ color: "#16a34a" }} /> Pemasukan
                    </span>
                    <span className="rekap-kas-flow-value positive">
                      +{formatRupiah(keuanganMediaPemasukan)}
                    </span>
                  </div>
                  <div className="rekap-kas-flow-row">
                    <span className="rekap-kas-flow-label">
                      <ArrowDownRight size={13} style={{ color: "#dc2626" }} /> Pengeluaran
                    </span>
                    <span className="rekap-kas-flow-value negative">
                      -{formatRupiah(keuanganMediaPengeluaran)}
                    </span>
                  </div>
                  <div className="rekap-kas-flow-row rekap-kas-flow-net">
                    <span className="rekap-kas-flow-label">Arus Kas Bersih</span>
                    <span className={`rekap-kas-flow-value ${mediaNetFlow >= 0 ? "positive" : "negative"}`}>
                      {mediaNetFlow >= 0 ? "+" : ""}{formatRupiah(mediaNetFlow)}
                    </span>
                  </div>
                </div>

                <div className="rekap-kas-footer compact">
                  <button
                    type="button"
                    className="rekap-kas-detail-link"
                    onClick={() => setFinanceModal({ type: "media" })}
                  >
                    <span>Lihat Detail</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
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
                      fontSize: "22px",
                      fontWeight: 700,
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