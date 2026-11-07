import { Menu, Calendar, Bell } from "lucide-react";
import { formatTanggalPanjang } from "../../utils/format";
import { useHeaderAction } from "../../contexts/HeaderActionContext";
import { ConnectionIndicator } from "./ConnectionIndicator";
import logo from "../../aset/logo.png";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { action } = useHeaderAction();
  const today = formatTanggalPanjang(new Date().toISOString());

  return (
    <header className="header header-enter">
      {/* Tombol Hamburger di kiri untuk mobile */}
      <button className="btn-icon hamburger" onClick={onMenuClick} aria-label="Buka menu navigasi">
        <Menu size={20} />
      </button>

      {/* Logo MB Chondro untuk mobile */}
      <img src={logo} alt="MB CHONDRO" className="header-mobile-logo" />

      {/* Main Header Desktop & Mobile: Judul Halaman & Subjudul */}
      <div className="header-main">
        <div className="header-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      {/* Header Kanan: Action, Notifikasi, Koneksi, Tanggal */}
      <div className="header-right">
        {action && <div className="header-action">{action}</div>}

        {/* Mobile Notification Icon di Kanan Header (Khusus Mobile) */}
        <button
          type="button"
          className="mobile-notification-btn"
          title="Notifikasi Sistem"
          aria-label="Notifikasi"
        >
          <Bell size={18} />
          <span className="mobile-notification-dot" />
        </button>

        <ConnectionIndicator />
        <div className="header-date">
          <span className="header-date-label">HARI INI</span>
          <span className="header-date-value">
            <Calendar size={13} />
            {today}
          </span>
        </div>
      </div>
    </header>
  );
}
