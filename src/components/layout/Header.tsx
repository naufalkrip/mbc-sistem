import { Menu, Calendar } from "lucide-react";
import { formatTanggalPanjang } from "../../utils/format";
import { useHeaderAction } from "../../contexts/HeaderActionContext";
import { ConnectionIndicator } from "./ConnectionIndicator";

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
      <button className="btn-icon hamburger" onClick={onMenuClick} aria-label="Buka menu">
        <Menu size={22} />
      </button>
      <div className="header-main">
        <div className="header-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="header-right">
        {action && <div className="header-action">{action}</div>}
        <ConnectionIndicator />
        <div className="header-date">
          <span className="header-date-label">HARI INI</span>
          <span className="header-date-value">
            <Calendar size={14} style={{ marginRight: 6 }} />
            {today}
          </span>
        </div>
      </div>
    </header>
  );
}