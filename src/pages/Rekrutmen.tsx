import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Bookmark,
  Sparkles,
  Plus,
} from "lucide-react";
import type {
  RekrutmenFormWithFields,
  RekrutmenSubmissionWithAnswers,
  RekrutmenField,
  RekrutmenSubmissionStatus,
  RekrutmenForm,
} from "../types";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  getRekrutmenFormData,
  getRekrutmenSubmissionsData,
  getRekrutmenStatsData,
  addRekrutmenFormItem,
  updateRekrutmenFormItem,
  addRekrutmenFieldItem,
  updateRekrutmenFieldItem,
  deleteRekrutmenFieldItem,
  reorderRekrutmenFieldsItem,
  updateRekrutmenSubmissionItem,
  deleteRekrutmenSubmissionItem,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import { FormBuilder } from "../components/rekrutmen/FormBuilder";
import { SubmissionList } from "../components/rekrutmen/SubmissionList";
import { Modal } from "../components/ui/Modal";

interface FormRekrutmen {
  title: string;
  description: string;
  status: "dibuka" | "ditutup";
}

const FORM_EMPTY: FormRekrutmen = {
  title: "",
  description: "",
  status: "dibuka",
};

export function Rekrutmen() {
  const { success: toastSuccess, error: toastError } = useToast();

  const { data: form, refresh: refreshForm } = useApi<RekrutmenFormWithFields | null>(
    getRekrutmenFormData,
    "Gagal mengambil data formulir.",
    CACHE_KEYS.REKRUITMEN_FORM
  );

  const formId = form?.id || "";
  const fetchSubmissions = useCallback(() => getRekrutmenSubmissionsData(formId), [formId]);
  const fetchStats = useCallback(() => getRekrutmenStatsData(formId), [formId]);

  const { data: submissions, loading: loadingSubs, refresh: refreshSubs } = useApi<
    RekrutmenSubmissionWithAnswers[]
  >(
    fetchSubmissions,
    "Gagal mengambil data pendaftar.",
    CACHE_KEYS.REKRUITMEN_SUBMISSIONS
  );

  const { data: stats, refresh: refreshStats } = useApi(
    fetchStats,
    "Gagal mengambil statistik rekruitmen.",
    CACHE_KEYS.REKRUITMEN_STATS
  );

  const [activeTab, setActiveTab] = useState<"submissions" | "form">("submissions");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [formData, setFormData] = useState<FormRekrutmen>(FORM_EMPTY);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savingForm, setSavingForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (form) {
      setFormData({
        title: form.title,
        description: form.description,
        status: form.status,
      });
    }
  }, [form]);

  const openAddForm = () => {
    setFormData({
      title: "Pendaftaran Anggota Baru MB Chondro " + new Date().getFullYear(),
      description:
        "Silakan isi seluruh data dengan benar dan lengkap. Data yang dikirim akan digunakan untuk proses seleksi calon anggota MB Chondro.",
      status: "dibuka",
    });
    setFormErrors({});
    setModalMode("add");
  };

  const validateForm = (f: FormRekrutmen): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!f.title.trim()) err.title = "Nama / Judul formulir wajib diisi.";
    return err;
  };

  const handleFormSave = async (override?: Partial<RekrutmenForm>): Promise<boolean> => {
    const dataToSave = {
      title: override?.title ?? formData.title,
      description: override?.description ?? formData.description,
      status: override?.status ?? formData.status,
    };

    const err = validateForm(dataToSave);
    setFormErrors(err);
    if (Object.keys(err).length > 0) return false;

    const formId = form?.id ?? "";
    setSavingForm(true);
    let ok: boolean;

    if (formId && !modalMode) {
      const result = await updateRekrutmenFormItem(formId, dataToSave);
      ok = result.success;
      if (!ok) toastError(result.message || "Gagal menyimpan formulir.");
    } else if (modalMode === "add" || !formId) {
      const result = await addRekrutmenFormItem(dataToSave);
      ok = result.success;
      if (!ok) toastError(result.message || "Gagal membuat formulir.");
    } else {
      const result = await updateRekrutmenFormItem(formId, dataToSave);
      ok = result.success;
      if (!ok) toastError(result.message || "Gagal menyimpan formulir.");
    }

    setSavingForm(false);
    if (ok) {
      if (override?.status) {
        toastSuccess(
          override.status === "dibuka"
            ? "Formulir pendaftaran AKTIF (Link publik dibuka & bisa diakses calon anggota)."
            : "Formulir pendaftaran NONAKTIF (Link publik ditutup & tidak bisa diakses)."
        );
      } else {
        toastSuccess("Formulir pendaftaran berhasil disimpan.");
      }
      setModalMode(null);
      void refreshForm(true);
      void refreshSubs(true);
      void refreshStats(true);
    }
    return ok;
  };

  const handleFieldAdd = async (
    field: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">
  ): Promise<boolean> => {
    if (!form) return false;
    const res = await addRekrutmenFieldItem({ ...field, formId: form.id });
    if (res.success) {
      toastSuccess("Pertanyaan berhasil ditambahkan.");
      void refreshForm(true);
      return true;
    }
    toastError(res.message || "Gagal menambahkan pertanyaan.");
    return false;
  };

  const handleFieldUpdate = async (
    id: string,
    field: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">
  ): Promise<boolean> => {
    const res = await updateRekrutmenFieldItem(id, field);
    if (res.success) {
      toastSuccess("Pertanyaan berhasil diperbarui.");
      void refreshForm(true);
      return true;
    }
    toastError(res.message || "Gagal memperbarui pertanyaan.");
    return false;
  };

  const handleFieldDelete = async (id: string): Promise<boolean> => {
    const res = await deleteRekrutmenFieldItem(id);
    if (res.success) {
      toastSuccess("Pertanyaan berhasil dihapus.");
      void refreshForm(true);
      return true;
    }
    toastError(res.message || "Gagal menghapus pertanyaan.");
    return false;
  };

  const handleReorder = async (
    fieldOrders: { id: string; sortOrder: number }[]
  ): Promise<boolean> => {
    if (!form) return false;
    const result = await reorderRekrutmenFieldsItem(form.id, fieldOrders);
    if (result.success) {
      void refreshForm(true);
      return true;
    }
    toastError(result.message || "Gagal mengubah urutan pertanyaan.");
    return false;
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

  const publicFormUrl = form?.id ? `${window.location.origin}/rekrutmen/form/${form.id}` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Header Ringkasan Merah Standout MB Chondro */}
      <div
        style={{
          background: "linear-gradient(135deg, #c8101e 0%, #a41111 50%, #8a1414 100%)",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "16px 20px",
          color: "#ffffff",
          boxShadow: "0 6px 20px rgba(185, 28, 28, 0.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                opacity: 0.88,
              }}
            >
              CHONDRO WONOPRINGGO · PENERIMAAN ANGGOTA BARU
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "2px 0 0", color: "#ffffff" }}>
              Ringkasan Rekruitmen
            </h2>
          </div>
          {form && (
            <div
              style={{
                padding: "6px 14px",
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(8px)",
                borderRadius: "20px",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              Formulir: {form.status === "dibuka" ? "🟢 Aktif (Menerima Pendaftar)" : "🔴 Ditutup"}
            </div>
          )}
        </div>

        {/* 4/5 Stat Cards Grid - Clickable for Fast Filtering */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
            gap: 12,
          }}
        >
          {/* Card 1: Total */}
          <div
            onClick={() => handleCardStatusClick("")}
            style={{
              background: activeTab === "submissions" && selectedStatusFilter === "" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-sm, 10px)",
              padding: "14px 16px",
              border: activeTab === "submissions" && selectedStatusFilter === "" ? "1.5px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.18)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Klik untuk melihat semua pendaftar"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9, fontSize: "12px" }}>
              <Users size={14} /> Total Pendaftar
            </div>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.65rem)", fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
              {statsCalculated.total}
            </div>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>Lihat semua pendaftar ↗</span>
          </div>

          {/* Card 2: Menunggu */}
          <div
            onClick={() => handleCardStatusClick("menunggu")}
            style={{
              background: activeTab === "submissions" && selectedStatusFilter === "menunggu" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-sm, 10px)",
              padding: "14px 16px",
              border: activeTab === "submissions" && selectedStatusFilter === "menunggu" ? "1.5px solid #fde68a" : "1px solid rgba(255, 255, 255, 0.18)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Klik untuk menyaring pendaftar yang menunggu review"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9, fontSize: "12px" }}>
              <Clock size={14} /> Menunggu Seleksi
            </div>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.65rem)", fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
              {statsCalculated.menunggu}
            </div>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>🟡 Belum direview ↗</span>
          </div>

          {/* Card 3: Lolos */}
          <div
            onClick={() => handleCardStatusClick("lolos")}
            style={{
              background: activeTab === "submissions" && selectedStatusFilter === "lolos" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-sm, 10px)",
              padding: "14px 16px",
              border: activeTab === "submissions" && selectedStatusFilter === "lolos" ? "1.5px solid #a7f3d0" : "1px solid rgba(255, 255, 255, 0.18)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Klik untuk menyaring calon yang lolos seleksi"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9, fontSize: "12px" }}>
              <CheckCircle2 size={14} /> Lolos Seleksi
            </div>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.65rem)", fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
              {statsCalculated.lolos}
            </div>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>🟢 Diterima (Training 3x) ↗</span>
          </div>

          {/* Card 4: Cadangan (if any) */}
          <div
            onClick={() => handleCardStatusClick("cadangan")}
            style={{
              background: activeTab === "submissions" && selectedStatusFilter === "cadangan" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-sm, 10px)",
              padding: "14px 16px",
              border: activeTab === "submissions" && selectedStatusFilter === "cadangan" ? "1.5px solid #bfdbfe" : "1px solid rgba(255, 255, 255, 0.18)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Klik untuk menyaring calon cadangan"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9, fontSize: "12px" }}>
              <Bookmark size={14} /> Cadangan
            </div>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.65rem)", fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
              {statsCalculated.cadangan}
            </div>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>🔵 Waiting list ↗</span>
          </div>

          {/* Card 5: Tidak Lolos */}
          <div
            onClick={() => handleCardStatusClick("tidak_lolos")}
            style={{
              background: activeTab === "submissions" && selectedStatusFilter === "tidak_lolos" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(8px)",
              borderRadius: "var(--radius-sm, 10px)",
              padding: "14px 16px",
              border: activeTab === "submissions" && selectedStatusFilter === "tidak_lolos" ? "1.5px solid #fecaca" : "1px solid rgba(255, 255, 255, 0.18)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Klik untuk menyaring calon yang gagal / tidak lolos"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.9, fontSize: "12px" }}>
              <XCircle size={14} /> Gagal / Tidak Lolos
            </div>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.65rem)", fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
              {statsCalculated.tidakLolos}
            </div>
            <span style={{ fontSize: "11px", opacity: 0.8 }}>🔴 Belum memenuhi ↗</span>
          </div>
        </div>
      </div>

      {/* 2. Quick Public Form Link Bar & Tab Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Segmented Tab Switcher */}
        <div
          className="segment-group"
          style={{
            display: "flex",
            gap: 6,
            background: "#f1f5f9",
            padding: 4,
            borderRadius: "var(--radius-sm, 10px)",
            border: "1px solid var(--border, #e2e8f0)",
            width: "100%",
            maxWidth: "460px",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            className={`segment-btn ${activeTab === "submissions" ? "active" : ""}`}
            onClick={() => setActiveTab("submissions")}
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: "var(--radius-xs, 7px)",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "submissions" ? "#ffffff" : "transparent",
              color: activeTab === "submissions" ? "var(--primary-700, #b91c1c)" : "#64748b",
              boxShadow: activeTab === "submissions" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            👥 Daftar Pendaftar ({subsList.length})
          </button>
          <button
            type="button"
            className={`segment-btn ${activeTab === "form" ? "active" : ""}`}
            onClick={() => setActiveTab("form")}
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: "var(--radius-xs, 7px)",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "form" ? "#ffffff" : "transparent",
              color: activeTab === "form" ? "var(--primary-700, #b91c1c)" : "#64748b",
              boxShadow: activeTab === "form" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            📝 Pengaturan Formulir
          </button>
        </div>

        {/* Quick Link Share Box */}
        {form && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#ffffff",
              padding: "6px 10px 6px 14px",
              borderRadius: "var(--radius-sm, 10px)",
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
              Link Publik Calon:
            </span>
            <code
              style={{
                fontSize: "12px",
                color: "var(--navy-900)",
                background: "#f8fafc",
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                maxWidth: "220px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={publicFormUrl}
            >
              /rekrutmen/form/{form.id}
            </code>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(publicFormUrl);
                setCopiedLink(true);
                toastSuccess("Link formulir berhasil disalin!");
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              style={{ fontSize: "12px", padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              {copiedLink ? "✓ Tersalin" : "Salin Link"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => window.open(publicFormUrl, "_blank")}
              title="Buka Formulir Publik di Tab Baru"
              style={{ fontSize: "12px", padding: "4px 8px", color: "var(--primary-700, #b91c1c)" }}
            >
              Buka Form ↗
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: DAFTAR PENDAFTAR & SELEKSI */}
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

      {/* TAB 2: FORMULIR PENDAFTARAN BUILDER */}
      {activeTab === "form" && (
        <>
          {form ? (
            <FormBuilder
              form={form}
              fields={form.fields}
              onSaveForm={handleFormSave}
              onAddField={handleFieldAdd}
              onUpdateField={handleFieldUpdate}
              onDeleteField={handleFieldDelete}
              onReorderFields={handleReorder}
              onPreview={() => {
                window.open(`${window.location.origin}/rekrutmen/form/${form.id}`, "_blank");
              }}
              onCopyLink={() => {
                navigator.clipboard.writeText(publicFormUrl);
                toastSuccess("Link formulir berhasil disalin ke clipboard!");
              }}
            />
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
              <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 700, color: "var(--navy-900)" }}>
                Belum Ada Formulir Pendaftaran
              </h3>
              <p
                style={{
                  margin: "0 0 18px",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  maxWidth: 440,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Buat formulir pendaftaran pertama untuk mulai menerima calon anggota baru MB Chondro.
              </p>
              <button className="btn btn-primary" onClick={openAddForm}>
                <Plus size={16} /> Buat Formulir Baru
              </button>
            </div>
          )}
        </>
      )}

      {/* MODAL BUAT / EDIT FORMULIR UTAMA */}
      <Modal
        open={modalMode !== null}
        title={modalMode === "edit" ? "Edit Informasi Formulir" : "Buat Formulir Rekruitmen Baru"}
        onClose={() => setModalMode(null)}
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalMode(null)} disabled={savingForm}>
              Batal
            </button>
            <button className="btn btn-primary" onClick={() => handleFormSave()} disabled={savingForm}>
              {savingForm ? "Menyimpan..." : modalMode === "edit" ? "Simpan Perubahan" : "Buat Formulir"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group" style={{ gap: 4 }}>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Nama / Judul Formulir *</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              placeholder="Contoh: Formulir Pendaftaran Anggota Baru MB Chondro 2026"
              style={{ height: 40, padding: "8px 12px", fontSize: "13.5px" }}
            />
            {formErrors.title && (
              <span style={{ fontSize: "12px", color: "#dc2626" }}>{formErrors.title}</span>
            )}
          </div>

          <div className="form-group" style={{ gap: 4 }}>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Deskripsi / Petunjuk Pengisian</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Silakan isi seluruh data dengan benar dan lengkap untuk proses seleksi calon anggota MB Chondro."
              rows={3}
              style={{ padding: "8px 12px", fontSize: "13px", resize: "vertical" }}
            />
          </div>

          <div className="form-group" style={{ gap: 4 }}>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>Status Formulir Awal</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as "dibuka" | "ditutup" }))}
              style={{ height: 40, padding: "8px 12px", fontSize: "13.5px" }}
            >
              <option value="dibuka">🟢 Langsung Aktif (Dibuka untuk umum)</option>
              <option value="ditutup">🔴 Simpan sebagai Draft (Ditutup sementara)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}