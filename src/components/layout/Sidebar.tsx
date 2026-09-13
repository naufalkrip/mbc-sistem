import { NavLink } from "react-router-dom";
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import logo from "../../aset/logo.png";
import { useAuth } from "../../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/anggota", label: "Anggota", icon: Users },
  { to: "/absensi", label: "Absensi", icon: ClipboardCheck },
  { to: "/keuangan", label: "Keuangan", icon: Wallet },
  { to: "/keuangan-media", label: "Keuangan Media", icon: WalletCards },
  { to: "/transaksi", label: "Transaksi", icon: FileText },
  { to: "/rekrutmen", label: "Rekruitmen", icon: UserPlus },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (window.confirm("Apakah Anda yakin ingin keluar dari sistem mbc sistem?")) {
      logout();
    }
  };

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Menu samping">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <img src={logo} alt="Logo mbc sistem" />
          </div>
          <div className="brand-text">
            <strong>MB CHONDRO</strong>
            <span>Manajemen Organisasi</span>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Tutup menu">
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "nav-active" : ""}`}
              onClick={onClose}
            >
              <item.icon size={19} strokeWidth={2} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logged in User Card */}
        {user && (
          <div className="sidebar-user-block">
            <div className="sidebar-user-avatar">
              {user.nama ? user.nama.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.nama || user.username}</span>
              <span className="sidebar-user-role">@{user.username} · {user.role || "Admin"}</span>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Keluar dari Sistem"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <span>© {new Date().getFullYear()} mbc sistem</span>
          <span>v1.0.0</span>
        </div>
      </aside>
    </>
  );
}