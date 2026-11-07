import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PageTransition } from "../ui/PageTransition";
import { Outlet } from "react-router-dom";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Beranda", subtitle: "Pusat menu dan akses cepat sistem MB Chondro." },
  "/pesanan": { title: "Daftar Pesanan", subtitle: "Kelola dan pantau seluruh pesanan." },
  "/anggota": { title: "Data Anggota", subtitle: "Kelola anggota MB Chondro." },
  "/absensi": { title: "Rekap Absensi", subtitle: "Ringkasan dan riwayat kehadiran anggota." },
  "/keuangan": { title: "Keuangan MB Chondro", subtitle: "Buku kas operasional organisasi." },
  "/keuangan-media": { title: "Keuangan Media", subtitle: "Buku kas publikasi & dokumentasi." },
  "/transaksi": { title: "Transaksi", subtitle: "Kelola transaksi pos kegiatan & proyek." },
  "/rekrutmen": { title: "Rekrutmen", subtitle: "Kelola pendaftaran calon anggota." },
  "/rekrutmen/daftar": { title: "Pendaftaran Anggota", subtitle: "Formulir pendaftaran calon anggota." },
  "/kupon/kelola": { title: "Kelola Kupon", subtitle: "Kelola titik lokasi penjualan kupon MB Chondro." },
};

export function Layout({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const meta = TITLES[location.pathname] ?? { title: "Manajemen Organisasi", subtitle: "Sistem Pengelolaan Terpadu" };

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Header title={meta.title} subtitle={meta.subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className="main-content">
          <PageTransition>{children ?? <Outlet />}</PageTransition>
        </main>
      </div>
    </div>
  );
}
