import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Bookmark,
  Plus,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  Check,
  FileText,
  ChevronDown,
  Sparkles,
  QrCode,
  Download,
} from "lucide-react";
import type {
  RekrutmenFormWithFields,
  RekrutmenSubmissionWithAnswers,
  RekrutmenField,
  RekrutmenSubmissionStatus,
} from "../types";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  getRekrutmenFormData,
  getRekrutmenSubmissionsData,
  getRekrutmenStatsData,
  addRekrutmenFormItem,
  updateRekrutmenFormItem,
  deleteRekrutmenFormItem,
  addRekrutmenFieldItem,
  deleteRekrutmenFieldItem,
  updateRekrutmenSubmissionItem,
  deleteRekrutmenSubmissionItem,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import { SubmissionList } from "../components/rekrutmen/SubmissionList";
import { RekrutmenFormBuilderModal } from "../components/rekrutmen/RekrutmenFormBuilderModal";
import { Modal } from "../components/ui/Modal";

export function Rekrutmen() {
  const { success: toastSuccess, error: toastError } = useToast();

  const { data: form, refresh: refreshForm } = useApi<RekrutmenFormWithFields | null>(
    getRekrutmenFormData,
    "Gagal mengambil data formulir.",
    CACHE_KEYS.REKRUITMEN_FORM,
    { pollingInterval: 8000, revalidateOnFocus: true, immediate: true }
  );

  const formId = form?.id || "";
  const fetchSubmissions = useCallback(() => getRekrutmenSubmissionsData(formId), [formId]);
  const fetchStats = useCallback(() => getRekrutmenStatsData(formId), [formId]);

  const { data: submissions, loading: loadingSubs, refresh: refreshSubs } = useApi<
    RekrutmenSubmissionWithAnswers[]
  >(
    fetchSubmissions,
    "Gagal mengambil data pendaftar.",
    CACHE_KEYS.REKRUITMEN_SUBMISSIONS,
    { pollingInterval: 8000, revalidateOnFocus: true, immediate: true }
  );

  const { data: stats, refresh: refreshStats } = useApi(
    fetchStats,
    "Gagal mengambil statistik rekruitmen.",
    CACHE_KEYS.REKRUITMEN_STATS,
    { pollingInterval: 8000, revalidateOnFocus: true, immediate: true }
  );

  const [activeTab, setActiveTab] = useState<"submissions" | "form">("submissions");
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<RekrutmenFormWithFields | null>(null);
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});
  const [openActionFormId, setOpenActionFormId] = useState<string | null>(null);
  const [qrModalData, setQrModalData] = useState<{ title: string; url: string; filename: string } | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setOpenActionFormId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Safe calculated statistics
  const subsList = useMemo(() => submissions || [], [submissions]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<RekrutmenSubmissionStatus | "">("");

  const statsCalculated = useMemo(() => {
    return {
      total: stats?.total ?? subsList.length,
      menunggu: stats?.menunggu ?? subsList.filter((s) => s.status === "menunggu").length,
      lolos: stats?.lolos ?? subsList.filter((s) => s.status === "lolos").length,
      cadangan: stats?.cadangan ?? subsList.filter((s) => s.status === "cadangan").length,
      tidakLolos: stats?.tidakLolos ?? subsList.filter((s) => s.status === "tidak_lolos").length,
    };
  }, [stats, subsList]);

  const handleCardStatusClick = (st: RekrutmenSubmissionStatus | "") => {
    setSelectedStatusFilter(st);
    setActiveTab("submissions");
  };

  const handleCopyLink = (targetFormId: string) => {
    const fullUrl = `${window.location.origin}/rekrutmen/form/${targetFormId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkMap((prev) => ({ ...prev, [targetFormId]: true }));
    toastSuccess("Tautan formulir pendaftaran berhasil disalin!");
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [targetFormId]: false }));
    }, 2500);
  };

  const handleToggleFormStatus = async (targetForm: RekrutmenFormWithFields) => {
    const newStatus = targetForm.status === "dibuka" ? "ditutup" : "dibuka";
    const res = await updateRekrutmenFormItem(targetForm.id, {
      title: targetForm.title,
      description: targetForm.description,
      status: newStatus,
    });
    if (res.success) {
      toastSuccess(
        newStatus === "dibuka"
          ? "Formulir pendaftaran AKTIF (Link publik dibuka & bisa diakses calon anggota)."
          : "Formulir pendaftaran NONAKTIF (Link publik ditutup & tidak bisa diakses)."
      );
      void refreshForm(true);
    } else {
      toastError(res.message || "Gagal mengubah status formulir.");
    }
  };

  const handleDeleteForm = async (targetId: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus formulir "${title}" beserta data pertanyaannya?`)) return;
    const res = await deleteRekrutmenFormItem(targetId);
    if (res.success) {
      toastSuccess("Formulir pendaftaran berhasil dihapus.");
      void refreshForm(true);
    } else {
      toastError(res.message || "Gagal menghapus formulir.");
    }
  };

  const handleSaveFormModal = async (formData: {
    id?: string;
    title: string;
    description: string;
    status: "dibuka" | "ditutup";
    fields: RekrutmenField[];
  }): Promise<boolean> => {
    const targetId = formData.id || form?.id || "";

    if (!targetId) {
      // Create new form
      const res = await addRekrutmenFormItem({
        title: formData.title,
        description: formData.description,
        status: formData.status,
      });
      if (!res.success || !res.data) {
        toastError(res.message || "Gagal membuat formulir.");
        return false;
      }
      const newFormId = res.data.id;
      // Add initial fields
      for (let i = 0; i < formData.fields.length; i++) {
        const f = formData.fields[i];
        await addRekrutmenFieldItem({
          formId: newFormId,
          label: f.label,
          description: f.description || "",
          fieldType: f.fieldType,
          placeholder: f.placeholder || "",
          required: Boolean(f.required),
          options: f.options || [],
          sortOrder: i,
          exampleImageUrl: f.exampleImageUrl || "",
          exampleImageTitle: f.exampleImageTitle || "",
        });
      }
      toastSuccess("Formulir pendaftaran baru berhasil dibuat!");
      void refreshForm(true);
      return true;
    }

    // Update existing form info
    const updateRes = await updateRekrutmenFormItem(targetId, {
      title: formData.title,
      description: formData.description,
      status: formData.status,
    });
    if (!updateRes.success) {
      toastError(updateRes.message || "Gagal menyimpan data formulir.");
      return false;
    }

    // Synchronize fields: delete old fields and recreate with new configuration
    const currentFields = form?.fields || [];
    for (const cur of currentFields) {
      await deleteRekrutmenFieldItem(cur.id);
    }
    for (let i = 0; i < formData.fields.length; i++) {
      const f = formData.fields[i];
      await addRekrutmenFieldItem({
        formId: targetId,
        label: f.label,
        description: f.description || "",
        fieldType: f.fieldType,
        placeholder: f.placeholder || "",
        required: Boolean(f.required),
        options: f.options || [],
        sortOrder: i,
        exampleImageUrl: f.exampleImageUrl || "",
        exampleImageTitle: f.exampleImageTitle || "",
      });
    }

    toastSuccess("Formulir pendaftaran dan pertanyaan berhasil diperbarui!");
    void refreshForm(true);
    return true;
  };

  const handleSubmissionUpdate = async (
    id: string,
    status: RekrutmenSubmissionStatus,
    note: string
  ): Promise<boolean> => {
    const result = await updateRekrutmenSubmissionItem(id, { status, adminNote: note });
    if (result.success) {
      void refreshSubs(true);
      void refreshStats(true);
      return true;
    }
    toastError(result.message || "Gagal memperbarui status pendaftar.");
    return false;
  };

  const handleSubmissionDelete = async (id: string): Promise<boolean> => {
    const result = await deleteRekrutmenSubmissionItem(id);
    if (result.success) {
      void refreshSubs(true);
      void refreshStats(true);
      return true;
    }
    toastError(result.message || "Gagal menghapus data pendaftar.");
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Header Ringkasan Merah Standout mbc sistem */}
      <div className="summary-panel animate-fade-slide-up">
        <div className="summary-panel-header">
          <div>
            <h3>Ringkasan Rekruitmen</h3>
            <p>Pilih status pada kartu di bawah untuk menyaring data pendaftar secara cepat</p>
          </div>
          {statsCalculated.menunggu > 0 && (
            <div
              style={{
                padding: "6px 14px",
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(8px)",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🟡</span>
              <span>{statsCalculated.menunggu} Pendaftar Belum Direview</span>
            </div>
          )}
        </div>

        {/* 5 Stat Cards Grid - Clickable for Fast Filtering */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          {/* Card 1: Total */}
          <div
            onClick={() => handleCardStatusClick("")}
            className={`rekrutmen-stat-card ${activeTab === "submissions" && selectedStatusFilter === "" ? "active" : ""}`}
            title="Klik untuk melihat semua calon pendaftar"
          >
            <div className="rekrutmen-stat-head">
              <Users size={15} /> Total Pendaftar
            </div>
            <div className="rekrutmen-stat-value">
              {statsCalculated.total}
            </div>
            <span className="rekrutmen-stat-sub">Semua pendaftar ↗</span>
          </div>

          {/* Card 2: Menunggu */}
          <div
            onClick={() => handleCardStatusClick("menunggu")}
            className={`rekrutmen-stat-card ${activeTab === "submissions" && selectedStatusFilter === "menunggu" ? "active" : ""}`}
            title="Klik untuk menyaring pendaftar yang menunggu review"
          >
            <div className="rekrutmen-stat-head">
              <Clock size={15} /> Menunggu Seleksi
            </div>
            <div className="rekrutmen-stat-value">
              {statsCalculated.menunggu}
            </div>
            <span className="rekrutmen-stat-sub">
              {statsCalculated.menunggu > 0 ? "🟡 Belum direview ↗" : "Semua telah direview ↗"}
            </span>
          </div>

          {/* Card 3: Lolos */}
          <div
            onClick={() => handleCardStatusClick("lolos")}
            className={`rekrutmen-stat-card ${activeTab === "submissions" && selectedStatusFilter === "lolos" ? "active" : ""}`}
            title="Klik untuk menyaring calon yang lolos seleksi"
          >
            <div className="rekrutmen-stat-head">
              <CheckCircle2 size={15} /> Lolos Seleksi
            </div>
            <div className="rekrutmen-stat-value">
              {statsCalculated.lolos}
            </div>
            <span className="rekrutmen-stat-sub">🟢 Diterima ↗</span>
          </div>

          {/* Card 4: Cadangan */}
          <div
            onClick={() => handleCardStatusClick("cadangan")}
            className={`rekrutmen-stat-card ${activeTab === "submissions" && selectedStatusFilter === "cadangan" ? "active" : ""}`}
            title="Klik untuk menyaring calon cadangan"
          >
            <div className="rekrutmen-stat-head">
              <Bookmark size={15} /> Cadangan
            </div>
            <div className="rekrutmen-stat-value">
              {statsCalculated.cadangan}
            </div>
            <span className="rekrutmen-stat-sub">🔵 Waiting list ↗</span>
          </div>

          {/* Card 5: Tidak Lolos */}
          <div
            onClick={() => handleCardStatusClick("tidak_lolos")}
            className={`rekrutmen-stat-card ${activeTab === "submissions" && selectedStatusFilter === "tidak_lolos" ? "active" : ""}`}
            title="Klik untuk menyaring calon yang belum lolos"
          >
            <div className="rekrutmen-stat-head">
              <XCircle size={15} /> Gagal
            </div>
            <div className="rekrutmen-stat-value">
              {statsCalculated.tidakLolos}
            </div>
            <span className="rekrutmen-stat-sub">🔴 Belum memenuhi ↗</span>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS (DAFTAR CALON ANGGOTA vs FORMULIR PENDAFTARAN) & ACTION */}
      <div className="page-tab-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
        <div className="page-segmented-tabs">
          <button
            type="button"
            className="page-tab-btn"
            onClick={() => setActiveTab("submissions")}
            style={{
              fontWeight: activeTab === "submissions" ? 700 : 500,
              background: activeTab === "submissions" ? "#ffffff" : "transparent",
              color: activeTab === "submissions" ? "var(--primary-700)" : "var(--text-secondary)",
              boxShadow: activeTab === "submissions" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <Users size={16} />
            <span>Daftar Calon Anggota ({subsList.length})</span>
          </button>

          <button
            type="button"
            className="page-tab-btn"
            onClick={() => setActiveTab("form")}
            style={{
              fontWeight: activeTab === "form" ? 700 : 500,
              background: activeTab === "form" ? "#ffffff" : "transparent",
              color: activeTab === "form" ? "var(--primary-700)" : "var(--text-secondary)",
              boxShadow: activeTab === "form" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
            }}
          >
            <FileText size={16} />
            <span>Formulir Pendaftaran ({form ? 1 : 0})</span>
          </button>
        </div>

        <div className="page-tab-actions">
          {form && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                setQrModalData({
                  title: form.title,
                  url: `${window.location.origin}/rekrutmen/form/${form.id}`,
                  filename: `qr-rekrutmen-${form.id}.png`,
                })
              }
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Tampilkan QR Code formulir pendaftaran"
            >
              <QrCode size={16} /> QR Code Pendaftaran
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingForm(null);
              setIsBuilderOpen(true);
            }}
          >
            <Plus size={17} /> Tambah Formulir Pendaftaran
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: DAFTAR CALON ANGGOTA */}
      {activeTab === "submissions" && (
        <>
          {form ? (
            <SubmissionList
              form={form}
              submissions={subsList}
              loading={loadingSubs}
              onRefresh={async () => {
                await refreshSubs();
                await refreshStats();
              }}
              onUpdateStatus={handleSubmissionUpdate}
              onDeleteSubmission={handleSubmissionDelete}
              initialStatusFilter={selectedStatusFilter}
              onStatusFilterChange={setSelectedStatusFilter}
            />
          ) : (
            <div
              className="card"
              style={{
                padding: "36px 20px",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "var(--radius-md, 12px)",
              }}
            >
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                Belum ada formulir aktif untuk melihat pendaftar.
              </p>
            </div>
          )}
        </>
      )}

      {/* TAB CONTENT 2: PENGATURAN FORMULIR */}
      {activeTab === "form" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {form ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {(() => {
                const count = subsList.length;
                const isCopied = copiedLinkMap[form.id];

                return (
                  <div
                    key={form.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 16,
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                          {form.title}
                        </h4>
                        <span
                          className={`status-pill ${form.status === "dibuka" ? "status-lolos" : "status-menunggu"}`}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 20,
                          }}
                        >
                          {form.status === "dibuka" ? "Aktif" : "Ditutup"}
                        </span>
                      </div>

                      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        {form.description || "Tidak ada deskripsi."}
                      </p>

                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
                        <span>
                          Pertanyaan: <strong>{form.fields?.length || 0} butir</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Tanggapan: <strong>{count} calon anggota</strong>
                        </span>
                      </div>
                    </div>

                    {/* Public Link Preview Box */}
                    <div className="form-link-box">
                      <span className="form-link-url">
                        {`${window.location.origin}/rekrutmen/form/${form.id}`}
                      </span>
                      <div className="form-link-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setQrModalData({
                              title: form.title,
                              url: `${window.location.origin}/rekrutmen/form/${form.id}`,
                              filename: `qr-rekrutmen-${form.id}.png`,
                            })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary-700)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Lihat & unduh QR Code formulir"
                        >
                          <QrCode size={13} />
                          <span>QR</span>
                        </button>
                        <span style={{ color: "var(--border)" }}>•</span>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(form.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: isCopied ? "var(--green-600)" : "var(--primary-700)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          <span>{isCopied ? "Disalin!" : "Salin"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="form-card-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="form-card-actions-left">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setEditingForm(form);
                            setIsBuilderOpen(true);
                          }}
                          style={{ borderRadius: 8, padding: "5px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Edit size={13} />
                          <span>Edit Formulir</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            setQrModalData({
                              title: form.title,
                              url: `${window.location.origin}/rekrutmen/form/${form.id}`,
                              filename: `qr-rekrutmen-${form.id}.png`,
                            })
                          }
                          style={{ borderRadius: 8, padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                          title="Lihat & unduh QR Code formulir pendaftaran"
                        >
                          <QrCode size={13} />
                          <span>QR Code</span>
                        </button>
                      </div>

                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionFormId(openActionFormId === form.id ? null : form.id);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 12px",
                            fontSize: 12,
                            borderRadius: "var(--radius-sm, 8px)",
                            background: openActionFormId === form.id ? "var(--primary-700, #b91c1c)" : "var(--primary-600, #dc2626)",
                            border: "none",
                            color: "#ffffff",
                            fontWeight: 600,
                            cursor: "pointer",
                            boxShadow: "0 1px 3px rgba(220, 38, 38, 0.3)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (openActionFormId !== form.id) e.currentTarget.style.background = "var(--primary-700, #b91c1c)";
                          }}
                          onMouseLeave={(e) => {
                            if (openActionFormId !== form.id) e.currentTarget.style.background = "var(--primary-600, #dc2626)";
                          }}
                        >
                          <span>Aksi</span>
                          <ChevronDown
                            size={13}
                            style={{
                              transform: openActionFormId === form.id ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.15s ease",
                            }}
                          />
                        </button>

                        {openActionFormId === form.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              bottom: "calc(100% + 4px)",
                              zIndex: 100,
                              minWidth: "165px",
                              background: "#ffffff",
                              borderRadius: "10px",
                              border: "1px solid var(--border, #e2e8f0)",
                              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.08)",
                              padding: "4px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <Link
                              to={`/rekrutmen/form/${form.id}`}
                              target="_blank"
                              onClick={() => setOpenActionFormId(null)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                                padding: "7px 10px",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "var(--text, #1e293b)",
                                background: "transparent",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                textAlign: "left",
                                textDecoration: "none",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-soft, #f1f5f9)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <ExternalLink size={14} style={{ color: "var(--text-muted)" }} />
                              <span>Preview Formulir</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionFormId(null);
                                void handleToggleFormStatus(form);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                                padding: "7px 10px",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: form.status === "dibuka" ? "var(--text-secondary)" : "#16a34a",
                                background: "transparent",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-soft, #f1f5f9)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <Check size={14} style={{ color: form.status === "dibuka" ? "var(--text-muted)" : "#16a34a" }} />
                              <span>{form.status === "dibuka" ? "Nonaktifkan Formulir" : "Aktifkan Formulir"}</span>
                            </button>

                            <div style={{ height: "1px", background: "var(--border-soft, #f1f5f9)", margin: "2px 0" }} />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionFormId(null);
                                void handleDeleteForm(form.id, form.title);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                                padding: "7px 10px",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "var(--danger, #dc2626)",
                                background: "transparent",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--primary-50, #fef2f2)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <Trash2 size={14} style={{ color: "var(--danger, #dc2626)" }} />
                              <span>Hapus Formulir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div
              className="card"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "var(--radius-md, 12px)",
                border: "1px dashed var(--border, #cbd5e1)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(185, 28, 28, 0.08)",
                  color: "var(--primary-700, #b91c1c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: "var(--navy-900)", lineHeight: 1.4 }}>
                Belum Ada Formulir Pendaftaran
              </h3>
              <p
                style={{
                  margin: "0 0 18px",
                  fontSize: "14px",
                  color: "var(--text-muted)",
                  maxWidth: 440,
                  marginLeft: "auto",
                  marginRight: "auto",
                  lineHeight: 1.5,
                }}
              >
                Buat formulir pendaftaran pertama untuk mulai menerima calon anggota baru mbc sistem.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingForm(null);
                  setIsBuilderOpen(true);
                }}
              >
                <Plus size={16} /> Buat Formulir Baru
              </button>
            </div>
          )}
        </div>
      )}

      {/* FORM BUILDER MODAL */}
      <RekrutmenFormBuilderModal
        key={isBuilderOpen ? (editingForm ? `edit-${editingForm.id}-${editingForm.updatedAt || ""}` : "create-new-form") : "closed"}
        open={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false);
          setEditingForm(null);
        }}
        formToEdit={editingForm}
        onSave={handleSaveFormModal}
      />

      {/* MODAL QR CODE FORMULIR PENDAFTARAN */}
      {qrModalData && (
        <Modal
          open={Boolean(qrModalData)}
          title={`QR Code ${qrModalData.title}`}
          onClose={() => setQrModalData(null)}
          size="sm"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, flexWrap: "wrap" }}>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrModalData.url)}`}
                download={qrModalData.filename}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} /> Unduh Gambar
              </a>
              <button className="btn btn-primary btn-sm" onClick={() => setQrModalData(null)}>
                Selesai
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "12px 0" }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrModalData.url)}`}
              alt={`QR Code ${qrModalData.title}`}
              style={{
                width: 200,
                height: 200,
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--border)",
                padding: 8,
                background: "#ffffff",
                boxShadow: "var(--shadow-sm)",
              }}
            />

            <div
              style={{
                width: "100%",
                background: "var(--bg-soft)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {qrModalData.url}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrModalData.url);
                  toastSuccess("Tautan pendaftaran berhasil disalin!");
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: "2px 8px", flexShrink: 0 }}
              >
                <Copy size={13} /> Salin
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
              Calon anggota dapat memindai QR code ini melalui kamera smartphone untuk langsung membuka formulir pendaftaran.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}