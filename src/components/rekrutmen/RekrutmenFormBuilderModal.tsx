import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Camera,
  Upload,
} from "lucide-react";
import type {
  RekrutmenField,
  RekrutmenForm,
  RekrutmenFieldType,
  RekrutmenFieldOption,
} from "../../types";
import { Modal } from "../ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { compressImageToFhd } from "../../services/api";

interface RekrutmenFormBuilderModalProps {
  open: boolean;
  onClose: () => void;
  formToEdit?: (RekrutmenForm & { fields?: RekrutmenField[] }) | null;
  onSave: (formData: {
    id?: string;
    title: string;
    description: string;
    status: "dibuka" | "ditutup";
    fields: RekrutmenField[];
  }) => Promise<boolean>;
}

const REKRUTMEN_FIELD_TYPE_OPTIONS: { value: RekrutmenFieldType; label: string; desc: string }[] = [
  { value: "text", label: "Jawaban Singkat (Teks)", desc: "Satu baris teks pendek (misal: Nama, Asal)" },
  { value: "textarea", label: "Paragraf (Teks Panjang)", desc: "Teks panjang (misal: Pengalaman, Alasan)" },
  { value: "number", label: "Angka (Number)", desc: "Input numerik (misal: No. WA, Usia, NISN)" },
  { value: "date", label: "Tanggal (Date)", desc: "Pemilih tanggal (misal: Tanggal Lahir)" },
  { value: "select", label: "Dropdown Pilihan", desc: "Pilihan menu tarik turun" },
  { value: "radio", label: "Pilihan Tunggal (Radio)", desc: "Pilih salah satu opsi" },
  { value: "checkbox", label: "Pilihan Ganda (Checkbox)", desc: "Dapat mencentang beberapa opsi" },
  { value: "image", label: "Upload Pas Foto", desc: "Upload berkas pas foto calon anggota" },
  { value: "file", label: "Upload Dokumen / Berkas", desc: "Upload dokumen (PDF, Formulir, Surat Izin)" },
];

function getDefaultRekrutmenFields(): RekrutmenField[] {
  return [
    {
      id: "fld-nama-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Nama Lengkap Calon Anggota",
      description: "Sesuai kartu identitas atau ijazah terakhir",
      fieldType: "text",
      required: true,
      sortOrder: 0,
      placeholder: "Contoh: Muhammad Bintang",
      options: [],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "fld-panggilan-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Nama Panggilan",
      description: "Nama akrab sehari-hari",
      fieldType: "text",
      required: true,
      sortOrder: 1,
      placeholder: "Contoh: Bintang",
      options: [],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "fld-wa-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Nomor WhatsApp Calon Anggota",
      description: "Pastikan nomor aktif dan terhubung dengan WhatsApp",
      fieldType: "number",
      required: true,
      sortOrder: 2,
      placeholder: "081234567890",
      options: [],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "fld-posisi-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Pilihan Alat / Seksi Marching Band",
      description: "Pilih seksi atau instrumen utama yang diminati",
      fieldType: "select",
      required: true,
      sortOrder: 3,
      options: [
        { value: "Brass / Terompet", label: "Brass / Terompet" },
        { value: "Battery / Percussion", label: "Battery / Percussion (Snare, Bass, Quard)" },
        { value: "Pit Instrument", label: "Pit Instrument (Marimba, Vibraphone, Xylophone)" },
        { value: "Color Guard (CG)", label: "Color Guard (Bendera & Rifle)" },
        { value: "Field Commander / Drum Major", label: "Field Commander / Drum Major" },
      ],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "fld-foto-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Pas Foto Calon Anggota",
      description: "Upload pas foto formal atau semi-formal berpakaian rapi",
      fieldType: "image",
      required: true,
      sortOrder: 4,
      options: [],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "fld-alasan-" + Math.random().toString(36).slice(2, 7),
      formId: "",
      label: "Alasan & Motivasi Bergabung",
      description: "Ceritakan alasan ingin bergabung dengan MB Chondro Dimuko",
      fieldType: "textarea",
      required: false,
      sortOrder: 5,
      placeholder: "Tuliskan motivasi Anda...",
      options: [],
      createdAt: "",
      updatedAt: "",
    },
  ];
}

export function RekrutmenFormBuilderModal({
  open,
  onClose,
  formToEdit,
  onSave,
}: RekrutmenFormBuilderModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();

  const [title, setTitle] = useState(
    formToEdit?.title || "Pendaftaran Anggota Baru MB Chondro Dimuko " + new Date().getFullYear()
  );
  const [description, setDescription] = useState(
    formToEdit?.description ||
      "Silakan isi formulir pendaftaran ini dengan data yang lengkap dan valid. Data yang dikirimkan akan digunakan dalam tahap seleksi calon anggota."
  );
  const [status, setStatus] = useState<"dibuka" | "ditutup">(formToEdit?.status || "dibuka");
  const [fields, setFields] = useState<RekrutmenField[]>(() => {
    if (formToEdit?.fields && formToEdit.fields.length > 0) {
      return JSON.parse(JSON.stringify(formToEdit.fields));
    }
    return getDefaultRekrutmenFields();
  });
  const [saving, setSaving] = useState(false);

  // Sync state whenever modal is opened or formToEdit changes
  useEffect(() => {
    if (open) {
      if (formToEdit) {
        setTitle(formToEdit.title || "");
        setDescription(formToEdit.description || "");
        setStatus(formToEdit.status || "dibuka");
        if (formToEdit.fields && formToEdit.fields.length > 0) {
          setFields(JSON.parse(JSON.stringify(formToEdit.fields)));
        } else {
          setFields(getDefaultRekrutmenFields());
        }
      } else {
        setTitle("Pendaftaran Anggota Baru MB Chondro Dimuko " + new Date().getFullYear());
        setDescription(
          "Silakan isi formulir pendaftaran ini dengan data yang lengkap dan valid. Data yang dikirimkan akan digunakan dalam tahap seleksi calon anggota."
        );
        setStatus("dibuka");
        setFields(getDefaultRekrutmenFields());
      }
    }
  }, [open, formToEdit]);

  const handleAddField = () => {
    const newField: RekrutmenField = {
      id: "fld-" + Math.random().toString(36).slice(2, 8),
      formId: formToEdit?.id || "",
      label: "Pertanyaan Baru",
      description: "",
      fieldType: "text",
      required: false,
      sortOrder: fields.length,
      placeholder: "",
      options: [],
      createdAt: "",
      updatedAt: "",
    };
    setFields((prev) => [...prev, newField]);
  };

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) {
      toastError("Minimal harus ada 1 pertanyaan pada formulir pendaftaran.");
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

  const updateFieldProperty = (index: number, updates: Partial<RekrutmenField>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
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
        exampleImageUrl: base64,
        exampleImageTitle: fields[fieldIndex].exampleImageTitle || `Contoh: ${fields[fieldIndex].label}`,
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
    const newOpt: RekrutmenFieldOption = {
      value: `Opsi ${nextOptNum}`,
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
          opts[optIndex] = { value: newLabel, label: newLabel };
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
      toastError("Nama / Judul formulir pendaftaran wajib diisi.");
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
      fields,
    });
    setSaving(false);

    if (ok) {
      toastSuccess("Formulir pendaftaran berhasil disimpan!");
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={formToEdit ? "Edit Formulir Pendaftaran" : "Buat Formulir Pendaftaran Baru"}
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
              Judul Formulir Pendaftaran <span style={{ color: "var(--primary-700)" }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pendaftaran Calon Anggota Baru MB Chondro Dimuko 2026"
              style={{ width: "100%", marginTop: 5, borderRadius: 10 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Deskripsi / Petunjuk Pengisian Formulir
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Berikan instruksi bagi calon pendaftar yang akan mengisi data..."
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
                onClick={() => setStatus("dibuka")}
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
                  background: status === "dibuka" ? "#ffffff" : "transparent",
                  color: status === "dibuka" ? "var(--green-700, #15803d)" : "var(--text-muted, #64748b)",
                  boxShadow: status === "dibuka" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: status === "dibuka" ? "var(--green-600, #16a34a)" : "var(--text-muted, #94a3b8)",
                  }}
                />
                <span>Dibuka (Menerima Pendaftar Baru)</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus("ditutup")}
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
                  background: status === "ditutup" ? "#ffffff" : "transparent",
                  color: status === "ditutup" ? "var(--text, #334155)" : "var(--text-muted, #64748b)",
                  boxShadow: status === "ditutup" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: status === "ditutup" ? "var(--danger, #ef4444)" : "var(--text-muted, #94a3b8)",
                  }}
                />
                <span>Ditutup (Pendaftaran Dinonaktifkan)</span>
              </button>
            </div>
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
                Atur butir data dan pertanyaan yang wajib diisi calon anggota
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
                        placeholder="Contoh: Nama Lengkap / Pilihan Instrumen"
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
                        onChange={(e) => {
                          const newType = e.target.value as RekrutmenFieldType;
                          const needsOpts = ["select", "radio", "checkbox"].includes(newType);
                          updateFieldProperty(idx, {
                            fieldType: newType,
                            options: needsOpts
                              ? fld.options && fld.options.length > 0
                                ? fld.options
                                : [
                                    { value: "Opsi 1", label: "Opsi 1" },
                                    { value: "Opsi 2", label: "Opsi 2" },
                                  ]
                              : [],
                          });
                        }}
                        style={{ width: "100%", marginTop: 4, borderRadius: 10 }}
                      >
                        {REKRUTMEN_FIELD_TYPE_OPTIONS.map((opt) => (
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
                      <input
                        type="text"
                        className="form-input"
                        value={fld.description || ""}
                        onChange={(e) => updateFieldProperty(idx, { description: e.target.value })}
                        placeholder="Deskripsi / petunjuk pengisian singkat (opsional)"
                        style={{ width: "100%", fontSize: 12, borderRadius: 10 }}
                      />
                    </div>

                    <div>
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
                            key={`opt-${optIdx}`}
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

                  {/* FOTO KETERANGAN PERTANYAAN (OPSIONAL) */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 14px",
                      background: fld.exampleImageUrl ? "var(--bg-soft, #f8fafc)" : "transparent",
                      border: fld.exampleImageUrl ? "1px solid var(--border-soft, #e2e8f0)" : "1px dashed var(--border-soft, #cbd5e1)",
                      borderRadius: "var(--radius-md, 12px)",
                    }}
                  >
                    {!fld.exampleImageUrl ? (
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
                            cursor: "pointer",
                            borderRadius: 8,
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <img
                            src={fld.exampleImageUrl}
                            alt="Foto Keterangan"
                            style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8, border: "1px solid #cbd5e1", flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <input
                              type="text"
                              className="form-input"
                              value={fld.exampleImageTitle || ""}
                              onChange={(e) => updateFieldProperty(idx, { exampleImageTitle: e.target.value })}
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
                              cursor: "pointer",
                              borderRadius: 8,
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
                            className="btn btn-ghost btn-sm"
                            onClick={() => updateFieldProperty(idx, { exampleImageUrl: undefined, exampleImageTitle: undefined })}
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
