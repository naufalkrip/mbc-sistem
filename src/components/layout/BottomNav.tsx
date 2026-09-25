import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Wallet,
  Menu,
  X,
  WalletCards,
  FileText,
  UserPlus,
  ShoppingBag,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface BottomNavProps {
  onOpenMenu?: () => void;
}

export function BottomNav({}: BottomNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (window.confirm("Apakah Anda yakin ingin keluar dari sistem MB Chondro?")) {
      setSheetOpen(false);
      logout();
    }
  };

  const isMoreActive =
    location.pathname === "/pesanan" ||
    location.pathname.startsWith("/pesanan/") ||
    location.pathname === "/keuangan-media" ||
    location.pathname === "/transaksi" ||
    location.pathname.startsWith("/transaksi/") ||
    location.pathname === "/rekrutmen" ||
    location.pathname.startsWith("/rekrutmen/");

  return (
    <>
      {/* Bottom Navigation Bar (Visible only on mobile < 640px) */}
      <nav className="bottom-nav" aria-label="Navigasi Utama Mobile">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <LayoutDashboard size={20} strokeWidth={2} />
          </div>
          <span className="bottom-nav-label">Dashboard</span>
        </NavLink>

        <NavLink
          to="/anggota"
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <Users size={20} strokeWidth={2} />
          </div>
          <span className="bottom-nav-label">Anggota</span>
        </NavLink>

        <NavLink
          to="/absensi"
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <ClipboardCheck size={20} strokeWidth={2} />
          </div>
          <span className="bottom-nav-label">Absensi</span>
        </NavLink>

        <NavLink
          to="/keuangan"
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <Wallet size={20} strokeWidth={2} />
          </div>
          <span className="bottom-nav-label">Keuangan</span>
        </NavLink>

        <button
          type="button"
          className={`bottom-nav-item ${sheetOpen || isMoreActive ? "active" : ""}`}
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-label="Buka menu lainnya"
        >
          <div className="bottom-nav-icon-wrap">
            <Menu size={20} strokeWidth={2} />
          </div>
          <span className="bottom-nav-label">Menu</span>
        </button>
      </nav>

      {/* Mobile Drawer Sheet for Additional Menus & Account */}
      {sheetOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div
            className="mobile-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Menu Navigasi Lainnya"
          >
            {/* Drag Handle Indicator */}
            <div className="mobile-sheet-handle" />

            <div className="mobile-sheet-header">
              <div className="mobile-sheet-title">
                <strong>Menu Sistem</strong>
                <span>Fitur Tambahan & Akun</span>
              </div>
              <button
                type="button"
                className="btn-icon mobile-sheet-close"
                onClick={() => setSheetOpen(false)}
                aria-label="Tutup menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu List */}
            <div className="mobile-sheet-body">
              <div className="mobile-sheet-section">
                <span className="mobile-sheet-heading">MODUL ORGANISASI</span>

                <NavLink
                  to="/keuangan-media"
                  className={({ isActive }) => `mobile-sheet-link ${isActive ? "active" : ""}`}
                  onClick={() => setSheetOpen(false)}
                >
                  <div className="mobile-sheet-icon kas-media">
                    <WalletCards size={18} />
                  </div>
                  <div className="mobile-sheet-link-info">
                    <strong>Kas Media</strong>
                    <span>Kelola arus kas & anggaran publikasi</span>
                  </div>
                  <ChevronRight size={16} className="chevron-right" />
                </NavLink>

                <NavLink
                  to="/transaksi"
                  className={({ isActive }) => `mobile-sheet-link ${isActive ? "active" : ""}`}
                  onClick={() => setSheetOpen(false)}
                >
                  <div className="mobile-sheet-icon transaksi">
                    <FileText size={18} />
                  </div>
                  <div className="mobile-sheet-link-info">
                    <strong>Transaksi Temporer</strong>
                    <span>Pencatatan kegiatan pos proyek temporer</span>
                  </div>
                  <ChevronRight size={16} className="chevron-right" />
                </NavLink>

                <NavLink
                  to="/rekrutmen"
                  className={({ isActive }) => `mobile-sheet-link ${isActive ? "active" : ""}`}
                  onClick={() => setSheetOpen(false)}
                >
                  <div className="mobile-sheet-icon rekrutmen">
                    <UserPlus size={18} />
                  </div>
                  <div className="mobile-sheet-link-info">
                    <strong>Rekruitmen</strong>
                    <span>Penerimaan & seleksi pendaftar baru</span>
                  </div>
                  <ChevronRight size={16} className="chevron-right" />
                </NavLink>

                <NavLink
                  to="/pesanan"
                  className={({ isActive }) => `mobile-sheet-link ${isActive ? "active" : ""}`}
                  onClick={() => setSheetOpen(false)}
                >
                  <div className="mobile-sheet-icon" style={{ background: "rgba(220, 38, 38, 0.12)", color: "var(--primary-700)" }}>
                    <ShoppingBag size={18} />
                  </div>
                  <div className="mobile-sheet-link-info">
                    <strong>Kelola Pesanan</strong>
                    <span>Formulir & pemesanan kaos MBC</span>
                  </div>
                  <ChevronRight size={16} className="chevron-right" />
                </NavLink>
              </div>

              {/* User Profile Card & Logout */}
              {user && (
                <div className="mobile-sheet-user-card">
                  <div className="mobile-sheet-user-head">
                    <div className="mobile-sheet-avatar">
                      {user.nama ? user.nama.charAt(0).toUpperCase() : "A"}
                    </div>
                    <div className="mobile-sheet-user-details">
                      <strong>{user.nama || user.username}</strong>
                      <span>
                        <ShieldCheck size={12} style={{ display: "inline", verticalAlign: "-1px" }} />{" "}
                        {user.role || "Admin"} · @{user.username}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mobile-sheet-logout-btn"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Keluar dari Akun</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
