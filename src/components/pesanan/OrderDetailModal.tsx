import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  MessageCircle,
  Copy,
  Check,
  CheckCircle,
  Clock,
  Layers,
  CreditCard,
  Package,
  User,
  Settings,
  Send,
  Loader2,
  Maximize2,
  ExternalLink,
  X,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { OrderWithAnswers, OrderStatus, PaymentStatus } from "../../types";
import {
  formatNomorHp,
  formatNomorWhatsAppUrl,
  formatRupiah,
  formatTanggalPanjang,
} from "../../utils/format";
import { useToast } from "../../contexts/ToastContext";

interface OrderDetailModalProps {
  order: OrderWithAnswers | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OrderStatus, adminNote?: string) => Promise<boolean>;
  onUpdatePayment?: (id: string, dpAmount: number, paymentStatus: PaymentStatus) => Promise<boolean>;
  onOpenWhatsAppModal?: (order: OrderWithAnswers) => void;
}

type TabType = "detail" | "whatsapp";
type WaMessageType = "dp" | "ready";

interface WaSettings {
  dpPercentage: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const WA_SETTINGS_KEY = "mbc_order_wa_template_settings";

const DEFAULT_WA_SETTINGS: WaSettings = {
  dpPercentage: 50,
  bankName: "BCA",
  accountNumber: "1234567890",
  accountHolder: "MB Chondro",
};

function getStoredWaSettings(): WaSettings {
  try {
    const raw = localStorage.getItem(WA_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        dpPercentage: Number(parsed.dpPercentage) || 50,
        bankName: parsed.bankName || "BCA",
        accountNumber: parsed.accountNumber || "1234567890",
        accountHolder: parsed.accountHolder || "MB Chondro",
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_WA_SETTINGS;
}

function parseRupiahInput(val: string): number {
  const clean = val.replace(/[^0-9]/g, "");
  return clean ? parseInt(clean, 10) : 0;
}

export function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
  onUpdatePayment,
  onOpenWhatsAppModal: _onOpenWhatsAppModal,
}: OrderDetailModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>("detail");

  // Tab 1 (Detail) States
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order?.status || "masuk");
  const [adminNote, setAdminNote] = useState<string>(order?.adminNote || "");
  const [paymentStatusChoice, setPaymentStatusChoice] = useState<PaymentStatus>("belum_bayar");
  const [dpInputNumber, setDpInputNumber] = useState<number>(0);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Tab 2 (WhatsApp) States
  const [waMessageType, setWaMessageType] = useState<WaMessageType>("dp");
  const [waSettings, setWaSettings] = useState<WaSettings>(getStoredWaSettings);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<WaSettings>(getStoredWaSettings);
  const [editableWaMessage, setEditableWaMessage] = useState("");
  const [isMessageDirty, setIsMessageDirty] = useState(false);
  const [copiedWaMsg, setCopiedWaMsg] = useState(false);

  // Lock body scroll and handle ESC key
  useEffect(() => {
    if (!order) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxUrl) {
          setLightboxUrl(null);
        } else if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [order, lightboxUrl, isSettingsModalOpen, onClose]);

  // Sync state whenever order prop changes
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status || "masuk");
      setAdminNote(order.adminNote || "");
      const dp = order.dpAmount || 0;
      setDpInputNumber(dp);
      setPaymentStatusChoice(
        order.paymentStatus || (dp > 0 ? "dp" : "belum_bayar")
      );
      setIsMessageDirty(false);
    }
  }, [order]);

  // 1. Ekstrak data jawaban formulir & parse varian/harga
  const safeAnswers = useMemo(() => {
    return Array.isArray(order?.answers) ? order.answers : [];
  }, [order?.answers]);

  const customerName = (order?.customerName || "Customer").trim();
  const customerInitial = customerName ? customerName.charAt(0).toUpperCase() : "C";

  const jenisAnswer = useMemo(() => {
    return safeAnswers.find(
      (a) =>
        a &&
        (String(a?.label || "").toLowerCase().includes("jenis") ||
          String(a?.label || "").toLowerCase().includes("produk"))
    );
  }, [safeAnswers]);
  const jenisPesanan =
    jenisAnswer && typeof jenisAnswer.value === "string" ? jenisAnswer.value.trim() : "Kaos MB Chondro";

  const { parsedVariants, totalQty, totalPriceNumber, otherAnswers } = useMemo(() => {
    const variants: Array<{
      qty: number;
      size: string;
      sleeve: string;
      unitPrice: string;
      subtotal: string;
      subtotalNum: number;
      productName: string;
    }> = [];
    const others: any[] = [];
    let derivedQty = 0;
    let derivedTotalStr = "";

    safeAnswers.forEach((ans) => {
      if (!ans) return;
      const ansValStr = typeof ans.value === "string" ? ans.value : String(ans.value || "");
      if (ansValStr.includes("•")) {
        const lines = ansValStr.split("\n");
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("•")) {
            const match = trimmed.match(
              /•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\](?:\s*@\s*(.*?)=\s*(.*?))?$/i
            );
            if (match) {
              const qty = parseInt(match[1], 10) || 0;
              const subtotalStr = match[5] ? match[5].trim() : "";
              const subtotalNum = subtotalStr ? parseInt(subtotalStr.replace(/[^0-9]/g, ""), 10) || 0 : 0;
              variants.push({
                qty,
                size: match[2].trim(),
                sleeve: match[3].trim(),
                unitPrice: match[4] ? match[4].trim() : "",
                subtotal: subtotalStr,
                subtotalNum,
                productName: jenisPesanan,
              });
            }
          } else if (trimmed.includes("Total:")) {
            const matchTotal = trimmed.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*(.*?))?$/i);
            if (matchTotal) {
              derivedQty = parseInt(matchTotal[1], 10);
              if (matchTotal[2]) derivedTotalStr = matchTotal[2].trim();
            }
          }
        });
      } else {
        others.push(ans);
      }
    });

    let totalPrice = 0;
    if (derivedTotalStr) {
      totalPrice = parseInt(derivedTotalStr.replace(/[^0-9]/g, ""), 10) || 0;
    } else if (variants.length > 0) {
      totalPrice = variants.reduce((acc, v) => acc + v.subtotalNum, 0);
    }

    if (derivedQty === 0 && variants.length > 0) {
      derivedQty = variants.reduce((acc, v) => acc + v.qty, 0);
    }

    return {
      parsedVariants: variants,
      totalQty: derivedQty || 1,
      totalPriceNumber: totalPrice,
      otherAnswers: others,
    };
  }, [safeAnswers, jenisPesanan]);

  // Financial Calculations for Tab 1
  const calculatedSisa = useMemo(() => {
    if (paymentStatusChoice === "lunas") return 0;
    if (paymentStatusChoice === "belum_bayar") return totalPriceNumber;
    return Math.max(0, totalPriceNumber - dpInputNumber);
  }, [paymentStatusChoice, totalPriceNumber, dpInputNumber]);

  // Rincian Pesanan Plain Text for WhatsApp
  const rincianPesananText = useMemo(() => {
    if (parsedVariants.length > 0) {
      return parsedVariants
        .map((v) => {
          let line = `• ${v.qty} pcs [${v.size} - ${v.sleeve}]`;
          if (v.unitPrice) {
            line += ` @ ${v.unitPrice}`;
          }
          if (v.subtotal) {
            line += ` = ${v.subtotal}`;
          }
          return line;
        })
        .join("\n");
    }
    return `• ${totalQty} pcs ${jenisPesanan}`;
  }, [parsedVariants, totalQty, jenisPesanan]);

  // Generate WhatsApp Message text automatically based on active message type
  const generatedWaTemplate = useMemo(() => {
    if (waMessageType === "dp") {
      const dpNominal = Math.round((totalPriceNumber * waSettings.dpPercentage) / 100);
      return `Halo Kak ${customerName} 👋

Terima kasih telah melakukan pemesanan di MB CHONDRO.

Berikut rincian pesanan Anda:
${rincianPesananText}

Total Tagihan: ${formatRupiah(totalPriceNumber)}
Ketentuan DP (${waSettings.dpPercentage}%): ${formatRupiah(dpNominal)}

Silakan melakukan transfer pembayaran DP ke rekening berikut:
Bank: ${waSettings.bankName}
No. Rekening: ${waSettings.accountNumber}
Atas Nama: ${waSettings.accountHolder}

Setelah transfer, mohon kirimkan bukti pembayaran ke nomor WhatsApp ini agar pesanan dapat segera diproses.

Terima kasih! 🙏
MB CHONDRO`;
    } else {
      // Ready
      const sisa = Math.max(0, totalPriceNumber - (order?.dpAmount || 0));
      const statusKet =
        order?.paymentStatus === "lunas" || sisa === 0
          ? "Status Pembayaran: LUNAS (Rp 0)"
          : `Sisa Pembayaran saat Pengambilan: ${formatRupiah(sisa)}`;

      return `Halo Kak ${customerName} 👋

Kabar gembira! Pesanan Anda di MB CHONDRO telah selesai diproses dan siap diambil. 🎉

Berikut rincian pesanan Anda:
${rincianPesananText}

Total Tagihan: ${formatRupiah(totalPriceNumber)}
${statusKet}

Silakan mengambil pesanan Anda di Basecamp MB CHONDRO.

Terima kasih atas kepercayaan Anda memesan di MB CHONDRO! 🙏
MB CHONDRO`;
    }
  }, [
    waMessageType,
    customerName,
    rincianPesananText,
    totalPriceNumber,
    waSettings,
    order?.dpAmount,
    order?.paymentStatus,
  ]);

  // Update editable text whenever generated template changes (unless user made dirty edits)
  useEffect(() => {
    if (!isMessageDirty) {
      setEditableWaMessage(generatedWaTemplate);
    }
  }, [generatedWaTemplate, isMessageDirty]);

  if (!order) return null;

  // Handlers for Tab 1
  const copyWhatsApp = () => {
    if (order.whatsapp) {
      navigator.clipboard.writeText(order.whatsapp);
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2000);
      toastSuccess("Nomor WhatsApp berhasil disalin!");
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentStatus || updatingStatus) return;
    setUpdatingStatus(true);
    const ok = await onUpdateStatus(order.id, newStatus, adminNote);
    setUpdatingStatus(false);
    if (ok) {
      setCurrentStatus(newStatus);
      toastSuccess(`Status pesanan berhasil diubah menjadi ${newStatus.toUpperCase()}`);
    } else {
      toastError("Gagal memperbarui status pesanan.");
    }
  };

  const handlePaymentStatusSelection = (status: PaymentStatus) => {
    setPaymentStatusChoice(status);
    if (status === "lunas") {
      setDpInputNumber(totalPriceNumber);
    } else if (status === "belum_bayar") {
      setDpInputNumber(0);
    } else if (status === "dp") {
      if (dpInputNumber === 0 || dpInputNumber >= totalPriceNumber) {
        setDpInputNumber(Math.round((totalPriceNumber * waSettings.dpPercentage) / 100));
      }
    }
  };

  const handleSetAutoDp = () => {
    const autoVal = Math.round((totalPriceNumber * waSettings.dpPercentage) / 100);
    setDpInputNumber(autoVal);
    setPaymentStatusChoice("dp");
    toastSuccess(`Nominal DP diset ke ${waSettings.dpPercentage}% (${formatRupiah(autoVal)})`);
  };

  const handleSavePaymentChanges = async () => {
    if (!onUpdatePayment) return;
    let finalDp = dpInputNumber;
    let finalStatus = paymentStatusChoice;

    if (finalStatus === "lunas") {
      finalDp = totalPriceNumber;
    } else if (finalStatus === "belum_bayar") {
      finalDp = 0;
    } else if (finalStatus === "dp") {
      if (finalDp >= totalPriceNumber && totalPriceNumber > 0) {
        finalStatus = "lunas";
        finalDp = totalPriceNumber;
      } else if (finalDp <= 0) {
        finalStatus = "belum_bayar";
        finalDp = 0;
      }
    }

    setUpdatingPayment(true);
    const ok = await onUpdatePayment(order.id, finalDp, finalStatus);
    setUpdatingPayment(false);
    if (ok) {
      toastSuccess("Perubahan status pembayaran & DP berhasil disimpan!");
    } else {
      toastError("Gagal menyimpan data pembayaran.");
    }
  };

  const handleSaveAdminNote = async () => {
    setSavingNote(true);
    const ok = await onUpdateStatus(order.id, currentStatus, adminNote);
    setSavingNote(false);
    if (ok) {
      toastSuccess("Catatan internal admin berhasil disimpan.");
    } else {
      toastError("Gagal menyimpan catatan admin.");
    }
  };

  // Handlers for Tab 2 (WhatsApp)
  const handleCopyWaMessage = () => {
    if (!editableWaMessage) return;
    navigator.clipboard.writeText(editableWaMessage);
    setCopiedWaMsg(true);
    setTimeout(() => setCopiedWaMsg(false), 2000);
    toastSuccess("Pesan WhatsApp berhasil disalin ke clipboard!");
  };

  const handleSendToWhatsApp = () => {
    const rawClean = formatNomorWhatsAppUrl(order.whatsapp || "");
    if (!rawClean) {
      toastError("Nomor WhatsApp customer tidak valid.");
      return;
    }
    const encoded = encodeURIComponent(editableWaMessage);
    const waUrl = `https://wa.me/${rawClean}?text=${encoded}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleSaveSettingsModal = () => {
    const pct = Math.max(1, Math.min(100, Number(tempSettings.dpPercentage) || 50));
    const saved: WaSettings = {
      dpPercentage: pct,
      bankName: tempSettings.bankName.trim() || "BCA",
      accountNumber: tempSettings.accountNumber.trim() || "1234567890",
      accountHolder: tempSettings.accountHolder.trim() || "MB Chondro",
    };
    setWaSettings(saved);
    localStorage.setItem(WA_SETTINGS_KEY, JSON.stringify(saved));
    setIsSettingsModalOpen(false);
    setIsMessageDirty(false);
    toastSuccess("Pengaturan template WhatsApp berhasil disimpan!");
  };

  return createPortal(
    <div className="order-detail-overlay" onClick={onClose}>
      <div
        className="order-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detail Pesanan"
      >
        {/* ============================================================
            1. HEADER MODAL & SUBHEADER TAB SWITCHER
            ============================================================ */}
        <div className="order-detail-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#FEF2F2",
                color: "#DC1717",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Package size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
                  Detail Pesanan
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "#F1F5F9",
                    color: "#334155",
                    fontFamily: "monospace",
                  }}
                >
                  #{order.id}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#64748B", display: "block" }}>
                Pusat manajemen rincian pesanan, tagihan, dan komunikasi customer
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Tutup modal"
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* SUBHEADER: TWO MAIN TABS */}
        <div className="order-detail-nav-tabs">
          <button
            type="button"
            className={`order-detail-tab-btn ${activeTab === "detail" ? "active" : ""}`}
            onClick={() => setActiveTab("detail")}
          >
            <FileText size={16} />
            <span>Detail Pesanan</span>
          </button>
          <button
            type="button"
            className={`order-detail-tab-btn ${activeTab === "whatsapp" ? "active" : ""}`}
            onClick={() => setActiveTab("whatsapp")}
          >
            <MessageCircle size={16} />
            <span>Kirim Pesan WhatsApp</span>
          </button>
        </div>

        {/* ============================================================
            2. SCROLLABLE MODAL BODY
            ============================================================ */}
        <div className="order-detail-body">
          {activeTab === "detail" ? (
            /* ============================================================
               TAB 1: DETAIL PESANAN
               ============================================================ */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* A. INFORMASI PELANGGAN */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <User size={16} style={{ color: "#DC1717" }} />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#0F172A",
                      letterSpacing: "0.3px",
                      textTransform: "uppercase",
                    }}
                  >
                    Informasi Pelanggan
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 2 }}>Nama Pemesan</span>
                    <strong style={{ fontSize: 14.5, color: "#0F172A" }}>{customerName}</strong>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 2 }}>Nomor WhatsApp</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong style={{ fontSize: 14, color: "#0F172A" }}>{formatNomorHp(order.whatsapp)}</strong>
                      <button
                        type="button"
                        onClick={copyWhatsApp}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 2,
                          cursor: "pointer",
                          color: copiedWA ? "#16A34A" : "#64748B",
                        }}
                        title="Salin nomor WhatsApp"
                      >
                        {copiedWA ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: "#F8FAFC", padding: "10px 14px", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 2 }}>Tanggal Pemesanan</span>
                    <strong style={{ fontSize: 13.5, color: "#0F172A" }}>{formatTanggalPanjang(order.createdAt)}</strong>
                  </div>
                </div>
              </div>

              {/* B. RINCIAN ITEM PESANAN */}
              {parsedVariants.length > 0 && (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 12,
                    padding: "16px 18px",
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Package size={16} style={{ color: "#DC1717" }} />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "#0F172A",
                        letterSpacing: "0.3px",
                        textTransform: "uppercase",
                      }}
                    >
                      Rincian Item Pesanan
                    </span>
                  </div>

                  <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left" }}>
                          <th style={{ padding: "9px 12px", width: 40, color: "#64748B", fontWeight: 600 }}>No.</th>
                          <th style={{ padding: "9px 12px", color: "#475569", fontWeight: 600 }}>Ukuran & Spesifikasi</th>
                          <th style={{ padding: "9px 12px", textAlign: "center", color: "#475569", fontWeight: 600 }}>Jumlah</th>
                          <th style={{ padding: "9px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Harga Satuan</th>
                          <th style={{ padding: "9px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedVariants.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx < parsedVariants.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                            <td style={{ padding: "10px 12px", color: "#64748B", fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <strong style={{ display: "block", color: "#0F172A" }}>{item.productName}</strong>
                              <span style={{ fontSize: 12, color: "#64748B" }}>
                                Ukuran: <strong>{item.size}</strong> • Lengan: <strong>{item.sleeve}</strong>
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#0F172A" }}>
                              {item.qty} pcs
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: "#475569" }}>
                              {item.unitPrice || "-"}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                              {item.subtotal || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Bar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 12,
                      padding: "10px 16px",
                      background: "#F8FAFC",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>Total Jumlah Item</span>
                      <strong style={{ fontSize: 14, color: "#0F172A" }}>{totalQty} pcs</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>Total Biaya Pesanan</span>
                      <strong style={{ fontSize: 16, color: "#DC1717", fontWeight: 800 }}>
                        {formatRupiah(totalPriceNumber)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* C. STATUS PESANAN */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Clock size={16} style={{ color: "#DC1717" }} />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#0F172A",
                      letterSpacing: "0.3px",
                      textTransform: "uppercase",
                    }}
                  >
                    Status Pesanan
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {/* Status: Masuk (Oranye) */}
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("masuk")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: currentStatus === "masuk" ? "2px solid #F59E0B" : "1px solid #E2E8F0",
                      background: currentStatus === "masuk" ? "#FEF3C7" : "#FFFFFF",
                      color: currentStatus === "masuk" ? "#B45309" : "#475569",
                      fontWeight: currentStatus === "masuk" ? 700 : 500,
                      fontSize: 13,
                      cursor: updatingStatus ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Clock size={15} />
                    <span>Masuk</span>
                  </button>

                  {/* Status: Diproses (Biru) */}
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("diproses")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: currentStatus === "diproses" ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                      background: currentStatus === "diproses" ? "#EFF6FF" : "#FFFFFF",
                      color: currentStatus === "diproses" ? "#1D4ED8" : "#475569",
                      fontWeight: currentStatus === "diproses" ? 700 : 500,
                      fontSize: 13,
                      cursor: updatingStatus ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Layers size={15} />
                    <span>Diproses</span>
                  </button>

                  {/* Status: Selesai (Hijau) */}
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("selesai")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: currentStatus === "selesai" ? "2px solid #22C55E" : "1px solid #E2E8F0",
                      background: currentStatus === "selesai" ? "#F0FDF4" : "#FFFFFF",
                      color: currentStatus === "selesai" ? "#15803D" : "#475569",
                      fontWeight: currentStatus === "selesai" ? 700 : 500,
                      fontSize: 13,
                      cursor: updatingStatus ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CheckCircle size={15} />
                    <span>Selesai</span>
                  </button>
                </div>
              </div>

              {/* D. PEMBAYARAN DAN INPUT DP */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: "18px 20px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CreditCard size={16} style={{ color: "#DC1717" }} />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#0F172A",
                      letterSpacing: "0.3px",
                      textTransform: "uppercase",
                    }}
                  >
                    Pengaturan Pembayaran & Input DP
                  </span>
                </div>

                {/* 3 Status Pembayaran Buttons */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>
                    Pilih Status Pembayaran:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handlePaymentStatusSelection("belum_bayar")}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        border: paymentStatusChoice === "belum_bayar" ? "2px solid #EF4444" : "1px solid #E2E8F0",
                        background: paymentStatusChoice === "belum_bayar" ? "#FEF2F2" : "#FFFFFF",
                        color: paymentStatusChoice === "belum_bayar" ? "#991B1B" : "#475569",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Belum Bayar
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentStatusSelection("dp")}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        border: paymentStatusChoice === "dp" ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                        background: paymentStatusChoice === "dp" ? "#EFF6FF" : "#FFFFFF",
                        color: paymentStatusChoice === "dp" ? "#1E40AF" : "#475569",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      DP (Down Payment)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentStatusSelection("lunas")}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        border: paymentStatusChoice === "lunas" ? "2px solid #22C55E" : "1px solid #E2E8F0",
                        background: paymentStatusChoice === "lunas" ? "#F0FDF4" : "#FFFFFF",
                        color: paymentStatusChoice === "lunas" ? "#166534" : "#475569",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Lunas
                    </button>
                  </div>
                </div>

                {/* Input DP Section (Tampil saat memilih status DP) */}
                {paymentStatusChoice === "dp" && (
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                        Nominal DP Diterima (Rp)
                      </label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 12, top: 10, fontSize: 13, fontWeight: 700, color: "#64748B" }}>
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={dpInputNumber ? formatRupiah(dpInputNumber).replace("Rp ", "") : ""}
                          onChange={(e) => {
                            const val = parseRupiahInput(e.target.value);
                            setDpInputNumber(Math.min(totalPriceNumber, val));
                          }}
                          style={{
                            width: "100%",
                            padding: "9px 14px 9px 40px",
                            borderRadius: 8,
                            border: "1px solid #CBD5E1",
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: "#0F172A",
                            outline: "none",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={handleSetAutoDp}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          color: "#1E40AF",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Sparkles size={13} />
                        <span>Set DP Otomatis ({waSettings.dpPercentage}%)</span>
                      </button>
                      <span style={{ fontSize: 11.5, color: "#64748B" }}>
                        Atau masukkan nominal manual di atas.
                      </span>
                    </div>
                  </div>
                )}

                {/* Perhitungan Otomatis: Total Tagihan, DP, Sisa */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    padding: "12px 14px",
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>Total Tagihan</span>
                    <strong style={{ fontSize: 14.5, color: "#0F172A" }}>{formatRupiah(totalPriceNumber)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>Nominal DP</span>
                    <strong style={{ fontSize: 14.5, color: "#1D4ED8" }}>
                      {formatRupiah(paymentStatusChoice === "lunas" ? totalPriceNumber : paymentStatusChoice === "belum_bayar" ? 0 : dpInputNumber)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>Sisa Pembayaran</span>
                    <strong
                      style={{
                        fontSize: 14.5,
                        color: calculatedSisa === 0 ? "#15803D" : "#DC2626",
                      }}
                    >
                      {calculatedSisa === 0 ? "LUNAS (Rp 0)" : formatRupiah(calculatedSisa)}
                    </strong>
                  </div>
                </div>

                {/* Tombol Utama Simpan Pembayaran */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleSavePaymentChanges}
                    disabled={updatingPayment}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: updatingPayment ? "#94A3B8" : "#DC1717",
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: updatingPayment ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 6px rgba(220, 23, 23, 0.25)",
                    }}
                  >
                    {updatingPayment && <Loader2 size={15} className="spinning" />}
                    <span>Simpan Perubahan Pembayaran</span>
                  </button>
                </div>
              </div>

              {/* E. DATA FORMULIR DAN CATATAN INTERNAL */}
              {otherAnswers.length > 0 && (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 12,
                    padding: "16px 18px",
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <FileText size={16} style={{ color: "#DC1717" }} />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "#0F172A",
                        letterSpacing: "0.3px",
                        textTransform: "uppercase",
                      }}
                    >
                      Data Formulir Pelanggan
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {otherAnswers.map((ans, idx) => (
                      <div
                        key={ans?.id || idx}
                        style={{
                          background: "#F8FAFC",
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid #F1F5F9",
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 3 }}>
                          {ans?.label || "Pertanyaan"}
                        </span>
                        <div style={{ fontSize: 13, color: "#0F172A", wordBreak: "break-word" }}>
                          {(() => {
                            const ansValStr =
                              typeof ans?.value === "string" ? ans.value : String(ans?.value || "");
                            const imgTarget =
                              ans?.fileUrl ||
                              (ansValStr.startsWith("data:image/") || ansValStr.startsWith("http")
                                ? ansValStr
                                : null);
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
                                <div style={{ marginTop: 4 }}>
                                  {isImage ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <img
                                        src={imgTarget}
                                        alt={ans?.label || "Lampiran"}
                                        title="Klik untuk melihat fullscreen"
                                        onClick={() => setLightboxUrl(imgTarget)}
                                        style={{
                                          maxWidth: "100%",
                                          maxHeight: "140px",
                                          objectFit: "cover",
                                          borderRadius: 6,
                                          border: "1px solid #E2E8F0",
                                          cursor: "zoom-in",
                                          background: "#FFFFFF",
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setLightboxUrl(imgTarget)}
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: 11,
                                          borderRadius: 4,
                                          border: "1px solid #CBD5E1",
                                          background: "#FFFFFF",
                                          color: "#334155",
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          width: "fit-content",
                                        }}
                                      >
                                        <Maximize2 size={11} /> Lihat Foto
                                      </button>
                                    </div>
                                  ) : (
                                    <a
                                      href={imgTarget}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        fontSize: 12,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                        color: "#2563EB",
                                        textDecoration: "underline",
                                      }}
                                    >
                                      <ExternalLink size={12} /> Unduh Berkas ({ans?.fileName || "Lampiran"})
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

              {/* CATATAN INTERNAL ADMIN */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: "16px 18px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#0F172A",
                    letterSpacing: "0.3px",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Catatan Internal Admin
                </span>
                <span style={{ fontSize: 11.5, color: "#64748B", display: "block", marginBottom: 10 }}>
                  Catatan rahasia tim MB Chondro (tidak terlihat oleh customer).
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <textarea
                    rows={3}
                    placeholder="Tulis catatan pengerjaan, estimasi biaya, PIC, dll..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={handleSaveAdminNote}
                      disabled={savingNote}
                      style={{
                        padding: "6px 16px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #DC1717",
                        background: "#DC1717",
                        color: "#FFFFFF",
                        fontWeight: 600,
                        cursor: savingNote ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingNote ? "Menyimpan..." : "Simpan Catatan"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================
               TAB 2: KIRIM PESAN WHATSAPP
               ============================================================ */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* A. INFORMASI SINGKAT PELANGGAN */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: "14px 18px",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "#22C55E",
                      color: "#FFFFFF",
                      fontWeight: 800,
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {customerInitial}
                  </div>
                  <div>
                    <strong style={{ fontSize: 15, color: "#0F172A", display: "block" }}>
                      {customerName}
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: "#64748B" }}>
                        WhatsApp: {formatNomorHp(order.whatsapp)}
                      </span>
                      <button
                        type="button"
                        onClick={copyWhatsApp}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 1,
                          cursor: "pointer",
                          color: copiedWA ? "#16A34A" : "#64748B",
                        }}
                        title="Salin nomor"
                      >
                        {copiedWA ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11.5, color: "#64748B", display: "block" }}>Ringkasan Pesanan</span>
                  <strong style={{ fontSize: 14, color: "#0F172A" }}>
                    {totalQty} pcs • {formatRupiah(totalPriceNumber)}
                  </strong>
                </div>
              </div>

              {/* B. PILIHAN JENIS PESAN & TOMBOL PENGATURAN TEMPLATE */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {/* 2 PILIHAN JENIS PESAN */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setWaMessageType("dp");
                      setIsMessageDirty(false);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "9px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: waMessageType === "dp" ? "2px solid #22C55E" : "1px solid #CBD5E1",
                      background: waMessageType === "dp" ? "#F0FDF4" : "#FFFFFF",
                      color: waMessageType === "dp" ? "#15803D" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CreditCard size={15} />
                    <span>Kirim Pesan DP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWaMessageType("ready");
                      setIsMessageDirty(false);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "9px 16px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: waMessageType === "ready" ? "2px solid #22C55E" : "1px solid #CBD5E1",
                      background: waMessageType === "ready" ? "#F0FDF4" : "#FFFFFF",
                      color: waMessageType === "ready" ? "#15803D" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CheckCircle size={15} />
                    <span>Kirim Pesan Pesanan Ready</span>
                  </button>
                </div>

                {/* TOMBOL PENGATURAN TEMPLATE */}
                <button
                  type="button"
                  onClick={() => {
                    setTempSettings(waSettings);
                    setIsSettingsModalOpen(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                  title="Atur persentase DP default & rekening bank"
                >
                  <Settings size={14} />
                  <span>Pengaturan Template</span>
                </button>
              </div>

              {/* C. PREVIEW & EDITOR PESAN WHATSAPP */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: 18,
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MessageCircle size={16} style={{ color: "#22C55E" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                      Preview Pesan WhatsApp (Dapat Diedit)
                    </span>
                  </div>
                  {isMessageDirty && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMessageDirty(false);
                        setEditableWaMessage(generatedWaTemplate);
                        toastSuccess("Pesan telah direset ke template standar.");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#DC1717",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <RotateCcw size={12} /> Reset Template
                    </button>
                  )}
                </div>

                <textarea
                  rows={12}
                  value={editableWaMessage}
                  onChange={(e) => {
                    setEditableWaMessage(e.target.value);
                    setIsMessageDirty(true);
                  }}
                  placeholder="Ketik atau edit pesan WhatsApp di sini..."
                  style={{
                    width: "100%",
                    fontSize: 13,
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#0F172A",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />

                {/* ACTION BUTTONS: SALIN PESAN & KIRIM KE WHATSAPP */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 10,
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCopyWaMessage}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#334155",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {copiedWaMsg ? <Check size={14} style={{ color: "#16A34A" }} /> : <Copy size={14} />}
                    <span>{copiedWaMsg ? "Tersalin!" : "Salin Pesan"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendToWhatsApp}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 22px",
                      borderRadius: 8,
                      border: "none",
                      background: "#22C55E",
                      color: "#FFFFFF",
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3)",
                    }}
                  >
                    <Send size={15} />
                    <span>Kirim ke WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            3. FOOTER MODAL
            ============================================================ */}
        <div className="order-detail-footer">
          <div style={{ fontSize: 12.5, color: "#64748B" }}>
            ID Pesanan: <strong style={{ color: "#0F172A" }}>#{order.id}</strong> •{" "}
            {formatTanggalPanjang(order.createdAt)}
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tutup
          </button>
        </div>
      </div>

      {/* ============================================================
          PENGATURAN TEMPLATE WHATSAPP SUB-MODAL
          ============================================================ */}
      {isSettingsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: 14,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={17} style={{ color: "#22C55E" }} />
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                  Pengaturan Template WhatsApp
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                  padding: 2,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  1. Persentase DP Default (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={tempSettings.dpPercentage}
                  onChange={(e) =>
                    setTempSettings((prev) => ({ ...prev, dpPercentage: parseInt(e.target.value, 10) || 50 }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  2. Nama Bank
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BCA, BRI, Mandiri"
                  value={tempSettings.bankName}
                  onChange={(e) => setTempSettings((prev) => ({ ...prev, bankName: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  3. Nomor Rekening
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 1234567890"
                  value={tempSettings.accountNumber}
                  onChange={(e) => setTempSettings((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  4. Nama Pemilik Rekening
                </label>
                <input
                  type="text"
                  placeholder="Contoh: MB Chondro"
                  value={tempSettings.accountHolder}
                  onChange={(e) => setTempSettings((prev) => ({ ...prev, accountHolder: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 20px",
                borderTop: "1px solid #E2E8F0",
                background: "#FAFAFA",
              }}
            >
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSettingsModal}
                style={{
                  padding: "7px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: "#22C55E",
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX FULLSCREEN FOR IMAGES */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 999999,
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
              padding: "16px 24px",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
            }}
          >
            <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600 }}>
              📷 Lampiran Foto Customer
            </span>
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#FFFFFF",
                borderRadius: "50%",
                width: 36,
                height: 36,
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
          <img
            src={lightboxUrl}
            alt="Lampiran foto"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).alt = "Foto tidak dapat dimuat";
            }}
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
    </div>,
    document.body
  );
}
