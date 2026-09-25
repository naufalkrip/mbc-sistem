import type { JenisTransaksi, StatusAnggota, StatusKehadiran, WaktuAbsensi } from "../config";

export type { JenisTransaksi, StatusAnggota, StatusKehadiran, WaktuAbsensi };

export interface Anggota {
  id: string;
  nama: string;
  namaPanggilan?: string;
  divisi: string;
  jabatan: string;
  noHp: string;
  status: StatusAnggota;
  tanggalBergabung: string;
  keterangan: string;
  foto?: string;
}

export interface Absensi {
  id: string;
  idAnggota: string;
  nama: string;
  tanggal: string;
  kegiatan: string;
  status: StatusKehadiran;
  keterangan: string;
  waktu: WaktuAbsensi;
}

/** Satu sesi absensi = kombinasi tanggal + kegiatan + waktu yang berisi beberapa anggota */
export interface SesiAbsensi {
  key: string;
  tanggal: string;
  kegiatan: string;
  waktu: WaktuAbsensi;
  daftar: Absensi[];
  jumlahAnggota: number;
}

export interface Transaksi {
  id: string;
  tanggal: string;
  jenis: JenisTransaksi;
  kategori: string;
  keterangan: string;
  nominal: number;
  penanggungJawab: string;
}

export interface StatKehadiran {
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpa: number;
  total: number;
  persentase: number;
}

export interface RekapAbsensi {
  idAnggota: string;
  nama: string;
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpa: number;
  total: number;
  persentase: number;
}

export interface TransaksiGroup {
  id: string;
  judul: string;
  tanggal: string;
  keterangan: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransaksiDetail {
  id: string;
  transaksiGroupId: string;
  tanggal: string;
  jenis: JenisTransaksi;
  kategori: string;
  nominal: number;
  keterangan: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransaksiGroupWithStats extends TransaksiGroup {
  totalTransaksi: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  saldo: number;
}

// ============================================================
// REKRUITMEN TYPES
// ============================================================

export type RekrutmenFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "image";

export interface RekrutmenFieldOption {
  value: string;
  label: string;
}

export interface RekrutmenField {
  id: string;
  formId: string;
  label: string;
  description: string;
  fieldType: RekrutmenFieldType;
  placeholder?: string;
  required: boolean;
  options: RekrutmenFieldOption[];
  sortOrder: number;
  exampleImageUrl?: string;
  exampleImageTitle?: string;
  maxFileSize?: number; // in MB (e.g. 2 for 2MB, 5 for 5MB)
  allowedFileTypes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RekrutmenForm {
  id: string;
  title: string;
  description: string;
  status: "dibuka" | "ditutup";
  createdAt: string;
  updatedAt: string;
}

export type RekrutmenSubmissionStatus = "menunggu" | "lolos" | "cadangan" | "tidak_lolos";

export interface RekrutmenSubmission {
  id: string;
  formId: string;
  status: RekrutmenSubmissionStatus;
  adminNote: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface RekrutmenAnswer {
  id: string;
  submissionId: string;
  fieldId: string;
  value: string;
  fileUrl: string | null;
  fileBase64?: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface RekrutmenFormWithFields extends RekrutmenForm {
  fields: RekrutmenField[];
}

export interface RekrutmenSubmissionWithAnswers extends RekrutmenSubmission {
  answers: (RekrutmenAnswer & { field: RekrutmenField })[];
  form: RekrutmenForm;
}

export interface RekrutmenStats {
  total: number;
  menunggu: number;
  lolos: number;
  cadangan: number;
  tidakLolos: number;
}

export interface DashboardData {
  anggota: {
    total: number;
    aktif: number;
    cuti: number;
    tidakAktif: number;
  };
  absensi: {
    hadir: number;
    izin: number;
    sakit: number;
    cuti: number;
    alpa: number;
    total: number;
    persentase: number;
  };
  keuanganChondro: {
    pemasukan: number;
    pengeluaran: number;
    saldo: number;
  };
  keuanganMedia: {
    pemasukan: number;
    pengeluaran: number;
    saldo: number;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface User {
  id: string;
  username: string;
  nama: string;
  role: "admin" | "operator" | string;
  status: "Aktif" | "Tidak Aktif" | string;
  token?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

// ============================================================
// KELOLA PESANAN (ORDERS & ORDER FORMS)
// ============================================================

export type OrderFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "whatsapp"
  | "file";

export interface OrderFieldOption {
  id: string;
  label: string;
}

export interface OrderField {
  id: string;
  formId: string;
  label: string;
  description?: string;
  fieldType: OrderFieldType;
  placeholder?: string;
  required: boolean;
  options?: OrderFieldOption[];
  sortOrder: number;
  imageUrl?: string;
  imageTitle?: string;
  maxFileSize?: number; // MB
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderForm {
  id: string;
  title: string;
  description: string;
  status: "aktif" | "nonaktif";
  publicLink?: string;
  bannerImageUrl?: string;
  bannerImageTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderFormWithFields extends OrderForm {
  fields: OrderField[];
}

export type OrderStatus = "masuk" | "diproses" | "selesai";

export interface OrderAnswer {
  id: string;
  orderId: string;
  fieldId: string;
  label: string;
  value: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt?: string;
}

export interface Order {
  id: string; // e.g. ORD-001
  formId: string;
  customerName: string;
  whatsapp: string;
  status: OrderStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderWithAnswers extends Order {
  answers: OrderAnswer[];
  form?: OrderForm;
}

export interface OrderStats {
  total: number;
  masuk: number;
  diproses: number;
  selesai: number;
}

// ============================================================
// KUPON TYPES
// ============================================================

export type CouponLocationStatus = "aktif" | "nonaktif";

export interface CouponLocation {
  id: string;
  name: string;
  picName: string;
  whatsapp: string;
  latitude: number;
  longitude: number;
  address: string;
  description?: string;
  photoUrl?: string;
  status: CouponLocationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CouponStats {
  total: number;
  aktif: number;
  nonaktif: number;
}