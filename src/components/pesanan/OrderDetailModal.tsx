import { useState } from "react";
import {
  MessageCircle,
  Calendar,
  CheckCircle,
  Clock,
  Layers,
  FileText,
  User,
  ExternalLink,
  Edit3,
  Copy,
  Check,
} from "lucide-react";
import type { OrderWithAnswers, OrderStatus } from "../../types";
import {
  formatTanggalPanjang,
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

  if (!order) return null;

  // Temukan jenis pesanan dari answers jika ada
  const jenisAnswer = order.answers.find(
    (a) => a.label.toLowerCase().includes("jenis") || a.label.toLowerCase().includes("produk")
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

  return (
    <Modal
      open={Boolean(order)}
      title={`Detail Pesanan: ${order.id}`}
      onClose={onClose}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            ID Pesanan: <strong>{order.id}</strong>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      }
    >
      <div className="order-detail-container" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* TOP STATUS BAR & STEPPER */}
        <div
          style={{
            background: "var(--bg-soft)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
              ALUR STATUS PENGERJAAN
            </span>
            <span
              className={`status-pill status-${currentStatus}`}
              style={{
                textTransform: "uppercase",
                fontWeight: 700,
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {currentStatus}
            </span>
          </div>

          {/* Segmented Control / Status Selector */}
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

        {/* SECTION 1: CUSTOMER & WHATSAPP ACTION */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {/* Card Info Customer */}
          <div
            style={{
              padding: 16,
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <User size={18} style={{ color: "var(--primary-700)" }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Informasi Customer</h4>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Nama Customer</span>
                <strong style={{ fontSize: 15, color: "var(--text)" }}>{order.customerName || "-"}</strong>
              </div>

              <div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Nomor WhatsApp</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
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

              {directWaUrl && (
                <div style={{ marginTop: 4 }}>
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
                      width: "100%",
                      padding: "9px 14px",
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
                    <ExternalLink size={13} style={{ opacity: 0.8 }} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Card Info Waktu & Formulir */}
          <div
            style={{
              padding: 16,
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Calendar size={18} style={{ color: "var(--primary-700)" }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Waktu & Asal Formulir</h4>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Tanggal Masuk</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                  {formatTanggalPanjang(order.createdAt)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Terakhir Diperbarui</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {order.updatedAt ? formatTanggalPanjang(order.updatedAt) : "-"}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Formulir Terkait</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                  {order.form?.title || "Form Pemesanan Standar MB Chondro"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: RINCIAN ISIAN / JAWABAN CUSTOMER */}
        <div
          style={{
            padding: 18,
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <FileText size={18} style={{ color: "var(--primary-700)" }} />
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Rincian & Pertanyaan Formulir</h4>
          </div>

          {order.answers.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Tidak ada rincian data formulir tambahan.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {order.answers.map((ans, idx) => (
                <div
                  key={ans.id || idx}
                  style={{
                    padding: "10px 14px",
                    background: "var(--bg-soft)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-soft)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
                    {ans.label}
                  </span>
                  <div style={{ fontSize: 14, color: "var(--text)", wordBreak: "break-word" }}>
                    {ans.fileUrl ? (
                      <div style={{ marginTop: 6 }}>
                        {ans.fileUrl.startsWith("data:image/") || ans.fileUrl.includes("drive.google") ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <img
                              src={ans.fileUrl}
                              alt={ans.label}
                              style={{
                                maxWidth: "240px",
                                maxHeight: "180px",
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                              }}
                            />
                            <a
                              href={ans.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 12, color: "var(--primary-700)", textDecoration: "underline" }}
                            >
                              Buka Gambar Resolusi Penuh
                            </a>
                          </div>
                        ) : (
                          <a
                            href={ans.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                            style={{ display: "inline-flex", gap: 6, fontSize: 12, padding: "5px 10px" }}
                          >
                            <ExternalLink size={13} />
                            Lihat File Berkas
                          </a>
                        )}
                      </div>
                    ) : (
                      <span>{ans.value || "-"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: CATATAN INTERNAL ADMIN */}
        <div
          style={{
            padding: 16,
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Edit3 size={16} style={{ color: "var(--primary-700)" }} />
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Catatan Internal Admin</h4>
          </div>
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>
            Catatan ini hanya dapat dilihat oleh admin MB Chondro (tidak terlihat oleh customer).
          </p>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Tulis catatan pengerjaan, estimasi biaya, penanggung jawab, dll..."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            style={{ width: "100%", fontSize: 13 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSaveNote}
              disabled={updating}
              style={{ fontSize: 12, padding: "6px 14px" }}
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
