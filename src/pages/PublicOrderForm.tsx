import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  Lock,
  Phone,
  RefreshCw,
  Upload,
  FileText,
  Eye,
  ArrowLeft,
  X,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
} from "lucide-react";
import type { OrderFormWithFields, OrderField } from "../types";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  getOrderFormDetailApi,
  submitCustomerOrderApi,
  compressImageToFhd,
  fileToBase64,
} from "../services/api";
import logo from "../aset/logo.png";
import { formatNomorWhatsAppUrl, formatRupiah, parseVariantConfig } from "../utils/format";

interface CustomerAnswerState {
  fieldId: string;
  label: string;
  value: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
}

export interface OrderVariantItem {
  id: string;
  size: string;
  sleeve: string;
  qty: number;
}

export function formatVariantSummary(
  items: OrderVariantItem[],
  config?: { price?: number; longSleeveExtra?: number; prices?: Record<string, number> }
): string {
  const valid = items.filter((it) => it.qty > 0 && it.size);
  if (valid.length === 0) return "";
  const basePrice = config?.price || 0;
  const longSleeveExtra = config?.longSleeveExtra || 0;
  const prices = config?.prices || {};
  const hasPrices = Object.keys(prices).length > 0 || basePrice > 0;

  const getPrice = (it: OrderVariantItem) => {
    const key = `${it.size}|${it.sleeve}`;
    if (prices[key] !== undefined && prices[key] > 0) return prices[key];
    const isLongSleeve = /panjang/i.test(it.sleeve || "");
    return basePrice + (isLongSleeve ? longSleeveExtra : 0);
  };

  const lines = valid.map((it) => {
    const unitPrice = getPrice(it);
    const subtotal = unitPrice * (Number(it.qty) || 0);
    const priceText = hasPrices && unitPrice > 0 ? ` @ ${formatRupiah(unitPrice)} = ${formatRupiah(subtotal)}` : "";
    return `• ${it.qty}x [Ukuran ${it.size} - ${it.sleeve || "Lengan Pendek"}]${priceText}`;
  });

  const totalQty = valid.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const totalPrice = valid.reduce((acc, it) => {
    const unitPrice = getPrice(it);
    return acc + unitPrice * (Number(it.qty) || 0);
  }, 0);

  if (hasPrices && totalPrice > 0) {
    return `${lines.join("\n")}\n(Total: ${totalQty} pcs | ${formatRupiah(totalPrice)})`;
  }
  return `${lines.join("\n")}\n(Total: ${totalQty} pcs)`;
}

export function parseVariantItems(
  rawText: string,
  defaultSizes: string[],
  defaultSleeves: string[]
): OrderVariantItem[] {
  if (!rawText) {
    return [
      {
        id: "var-1",
        size: defaultSizes[0] || "L",
        sleeve: defaultSleeves[0] || "Lengan Pendek",
        qty: 1,
      },
    ];
  }
  const lines = rawText.split("\n").filter((l) => l.trim().startsWith("•"));
  if (lines.length > 0) {
    const parsed: OrderVariantItem[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\]/i);
      if (match) {
        parsed.push({
          id: `var-${idx + 1}-${Math.random().toString(36).slice(2, 5)}`,
          qty: parseInt(match[1], 10) || 1,
          size: match[2].trim(),
          sleeve: match[3].trim(),
        });
      }
    });
    if (parsed.length > 0) return parsed;
  }

  return [
    {
      id: "var-1",
      size: defaultSizes[0] || "L",
      sleeve: defaultSleeves[0] || "Lengan Pendek",
      qty: 1,
    },
  ];
}

export function PublicOrderForm() {
  const { id } = useParams<{ id: string }>();
  const { error: toastError, success: toastSuccess } = useToast();

  const {
    data: form,
    loading,
    error,
    refresh,
  } = useApi<OrderFormWithFields | null>(
    () => getOrderFormDetailApi(id || ""),
    "Gagal memuat formulir pemesanan.",
    `order-form-${id || "default"}`,
    { pollingInterval: 0, revalidateOnFocus: false, immediate: true }
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fileAnswers, setFileAnswers] = useState<
    Record<
      string,
      {
        url: string;
        name: string;
        size?: number;
        type?: string;
      }
    >
  >({});
  const [variantRows, setVariantRows] = useState<Record<string, OrderVariantItem[]>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    id: string;
    customerName: string;
    createdAt: string;
  } | null>(null);

  // Lightbox preview for admin uploaded guideline/question photos
  const [activeLightboxImage, setActiveLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);

  // Close lightbox on Escape key and lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeLightboxImage) {
        setActiveLightboxImage(null);
        setImageZoom(1);
      }
    };
    if (activeLightboxImage) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeLightboxImage]);

  const sortedFields = useMemo(() => {
    if (!form?.fields) return [];
    return [...form.fields].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [form]);

  const { totalFormQty, totalFormPrice } = useMemo(() => {
    let qty = 0;
    let price = 0;
    if (!form?.fields) return { totalFormQty: 0, totalFormPrice: 0 };
    form.fields.forEach((fld) => {
      if (fld.fieldType === "variant_matrix" || fld.fieldType === "product_configuration") {
        const cfg = parseVariantConfig(fld);
        const rows = variantRows[fld.id] || [];
        rows.forEach((r) => {
          const itemQty = Number(r.qty) || 0;
          const key = `${r.size}|${r.sleeve}`;
          let unit = 0;
          if (cfg.prices && cfg.prices[key] !== undefined && cfg.prices[key] > 0) {
            unit = cfg.prices[key];
          } else {
            const isLong = /panjang/i.test(r.sleeve || "");
            unit = (cfg.price || 0) + (isLong ? (cfg.longSleeveExtra || 0) : 0);
          }
          qty += itemQty;
          price += unit * itemQty;
        });
      }
    });
    return { totalFormQty: qty, totalFormPrice: price };
  }, [form?.fields, variantRows]);

  // Load draft from localStorage on form loaded
  useEffect(() => {
    if (form?.id) {
      try {
        const key = `order_draft_${form.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.variantRows) setVariantRows(parsed.variantRows);
        }
      } catch {}
    }
  }, [form?.id]);

  const getFieldConfig = (fieldId: string) => {
    const f = form?.fields?.find((fld) => fld.id === fieldId);
    return f ? parseVariantConfig(f) : { price: 85000, longSleeveExtra: 0, sleeves: [] };
  };

  // Inisialisasi variantRows untuk field bertipe variant_matrix
  useEffect(() => {
    if (!form?.fields) return;
    form.fields.forEach((fld) => {
      if (fld.fieldType === "variant_matrix" || fld.fieldType === "product_configuration") {
        const config = parseVariantConfig(fld);
        setVariantRows((prev) => {
          if (prev[fld.id] && prev[fld.id].length > 0) return prev;
          const defaultSizes = (fld.options && fld.options.length > 0)
            ? fld.options.map((o) => o.label)
            : ["S", "M", "L", "XL", "XXL", "3XL"];
          const defaultSleeves = config.sleeves.length > 0
            ? config.sleeves
            : ["Lengan Pendek", "Lengan Panjang"];

          const initialItems = parseVariantItems(answers[fld.id] || "", defaultSizes, defaultSleeves);
          const initialSummary = formatVariantSummary(initialItems, config);
          if (!answers[fld.id] && initialSummary) {
            setAnswers((a) => ({ ...a, [fld.id]: initialSummary }));
          }
          return {
            ...prev,
            [fld.id]: initialItems,
          };
        });
      }
    });
  }, [form?.fields]);

  // Autosave draft answers
  useEffect(() => {
    if (form?.id && Object.keys(answers).length > 0) {
      try {
        const key = `order_draft_${form.id}`;
        localStorage.setItem(key, JSON.stringify({ answers, variantRows }));
      } catch {}
    }
  }, [answers, variantRows, form?.id]);

  // Helper Pengubahan Baris Varian (Ukuran, Lengan, Qty)
  const updateVariantRow = (fieldId: string, itemIdx: number, updates: Partial<OrderVariantItem>) => {
    const config = getFieldConfig(fieldId);
    setVariantRows((prev) => {
      const current = prev[fieldId] ? [...prev[fieldId]] : [];
      if (!current[itemIdx]) return prev;
      current[itemIdx] = { ...current[itemIdx], ...updates };
      const summary = formatVariantSummary(current, config);
      setAnswers((a) => ({ ...a, [fieldId]: summary }));
      if (formErrors[fieldId]) {
        setFormErrors((err) => {
          const next = { ...err };
          delete next[fieldId];
          return next;
        });
      }
      return { ...prev, [fieldId]: current };
    });
  };

  const addVariantRow = (field: OrderField) => {
    const config = parseVariantConfig(field);
    const defaultSizes = (field.options && field.options.length > 0)
      ? field.options.map((o) => o.label)
      : ["S", "M", "L", "XL", "XXL", "3XL"];
    const defaultSleeves = config.sleeves.length > 0
      ? config.sleeves
      : ["Lengan Pendek", "Lengan Panjang"];

    setVariantRows((prev) => {
      const current = prev[field.id] ? [...prev[field.id]] : [];
      const newRow: OrderVariantItem = {
        id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        size: defaultSizes[0] || "L",
        sleeve: defaultSleeves[0] || "Lengan Pendek",
        qty: 1,
      };
      const updated = [...current, newRow];
      const summary = formatVariantSummary(updated, config);
      setAnswers((a) => ({ ...a, [field.id]: summary }));
      return { ...prev, [field.id]: updated };
    });
  };

  const removeVariantRow = (fieldId: string, itemIdx: number) => {
    const config = getFieldConfig(fieldId);
    setVariantRows((prev) => {
      const current = prev[fieldId] ? [...prev[fieldId]] : [];
      if (current.length <= 1) return prev;
      const updated = current.filter((_, idx) => idx !== itemIdx);
      const summary = formatVariantSummary(updated, config);
      setAnswers((a) => ({ ...a, [fieldId]: summary }));
      return { ...prev, [fieldId]: updated };
    });
  };

  // Handle Input Changes
  const handleInputChange = (fieldId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: val }));
    if (formErrors[fieldId]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleCheckboxChange = (fieldId: string, optLabel: string, checked: boolean) => {
    const curVal = answers[fieldId] ? answers[fieldId].split(", ").filter(Boolean) : [];
    let updated: string[];
    if (checked) {
      updated = Array.from(new Set([...curVal, optLabel]));
    } else {
      updated = curVal.filter((v) => v !== optLabel);
    }
    handleInputChange(fieldId, updated.join(", "));
  };

  const handleFileUpload = async (field: OrderField, file: File | null) => {
    if (!file) return;

    const maxLimitMb = 5;
    const maxLimitBytes = maxLimitMb * 1024 * 1024;

    if (file.size > maxLimitBytes) {
      const msg = `Ukuran file terlalu besar. Maksimal ukuran file adalah ${maxLimitMb} MB.`;
      toastError(msg);
      setFormErrors((prev) => ({ ...prev, [field.id]: msg }));
      return;
    }

    try {
      let base64 = "";
      if (file.type.startsWith("image/")) {
        base64 = await compressImageToFhd(file, 1920, 0.88);
      } else {
        base64 = await fileToBase64(file);
      }
      setFileAnswers((prev) => ({
        ...prev,
        [field.id]: {
          url: base64,
          name: file.name,
          size: file.size,
          type: file.type,
        },
      }));
      handleInputChange(field.id, file.name);
    } catch {
      toastError("Gagal membaca berkas unggahan.");
    }
  };

  const removeFile = (fieldId: string) => {
    setFileAnswers((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    handleInputChange(fieldId, "");
  };

  // Validate form before preview
  const handleGoToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    if (form.status === "nonaktif") {
      toastError("Formulir ini saat ini dinonaktifkan dan tidak menerima pesanan baru.");
      return;
    }

    const errors: Record<string, string> = {};

    sortedFields.forEach((fld) => {
      const val = answers[fld.id] || "";
      if (fld.required && !val.trim()) {
        errors[fld.id] = `${fld.label} wajib diisi.`;
      }
      // Validasi khusus varian ukuran & jumlah
      if (fld.fieldType === "variant_matrix" || fld.fieldType === "product_configuration") {
        const rows = variantRows[fld.id] || [];
        const totalQty = rows.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
        if (fld.required && (rows.length === 0 || totalQty <= 0)) {
          errors[fld.id] = `${fld.label}: Minimal harus memesan 1 pcs kaos.`;
        }
      }
      // Khusus WhatsApp field
      if (fld.fieldType === "whatsapp" && val.trim()) {
        const cleanWa = formatNomorWhatsAppUrl(val);
        if (!cleanWa || cleanWa.length < 9) {
          errors[fld.id] = "Nomor WhatsApp tidak valid (contoh: 081234567890).";
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toastError("Mohon lengkapi seluruh pertanyaan wajib.");
      const firstErrorField = sortedFields.find((f) => errors[f.id]);
      if (firstErrorField) {
        const el = document.getElementById(`field-${firstErrorField.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return;
    }

    setFormErrors({});
    setIsPreviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final submit
  const handleSubmitFinal = async () => {
    if (!form || submitting) return;

    setSubmitting(true);

    const formattedAnswers: CustomerAnswerState[] = sortedFields.map((fld) => {
      const val = answers[fld.id] || "";
      const fileData = fileAnswers[fld.id];
      return {
        fieldId: fld.id,
        label: fld.label,
        value: val,
        fileUrl: fileData?.url,
        fileName: fileData?.name,
        fileSize: fileData?.size,
        fileType: fileData?.type,
      };
    });

    const res = await submitCustomerOrderApi({
      formId: form.id,
      answers: formattedAnswers,
    });

    setSubmitting(false);

    if (res.success && res.data) {
      try {
        localStorage.removeItem(`order_draft_${form.id}`);
      } catch {}
      setSubmittedOrder({
        id: res.data.id,
        customerName: res.data.customerName,
        createdAt: res.data.createdAt,
      });
      setIsPreviewing(false);
      toastSuccess("Pesanan Anda berhasil dikirim!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      toastError(res.message || "Gagal mengirim pesanan. Silakan coba kembali.");
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
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <img
            src={logo}
            alt="Logo MB Chondro"
            style={{ height: 60, width: "auto", objectFit: "contain", marginBottom: 16 }}
          />
          <Loader2
            size={32}
            className="spinning"
            style={{ color: "var(--primary-700, #b91c1c)", margin: "0 auto 12px" }}
          />
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--navy-900)" }}>
            Memuat Formulir Pemesanan MB Chondro...
          </h3>
        </div>
      </div>
    );
  }

  // ERROR / NOT FOUND STATE
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
          fontFamily: "'Poppins', sans-serif",
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
          <img
            src={logo}
            alt="Logo MB Chondro"
            style={{ height: 60, width: "auto", objectFit: "contain", marginBottom: 16 }}
          />
          <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--navy-900)", marginBottom: 8 }}>
            Formulir Pesanan Tidak Ditemukan
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", marginBottom: 20 }}>
            Tautan formulir pesanan ini mungkin telah ditutup atau tautan yang Anda buka tidak valid.
          </p>
          <button className="btn btn-primary" onClick={() => refresh()}>
            <RefreshCw size={16} /> Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // CLOSED / NONAKTIF STATE
  if (form.status === "nonaktif" && !submittedOrder) {
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
          fontFamily: "'Poppins', sans-serif",
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
          <img
            src={logo}
            alt="Logo MB Chondro"
            style={{ height: 60, width: "auto", objectFit: "contain", marginBottom: 16 }}
          />
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
            Formulir Pesanan Tidak Aktif
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
            Terima kasih atas minat Anda. Saat ini formulir pemesanan <strong>{form.title}</strong> sedang{" "}
            <strong>dinonaktifkan / ditutup</strong> sehingga tidak menerima pesanan baru.
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
            Silakan hubungi admin MB Chondro untuk informasi ketersediaan pesanan selanjutnya.
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

  // SUCCESS SUBMITTED STATE (Identik dengan formulir pendaftaran anggota)
  if (submittedOrder) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          padding: 20,
          fontFamily: "'Poppins', sans-serif",
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
          <img
            src={logo}
            alt="Logo MB Chondro"
            style={{ height: 64, width: "auto", objectFit: "contain", marginBottom: 16 }}
          />
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
            Pesanan Berhasil Dikirim!
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
            Terima kasih <strong>{submittedOrder.customerName}</strong>, formulir pesanan Anda telah berhasil diterima dan
            tercatat dalam sistem MB Chondro.
          </p>

          <div
            style={{
              padding: "16px 20px",
              background: "#f0fdf4",
              borderRadius: 10,
              border: "1px solid #bbf7d0",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#166534",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "block",
                marginBottom: 4,
              }}
            >
              Kode ID Pesanan Anda:
            </span>
            <strong style={{ fontSize: "22px", letterSpacing: "1px", color: "var(--primary-700, #b91c1c)" }}>
              {submittedOrder.id}
            </strong>
          </div>

          <div
            style={{
              padding: "16px",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              textAlign: "left",
              fontSize: "13px",
              color: "#334155",
              marginBottom: 24,
            }}
          >
            <strong>💡 Tahapan Selanjutnya:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Admin MB Chondro akan memverifikasi rincian pesanan Anda.</li>
              <li>Konfirmasi pembayaran atau invoice akan dihubungi melalui nomor WhatsApp yang Anda cantumkan.</li>
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSubmittedOrder(null);
              setIsPreviewing(false);
              setAnswers({});
              setFileAnswers({});
            }}
            style={{ fontSize: "13px" }}
          >
            Kirim Pesanan Lain
          </button>
        </div>
        <footer style={{ marginTop: 24, fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          © MB Chondro · Sistem Manajemen Pemesanan
        </footer>
      </div>
    );
  }

  // MAIN FORM CONTAINER (Identik dengan PublicForm pendaftaran anggota)
  return (
    <div className="public-form-outer">
      <div className="public-form-container">
        {/* Top Header Card dengan Gradient Merah MBC */}
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
              alt="Logo MB Chondro"
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
                Pemesanan Kaos MB Chondro
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
              Isi Data Pemesanan
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
              {/* FOTO PANDUAN / KETERANGAN TAMBAHAN (SIZE CHART / DESAIN KAOS) */}
              {form.bannerImageUrl && (
                <div
                  style={{
                    background: "linear-gradient(180deg, #fef2f2 0%, #fff5f5 100%)",
                    border: "1.5px solid #fecaca",
                    borderRadius: 14,
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 2px 10px rgba(185, 28, 28, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          background: "var(--primary-700, #c8101e)",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Panduan Kaos
                      </span>
                      <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 700, color: "var(--navy-900)" }}>
                        {form.bannerImageTitle || "Foto Keterangan Tambahan / Panduan Ukuran & Desain"}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveLightboxImage({
                          url: form.bannerImageUrl || "",
                          title: form.bannerImageTitle || "Panduan Ukuran & Desain Kaos MB Chondro",
                        })
                      }
                      style={{
                        background: "#ffffff",
                        border: "1px solid #fca5a5",
                        color: "var(--primary-700, #c8101e)",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Eye size={14} />
                      <span>Lihat Layar Penuh</span>
                    </button>
                  </div>

                  <div
                    onClick={() =>
                      setActiveLightboxImage({
                        url: form.bannerImageUrl || "",
                        title: form.bannerImageTitle || "Panduan Ukuran & Desain Kaos MB Chondro",
                      })
                    }
                    style={{
                      cursor: "zoom-in",
                      position: "relative",
                      borderRadius: 10,
                      overflow: "hidden",
                      maxHeight: 340,
                      background: "#ffffff",
                      border: "1px solid #fed7aa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={form.bannerImageUrl}
                      alt={form.bannerImageTitle || "Panduan Kaos"}
                      style={{
                        width: "100%",
                        height: "auto",
                        maxHeight: 340,
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0, 0, 0, 0.72)",
                        color: "#ffffff",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: "11px",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Eye size={12} /> Klik untuk perbesar
                    </div>
                  </div>
                </div>
              )}

              {sortedFields.map((field, idx) => {
                const value = answers[field.id] || "";
                const hasError = Boolean(formErrors[field.id]);

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
                      {idx + 1}. {field.label} {field.required && <span style={{ color: "#dc2626" }}>*</span>}
                    </label>

                    {field.description && (
                      <p style={{ margin: "0 0 4px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {field.description}
                      </p>
                    )}

                    {/* FOTO KETERANGAN / CONTOH PADA PERTANYAAN (OPSIONAL) */}
                    {field.imageUrl && (
                      <div
                        style={{
                          marginBottom: 8,
                          padding: 10,
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                            minWidth: 0,
                          }}
                          onClick={() =>
                            setActiveLightboxImage({
                              url: field.imageUrl || "",
                              title: field.imageTitle || `Contoh: ${field.label}`,
                            })
                          }
                        >
                          <img
                            src={field.imageUrl}
                            alt={field.imageTitle || "Contoh"}
                            style={{
                              width: 52,
                              height: 52,
                              objectFit: "cover",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--navy-900)", display: "block" }}>
                              {field.imageTitle || "Foto Contoh / Keterangan Visual"}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--primary-700, #c8101e)", fontWeight: 600 }}>
                              🔎 Klik untuk melihat foto layar penuh
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setActiveLightboxImage({
                              url: field.imageUrl || "",
                              title: field.imageTitle || `Contoh: ${field.label}`,
                            })
                          }
                          style={{ fontSize: "11.5px", color: "var(--primary-700)", flexShrink: 0 }}
                        >
                          Lihat
                        </button>
                      </div>
                    )}

                    {/* INPUT: TEXT */}
                    {field.fieldType === "text" && (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder={field.placeholder || "Ketik jawaban Anda di sini"}
                        style={{
                          height: 44,
                          padding: "10px 14px",
                          fontSize: "14px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          width: "100%",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    )}

                    {/* INPUT: WHATSAPP */}
                    {field.fieldType === "whatsapp" && (
                      <div style={{ position: "relative" }}>
                        <Phone
                          size={16}
                          style={{
                            position: "absolute",
                            left: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-muted)",
                          }}
                        />
                        <input
                          type="tel"
                          value={value}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          placeholder={field.placeholder || "Contoh: 081234567890"}
                          style={{
                            height: 44,
                            padding: "10px 14px 10px 40px",
                            fontSize: "14px",
                            borderRadius: 10,
                            border: "1px solid #cbd5e1",
                            width: "100%",
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    )}

                    {/* INPUT: TEXTAREA */}
                    {field.fieldType === "textarea" && (
                      <textarea
                        rows={3}
                        value={value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder={field.placeholder || "Tuliskan keterangan lengkap..."}
                        style={{
                          padding: "10px 14px",
                          fontSize: "14px",
                          resize: "vertical",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          width: "100%",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    )}

                    {/* INPUT: NUMBER */}
                    {field.fieldType === "number" && (
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder={field.placeholder || "0"}
                        style={{
                          height: 44,
                          padding: "10px 14px",
                          fontSize: "14px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          width: "100%",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    )}

                    {/* INPUT: DATE */}
                    {field.fieldType === "date" && (
                      <input
                        type="date"
                        value={value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        style={{
                          height: 44,
                          padding: "10px 14px",
                          fontSize: "14px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          width: "100%",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    )}

                    {/* INPUT: SELECT */}
                    {field.fieldType === "select" && (
                      <select
                        value={value}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        style={{
                          height: 44,
                          padding: "10px 14px",
                          fontSize: "14px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          width: "100%",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      >
                        <option value="">-- Pilih salah satu --</option>
                        {(field.options || []).map((opt) => (
                          <option key={opt.id} value={opt.label}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* INPUT: VARIANT MATRIX (UKURAN, LENGAN, DAN JUMLAH DALAM 1 KOTAK + BISA TAMBAH) */}
                    {(field.fieldType === "variant_matrix" || field.fieldType === "product_configuration") && (() => {
                      const rows = variantRows[field.id] || [
                        { id: "1", size: (field.options && field.options[0]?.label) || "L", sleeve: "Lengan Pendek", qty: 1 }
                      ];
                      const config = parseVariantConfig(field);
                      const sizes = (field.options && field.options.length > 0)
                        ? field.options.map((o) => o.label)
                        : ["S", "M", "L", "XL", "XXL", "3XL"];
                      const sleeves = config.sleeves && config.sleeves.length > 0
                        ? config.sleeves
                        : ["Lengan Pendek", "Lengan Panjang"];
                      const getUnitPrice = (size: string, sleeve: string) => {
                        const key = `${size}|${sleeve}`;
                        if (config.prices && config.prices[key] !== undefined && config.prices[key] > 0) {
                          return config.prices[key];
                        }
                        const isLong = /panjang/i.test(sleeve || "");
                        return (config.price || 0) + (isLong ? (config.longSleeveExtra || 0) : 0);
                      };
                      const totalQty = rows.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
                      const totalPrice = rows.reduce((acc, it) => {
                        return acc + getUnitPrice(it.size, it.sleeve) * (Number(it.qty) || 0);
                      }, 0);

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                          {/* List of Variant Boxes */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {rows.map((row, rIdx) => {
                              const itemUnitPrice = getUnitPrice(row.size, row.sleeve);
                              const itemSubtotal = itemUnitPrice * (Number(row.qty) || 0);

                              return (
                                <div
                                  key={row.id || rIdx}
                                  className="variant-box"
                                >
                                  {/* Box Top Header */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--navy-900)", display: "flex", alignItems: "center", gap: 6 }}>
                                      <span
                                        style={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          background: "var(--primary-700, #b91c1c)",
                                          color: "#ffffff",
                                          fontSize: "11px",
                                          fontWeight: 800,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        {rIdx + 1}
                                      </span>
                                      Varian Pesanan #{rIdx + 1}
                                    </span>

                                    {rows.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeVariantRow(field.id, rIdx)}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#dc2626",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "2px 6px",
                                          borderRadius: 6,
                                        }}
                                        title="Hapus varian ini"
                                      >
                                        <Trash2 size={13} />
                                        <span>Hapus</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* 3 Inputs in 1 Box: Ukuran, Lengan, Jumlah */}
                                  <div className="builder-variant-grid">
                                    {/* 1. Ukuran (Dropdown) */}
                                    <div>
                                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                                        Pilihan Ukuran
                                      </label>
                                      <select
                                        value={row.size}
                                        onChange={(e) => updateVariantRow(field.id, rIdx, { size: e.target.value })}
                                        style={{
                                          height: 44,
                                          padding: "10px 12px",
                                          fontSize: "14px",
                                          borderRadius: 10,
                                          border: "1px solid #cbd5e1",
                                          width: "100%",
                                          boxSizing: "border-box",
                                          background: "#ffffff",
                                          fontWeight: 600,
                                        }}
                                      >
                                        <option value="">-- Pilih Ukuran --</option>
                                        {sizes.map((sz) => (
                                          <option key={sz} value={sz}>
                                            {sz}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* 2. Pilihan Lengan (Dropdown) */}
                                    <div>
                                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                                        Pilihan Lengan
                                      </label>
                                      <select
                                        value={row.sleeve}
                                        onChange={(e) => updateVariantRow(field.id, rIdx, { sleeve: e.target.value })}
                                        style={{
                                          height: 44,
                                          padding: "10px 12px",
                                          fontSize: "14px",
                                          borderRadius: 10,
                                          border: "1px solid #cbd5e1",
                                          width: "100%",
                                          boxSizing: "border-box",
                                          background: "#ffffff",
                                        }}
                                      >
                                        {sleeves.map((sl) => (
                                          <option key={sl} value={sl}>
                                            {sl}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* 3. Jumlah (Stepper) */}
                                    <div>
                                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                                        Jumlah (Pcs)
                                      </label>
                                      <div className="variant-stepper">
                                        <button
                                          type="button"
                                          className="variant-stepper-btn"
                                          onClick={() => updateVariantRow(field.id, rIdx, { qty: Math.max(1, row.qty - 1) })}
                                          disabled={row.qty <= 1}
                                          aria-label="Kurangi jumlah"
                                        >
                                          -
                                        </button>
                                        <input
                                          type="number"
                                          min={1}
                                          value={row.qty}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            updateVariantRow(field.id, rIdx, { qty: isNaN(val) || val < 1 ? 1 : val });
                                          }}
                                          className="variant-stepper-input"
                                        />
                                        <button
                                          type="button"
                                          className="variant-stepper-btn"
                                          onClick={() => updateVariantRow(field.id, rIdx, { qty: row.qty + 1 })}
                                          aria-label="Tambah jumlah"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Subtotal Item Card */}
                                  {(Object.keys(config.prices || {}).length > 0 || (config.price && config.price > 0)) && (
                                    <div
                                      style={{
                                        marginTop: 10,
                                        padding: "8px 12px",
                                        background: "#f8fafc",
                                        borderRadius: 8,
                                        border: "1px dashed #cbd5e1",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: 6,
                                        fontSize: "12.5px",
                                      }}
                                    >
                                      <div style={{ color: "#475569", display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                        <span>Harga:</span>
                                        <strong style={{ color: "var(--navy-900)" }}>{formatRupiah(itemUnitPrice)}</strong>
                                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>/ pcs</span>
                                        {Object.keys(config.prices || {}).length === 0 && /panjang/i.test(row.sleeve || "") && config.longSleeveExtra && config.longSleeveExtra > 0 ? (
                                          <span
                                            style={{
                                              fontSize: "11px",
                                              color: "var(--primary-700, #b91c1c)",
                                              background: "rgba(185, 28, 28, 0.08)",
                                              padding: "1px 6px",
                                              borderRadius: 4,
                                              fontWeight: 600,
                                            }}
                                          >
                                            +{formatRupiah(config.longSleeveExtra)} Lengan Panjang
                                          </span>
                                        ) : null}
                                      </div>

                                      <div style={{ fontWeight: 700, color: "var(--navy-900)", display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 500 }}>
                                          {row.qty} pcs × {formatRupiah(itemUnitPrice)} =
                                        </span>
                                        <span style={{ color: "var(--primary-700, #b91c1c)", fontSize: "13.5px" }}>
                                          {formatRupiah(itemSubtotal)}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Bottom Action: + Tambah Varian Lain & Total Summary */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                              flexWrap: "wrap",
                              paddingTop: 4,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => addVariantRow(field)}
                              className="btn btn-outline btn-sm"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 14px",
                                borderRadius: 8,
                                fontWeight: 600,
                              }}
                            >
                              <Plus size={14} />
                              <span>+ Tambah Varian / Ukuran Lain</span>
                            </button>

                            <div
                              style={{
                                padding: "8px 14px",
                                background: "linear-gradient(135deg, rgba(185, 28, 28, 0.08) 0%, rgba(185, 28, 28, 0.02) 100%)",
                                border: "1.5px solid rgba(185, 28, 28, 0.2)",
                                borderRadius: 10,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 14,
                                flexWrap: "wrap",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: "13px",
                                  color: "var(--navy-900)",
                                  fontWeight: 600,
                                }}
                              >
                                <span>📦 Total Pesanan:</span>
                                <strong style={{ color: "var(--primary-700, #b91c1c)" }}>{totalQty} pcs</strong>
                              </div>

                              {(Object.keys(config.prices || {}).length > 0 || (config.price && config.price > 0)) && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: "13px",
                                    color: "var(--navy-900)",
                                    fontWeight: 700,
                                    borderLeft: "1px solid rgba(185, 28, 28, 0.2)",
                                    paddingLeft: 12,
                                  }}
                                >
                                  <span>💰 Total Harga:</span>
                                  <span
                                    style={{
                                      background: "var(--primary-700, #b91c1c)",
                                      color: "#ffffff",
                                      padding: "3px 10px",
                                      borderRadius: 6,
                                      fontSize: "13.5px",
                                      fontWeight: 800,
                                      letterSpacing: 0.3,
                                    }}
                                  >
                                    {formatRupiah(totalPrice)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* INPUT: RADIO */}
                    {field.fieldType === "radio" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        {(field.options || []).map((opt) => {
                          const isSelected = value === opt.label;
                          return (
                            <label
                              key={opt.id}
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
                              }}
                            >
                              <input
                                type="radio"
                                name={`radio_${field.id}`}
                                value={opt.label}
                                checked={isSelected}
                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                style={{ width: 18, height: 18, accentColor: "var(--primary-700, #b91c1c)", cursor: "pointer" }}
                              />
                              <span style={{ flex: 1 }}>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* INPUT: CHECKBOX */}
                    {field.fieldType === "checkbox" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        {(field.options || []).map((opt) => {
                          const isChecked = value.split(", ").includes(opt.label);
                          return (
                            <label
                              key={opt.id}
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
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleCheckboxChange(field.id, opt.label, e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: "var(--primary-700, #b91c1c)", cursor: "pointer" }}
                              />
                              <span style={{ flex: 1 }}>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* INPUT: FILE / BERKAS */}
                    {field.fieldType === "file" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                        {!fileAnswers[field.id] ? (
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
                                justifyItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Upload size={22} />
                            </div>
                            <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--navy-900)" }}>
                              Pilih Berkas Lampiran / Gambar
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              Format PDF, JPG, PNG, DOC (Maksimal 5 MB)
                            </span>
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                void handleFileUpload(field, file);
                              }}
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
                              {fileAnswers[field.id].type?.startsWith("image/") ? (
                                <img
                                  src={fileAnswers[field.id].url}
                                  alt="Preview Lampiran"
                                  style={{
                                    width: 50,
                                    height: 50,
                                    objectFit: "cover",
                                    borderRadius: 6,
                                    border: "1px solid #86efac",
                                  }}
                                />
                              ) : (
                                <FileText size={32} style={{ color: "#16a34a", flexShrink: 0 }} />
                              )}
                              <div style={{ overflow: "hidden" }}>
                                <strong
                                  style={{
                                    fontSize: "13px",
                                    color: "#15803d",
                                    display: "block",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                  }}
                                >
                                  {fileAnswers[field.id].name}
                                </strong>
                                {fileAnswers[field.id].size && (
                                  <span style={{ fontSize: "11px", color: "#16a34a" }}>
                                    {(fileAnswers[field.id].size! / (1024 * 1024)).toFixed(2)} MB
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeFile(field.id)}
                              style={{ color: "#dc2626", fontSize: "12px" }}
                            >
                              <X size={15} /> Ganti
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {hasError && (
                      <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, marginTop: 2 }}>
                        {formErrors[field.id]}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Ringkasan Biaya Pesanan Keseluruhan di Step 1 */}
              {totalFormPrice > 0 && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)",
                    border: "1.5px solid rgba(185, 28, 28, 0.25)",
                    borderRadius: 14,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    boxShadow: "0 4px 14px rgba(185, 28, 28, 0.06)",
                    marginTop: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: "rgba(185, 28, 28, 0.1)",
                        color: "var(--primary-700, #b91c1c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                      }}
                    >
                      💰
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Total Estimasi Pesanan
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy-900)" }}>
                        {totalFormQty} pcs Kaos MB Chondro
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "20px",
                        fontWeight: 800,
                        color: "var(--primary-700, #b91c1c)",
                        letterSpacing: 0.5,
                      }}
                    >
                      {formatRupiah(totalFormPrice)}
                    </span>
                  </div>
                </div>
              )}

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
                  <Eye size={16} /> Pratinjau Pesanan ➔
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: PREVIEW JAWABAN PESANAN */
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
                <strong>🔎 Tinjau Data Pesanan Anda</strong>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#1d4ed8" }}>
                  Pastikan seluruh data dan rincian pesanan sudah benar sebelum menekan tombol Kirim Pesanan.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sortedFields.map((field, idx) => {
                  const val = answers[field.id] || "";
                  const fileData = fileAnswers[field.id];

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
                      {fileData && fileData.type?.startsWith("image/") ? (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                          <img
                            src={fileData.url}
                            alt="Lampiran Pesanan"
                            style={{
                              width: 80,
                              height: 60,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                            }}
                          />
                          <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                            {fileData.name}
                          </strong>
                        </div>
                      ) : fileData ? (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                          <FileText size={26} style={{ color: "#2563eb" }} />
                          <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>{fileData.name}</strong>
                        </div>
                      ) : (field.fieldType === "variant_matrix" || field.fieldType === "product_configuration" || val.includes("•")) ? (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          {(() => {
                            const cfg = parseVariantConfig(field);
                            const items = (variantRows[field.id] && variantRows[field.id].length > 0
                              ? variantRows[field.id]
                              : parseVariantItems(val, ["S", "M", "L", "XL"], ["Lengan Pendek", "Lengan Panjang"])
                            );

                            return (
                              <>
                                {items.map((it, i) => {
                                  const key = `${it.size}|${it.sleeve}`;
                                  let unitPrice = 0;
                                  if (cfg.prices && cfg.prices[key] !== undefined && cfg.prices[key] > 0) {
                                    unitPrice = cfg.prices[key];
                                  } else {
                                    const isLong = /panjang/i.test(it.sleeve || "");
                                    unitPrice = (cfg.price || 0) + (isLong ? (cfg.longSleeveExtra || 0) : 0);
                                  }
                                  const subtotal = unitPrice * (Number(it.qty) || 0);

                                  return (
                                    <div
                                      key={it.id || i}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        background: "#ffffff",
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: "1px solid #e2e8f0",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span
                                          style={{
                                            background: "rgba(185, 28, 28, 0.1)",
                                            color: "var(--primary-700, #b91c1c)",
                                            fontWeight: 700,
                                            fontSize: "12px",
                                            padding: "2px 8px",
                                            borderRadius: 6,
                                          }}
                                        >
                                          {it.qty} pcs
                                        </span>
                                        <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                                          Ukuran {it.size}
                                        </strong>
                                        <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                          · {it.sleeve || "Lengan Pendek"}
                                        </span>
                                      </div>
                                      {(Object.keys(cfg.prices || {}).length > 0 || (cfg.price && cfg.price > 0)) && (
                                        <div style={{ textAlign: "right" }}>
                                          <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>
                                            {formatRupiah(subtotal)}
                                          </strong>
                                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                            @{formatRupiah(unitPrice)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <div
                                  style={{
                                    marginTop: 4,
                                    padding: "8px 12px",
                                    background: "rgba(185, 28, 28, 0.06)",
                                    borderRadius: 8,
                                    border: "1px solid rgba(185, 28, 28, 0.15)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "var(--primary-700)",
                                  }}
                                >
                                  <span>{val.split("\n").find((l) => l.includes("Total:")) || "Ringkasan Pesanan"}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <strong style={{ fontSize: "13.5px", color: "var(--navy-900)", marginTop: 4, display: "block" }}>
                          {val || <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>-</span>}
                        </strong>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Ringkasan Total Pembayaran di Step 2 */}
              {totalFormPrice > 0 && (
                <div
                  style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)",
                    border: "1.5px solid rgba(185, 28, 28, 0.25)",
                    borderRadius: 14,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    boxShadow: "0 4px 14px rgba(185, 28, 28, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "rgba(185, 28, 28, 0.1)",
                        color: "var(--primary-700, #b91c1c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                      }}
                    >
                      💳
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Total Pembayaran Pesanan
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy-900)" }}>
                        {totalFormQty} pcs Kaos MB Chondro
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: "var(--primary-700, #b91c1c)",
                        letterSpacing: 0.5,
                      }}
                    >
                      {formatRupiah(totalFormPrice)}
                    </span>
                  </div>
                </div>
              )}

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
                      <Loader2 size={16} className="spinning" /> Mengirim Pesanan...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Kirim Pesanan Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: 20, textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
          © MB Chondro · Formulir Pemesanan Resmi
        </footer>
      </div>

      {/* TRULY FULLSCREEN LIGHTBOX POPUP FOR ADMIN PHOTOS */}
      {activeLightboxImage &&
        createPortal(
          <div
            onClick={() => {
              setActiveLightboxImage(null);
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
              backdropFilter: "blur(10px)",
              display: "flex",
              flexDirection: "column",
              zIndex: 99999999,
              animation: "fadeIn 0.2s ease-out",
              userSelect: "none",
            }}
          >
            {/* Top Bar Header with Controls */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 20px",
                background: "rgba(15, 23, 42, 0.9)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                flexWrap: "wrap",
                gap: 12,
                flexShrink: 0,
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    background: "var(--primary-700, #c8101e)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  Layar Penuh
                </span>
                <strong
                  style={{
                    fontSize: "14.5px",
                    color: "#f8fafc",
                    maxWidth: "50vw",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeLightboxImage.title || "Pratinjau Foto"}
                </strong>
              </div>

              {/* Controls: Zoom Out, Zoom Reset, Zoom In, Close */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {/* Zoom Out */}
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

                {/* Reset Zoom */}
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  style={{
                    background: imageZoom > 1 ? "rgba(200, 16, 30, 0.4)" : "rgba(255, 255, 255, 0.1)",
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

                {/* Zoom In */}
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

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveLightboxImage(null);
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
                    marginLeft: 4,
                  }}
                  title="Tutup Layar Penuh (ESC)"
                >
                  <X size={15} /> <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Viewer Stage: Fills remaining 100% of viewport */}
            <div
              style={{
                flex: 1,
                width: "100%",
                height: "calc(100vh - 56px)",
                overflow: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: imageZoom > 1 ? "40px" : "10px",
                boxSizing: "border-box",
                cursor: imageZoom > 1 ? "grab" : "zoom-in",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setActiveLightboxImage(null);
                  setImageZoom(1);
                }
              }}
            >
              <img
                src={activeLightboxImage.url}
                alt={activeLightboxImage.title}
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle zoom between 1 and 1.6 on image click
                  setImageZoom((z) => (z > 1 ? 1 : 1.6));
                }}
                style={{
                  width: imageZoom === 1 ? "100%" : `${imageZoom * 100}%`,
                  height: imageZoom === 1 ? "calc(100vh - 76px)" : "auto",
                  maxWidth: imageZoom === 1 ? "98vw" : "none",
                  maxHeight: imageZoom === 1 ? "calc(100vh - 76px)" : "none",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.7)",
                  transition: "width 0.15s ease, height 0.15s ease",
                  display: "block",
                  margin: "auto",
                }}
                title="Klik foto untuk perbesar/normal"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
