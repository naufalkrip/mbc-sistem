import { useState, useEffect } from "react";
import { Settings, Send, CheckCircle2 } from "lucide-react";
import type { OrderWithAnswers } from "../../types";
import { formatNomorWhatsAppUrl, formatRupiah } from "../../utils/format";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";

interface WhatsAppBroadcastModalProps {
  order: OrderWithAnswers | null;
  onClose: () => void;
  onMarkContacted: () => Promise<void>;
  isContacted: boolean;
}

const DEFAULT_TEMPLATE = `Halo Kak *{nama}* 👋

Terima kasih telah melakukan pemesanan di *MB Chondro Wonopringgo*.

Berikut rincian pesanan Anda:

*RINCIAN PESANAN*
────────────────────
{rincian_pesanan}
────────────────────

*Jumlah Pesanan: {jumlah_pesanan} pcs*

*Total Harga: {total_harga}*

*DP {dp_persen}%: {nominal_dp}*

Silakan melakukan pembayaran DP sebesar:

*{nominal_dp}*

{info_pembayaran}

Setelah melakukan pembayaran, silakan kirimkan bukti pembayaran melalui WhatsApp ini.

Terima kasih 🙏

*MB Chondro Wonopringgo*`;

const DEFAULT_PAYMENT = `Pembayaran dapat dilakukan melalui:

BRI
1234567890
a.n. MB Chondro`;

export function WhatsAppBroadcastModal({ order, onClose, onMarkContacted, isContacted }: WhatsAppBroadcastModalProps) {
  const { success, error } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [paymentInfo, setPaymentInfo] = useState(DEFAULT_PAYMENT);
  const [dpPercent, setDpPercent] = useState(10);

  // Load settings from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wa_template_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.template) setTemplate(parsed.template);
        if (parsed.paymentInfo) setPaymentInfo(parsed.paymentInfo);
        if (parsed.dpPercent !== undefined) setDpPercent(parsed.dpPercent);
      }
    } catch (err) {}
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem("wa_template_settings", JSON.stringify({ template, paymentInfo, dpPercent }));
      success("Template WhatsApp berhasil disimpan.");
      setShowSettings(false);
    } catch (err) {
      error("Gagal menyimpan pengaturan.");
    }
  };

  if (!order) return null;

  // Extract variants and compute totals
  const parsedVariants: any[] = [];
  let totalQty = 0;
  let totalPriceNumber = 0;

  // Identify order name (jenis pesanan)
  const jenisAnswer = order.answers.find(
    (a) => String(a?.label || "").toLowerCase().includes("jenis") || String(a?.label || "").toLowerCase().includes("produk")
  );
  const jenisPesanan = jenisAnswer ? jenisAnswer.value : "Kaos MB Chondro";

  order.answers.forEach((ans) => {
    if (typeof ans.value === "string" && ans.value.includes("•")) {
      const lines = ans.value.split("\n");
      lines.forEach((line) => {
        if (line.trim().startsWith("•")) {
          const match = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\](?:\s*@\s*Rp\s*([\d.]+)=\s*Rp\s*([\d.]+))?/i);
          if (match) {
            const qty = parseInt(match[1], 10) || 0;
            const unitPrice = match[4] ? parseInt(match[4].replace(/\./g, ""), 10) : 0;
            const subtotal = match[5] ? parseInt(match[5].replace(/\./g, ""), 10) : 0;
            parsedVariants.push({
              qty,
              size: match[2].trim(),
              sleeve: match[3].trim(),
              unitPrice,
              subtotal,
            });
          } else {
             // Fallback regex for non-price format
             const matchNoPrice = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\]/i);
             if (matchNoPrice) {
                parsedVariants.push({
                    qty: parseInt(matchNoPrice[1], 10) || 0,
                    size: matchNoPrice[2].trim(),
                    sleeve: matchNoPrice[3].trim(),
                    unitPrice: 0,
                    subtotal: 0,
                  });
             }
          }
        } else if (line.includes("Total:")) {
          // Parse string like: (Total: 3 pcs | Rp 170.000)
          const matchTotal = line.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*Rp\s*([\d.]+))?/i);
          if (matchTotal) {
            totalQty = parseInt(matchTotal[1], 10);
            if (matchTotal[2]) {
              totalPriceNumber = parseInt(matchTotal[2].replace(/\./g, ""), 10);
            }
          }
        }
      });
    }
  });

  // Fallback calculation if Regex didn't catch total
  if (totalQty === 0) {
    totalQty = parsedVariants.reduce((acc, v) => acc + v.qty, 0);
  }
  if (totalPriceNumber === 0) {
    totalPriceNumber = parsedVariants.reduce((acc, v) => acc + v.subtotal, 0);
  }

  // Calculate DP
  const dpNominal = Math.round((totalPriceNumber * dpPercent) / 100);

  // Build the message parts
  const rincianText = parsedVariants
    .map((v, idx) => {
      let text = `${idx + 1}. ${jenisPesanan}
   Size: ${v.size}
   Lengan: ${v.sleeve}
   Jumlah: ${v.qty} pcs`;
      if (v.unitPrice > 0) {
        text += `\n   Harga: ${formatRupiah(v.unitPrice)}/pcs
   Subtotal: ${formatRupiah(v.subtotal)}`;
      }
      return text;
    })
    .join("\n\n");

  const finalMessage = template
    .replace(/{nama}/g, order.customerName)
    .replace(/{rincian_pesanan}/g, rincianText || "Rincian pesanan tidak tersedia")
    .replace(/{jumlah_pesanan}/g, String(totalQty))
    .replace(/{total_harga}/g, formatRupiah(totalPriceNumber))
    .replace(/{dp_persen}/g, String(dpPercent))
    .replace(/{nominal_dp}/g, formatRupiah(dpNominal))
    .replace(/{info_pembayaran}/g, paymentInfo);

  const rawWaClean = formatNomorWhatsAppUrl(order.whatsapp);
  const directWaUrl = rawWaClean ? `https://wa.me/${rawWaClean}?text=${encodeURIComponent(finalMessage)}` : null;

  const handleOpenWhatsApp = () => {
    if (directWaUrl) {
      window.open(directWaUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={showSettings ? "Pengaturan Template WhatsApp" : "Kirim WhatsApp Customer"}
      size={showSettings ? "md" : "lg"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {showSettings ? (
          <>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                Template Pesan
              </label>
              <textarea
                className="input"
                style={{ width: "100%", height: 300, resize: "vertical", fontSize: "13px", fontFamily: "monospace" }}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 6 }}>
                Variable: {"{nama}, {rincian_pesanan}, {jumlah_pesanan}, {total_harga}, {dp_persen}, {nominal_dp}, {info_pembayaran}"}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                  Persentase DP (%)
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  value={dpPercent}
                  onChange={(e) => setDpPercent(Number(e.target.value) || 0)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                Informasi Pembayaran
              </label>
              <textarea
                className="input"
                style={{ width: "100%", height: 100, resize: "vertical", fontSize: "13px" }}
                value={paymentInfo}
                onChange={(e) => setPaymentInfo(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowSettings(false)}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={saveSettings}>
                Simpan Pengaturan
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Customer</span>
                <strong style={{ fontSize: "14px", color: "var(--navy-900)" }}>{order.customerName}</strong>
              </div>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Nomor WhatsApp</span>
                <strong style={{ fontSize: "14px", color: "var(--navy-900)" }}>{order.whatsapp}</strong>
              </div>
              <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Status Kontak</span>
                  {isContacted ? (
                    <strong style={{ fontSize: "14px", color: "#16a34a", display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={16} /> Sudah Dihubungi
                    </strong>
                  ) : (
                    <strong style={{ fontSize: "14px", color: "#dc2626" }}>Belum Dihubungi</strong>
                  )}
                </div>
                {!isContacted && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={onMarkContacted} style={{ fontSize: "11px" }}>
                    Tandai Sudah
                  </button>
                )}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: "14px", color: "var(--navy-900)" }}>Preview Pesan</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowSettings(true)}
                  style={{ color: "#3b82f6", fontSize: "13px" }}
                >
                  <Settings size={16} style={{ marginRight: 6 }} /> Pengaturan Template
                </button>
              </div>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  padding: "16px",
                  borderRadius: 8,
                  fontSize: "13.5px",
                  color: "#166534",
                  whiteSpace: "pre-wrap",
                  fontFamily: "system-ui, sans-serif",
                  lineHeight: 1.6,
                  maxHeight: "45vh",
                  overflowY: "auto",
                }}
              >
                {finalMessage}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenWhatsApp}
                disabled={!directWaUrl}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Send size={18} /> Buka WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
