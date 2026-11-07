import { useState, useEffect, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Eye,
  CheckCircle2,
  FileCheck,
  CreditCard,
  Truck,
  PenLine,
  CheckCheck,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { OrderWithAnswers } from "../../types";
import { formatNomorWhatsAppUrl, formatRupiah } from "../../utils/format";
import { useToast } from "../../contexts/ToastContext";

interface WhatsAppBroadcastModalProps {
  order: OrderWithAnswers | null;
  onClose: () => void;
  onMarkContacted: () => Promise<void>;
  isContacted: boolean;
}

type TemplateType = "konfirmasi" | "pembayaran" | "pengiriman" | "custom";

const DEFAULT_PAYMENT = `BCA: 1234567890 a.n. MB Chondro
BRI: 0987654321 a.n. MB Chondro
(Harap konfirmasi dengan mengirimkan bukti transfer)`;

const DEFAULT_LOKASI = `Basecamp MB Chondro Wonopringgo
Jl. Raya Wonopringgo No. 12, Pekalongan
(Jam Operasional: Senin - Sabtu, 08:00 - 17:00 WIB)`;

/**
 * Komponen Modal Kirim Pesan WhatsApp MB CHONDRO
 * Sesuai Spesifikasi Master: Modern Soft Red, Responsif Mobile (Bottom Sheet),
 * Desktop Centered (780-820px), Live WhatsApp Chat Preview, 4 Segmented Templates,
 * Validasi Nomor Internasional (+62) & Konfirmasi Unsaved Changes.
 */
export function WhatsAppBroadcastModal({
  order,
  onClose,
  onMarkContacted,
  isContacted: _isContacted,
}: WhatsAppBroadcastModalProps) {
  const { success, error, info } = useToast();

  const [activeTemplate, setActiveTemplate] = useState<TemplateType>("konfirmasi");
  const [messageText, setMessageText] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Unsaved changes confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // 1. Ekstrak Data Pesanan dari Database Aktual
  const safeAnswers = useMemo(() => {
    return Array.isArray(order?.answers) ? order.answers : [];
  }, [order?.answers]);

  const customerName = (order?.customerName || "Customer").trim();
  const customerInitial = customerName ? customerName.charAt(0).toUpperCase() : "C";
  const rawPhone = order?.whatsapp || "";

  // Ekstrak nama jenis produk
  const jenisPesanan = useMemo(() => {
    const jenisAnswer = safeAnswers.find(
      (a) =>
        a &&
        (String(a?.label || "").toLowerCase().includes("jenis") ||
          String(a?.label || "").toLowerCase().includes("produk"))
    );
    if (jenisAnswer && typeof jenisAnswer.value === "string" && jenisAnswer.value.trim()) {
      return jenisAnswer.value.trim();
    }
    return "Kaos MB Chondro";
  }, [safeAnswers]);

  // Ekstrak varian ukuran, jumlah, dan subtotal
  const { parsedVariants, totalQty, totalPriceNumber } = useMemo(() => {
    const variants: Array<{
      qty: number;
      size: string;
      sleeve: string;
      unitPrice: number;
      subtotal: number;
    }> = [];

    let derivedQty = 0;
    let derivedPrice = 0;

    safeAnswers.forEach((ans) => {
      if (!ans) return;
      const ansValStr = typeof ans.value === "string" ? ans.value : String(ans.value || "");
      const lines = ansValStr.split("\n");

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("•")) {
          const match = trimmed.match(
            /•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\](?:\s*@\s*(.*?)=\s*(.*?))?$/i
          );
          if (match) {
            const qty = parseInt(match[1], 10) || 0;
            const unitPriceStr = match[4] ? match[4].replace(/[^0-9]/g, "") : "";
            const subtotalStr = match[5] ? match[5].replace(/[^0-9]/g, "") : "";
            const unitPrice = unitPriceStr ? parseInt(unitPriceStr, 10) : 0;
            const subtotal = subtotalStr ? parseInt(subtotalStr, 10) : 0;
            variants.push({
              qty,
              size: match[2].trim(),
              sleeve: match[3].trim(),
              unitPrice,
              subtotal,
            });
          }
        }

        if (trimmed.includes("Total:")) {
          const matchTotal = trimmed.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*(.*?))?/i);
          if (matchTotal) {
            if (!derivedQty) derivedQty = parseInt(matchTotal[1], 10);
            if (matchTotal[2]) {
              const priceOnly = matchTotal[2].replace(/[^0-9]/g, "");
              if (priceOnly) derivedPrice = parseInt(priceOnly, 10);
            }
          }
        }
      });
    });

    if (derivedQty === 0 && variants.length > 0) {
      derivedQty = variants.reduce((acc, v) => acc + v.qty, 0);
    }
    if (derivedPrice === 0 && variants.length > 0) {
      derivedPrice = variants.reduce((acc, v) => acc + v.subtotal, 0);
    }

    if (derivedPrice === 0) {
      safeAnswers.forEach((ans) => {
        const lbl = String(ans?.label || "").toLowerCase();
        const val = String(ans?.value || "");
        if (
          lbl.includes("total") ||
          lbl.includes("harga") ||
          lbl.includes("tagihan") ||
          val.includes("Total:") ||
          val.includes("Rp")
        ) {
          const numOnly = val.replace(/[^0-9]/g, "");
          if (numOnly) {
            const parsedNum = parseInt(numOnly, 10);
            if (parsedNum > derivedPrice) derivedPrice = parsedNum;
          }
        }
      });
    }

    return {
      parsedVariants: variants,
      totalQty: derivedQty || 1,
      totalPriceNumber: derivedPrice,
    };
  }, [safeAnswers]);

  // Kalkulasi Pembayaran & DP
  const { dpNominal, sisaKekurangan } = useMemo(() => {
    if (!order) return { dpNominal: 0, sisaKekurangan: 0 };
    const isLunas = order.paymentStatus === "lunas";
    let dp = 0;

    if (isLunas) {
      dp = totalPriceNumber > 0 ? totalPriceNumber : order.dpAmount || 0;
    } else if (order.dpAmount && order.dpAmount > 0) {
      dp = order.dpAmount;
    } else if (totalPriceNumber > 0) {
      // Standar DP 10% jika belum terdata di order
      dp = Math.round((totalPriceNumber * 10) / 100);
    }

    const sisa = Math.max(0, totalPriceNumber - dp);
    return {
      dpNominal: dp,
      sisaKekurangan: isLunas ? 0 : sisa,
    };
  }, [order, totalPriceNumber]);

  // Format Rincian Pesanan
  const rincianPesananText = useMemo(() => {
    if (parsedVariants.length > 0) {
      return parsedVariants
        .map((v) => {
          let line = `• ${v.qty} pcs [${v.size} - ${v.sleeve}]`;
          if (v.unitPrice > 0) {
            line += ` @ ${formatRupiah(v.unitPrice)}`;
          }
          return line;
        })
        .join("\n");
    }
    return `• ${totalQty} pcs ${jenisPesanan}`;
  }, [parsedVariants, totalQty, jenisPesanan]);

  // Format Status Pesanan
  const statusPesananText = useMemo(() => {
    if (!order) return "Sedang Diproses";
    if (order.status === "selesai") return "Selesai & Siap Diambil";
    if (order.status === "diproses") return "Sedang Diproses";
    return "Menunggu Diproses";
  }, [order]);

  // 2. Fungsi Pembangkit Template Pesan WhatsApp
  const generateMessageForTemplate = useMemo(() => {
    return (tmpl: TemplateType): string => {
      switch (tmpl) {
        case "konfirmasi":
          return `Halo Kak ${customerName} 👋

Terima kasih telah melakukan pemesanan di MB Chondro Wonopringgo.

Berikut rincian pesanan Anda:

${rincianPesananText}

Kami akan segera memproses pesanan Anda.

Terima kasih 🙏`;

        case "pembayaran":
          return `Halo Kak ${customerName} 👋

Berikut informasi pembayaran pesanan Anda:

Total Pesanan: ${formatRupiah(totalPriceNumber)}
DP: ${formatRupiah(dpNominal)}
Sisa Pembayaran: ${formatRupiah(sisaKekurangan)}

Informasi rekening:
${DEFAULT_PAYMENT}

Terima kasih.`;

        case "pengiriman":
          return `Halo Kak ${customerName} 👋

Kami informasikan bahwa pesanan Anda saat ini berstatus ${statusPesananText}.

Berikut rincian pesanan:
${rincianPesananText}

📍 Lokasi Pengambilan:
${DEFAULT_LOKASI}

Terima kasih telah mempercayakan pesanan kepada MB Chondro Wonopringgo.`;

        case "custom":
          return `Halo Kak ${customerName} 👋

Terima kasih telah menghubungi MB Chondro Wonopringgo.

Rincian Pesanan:
${rincianPesananText}

Ada yang bisa kami bantu terkait pesanan Anda?

Terima kasih 🙏`;
      }
    };
  }, [
    customerName,
    rincianPesananText,
    totalPriceNumber,
    dpNominal,
    sisaKekurangan,
    statusPesananText,
  ]);

  // Sinkronisasi teks awal saat modal dibuka atau order berganti
  useEffect(() => {
    if (order) {
      const defaultTmpl: TemplateType =
        order.status === "selesai" ? "pengiriman" : "konfirmasi";
      setActiveTemplate(defaultTmpl);
      setMessageText(generateMessageForTemplate(defaultTmpl));
      setIsDirty(false);
      setShowPreview(false);
      setCopiedPhone(false);
      setCopiedText(false);
    }
  }, [order, generateMessageForTemplate]);

  // Menutup modal dengan ESC
  useEffect(() => {
    if (!order) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleAttemptClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [order, isDirty]);

  if (!order) return null;

  // 3. Handler Tombol dan Aksi
  const handleAttemptClose = () => {
    if (isDirty) {
      setConfirmDialog({
        open: true,
        title: "Perubahan Belum Dikirim",
        message:
          "Anda telah mengedit pesan ini secara manual. Yakin ingin menutup tanpa mengirim pesan?",
        onConfirm: () => {
          setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
          setIsDirty(false);
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  const handleSelectTemplate = (tmpl: TemplateType) => {
    if (tmpl === activeTemplate) return;

    if (isDirty) {
      setConfirmDialog({
        open: true,
        title: "Ganti Template Pesan",
        message:
          "Beralih template akan mengganti teks pesan yang sudah Anda edit. Lanjutkan?",
        onConfirm: () => {
          setActiveTemplate(tmpl);
          setMessageText(generateMessageForTemplate(tmpl));
          setIsDirty(false);
          setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
          info(`Template diubah ke: ${getTemplateLabel(tmpl)}`);
        },
      });
    } else {
      setActiveTemplate(tmpl);
      setMessageText(generateMessageForTemplate(tmpl));
      setIsDirty(false);
    }
  };

  const handleResetCurrentTemplate = () => {
    setMessageText(generateMessageForTemplate(activeTemplate));
    setIsDirty(false);
    info("Isi pesan dikembalikan sesuai template standar.");
  };

  const handleCopyPhone = () => {
    if (!rawPhone || rawPhone === "-") {
      error("Nomor WhatsApp belum tersedia.");
      return;
    }
    navigator.clipboard.writeText(rawPhone);
    setCopiedPhone(true);
    success("Nomor WhatsApp berhasil disalin!");
    setTimeout(() => setCopiedPhone(false), 2200);
  };

  const handleCopyMessage = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    success("Isi pesan WhatsApp berhasil disalin!");
    setTimeout(() => setCopiedText(false), 2200);
  };

  const handleSendWhatsApp = async () => {
    const cleanNumber = formatNomorWhatsAppUrl(rawPhone);

    // Validasi nomor telepon
    if (!cleanNumber || cleanNumber.length < 9) {
      error(
        "Nomor WhatsApp customer tidak valid atau belum diisi. Pastikan nomor mencakup kode area yang benar."
      );
      return;
    }

    if (!messageText.trim()) {
      error("Isi pesan WhatsApp tidak boleh kosong.");
      return;
    }

    // Bangun URL WhatsApp Click to Chat
    const encodedMessage = encodeURIComponent(messageText.trim());
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

    // Tandai pesanan sebagai sudah dihubungi jika fungsi callback tersedia
    try {
      if (onMarkContacted) {
        await onMarkContacted();
      }
    } catch (_err) {
      // Lanjutkan pengiriman pesan meskipun update status backend tertunda
    }

    // Buka WhatsApp Click to Chat di tab baru
    window.open(waUrl, "_blank", "noopener,noreferrer");
    success("Membuka WhatsApp Click to Chat...");
    setIsDirty(false);
    onClose();
  };

  return createPortal(
    <div
      className="wa-modal-overlay"
      onClick={handleAttemptClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="wa-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="wa-modal-handle-bar" />

        {/* 1. Header Modal */}
        <div className="wa-modal-header">
          <div className="wa-modal-header-left">
            <div className="wa-icon-badge" title="Fitur Kirim Pesan WhatsApp MB CHONDRO">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-5.805 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </div>
            <div className="wa-modal-titles">
              <h3 className="wa-modal-title">Kirim Pesan WhatsApp</h3>
              <p className="wa-modal-subtitle">
                Hubungi customer secara langsung melalui WhatsApp resmi
              </p>
            </div>
          </div>
          <button
            type="button"
            className="wa-modal-close-btn"
            onClick={handleAttemptClose}
            aria-label="Tutup modal"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Body Modal */}
        <div className="wa-modal-body">
          {/* A. Informasi Customer (Horizontal Card) */}
          <div className="wa-cust-card">
            <div className="wa-cust-left">
              <div className="wa-cust-avatar" title={customerName}>
                {customerInitial}
              </div>
              <div className="wa-cust-meta">
                <div className="wa-cust-name-row">
                  <span className="wa-cust-name" title={customerName}>
                    {customerName}
                  </span>
                </div>
                <div className="wa-cust-phone-row">
                  <span>{rawPhone || "-"}</span>
                  {rawPhone && (
                    <button
                      type="button"
                      className="wa-copy-btn"
                      onClick={handleCopyPhone}
                      title="Salin nomor WhatsApp"
                    >
                      {copiedPhone ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                      <span>{copiedPhone ? "Disalin" : "Salin"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="wa-cust-right">
              <div className="wa-order-chip">
                <span className="wa-order-chip-label">Pesanan</span>
                <span className="wa-order-chip-val">{totalQty} pcs</span>
              </div>
              <div className="wa-order-chip">
                <span className="wa-order-chip-label">Produk</span>
                <span
                  className="wa-order-chip-val"
                  title={jenisPesanan}
                  style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {jenisPesanan}
                </span>
              </div>
            </div>
          </div>

          {/* B. Segmented Buttons Template Pesan (4 Pilihan) */}
          <div className="wa-template-segmented">
            <button
              type="button"
              className={`wa-template-btn ${activeTemplate === "konfirmasi" ? "active" : ""}`}
              onClick={() => handleSelectTemplate("konfirmasi")}
            >
              <FileCheck size={14} />
              <span>Konfirmasi Pesanan</span>
            </button>
            <button
              type="button"
              className={`wa-template-btn ${activeTemplate === "pembayaran" ? "active" : ""}`}
              onClick={() => handleSelectTemplate("pembayaran")}
            >
              <CreditCard size={14} />
              <span>Info Pembayaran</span>
            </button>
            <button
              type="button"
              className={`wa-template-btn ${activeTemplate === "pengiriman" ? "active" : ""}`}
              onClick={() => handleSelectTemplate("pengiriman")}
            >
              <Truck size={14} />
              <span>Pengiriman</span>
            </button>
            <button
              type="button"
              className={`wa-template-btn ${activeTemplate === "custom" ? "active" : ""}`}
              onClick={() => handleSelectTemplate("custom")}
            >
              <PenLine size={14} />
              <span>Custom</span>
            </button>
          </div>

          {/* C. Preview Mode atau Editor Mode */}
          {showPreview ? (
            <div className="wa-editor-wrapper">
              <div className="wa-editor-top-bar">
                <span className="wa-editor-label">
                  <CheckCircle2 size={14} color="#16A34A" /> Pratinjau Tampilan WhatsApp
                </span>
                <div className="wa-editor-actions-top">
                  <button
                    type="button"
                    className="wa-copy-btn"
                    onClick={() => setShowPreview(false)}
                    title="Kembali ke editor pesan"
                  >
                    <span>Kembali ke Editor</span>
                  </button>
                </div>
              </div>

              {/* Chat Bubble Simulation */}
              <div className="wa-preview-box">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#075E54",
                    color: "#FFFFFF",
                    padding: "8px 12px",
                    borderRadius: "8px 8px 0 0",
                    margin: "-16px -16px 8px -16px",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      color: "#075E54",
                      fontWeight: 700,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {customerInitial}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                      {customerName}
                    </span>
                    <span style={{ fontSize: 10, color: "#C8F0E5" }}>online</span>
                  </div>
                </div>

                <div className="wa-bubble-sent">
                  <div className="wa-bubble-text">{messageText}</div>
                  <div className="wa-bubble-meta">
                    <span>
                      {new Date().toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <CheckCheck size={14} color="#34B7F1" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="wa-editor-wrapper">
              <div className="wa-editor-top-bar">
                <span className="wa-editor-label">
                  <PenLine size={13} color="#64748B" /> Editor Pesan (Dapat Diedit)
                </span>
                <div className="wa-editor-actions-top">
                  {isDirty && (
                    <button
                      type="button"
                      className="wa-copy-btn"
                      onClick={handleResetCurrentTemplate}
                      title="Kembalikan teks ke template standar"
                    >
                      <RotateCcw size={11} />
                      <span>Reset Teks</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="wa-copy-btn"
                    onClick={handleCopyMessage}
                    title="Salin isi pesan ke clipboard"
                  >
                    {copiedText ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                    <span>{copiedText ? "Tersalin" : "Salin Pesan"}</span>
                  </button>
                </div>
              </div>

              <div className="wa-textarea-card">
                <textarea
                  className="wa-textarea-input"
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Ketik isi pesan WhatsApp di sini..."
                  rows={8}
                />
                <div className="wa-editor-bottom-bar">
                  <span style={{ fontSize: 11, color: isDirty ? "#D97706" : "#64748B" }}>
                    {isDirty ? "● Pesan telah disesuaikan secara manual" : "Template standar aktif"}
                  </span>
                  <span className="wa-char-counter">{messageText.length} karakter</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Footer Aksi: Preview & Kirim Sekarang */}
        <div className="wa-modal-footer">
          <div className="wa-modal-footer-left">
            <button
              type="button"
              className={`wa-btn-preview ${showPreview ? "active" : ""}`}
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? "Tutup pratinjau" : "Lihat simulasi pesan di WhatsApp"}
            >
              <Eye size={15} />
              <span>{showPreview ? "Kembali ke Editor" : "Preview Pesan"}</span>
            </button>
          </div>

          <div className="wa-modal-footer-right">
            <button
              type="button"
              className="wa-btn-send"
              onClick={handleSendWhatsApp}
              title="Kirim pesan melalui WhatsApp Web / Aplikasi"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-5.805 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span>Kirim Sekarang</span>
            </button>
          </div>
        </div>

        {/* 4. Dialog Konfirmasi Perubahan Belum Disimpan */}
        {confirmDialog.open && (
          <div className="wa-confirm-dialog-overlay">
            <div className="wa-confirm-dialog">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#FEF3C7",
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} />
                </div>
                <h4>{confirmDialog.title}</h4>
              </div>
              <p>{confirmDialog.message}</p>
              <div className="wa-confirm-dialog-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setConfirmDialog({
                      open: false,
                      title: "",
                      message: "",
                      onConfirm: () => {},
                    })
                  }
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: "#DC1717", borderColor: "#B91C1C" }}
                  onClick={confirmDialog.onConfirm}
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function getTemplateLabel(tmpl: TemplateType): string {
  switch (tmpl) {
    case "konfirmasi":
      return "Konfirmasi Pesanan";
    case "pembayaran":
      return "Info Pembayaran";
    case "pengiriman":
      return "Pengiriman";
    case "custom":
      return "Custom";
  }
}
