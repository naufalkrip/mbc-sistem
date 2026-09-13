import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Pencil,
  Camera,
  Search,
  FileText,
  Layers,
} from "lucide-react";
import type { RekrutmenField, RekrutmenForm, RekrutmenFieldType, RekrutmenFieldOption } from "../../types";
import { compressImageToSafeHd } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";

const FIELD_TYPES: { value: RekrutmenFieldType; label: string; hasOptions: boolean; isUpload: boolean; icon: string }[] = [
  { value: "text", label: "Teks Pendek", hasOptions: false, isUpload: false, icon: "Aa" },
  { value: "textarea", label: "Teks Panjang (Textarea)", hasOptions: false, isUpload: false, icon: "¶" },
  { value: "number", label: "Angka (Number)", hasOptions: false, isUpload: false, icon: "123" },
  { value: "date", label: "Tanggal (Date)", hasOptions: false, isUpload: false, icon: "📅" },
  { value: "radio", label: "Pilihan Tunggal (Radio)", hasOptions: true, isUpload: false, icon: "🔘" },
  { value: "checkbox", label: "Pilihan Ganda (Checkbox)", hasOptions: true, isUpload: false, icon: "☑️" },
  { value: "select", label: "Dropdown Pilihan", hasOptions: true, isUpload: false, icon: "▾" },
  { value: "image", label: "Upload Foto (JPG, PNG, WEBP)", hasOptions: false, isUpload: true, icon: "📸" },
  { value: "file", label: "Upload Dokumen (PDF, JPG, PNG)", hasOptions: false, isUpload: true, icon: "📄" },
];

const FIELD_TYPE_METAS: Record<
  RekrutmenFieldType,
  {
    label: string;
    icon: string;
    category: "teks" | "pilihan" | "media" | "khusus";
    accentColor: string;
    accentBg: string;
    accentBorder: string;
    badgeBg: string;
    badgeColor: string;
    previewPlaceholder: string;
  }
> = {
  text: {
    label: "Teks Pendek",
    icon: "Aa",
    category: "teks",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "Jawaban teks singkat...",
  },
  textarea: {
    label: "Teks Paragraf",
    icon: "¶",
    category: "teks",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "Tuliskan uraian atau penjelasan lengkap...",
  },
  number: {
    label: "Angka (Number)",
    icon: "123",
    category: "teks",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "08123456789...",
  },
  date: {
    label: "Tanggal (Date)",
    icon: "📅",
    category: "khusus",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "DD / MM / YYYY",
  },
  radio: {
    label: "Pilihan Tunggal (Radio)",
    icon: "🔘",
    category: "pilihan",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "Pilih salah satu",
  },
  checkbox: {
    label: "Pilihan Ganda (Checkbox)",
    icon: "☑️",
    category: "pilihan",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "Bisa pilih lebih dari satu",
  },
  select: {
    label: "Dropdown Pilihan",
    icon: "▾",
    category: "pilihan",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.03)",
    accentBorder: "rgba(185, 28, 28, 0.2)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "-- Pilih Opsi Dropdown --",
  },
  image: {
    label: "Upload Pas Foto",
    icon: "📸",
    category: "media",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.04)",
    accentBorder: "rgba(185, 28, 28, 0.3)",
    badgeBg: "rgba(185, 28, 28, 0.12)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "Pilih file pas foto (JPG, PNG, WEBP)",
  },
  file: {
    label: "Upload Dokumen",
    icon: "📄",
    category: "media",
    accentColor: "var(--primary-700, #b91c1c)",
    accentBg: "rgba(185, 28, 28, 0.04)",
    accentBorder: "rgba(185, 28, 28, 0.25)",
    badgeBg: "rgba(185, 28, 28, 0.08)",
    badgeColor: "var(--primary-700, #b91c1c)",
    previewPlaceholder: "Pilih file dokumen (PDF, JPG, PNG)",
  },
};

const QUESTION_TEMPLATES: Array<{
  label: string;
  field: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">;
}> = [
  {
    label: "+ Nama Lengkap",
    field: {
      formId: "",
      label: "Nama Lengkap Calon Anggota",
      description: "Isikan nama lengkap sesuai kartu identitas (KTP / Kartu Pelajar).",
      placeholder: "Contoh: Budi Santoso",
      fieldType: "text",
      required: true,
      options: [],
      sortOrder: 1,
    },
  },
  {
    label: "+ No. WhatsApp",
    field: {
      formId: "",
      label: "Nomor WhatsApp Aktif",
      description: "Pastikan nomor aktif dan terhubung ke WhatsApp untuk jadwal skrining & pengumuman.",
      placeholder: "Contoh: 081234567890",
      fieldType: "number",
      required: true,
      options: [],
      sortOrder: 2,
    },
  },
  {
    label: "+ Pas Foto 3x4",
    field: {
      formId: "",
      label: "Pas Foto Calon Anggota (3x4)",
      description: "Unggah pas foto formal/rapi berlatar belakang polos.",
      placeholder: "Upload pas foto",
      fieldType: "image",
      required: true,
      options: [],
      sortOrder: 3,
      maxFileSize: 2,
      allowedFileTypes: ["jpg", "jpeg", "png", "webp"],
    },
  },
  {
    label: "+ Pilihan Alat Musik",
    field: {
      formId: "",
      label: "Pilihan Alat Musik / Seksi yang Diminati",
      description: "Pilih alat musik atau seksi Marching Band yang ingin Anda mainkan.",
      placeholder: "-- Pilih Alat Musik --",
      fieldType: "select",
      required: true,
      options: [
        { value: "Brass (Trumpet / Trombone / Mellophone / Baritone / Tuba)", label: "Brass (Trumpet / Trombone / Mellophone / Tuba)" },
        { value: "Percussion Battery (Snare / Tenor / Bass Drum)", label: "Percussion Battery (Snare / Tenor / Bass Drum)" },
        { value: "Pit Instrument (Marimba / Vibraphone / Glockenspiel)", label: "Pit Instrument (Marimba / Vibraphone / Glock)" },
        { value: "Color Guard (Bendera / Rifle / Sabres)", label: "Color Guard (Flag / Rifle / Dance)" },
      ],
      sortOrder: 4,
    },
  },
  {
    label: "+ Pengalaman Musik",
    field: {
      formId: "",
      label: "Pengalaman Bermain Musik / Marching Band",
      description: "Tuliskan pengalaman musik Anda sebelumnya jika ada (pemula tetap diperbolehkan).",
      placeholder: "Contoh: Pernah mengikuti drum band SMP / Belajar musik otodidak / Pemula",
      fieldType: "textarea",
      required: false,
      options: [],
      sortOrder: 5,
    },
  },
];

interface FormBuilderProps {
  form: RekrutmenForm;
  fields: RekrutmenField[];
  onSaveForm: (override?: Partial<RekrutmenForm>) => Promise<boolean>;
  onAddField: (field: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">) => Promise<boolean>;
  onUpdateField: (id: string, field: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">) => Promise<boolean>;
  onDeleteField: (id: string) => Promise<boolean>;
  onReorderFields: (fieldOrders: { id: string; sortOrder: number }[]) => Promise<boolean>;
  onPreview: () => void;
  onCopyLink: () => void;
}

interface FormFieldData {
  label: string;
  description: string;
  placeholder: string;
  fieldType: RekrutmenFieldType;
  required: boolean;
  options: RekrutmenFieldOption[];
  exampleImageUrl: string;
  exampleImageTitle: string;
  maxFileSize: number; // in MB
}

const FIELD_EMPTY: FormFieldData = {
  label: "",
  description: "",
  placeholder: "",
  fieldType: "text",
  required: false,
  options: [],
  exampleImageUrl: "",
  exampleImageTitle: "",
  maxFileSize: 2,
};

export function FormBuilder({
  form,
  fields,
  onSaveForm,
  onAddField,
  onUpdateField,
  onDeleteField,
  onReorderFields,
  onPreview,
  onCopyLink,
}: FormBuilderProps) {
  const [activeTab, setActiveTab] = useState<"fields" | "settings">("fields");
  const [formSettings, setFormSettings] = useState({
    title: form.title,
    description: form.description,
    status: form.status,
  });
  const [savingForm, setSavingForm] = useState(false);

  const [editingField, setEditingField] = useState<RekrutmenField | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fieldForm, setFieldForm] = useState<FormFieldData>(FIELD_EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState(false);
  const [deletingField, setDeletingField] = useState<RekrutmenField | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const { success: toastSuccess, error: toastError } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "required" | "media" | "choice" | "text">("all");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sortedFields = useMemo(() => {
    return [...(Array.isArray(fields) ? fields : [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [fields]);

  const stats = useMemo(() => {
    return {
      total: sortedFields.length,
      required: sortedFields.filter((f) => f.required).length,
      optional: sortedFields.filter((f) => !f.required).length,
      media: sortedFields.filter((f) => f.fieldType === "image" || f.fieldType === "file").length,
      choice: sortedFields.filter((f) => f.fieldType === "select" || f.fieldType === "radio" || f.fieldType === "checkbox").length,
      text: sortedFields.filter((f) => f.fieldType === "text" || f.fieldType === "textarea" || f.fieldType === "number" || f.fieldType === "date").length,
    };
  }, [sortedFields]);

  const filteredSortedFields = useMemo(() => {
    return sortedFields.filter((f) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = (f.label || "").toLowerCase().includes(q);
        const matchesDesc = (f.description || "").toLowerCase().includes(q);
        const matchesType = (FIELD_TYPES.find((t) => t.value === f.fieldType)?.label || "").toLowerCase().includes(q);
        if (!matchesLabel && !matchesDesc && !matchesType) return false;
      }
      if (activeCategory === "required") {
        if (!f.required) return false;
      } else if (activeCategory === "media") {
        if (f.fieldType !== "image" && f.fieldType !== "file") return false;
      } else if (activeCategory === "choice") {
        if (f.fieldType !== "select" && f.fieldType !== "radio" && f.fieldType !== "checkbox") return false;
      } else if (activeCategory === "text") {
        if (f.fieldType !== "text" && f.fieldType !== "textarea" && f.fieldType !== "number" && f.fieldType !== "date") return false;
      }
      return true;
    });
  }, [sortedFields, searchQuery, activeCategory]);

  const handleQuickToggleRequired = async (field: RekrutmenField) => {
    const nextRequired = !field.required;
    const ok = await onUpdateField(field.id, {
      formId: form.id,
      label: field.label,
      description: field.description || "",
      placeholder: field.placeholder || "",
      fieldType: field.fieldType,
      required: nextRequired,
      options: field.options || [],
      sortOrder: field.sortOrder,
      exampleImageUrl: field.exampleImageUrl || "",
      exampleImageTitle: field.exampleImageTitle || "",
      maxFileSize: field.maxFileSize,
      allowedFileTypes: field.allowedFileTypes,
    });
    if (ok) {
      toastSuccess(`Pertanyaan "${field.label}" diubah menjadi ${nextRequired ? "Wajib Diisi" : "Opsional"}.`);
    } else {
      toastError("Gagal memperbarui status pertanyaan.");
    }
  };

  const handleDuplicateField = async (field: RekrutmenField) => {
    const ok = await onAddField({
      formId: form.id,
      label: `${field.label} (Salinan)`,
      description: field.description || "",
      placeholder: field.placeholder || "",
      fieldType: field.fieldType,
      required: field.required,
      options: (field.options || []).map((o) => ({ value: o.value, label: o.label })),
      sortOrder: sortedFields.length + 1,
      exampleImageUrl: field.exampleImageUrl || "",
      exampleImageTitle: field.exampleImageTitle || "",
      maxFileSize: field.maxFileSize,
      allowedFileTypes: field.allowedFileTypes,
    });
    if (ok) {
      toastSuccess(`Pertanyaan "${field.label}" berhasil diduplikat!`);
    } else {
      toastError("Gagal menduplikat pertanyaan.");
    }
  };

  const handleAddFromTemplate = async (template: (typeof QUESTION_TEMPLATES)[0]) => {
    const ok = await onAddField({
      ...template.field,
      formId: form.id,
      sortOrder: sortedFields.length + 1,
    });
    if (ok) {
      toastSuccess(`Pertanyaan "${template.field.label}" berhasil ditambahkan!`);
    } else {
      toastError("Gagal menambahkan pertanyaan.");
    }
  };

  useEffect(() => {
    setFormSettings({
      title: form.title,
      description: form.description,
      status: form.status,
    });
  }, [form]);

  const validateField = (f: FormFieldData): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!f.label.trim()) err.label = "Label pertanyaan wajib diisi.";
    if (f.fieldType === "select" || f.fieldType === "radio" || f.fieldType === "checkbox") {
      const validOpts = f.options.filter((o) => o.value.trim() || o.label.trim());
      if (validOpts.length < 2) {
        err.options = "Minimal 2 pilihan jawaban wajib diisi.";
      }
    }
    return err;
  };

  const openAddField = () => {
    setEditingField(null);
    setFieldForm({
      ...FIELD_EMPTY,
      maxFileSize: 2,
    });
    setFieldErrors({});
    setIsFieldModalOpen(true);
  };

  const openEditField = (field: RekrutmenField) => {
    setEditingField(field);
    setFieldForm({
      label: field.label,
      description: field.description || "",
      placeholder: field.placeholder || "",
      fieldType: field.fieldType,
      required: field.required,
      options: (field.options || []).map((o) => ({ value: o.value, label: o.label })),
      exampleImageUrl: field.exampleImageUrl || "",
      exampleImageTitle: field.exampleImageTitle || "",
      maxFileSize: field.maxFileSize || (field.fieldType === "image" ? 2 : 5),
    });
    setFieldErrors({});
    setIsFieldModalOpen(true);
  };

  const handleFieldSubmit = async () => {
    const err = validateField(fieldForm);
    setFieldErrors(err);
    if (Object.keys(err).length > 0) return;

    setSavingField(true);
    const isUpload = fieldForm.fieldType === "image" || fieldForm.fieldType === "file";
    const payload: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt"> = {
      formId: form.id,
      label: fieldForm.label.trim(),
      description: fieldForm.description.trim(),
      placeholder: fieldForm.placeholder.trim(),
      fieldType: fieldForm.fieldType,
      required: fieldForm.required,
      options: (fieldForm.fieldType === "select" || fieldForm.fieldType === "radio" || fieldForm.fieldType === "checkbox")
        ? fieldForm.options.filter((o) => o.value.trim() || o.label.trim())
        : [],
      sortOrder: editingField ? editingField.sortOrder : sortedFields.length + 1,
      exampleImageUrl: fieldForm.exampleImageUrl.trim(),
      exampleImageTitle: fieldForm.exampleImageTitle.trim(),
      maxFileSize: isUpload ? (fieldForm.maxFileSize || (fieldForm.fieldType === "image" ? 2 : 5)) : undefined,
      allowedFileTypes:
        fieldForm.fieldType === "image"
          ? ["jpg", "jpeg", "png", "webp"]
          : fieldForm.fieldType === "file"
          ? ["pdf", "jpg", "jpeg", "png"]
          : undefined,
    };

    let ok: boolean;
    if (editingField) {
      ok = await onUpdateField(editingField.id, payload);
    } else {
      ok = await onAddField(payload);
    }
    setSavingField(false);
    if (ok) {
      setIsFieldModalOpen(false);
      setEditingField(null);
      setFieldForm(FIELD_EMPTY);
    }
  };

  const handleDeleteField = async () => {
    if (!deletingField) return;
    const ok = await onDeleteField(deletingField.id);
    if (ok) setDeletingField(null);
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    const reordered = [...sortedFields];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const fieldOrders = reordered.map((f, i) => ({ id: f.id, sortOrder: i + 1 }));
    await onReorderFields(fieldOrders);
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedFields.length) return;
    handleReorder(index, newIndex);
  };

  const addOption = () => {
    setFieldForm((prev) => ({ ...prev, options: [...prev.options, { value: "", label: "" }] }));
  };

  const removeOption = (idx: number) => {
    setFieldForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  const handleFormSave = async (overrideStatus?: "dibuka" | "ditutup") => {
    setSavingForm(true);
    const override = overrideStatus ? { status: overrideStatus } : undefined;
    await onSaveForm(override);
    setSavingForm(false);
  };

  const handleCopyLink = async () => {
    await onCopyLink();
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const [compressingImage, setCompressingImage] = useState(false);

  const handleExampleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Pilih file gambar yang valid (JPG, PNG, WEBP).");
        return;
      }
      try {
        setCompressingImage(true);
        const safeHdBase64 = await compressImageToSafeHd(file);
        setFieldForm((p) => ({
          ...p,
          exampleImageUrl: safeHdBase64,
          exampleImageTitle: p.exampleImageTitle || "Contoh foto yang benar",
        }));
      } catch (err) {
        alert("Gagal memproses gambar. Silakan coba lagi.");
      } finally {
        setCompressingImage(false);
      }
    }
  };

  const publicLink = `${window.location.origin}/rekrutmen/form/${form.id || ""}`;

  return (
    <div className="form-builder" style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* Top Banner Card: Standout Red Container (Kotak Merah mbc sistem) */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #c8101e 0%, #a41111 50%, #8a1414 100%)",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "16px 20px",
          color: "#ffffff",
          boxShadow: "0 6px 20px rgba(185, 28, 28, 0.22)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                {form.title || "Formulir Pendaftaran Anggota Baru mbc sistem"}
              </h2>
              <button
                type="button"
                onClick={() => handleFormSave(form.status === "dibuka" ? "ditutup" : "dibuka")}
                disabled={savingForm}
                title={form.status === "dibuka" ? "Klik untuk menonaktifkan link pendaftaran" : "Klik untuk mengaktifkan link pendaftaran"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: form.status === "dibuka" ? "rgba(16, 185, 129, 0.28)" : "rgba(239, 68, 68, 0.28)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: form.status === "dibuka" ? "#34d399" : "#f87171",
                  }}
                />
                {form.status === "dibuka" ? "🟢 Status: Aktif (Menerima Pendaftar)" : "🔴 Status: Ditutup (Draft)"}
              </button>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "rgba(255, 255, 255, 0.9)", lineHeight: 1.45 }}>
              {form.description || "Silakan isi seluruh data dengan benar dan lengkap untuk proses seleksi calon anggota."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onPreview}
              style={{
                color: "#ffffff",
                borderColor: "rgba(255, 255, 255, 0.35)",
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(6px)",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <Eye size={14} /> Preview Form Publik
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleCopyLink}
              style={{
                color: "#ffffff",
                borderColor: "rgba(255, 255, 255, 0.35)",
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(6px)",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              {copySuccess ? <Check size={14} style={{ color: "#34d399" }} /> : <Copy size={14} />}
              {copySuccess ? "Link Tersalin!" : "Salin Link Pendaftaran"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Pertanyaan vs Pengaturan Umum */}
      <div
        className="segment-group"
        style={{
          display: "flex",
          gap: 6,
          background: "var(--bg, #f8fafc)",
          padding: 4,
          borderRadius: "var(--radius-sm, 8px)",
          border: "1px solid var(--border, #e2e8f0)",
          width: "100%",
          maxWidth: "460px",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          className={`segment-btn ${activeTab === "fields" ? "active" : ""}`}
          onClick={() => setActiveTab("fields")}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: "var(--radius-xs, 6px)",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "fields" ? "#ffffff" : "transparent",
            color: activeTab === "fields" ? "var(--primary-700, #b91c1c)" : "var(--text-muted)",
            boxShadow: activeTab === "fields" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          📋 Daftar Pertanyaan ({sortedFields.length})
        </button>
        <button
          type="button"
          className={`segment-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: "var(--radius-xs, 6px)",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "settings" ? "#ffffff" : "transparent",
            color: activeTab === "settings" ? "var(--primary-700, #b91c1c)" : "var(--text-muted)",
            boxShadow: activeTab === "settings" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          ⚙️ Pengaturan Formulir
        </button>
      </div>

      {/* TAB 1: DAFTAR PERTANYAAN (FORM BUILDER) */}
      {activeTab === "fields" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Main Action Header */}
          <div
            className="card"
            style={{
              padding: "16px 20px",
              background: "#ffffff",
              borderRadius: "var(--radius-md, 12px)",
              border: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "6px",
                    background: "rgba(185, 28, 28, 0.1)",
                    color: "var(--primary-700, #b91c1c)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Layers size={16} />
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--navy-900)" }}>
                  Struktur Pertanyaan Formulir
                </h3>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: "var(--primary-50, #fef2f2)",
                    color: "var(--primary-700, #b91c1c)",
                    border: "1px solid rgba(185, 28, 28, 0.15)",
                  }}
                >
                  {sortedFields.length} Pertanyaan Aktif
                </span>
              </div>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0 }}>
                Susun urutan, tipe isian, pratinjau langsung, dan status wajib untuk calon anggota baru.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onPreview}
                style={{
                  fontSize: "12.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderColor: "#cbd5e1",
                  color: "#334155",
                }}
              >
                <Eye size={14} /> Preview Formulir
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openAddField}
                style={{
                  fontSize: "12.5px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 600,
                  boxShadow: "0 2px 6px rgba(185, 28, 28, 0.25)",
                }}
              >
                <Plus size={15} /> Tambah Pertanyaan Baru
              </button>
            </div>
          </div>

          {/* Template Cepat / Quick Presets */}
          <div
            style={{
              background: "linear-gradient(to right, #f8fafc, #f1f5f9)",
              border: "1px solid #e2e8f0",
              borderRadius: "var(--radius-sm, 10px)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: "12px", fontWeight: 600 }}>
              <Sparkles size={14} style={{ color: "#d97706" }} />
              <span>Template Cepat:</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {QUESTION_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddFromTemplate(tmpl)}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "var(--navy-800, #1e293b)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    transition: "all 0.15s ease",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary-700, #b91c1c)";
                    e.currentTarget.style.color = "var(--primary-700, #b91c1c)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.color = "var(--navy-800, #1e293b)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <span>{tmpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search & Filter Toolbar with Live Counters */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              background: "#ffffff",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm, 10px)",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            {/* Category Filter Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "20px",
                  border: activeCategory === "all" ? "1px solid var(--primary-700, #b91c1c)" : "1px solid #e2e8f0",
                  background: activeCategory === "all" ? "var(--primary-50, #fef2f2)" : "#f8fafc",
                  color: activeCategory === "all" ? "var(--primary-700, #b91c1c)" : "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
              >
                <span>Semua</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: activeCategory === "all" ? "var(--primary-700, #b91c1c)" : "#e2e8f0",
                    color: activeCategory === "all" ? "#ffffff" : "#475569",
                  }}
                >
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("required")}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "20px",
                  border: activeCategory === "required" ? "1px solid #dc2626" : "1px solid #e2e8f0",
                  background: activeCategory === "required" ? "#fef2f2" : "#f8fafc",
                  color: activeCategory === "required" ? "#dc2626" : "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
              >
                <span>🔴 Wajib</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: activeCategory === "required" ? "#dc2626" : "#e2e8f0",
                    color: activeCategory === "required" ? "#ffffff" : "#475569",
                  }}
                >
                  {stats.required}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("media")}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "20px",
                  border: activeCategory === "media" ? "1px solid var(--primary-700, #b91c1c)" : "1px solid #e2e8f0",
                  background: activeCategory === "media" ? "var(--primary-50, #fef2f2)" : "#f8fafc",
                  color: activeCategory === "media" ? "var(--primary-700, #b91c1c)" : "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
              >
                <span>📸 Foto & Berkas</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: activeCategory === "media" ? "var(--primary-700, #b91c1c)" : "#e2e8f0",
                    color: activeCategory === "media" ? "#ffffff" : "#475569",
                  }}
                >
                  {stats.media}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("choice")}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "20px",
                  border: activeCategory === "choice" ? "1px solid var(--primary-700, #b91c1c)" : "1px solid #e2e8f0",
                  background: activeCategory === "choice" ? "var(--primary-50, #fef2f2)" : "#f8fafc",
                  color: activeCategory === "choice" ? "var(--primary-700, #b91c1c)" : "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
              >
                <span>🔘 Pilihan</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: activeCategory === "choice" ? "var(--primary-700, #b91c1c)" : "#e2e8f0",
                    color: activeCategory === "choice" ? "#ffffff" : "#475569",
                  }}
                >
                  {stats.choice}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("text")}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: "20px",
                  border: activeCategory === "text" ? "1px solid var(--primary-700, #b91c1c)" : "1px solid #e2e8f0",
                  background: activeCategory === "text" ? "var(--primary-50, #fef2f2)" : "#f8fafc",
                  color: activeCategory === "text" ? "var(--primary-700, #b91c1c)" : "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
              >
                <span>✏️ Teks & Isian</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: activeCategory === "text" ? "var(--primary-700, #b91c1c)" : "#e2e8f0",
                    color: activeCategory === "text" ? "#ffffff" : "#475569",
                  }}
                >
                  {stats.text}
                </span>
              </button>
            </div>

            {/* Keyword Search */}
            <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px", maxWidth: 300 }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                type="text"
                placeholder="Cari nama pertanyaan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 28px 6px 30px",
                  fontSize: "12.5px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* List of Dynamic Question Cards */}
          {sortedFields.length === 0 ? (
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
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "rgba(185, 28, 28, 0.08)",
                  color: "var(--primary-700, #b91c1c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Sparkles size={26} />
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 600, color: "var(--navy-900)" }}>
                Belum Ada Pertanyaan
              </h4>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  maxWidth: 420,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Mulai susun pertanyaan pendaftaran seperti Nama Lengkap, Nomor WhatsApp, Pas Foto Calon Anggota, dan Berkas Identitas.
              </p>
              <button className="btn btn-primary" onClick={openAddField}>
                <Plus size={16} /> Buat Pertanyaan Pertama
              </button>
            </div>
          ) : filteredSortedFields.length === 0 ? (
            <div
              className="card"
              style={{
                padding: "36px 20px",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "var(--radius-md, 12px)",
                border: "1px dashed #cbd5e1",
              }}
            >
              <p style={{ margin: "0 0 10px", fontSize: "13.5px", color: "#64748b" }}>
                Tidak ada pertanyaan yang sesuai dengan filter atau kata kunci &quot;{searchQuery}&quot;.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
              >
                Reset Filter & Pencarian
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredSortedFields.map((field) => {
                const meta = FIELD_TYPE_METAS[field.fieldType] || {
                  label: field.fieldType,
                  icon: "❓",
                  category: "teks",
                  accentColor: "#64748b",
                  accentBg: "rgba(100, 116, 139, 0.04)",
                  accentBorder: "rgba(100, 116, 139, 0.25)",
                  badgeBg: "#f1f5f9",
                  badgeColor: "#475569",
                  previewPlaceholder: "Isian...",
                };

                const isDropTarget = dragOverId === field.id;
                const isBeingDragged = draggedId === field.id;
                const actualIndex = sortedFields.findIndex((f) => f.id === field.id);

                return (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(field.id);
                      e.dataTransfer.setData("text/plain", field.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverId !== field.id) {
                        setDragOverId(field.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverId === field.id) {
                        setDragOverId(null);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedSourceId = e.dataTransfer.getData("text/plain");
                      const fromIdx = sortedFields.findIndex((f) => f.id === droppedSourceId);
                      const toIdx = sortedFields.findIndex((f) => f.id === field.id);
                      setDraggedId(null);
                      setDragOverId(null);
                      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                        handleReorder(fromIdx, toIdx);
                      }
                    }}
                    style={{
                      position: "relative",
                      background: "#ffffff",
                      borderRadius: "var(--radius-md, 12px)",
                      border: isDropTarget
                        ? "2px dashed var(--primary-700, #b91c1c)"
                        : "1.5px solid rgba(185, 28, 28, 0.28)",
                      borderLeft: "5px solid var(--primary-700, #b91c1c)",
                      boxShadow: isBeingDragged
                        ? "0 8px 24px rgba(185, 28, 28, 0.15)"
                        : isDropTarget
                        ? "0 4px 16px rgba(185, 28, 28, 0.2)"
                        : "0 1px 4px rgba(0,0,0,0.03)",
                      opacity: isBeingDragged ? 0.45 : 1,
                      padding: "14px 16px",
                      transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {/* Top Row: Index Badge, Type Tag, Interactive Required Toggle, & Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {/* Left: Drag Handle, Number Badge, Field Type Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div
                          style={{
                            cursor: "grab",
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            background: "#f8fafc",
                          }}
                          title="Tahan dan geser untuk mengubah urutan pertanyaan"
                        >
                          <GripVertical size={16} />
                        </div>

                        {/* Order Number Chip (Merah mbc sistem) */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "linear-gradient(135deg, #c8101e 0%, #a41111 100%)",
                            color: "#ffffff",
                            letterSpacing: "0.5px",
                            boxShadow: "0 1px 3px rgba(185, 28, 28, 0.3)",
                          }}
                        >
                          #{String(actualIndex + 1).padStart(2, "0")}
                        </span>

                        {/* Field Type Badge */}
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: "14px",
                            background: meta.badgeBg,
                            color: meta.badgeColor,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            border: `1px solid ${meta.accentBorder}`,
                          }}
                        >
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>

                        {/* Interactive Direct Toggle for Required/Optional */}
                        <button
                          type="button"
                          onClick={() => handleQuickToggleRequired(field)}
                          title="Klik untuk mengubah status Wajib / Opsional langsung"
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "14px",
                            border: field.required ? "1px solid rgba(220, 38, 38, 0.3)" : "1px solid #cbd5e1",
                            background: field.required ? "rgba(220, 38, 38, 0.08)" : "#f8fafc",
                            color: field.required ? "#dc2626" : "#64748b",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: field.required ? "#dc2626" : "#94a3b8",
                            }}
                          />
                          {field.required ? "Wajib Diisi" : "Opsional"}
                          <span style={{ fontSize: "9px", opacity: 0.7 }}>⇄</span>
                        </button>

                        {/* Example Image Indicator */}
                        {(field.fieldType === "image" || field.fieldType === "file") &&
                          Boolean(field.exampleImageUrl && field.exampleImageUrl.trim()) && (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                background: "rgba(185, 28, 28, 0.08)",
                                color: "var(--primary-700, #b91c1c)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                border: "1px solid rgba(185, 28, 28, 0.2)",
                              }}
                            >
                              <ImageIcon size={11} /> Ada Panduan Foto
                            </span>
                          )}
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => moveField(actualIndex, "up")}
                          disabled={actualIndex === 0}
                          title="Geser urutan ke atas"
                          style={{
                            padding: "4px 6px",
                            color: actualIndex === 0 ? "#cbd5e1" : "var(--navy-900)",
                          }}
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => moveField(actualIndex, "down")}
                          disabled={actualIndex === sortedFields.length - 1}
                          title="Geser urutan ke bawah"
                          style={{
                            padding: "4px 6px",
                            color: actualIndex === sortedFields.length - 1 ? "#cbd5e1" : "var(--navy-900)",
                          }}
                        >
                          <ChevronDown size={15} />
                        </button>

                        {/* 1-Click Duplicate Button */}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDuplicateField(field)}
                          title="Duplikat pertanyaan ini"
                          style={{
                            padding: "4px 8px",
                            color: "#475569",
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Copy size={13} />
                          <span className="hidden-mobile">Salin</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => openEditField(field)}
                          title="Edit konfigurasi pertanyaan"
                          style={{
                            padding: "4px 10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: "var(--primary-700, #b91c1c)",
                            borderColor: "rgba(185, 28, 28, 0.3)",
                            background: "var(--primary-50, #fef2f2)",
                          }}
                        >
                          <Pencil size={12} /> Edit
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeletingField(field)}
                          title="Hapus pertanyaan ini"
                          style={{
                            padding: "4px 6px",
                            color: "#dc2626",
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Question Label & Description */}
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--navy-900, #0f172a)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {field.label}
                        {field.required && <span style={{ color: "#dc2626" }}>*</span>}
                      </h4>
                      {field.description ? (
                        <p
                          style={{
                            margin: "3px 0 0",
                            fontSize: "12px",
                            color: "var(--text-muted, #64748b)",
                            lineHeight: 1.4,
                          }}
                        >
                          {field.description}
                        </p>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                          (Tidak ada deskripsi petunjuk)
                        </span>
                      )}
                    </div>

                    {/* Bottom: Live Interactive Mini Mockup Simulation (Visualisasi Nyata bagi Calon Anggota) */}
                    <div
                      style={{
                        background: meta.accentBg,
                        border: `1px solid ${meta.accentBorder}`,
                        borderRadius: "8px",
                        padding: "10px 12px",
                        marginTop: 2,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: meta.accentColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Pratinjau Isian Pendaftar:
                        </span>
                        {field.placeholder && (
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            Placeholder: &ldquo;{field.placeholder}&rdquo;
                          </span>
                        )}
                      </div>

                      {/* Mockup based on field type */}
                      {field.fieldType === "text" || field.fieldType === "number" ? (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{field.placeholder || meta.previewPlaceholder}</span>
                          <span style={{ fontSize: "10px", color: "#cbd5e1" }}>{field.fieldType === "number" ? "123" : "Aa"}</span>
                        </div>
                      ) : field.fieldType === "textarea" ? (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "8px 10px",
                            fontSize: "12px",
                            color: "#94a3b8",
                            minHeight: 48,
                            lineHeight: 1.4,
                          }}
                        >
                          {field.placeholder || meta.previewPlaceholder}
                        </div>
                      ) : field.fieldType === "date" ? (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            color: "#94a3b8",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            width: 170,
                          }}
                        >
                          <span>📅</span>
                          <span>DD / MM / YYYY</span>
                        </div>
                      ) : field.fieldType === "radio" || field.fieldType === "checkbox" ? (
                        <div>
                          {field.options && field.options.length > 0 ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {field.options.map((opt, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: "11.5px",
                                    fontWeight: 500,
                                    background: "#ffffff",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "16px",
                                    padding: "3px 10px",
                                    color: "#334155",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: field.fieldType === "radio" ? "50%" : "2px",
                                      border: "1.5px solid #94a3b8",
                                      display: "inline-block",
                                    }}
                                  />
                                  {opt.label || opt.value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "#dc2626", fontStyle: "italic" }}>
                              ⚠️ Belum ada opsi pilihan yang ditambahkan. Klik tombol &ldquo;Edit&rdquo; untuk menambahkan opsi.
                            </span>
                          )}
                        </div>
                      ) : field.fieldType === "select" ? (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            color: "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            maxWidth: 320,
                          }}
                        >
                          <span>
                            {field.options && field.options.length > 0
                              ? `-- Pilih salah satu (${field.options.length} opsi tersedia) --`
                              : "-- Belum ada opsi dropdown --"}
                          </span>
                          <ChevronDown size={14} style={{ color: "#94a3b8" }} />
                        </div>
                      ) : field.fieldType === "image" ? (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1.5px dashed var(--primary-700, #b91c1c)",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "6px",
                                background: "rgba(185, 28, 28, 0.1)",
                                color: "var(--primary-700, #b91c1c)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Camera size={18} />
                            </div>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--navy-900)" }}>
                                Area Upload Pas Foto Calon Anggota
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                Format: JPG, PNG, WEBP (Otomatis Kompresi HD aman kuota)
                              </div>
                            </div>
                          </div>
                          {field.exampleImageUrl ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Eye size={11} /> {field.exampleImageTitle || "Ada Contoh Foto"}
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              Belum ada lampiran contoh
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1.5px dashed var(--primary-700, #b91c1c)",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "6px",
                              background: "rgba(185, 28, 28, 0.08)",
                              color: "var(--primary-700, #b91c1c)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <FileText size={18} />
                          </div>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--navy-900)" }}>
                              Area Upload Berkas / Dokumen
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              Maks: {field.maxFileSize || 5}MB &bull; Format: {field.allowedFileTypes || "PDF, JPG, PNG"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENGATURAN UMUM FORMULIR */}
      {activeTab === "settings" && (
        <div
          className="card"
          style={{
            background: "#ffffff",
            borderRadius: "var(--radius-md, 12px)",
            border: "1px solid var(--border, #e2e8f0)",
            padding: "24px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 16px", color: "var(--navy-900)" }}>
            Pengaturan Informasi Formulir
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Nama / Judul Formulir *</label>
              <input
                value={formSettings.title}
                onChange={(e) => setFormSettings((p) => ({ ...p, title: e.target.value }))}
                placeholder="Contoh: Formulir Pendaftaran Anggota Baru mbc sistem"
                style={{ height: 40, padding: "8px 12px", fontSize: "13.5px" }}
              />
            </div>

            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Deskripsi / Instruksi Calon Anggota</label>
              <textarea
                value={formSettings.description}
                onChange={(e) => setFormSettings((p) => ({ ...p, description: e.target.value }))}
                placeholder="Deskripsi dan petunjuk pengisian yang akan dilihat calon anggota"
                rows={4}
                style={{ padding: "8px 12px", fontSize: "13px", resize: "vertical" }}
              />
            </div>

            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Status Formulir Pendaftaran</label>
              <select
                value={formSettings.status}
                onChange={(e) => setFormSettings((p) => ({ ...p, status: e.target.value as "dibuka" | "ditutup" }))}
                style={{ height: 40, padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="dibuka">🟢 Aktif — Formulir dibuka untuk publik (Menerima pendaftar)</option>
                <option value="ditutup">🔴 Nonaktif — Formulir ditutup (Draft / Tidak menerima pendaftar)</option>
              </select>
            </div>

            <div
              style={{
                background: "var(--bg, #f8fafc)",
                padding: "16px",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Link Akses Formulir Publik Calon Anggota</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={publicLink}
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    height: 38,
                    padding: "6px 12px",
                    fontSize: "13px",
                    color: "var(--navy-900)",
                  }}
                />
                <button type="button" className="btn btn-outline" onClick={handleCopyLink} disabled={copySuccess}>
                  {copySuccess ? <Check size={16} style={{ color: "#10b981" }} /> : <Copy size={16} />}
                  {copySuccess ? "Tersalin" : "Salin Link"}
                </button>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Calon anggota dapat membuka link ini secara langsung tanpa perlu login.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleFormSave()}
                disabled={savingForm}
              >
                {savingForm ? "Menyimpan..." : "Simpan Pengaturan Formulir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT PERTANYAAN */}
      <Modal
        open={isFieldModalOpen}
        title={editingField ? "Edit Pertanyaan Formulir" : "Tambah Pertanyaan Baru"}
        onClose={() => {
          setIsFieldModalOpen(false);
          setEditingField(null);
          setFieldForm(FIELD_EMPTY);
          setFieldErrors({});
        }}
        size="lg"
        footer={
          <>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setIsFieldModalOpen(false);
                setEditingField(null);
                setFieldForm(FIELD_EMPTY);
                setFieldErrors({});
              }}
              disabled={savingField}
            >
              Batal
            </button>
            <button className="btn btn-primary" onClick={handleFieldSubmit} disabled={savingField}>
              {savingField ? "Menyimpan..." : editingField ? "Simpan Perubahan" : "Tambah Pertanyaan"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Label Pertanyaan */}
          <div className="form-group" style={{ gap: 4 }}>
            <label style={{ fontSize: "13px", fontWeight: 600 }}>
              Label Pertanyaan * <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={fieldForm.label}
              onChange={(e) => setFieldForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="Contoh: Nama Lengkap / Nomor WhatsApp / Pas Foto Calon Anggota"
              style={{ height: 40, padding: "8px 12px", fontSize: "13.5px" }}
            />
            {fieldErrors.label && <span style={{ fontSize: "12px", color: "#dc2626" }}>{fieldErrors.label}</span>}
          </div>

          {/* Grid Tipe Input & Wajib Diisi */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Tipe Input Pertanyaan *</label>
              <select
                value={fieldForm.fieldType}
                onChange={(e) => {
                  const val = e.target.value as RekrutmenFieldType;
                  setFieldForm((p) => ({
                    ...p,
                    fieldType: val,
                    maxFileSize: val === "image" ? 2 : val === "file" ? 5 : p.maxFileSize,
                  }));
                }}
                style={{ height: 40, padding: "8px 12px", fontSize: "13.5px" }}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Keharusan Pengisian</label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 40,
                  padding: "0 12px",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-xs, 6px)",
                  border: "1px solid var(--border, #e2e8f0)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                <input
                  type="checkbox"
                  checked={fieldForm.required}
                  onChange={(e) => setFieldForm((p) => ({ ...p, required: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "var(--primary-700, #b91c1c)" }}
                />
                <span>Wajib diisi oleh calon anggota</span>
              </label>
            </div>
          </div>

          {/* Placeholder / Teks Bantuan */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Placeholder Input (Opsional)</label>
              <input
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm((p) => ({ ...p, placeholder: e.target.value }))}
                placeholder="Contoh: Masukkan nama lengkap sesuai KTP"
                style={{ height: 38, padding: "6px 12px", fontSize: "13px" }}
              />
            </div>

            <div className="form-group" style={{ gap: 4 }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Deskripsi / Petunjuk Pengisian (Opsional)</label>
              <input
                value={fieldForm.description}
                onChange={(e) => setFieldForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Contoh: Pastikan nomor aktif WhatsApp"
                style={{ height: 38, padding: "6px 12px", fontSize: "13px" }}
              />
            </div>
          </div>

          {/* Opsi Pilihan (Select, Radio, Checkbox) */}
          {(fieldForm.fieldType === "select" || fieldForm.fieldType === "radio" || fieldForm.fieldType === "checkbox") && (
            <div
              style={{
                background: "var(--bg, #f8fafc)",
                padding: "16px",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--navy-900)" }}>
                  Daftar Pilihan Jawaban *
                </label>
                <button type="button" className="btn btn-outline btn-sm" onClick={addOption} style={{ fontSize: "12px" }}>
                  <Plus size={14} /> Tambah Opsi
                </button>
              </div>

              {fieldErrors.options && (
                <span style={{ fontSize: "12px", color: "#dc2626" }}>{fieldErrors.options}</span>
              )}

              {fieldForm.options.map((opt, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", width: 20 }}>{idx + 1}.</span>
                  <input
                    value={opt.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFieldForm((p) => ({
                        ...p,
                        options: p.options.map((o, i) => (i === idx ? { value: val, label: val } : o)),
                      }));
                    }}
                    placeholder={`Pilihan ${idx + 1}`}
                    style={{ flex: 1, height: 36, padding: "6px 10px", fontSize: "13px" }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeOption(idx)}
                    style={{ padding: "6px", color: "#dc2626" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pengaturan Khusus Upload File / Foto */}
          {(fieldForm.fieldType === "image" || fieldForm.fieldType === "file") && (
            <div
              style={{
                background: "var(--bg, #f8fafc)",
                padding: "16px",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Camera size={18} style={{ color: "var(--primary-700, #b91c1c)" }} />
                <strong style={{ fontSize: "13.5px", color: "var(--navy-900)" }}>
                  Pengaturan Khusus {fieldForm.fieldType === "image" ? "Pas Foto" : "Dokumen"}
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group" style={{ gap: 4 }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600 }}>Batas Maksimal Ukuran (MB)</label>
                  <select
                    value={fieldForm.maxFileSize}
                    onChange={(e) => setFieldForm((p) => ({ ...p, maxFileSize: Number(e.target.value) }))}
                    style={{ height: 36, padding: "6px 10px", fontSize: "13px" }}
                  >
                    <option value={1}>1 MB</option>
                    <option value={2}>2 MB (Rekomendasi Foto)</option>
                    <option value={5}>5 MB (Rekomendasi Dokumen)</option>
                  </select>
                </div>

                <div className="form-group" style={{ gap: 4 }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600 }}>Judul Foto Panduan (Opsional)</label>
                  <input
                    value={fieldForm.exampleImageTitle}
                    onChange={(e) => setFieldForm((p) => ({ ...p, exampleImageTitle: e.target.value }))}
                    placeholder="Contoh: Contoh pas foto 3x4 berseragam"
                    style={{ height: 36, padding: "6px 10px", fontSize: "13px" }}
                  />
                </div>
              </div>

              {/* Lampirkan Foto Panduan */}
              <div className="form-group" style={{ gap: 6 }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600 }}>Foto Panduan / Contoh untuk Calon Anggota</label>
                {fieldForm.exampleImageUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img
                      src={fieldForm.exampleImageUrl}
                      alt="Contoh"
                      style={{
                        width: 60,
                        height: 75,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setPreviewImage({
                            url: fieldForm.exampleImageUrl,
                            title: fieldForm.exampleImageTitle || "Foto Panduan",
                          })
                        }
                      >
                        <Eye size={13} /> Lihat Foto
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setFieldForm((p) => ({ ...p, exampleImageUrl: "" }))}
                        style={{ color: "#dc2626" }}
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      className="btn btn-outline btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", margin: 0 }}
                    >
                      <Upload size={14} />
                      {compressingImage ? "Memproses Gambar..." : "Unggah Foto Panduan (HD)"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleExampleImageUpload}
                        disabled={compressingImage}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* CONFIRM DELETE PERTANYAAN */}
      <ConfirmDialog
        open={deletingField !== null}
        title="Hapus Pertanyaan Formulir?"
        message={`Pertanyaan "${deletingField?.label || ""}" akan dihapus dari formulir pendaftaran.`}
        onConfirm={handleDeleteField}
        onCancel={() => setDeletingField(null)}
      />

      {/* PREVIEW GAMBAR MODAL */}
      {previewImage &&
        createPortal(
          <div
            onClick={() => setPreviewImage(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999999,
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 600,
                width: "100%",
                background: "#ffffff",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong style={{ fontSize: "14px" }}>📸 {previewImage.title}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPreviewImage(null)}
                  style={{ padding: "4px 8px" }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: 20, textAlign: "center", background: "#0f172a" }}>
                <img
                  src={previewImage.url}
                  alt={previewImage.title}
                  style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}