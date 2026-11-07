import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Camera,
  RefreshCw,
} from "lucide-react";

export interface LightboxItem {
  id?: string;
  url: string;
  title: string;
  subtitle?: string;
  status?: string;
  fileName?: string;
  driveFileId?: string;
}

export interface PhotoLightboxModalProps {
  isOpen: boolean;
  items: LightboxItem[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  onResolveDrivePhoto?: (item: LightboxItem) => Promise<string | null>;
}

export function PhotoLightboxModal({
  isOpen,
  items,
  currentIndex,
  onClose,
  onIndexChange,
  onResolveDrivePhoto,
}: PhotoLightboxModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const currentItem = items[currentIndex] || null;

  // Reset transforms whenever index changes or modal opens
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
    setHasError(false);
    setLoading(false);
    setResolvedUrl(null);
  }, [currentIndex, isOpen]);

  const activeSrc = resolvedUrl || currentItem?.url || "";

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        if (items.length > 1 && currentIndex > 0 && onIndexChange) {
          e.preventDefault();
          onIndexChange(currentIndex - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (items.length > 1 && currentIndex < items.length - 1 && onIndexChange) {
          e.preventDefault();
          onIndexChange(currentIndex + 1);
        }
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, items.length, onClose, onIndexChange]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.15, 4));
    } else {
      setZoom((z) => Math.max(z - 0.15, 0.5));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownload = () => {
    if (!activeSrc || !currentItem) return;
    const cleanTitle = (currentItem.title || "foto-anggota")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    const fileName = currentItem.fileName || `${cleanTitle}.jpg`;

    const a = document.createElement("a");
    a.href = activeSrc;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (!activeSrc) return;
    window.open(activeSrc, "_blank");
  };

  const handleResolveImage = useCallback(async () => {
    if (!currentItem || !onResolveDrivePhoto) return;
    setLoading(true);
    setHasError(false);
    try {
      const res = await onResolveDrivePhoto(currentItem);
      if (res) {
        setResolvedUrl(res);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [currentItem, onResolveDrivePhoto]);

  if (!isOpen || !currentItem) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(11, 15, 25, 0.92)",
        backdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999999,
        animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        userSelect: "none",
      }}
    >
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          height: 64,
          padding: "0 20px",
          background: "rgba(15, 23, 42, 0.8)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#ffffff",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(185, 28, 28, 0.4)",
              flexShrink: 0,
            }}
          >
            <Camera size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#f8fafc",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {currentItem.title}
              </strong>
              {currentItem.status && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 12,
                    background:
                      currentItem.status === "lolos"
                        ? "rgba(16, 185, 129, 0.2)"
                        : currentItem.status === "cadangan"
                        ? "rgba(14, 165, 233, 0.2)"
                        : "rgba(245, 158, 11, 0.2)",
                    color:
                      currentItem.status === "lolos"
                        ? "#34d399"
                        : currentItem.status === "cadangan"
                        ? "#38bdf8"
                        : "#fbbf24",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                  }}
                >
                  {currentItem.status}
                </span>
              )}
            </div>
            {currentItem.subtitle && (
              <span
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {currentItem.subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Toolbar controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: 8,
              padding: 2,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              marginRight: 8,
            }}
          >
            <button
              type="button"
              onClick={handleZoomOut}
              style={{
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Perkecil (-)"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              style={{
                background: "transparent",
                border: "none",
                color: "#38bdf8",
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 6,
                cursor: "pointer",
              }}
              title="Reset Zoom & Rotasi"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              style={{
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              title="Perbesar (+)"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleRotate}
              style={{
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                marginLeft: 2,
              }}
              title="Putar Foto (R)"
            >
              <RotateCw size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
            title="Unduh Foto Ke Komputer"
          >
            <Download size={15} /> Unduh
          </button>

          <button
            type="button"
            onClick={handleOpenNewTab}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              padding: "7px 10px",
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
            title="Buka Foto di Tab Baru"
          >
            <ExternalLink size={15} />
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              padding: "7px 10px",
              borderRadius: 8,
              cursor: "pointer",
              marginLeft: 6,
              display: "inline-flex",
              alignItems: "center",
            }}
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image View Container */}
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          padding: 24,
        }}
      >
        {/* Navigation Previous Button */}
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onIndexChange) onIndexChange(currentIndex - 1);
            }}
            style={{
              position: "absolute",
              left: 20,
              zIndex: 10,
              background: "rgba(15, 23, 42, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              width: 46,
              height: 46,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              transition: "transform 0.15s ease, background 0.15s ease",
            }}
            title="Foto Sebelumnya (Kiri)"
          >
            <ChevronLeft size={26} />
          </button>
        )}

        {/* Image Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "#f8fafc" }}>
            <div
              style={{
                width: 44,
                height: 44,
                border: "3px solid rgba(255,255,255,0.2)",
                borderTopColor: "#38bdf8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: 14, color: "#cbd5e1" }}>Memulihkan dan memuat foto HD...</span>
          </div>
        ) : hasError ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              color: "#f8fafc",
              maxWidth: 420,
              textAlign: "center",
              background: "rgba(30, 41, 59, 0.8)",
              padding: "28px 24px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Camera size={52} style={{ color: "#94a3b8" }} />
            <strong style={{ fontSize: 16, color: "#f8fafc" }}>Pratinjau Foto Membutuhkan Resolusi</strong>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              Foto pendaftaran tersimpan di Google Drive. Klik tombol di bawah untuk mengambil data foto langsung dalam kualitas tinggi.
            </p>
            {onResolveDrivePhoto && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResolveImage}
                style={{
                  marginTop: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={15} /> Muat Foto HD Sekarang
              </button>
            )}
          </div>
        ) : (
          <img
            src={activeSrc}
            alt={currentItem.title}
            referrerPolicy="no-referrer"
            onError={() => {
              if (onResolveDrivePhoto && !resolvedUrl) {
                handleResolveImage();
              } else {
                setHasError(true);
              }
            }}
            style={{
              maxWidth: "90vw",
              maxHeight: "82vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
              pointerEvents: "auto",
            }}
          />
        )}

        {/* Navigation Next Button */}
        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onIndexChange) onIndexChange(currentIndex + 1);
            }}
            style={{
              position: "absolute",
              right: 20,
              zIndex: 10,
              background: "rgba(15, 23, 42, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              width: 46,
              height: 46,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              transition: "transform 0.15s ease, background 0.15s ease",
            }}
            title="Foto Selanjutnya (Kanan)"
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      {/* Bottom Footer Info & Keyboard Hints */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          height: 44,
          padding: "0 20px",
          background: "rgba(15, 23, 42, 0.8)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#94a3b8",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <div>
          {items.length > 1 ? (
            <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
              Foto {currentIndex + 1} dari {items.length} calon
            </span>
          ) : (
            <span>Pratinjau Foto Calon</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span>⌨️ Gunakan <strong>⬅ ➡</strong> navigasi • <strong>+ / -</strong> zoom • <strong>R</strong> putar foto • <strong>Esc</strong> tutup</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
