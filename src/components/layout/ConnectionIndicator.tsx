import { useConnectionStatus } from "../../contexts/ConnectionContext";

export function ConnectionIndicator() {
  const { status } = useConnectionStatus();

  return (
    <div className="connection-indicator" title={status === "connected" ? "Terhubung" : status === "disconnected" ? "Terputus" : "Memeriksa..."}>
      <span className={`connection-dot ${status}`} />
      <span className="connection-label">
        {status === "connected" ? "Online" : status === "disconnected" ? "Offline" : "..."}
      </span>
    </div>
  );
}