import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { API_URL } from "../config";

export type ConnectionStatus = "connected" | "disconnected" | "checking";

interface ConnectionContextType {
  status: ConnectionStatus;
  checkConnection: () => Promise<void>;
  isOnline: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "disconnected";
    }
    return "checking";
  });

  const failureCountRef = useRef(0);
  const isCheckingRef = useRef(false);
  const mountedRef = useRef(false);

  const checkConnection = useCallback(async () => {
    if (API_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID")) {
      setStatus("disconnected");
      return;
    }

    // 1. Cek jaringan perangkat pengguna terlebih dahulu
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      setStatus("disconnected");
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setStatus("checking");

    try {
      // Timeout dipercepat dari 12s menjadi 5s untuk responsivitas lebih cepat
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Gunakan URL GET ping ringan (action=setup) yang cepat dan tidak berat
      const pingUrl = `${API_URL}${API_URL.includes("?") ? "&" : "?"}action=setup&_t=${Date.now()}`;
      const response = await fetch(pingUrl, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        if (text.includes("success") || text.includes("Setup") || text.includes("data") || response.status === 200) {
          failureCountRef.current = 0;
          setIsOnline(true);
          setStatus("connected");
          return;
        }
      }

      // Jika response bukan ok, naikkan failure count
      failureCountRef.current += 1;
      // Berikan toleransi retry hingga 2x gagal sebelum mengubah status ke disconnected (dari 3x)
      if (failureCountRef.current >= 2) {
        setStatus("disconnected");
      } else {
        setStatus("connected");
      }
    } catch {
      // Jika jaringan lokal browser memang online, jangan langsung offline kan
      // karena Apps Script terkadang sleep atau timeout sesaat
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        setStatus("disconnected");
      } else {
        failureCountRef.current += 1;
        if (failureCountRef.current >= 2) {
          setStatus("disconnected");
        } else {
          setStatus("connected");
        }
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  // Listener untuk online / offline event bawaan browser
  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => {
      setIsOnline(true);
      setStatus("checking");
      failureCountRef.current = 0;
      void checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial immediate check - don't wait
    if (mountedRef.current) {
      void checkConnection();
    }

    // Polling periodik dipercepat menjadi 20 detik untuk real-time feel
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && mountedRef.current) {
        void checkConnection();
      }
    }, 20000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  return (
    <ConnectionContext.Provider value={{ status, checkConnection, isOnline }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnectionStatus() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error("useConnectionStatus must be used within a ConnectionProvider");
  }
  return context;
}