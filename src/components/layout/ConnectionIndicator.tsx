import { useConnectionStatus } from "../../contexts/ConnectionContext";

export function ConnectionIndicator() {
  const { status, checkConnection } = useConnectionStatus();

  return (
    <button
      type="button"
      className="connection-indicator"
      onClick={() => void checkConnection()}
      title={
        status === "connected"
          ? "Database Terhubung (Online). Klik untuk cek ulang."
          : status === "disconnected"
          ? "Koneksi Terputus (Offline). Klik untuk mencoba kembali."
          : "Memeriksa status koneksi database..."
      }
      style={{ cursor: "pointer", border: "1px solid var(--border)" }}
    >
      <span className={`connection-dot ${status}`} />
      <span className="connection-label">
        {status === "connected" ? "Online" : status === "disconnected" ? "Offline" : "Menghubungkan..."}
      </span>
    </button>
  );
}