import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Camera,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import type { OrderField, OrderForm, OrderFieldType, OrderFieldOption } from "../../types";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { compressImageToFhd } from "../../services/api";

interface OrderFormBuilderModalProps {
  open: boolean;
  onClose: () => void;
  formToEdit?: (OrderForm & { fields?: OrderField[] }) | null;
  onSave: (formData: {
    id?: string;
    title: string;
    description: string;
    status: "aktif" | "nonaktif";
    bannerImageUrl?: string;
    bannerImageTitle?: string;
    fields: OrderField[];
  }) => Promise<boolean>;
}

const ORDER_FIELD_TYPE_OPTIONS: { value: OrderFieldType; label: string; desc: string }[] = [
  { value: "text", label: "Jawaban Singkat", desc: "Satu baris teks pendek" },
  { value: "textarea", label: "Paragraf", desc: "Teks panjang multi-baris" },
  { value: "number", label: "Angka", desc: "Input numerik kuantitas atau jumlah" },
  { value: "whatsapp", label: "Nomor WhatsApp", desc: "Khusus no. HP / WA customer" },
  { value: "select", label: "Dropdown", desc: "Pilihan menu tarik turun" },
  { value: "radio", label: "Pilihan Satu (Radio)", desc: "Pilih salah satu opsi" },
  { value: "checkbox", label: "Pilihan Ganda (Checkbox)", desc: "Dapat mencentang beberapa opsi" },
  { value: "date", label: "Tanggal", desc: "Pemilih tanggal" },
  { value: "file", label: "Upload File / Referensi", desc: "Upload gambar / dokumen referensi" },
];

function getDefaultFields(): OrderField[] {
  return [
    {
      id: "fld-nama-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Nama Lengkap Customer",
      fieldType: "text",
      required: true,
      sortOrder: 0,
      placeholder: "Contoh: Ahmad Fauzi",
    },
    {
      id: "fld-wa-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Nomor WhatsApp",
      fieldType: "whatsapp",
      required: true,
      sortOrder: 1,
      placeholder: "081234567890",
    },
    {
      id: "fld-model-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Model / Tipe Kaos",
      fieldType: "select",
      required: true,
      sortOrder: 2,
      options: [
        { id: "opt-1", label: "Kaos Pendek MB Chondro (Cotton Combed 30s)" },
        { id: "opt-2", label: "Kaos Panjang MB Chondro (Cotton Combed 30s)" },
        { id: "opt-3", label: "Polo Shirt / Kaos Berkerah MB Chondro" },
      ],
    },
    {
      id: "fld-qty-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Jumlah Pesanan",
      fieldType: "number",
      required: true,
      sortOrder: 3,
      placeholder: "1",
    },
    {
      id: "fld-catatan-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Catatan Tambahan",
      fieldType: "textarea",
      required: false,
      sortOrder: 4,
      placeholder: "Rincian spesifikasi tambahan...",
    },
  ];
}

export function OrderFormBuilderModal({
  open,
  onClose,
  formToEdit,
  onSave,
}: OrderFormBuilderModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  const [title, setTitle] = useState(formToEdit?.title || "Formulir Pemesanan Kaos MB Chondro");
  const [description, setDescription] = useState(
    formToEdit?.description || "Silakan lengkapi formulir di bawah ini untuk pemesanan kaos MB Chondro."
  );
  const [status, setStatus] = useState<"aktif" | "nonaktif">(formToEdit?.status || "aktif");
  const [bannerImageUrl, setBannerImageUrl] = useState<string>(formToEdit?.bannerImageUrl || "");
  const [bannerImageTitle, setBannerImageTitle] = useState<string>(formToEdit?.bannerImageTitle || "");
  const [fields, setFields] = useState<OrderField[]>(() => {
    if (formToEdit?.fields && formToEdit.fields.length > 0) {
      return JSON.parse(JSON.stringify(formToEdit.fields));
    }
    return getDefaultFields();
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Sync state whenever modal is opened or formToEdit changes
  useEffect(() => {
    if (open) {
      if (formToEdit) {
        setTitle(formToEdit.title || "");
        setDescription(formToEdit.description || "");
        setStatus(formToEdit.status || "aktif");
        setBannerImageUrl(formToEdit.bannerImageUrl || "");
        setBannerImageTitle(formToEdit.bannerImageTitle || "");
        if (formToEdit.fields && formToEdit.fields.length > 0) {
          setFields(JSON.parse(JSON.stringify(formToEdit.fields)));
        } else {
          setFields(getDefaultFields());
        }
      } else {
        setTitle("Formulir Pemesanan Kaos MB Chondro");
        setDescription("Silakan lengkapi formulir di bawah ini untuk pemesanan kaos MB Chondro.");
        setStatus("aktif");
        setBannerImageUrl("");
        setBannerImageTitle("");
        setFields(getDefaultFields());
      }
    }
  }, [open, formToEdit]);

  const handleAddField = () => {
    const newField: OrderField = {
      id: "fld-" + Math.random().toString(36).slice(2, 8),
      formId: formToEdit?.id || "",
      label: "Pertanyaan Baru",
      fieldType: "text",
      required: false,
      sortOrder: fields.length,
      placeholder: "",
    };
    setFields((prev) => [...prev, newField]);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) {
      toastError("Minimal harus ada 1 pertanyaan pada formulir.");
      return;
    }
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === fields.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    setFields((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((f, i) => ({ ...f, sortOrder: i }));
    });
  };

  const updateFieldProperty = (index: number, updates: Partial<OrderField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const handleUploadBannerImage = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastError("Hanya berkas gambar (JPG, PNG, WEBP) yang dapat diunggah.");
      return;
    }
    try {
      setUploadingImage(true);
      // Kompres dengan resolusi Full HD (FHD 1080p / hingga 1920px) agar jernih dan tajam
      const base64 = await compressImageToFhd(file, 1920, 0.88);
      setBannerImageUrl(base64);
      if (!bannerImageTitle) {
        setBannerImageTitle("Panduan Desain / Ukuran Kaos MB Chondro");
      }
      toastSuccess("Foto keterangan Full HD (tajam) berhasil dimuat!");
    } catch {
      toastError("Gagal memproses gambar.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadFieldImage = async (fieldIndex: number, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastError("Hanya berkas gambar (JPG, PNG, WEBP) yang dapat diunggah.");
      return;
    }
    try {
      // Kompres resolusi Full HD (FHD) agar tajam
      const base64 = await compressImageToFhd(file, 1920, 0.88);
      updateFieldProperty(fieldIndex, {
        imageUrl: base64,
        imageTitle: fields[fieldIndex].imageTitle || `Contoh: ${fields[fieldIndex].label}`,
      });
      toastSuccess("Foto keterangan pertanyaan Full HD berhasil dimuat!");
    } catch {
      toastError("Gagal memproses gambar pertanyaan.");
    }
  };

  const handleAddOption = (fieldIndex: number) => {
    const currentField = fields[fieldIndex];
    const currentOptions = currentField?.options ? [...currentField.options] : [];
    const nextOptNum = currentOptions.length + 1;
    const newOpt: OrderFieldOption = {
      id: "opt-" + Math.random().toString(36).slice(2, 8),
      label: `Opsi ${nextOptNum}`,
    };
    updateFieldProperty(fieldIndex, { options: [...currentOptions, newOpt] });
  };

  const handleUpdateOption = (fieldIndex: number, optIndex: number, newLabel: string) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const opts = f.options ? [...f.options] : [];
        if (opts[optIndex]) {
          opts[optIndex] = { ...opts[optIndex], label: newLabel };
        }
        return { ...f, options: opts };
      })
    );
  };

  const handleRemoveOption = (fieldIndex: number, optIndex: number) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f;
        const opts = (f.options || []).filter((_, oIdx) => oIdx !== optIndex);
        return { ...f, options: opts };
      })
    );
  };

  const handleSaveForm = async () => {
    if (!title.trim()) {
      toastError("Judul formulir wajib diisi.");
      return;
    }

    // Validate fields have labels
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        toastError(`Pertanyaan ke-${i + 1} belum memiliki judul pertanyaan.`);
        return;
      }
    }

    setSaving(true);
    const ok = await onSave({
      id: formToEdit?.id,
      title: title.trim(),
      description: description.trim(),
      status,
      bannerImageUrl,
      bannerImageTitle,
      fields,
    });
    setSaving(false);

    if (ok) {
      toastSuccess("Formulir pemesanan berhasil disimpan!");
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={formToEdit ? "Edit Formulir Pesanan" : "Buat Formulir Pesanan Baru"}
      onClose={onClose}
      size="xl"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="button" className="btn-primary" onClick={handleSaveForm} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Formulir"}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* HEADER SETTINGS */}
        <div
          style={{
            background: "var(--bg-soft)",
            padding: 16,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Judul Formulir <span style={{ color: "var(--primary-700)" }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Form Pemesanan Kaos MB Chondro"
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Deskripsi / Petunjuk Pengisian
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Berikan instruksi bagi customer yang akan mengisi..."
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Status Formulir:
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
              <input
                type="radio"
                name="form_status"
                checked={status === "aktif"}
                onChange={() => setStatus("aktif")}
              />
              <span style={{ color: "var(--green-700)", fontWeight: 600 }}>Aktif (Menerima Pesanan)</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
              <input
                type="radio"
                name="form_status"
                checked={status === "nonaktif"}
                onChange={() => setStatus("nonaktif")}
              />
              <span style={{ color: "var(--text-muted)" }}>Nonaktif (Ditutup Sementara)</span>
            </label>
          </div>

          {/* OPSI TAMBAH FOTO PANDUAN / KETERANGAN TAMBAHAN FORMULIR */}
          <div
            style={{
              padding: "14px 16px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <ImageIcon size={16} color="var(--primary-700)" />
                  Foto Keterangan Tambahan / Panduan Ukuran & Desain Kaos (Opsional)
                </label>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Admin dapat mengunggah foto size chart (panduan ukuran kaos), mockup desain, atau ketentuan pemesanan agar terlihat jelas oleh pemesan.
                </p>
              </div>

              {!bannerImageUrl && (
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: uploadingImage ? "not-allowed" : "pointer",
                    color: "var(--primary-700)",
                    flexShrink: 0,
                  }}
                >
                  <Upload size={14} />
                  <span>{uploadingImage ? "Memproses..." : "Unggah Foto Keterangan"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleUploadBannerImage(e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>

            {bannerImageUrl && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 10,
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <img
                    src={bannerImageUrl}
                    alt="Pratinjau Keterangan"
                    style={{
                      width: 58,
                      height: 58,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={bannerImageTitle}
                      onChange={(e) => setBannerImageTitle(e.target.value)}
                      placeholder="Judul / Keterangan Foto (mis: Panduan Size Chart & Mockup Kaos)"
                      style={{ fontSize: 12, width: "100%", padding: "4px 8px" }}
                    />
                    <span style={{ fontSize: 11, color: "var(--green-700)", fontWeight: 600, display: "inline-block", marginTop: 4 }}>
                      ✓ Foto siap ditampilkan di bagian atas formulir pemesan
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    <span>Ganti Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleUploadBannerImage(e.target.files[0]);
                          e.target.value = "";
                        }
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setBannerImageUrl("");
                      setBannerImageTitle("");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      background: "#fee2e2",
                      border: "1px solid #fca5a5",
                      color: "#dc2626",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QUESTIONS / FIELDS LIST */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Daftar Pertanyaan Formulir</h4>
              <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Atur pertanyaan yang akan dijawab oleh customer saat memesan
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAddField}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px" }}
            >
              <Plus size={14} />
              <span>Tambah Pertanyaan</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {fields.map((fld, idx) => {
              const hasOptions = ["select", "radio", "checkbox"].includes(fld.fieldType);

              return (
                <div
                  key={fld.id || idx}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: 16,
                    position: "relative",
                  }}
                >
                  {/* Field Header Control */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 10,
                      borderBottom: "1px solid var(--border-soft)",
                      paddingBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          background: "var(--primary-100)",
                          color: "var(--primary-800)",
                          borderRadius: 6,
                          padding: "2px 7px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                        Pertanyaan {idx + 1}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleMoveField(idx, "up")}
                        disabled={idx === 0}
                        title="Geser ke atas"
                        style={{ padding: 4 }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleMoveField(idx, "down")}
                        disabled={idx === fields.length - 1}
                        title="Geser ke bawah"
                        style={{ padding: 4 }}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleRemoveField(idx)}
                        title="Hapus pertanyaan"
                        style={{ padding: 4, color: "var(--danger)" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Field Inputs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        Judul Pertanyaan
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={fld.label}
                        onChange={(e) => updateFieldProperty(idx, { label: e.target.value })}
                        placeholder="Contoh: Ukuran Baju"
                        style={{ width: "100%", marginTop: 4 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        Tipe Input
                      </label>
                      <select
                        className="form-input"
                        value={fld.fieldType}
                        onChange={(e) =>
                          updateFieldProperty(idx, {
                            fieldType: e.target.value as OrderFieldType,
                            options: ["select", "radio", "checkbox"].includes(e.target.value)
                              ? fld.options || [
                                  { id: "1", label: "Opsi 1" },
                                  { id: "2", label: "Opsi 2" },
                                ]
                              : undefined,
                          })
                        }
                        style={{ width: "100%", marginTop: 4 }}
                      >
                        {ORDER_FIELD_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Secondary settings: Description & Required */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginTop: 10 }}>
                    <div>
                      <input
                        type="text"
                        className="form-input"
                        value={fld.description || ""}
                        onChange={(e) => updateFieldProperty(idx, { description: e.target.value })}
                        placeholder="Deskripsi / petunjuk singkat (opsional)"
                        style={{ width: "100%", fontSize: 12 }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(fld.required)}
                          onChange={(e) => updateFieldProperty(idx, { required: e.target.checked })}
                        />
                        <span>Wajib Diisi</span>
                      </label>
                    </div>
                  </div>

                  {/* Options Manager if dropdown/radio/checkbox */}
                  {hasOptions && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: "var(--bg-soft)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          Daftar Pilihan Jawaban:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddOption(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary-700)",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          + Tambah Opsi
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(fld.options || []).map((opt, optIdx) => (
                          <div
                            key={opt.id || `opt-${optIdx}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              background: "#ffffff",
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "1px solid var(--border-soft)",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
                              {optIdx + 1}.
                            </span>
                            <input
                              type="text"
                              className="form-input"
                              value={opt.label}
                              onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                              placeholder={`Pilihan ${optIdx + 1}`}
                              style={{ flex: 1, padding: "5px 8px", fontSize: 12, border: "none", background: "transparent" }}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOption(idx, optIdx);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: (fld.options || []).length > 1 ? "var(--danger)" : "var(--text-muted)",
                                cursor: "pointer",
                                padding: "4px 6px",
                                borderRadius: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: (fld.options || []).length > 1 ? 0.85 : 0.4,
                              }}
                              disabled={(fld.options || []).length <= 1}
                              title={(fld.options || []).length > 1 ? "Hapus pilihan ini" : "Minimal 1 pilihan jawaban"}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FOTO KETERANGAN PERTANYAAN (OPSIONAL) */}
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: fld.imageUrl ? "#ffffff" : "transparent",
                      border: fld.imageUrl ? "1px solid #e2e8f0" : "1px dashed #e2e8f0",
                      borderRadius: 6,
                    }}
                  >
                    {!fld.imageUrl ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                          <Camera size={13} />
                          Lampirkan foto contoh/visual untuk pertanyaan ini (opsional)
                        </span>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            color: "var(--primary-700)",
                          }}
                        >
                          <Upload size={12} />
                          <span>Pilih Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleUploadFieldImage(idx, e.target.files[0]);
                                e.target.value = "";
                              }
                            }}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <img
                            src={fld.imageUrl}
                            alt="Foto Keterangan"
                            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, border: "1px solid #cbd5e1", flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <input
                              type="text"
                              className="form-input"
                              value={fld.imageTitle || ""}
                              onChange={(e) => updateFieldProperty(idx, { imageTitle: e.target.value })}
                              placeholder="Keterangan foto pertanyaan..."
                              style={{ fontSize: 11.5, padding: "3px 6px", width: "100%" }}
                            />
                            <span style={{ fontSize: 10.5, color: "var(--green-700)", fontWeight: 600, marginTop: 2, display: "block" }}>
                              ✓ Foto visual pertanyaan terpasang
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <span>Ganti</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                handleUploadFieldImage(idx, e.target.files[0]);
                                e.target.value = "";
                              }
                            }}
                            style={{ display: "none" }}
                          />
                          </label>
                          <button
                            type="button"
                            onClick={() => updateFieldProperty(idx, { imageUrl: undefined, imageTitle: undefined })}
                            style={{
                              padding: "4px 8px",
                              background: "#fee2e2",
                              border: "1px solid #fca5a5",
                              color: "#dc2626",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
