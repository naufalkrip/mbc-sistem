import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { PageTransition } from "../ui/PageTransition";
import { Outlet } from "react-router-dom";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Ringkasan data organisasi" },
  "/pesanan": { title: "Kelola Pesanan", subtitle: "Kelola formulir, pesanan customer, dan status pengerjaan dalam satu tempat." },
  "/anggota": { title: "Data Anggota", subtitle: "Kelola anggota mbc sistem" },
  "/absensi": { title: "Absensi", subtitle: "Kelola kehadiran anggota mbc sistem" },
  "/keuangan": { title: "Keuangan mbc sistem", subtitle: "Kelola kas mbc sistem" },
  "/transaksi": { title: "Transaksi", subtitle: "Kelola transaksi temporer" },
  "/rekrutmen": { title: "Rekruitmen", subtitle: "Kelola pendaftaran calon anggota" },
  "/rekrutmen/daftar": { title: "Pendaftaran Anggota", subtitle: "Formulir pendaftaran calon anggota" },
  "/keuangan-media": { title: "Keuangan Media mbc sistem", subtitle: "Kelola kas Media mbc sistem" },
  "/kupon/kelola": { title: "Kelola Kupon", subtitle: "Kelola titik penjualan kupon Jalan Sehat MB Chondro" },
};

export function Layout({ children }: { children?: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const meta = TITLES[location.pathname] ?? { title: "MB CHONDRO", subtitle: "Sistem Manajemen Organisasi" };

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Header title={meta.title} subtitle={meta.subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className="main-content">
          <PageTransition>{children ?? <Outlet />}</PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}