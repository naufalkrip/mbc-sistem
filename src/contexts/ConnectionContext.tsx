import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API_URL } from "../config";

type ConnectionStatus = "connected" | "disconnected" | "checking";

interface ConnectionContextType {
  status: ConnectionStatus;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  const checkConnection = async () => {
    if (API_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID")) {
      setStatus("disconnected");
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getDashboard", data: {} }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        const parsed = JSON.parse(text);
        if (parsed.success === true) {
          setStatus("connected");
          return;
        }
      }
      setStatus("disconnected");
    } catch {
      setStatus("disconnected");
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ConnectionContext.Provider value={{ status }}>
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