import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "compact" | "desktop";

interface ViewModeContextType {
  viewMode: ViewMode;
  toggleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
}

const STORAGE_KEY = "mbc_view_mode";

const ViewModeContext = createContext<ViewModeContextType | null>(null);

function applyViewport(mode: ViewMode) {
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }

  if (mode === "desktop") {
    // Menetapkan viewport lebar desktop 1180px dengan initial scale proporsional
    const screenWidth = window.screen.width || window.innerWidth || 390;
    const initialScale = Math.max(0.25, Math.min(1.0, +(screenWidth / 1180).toFixed(2)));
    meta.content = `width=1180, initial-scale=${initialScale}, maximum-scale=3.0, user-scalable=yes`;
    document.documentElement.classList.add("desktop-mode-active");
    document.body.classList.add("desktop-mode-active");
  } else {
    // Mode compact responsive mobile
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=3.0";
    document.documentElement.classList.remove("desktop-mode-active");
    document.body.classList.remove("desktop-mode-active");
  }
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "desktop" ? "desktop" : "compact";
    } catch {
      return "compact";
    }
  });

  useEffect(() => {
    applyViewport(viewMode);
  }, [viewMode]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    applyViewport(mode);
  };

  const toggleViewMode = () => {
    const next = viewMode === "desktop" ? "compact" : "desktop";
    setViewMode(next);
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, toggleViewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return ctx;
}
