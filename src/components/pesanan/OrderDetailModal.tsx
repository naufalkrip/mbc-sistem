import { useState, useEffect } from "react";
import {
  MessageCircle,

  CheckCircle,
  Clock,
  Layers,


  ExternalLink,

  Copy,
  Check,
} from "lucide-react";
import type { OrderWithAnswers, OrderStatus } from "../../types";
import {

  formatNomorHp,
  formatNomorWhatsAppUrl,
  buatLinkWhatsAppPesanan,
} from "../../utils/format";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";

interface OrderDetailModalProps {
  order: OrderWithAnswers | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OrderStatus, adminNote?: string) => Promise<boolean>;
}

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string; icon: typeof Clock }[] = [
  { key: "masuk", label: "Masuk", desc: "Pesanan baru belum dikerjakan", icon: Clock },
  { key: "diproses", label: "Diproses", desc: "Sedang dikerjakan oleh tim MBC", icon: Layers },
  { key: "selesai", label: "Selesai", desc: "Pengerjaan telah rampung", icon: CheckCircle },
];

export function OrderDetailModal({ order, onClose, onUpdateStatus }: OrderDetailModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order?.status || "masuk");
  const [adminNote, setAdminNote] = useState<string>(order?.adminNote || "");
  const [updating, setUpdating] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Close lightbox on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxUrl(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!order) return null;

  // Temukan jenis pesanan dari answers jika ada
  const jenisAnswer = order.answers.find(
    (a) => String(a?.label || "").toLowerCase().includes("jenis") || String(a?.label || "").toLowerCase().includes("produk")
  );
  const jenisPesanan = jenisAnswer ? jenisAnswer.value : "Pesanan";

  const waUrl = buatLinkWhatsAppPesanan(
    order.whatsapp,
    order.customerName,
    order.id,
    jenisPesanan,
    currentStatus
  );

  const rawWaClean = formatNomorWhatsAppUrl(order.whatsapp);
  const directWaUrl = rawWaClean ? `https://wa.me/${rawWaClean}` : null;

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentStatus) return;
    setUpdating(true);
    const ok = await onUpdateStatus(order.id, newStatus, adminNote);
    setUpdating(false);
    if (ok) {
      setCurrentStatus(newStatus);
      toastSuccess(`Status pesanan ${order.id} berhasil diubah ke ${newStatus.toUpperCase()}`);
    } else {
      toastError("Gagal memperbarui status pesanan.");
    }
  };

  const handleSaveNote = async () => {
    setUpdating(true);
    const ok = await onUpdateStatus(order.id, currentStatus, adminNote);
    setUpdating(false);
    if (ok) {
      toastSuccess("Catatan admin berhasil disimpan.");
    } else {
      toastError("Gagal menyimpan catatan admin.");
    }
  };

  const copyWhatsApp = () => {
    if (order.whatsapp) {
      navigator.clipboard.writeText(order.whatsapp);
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2000);
      toastSuccess("Nomor WhatsApp berhasil disalin!");
    }
  };

  // Parsing Data Variants
  const parsedVariants: any[] = [];
  let totalQty = 0;
  let totalPrice = "";
  const otherAnswers: any[] = [];

  order.answers.forEach((ans) => {
    if (typeof ans.value === "string" && ans.value.includes("•")) {
      const lines = ans.value.split("\n");
      lines.forEach((line) => {
        if (line.trim().startsWith("•")) {
          const match = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\](?:\s*@\s*(.*?)=\s*(.*?))?$/i);
          if (match) {
            parsedVariants.push({
              qty: match[1],
              size: match[2],
              sleeve: match[3],
              unitPrice: match[4] ? match[4].trim() : "",
              subtotal: match[5] ? match[5].trim() : "",
              productName: jenisPesanan || "Pesanan Produk",
            });
          }
        } else if (line.includes("Total:")) {
          const matchTotal = line.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*(.*?)\))?/i);
          if (matchTotal) {
            totalQty = parseInt(matchTotal[1], 10);
            if (matchTotal[2]) totalPrice = matchTotal[2].trim();
          }
        }
      });
    } else {
      otherAnswers.push(ans);
    }
  });

  return (<>
    <Modal
      open={Boolean(order)}
      title={`DETAIL PESANAN: ${order.id}`}
      onClose={onClose}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            ID Pesanan: <strong>{order.id}</strong>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Tutup
          </button>
        </div>
      }
    >
      <div className="order-detail-container" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* TOP STATUS BAR & STEPPER */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              background: "#fff",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
            }}
          >
            {STATUS_STEPS.map((step) => {
              const active = currentStatus === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  disabled={updating}
                  onClick={() => handleStatusChange(step.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: active
                      ? step.key === "selesai"
                        ? "var(--green-600)"
                        : step.key === "diproses"
                        ? "var(--blue-600)"
                        : "var(--primary-700)"
                      : "transparent",
                    color: active ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: active ? 600 : 500,
                    fontSize: 13,
                    cursor: updating ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <step.icon size={15} />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* INFORMASI PEMESAN */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy-900)", margin: "0 0 12px 0", letterSpacing: "0.5px" }}>
            INFORMASI PEMESAN
          </h3>
          <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Nama Pemesan</span>
              <strong style={{ fontSize: 15, color: "var(--navy-900)" }}>{order.customerName || "-"}</strong>
            </div>
            
            <div>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>WhatsApp</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--navy-900)" }}>
                  {formatNomorHp(order.whatsapp)}
                </span>
                <button
                  type="button"
                  onClick={copyWhatsApp}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    color: copiedWA ? "var(--green-600)" : "var(--text-muted)",
                  }}
                  title="Salin nomor"
                >
                  {copiedWA ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          
          {directWaUrl && (
            <div style={{ marginTop: 16 }}>
              <a
                href={waUrl || directWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: "#25D366",
                  borderColor: "#25D366",
                  color: "#ffffff",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                <MessageCircle size={16} />
                <span>Chat Customer di WhatsApp</span>
              </a>
            </div>
          )}
        </div>

        {/* RINCIAN PESANAN */}
        {parsedVariants.length > 0 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy-900)", margin: "0 0 12px 0", letterSpacing: "0.5px" }}>
              RINCIAN PESANAN
            </h3>
            <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {parsedVariants.map((item, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", minWidth: 24, paddingTop: 2 }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong style={{ fontSize: 14, color: "var(--navy-900)" }}>{item.productName}</strong>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {item.size} <span style={{ margin: "0 4px", color: "var(--text-muted)" }}>•</span> {item.sleeve}
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>
                          {item.qty} pcs {item.unitPrice ? <span style={{ color: "var(--text-muted)" }}>× {item.unitPrice}</span> : ""}
                        </div>
                        {item.subtotal && (
                          <strong style={{ fontSize: 14, color: "var(--navy-900)" }}>
                            {item.subtotal}
                          </strong>
                        )}
                      </div>
                    </div>
                  </div>
                  {idx < parsedVariants.length - 1 && (
                    <div style={{ height: 1, background: "var(--border-soft)", margin: "16px 0 0 36px" }} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: "var(--border)", margin: "24px 0 16px 0" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>Total Item</span>
              <strong style={{ fontSize: 14, color: "var(--navy-900)" }}>{totalQty} pcs</strong>
            </div>
            
            {totalPrice && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--navy-900)", textTransform: "uppercase" }}>Total Pesanan</span>
                <strong style={{ fontSize: 16, fontWeight: 800, color: "var(--primary-700)" }}>{totalPrice}</strong>
              </div>
            )}
          </div>
        )}

        {/* PERTANYAAN LAINNYA */}
        {otherAnswers.length > 0 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy-900)", margin: "0 0 12px 0", letterSpacing: "0.5px" }}>
              DATA FORMULIR LAINNYA
            </h3>
            <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {otherAnswers.map((ans, idx) => (
                <div key={ans.id || idx}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    {ans.label}
                  </span>
                  <div style={{ fontSize: 14, color: "var(--navy-900)", wordBreak: "break-word" }}>
                    {(() => {
                      const imgTarget = ans.fileUrl || (ans.value?.startsWith("data:image/") || ans.value?.startsWith("http") ? ans.value : null);
                      const isImage = Boolean(
                        imgTarget &&
                        (imgTarget.startsWith("data:image/") ||
                         imgTarget.includes("drive.google") ||
                         imgTarget.includes("googleusercontent") ||
                         /\.(jpg|jpeg|png|webp|gif)$/i.test(imgTarget) ||
                         ans.fileType?.startsWith("image/"))
                      );

                      if (imgTarget) {
                        return (
                          <div style={{ marginTop: 6 }}>
                            {isImage ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                                <img
                                  src={imgTarget}
                                  alt={ans.label}
                                  title="Klik untuk melihat full screen"
                                  onClick={() => setLightboxUrl(imgTarget)}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                  style={{
                                    maxWidth: "320px",
                                    maxHeight: "240px",
                                    objectFit: "contain",
                                    borderRadius: 8,
                                    border: "1px solid var(--border)",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                    cursor: "zoom-in",
                                    background: "#f8f9fa",
                                    padding: 4,
                                  }}
                                />
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(imgTarget)}
                                    className="btn btn-outline btn-sm"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                                  >
                                    🔍 Lihat Full Screen
                                  </button>
                                  <a
                                    href={imgTarget}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline btn-sm"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                                  >
                                    <ExternalLink size={13} /> Buka di Tab Baru
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <a
                                href={imgTarget}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                              >
                                <ExternalLink size={13} /> Unduh / Lihat Berkas ({ans.fileName || "Lampiran"})
                              </a>
                            )}
                          </div>
                        );
                      }
                      return <span>{ans.value || "-"}</span>;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CATATAN INTERNAL ADMIN */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy-900)", margin: "0 0 12px 0", letterSpacing: "0.5px" }}>
            CATATAN INTERNAL ADMIN
          </h3>
          <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />
          
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>
            Catatan ini hanya dapat dilihat oleh admin MB Chondro dan tidak terlihat oleh customer.
          </p>
          <div style={{ background: "var(--bg-soft)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)" }}>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Tulis catatan pengerjaan, estimasi biaya, penanggung jawab, dll..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              style={{ width: "100%", fontSize: 13, background: "#fff", border: "1px solid var(--border)", marginBottom: 12 }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveNote}
              disabled={updating}
              style={{ fontSize: 12, padding: "6px 16px" }}
            >
              Simpan Catatan
            </button>
          </div>
        </div>
        
      </div>
    </Modal>

    {/* LIGHTBOX FULLSCREEN */}
    {lightboxUrl && (
      <div
        onClick={() => setLightboxUrl(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.94)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
            📷 Lampiran Foto Customer
          </span>
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              borderRadius: "50%",
              width: 36, height: 36,
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >✕</button>
        </div>
        <img
          src={lightboxUrl}
          alt="Lampiran foto"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => { (e.currentTarget as HTMLImageElement).alt = "Foto tidak dapat dimuat"; }}
          style={{
            maxWidth: "95vw",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 8,
            boxShadow: "0 0 60px rgba(0,0,0,0.8)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 16,
            color: "rgba(255,255,255,0.6)",
            fontSize: 12,
            background: "rgba(0,0,0,0.5)",
            padding: "5px 12px",
            borderRadius: 20,
            pointerEvents: "none",
          }}
        >
          Klik area gelap atau tekan ESC untuk menutup
        </div>
      </div>
    )}
  </>);
}
