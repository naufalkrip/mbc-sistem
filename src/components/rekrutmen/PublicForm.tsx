import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  Eye,
  FileText,
  ArrowLeft,
  Send,
  Loader2,
  RefreshCw,
  Lock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
} from "lucide-react";
import type { RekrutmenFormWithFields, RekrutmenField } from "../../types";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../contexts/ToastContext";
import { getRekrutmenFormData, addRekrutmenSubmissionItem, compressImageToSafeHd, fileToBase64 } from "../../services/api";
import { CACHE_KEYS } from "../../services/cache";
import logo from "../../aset/logo.png";
import { formatDirectImageUrl } from "../../utils/format";

interface FormAnswer {
  fieldId: string;
  value: string;
  file: File | null;
  fileBase64?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export function PublicForm() {
  const { error: toastError } = useToast();

  const { data: form, loading, error, refresh } = useApi<RekrutmenFormWithFields | null>(
    () => getRekrutmenFormData(),
    "Gagal memuat formulir pendaftaran.",
    CACHE_KEYS.REKRUITMEN_FORM,
    { pollingInterval: 0, revalidateOnFocus: false }
  );

  const [answers, setAnswers] = useState<FormAnswer[]>(() => {
    try {
      const saved = localStorage.getItem("rekrutmen_draft_answers");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeSampleImage, setActiveSampleImage] = useState<{ url: string; title: string } | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [lightboxError, setLightboxError] = useState(false);

  const openLightbox = (url: string, title: string) => {
    setActiveSampleImage({ url, title });
    setImageZoom(1);
    setLightboxLoading(false);
    setLightboxError(false);
  };

  const sortedFields = useMemo(() => {
    if (!form?.fields) return [];
    return [...form.fields].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [form]);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveSampleImage(null);
        setImageZoom(1);
      }
    };
    if (activeSampleImage) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeSampleImage]);

  // Sinkronisasi pertanyaan dengan state jawaban tanpa menghapus teks yang sedang diisi
  useEffect(() => {
    if (sortedFields.length > 0) {
      setAnswers((prev) => {
        let savedDraft: FormAnswer[] = [];
        try {
          const raw = localStorage.getItem("rekrutmen_draft_answers");
          if (raw) savedDraft = JSON.parse(raw);
        } catch {}

        return sortedFields.map((f) => {
          const existing = prev.find((a) => a.fieldId === f.id);
          if (existing && (existing.value || existing.file || existing.fileBase64)) {
            return existing;
          }
          const draft = savedDraft.find((a) => a.fieldId === f.id);
          if (draft && (draft.value || draft.fileBase64)) {
            return {
              ...draft,
              file: null,
            };
          }
          return (
            existing || {
              fieldId: f.id,
              value: "",
              file: null,
            }
          );
        });
      });
    }
  }, [sortedFields]);

  // Simpan draft teks ke localStorage secara otomatis agar tidak pernah hilang
  useEffect(() => {
    if (answers.length > 0) {
      try {
        const serializable = answers.map((a) => ({
          fieldId: a.fieldId,
          value: a.value,
          file: null,
          fileName: a.fileName,
          fileSize: a.fileSize,
          fileType: a.fileType,
          fileBase64: a.fileBase64,
        }));
        localStorage.setItem("rekrutmen_draft_answers", JSON.stringify(serializable));
      } catch {}
    }
  }, [answers]);

  const handleChange = (fieldId: string, value: string) => {
    setAnswers((prev) =>
      prev.map((a) => (a.fieldId === fieldId ? { ...a, value } : a))
    );
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleCheckboxChange = (fieldId: string, optionValue: string, checked: boolean) => {
    setAnswers((prev) =>
      prev.map((a) => {
        if (a.fieldId !== fieldId) return a;
        const currentVals = a.value ? a.value.split(",").filter(Boolean) : [];
        let nextVals: string[];
        if (checked) {
          nextVals = Array.from(new Set([...currentVals, optionValue]));
        } else {
          nextVals = currentVals.filter((v) => v !== optionValue);
        }
        return { ...a, value: nextVals.join(",") };
      })
    );
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleFileSelect = async (field: RekrutmenField, file: File | null) => {
    if (!file) return;

    const maxLimitMb = field.maxFileSize || (field.fieldType === "image" ? 2 : 5);
    const maxLimitBytes = maxLimitMb * 1024 * 1024;

    // Validate size
    if (file.size > maxLimitBytes) {
      const msg =
        field.fieldType === "image"
          ? `Ukuran foto terlalu besar. Maksimal ukuran file adalah ${maxLimitMb} MB.`
          : `Ukuran file terlalu besar. Maksimal ukuran file adalah ${maxLimitMb} MB.`;
      toastError(msg);
      setErrors((prev) => ({ ...prev, [field.id]: msg }));
      return;
    }

    // Validate format
    if (field.fieldType === "image") {
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        const msg = "Format foto tidak didukung. Harap unggah foto dengan format JPG, JPEG, PNG, atau WEBP.";
        toastError(msg);
        setErrors((prev) => ({ ...prev, [field.id]: msg }));
        return;
      }
    } else if (field.fieldType === "file") {
      const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
      if (!validTypes.includes(file.type)) {
        const msg = "Format dokumen tidak didukung. Harap unggah file PDF, JPG, atau PNG.";
        toastError(msg);
        setErrors((prev) => ({ ...prev, [field.id]: msg }));
        return;
      }
    }

    // Clear error
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field.id];
      return next;
    });

    if (field.fieldType === "image" || file.type.startsWith("image/")) {
      try {
        const finalBase64 = await compressImageToSafeHd(file);
        setAnswers((prev) =>
          prev.map((a) =>
            a.fieldId === field.id
              ? {
                  ...a,
                  file,
                  value: file.name,
                  fileBase64: finalBase64,
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                }
              : a
          )
        );
      } catch {
        const rawBase64 = await fileToBase64(file);
        setAnswers((prev) =>
          prev.map((a) =>
            a.fieldId === field.id
              ? {
                  ...a,
                  file,
                  value: file.name,
                  fileBase64: rawBase64,
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                }
              : a
          )
        );
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rawBase64 = ev.target?.result as string;
        setAnswers((prev) =>
          prev.map((a) =>
            a.fieldId === field.id
              ? {
                  ...a,
                  file,
                  value: file.name,
                  fileBase64: rawBase64,
                  fileName: file.name,
                  fileSize: file.size,
                  fileType: file.type,
                }
              : a
          )
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (fieldId: string) => {
    setAnswers((prev) =>
      prev.map((a) =>
        a.fieldId === fieldId
          ? {
              ...a,
              file: null,
              value: "",
              fileBase64: undefined,
              fileName: undefined,
              fileSize: undefined,
              fileType: undefined,
            }
          : a
      )
    );
  };

  const validateAll = (): boolean => {
    const err: Record<string, string> = {};

    sortedFields.forEach((field) => {
      const ans = answers.find((a) => a.fieldId === field.id);
      if (field.required) {
        if (field.fieldType === "image" || field.fieldType === "file") {
          if (!ans?.file && !ans?.value) {
            err[field.id] = `${field.label} wajib diunggah.`;
          }
        } else if (field.fieldType === "checkbox") {
          if (!ans?.value || ans.value.split(",").filter(Boolean).length === 0) {
            err[field.id] = `${field.label} wajib dipilih minimal satu.`;
          }
        } else if (!ans?.value?.trim()) {
          err[field.id] = `${field.label} wajib diisi.`;
        }
      }
    });

    setErrors(err);
    if (Object.keys(err).length > 0) {
      toastError("Mohon lengkapi seluruh pertanyaan wajib yang ditandai merah.");
      // Scroll to first error
      const firstErrorKey = Object.keys(err)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
    return true;
  };

  const handleGoToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    setIsPreviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitFinal = async () => {
    if (!form || !validateAll()) return;

    setSubmitting(true);
    try {
      const payloadAnswers = await Promise.all(
        answers.map(async (a) => {
          let b64 = a.fileBase64 || null;
          if (a.file && !b64) {
            try {
              b64 = await compressImageToSafeHd(a.file);
            } catch {
              b64 = await fileToBase64(a.file);
            }
          }
          return {
            fieldId: a.fieldId,
            value: a.value || a.fileName || (a.file ? a.file.name : ""),
            fileUrl: b64,
            fileName: a.fileName || (a.file ? a.file.name : null),
            fileType: a.fileType || (a.file ? a.file.type : null),
            fileSize: a.fileSize || (a.file ? a.file.size : null),
          };
        })
      );

      const res = await addRekrutmenSubmissionItem({
        formId: form.id,
        status: "menunggu",
        adminNote: "",
        answers: payloadAnswers,
      });

      setSubmitting(false);
      if (res.success) {
        try {
          localStorage.removeItem("rekrutmen_draft_answers");
        } catch {}
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toastError(res.message || "Gagal mengirim formulir. Silakan coba kembali.");
      }
    } catch {
      setSubmitting(false);
      toastError("Terjadi kendala jaringan saat mengirimkan formulir. Coba lagi.");
    }
  };

  // LOADING STATE
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 20,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <img src={logo} alt="Logo" style={{ height: 60, width: "auto", objectFit: "contain", marginBottom: 16 }} />
          <Loader2
            size={32}
            className="spinning"
            style={{ color: "var(--primary-700, #b91c1c)", margin: "0 auto 12px" }}
          />
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--navy-900)" }}>
            Memuat Formulir Pendaftaran...
          </h3>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (error || !form) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: "100%",
            background: "#ffffff",
            borderRadius: 14,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          <img src={logo} alt="Logo" style={{ height: 60, width: "auto", objectFit: "contain", marginBottom: 16 }} />
          <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--navy-900)", marginBottom: 8 }}>
            Formulir Tidak Ditemukan
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", marginBottom: 20 }}>
            Formulir pendaftaran belum tersedia atau link yang Anda buka tidak valid.
          </p>
          <button className="btn btn-primary" onClick={() => refresh()}>
            <RefreshCw size={16} /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // FORM STATUS CLOSED STATE
  if (form.status === "ditutup" && !submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#ffffff",
            borderRadius: 14,
            padding: "36px 28px",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          <img src={logo} alt="Logo" style={{ height: 60, width: "auto", objectFit: "contain", marginBottom: 16 }} />
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(220, 38, 38, 0.1)",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--navy-900)", marginBottom: 8 }}>
            Formulir Pendaftaran Tidak Aktif
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
            Terima kasih atas antusiasme Anda. Saat ini formulir pendaftaran <strong>{form.title}</strong> sedang <strong>dinonaktifkan / ditutup</strong> sehingga tidak menerima pendaftaran baru.
          </p>
          <div
            style={{
              padding: "14px",
              background: "#fef2f2",
              borderRadius: 8,
              border: "1px solid #fee2e2",
              fontSize: "12.5px",
              color: "#991b1b",
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            Silakan hubungi admin mbc sistem atau pantau pengumuman resmi terkait jadwal pembukaan pendaftaran.
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refresh()}
            style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}
          >
            <RefreshCw size={15} /> Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  // SUCCESS SUBMITTED STATE
  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 20,
        }}
      >
        <div
          className="public-form-success-card"
          style={{
            maxWidth: 520,
            width: "100%",
            background: "#ffffff",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          <img src={logo} alt="Logo mbc sistem" style={{ height: 64, width: "auto", objectFit: "contain", marginBottom: 16 }} />
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.12)",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircle2 size={34} />
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--navy-900)", marginBottom: 10 }}>
            Pendaftaran Berhasil Dikirim!
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
            Terima kasih telah mendaftar sebagai calon anggota <strong>mbc sistem</strong>. Data formulir dan berkas Anda telah berhasil kami terima dan akan segera diproses dalam tahapan seleksi.
          </p>
          <div
            style={{
              padding: "16px",
              background: "#f0fdf4",
              borderRadius: 10,
              border: "1px solid #bbf7d0",
              textAlign: "left",
              fontSize: "13px",
              color: "#166534",
              marginBottom: 24,
            }}
          >
            <strong>💡 Tahapan Selanjutnya:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Tim mbc sistem akan melakukan verifikasi berkas dan data pendaftaran.</li>
              <li>Pengumuman kelolosan seleksi akan disampaikan melalui WhatsApp atau kontak yang Anda cantumkan.</li>
            </ul>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              try {
                localStorage.removeItem("rekrutmen_draft_answers");
              } catch {}
              setSubmitted(false);
              setIsPreviewing(false);
              setAnswers(sortedFields.map((f) => ({ fieldId: f.id, value: "", file: null })));
            }}
            style={{ fontSize: "13px" }}
          >
            Kirim Tanggapan Lain
          </button>
        </div>
        <footer style={{ marginTop: 24, fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          © mbc sistem · Sistem Manajemen Penerimaan Anggota
        </footer>
      </div>
    );
  }

  // MAIN FORM (INPUT STEP & PREVIEW STEP)
  return (
    <div className="public-form-outer">
      <div className="public-form-container">
        {/* Top Header Card */}
        <div className="public-form-header">
          {/* Subtle background glow */}
          <div
            style={{
              position: "absolute",
              right: -30,
              top: -30,
              width: 140,
              height: 140,
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "50%",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <img
              src={logo}
              alt="Logo mbc sistem"
              style={{
                height: 54,
                width: "auto",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25))",
                flexShrink: 0,
              }}
            />
            <div>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  opacity: 0.9,
                }}
              >
                Penerimaan Anggota Baru
              </span>
              <h1 className="public-form-header-title">
                {form.title}
              </h1>
            </div>
          </div>
          {form.description && (
            <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.92, lineHeight: 1.55 }}>
              {form.description}
            </p>
          )}

          {/* Step Indicator */}
          <div className="public-form-steps">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: !isPreviewing ? 700 : 500,
                color: !isPreviewing ? "#ffffff" : "rgba(255, 255, 255, 0.75)",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: !isPreviewing ? "#ffffff" : "rgba(255, 255, 255, 0.25)",
                  color: !isPreviewing ? "var(--primary-700, #b91c1c)" : "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11.5px",
                  fontWeight: 800,
                }}
              >
                1
              </span>
              Isi Data & Berkas
            </span>
            <span style={{ opacity: 0.4 }}>›</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: isPreviewing ? 700 : 500,
                color: isPreviewing ? "#ffffff" : "rgba(255, 255, 255, 0.75)",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: isPreviewing ? "#ffffff" : "rgba(255, 255, 255, 0.25)",
                  color: isPreviewing ? "var(--primary-700, #b91c1c)" : "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11.5px",
                  fontWeight: 800,
                }}
              >
                2
              </span>
              Pratinjau & Konfirmasi
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="public-form-body">
          {/* STEP 1: FORM INPUTS */}
          {!isPreviewing ? (
            <form onSubmit={handleGoToPreview} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {sortedFields.map((field, idx) => {
                const answer = answers.find((a) => a.fieldId === field.id);
                const hasError = Boolean(errors[field.id]);

                return (
                  <div
                    key={field.id}
                    id={`field-${field.id}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      padding: "16px 18px",
                      background: hasError ? "rgba(239, 68, 68, 0.03)" : "#fcfcfd",
                      borderRadius: 12,
                      border: hasError ? "1.5px solid #fca5a5" : "1px solid #e2e8f0",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy-900)" }}>
                      {idx + 1}. {field.label}{" "}
                      {field.required && <span style={{ color: "#dc2626" }}>*</span>}
                    </label>

                    {field.description && (
                      <p style={{ margin: "0 0 4px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {field.description}
                      </p>
                    )}

                    {/* Contoh Foto / Lampiran Visual HANYA untuk pertanyaan upload berkas/foto yang memiliki exampleImageUrl */}
                    {(field.fieldType === "image" || field.fieldType === "file") && field.exampleImageUrl && field.exampleImageUrl.trim() !== "" && (
                      <div
                        onClick={() =>
                          openLightbox(
                            field.exampleImageUrl || "",
                            field.exampleImageTitle || `Format / Petunjuk Foto: ${field.label}`
                          )
                        }
                        style={{
                          padding: "10px 14px",
                          background: "#f0f9ff",
                          borderRadius: 8,
                          border: "1px solid #bae6fd",
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          marginBottom: 4,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title="Klik untuk membuka foto dalam ukuran penuh / layar penuh"
                      >
                        <img
                          src={field.exampleImageUrl}
                          alt="Contoh yang benar"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          style={{
                            width: 76,
                            height: 54,
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid #7dd3fc",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                            flexShrink: 0,
                            background: "#e0f2fe",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0369a1", display: "block" }}>
                            📸 {field.exampleImageTitle || "Contoh format yang benar"}
                          </span>
                          <span style={{ fontSize: "11.5px", color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <Maximize2 size={12} /> Klik untuk melihat foto layar penuh
                          </span>
                        </div>
                      </div>
                    )}

                    {/* INPUT: TEXT */}
                    {field.fieldType === "text" && (
                      <input
                        type="text"
                        value={answer?.value || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder || "Ketik jawaban Anda di sini"}
                        style={{ height: 44, padding: "10px 14px", fontSize: "14px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box", background: "#ffffff", WebkitAppearance: "none" }}
                      />
                    )}

                    {/* INPUT: TEXTAREA */}
                    {field.fieldType === "textarea" && (
                      <textarea
                        rows={3}
                        value={answer?.value || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder || "Tuliskan jawaban lengkap Anda"}
                        style={{ padding: "10px 14px", fontSize: "14px", resize: "vertical", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box", background: "#ffffff", WebkitAppearance: "none" }}
                      />
                    )}

                    {/* INPUT: NUMBER */}
                    {field.fieldType === "number" && (
                      <input
                        type="number"
                        value={answer?.value || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        placeholder={field.placeholder || "Masukkan angka"}
                        style={{ height: 44, padding: "10px 14px", fontSize: "14px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box", background: "#ffffff", WebkitAppearance: "none" }}
                      />
                    )}

                    {/* INPUT: DATE */}
                    {field.fieldType === "date" && (
                      <input
                        type="date"
                        value={answer?.value || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        style={{ height: 44, padding: "10px 14px", fontSize: "14px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box", background: "#ffffff", WebkitAppearance: "none" }}
                      />
                    )}

                    {/* INPUT: SELECT */}
                    {field.fieldType === "select" && (
                      <select
                        value={answer?.value || ""}
                        onChange={(e) => handleChange(field.id, e.target.value)}
                        style={{ height: 44, padding: "10px 14px", fontSize: "14px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", boxSizing: "border-box", background: "#ffffff" }}
                      >
                        <option value="">-- Pilih salah satu --</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label || opt.value}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* INPUT: RADIO */}
                    {field.fieldType === "radio" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        {(field.options || []).map((opt) => {
                          const isSelected = answer?.value === opt.value;
                          return (
                            <label
                              key={opt.value}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 14px",
                                background: isSelected ? "rgba(185, 28, 28, 0.06)" : "#ffffff",
                                borderRadius: 8,
                                border: isSelected ? "1.5px solid var(--primary-700, #b91c1c)" : "1px solid #e2e8f0",
                                cursor: "pointer",
                                fontSize: "13.5px",
                                fontWeight: isSelected ? 600 : 400,
                                color: isSelected ? "var(--navy-900)" : "#334155",
                                transition: "all 0.15s ease",
                                WebkitTapHighlightColor: "transparent",
                              }}
                            >
                              <input
                                type="radio"
                                name={`radio-${field.id}`}
                                value={opt.value}
                                checked={isSelected}
                                onChange={() => handleChange(field.id, opt.value)}
                                style={{ width: 18, height: 18, accentColor: "var(--primary-700, #b91c1c)", cursor: "pointer" }}
                              />
                              <span style={{ flex: 1 }}>{opt.label || opt.value}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* INPUT: CHECKBOX */}
                    {field.fieldType === "checkbox" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        {(field.options || []).map((opt) => {
                          const isChecked = (answer?.value || "")
                            .split(",")
                            .filter(Boolean)
                            .includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 14px",
                                background: isChecked ? "rgba(185, 28, 28, 0.06)" : "#ffffff",
                                borderRadius: 8,
                                border: isChecked ? "1.5px solid var(--primary-700, #b91c1c)" : "1px solid #e2e8f0",
                                cursor: "pointer",
                                fontSize: "13.5px",
                                fontWeight: isChecked ? 600 : 400,
                                color: isChecked ? "var(--navy-900)" : "#334155",
                                transition: "all 0.15s ease",
                                WebkitTapHighlightColor: "transparent",
                              }}
                            >
                              <input
                                type="checkbox"
                                value={opt.value}
                                checked={isChecked}
                                onChange={(e) => handleCheckboxChange(field.id, opt.value, e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: "var(--primary-700, #b91c1c)", cursor: "pointer" }}
                              />
                              <span style={{ flex: 1 }}>{opt.label || opt.value}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* INPUT: UPLOAD FOTO / DOKUMEN */}
                    {(field.fieldType === "image" || field.fieldType === "file") && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                        {!answer?.file && !answer?.value ? (
                          <label
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              padding: "22px 16px",
                              background: "#ffffff",
                              borderRadius: 10,
                              border: "2px dashed #cbd5e1",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                background: "rgba(185, 28, 28, 0.08)",
                                color: "var(--primary-700, #b91c1c)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Upload size={22} />
                            </div>
                            <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--navy-900)" }}>
                              {field.fieldType === "image" ? "Pilih & Unggah Pas Foto" : "Pilih Berkas Dokumen"}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              {field.fieldType === "image"
                                ? `Format JPG, PNG, WEBP (Maksimal ${field.maxFileSize || 2} MB)`
                                : `Format PDF, JPG, PNG (Maksimal ${field.maxFileSize || 5} MB)`}
                            </span>
                            <input
                              type="file"
                              accept={
                                field.fieldType === "image"
                                  ? "image/jpeg,image/png,image/webp,image/jpg"
                                  : "application/pdf,image/jpeg,image/png,image/jpg"
                              }
                              onChange={(e) => handleFileSelect(field, e.target.files?.[0] || null)}
                              style={{ display: "none" }}
                            />
                          </label>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 14px",
                              background: "#f0fdf4",
                              borderRadius: 8,
                              border: "1px solid #86efac",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
                              {answer.fileBase64 && (field.fieldType === "image" || answer.fileType?.startsWith("image/")) ? (
                                <img
                                  src={answer.fileBase64}
                                  alt="Preview Foto"
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                  onClick={() =>
                                    openLightbox(
                                      answer.fileBase64 || "",
                                      `Foto Anda: ${field.label}`
                                    )
                                  }
                                  style={{
                                    width: 56,
                                    height: 56,
                                    objectFit: "cover",
                                    borderRadius: 6,
                                    border: "1px solid #86efac",
                                    cursor: "pointer",
                                    background: "#f0fdf4",
                                  }}
                                  title="Klik untuk memperbesar foto layar penuh"
                                />
                              ) : (
                                <FileText size={32} style={{ color: "#16a34a", flexShrink: 0 }} />
                              )}
                              <div style={{ overflow: "hidden" }}>
                                <strong style={{ fontSize: "13px", color: "#15803d", display: "block", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                                  {answer.fileName || answer.value}
                                </strong>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                                  {answer.fileSize && (
                                    <span style={{ fontSize: "11px", color: "#16a34a" }}>
                                      {(answer.fileSize / (1024 * 1024)).toFixed(2)} MB
                                    </span>
                                  )}
                                  {answer.fileBase64 && (field.fieldType === "image" || answer.fileType?.startsWith("image/")) && (
                                    <span
                                      style={{ fontSize: "11px", color: "#059669", cursor: "pointer", textDecoration: "underline" }}
                                      onClick={() =>
                                        setActiveSampleImage({
                                          url: answer.fileBase64 || "",
                                          title: `Foto Anda: ${field.label}`,
                                        })
                                      }
                                    >
                                      🔎 Lihat Layar Penuh
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeFile(field.id)}
                              style={{ color: "#dc2626", fontSize: "12px" }}
                            >
                              Ganti
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {hasError && (
                      <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, marginTop: 2 }}>
                        {errors[field.id]}
                      </span>
                    )}
                  </div>
                );
              })}

              <div className="public-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: "12px 28px",
                    fontSize: "14px",
                    fontWeight: 700,
                    borderRadius: "8px",
                    minWidth: "180px",
                  }}
                >
                  <Eye size={16} /> Pratinjau Jawaban ➔
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: PREVIEW JAWABAN */
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  padding: "14px 18px",
                  background: "#eff6ff",
                  borderRadius: 10,
                  border: "1px solid #bfdbfe",
                  fontSize: "13px",
                  color: "#1e40af",
                }}
              >
                <strong>🔎 Tinjau Data Pendaftaran Anda</strong>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#1d4ed8" }}>
                  Pastikan seluruh data dan berkas yang Anda masukkan sudah benar sebelum menekan tombol Kirim Formulir.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sortedFields.map((field, idx) => {
                  const ans = answers.find((a) => a.fieldId === field.id);
                  return (
                    <div
                      key={field.id}
                      style={{
                        padding: "14px 16px",
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                        {idx + 1}. {field.label}
                      </span>
                      {ans?.fileBase64 && (field.fieldType === "image" || ans.fileType?.startsWith("image/")) ? (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                          <img
                            src={ans.fileBase64}
                            alt="Preview Foto"
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            onClick={() =>
                              openLightbox(
                                ans.fileBase64 || "",
                                ans.fileName || `Foto: ${field.label}`
                              )
                            }
                            style={{
                              width: 88,
                              height: 66,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                              background: "#f1f5f9",
                            }}
                            title="Klik untuk melihat foto layar penuh"
                          />
                          <div>
                            <strong style={{ fontSize: "13.5px", color: "var(--navy-900)", display: "block" }}>
                              {ans.fileName || "Foto Calon Anggota"}
                            </strong>
                            <button
                              type="button"
                              onClick={() =>
                                openLightbox(
                                  ans.fileBase64 || "",
                                  ans.fileName || `Foto: ${field.label}`
                                )
                              }
                              style={{
                                marginTop: 4,
                                background: "none",
                                border: "none",
                                padding: 0,
                                color: "var(--primary-700, #b91c1c)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Maximize2 size={12} /> Lihat Layar Penuh
                            </button>
                          </div>
                        </div>
                      ) : ans?.fileBase64 && field.fieldType === "file" ? (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <FileText size={28} style={{ color: "#2563eb" }} />
                          <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>{ans.fileName}</strong>
                        </div>
                      ) : (
                        <strong style={{ fontSize: "13.5px", color: "var(--navy-900)", marginTop: 4, display: "block" }}>
                          {ans?.value || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>-</span>}
                        </strong>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="public-preview-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsPreviewing(false)}
                  disabled={submitting}
                  style={{ fontSize: "13.5px" }}
                >
                  <ArrowLeft size={16} /> Kembali Edit
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmitFinal}
                  disabled={submitting}
                  style={{
                    padding: "12px 28px",
                    fontSize: "14px",
                    fontWeight: 700,
                    borderRadius: "8px",
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spinning" /> Mengirim Formulir...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Kirim Formulir Pendaftaran
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: 20, textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
          © mbc sistem · Formulir Penerimaan Anggota Baru
        </footer>
      </div>

      {/* SAMPLE IMAGE FULLSCREEN LIGHTBOX MODAL */}
      {activeSampleImage &&
        createPortal(
          <div
            onClick={() => {
              setActiveSampleImage(null);
              setImageZoom(1);
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(5, 10, 20, 0.95)",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              zIndex: 99999999,
              animation: "modalFadeIn 0.2s ease-out",
              userSelect: "none",
            }}
          >
            {/* Top Bar Navigation */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 20px",
                background: "rgba(15, 23, 42, 0.85)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                flexWrap: "wrap",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    background: "var(--primary-700, #b91c1c)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  Layar Penuh
                </span>
                <strong style={{ fontSize: "14.5px", color: "#f8fafc", maxWidth: "55vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeSampleImage.title || "Pratinjau Foto"}
                </strong>
              </div>

              {/* Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Zoom out */}
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  disabled={imageZoom <= 1}
                  style={{
                    background: imageZoom <= 1 ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: imageZoom <= 1 ? "#64748b" : "#ffffff",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: imageZoom <= 1 ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Perkecil"
                >
                  <ZoomOut size={15} /> Perkecil
                </button>

                {/* Zoom Level / Reset */}
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  style={{
                    background: imageZoom > 1 ? "rgba(37, 99, 235, 0.4)" : "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    minWidth: "54px",
                    textAlign: "center",
                  }}
                  title="Reset Zoom (100%)"
                >
                  {Math.round(imageZoom * 100)}%
                </button>

                {/* Zoom in */}
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  disabled={imageZoom >= 3}
                  style={{
                    background: imageZoom >= 3 ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: imageZoom >= 3 ? "#64748b" : "#ffffff",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: imageZoom >= 3 ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Perbesar"
                >
                  <ZoomIn size={15} /> Perbesar
                </button>

                {/* Close button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveSampleImage(null);
                    setImageZoom(1);
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.25)",
                    border: "1px solid rgba(239, 68, 68, 0.5)",
                    color: "#fca5a5",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginLeft: 6,
                  }}
                  title="Tutup (ESC)"
                >
                  <X size={15} /> <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Viewer Stage */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                cursor: imageZoom > 1 ? "grab" : "zoom-in",
                position: "relative",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setActiveSampleImage(null);
                  setImageZoom(1);
                }
              }}
            >
              {lightboxLoading && (
                <div
                  style={{
                    position: "absolute",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    color: "#94a3b8",
                    fontSize: "14px",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      border: "3px solid rgba(255,255,255,0.2)",
                      borderTopColor: "#38bdf8",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Memuat foto contoh...</span>
                </div>
              )}

              {lightboxError ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    padding: "24px 30px",
                    background: "rgba(30, 41, 59, 0.95)",
                    borderRadius: 14,
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#ffffff",
                    textAlign: "center",
                    maxWidth: 420,
                    boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: "32px" }}>📸</span>
                  <strong style={{ fontSize: "16px", color: "#f8fafc" }}>Foto Sedang Diproses</strong>
                  <p style={{ fontSize: "13px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                    Jika foto tidak muncul otomatis, Anda dapat membuka dan melihat foto langsung melalui tautan di bawah.
                  </p>
                  <a
                    href={activeSampleImage.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      marginTop: 8,
                      padding: "10px 20px",
                      background: "#0284c7",
                      color: "#ffffff",
                      borderRadius: 8,
                      fontSize: "13.5px",
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Buka Foto di Tab Baru ↗
                  </a>
                </div>
              ) : (
                <img
                  src={formatDirectImageUrl(activeSampleImage.url)}
                  alt={activeSampleImage.title || "Pratinjau"}
                  referrerPolicy={activeSampleImage.url.startsWith("http") ? "no-referrer" : undefined}
                  onLoad={() => setLightboxLoading(false)}
                  onError={(e) => {
                    const currentSrc = e.currentTarget.src;
                    const driveMatch = currentSrc.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (driveMatch && !currentSrc.includes("thumbnail?id=")) {
                      e.currentTarget.src = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1600`;
                    } else {
                      setLightboxLoading(false);
                      setLightboxError(true);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageZoom((prev) => (prev === 1 ? 1.6 : 1));
                  }}
                  style={{
                    maxWidth: imageZoom === 1 ? "95vw" : "none",
                    maxHeight: imageZoom === 1 ? "82vh" : "none",
                    width: imageZoom > 1 ? `${imageZoom * 90}%` : "auto",
                    objectFit: "contain",
                    borderRadius: 10,
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.15)",
                    transition: "width 0.15s ease",
                    display: lightboxLoading ? "none" : "block",
                    margin: "auto",
                  }}
                  title="Klik gambar untuk memperbesar / normal"
                />
              )}
            </div>

            {/* Bottom Tip Bar */}
            <div
              style={{
                padding: "10px 20px",
                background: "rgba(15, 23, 42, 0.8)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
                color: "#94a3b8",
                flexShrink: 0,
              }}
            >
              <span>💡 Klik foto untuk perbesar/perkecil otomatis, atau gunakan tombol di atas.</span>
              <button
                type="button"
                onClick={() => {
                  setActiveSampleImage(null);
                  setImageZoom(1);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#cbd5e1",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Tutup Pratinjau (ESC)
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}