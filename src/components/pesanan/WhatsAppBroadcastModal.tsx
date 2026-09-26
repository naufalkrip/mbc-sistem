import { useState, useEffect } from "react";
import { Settings, Send, CheckCircle2, Clock, CheckCircle } from "lucide-react";
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

const DEFAULT_TEMPLATE_DIPROSES = `Halo Kak *{nama}* 👋

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

const DEFAULT_TEMPLATE_SELESAI = `Halo Kak *{nama}* 👋

Kabar gembira! Pesanan *{jenis_pesanan}* Anda di *MB Chondro Wonopringgo* telah *SELESAI* dikerjakan dan siap diambil 🎉

*RINCIAN PESANAN*
────────────────────
{rincian_pesanan}
────────────────────

*Jumlah Pesanan: {jumlah_pesanan} pcs*

📍 *LOKASI PENGAMBILAN:*
{lokasi_pengambilan}

Silakan mengonfirmasi ke admin saat hendak mengambil pesanan. Terima kasih! 🙏

*MB Chondro Wonopringgo*`;

const DEFAULT_PAYMENT = `Pembayaran dapat dilakukan melalui:

BRI
1234567890
a.n. MB Chondro`;

const DEFAULT_LOKASI = `Basecamp MB Chondro Wonopringgo
Jl. Raya Wonopringgo No. 12, Pekalongan
(Jam Operasional: Senin - Sabtu, 08:00 - 17:00 WIB)`;

export function WhatsAppBroadcastModal({ order, onClose, onMarkContacted, isContacted }: WhatsAppBroadcastModalProps) {
  const { success, error } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [activeMode, setActiveMode] = useState<"diproses" | "selesai">("diproses");
  
  const [templateDiproses, setTemplateDiproses] = useState(DEFAULT_TEMPLATE_DIPROSES);
  const [templateSelesai, setTemplateSelesai] = useState(DEFAULT_TEMPLATE_SELESAI);
  const [lokasiPengambilan, setLokasiPengambilan] = useState(DEFAULT_LOKASI);
  const [paymentInfo, setPaymentInfo] = useState(DEFAULT_PAYMENT);
  const [dpPercent, setDpPercent] = useState(10);

  // Sync activeMode based on order status when order prop changes
  useEffect(() => {
    if (order) {
      if (order.status === "selesai") {
        setActiveMode("selesai");
      } else {
        setActiveMode("diproses");
      }
    }
  }, [order]);

  // Load settings from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wa_template_settings_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.templateDiproses) setTemplateDiproses(parsed.templateDiproses);
        if (parsed.templateSelesai) setTemplateSelesai(parsed.templateSelesai);
        if (parsed.lokasiPengambilan) setLokasiPengambilan(parsed.lokasiPengambilan);
        if (parsed.paymentInfo) setPaymentInfo(parsed.paymentInfo);
        if (parsed.dpPercent !== undefined) setDpPercent(parsed.dpPercent);
      }
    } catch (err) {}
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem(
        "wa_template_settings_v2",
        JSON.stringify({
          templateDiproses,
          templateSelesai,
          lokasiPengambilan,
          paymentInfo,
          dpPercent,
        })
      );
      success("Pengaturan template WhatsApp berhasil disimpan.");
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

  const safeAnswers = Array.isArray(order.answers) ? order.answers : [];

  // Identify order name (jenis pesanan)
  const jenisAnswer = safeAnswers.find(
    (a) => a && (String(a?.label || "").toLowerCase().includes("jenis") || String(a?.label || "").toLowerCase().includes("produk"))
  );
  const jenisPesanan = jenisAnswer && typeof jenisAnswer.value === "string" ? jenisAnswer.value : "Kaos MB Chondro";

  safeAnswers.forEach((ans) => {
    if (!ans) return;
    const ansValStr = typeof ans.value === "string" ? ans.value : String(ans.value || "");
    if (ansValStr.includes("•")) {
      const lines = ansValStr.split("\n");
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

  const currentTemplate = activeMode === "selesai" ? templateSelesai : templateDiproses;

  const finalMessage = currentTemplate
    .replace(/{nama}/g, order.customerName || "Customer")
    .replace(/{jenis_pesanan}/g, jenisPesanan)
    .replace(/{rincian_pesanan}/g, rincianText || "Rincian pesanan tidak tersedia")
    .replace(/{jumlah_pesanan}/g, String(totalQty))
    .replace(/{total_harga}/g, formatRupiah(totalPriceNumber))
    .replace(/{dp_persen}/g, String(dpPercent))
    .replace(/{nominal_dp}/g, formatRupiah(dpNominal))
    .replace(/{info_pembayaran}/g, paymentInfo)
    .replace(/{lokasi_pengambilan}/g, lokasiPengambilan);

  const rawWaClean = formatNomorWhatsAppUrl(order.whatsapp || "");
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
            <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === "diproses" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setActiveMode("diproses")}
              >
                Template Diproses (Konfirmasi DP)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === "selesai" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setActiveMode("selesai")}
              >
                Template Selesai (Pengambilan)
              </button>
            </div>

            {activeMode === "diproses" ? (
              <>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                    Template Pesanan Diproses (DP)
                  </label>
                  <textarea
                    className="form-input"
                    style={{ width: "100%", height: 220, resize: "vertical", fontSize: "12.5px", fontFamily: "monospace" }}
                    value={templateDiproses}
                    onChange={(e) => setTemplateDiproses(e.target.value)}
                  />
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
                    Variabel: {"{nama}, {jenis_pesanan}, {rincian_pesanan}, {jumlah_pesanan}, {total_harga}, {dp_persen}, {nominal_dp}, {info_pembayaran}"}
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                      Persentase DP (%)
                    </label>
                    <input
                      type="number"
                      className="form-input"
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
                    Informasi Pembayaran / Rekening DP
                  </label>
                  <textarea
                    className="form-input"
                    style={{ width: "100%", height: 80, resize: "vertical", fontSize: "12.5px" }}
                    value={paymentInfo}
                    onChange={(e) => setPaymentInfo(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                    Template Pesanan Selesai (Pengambilan)
                  </label>
                  <textarea
                    className="form-input"
                    style={{ width: "100%", height: 220, resize: "vertical", fontSize: "12.5px", fontFamily: "monospace" }}
                    value={templateSelesai}
                    onChange={(e) => setTemplateSelesai(e.target.value)}
                  />
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
                    Variabel: {"{nama}, {jenis_pesanan}, {rincian_pesanan}, {jumlah_pesanan}, {lokasi_pengambilan}"}
                  </p>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
                    Lokasi Pengambilan Pesanan
                  </label>
                  <textarea
                    className="form-input"
                    style={{ width: "100%", height: 80, resize: "vertical", fontSize: "12.5px" }}
                    value={lokasiPengambilan}
                    onChange={(e) => setLokasiPengambilan(e.target.value)}
                    placeholder="Masukkan nama lokasi, alamat, atau jam operasional..."
                  />
                </div>
              </>
            )}

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Customer</span>
                <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>{order.customerName}</strong>
              </div>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Nomor WhatsApp</span>
                <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>{order.whatsapp}</strong>
              </div>
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Status Kontak</span>
                  {isContacted ? (
                    <strong style={{ fontSize: "13px", color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}>
                      <CheckCircle2 size={15} /> Sudah Dihubungi
                    </strong>
                  ) : (
                    <strong style={{ fontSize: "13px", color: "#dc2626" }}>Belum Dihubungi</strong>
                  )}
                </div>
                {!isContacted && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={onMarkContacted} style={{ fontSize: "11px", padding: "3px 8px" }}>
                    Tandai
                  </button>
                )}
              </div>
            </div>

            {/* TAB SELECTOR UNTUK PILIH MODE PESAN */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: "#f1f5f9", padding: 4, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", gap: 4, flex: 1 }}>
                <button
                  type="button"
                  onClick={() => setActiveMode("diproses")}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: activeMode === "diproses" ? "#2563eb" : "transparent",
                    color: activeMode === "diproses" ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: activeMode === "diproses" ? 600 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Clock size={14} />
                  <span>Konfirmasi Diproses (DP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode("selesai")}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: activeMode === "selesai" ? "#16a34a" : "transparent",
                    color: activeMode === "selesai" ? "#ffffff" : "var(--text-secondary)",
                    fontWeight: activeMode === "selesai" ? 600 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Pengambilan Selesai</span>
                </button>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSettings(true)}
                style={{ color: "var(--primary-700, #c8101e)", fontSize: "12px", fontWeight: 600, padding: "4px 10px" }}
              >
                <Settings size={14} style={{ marginRight: 4 }} /> Pengaturan Template
              </button>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>
                  Pratinjau Pesan ({activeMode === "selesai" ? "Pesanan Selesai / Pengambilan" : "Pesanan Diproses / DP"})
                </strong>
              </div>
              <div
                style={{
                  background: activeMode === "selesai" ? "#f0fdf4" : "#eff6ff",
                  border: activeMode === "selesai" ? "1px solid #86efac" : "1px solid #93c5fd",
                  padding: "16px",
                  borderRadius: 10,
                  fontSize: "13px",
                  color: activeMode === "selesai" ? "#166534" : "#1e40af",
                  whiteSpace: "pre-wrap",
                  fontFamily: "system-ui, sans-serif",
                  lineHeight: 1.6,
                  maxHeight: "40vh",
                  overflowY: "auto",
                }}
              >
                {finalMessage}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 6 }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenWhatsApp}
                disabled={!directWaUrl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: activeMode === "selesai" ? "#16a34a" : "#25D366",
                  borderColor: activeMode === "selesai" ? "#16a34a" : "#25D366",
                }}
              >
                <Send size={16} /> Buka WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
