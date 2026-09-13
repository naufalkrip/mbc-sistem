import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "../types";
import { loginApi } from "../services/api";

// Batas waktu tidak ada aktivitas sebelum otomatis logout (15 Menit)
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionNotice: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: (reason?: string) => void;
  clearSessionNotice: () => void;
}

const STORAGE_KEY = "mb_chondro_auth_user";
const LAST_ACTIVITY_KEY = "mb_chondro_last_activity";
const SESSION_EXPIRED_KEY = "mb_chondro_session_expired";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionNotice, setSessionNotice] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_EXPIRED_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);

      if (stored) {
        // Cek apakah sesi yang tersimpan sudah melebihi batas waktu inaktivitas
        if (lastActive) {
          const timeElapsed = Date.now() - parseInt(lastActive, 10);
          if (timeElapsed > INACTIVITY_TIMEOUT_MS) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LAST_ACTIVITY_KEY);
            localStorage.setItem(
              SESSION_EXPIRED_KEY,
              "Sesi Anda telah berakhir karena tidak ada aktivitas selama 15 menit. Silakan masuk kembali."
            );
            return null;
          }
        }
        // Perbarui timestamp aktivitas saat ini jika masih aktif
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
        return JSON.parse(stored) as User;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const lastWriteRef = useRef<number>(Date.now());

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
    try {
      localStorage.removeItem(SESSION_EXPIRED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback((reason?: string) => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      if (reason) {
        localStorage.setItem(SESSION_EXPIRED_KEY, reason);
        setSessionNotice(reason);
      } else {
        localStorage.removeItem(SESSION_EXPIRED_KEY);
        setSessionNotice(null);
      }
    } catch {
      // ignore
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<User> => {
      setIsLoading(true);
      try {
        const loggedUser = await loginApi(username, password);
        const now = Date.now().toString();
        setUser(loggedUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
        localStorage.setItem(LAST_ACTIVITY_KEY, now);
        localStorage.removeItem(SESSION_EXPIRED_KEY);
        setSessionNotice(null);
        return loggedUser;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Sync dengan event storage lintas browser tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setUser(e.newValue ? (JSON.parse(e.newValue) as User) : null);
        } catch {
          setUser(null);
        }
      } else if (e.key === SESSION_EXPIRED_KEY) {
        setSessionNotice(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Monitor aktivitas pengguna untuk Auto-Logout saat idle / inaktif
  useEffect(() => {
    if (!user) return;

    // Perbarui timestamp aktivitas dengan throttling (maksimal 1 kali tiap 3 detik)
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current > 3000) {
        lastWriteRef.current = now;
        try {
          localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        } catch {
          // ignore
        }
      }
    };

    // Fungsi pengecekan inaktivitas
    const checkInactivity = () => {
      try {
        const lastActiveStr = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!lastActiveStr) {
          updateActivity();
          return;
        }
        const lastActive = parseInt(lastActiveStr, 10);
        const elapsed = Date.now() - lastActive;

        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          logout(
            "Sesi Anda telah berakhir karena tidak ada aktivitas selama 15 menit. Demi keamanan akun, silakan masuk kembali."
          );
        }
      } catch {
        // ignore
      }
    };

    // Daftar event aktivitas yang dipantau
    const activityEvents = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "mousemove",
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, updateActivity, { passive: true });
    });

    // Pengecekan berkala setiap 10 detik
    const timerInterval = setInterval(checkInactivity, 10000);

    // Pengecekan instan saat tab dibuka kembali atau laptop bangun dari sleep
    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        checkInactivity();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, updateActivity);
      });
      clearInterval(timerInterval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [user, logout]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    sessionNotice,
    login,
    logout,
    clearSessionNotice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

