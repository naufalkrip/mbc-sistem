// ============================================================
// KONFIGURASI GLOBAL MB CHONDRO
// ============================================================
// Isi API_URL dengan URL Web App deployment dari Google Apps Script
// yang diakhiri dengan "/exec".
//
// Contoh:
// export const API_URL = "https://script.google.com/macros/s/XXXXX/exec";
//
// Lihat README.md untuk langkah-langkah deploy.
// ============================================================

export const API_URL = "https://script.google.com/macros/s/AKfycbwfIZQ6G-sdW6jDoQml8AGW_JRcpK3k3lEtU6cl8VqVfCxhXySA6TWsIn5zBkHnZ4ps/exec";

// Nama sheet pada Google Spreadsheet (harus sama dengan Code.gs)
export const SHEETS = {
  ANGGOTA: "ANGGOTA",
  ABSENSI: "ABSENSI",
  KEUANGAN_CHONDRO: "KEUANGAN_CHONDRO",
  KEUANGAN_MEDIA: "KEUANGAN_MEDIA",
  TRANSAKSI_GROUP: "TRANSAKSI_GROUP",
  TRANSAKSI_DETAIL: "TRANSAKSI_DETAIL",
  REKRUITMEN_FORM: "REKRUITMEN_FORM",
  REKRUITMEN_FIELDS: "REKRUITMEN_FIELDS",
  REKRUITMEN_SUBMISSIONS: "REKRUITMEN_SUBMISSIONS",
  REKRUITMEN_ANSWERS: "REKRUITMEN_ANSWERS",
  ORDER_FORM: "ORDER_FORM",
  ORDER_FIELDS: "ORDER_FIELDS",
  ORDERS: "ORDERS",
  ORDER_ANSWERS: "ORDER_ANSWERS",
  KUPON_LOCATIONS: "KUPON_LOCATIONS",
} as const;

// Status anggota yang valid
export const STATUS_ANGGOTA = ["Aktif", "Cuti", "Tidak Aktif"] as const;

// Status kehadiran yang valid
export const STATUS_KEHADIRAN = ["Hadir", "Izin", "Sakit", "Cuti", "Alpa"] as const;

// Waktu/sesi absensi yang valid
export const WAKTU_ABSENSI = ["Pagi", "Siang", "Malam"] as const;

// Jenis transaksi yang valid
export const JENIS_TRANSAKSI = ["Pemasukan", "Pengeluaran"] as const;

// Rekruitmen
export const REKRUITMEN_STATUS = ["dibuka", "ditutup"] as const;
export const REKRUITMEN_SUBMISSION_STATUS = ["menunggu", "lolos", "tidak_lolos"] as const;
export const REKRUITMEN_FIELD_TYPES = ["text", "textarea", "number", "date", "select", "radio", "checkbox", "file"] as const;

// Kelola Pesanan
export const ORDER_STATUS = ["masuk", "diproses", "selesai"] as const;
export const ORDER_FIELD_TYPES = ["text", "textarea", "number", "date", "select", "radio", "checkbox", "whatsapp", "file"] as const;

// Opsi divisi (kategori fleksibel, diambil dari data; daftar ini hanya referensi)
export const DIVISI = ["Musik", "Media", "Perlengkapan", "Kesehatan", "Sekretariat", "Lainnya"] as const;

export type StatusAnggota = (typeof STATUS_ANGGOTA)[number];
export type StatusKehadiran = (typeof STATUS_KEHADIRAN)[number];
export type JenisTransaksi = (typeof JENIS_TRANSAKSI)[number];
export type WaktuAbsensi = (typeof WAKTU_ABSENSI)[number];
export type StatusPesanan = (typeof ORDER_STATUS)[number];