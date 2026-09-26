import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  ShoppingBag,
  Ticket,
  X,
  ChevronDown,
  ChevronRight,
  History,
  ClipboardList,
  ScrollText,
} from "lucide-react";
import logo from "../../aset/logo.png";
import { useAuth } from "../../contexts/AuthContext";

type NavItemSimple = {
  type: "link";
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
};

type NavItemGroup = {
  type: "group";
  label: string;
  icon: React.ElementType;
  matchPaths: string[];
  children: { to: string; label: string; icon: React.ElementType }[];
};

type NavItem = NavItemSimple | NavItemGroup;

const NAV_ITEMS: NavItem[] = [
  { type: "link", to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { type: "link", to: "/anggota", label: "Anggota", icon: Users },
  {
    type: "group",
    label: "Absensi",
    icon: ClipboardCheck,
    matchPaths: ["/absensi"],
    children: [
      { to: "/absensi", label: "Input Absensi", icon: ClipboardCheck },
      { to: "/absensi?tab=riwayat", label: "Riwayat Absensi", icon: History },
    ],
  },
  { type: "link", to: "/keuangan", label: "Keuangan", icon: Wallet },
  { type: "link", to: "/keuangan-media", label: "Keuangan Media", icon: WalletCards },
  { type: "link", to: "/transaksi", label: "Transaksi", icon: FileText },
  {
    type: "group",
    label: "Rekruitmen",
    icon: UserPlus,
    matchPaths: ["/rekrutmen"],
    children: [
      { to: "/rekrutmen", label: "Calon Anggota", icon: ClipboardList },
      { to: "/rekrutmen?tab=form", label: "Formulir Pendaftaran", icon: ScrollText },
    ],
  },
  {
    type: "group",
    label: "Kelola Pesanan",
    icon: ShoppingBag,
    matchPaths: ["/pesanan"],
    children: [
      { to: "/pesanan", label: "Daftar Pesanan", icon: ClipboardList },
      { to: "/pesanan?tab=formulir", label: "Formulir Pesanan", icon: ScrollText },
    ],
  },
  { type: "link", to: "/kupon/kelola", label: "Kupon", icon: Ticket },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_ITEMS.forEach((item) => {
      if (item.type === "group") {
        const isActive = item.matchPaths.some(
          (p) => location.pathname === p || location.pathname.startsWith(p + "/")
        );
        initial[item.label] = isActive;
      }
    });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

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
          {NAV_ITEMS.map((item) => {
            if (item.type === "link") {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? "nav-active" : ""}`}
                  onClick={onClose}
                >
                  <item.icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            }

            // Group with dropdown
            const isGroupActive = item.matchPaths.some(
              (p) => location.pathname === p || location.pathname.startsWith(p + "/")
            );
            const isOpen = openGroups[item.label] ?? isGroupActive;

            return (
              <div key={item.label} className="nav-group">
                <button
                  type="button"
                  className={`nav-link nav-group-trigger ${isGroupActive ? "nav-active" : ""}`}
                  onClick={() => toggleGroup(item.label)}
                  aria-expanded={isOpen}
                >
                  <item.icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                  {isOpen
                    ? <ChevronDown size={14} style={{ marginLeft: "auto" }} />
                    : <ChevronRight size={14} style={{ marginLeft: "auto" }} />
                  }
                </button>
                {isOpen && (
                  <div className="nav-group-children">
                    {item.children.map((child) => {
                      const isChildActive = child.to.includes("?")
                        ? location.pathname + location.search === child.to
                        : location.pathname === child.to && !location.search.includes("tab=");
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`nav-link nav-child-link ${isChildActive ? "nav-active" : ""}`}
                          onClick={onClose}
                        >
                          <child.icon size={15} strokeWidth={2} aria-hidden="true" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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