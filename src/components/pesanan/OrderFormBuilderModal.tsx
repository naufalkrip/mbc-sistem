import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  Layers,
} from "lucide-react";
import type { OrderField, OrderForm, OrderFieldType, OrderFieldOption } from "../../types";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { uploadOrderImageItem } from "../../services/api";
import { parseVariantConfig, serializeVariantConfig, formatRupiah, formatDirectImageUrl, handleImageLoadError } from "../../utils/format";

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
  { value: "variant_matrix", label: "Varian Pesanan (Ukuran, Lengan, & Jumlah)", desc: "Kotak dinamis: Ukuran (dropdown), Lengan, dan Jumlah yang bisa ditambah customer" },
  { value: "product_configuration", label: "Konfigurasi Produk Pesanan", desc: "Konfigurasi khusus untuk Size, Lengan, Jumlah & Harga terintegrasi" },
  { value: "date", label: "Tanggal", desc: "Pemilih tanggal" },
  { value: "file", label: "Upload File / Referensi", desc: "Upload dokumen referensi (PDF/DOC)" },
  { value: "image", label: "Upload Foto / Gambar", desc: "Unggah file berupa foto (JPG/PNG)" },
  { value: "info_text", label: "Blok Informasi Khusus", desc: "Tampilkan teks / informasi penting tanpa perlu input dari customer" },
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
      label: "Rincian Ukuran, Lengan & Jumlah",
      description: "Pilih ukuran, jenis lengan, dan jumlah pesanan. Klik + Tambah Varian jika memesan lebih dari satu ukuran.",
      fieldType: "variant_matrix",
      required: true,
      sortOrder: 3,
      price: 85000,
      longSleeveExtra: 0,
      options: [
        { id: "opt-s", label: "S" },
        { id: "opt-m", label: "M" },
        { id: "opt-l", label: "L" },
        { id: "opt-xl", label: "XL" },
        { id: "opt-xxl", label: "XXL" },
        { id: "opt-3xl", label: "3XL" },
      ],
      placeholder: serializeVariantConfig({
        price: 85000,
        longSleeveExtra: 0,
        prices: {},
        sleeves: ["Lengan Pendek", "Lengan Panjang"],
      }),
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
  const [uploadingFieldImages, setUploadingFieldImages] = useState<Record<number, boolean>>({});
  // isDirty: mencegah polling server menimpa gambar yang baru diupload (belum disimpan)
  const isDirty = useRef(false);

  // Sync state whenever modal is opened or formToEdit changes
  // Jika isDirty=true (ada perubahan lokal belum disimpan), abaikan sync dari polling server
  useEffect(() => {
    if (open) {
      if (!isDirty.current) {
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
    } else {
      // Reset dirty flag saat modal ditutup
      isDirty.current = false;
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
      const res = await uploadOrderImageItem(file);
      if (res.success && res.data?.url) {
        isDirty.current = true;
        setBannerImageUrl(res.data.url);
        if (!bannerImageTitle) {
          setBannerImageTitle("Panduan Desain / Ukuran Kaos MB Chondro");
        }
        toastSuccess("Foto keterangan berhasil dimuat!");
      } else {
        toastError(res.message || "Gagal mengunggah foto.");
      }
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
      setUploadingFieldImages((prev) => ({ ...prev, [fieldIndex]: true }));
      const res = await uploadOrderImageItem(file);
      if (res.success && res.data?.url) {
        isDirty.current = true;
        updateFieldProperty(fieldIndex, {
          imageUrl: res.data.url,
          imageTitle: fields[fieldIndex].imageTitle || `Contoh: ${fields[fieldIndex].label}`,
        });
        toastSuccess("Foto keterangan pertanyaan berhasil dimuat!");
      } else {
        toastError(res.message || "Gagal mengunggah foto keterangan.");
      }
    } catch {
      toastError("Gagal memproses gambar pertanyaan.");
    } finally {
      setUploadingFieldImages((prev) => ({ ...prev, [fieldIndex]: false }));
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
    const preparedFields = fields.map((fld) => {
      if (fld.fieldType === "variant_matrix" || fld.fieldType === "product_configuration") {
        const cfg = parseVariantConfig(fld);
        return {
          ...fld,
          price: cfg.price,
          longSleeveExtra: cfg.longSleeveExtra,
          placeholder: serializeVariantConfig(cfg),
        };
      }
      return fld;
    });

    const ok = await onSave({
      id: formToEdit?.id,
      title: title.trim(),
      description: description.trim(),
      status,
      bannerImageUrl,
      bannerImageTitle,
      fields: preparedFields,
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
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSaveForm} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Formulir"}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* HEADER SETTINGS */}
        <div
          style={{
            background: "#ffffff",
            padding: "20px 22px",
            borderRadius: "var(--radius-lg, 16px)",
            border: "1px solid var(--border-soft, #e2e8f0)",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
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
              style={{ width: "100%", marginTop: 5, borderRadius: 10 }}
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
              style={{ width: "100%", marginTop: 5, borderRadius: 10 }}
            />
          </div>

          {/* STATUS FORMULIR SEGMENTED SWITCH */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 }}>
              Status Formulir:
            </label>
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg-soft, #f1f5f9)",
                padding: 4,
                borderRadius: 12,
                gap: 4,
                border: "1px solid var(--border-soft, #e2e8f0)",
              }}
            >
              <button
                type="button"
                onClick={() => setStatus("aktif")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 16px",
                  borderRadius: 9,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: status === "aktif" ? "#ffffff" : "transparent",
                  color: status === "aktif" ? "var(--green-700, #15803d)" : "var(--text-muted, #64748b)",
                  boxShadow: status === "aktif" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: status === "aktif" ? "var(--green-600, #16a34a)" : "var(--text-muted, #94a3b8)",
                  }}
                />
                <span>Aktif (Menerima Pesanan)</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("nonaktif")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 16px",
                  borderRadius: 9,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: status === "nonaktif" ? "#ffffff" : "transparent",
                  color: status === "nonaktif" ? "var(--text, #334155)" : "var(--text-muted, #64748b)",
                  boxShadow: status === "nonaktif" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: status === "nonaktif" ? "var(--danger, #ef4444)" : "var(--text-muted, #94a3b8)",
                  }}
                />
                <span>Nonaktif (Ditutup Sementara)</span>
              </button>
            </div>
          </div>

          {/* OPSI TAMBAH FOTO PANDUAN / KETERANGAN TAMBAHAN FORMULIR */}
          <div
            style={{
              padding: "16px 18px",
              background: "var(--bg-soft, #f8fafc)",
              border: "1px dashed var(--border-soft, #cbd5e1)",
              borderRadius: "var(--radius-md, 14px)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <ImageIcon size={16} color="var(--primary-700)" />
                  Foto Keterangan Tambahan / Panduan Ukuran & Desain Kaos (Opsional)
                </label>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
                  Admin dapat mengunggah foto size chart (panduan ukuran kaos), mockup desain, atau ketentuan pemesanan agar terlihat jelas oleh pemesan.
                </p>
              </div>

              {!bannerImageUrl && (
                <label
                  className="btn btn-outline btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 10,
                    cursor: uploadingImage ? "not-allowed" : "pointer",
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
                  gap: 14,
                  padding: "12px 14px",
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid var(--border-soft, #e2e8f0)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                  <img
                    src={formatDirectImageUrl(bannerImageUrl)}
                    alt="Pratinjau Keterangan"
                    referrerPolicy="no-referrer"
                    onError={handleImageLoadError}
                    style={{
                      width: 58,
                      height: 58,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--border-soft, #cbd5e1)",
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
                      style={{ fontSize: 12.5, width: "100%", padding: "5px 10px", borderRadius: 8 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--green-700)", fontWeight: 600, display: "inline-block", marginTop: 4 }}>
                      ✓ Foto siap ditampilkan di bagian atas formulir pemesan
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <label
                    className="btn btn-outline btn-sm"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 12px",
                      borderRadius: 8,
                      cursor: uploadingImage ? "not-allowed" : "pointer",
                    }}
                  >
                    <span>{uploadingImage ? "Memproses..." : "Ganti Foto"}</span>
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setBannerImageUrl("");
                      setBannerImageTitle("");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 8,
                      color: "var(--danger)",
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
              marginBottom: 14,
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
              className="btn btn-primary btn-sm"
              onClick={handleAddField}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "7px 16px", borderRadius: 10 }}
            >
              <Plus size={15} />
              <span>Tambah Pertanyaan</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fields.map((fld, idx) => {
              const hasOptions = ["select", "radio", "checkbox"].includes(fld.fieldType);
              const isVariantMatrix = fld.fieldType === "variant_matrix" || fld.fieldType === "product_configuration";

              return (
                <div
                  key={fld.id || idx}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-soft, #e2e8f0)",
                    borderRadius: "var(--radius-lg, 16px)",
                    padding: "18px 20px",
                    position: "relative",
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
                    transition: "box-shadow 0.15s ease",
                  }}
                >
                  {/* Field Header Control */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 14,
                      borderBottom: "1px solid var(--border-soft, #f1f5f9)",
                      paddingBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          background: "rgba(185, 28, 28, 0.08)",
                          color: "var(--primary-700, #b91c1c)",
                          borderRadius: 20,
                          padding: "3px 10px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                        Pertanyaan {idx + 1}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => handleMoveField(idx, "up")}
                        disabled={idx === 0}
                        title="Geser ke atas"
                        style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => handleMoveField(idx, "down")}
                        disabled={idx === fields.length - 1}
                        title="Geser ke bawah"
                        style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => handleRemoveField(idx)}
                        title="Hapus pertanyaan"
                        style={{ width: 30, height: 30, padding: 0, borderRadius: 8, color: "var(--danger)" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Field Inputs */}
                  <div className="builder-field-grid">
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
                        style={{ width: "100%", marginTop: 4, borderRadius: 10 }}
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
                            options: ["select", "radio", "checkbox", "variant_matrix", "product_configuration"].includes(e.target.value)
                              ? fld.options && fld.options.length > 0
                                ? fld.options
                                : e.target.value === "variant_matrix" || e.target.value === "product_configuration"
                                ? [
                                    { id: "opt-s", label: "S" },
                                    { id: "opt-m", label: "M" },
                                    { id: "opt-l", label: "L" },
                                    { id: "opt-xl", label: "XL" },
                                    { id: "opt-xxl", label: "XXL" },
                                    { id: "opt-3xl", label: "3XL" },
                                  ]
                                : [
                                    { id: "1", label: "Opsi 1" },
                                    { id: "2", label: "Opsi 2" },
                                  ]
                              : undefined,
                            placeholder:
                              e.target.value === "variant_matrix" || e.target.value === "product_configuration"
                                ? fld.placeholder || "Lengan Pendek, Lengan Panjang"
                                : fld.placeholder,
                          })
                        }
                        style={{ width: "100%", marginTop: 4, borderRadius: 10 }}
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
                  <div className="builder-secondary-grid">
                    <div>
                      {fld.fieldType === "info_text" ? (
                        <textarea
                          className="form-input"
                          value={fld.description || ""}
                          onChange={(e) => updateFieldProperty(idx, { description: e.target.value })}
                          placeholder="Isi informasi atau instruksi yang ingin disampaikan kepada customer..."
                          style={{ width: "100%", fontSize: 13, borderRadius: 10, minHeight: 80, resize: "vertical" }}
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          value={fld.description || ""}
                          onChange={(e) => updateFieldProperty(idx, { description: e.target.value })}
                          placeholder="Deskripsi / petunjuk singkat (opsional)"
                          style={{ width: "100%", fontSize: 12, borderRadius: 10 }}
                        />
                      )}
                    </div>

                    <div>
                      {fld.fieldType !== "info_text" && (
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "7px 14px",
                            borderRadius: 9,
                            background: fld.required ? "rgba(185, 28, 28, 0.06)" : "var(--bg-soft, #f8fafc)",
                            color: fld.required ? "var(--primary-700)" : "var(--text-secondary)",
                            border: fld.required ? "1px solid rgba(185, 28, 28, 0.2)" : "1px solid var(--border-soft)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(fld.required)}
                            onChange={(e) => updateFieldProperty(idx, { required: e.target.checked })}
                            style={{ cursor: "pointer" }}
                          />
                          <span>Wajib Diisi</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Options Manager if dropdown/radio/checkbox */}
                  {hasOptions && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "14px 16px",
                        background: "var(--bg-soft, #f8fafc)",
                        borderRadius: "var(--radius-md, 12px)",
                        border: "1px solid var(--border-soft, #e2e8f0)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                          Daftar Pilihan Jawaban:
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleAddOption(idx)}
                          style={{ padding: "3px 10px", fontSize: 11.5, borderRadius: 8 }}
                        >
                          <Plus size={13} />
                          <span>Tambah Opsi</span>
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
                              padding: "5px 10px",
                              borderRadius: 10,
                              border: "1px solid var(--border-soft, #e2e8f0)",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, minWidth: 20 }}>
                              {optIdx + 1}.
                            </span>
                            <input
                              type="text"
                              className="form-input"
                              value={opt.label}
                              onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                              placeholder={`Pilihan ${optIdx + 1}`}
                              style={{ flex: 1, padding: "5px 8px", fontSize: 12.5, border: "none", background: "transparent" }}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOption(idx, optIdx);
                              }}
                              className="btn btn-ghost btn-sm btn-icon"
                              style={{
                                width: 26,
                                height: 26,
                                padding: 0,
                                borderRadius: 6,
                                color: (fld.options || []).length > 1 ? "var(--danger)" : "var(--text-muted)",
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

                  {/* Settings for Variant Matrix (Ukuran, Lengan, Jumlah & Harga) */}
                  {isVariantMatrix && (() => {
                    const variantCfg = parseVariantConfig(fld);

                    return (
                      <div
                        style={{
                          marginTop: 14,
                          padding: "16px 18px",
                          background: "linear-gradient(180deg, #fef2f2 0%, #fff7f7 100%)",
                          borderRadius: "var(--radius-md, 12px)",
                          border: "1.5px solid #fecaca",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <Layers size={17} style={{ color: "var(--primary-700, #b91c1c)" }} />
                          <strong style={{ fontSize: 13, color: "var(--navy-900)" }}>
                            Pengaturan Kotak Varian & Fitur Harga Otomatis
                          </strong>
                        </div>

                        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                          Pertanyaan ini memadukan pilihan <strong>Ukuran</strong>, <strong>Lengan</strong>, dan <strong>Jumlah (pcs)</strong> dalam 1 kotak. Saat customer mengisi jumlah pesanan, <strong>total harga otomatis muncul dan terhitung secara real-time</strong>.
                        </p>

                        {/* 1. Pengaturan Pilihan Ukuran */}
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy-900)" }}>
                              1. Pilihan Ukuran (Dropdown):
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => handleAddOption(idx)}
                              style={{ padding: "3px 10px", fontSize: 11.5, borderRadius: 8 }}
                            >
                              <Plus size={13} />
                              <span>Tambah Ukuran</span>
                            </button>
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                            {(fld.options || []).map((opt, optIdx) => (
                              <div
                                key={opt.id || `opt-${optIdx}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "#ffffff",
                                  padding: "4px 8px 4px 10px",
                                  borderRadius: 8,
                                  border: "1px solid #cbd5e1",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                }}
                              >
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                                  placeholder="Ukuran"
                                  style={{
                                    width: 52,
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    textAlign: "center",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(idx, optIdx)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: (fld.options || []).length > 1 ? "#dc2626" : "#cbd5e1",
                                    cursor: (fld.options || []).length > 1 ? "pointer" : "not-allowed",
                                    padding: 2,
                                    display: "flex",
                                  }}
                                  disabled={(fld.options || []).length <= 1}
                                  title="Hapus ukuran"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Preset Ukuran Cepat */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>Preset cepat:</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                updateFieldProperty(idx, {
                                  options: ["S", "M", "L", "XL", "XXL", "3XL"].map((sz, i) => ({
                                    id: `opt-${i + 1}`,
                                    label: sz,
                                  })),
                                })
                              }
                              style={{ fontSize: 11, padding: "2px 8px", background: "#ffffff", border: "1px solid #cbd5e1" }}
                            >
                              Dewasa (S - 3XL)
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                updateFieldProperty(idx, {
                                  options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"].map((sz, i) => ({
                                    id: `opt-${i + 1}`,
                                    label: sz,
                                  })),
                                })
                              }
                              style={{ fontSize: 11, padding: "2px 8px", background: "#ffffff", border: "1px solid #cbd5e1" }}
                            >
                              Lengkap (XS - 5XL)
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                updateFieldProperty(idx, {
                                  options: ["No. 2", "No. 4", "No. 6", "No. 8", "No. 10", "No. 12"].map((sz, i) => ({
                                    id: `opt-${i + 1}`,
                                    label: sz,
                                  })),
                                })
                              }
                              style={{ fontSize: 11, padding: "2px 8px", background: "#ffffff", border: "1px solid #cbd5e1" }}
                            >
                              Anak (No. 2 - 12)
                            </button>
                          </div>
                        </div>

                        {/* 2. Pengaturan Pilihan Lengan */}
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy-900)", display: "block", marginBottom: 4 }}>
                            2. Pilihan Lengan (Dipisahkan koma):
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={variantCfg.sleeves.join(", ")}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const slv = raw.split(",").map((s) => s.trim()).filter(Boolean);
                              const updatedCfg = {
                                ...variantCfg,
                                sleeves: slv.length > 0 ? slv : ["Lengan Pendek", "Lengan Panjang"],
                              };
                              updateFieldProperty(idx, {
                                placeholder: serializeVariantConfig(updatedCfg),
                              });
                            }}
                            placeholder="Contoh: Lengan Pendek, Lengan Panjang"
                            style={{ width: "100%", fontSize: 13, background: "#ffffff", borderRadius: 8 }}
                          />
                          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 4 }}>
                            Teks opsi pilihan jenis lengan untuk dropdown customer (pisahkan dengan koma).
                          </span>
                        </div>

                        {/* 3. Pengaturan Harga Satuan & Kalkulasi Otomatis */}
                        <div
                          style={{
                            padding: "14px 16px",
                            background: "#ffffff",
                            borderRadius: 10,
                            border: "1px solid #fca5a5",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                          }}
                        >
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy-900)", display: "block", marginBottom: 4 }}>
                            3. Atur Harga Berdasarkan Variasi (Matrix Harga):
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 14 }}>
                            Setiap kombinasi size dan variasi memiliki harga yang dapat diatur secara terpisah.
                          </span>

                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, textAlign: "left" }}>Size / Variasi</th>
                                  {variantCfg.sleeves.map((sleeve) => (
                                    <th key={sleeve} style={{ padding: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, textAlign: "center" }}>{sleeve}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(fld.options && fld.options.length > 0 ? fld.options : [{ id: 'opt-dummy', label: 'Size' }]).map((opt) => (
                                  <tr key={opt.id}>
                                    <td style={{ padding: "8px", border: "1px solid #cbd5e1", fontSize: 12, fontWeight: 600 }}>{opt.label}</td>
                                    {variantCfg.sleeves.map((sleeve) => {
                                      const key = `${opt.label}|${sleeve}`;
                                      const val = variantCfg.prices[key] || 0;
                                      return (
                                        <td key={sleeve} style={{ padding: "8px", border: "1px solid #cbd5e1", textAlign: "center" }}>
                                          <input
                                            type="number"
                                            className="form-input"
                                            min={0}
                                            step={1000}
                                            value={val}
                                            onChange={(e) => {
                                              const newPrice = Math.max(0, parseInt(e.target.value, 10) || 0);
                                              const updatedPrices = { ...variantCfg.prices, [key]: newPrice };
                                              const updatedCfg = { ...variantCfg, prices: updatedPrices };
                                              updateFieldProperty(idx, {
                                                placeholder: serializeVariantConfig(updatedCfg),
                                              });
                                            }}
                                            placeholder="0"
                                            style={{ width: "100%", minWidth: 100, fontSize: 13, borderRadius: 6, textAlign: "center" }}
                                          />
                                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                                            {formatRupiah(val)}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div
                            style={{
                              padding: "9px 12px",
                              background: "rgba(185, 28, 28, 0.05)",
                              borderRadius: 8,
                              border: "1px dashed rgba(185, 28, 28, 0.25)",
                              fontSize: "12px",
                              color: "var(--primary-700, #b91c1c)",
                              lineHeight: 1.5,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginTop: 14
                            }}
                          >
                            <span style={{ fontSize: 16 }}>⚡</span>
                            <span>
                              <strong>Fitur Otomatisasi:</strong> Harga final akan diambil secara langsung berdasarkan kombinasi spesifik (bukan dihitung otomatis sebagai harga dasar + harga lengan).
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* FOTO KETERANGAN PERTANYAAN (OPSIONAL) */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 14px",
                      background: fld.imageUrl ? "var(--bg-soft, #f8fafc)" : "transparent",
                      border: fld.imageUrl ? "1px solid var(--border-soft, #e2e8f0)" : "1px dashed var(--border-soft, #cbd5e1)",
                      borderRadius: "var(--radius-md, 12px)",
                    }}
                  >
                    {!fld.imageUrl ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Camera size={14} />
                          Lampirkan foto contoh / visual untuk pertanyaan ini (opsional)
                        </span>
                        <label
                          className="btn btn-outline btn-sm"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            fontSize: 11.5,
                            cursor: uploadingFieldImages[idx] ? "not-allowed" : "pointer",
                            borderRadius: 8,
                          }}
                        >
                          <Upload size={12} />
                          <span>{uploadingFieldImages[idx] ? "Memproses..." : "Pilih Foto"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingFieldImages[idx]}
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <img
                            src={fld.imageUrl}
                            alt="Foto Keterangan"
                            style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8, border: "1px solid #cbd5e1", flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <input
                              type="text"
                              className="form-input"
                              value={fld.imageTitle || ""}
                              onChange={(e) => updateFieldProperty(idx, { imageTitle: e.target.value })}
                              placeholder="Keterangan foto pertanyaan..."
                              style={{ fontSize: 12, padding: "4px 8px", width: "100%", borderRadius: 8 }}
                            />
                            <span style={{ fontSize: 11, color: "var(--green-700)", fontWeight: 600, marginTop: 3, display: "block" }}>
                              ✓ Foto visual pertanyaan terpasang
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <label
                            className="btn btn-outline btn-sm"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 10px",
                              fontSize: 11.5,
                              cursor: uploadingFieldImages[idx] ? "not-allowed" : "pointer",
                              borderRadius: 8,
                            }}
                          >
                            <span>{uploadingFieldImages[idx] ? "Memproses..." : "Ganti"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingFieldImages[idx]}
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
                            className="btn btn-ghost btn-sm"
                            onClick={() => updateFieldProperty(idx, { imageUrl: undefined, imageTitle: undefined })}
                            style={{
                              padding: "4px 10px",
                              fontSize: 11.5,
                              borderRadius: 8,
                              color: "var(--danger)",
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
