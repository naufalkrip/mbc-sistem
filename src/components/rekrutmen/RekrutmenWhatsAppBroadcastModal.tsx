import { useState, useEffect, useMemo } from "react";
import {
  Settings,
  Send,
  Copy,
  MapPin,
  RotateCcw,
  Check,
  Search,
  Sparkles,
} from "lucide-react";
import type { RekrutmenSubmissionWithAnswers } from "../../types";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import {
  getRekrutmenWaSettings,
  saveRekrutmenWaSettings,
  buildRekrutmenWaMessage,
  buildRekrutmenWaLink,
  extractCandidateHpAndPosition,
  DEFAULT_REKRUTMEN_WA_SETTINGS,
  RekrutmenWaSettings,
} from "../../utils/rekrutmenWaTemplate";

interface RekrutmenWhatsAppBroadcastModalProps {
  open: boolean;
  onClose: () => void;
  formTitle?: string;
  submissions?: RekrutmenSubmissionWithAnswers[];
  initialSubmission?: RekrutmenSubmissionWithAnswers | null;
  initialMode?: "skrining" | "lolos" | "general";
  initialTab?: "broadcast" | "settings";
}

export function RekrutmenWhatsAppBroadcastModal({
  open,
  onClose,
  formTitle = "Rekrutmen Calon Anggota MB Chondro",
  submissions = [],
  initialSubmission = null,
  initialMode = "skrining",
  initialTab = "broadcast",
}: RekrutmenWhatsAppBroadcastModalProps) {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<"broadcast" | "settings">(initialTab);
  const [templateType, setTemplateType] = useState<"skrining" | "lolos" | "general">(initialMode);

  // Settings state
  const [settings, setSettings] = useState<RekrutmenWaSettings>(getRekrutmenWaSettings());

  // Broadcast live override state for Lokasi & Waktu
  const [overrideNamaTempat, setOverrideNamaTempat] = useState("");
  const [overrideTitikGmaps, setOverrideTitikGmaps] = useState("");
  const [overrideTanggalWaktu, setOverrideTanggalWaktu] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sync settings & overrides when modal opens or settings change
  useEffect(() => {
    if (open) {
      const loaded = getRekrutmenWaSettings();
      setSettings(loaded);
      setOverrideNamaTempat(loaded.namaTempat);
      setOverrideTitikGmaps(loaded.titikGmaps);
      setOverrideTanggalWaktu(loaded.tanggalWaktu);
      setActiveTab(initialTab);
      setTemplateType(initialMode);
    }
  }, [open, initialTab, initialMode]);

  // Save Settings to localStorage
  const handleSaveSettings = () => {
    try {
      saveRekrutmenWaSettings(settings);
      // Also update override defaults to match newly saved settings
      setOverrideNamaTempat(settings.namaTempat);
      setOverrideTitikGmaps(settings.titikGmaps);
      setOverrideTanggalWaktu(settings.tanggalWaktu);

      success("Pengaturan template & lokasi WhatsApp berhasil disimpan!");
      setActiveTab("broadcast");
    } catch (e) {
      error("Gagal menyimpan pengaturan WhatsApp.");
    }
  };

  // Reset settings to default
  const handleResetSettings = () => {
    if (window.confirm("Yakin ingin mengembalikan seluruh template WhatsApp & lokasi ke standar awal?")) {
      setSettings(DEFAULT_REKRUTMEN_WA_SETTINGS);
      saveRekrutmenWaSettings(DEFAULT_REKRUTMEN_WA_SETTINGS);
      setOverrideNamaTempat(DEFAULT_REKRUTMEN_WA_SETTINGS.namaTempat);
      setOverrideTitikGmaps(DEFAULT_REKRUTMEN_WA_SETTINGS.titikGmaps);
      setOverrideTanggalWaktu(DEFAULT_REKRUTMEN_WA_SETTINGS.tanggalWaktu);
      success("Template WhatsApp berhasil dikembalikan ke standar awal.");
    }
  };

  // Process list of candidate targets
  const candidateList = useMemo(() => {
    const list = initialSubmission
      ? [initialSubmission]
      : Array.isArray(submissions) && submissions.length > 0
      ? submissions
      : [];

    return list.map((sub) => {
      const info = extractCandidateHpAndPosition(sub);
      return {
        submission: sub,
        ...info,
      };
    });
  }, [initialSubmission, submissions]);

  // Filter candidates by search query
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidateList;
    const q = searchQuery.toLowerCase();
    return candidateList.filter(
      (c) => c.nama.toLowerCase().includes(q) || c.posisi.toLowerCase().includes(q) || (c.hp || "").includes(q)
    );
  }, [candidateList, searchQuery]);

  // Calculate live rendered message preview for single candidate or first candidate in list
  const activeCandidate = filteredCandidates[0] || candidateList[0] || null;

  const currentCustomSettings = useMemo(
    () => ({
      namaTempat: overrideNamaTempat,
      titikGmaps: overrideTitikGmaps,
      tanggalWaktu: overrideTanggalWaktu,
      templateSkrining: settings.templateSkrining,
      templateLolos: settings.templateLolos,
      templateGeneral: settings.templateGeneral,
    }),
    [overrideNamaTempat, overrideTitikGmaps, overrideTanggalWaktu, settings]
  );

  const renderedPreviewText = useMemo(() => {
    return buildRekrutmenWaMessage(templateType, {
      nama: activeCandidate?.nama || "Calon Anggota",
      judulForm: formTitle,
      posisi: activeCandidate?.posisi || "Posisi Pendaftaran",
      catatan: activeCandidate?.submission?.adminNote,
      customSettings: currentCustomSettings,
    });
  }, [templateType, activeCandidate, formTitle, currentCustomSettings]);

  const handleCopySingleMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    success("Pesan WhatsApp berhasil disalin!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleOpenWaSingle = (cand: typeof candidateList[0]) => {
    const link = buildRekrutmenWaLink(cand.hp || cand.rawHp, templateType, {
      nama: cand.nama,
      judulForm: formTitle,
      posisi: cand.posisi,
      catatan: cand.submission?.adminNote,
      customSettings: currentCustomSettings,
    });

    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      error("Nomor WhatsApp calon anggota ini tidak valid.");
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activeTab === "settings" ? "Pengaturan Template WhatsApp Broadcast" : "Kirim WhatsApp Broadcast Rekrutmen"}
      description={
        activeTab === "settings"
          ? "Atur lokasi (Nama tempat, titik GMaps, tanggal & waktu) serta format pesan"
          : `Target: ${candidateList.length} calon anggota (${formTitle})`
      }
      size="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Main Header Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f1f5f9",
            padding: 4,
            borderRadius: 10,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            <button
              type="button"
              onClick={() => setActiveTab("broadcast")}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "broadcast" ? "var(--primary-700, #c8101e)" : "transparent",
                color: activeTab === "broadcast" ? "#ffffff" : "var(--text-secondary)",
                fontWeight: activeTab === "broadcast" ? 600 : 500,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Send size={15} />
              <span>Broadcast / Kirim Pesan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: activeTab === "settings" ? "var(--primary-700, #c8101e)" : "transparent",
                color: activeTab === "settings" ? "#ffffff" : "var(--text-secondary)",
                fontWeight: activeTab === "settings" ? 600 : 500,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Settings size={15} />
              <span>Pengaturan Template &amp; Lokasi</span>
            </button>
          </div>
        </div>

        {/* TAB 1: BROADCAST / KIRIM PESAN */}
        {activeTab === "broadcast" && (
          <>
            {/* Mode Selection */}
            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--navy-900)", marginBottom: 6 }}>
                Pilih Jenis Broadcast Pesan:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setTemplateType("skrining")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: templateType === "skrining" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: templateType === "skrining" ? "#eff6ff" : "#ffffff",
                    color: templateType === "skrining" ? "#1e40af" : "var(--text-primary)",
                    fontWeight: templateType === "skrining" ? 700 : 500,
                    fontSize: "12.5px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  📅 Undangan Skrining / Audisi
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType("lolos")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: templateType === "lolos" ? "2px solid #059669" : "1px solid #cbd5e1",
                    background: templateType === "lolos" ? "#ecfdf5" : "#ffffff",
                    color: templateType === "lolos" ? "#065f46" : "var(--text-primary)",
                    fontWeight: templateType === "lolos" ? 700 : 500,
                    fontSize: "12.5px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  🎉 Pengumuman Lolos
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType("general")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: templateType === "general" ? "2px solid #d97706" : "1px solid #cbd5e1",
                    background: templateType === "general" ? "#fffbeb" : "#ffffff",
                    color: templateType === "general" ? "#92400e" : "var(--text-primary)",
                    fontWeight: templateType === "general" ? 700 : 500,
                    fontSize: "12.5px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  💬 Pesan General / Info
                </button>
              </div>
            </div>

            {/* Live Override Lokasi, Titik GMaps, Tanggal & Waktu */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "13px", color: "var(--navy-900)", display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={15} style={{ color: "#c8101e" }} />
                  Atur Rincian Lokasi &amp; Waktu Broadcast Ini
                </strong>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  (Bisa disesuaikan per pengiriman)
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: 4 }}>
                    📍 Nama Tempat Skrining / Basecamp
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: "100%", fontSize: "12.5px" }}
                    value={overrideNamaTempat}
                    onChange={(e) => setOverrideNamaTempat(e.target.value)}
                    placeholder="Contoh: Basecamp MB Chondro Wonopringgo"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: 4 }}>
                    🗺️ Titik GMaps (Link Google Maps)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: "100%", fontSize: "12.5px" }}
                    value={overrideTitikGmaps}
                    onChange={(e) => setOverrideTitikGmaps(e.target.value)}
                    placeholder="Contoh: https://maps.app.goo.gl/..."
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: 4 }}>
                    🗓️ Tanggal &amp; Waktu Pelaksanaan
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: "100%", fontSize: "12.5px" }}
                    value={overrideTanggalWaktu}
                    onChange={(e) => setOverrideTanggalWaktu(e.target.value)}
                    placeholder="Contoh: Sabtu, 15 Oktober 2026 pukul 14:00 WIB"
                  />
                </div>
              </div>
            </div>

            {/* Live Rendered WhatsApp Message Preview */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>
                  Pratinjau Pesan WhatsApp ({templateType === "skrining" ? "Undangan Skrining" : templateType === "lolos" ? "Pengumuman Lolos" : "Pesan General"})
                </strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleCopySingleMessage(renderedPreviewText, -1)}
                  style={{ fontSize: "11.5px", color: "var(--primary-700, #c8101e)" }}
                >
                  {copiedIndex === -1 ? <Check size={13} /> : <Copy size={13} />} Salin Teks Pesan
                </button>
              </div>

              <div
                style={{
                  background: templateType === "lolos" ? "#f0fdf4" : templateType === "skrining" ? "#eff6ff" : "#fffbeb",
                  border: templateType === "lolos" ? "1px solid #86efac" : templateType === "skrining" ? "1px solid #93c5fd" : "1px solid #fde68a",
                  padding: "16px",
                  borderRadius: 10,
                  fontSize: "13px",
                  color: templateType === "lolos" ? "#166534" : templateType === "skrining" ? "#1e40af" : "#78350f",
                  whiteSpace: "pre-wrap",
                  fontFamily: "system-ui, sans-serif",
                  lineHeight: 1.6,
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                {renderedPreviewText}
              </div>
            </div>

            {/* Candidate Broadcast Action List */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>
                  Daftar Penerima Broadcast ({filteredCandidates.length} Calon Anggota)
                </strong>

                {candidateList.length > 1 && (
                  <div style={{ position: "relative", minWidth: 200 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 4, paddingBottom: 4, fontSize: "12px", width: "100%" }}
                      placeholder="Cari nama / posisi / no. HP..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  maxHeight: "220px",
                  overflowY: "auto",
                  background: "#ffffff",
                }}
              >
                {filteredCandidates.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12.5px" }}>
                    Tidak ada pendaftar yang cocok.
                  </div>
                ) : (
                  filteredCandidates.map((cand, idx) => {
                    const singleLink = buildRekrutmenWaLink(cand.hp || cand.rawHp, templateType, {
                      nama: cand.nama,
                      judulForm: formTitle,
                      posisi: cand.posisi,
                      catatan: cand.submission?.adminNote,
                      customSettings: currentCustomSettings,
                    });

                    const singleMsg = buildRekrutmenWaMessage(templateType, {
                      nama: cand.nama,
                      judulForm: formTitle,
                      posisi: cand.posisi,
                      catatan: cand.submission?.adminNote,
                      customSettings: currentCustomSettings,
                    });

                    return (
                      <div
                        key={cand.submission?.id || idx}
                        style={{
                          padding: "10px 14px",
                          borderBottom: idx === filteredCandidates.length - 1 ? "none" : "1px solid #f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>{cand.nama}</strong>
                            <span
                              style={{
                                fontSize: "11px",
                                background: "#fee2e2",
                                color: "#991b1b",
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              🎺 {cand.posisi}
                            </span>
                          </div>
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "block" }}>
                            📱 {cand.hp || cand.rawHp || "Nomor HP tidak valid"}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleCopySingleMessage(singleMsg, idx)}
                            style={{ fontSize: "11.5px", padding: "4px 8px" }}
                            title="Salin pesan untuk calon anggota ini"
                          >
                            {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />} Salin
                          </button>

                          {singleLink ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenWaSingle(cand)}
                              style={{
                                fontSize: "11.5px",
                                padding: "4px 10px",
                                background: "#25D366",
                                borderColor: "#25D366",
                                color: "#ffffff",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Send size={12} /> Buka WA
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#dc2626" }}>No HP Rusak</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setActiveTab("settings")}
                style={{ fontSize: "12px", color: "var(--primary-700, #c8101e)" }}
              >
                <Settings size={14} style={{ marginRight: 4 }} /> Atur Template Default
              </button>

              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Tutup
              </button>
            </div>
          </>
        )}

        {/* TAB 2: PENGATURAN TEMPLATE & LOKASI */}
        {activeTab === "settings" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "12px 14px", borderRadius: 8 }}>
                <strong style={{ fontSize: "13px", color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={15} />
                  Informasi Variabel / Placeholder Otomatis
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#1e3a8a", lineHeight: 1.5 }}>
                  Gunakan variabel berikut di dalam pesan template: <br />
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{nama}"}</code>,{" "}
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{judul_form}"}</code>,{" "}
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{posisi}"}</code>,{" "}
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{nama_tempat}"}</code>,{" "}
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{titik_gmaps}"}</code>,{" "}
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{tanggal_waktu}"}</code>,{" "}
                  <code style={{ background: "#ffffff", padding: "1px 5px", borderRadius: 4, border: "1px solid #93c5fd" }}>{"{catatan}"}</code>.
                </p>
              </div>

              {/* Lokasi Settings Box */}
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "13.5px", color: "var(--navy-900)", display: "block", marginBottom: 10 }}>
                  📍 Pengaturan Lokasi &amp; Tanggal Default Rekrutmen
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: 4 }}>
                      Nama Tempat Skrining / Basecamp
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", fontSize: "12.5px" }}
                      value={settings.namaTempat}
                      onChange={(e) => setSettings({ ...settings, namaTempat: e.target.value })}
                      placeholder="Contoh: Basecamp MB Chondro Wonopringgo..."
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: 4 }}>
                      Titik GMaps (Link Tautan Maps)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", fontSize: "12.5px" }}
                      value={settings.titikGmaps}
                      onChange={(e) => setSettings({ ...settings, titikGmaps: e.target.value })}
                      placeholder="Contoh: https://maps.app.goo.gl/..."
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: 4 }}>
                      Tanggal &amp; Waktu Pelaksanaan Default
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", fontSize: "12.5px" }}
                      value={settings.tanggalWaktu}
                      onChange={(e) => setSettings({ ...settings, tanggalWaktu: e.target.value })}
                      placeholder="Contoh: Sabtu, 15 Oktober 2026 (Pukul 14.00 WIB)"
                    />
                  </div>
                </div>
              </div>

              {/* Template Undangan Skrining */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6, color: "var(--navy-900)" }}>
                  Template Pesan Undangan Skrining / Audisi
                </label>
                <textarea
                  className="form-input"
                  style={{ width: "100%", height: 160, resize: "vertical", fontSize: "12px", fontFamily: "monospace" }}
                  value={settings.templateSkrining}
                  onChange={(e) => setSettings({ ...settings, templateSkrining: e.target.value })}
                />
              </div>

              {/* Template Pengumuman Lolos */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6, color: "var(--navy-900)" }}>
                  Template Pesan Pengumuman Lolos Seleksi
                </label>
                <textarea
                  className="form-input"
                  style={{ width: "100%", height: 160, resize: "vertical", fontSize: "12px", fontFamily: "monospace" }}
                  value={settings.templateLolos}
                  onChange={(e) => setSettings({ ...settings, templateLolos: e.target.value })}
                />
              </div>

              {/* Template General */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: 6, color: "var(--navy-900)" }}>
                  Template Pesan General / Cadangan / Informasi
                </label>
                <textarea
                  className="form-input"
                  style={{ width: "100%", height: 120, resize: "vertical", fontSize: "12px", fontFamily: "monospace" }}
                  value={settings.templateGeneral}
                  onChange={(e) => setSettings({ ...settings, templateGeneral: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleResetSettings}
                style={{ fontSize: 12, color: "#dc2626", borderColor: "#fca5a5" }}
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} /> Reset ke Standar
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveTab("broadcast")}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveSettings}>
                  <Check size={14} style={{ marginRight: 4 }} /> Simpan Pengaturan
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
