import { useState, useEffect } from "react";
import {
  MessageCircle,
  CheckCircle,
  Clock,
  Layers,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  User,
  CreditCard,
  Package,
  FileText,
  Maximize2,
} from "lucide-react";
import type { OrderWithAnswers, OrderStatus, PaymentStatus } from "../../types";
import {
  formatNomorHp,
  formatNomorWhatsAppUrl,
  buatLinkWhatsAppPesanan,
  formatRupiah,
  formatTanggalPanjang,
} from "../../utils/format";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";

interface OrderDetailModalProps {
  order: OrderWithAnswers | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OrderStatus, adminNote?: string) => Promise<boolean>;
  onUpdatePayment?: (id: string, dpAmount: number, paymentStatus: PaymentStatus) => Promise<boolean>;
}

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string; icon: typeof Clock }[] = [
  { key: "masuk", label: "Masuk", desc: "Pesanan baru belum dikerjakan", icon: Clock },
  { key: "diproses", label: "Diproses", desc: "Sedang dikerjakan oleh tim MBC", icon: Layers },
  { key: "selesai", label: "Selesai", desc: "Pengerjaan telah rampung", icon: CheckCircle },
];

export function OrderDetailModal({ order, onClose, onUpdateStatus, onUpdatePayment }: OrderDetailModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order?.status || "masuk");
  const [adminNote, setAdminNote] = useState<string>(order?.adminNote || "");
  const [dpInput, setDpInput] = useState<number>(order?.dpAmount || 0);
  const [paymentStatusInput, setPaymentStatusInput] = useState<PaymentStatus>(
    order?.paymentStatus || (order?.dpAmount && order.dpAmount > 0 ? "dp" : "belum_bayar")
  );
  const [updating, setUpdating] = useState(false);
  const [updatingStatusKey, setUpdatingStatusKey] = useState<OrderStatus | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Close lightbox on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxUrl(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sync state when order prop changes
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status || "masuk");
      setAdminNote(order.adminNote || "");
      setDpInput(order.dpAmount || 0);
      setPaymentStatusInput(
        order.paymentStatus || (order.dpAmount && order.dpAmount > 0 ? "dp" : "belum_bayar")
      );
    }
  }, [order]);

  if (!order) return null;

  const safeAnswers = Array.isArray(order.answers) ? order.answers : [];

  // Identify order type from answers
  const jenisAnswer = safeAnswers.find(
    (a) => a && (String(a?.label || "").toLowerCase().includes("jenis") || String(a?.label || "").toLowerCase().includes("produk"))
  );
  const jenisPesanan = jenisAnswer && typeof jenisAnswer.value === "string" ? jenisAnswer.value : "Pesanan MB Chondro";

  const waUrl = buatLinkWhatsAppPesanan(
    order.whatsapp || "",
    order.customerName || "",
    order.id,
    jenisPesanan,
    currentStatus
  );

  const rawWaClean = formatNomorWhatsAppUrl(order.whatsapp || "");
  const directWaUrl = rawWaClean ? `https://wa.me/${rawWaClean}` : null;

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentStatus || updating) return;
    setUpdatingStatusKey(newStatus);
    setUpdating(true);
    const ok = await onUpdateStatus(order.id, newStatus, adminNote);
    setUpdating(false);
    setUpdatingStatusKey(null);
    if (ok) {
      setCurrentStatus(newStatus);
      toastSuccess(`Status pesanan ${order.id} diubah ke ${newStatus.toUpperCase()}`);
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

  const handleSavePayment = async () => {
    if (!onUpdatePayment) return;
    setUpdatingPayment(true);
    const ok = await onUpdatePayment(order.id, dpInput, paymentStatusInput);
    setUpdatingPayment(false);
    if (ok) {
      toastSuccess("Status pembayaran & DP berhasil diperbarui!");
    } else {
      toastError("Gagal memperbarui data pembayaran.");
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

  // Parsing Data Variants & Prices
  const parsedVariants: any[] = [];
  let totalQty = 0;
  let totalPriceStr = "";
  const otherAnswers: any[] = [];

  safeAnswers.forEach((ans) => {
    if (!ans) return;
    const ansValStr = typeof ans.value === "string" ? ans.value : (ans.value != null ? String(ans.value) : "");
    if (ansValStr.includes("•")) {
      const lines = ansValStr.split("\n");
      lines.forEach((line) => {
        if (line.trim().startsWith("•")) {
          const match = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\](?:\s*@\s*(.*?)=\s*(.*?))?$/i);
          if (match) {
            parsedVariants.push({
              qty: parseInt(match[1], 10) || 0,
              size: match[2].trim(),
              sleeve: match[3].trim(),
              unitPrice: match[4] ? match[4].trim() : "",
              subtotal: match[5] ? match[5].trim() : "",
              productName: jenisPesanan || "Pesanan Produk",
            });
          }
        } else if (line.includes("Total:")) {
          const matchTotal = line.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*(.*?))?$/i);
          if (matchTotal) {
            totalQty = parseInt(matchTotal[1], 10);
            if (matchTotal[2]) totalPriceStr = matchTotal[2].trim();
          }
        }
      });
    } else {
      otherAnswers.push(ans);
    }
  });

  let totalPriceNumber = 0;
  if (totalPriceStr) {
    totalPriceNumber = parseInt(totalPriceStr.replace(/[^0-9]/g, ""), 10) || 0;
  } else if (parsedVariants.length > 0) {
    totalPriceNumber = parsedVariants.reduce((acc, v) => {
      const subVal = v.subtotal ? parseInt(String(v.subtotal).replace(/[^0-9]/g, ""), 10) || 0 : 0;
      return acc + subVal;
    }, 0);
  }

  if (totalQty === 0 && parsedVariants.length > 0) {
    totalQty = parsedVariants.reduce((acc, v) => acc + v.qty, 0);
  }

  const sisaKekurangan = Math.max(0, totalPriceNumber - (dpInput || 0));

  return (<>
    <Modal
      open={Boolean(order)}
      title={`DETAIL PESANAN: ${order.id}`}
      onClose={onClose}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            ID: <strong style={{ color: "var(--primary-700)" }}>{order.id}</strong> • {formatTanggalPanjang(order.createdAt)}
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Tutup
          </button>
        </div>
      }
    >
      <div className="order-detail-container" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* 1. TOP STEPPER TRACKER */}
        <div style={{ background: "#ffffff", padding: 6, borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {STATUS_STEPS.map((step) => {
              const active = currentStatus === step.key;
              const isUpdatingThis = updating && updatingStatusKey === step.key;
              let activeBg = "#d97706";
              if (step.key === "diproses") activeBg = "#2563eb";
              if (step.key === "selesai") activeBg = "#16a34a";

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
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: active ? "none" : "1px solid #e2e8f0",
                    background: active ? activeBg : "#f8fafc",
                    color: active ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: updating ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                  }}
                >
                  {isUpdatingThis ? (
                    <Loader2 size={15} className="spinning" />
                  ) : (
                    <step.icon size={16} />
                  )}
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. CARD: INFORMASI PEMESAN */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            padding: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <User size={18} style={{ color: "var(--primary-700)" }} />
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", margin: 0, letterSpacing: "0.3px" }}>
              INFORMASI PEMESAN
            </h4>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Nama Pemesan</span>
              <strong style={{ fontSize: 15, color: "var(--navy-900)" }}>{order.customerName || "-"}</strong>
            </div>

            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>WhatsApp Customer</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--navy-900)" }}>
                  {formatNomorHp(order.whatsapp)}
                </span>
                <button
                  type="button"
                  onClick={copyWhatsApp}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 2,
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
            <div style={{ marginTop: 14 }}>
              <a
                href={waUrl || directWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  background: "#25D366",
                  color: "#ffffff",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(37, 211, 102, 0.2)",
                }}
              >
                <MessageCircle size={16} />
                <span>Chat Customer di WhatsApp</span>
              </a>
            </div>
          )}
        </div>

        {/* 3. CARD: RINCIAN PESANAN (INVOICE TABLE) */}
        {parsedVariants.length > 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid var(--border-soft)",
              padding: 18,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Package size={18} style={{ color: "var(--primary-700)" }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", margin: 0, letterSpacing: "0.3px" }}>
                RINCIAN ITEM PESANAN
              </h4>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", width: 40, color: "var(--text-muted)" }}>#</th>
                    <th style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>Produk & Spesiﬁkasi</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", color: "var(--text-secondary)" }}>Qty</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }}>Harga Satuan</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedVariants.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < parsedVariants.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <strong style={{ display: "block", color: "var(--navy-900)" }}>{item.productName}</strong>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          Ukuran: <strong>{item.size}</strong> • Lengan: <strong>{item.sleeve}</strong>
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", fontWeight: 700, color: "var(--navy-900)" }}>
                        {item.qty} pcs
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", color: "var(--text-secondary)" }}>
                        {item.unitPrice ? item.unitPrice : "-"}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "var(--navy-900)" }}>
                        {item.subtotal ? item.subtotal : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTAL FOOTER BAR */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 14,
                padding: "12px 16px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Total Item</span>
                <strong style={{ fontSize: 15, color: "var(--navy-900)" }}>{totalQty} pcs</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block" }}>Total Biaya Pesanan</span>
                <strong style={{ fontSize: 17, color: "var(--primary-700)", fontWeight: 800 }}>
                  {totalPriceStr || formatRupiah(totalPriceNumber)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* 4. CARD: MANAJEMEN STATUS PEMBAYARAN & DP CUSTOMER */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: paymentStatusInput === "lunas" ? "1px solid #86efac" : paymentStatusInput === "dp" ? "1px solid #93c5fd" : "1px solid #fca5a5",
            padding: 18,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={18} style={{ color: "var(--primary-700)" }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", margin: 0, letterSpacing: "0.3px" }}>
                STATUS PEMBAYARAN & DP CUSTOMER
              </h4>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
                textTransform: "uppercase",
                background: paymentStatusInput === "lunas" ? "#dcfce7" : paymentStatusInput === "dp" ? "#dbeafe" : "#fee2e2",
                color: paymentStatusInput === "lunas" ? "#15803d" : paymentStatusInput === "dp" ? "#1d4ed8" : "#b91c1c",
                border: paymentStatusInput === "lunas" ? "1px solid #86efac" : paymentStatusInput === "dp" ? "1px solid #93c5fd" : "1px solid #fca5a5",
              }}
            >
              {paymentStatusInput === "lunas" ? "✓ LUNAS" : paymentStatusInput === "dp" ? "DP (Down Payment)" : "Belum Bayar"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* TOGGLE STATUS PEMBAYARAN */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Pilih Status Pembayaran:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatusInput("belum_bayar");
                    setDpInput(0);
                  }}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: paymentStatusInput === "belum_bayar" ? "2px solid #ef4444" : "1px solid #e2e8f0",
                    background: paymentStatusInput === "belum_bayar" ? "#fef2f2" : "#ffffff",
                    color: paymentStatusInput === "belum_bayar" ? "#991b1b" : "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  Belum Bayar
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatusInput("dp")}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: paymentStatusInput === "dp" ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                    background: paymentStatusInput === "dp" ? "#eff6ff" : "#ffffff",
                    color: paymentStatusInput === "dp" ? "#1e40af" : "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  DP (Down Payment)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatusInput("lunas");
                    if (totalPriceNumber > 0) setDpInput(totalPriceNumber);
                  }}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: paymentStatusInput === "lunas" ? "2px solid #22c55e" : "1px solid #e2e8f0",
                    background: paymentStatusInput === "lunas" ? "#f0fdf4" : "#ffffff",
                    color: paymentStatusInput === "lunas" ? "#166534" : "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  LUNAS
                </button>
              </div>
            </div>

            {/* INPUT NOMINAL DP */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Nominal DP yang Diterima (Rp)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: 9, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Rp</span>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    style={{ paddingLeft: 38, width: "100%", fontSize: 14, fontWeight: 600 }}
                    placeholder="0"
                    value={dpInput || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setDpInput(val);
                      if (val > 0 && paymentStatusInput === "belum_bayar") {
                        setPaymentStatusInput("dp");
                      }
                    }}
                  />
                </div>
              </div>

              {totalPriceNumber > 0 && (
                <div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 12, width: "100%", padding: "9px 12px" }}
                    onClick={() => {
                      const half = Math.round(totalPriceNumber * 0.5);
                      setDpInput(half);
                      setPaymentStatusInput("dp");
                    }}
                  >
                    ⚡ Set 50% DP ({formatRupiah(Math.round(totalPriceNumber * 0.5))})
                  </button>
                </div>
              )}
            </div>

            {/* RINGKASAN TAGIHAN & KEKURANGAN */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                padding: "12px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 13,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Total Tagihan</span>
                <strong style={{ fontSize: 14, color: "var(--navy-900)" }}>{totalPriceStr || formatRupiah(totalPriceNumber)}</strong>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Nominal DP</span>
                <strong style={{ fontSize: 14, color: "#1e40af" }}>{formatRupiah(dpInput || 0)}</strong>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>Sisa Kekurangan</span>
                <strong style={{ fontSize: 14, color: sisaKekurangan > 0 ? "#dc2626" : "#16a34a" }}>
                  {sisaKekurangan > 0 ? formatRupiah(sisaKekurangan) : "LUNAS (Rp 0)"}
                </strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePayment}
                disabled={updatingPayment}
                style={{ fontSize: 13, padding: "8px 20px", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {updatingPayment && <Loader2 size={15} className="spinning" />}
                <span>Simpan Pembayaran & DP</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. CARD: DATA FORMULIR LAINNYA */}
        {otherAnswers.length > 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid var(--border-soft)",
              padding: 18,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <FileText size={18} style={{ color: "var(--primary-700)" }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", margin: 0, letterSpacing: "0.3px" }}>
                DATA FORMULIR ISIAN CUSTOMER
              </h4>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {otherAnswers.map((ans, idx) => (
                <div
                  key={ans?.id || idx}
                  style={{
                    background: "#f8fafc",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    {ans?.label || "Pertanyaan"}
                  </span>
                  <div style={{ fontSize: 13.5, color: "var(--navy-900)", wordBreak: "break-word" }}>
                    {(() => {
                      const ansValStr = typeof ans?.value === "string" ? ans.value : (ans?.value != null ? String(ans.value) : "");
                      const imgTarget = ans?.fileUrl || (ansValStr.startsWith("data:image/") || ansValStr.startsWith("http") ? ansValStr : null);
                      const isImage = Boolean(
                        imgTarget &&
                        (imgTarget.startsWith("data:image/") ||
                         imgTarget.includes("drive.google") ||
                         imgTarget.includes("googleusercontent") ||
                         /\.(jpg|jpeg|png|webp|gif)$/i.test(imgTarget) ||
                         (typeof ans?.fileType === "string" && ans.fileType.startsWith("image/")))
                      );

                      if (imgTarget) {
                        return (
                          <div style={{ marginTop: 6 }}>
                            {isImage ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                                <img
                                  src={imgTarget}
                                  alt={ans?.label || "Lampiran"}
                                  title="Klik untuk melihat full screen"
                                  onClick={() => setLightboxUrl(imgTarget)}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "180px",
                                    objectFit: "cover",
                                    borderRadius: 8,
                                    border: "1px solid var(--border)",
                                    cursor: "zoom-in",
                                    background: "#ffffff",
                                  }}
                                />
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(imgTarget)}
                                    className="btn btn-outline btn-sm"
                                    style={{ fontSize: 11, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                                  >
                                    <Maximize2 size={12} /> Lihat Fullscreen
                                  </button>
                                  <a
                                    href={imgTarget}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline btn-sm"
                                    style={{ fontSize: 11, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                                  >
                                    <ExternalLink size={12} /> Tab Baru
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <a
                                href={imgTarget}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                              >
                                <ExternalLink size={13} /> Unduh Berkas ({ans?.fileName || "Lampiran"})
                              </a>
                            )}
                          </div>
                        );
                      }
                      return <span>{ansValStr || "-"}</span>;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. CARD: CATATAN INTERNAL ADMIN */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            padding: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", margin: "0 0 6px 0", letterSpacing: "0.3px" }}>
            CATATAN INTERNAL ADMIN
          </h4>
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>
            Catatan rahasia internal tim MBC (tidak terlihat oleh customer).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Tulis catatan pengerjaan, estimasi biaya, penanggung jawab, dll..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              style={{ width: "100%", fontSize: 13, background: "#f8fafc" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
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

      </div>
    </Modal>

    {/* LIGHTBOX FULLSCREEN FOR IMAGES */}
    {lightboxUrl && (
      <div
        onClick={() => setLightboxUrl(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.92)",
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
            top: 0, left: 0, right: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
          }}
        >
          <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 600 }}>
            📷 Lampiran Foto Customer
          </span>
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
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
            maxWidth: "92vw",
            maxHeight: "88vh",
            objectFit: "contain",
            borderRadius: 8,
            boxShadow: "0 0 50px rgba(0,0,0,0.8)",
          }}
        />
      </div>
    )}
  </>);
}
