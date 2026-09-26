import type { JenisTransaksi, WaktuAbsensi } from "../config";
import type { Absensi, Anggota, RekapAbsensi, SesiAbsensi, Transaksi } from "../types";
import { getMemberPhoto, saveMemberPhoto } from "../services/photoStorage";

/** Format angka menjadi Rupiah. Contoh: Rp 1.500.000 */
export function formatRupiah(nilai: number | string): string {
  const angka = typeof nilai === "string" ? parseFloat(nilai) : nilai;
  if (Number.isNaN(angka)) return "Rp 0";
  return "Rp " + angka.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

/** Format angka tanpa "Rp". Contoh: 1.500.000 */
export function formatAngka(nilai: number | string): string {
  const angka = typeof nilai === "string" ? parseFloat(nilai) : nilai;
  if (Number.isNaN(angka)) return "0";
  return angka.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

/**
 * Rank size: Anak-anak (terkecil -> terbesar) -> Dewasa (terkecil -> terbesar)
 */
export function getSizeRank(sizeStr: string): number {
  if (!sizeStr) return 999;
  const s = sizeStr.trim().toUpperCase();

  // 1. Anak-anak / Kids sizes (Rank 100 - 199)
  if (s.includes("ANAK") || s.includes("KIDS") || s.includes("BABY")) {
    if (s.includes("1") || s.includes("XS")) return 101;
    if (s.includes("2") || s.includes("S")) return 102;
    if (s.includes("3") || s.includes("M")) return 103;
    if (s.includes("4") || s.includes("L")) return 104;
    if (s.includes("5") || s.includes("XL")) return 105;
    if (s.includes("6")) return 106;
    if (s.includes("8")) return 108;
    if (s.includes("10")) return 110;
    if (s.includes("12")) return 112;
    return 150;
  }

  // Pure numeric sizes under 16 (usually kids sizes)
  const numMatch = s.match(/^SIZE\s*(\d+)$/i) || s.match(/^(\d+)$/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (val <= 14) return 100 + val;
  }

  // 2. Dewasa / Adult sizes (Rank 200 - 299)
  if (s === "XXS") return 200;
  if (s === "XS") return 201;
  if (s === "S") return 202;
  if (s === "M") return 203;
  if (s === "L") return 204;
  if (s === "XL") return 205;
  if (s === "XXL" || s === "2XL") return 206;
  if (s === "XXXL" || s === "3XL") return 207;
  if (s === "XXXXL" || s === "4XL") return 208;
  if (s === "5XL") return 209;
  if (s === "6XL") return 210;

  // Prefix matches for adult sizes
  if (s.startsWith("XXS")) return 200;
  if (s.startsWith("XS")) return 201;
  if (s.startsWith("S")) return 202;
  if (s.startsWith("M")) return 203;
  if (s.startsWith("L")) return 204;
  if (s.startsWith("XL")) return 205;
  if (s.startsWith("XXL") || s.startsWith("2XL")) return 206;
  if (s.startsWith("3XL") || s.startsWith("XXXL")) return 207;
  if (s.startsWith("4XL")) return 208;
  if (s.startsWith("5XL")) return 209;

  return 900;
}

/** Format tanggal menjadi DD/MM/YYYY. Contoh: 16/08/2026 */
export function formatTanggal(tanggal: string): string {
  if (!tanggal) return "-";
  const t = new Date(tanggal);
  if (Number.isNaN(t.getTime())) return tanggal;
  const d = String(t.getDate()).padStart(2, "0");
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const y = t.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Format tanggal panjang bahasa Indonesia. Contoh: Minggu, 16 Agustus 2026 */
export function formatTanggalPanjang(tanggal: string): string {
  if (!tanggal) return "-";
  const t = new Date(tanggal);
  if (Number.isNaN(t.getTime())) return tanggal;
  const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const namaBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${namaHari[t.getDay()]}, ${t.getDate()} ${namaBulan[t.getMonth()]} ${t.getFullYear()}`;
}

/** Ambil bagian tanggal (YYYY-MM-DD) dari string tanggal atau datetime */
export function hanyaTanggal(value: string): string {
  if (!value) return "";
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return value.slice(0, 10);
  const d = String(t.getDate()).padStart(2, "0");
  const m = String(t.getMonth() + 1).padStart(2, "0");
  return `${t.getFullYear()}-${m}-${d}`;
}

/** Nama bulan bahasa Indonesia */
export const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Nama bulan pendek (3 huruf) untuk PDF */
export const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Format bulan + tahun. Contoh: "Agustus 2026" */
export function formatBulanTahun(tanggal: string): string {
  const t = new Date(tanggal);
  if (Number.isNaN(t.getTime())) return "-";
  return `${NAMA_BULAN[t.getMonth()]} ${t.getFullYear()}`;
}

/** Buat label rentang tanggal untuk laporan PDF */
export function formatRentangTanggal(dari: string, sampai: string): string {
  if (dari && sampai) return `${formatTanggal(dari)} — ${formatTanggal(sampai)}`;
  if (dari) return `Dari ${formatTanggal(dari)}`;
  if (sampai) return `Sampai ${formatTanggal(sampai)}`;
  return "Semua Periode";
}

/** Hitung statistik kehadiran dari data absensi */
export function hitungStatKehadiran(absensi: Absensi[]): {
  hadir: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpa: number;
  total: number;
  persentase: number;
} {
  const hadir = absensi.filter((a) => a.status === "Hadir").length;
  const izin = absensi.filter((a) => a.status === "Izin").length;
  const sakit = absensi.filter((a) => a.status === "Sakit").length;
  const cuti = absensi.filter((a) => a.status === "Cuti").length;
  const alpa = absensi.filter((a) => a.status === "Alpa").length;
  const total = absensi.length;
  const persentase = total === 0 ? 0 : Math.round(((hadir + izin + sakit + cuti) / total) * 100);
  return { hadir, izin, sakit, cuti, alpa, total, persentase };
}

/** Buat rekap absensi per anggota */
export function buatRekapAbsensi(absensi: Absensi[], anggota: Anggota[]): RekapAbsensi[] {
  const map = new Map<string, RekapAbsensi>();
  for (const a of anggota) {
    map.set(a.id, { idAnggota: a.id, nama: a.nama, hadir: 0, izin: 0, sakit: 0, cuti: 0, alpa: 0, total: 0, persentase: 0 });
  }
  for (const ab of absensi) {
    const item = map.get(ab.idAnggota);
    if (!item) continue;
    if (ab.status === "Hadir") item.hadir += 1;
    else if (ab.status === "Izin") item.izin += 1;
    else if (ab.status === "Sakit") item.sakit += 1;
    else if (ab.status === "Cuti") item.cuti += 1;
    else if (ab.status === "Alpa") item.alpa += 1;
    item.total += 1;
  }
  for (const item of map.values()) {
    item.persentase = item.total === 0 ? 0 : Math.round(((item.hadir + item.izin + item.sakit + item.cuti) / item.total) * 100);
  }
  const result = Array.from(map.values());
  result.sort((a, b) => b.total - a.total);
  return result;
}

const WAKTU_ORDER: WaktuAbsensi[] = ["Pagi", "Siang", "Malam"];

/** Kelompokkan catatan absensi menjadi sesi (tanggal + kegiatan + waktu) */
export function buatSesiAbsensi(absensi: Absensi[]): SesiAbsensi[] {
  const map = new Map<string, Absensi[]>();
  for (const a of absensi) {
    const key = `${a.tanggal}|${a.kegiatan.trim().toLowerCase()}|${a.waktu}`;
    const arr = map.get(key);
    if (arr) arr.push(a);
    else map.set(key, [a]);
  }
  const hasil: SesiAbsensi[] = [];
  for (const [key, daftar] of map.entries()) {
    const [tanggal, , waktu] = key.split("|");
    hasil.push({
      key,
      tanggal,
      kegiatan: daftar[0].kegiatan.trim(),
      waktu: (waktu || "Pagi") as WaktuAbsensi,
      daftar,
      jumlahAnggota: daftar.length,
    });
  }
  hasil.sort((a, b) => {
    const t = (a.tanggal || "").localeCompare(b.tanggal || "");
    if (t !== 0) return t;
    return WAKTU_ORDER.indexOf(a.waktu) - WAKTU_ORDER.indexOf(b.waktu);
  });
  return hasil;
}

/** Ringkasan status satu sesi, contoh: "8 Hadir, 1 Izin, 1 Cuti, 1 Alpa" */
export function buatRingkasanSesi(daftar: Absensi[]): string {
  const s = hitungStatKehadiran(daftar);
  const parts: string[] = [];
  if (s.hadir > 0) parts.push(`${s.hadir} Hadir`);
  if (s.izin > 0) parts.push(`${s.izin} Izin`);
  if (s.sakit > 0) parts.push(`${s.sakit} Sakit`);
  if (s.cuti > 0) parts.push(`${s.cuti} Cuti`);
  if (s.alpa > 0) parts.push(`${s.alpa} Alpa`);
  return parts.length ? parts.join(", ") : "-";
}

/** Format tanggal pendek, contoh: "16 Agu" */
export function formatTanggalPendek(tanggal: string): string {
  if (!tanggal) return "-";
  const t = new Date(tanggal);
  if (Number.isNaN(t.getTime())) return tanggal;
  return `${t.getDate()} ${NAMA_BULAN_PENDEK[t.getMonth()]}`;
}

/** Huruf status untuk rekap, contoh: Hadir -> H */
export function statusKeHuruf(status: string): string {
  if (status === "Hadir") return "H";
  if (status === "Izin") return "I";
  if (status === "Sakit") return "S";
  if (status === "Cuti") return "C";
  if (status === "Alpa") return "A";
  return "*";
}

/** Filter catatan absensi berdasarkan rentang tanggal (ISO YYYY-MM-DD) */
export function filterAbsensiPeriode(absensi: Absensi[], dari?: string, sampai?: string): Absensi[] {
  return absensi.filter((a) => {
    if (dari && a.tanggal && a.tanggal < dari) return false;
    if (sampai && a.tanggal && a.tanggal > sampai) return false;
    return true;
  });
}

/** Hitung saldo dari transaksi */
export function hitungSaldo(transaksi: Transaksi[]): {
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
} {
  const pemasukan = transaksi
    .filter((t) => t.jenis === "Pemasukan")
    .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  const pengeluaran = transaksi
    .filter((t) => t.jenis === "Pengeluaran")
    .reduce((sum, t) => sum + (Number(t.nominal) || 0), 0);
  return { pemasukan, pengeluaran, saldo: pemasukan - pengeluaran };
}

/** Filter transaksi berdasarkan rentang tanggal */
export function filterTransaksi(
  transaksi: Transaksi[],
  filters: { dari?: string; sampai?: string; jenis?: string; kategori?: string; search?: string }
): Transaksi[] {
  return transaksi.filter((t) => {
    if (filters.dari && t.tanggal && t.tanggal < filters.dari) return false;
    if (filters.sampai && t.tanggal && t.tanggal > filters.sampai) return false;
    if (filters.jenis && t.jenis !== filters.jenis) return false;
    if (filters.kategori && t.kategori !== filters.kategori) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${t.id} ${t.kategori} ${t.keterangan} ${t.penanggungJawab} ${t.nominal}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Kelompokkan transaksi per bulan untuk grafik */
export function transaksiPerBulan(transaksi: Transaksi[], tahun?: number): { label: string; pemasukan: number; pengeluaran: number }[] {
  const hasil: { label: string; pemasukan: number; pengeluaran: number }[] = [];
  for (let i = 0; i < 12; i++) {
    hasil.push({ label: NAMA_BULAN_PENDEK[i], pemasukan: 0, pengeluaran: 0 });
  }
  for (const t of transaksi) {
    if (!t.tanggal) continue;
    const d = new Date(t.tanggal);
    if (tahun !== undefined && d.getFullYear() !== tahun) continue;
    const bulan = d.getMonth();
    const nominal = Number(t.nominal) || 0;
    if (t.jenis === "Pemasukan") hasil[bulan].pemasukan += nominal;
    else hasil[bulan].pengeluaran += nominal;
  }
  return hasil;
}

export type AttendancePeriod = "weekly" | "monthly" | "yearly";

export interface AttendanceChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
    key: string;
  }[];
}

/** Kelompokkan absensi per periode untuk grafik kehadiran */
export function absensiPerPeriode(absensi: Absensi[], mode: AttendancePeriod): AttendanceChartData {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const statusKeys = ["hadir", "izin", "sakit", "cuti", "alpa"] as const;
  const statusLabels: Record<typeof statusKeys[number], string> = {
    hadir: "Hadir",
    izin: "Izin",
    sakit: "Sakit",
    cuti: "Cuti",
    alpa: "Alpa",
  };
  const statusColors: Record<typeof statusKeys[number], string> = {
    hadir: "#16a34a",
    izin: "#0284c7",
    sakit: "#f59e0b",
    cuti: "#7c3aed",
    alpa: "#dc2626",
  };

  let labels: string[] = [];
  let dateRanges: { start: Date; end: Date }[] = [];

  if (mode === "weekly") {
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(currentDay - i);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      labels.push(["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()]);
      dateRanges.push({ start: d, end });
    }
  } else if (mode === "monthly") {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const end = new Date(currentYear, currentMonth - i + 1, 0, 23, 59, 59, 999);
      labels.push(NAMA_BULAN_PENDEK[d.getMonth()]);
      dateRanges.push({ start: d, end });
    }
  } else {
    // Last 5 years
    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      labels.push(String(year));
      dateRanges.push({ start, end });
    }
  }

  const datasets = statusKeys.map((key) => ({
    label: statusLabels[key],
    data: dateRanges.map(({ start, end }) => {
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      return absensi.filter((a) => a.status === statusLabels[key] && a.tanggal >= startStr && a.tanggal <= endStr).length;
    }),
    color: statusColors[key],
    key,
  }));

  return { labels, datasets };
}

/** Normalisasi status anggota agar selalu berupa 'Aktif' | 'Cuti' | 'Tidak Aktif' */
export function normalizeStatusAnggota(rawStatus: unknown): Anggota["status"] {
  const s = String(rawStatus || "").trim().toLowerCase();
  if (s === "cuti" || s === "leave") return "Cuti";
  if (
    s === "tidak aktif" ||
    s === "tidakaktif" ||
    s === "tidak_aktif" ||
    s === "nonaktif" ||
    s === "non-aktif" ||
    s === "non_aktif" ||
    s === "inactive"
  ) {
    return "Tidak Aktif";
  }
  return "Aktif";
}

/** Normalisasi nomor HP agar angka '0' di depan tidak hilang dan bersih dari karakter aneh */
export function formatNoHp(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("'")) {
    s = s.slice(1).trim();
  }
  // Jika angka dimulai dengan 8 (misal 85123456 karena Excel/Google Sheets menghapus angka 0 di depan)
  if (/^8\d{6,14}$/.test(s)) {
    s = "0" + s;
  }
  return s;
}

/** Menghasilkan tautan langsung ke WhatsApp Web / App (https://wa.me/62...) */
export function toWaLink(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) {
    return `https://wa.me/${digits}`;
  }
  if (digits.startsWith("0")) {
    return `https://wa.me/62${digits.slice(1)}`;
  }
  if (digits.startsWith("8")) {
    return `https://wa.me/62${digits}`;
  }
  return `https://wa.me/${digits}`;
}

/** Memvalidasi URL foto atau data URL Base64 agar tidak menyebabkan 'Data URL decoding failed' */
export function isValidPhotoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "-" || trimmed.length < 10) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("blob:")) return true;
  if (!trimmed.startsWith("data:image/")) return false;
  const comma = trimmed.indexOf(",");
  if (comma === -1) return false;
  const b64 = trimmed.slice(comma + 1).trim();
  if (!b64 || b64.length < 32 || b64.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return false;
  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const tail = b64.slice(-120);
      window.atob(tail.length % 4 === 0 ? tail : tail.slice(0, -(tail.length % 4)));
    }
  } catch {
    return false;
  }
  return true;
}

/** Normalisasi data anggota dari API (Apps Script dapat mengirim data dengan kunci berbeda) */
export function normAnggota(raw: Record<string, unknown>): Anggota {
  const id = String(raw.IDAnggota ?? raw.id ?? "");
  const nama = String(raw.NamaLengkap ?? raw.nama ?? "");
  const rawPhoto = raw.Foto ? String(raw.Foto) : raw.foto ? String(raw.foto) : undefined;
  const cleanServerPhoto = rawPhoto && isValidPhotoUrl(rawPhoto) ? rawPhoto.trim() : undefined;

  if (cleanServerPhoto) {
    saveMemberPhoto(id, nama, cleanServerPhoto);
  }

  const localPhoto = getMemberPhoto(id, nama);
  const foto = cleanServerPhoto || (localPhoto && isValidPhotoUrl(localPhoto) ? localPhoto : undefined);

  return {
    id,
    nama,
    namaPanggilan: raw.NamaPanggilan ? String(raw.NamaPanggilan) : raw.namaPanggilan ? String(raw.namaPanggilan) : undefined,
    divisi: String(raw.Divisi ?? raw.divisi ?? ""),
    jabatan: String(raw.Jabatan ?? raw.jabatan ?? ""),
    noHp: formatNoHp(raw.NoHP ?? raw.noHp ?? ""),
    status: normalizeStatusAnggota(raw.Status ?? raw.status),
    tanggalBergabung: String(raw.TanggalBergabung ?? raw.tanggalBergabung ?? ""),
    keterangan: String(raw.Keterangan ?? raw.keterangan ?? ""),
    foto,
  };
}

/** Normalisasi data absensi dari API */
export function normAbsensi(raw: Record<string, unknown>): Absensi {
  return {
    id: String(raw.IDAbsensi ?? raw.id ?? ""),
    idAnggota: String(raw.IDAnggota ?? raw.idAnggota ?? ""),
    nama: String(raw.Nama ?? raw.nama ?? ""),
    tanggal: String(raw.Tanggal ?? raw.tanggal ?? ""),
    kegiatan: String(raw.Kegiatan ?? raw.kegiatan ?? ""),
    status: (raw.StatusKehadiran ?? raw.status ?? "Hadir") as Absensi["status"],
    keterangan: String(raw.Keterangan ?? raw.keterangan ?? ""),
    waktu: (raw.Waktu ?? raw.waktu ?? "Pagi") as WaktuAbsensi,
  };
}

/** Normalisasi data transaksi dari API */
export function normTransaksi(raw: Record<string, unknown>): Transaksi {
  return {
    id: String(raw.IDTransaksi ?? raw.id ?? ""),
    tanggal: String(raw.Tanggal ?? raw.tanggal ?? ""),
    jenis: (raw.Jenis ?? raw.jenis ?? "Pemasukan") as JenisTransaksi,
    kategori: String(raw.Kategori ?? raw.kategori ?? ""),
    keterangan: String(raw.Keterangan ?? raw.keterangan ?? ""),
    nominal: Number(raw.Nominal ?? raw.nominal ?? 0),
    penanggungJawab: String(raw.PenanggungJawab ?? raw.penanggungJawab ?? ""),
  };
}

/**
 * Format nomor HP/WhatsApp Indonesia menjadi format standar lengkap berawalan 0 (contoh: 085123456789).
 * Menangani kasus 0 hilang (856123456789), awalan 62 (62856123456789), atau awalan +62.
 */
export function formatNomorHp(nomor: string | number | null | undefined): string {
  if (nomor === null || nomor === undefined) return "-";
  const raw = String(nomor).trim();
  if (!raw || raw === "-") return "-";

  // Bersihkan karakter non-angka kecuali tanda +
  let digits = raw.replace(/[^0-9+]/g, "");

  if (digits.startsWith("+62")) {
    digits = "0" + digits.slice(3);
  } else if (digits.startsWith("62")) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("8")) {
    digits = "0" + digits;
  }

  return digits || raw;
}

/**
 * Format nomor WhatsApp ke format internasional (628...) yang siap untuk tautan wa.me
 */
export function formatNomorWhatsAppUrl(nomor: string | number | null | undefined): string | null {
  if (nomor === null || nomor === undefined) return null;
  const raw = String(nomor).trim();
  if (!raw || raw === "-") return null;

  let digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
  } else if (!digits.startsWith("62")) {
    digits = "62" + digits;
  }

  return digits;
}

/**
 * Membuat pesan template otomatis sapaan & jadwal skrining calon anggota mbc sistem
 */
export function buatPesanWhatsAppCalon(nama: string, judulFormulir?: string): string {
  const cleanName = (nama || "Calon Anggota").trim();
  const context = judulFormulir ? ` (${judulFormulir})` : "";

  return (
    `Halo kak ${cleanName},\n\n` +
    `Terima kasih sudah melakukan pengisian formulir pendaftaran calon anggota Chondro Wonopringgo${context}.\n\n` +
    `Kami menginformasikan bahwa akan ada tahapan skrining lanjutan / audisi calon anggota yang akan dilaksanakan pada:\n\n` +
    `Tanggal & Waktu : \n` +
    `Tempat : \n\n` +
    `Mohon untuk mempersiapkan diri dan hadir tepat waktu. Silakan membalas pesan ini untuk konfirmasi kehadiran ya kak. Terima kasih! 🙏`
  );
}

/**
 * Membuat link tautan langsung ke WhatsApp dengan pre-filled text pesan skrining
 */
export function buatLinkWhatsAppCalon(
  nomor: string | number | null | undefined,
  nama: string,
  judulFormulir?: string
): string | null {
  const cleanNumber = formatNomorWhatsAppUrl(nomor);
  if (!cleanNumber) return null;

  const pesan = buatPesanWhatsAppCalon(nama, judulFormulir);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(pesan)}`;
}

/**
 * Membuat template pesan WhatsApp pengumuman kelolosan seleksi calon anggota Chondro Wonopringgo.
 * Sesuai ketentuan:
 * 1. Tercantum nama calon anggota
 * 2. Tercantum informasi proses training dengan kewajiban mengikuti 3 (tiga) kali penampilan
 */
export function buatPesanWhatsAppLolos(
  nama: string,
  judulFormulir?: string,
  catatanKhusus?: string
): string {
  const cleanName = (nama || "Calon Anggota").trim();
  const context = judulFormulir ? ` (${judulFormulir})` : "";
  const noteSection =
    catatanKhusus && catatanKhusus.trim()
      ? `\n\n📌 *Catatan Tambahan Reviewer:*\n${catatanKhusus.trim()}`
      : "";

  return (
    `Halo kak ${cleanName},\n\n` +
    `🎉 *SELAMAT!* Berdasarkan hasil seleksi penerimaan calon anggota Chondro Wonopringgo${context}, Anda dinyatakan *LOLOS* sebagai Calon Anggota Chondro Wonopringgo.\n\n` +
    `📋 *Informasi & Ketentuan Tahap Selanjutnya:*\n` +
    `1. Anda resmi memasuki masa *Training Calon Anggota* Chondro Wonopringgo.\n` +
    `2. Selama masa training, Anda diwajibkan untuk *mengikuti 3 (tiga) kali penampilan / performa Chondro Wonopringgo* secara aktif sebagai syarat utama pengukuhan anggota resmi.\n` +
    `3. Jadwal penampilan serta arahan teknis akan diinformasikan lebih lanjut oleh tim pelatih & kepengurusan.${noteSection}\n\n` +
    `Mohon membalas pesan ini untuk konfirmasi penerimaan dan kesediaan Anda ya kak.\n\n` +
    `Selamat bergabung dan semangat berproses bersama keluarga besar Chondro Wonopringgo! 🎺🥁✨`
  );
}

/**
 * Membuat link tautan langsung ke WhatsApp dengan pesan pengumuman kelolosan
 */
export function buatLinkWhatsAppLolos(
  nomor: string | number | null | undefined,
  nama: string,
  judulFormulir?: string,
  catatanKhusus?: string
): string | null {
  const cleanNumber = formatNomorWhatsAppUrl(nomor);
  if (!cleanNumber) return null;

  const pesan = buatPesanWhatsAppLolos(nama, judulFormulir, catatanKhusus);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(pesan)}`;
}

/**
 * Membuat pesan template otomatis follow-up pesanan customer MB Chondro
 */
export function buatPesanWhatsAppPesanan(
  nama: string,
  orderId: string,
  jenisPesanan?: string,
  statusPesanan?: string
): string {
  const cleanName = (nama || "Customer").trim();
  const orderTag = orderId ? `[${orderId}]` : "";
  const produk = jenisPesanan ? ` untuk ${jenisPesanan}` : "";
  const statusInfo = statusPesanan ? ` saat ini berstatus *${statusPesanan.toUpperCase()}*` : "";

  return (
    `Halo kak ${cleanName},\n\n` +
    `Kami dari admin *MB Chondro*. Menindaklanjuti formulir pesanan yang telah dikirimkan ${orderTag}${produk},\n` +
    `pesanan Anda${statusInfo} dan sedang kami tangani.\n\n` +
    `Apakah ada rincian spesifikasi tambahan atau ada hal yang ingin didiskusikan terlebih dahulu kak? Terima kasih 🙏`
  );
}

/**
 * Membuat link tautan langsung ke WhatsApp customer terkait pesanan
 */
export function buatLinkWhatsAppPesanan(
  nomor: string | number | null | undefined,
  nama: string,
  orderId: string,
  jenisPesanan?: string,
  statusPesanan?: string
): string | null {
  const cleanNumber = formatNomorWhatsAppUrl(nomor);
  if (!cleanNumber) return null;

  const pesan = buatPesanWhatsAppPesanan(nama, orderId, jenisPesanan, statusPesanan);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(pesan)}`;
}

export interface VariantConfig {
  price?: number;
  longSleeveExtra?: number;
  prices: Record<string, number>;
  sleeves: string[];
}

export function parseVariantConfig(field: {
  price?: number;
  longSleeveExtra?: number;
  placeholder?: string;
}): VariantConfig {
  let price = field.price !== undefined ? Number(field.price) : 85000;
  let longSleeveExtra = field.longSleeveExtra !== undefined ? Number(field.longSleeveExtra) : 0;
  let prices: Record<string, number> = {};
  let sleeves = ["Lengan Pendek", "Lengan Panjang"];

  const placeholderStr = field.placeholder || "";
  if (placeholderStr) {
    try {
      if (placeholderStr.startsWith("{") && placeholderStr.endsWith("}")) {
        const obj = JSON.parse(placeholderStr);
        if (obj.price !== undefined) price = Number(obj.price) || 0;
        if (obj.longSleeveExtra !== undefined) longSleeveExtra = Number(obj.longSleeveExtra) || 0;
        if (obj.prices !== undefined) {
          prices = obj.prices;
        }
        if (obj.sleeves) {
          sleeves = Array.isArray(obj.sleeves)
            ? obj.sleeves
            : String(obj.sleeves).split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        return { price, longSleeveExtra, prices, sleeves };
      }
    } catch {}

    // Check if format has price:...
    if (placeholderStr.includes("price:")) {
      const parts = placeholderStr.split("|");
      const pPart = parts.find((p) => p.startsWith("price:"));
      if (pPart) {
        price = Number(pPart.replace("price:", "").trim()) || 0;
      }
      const ePart = parts.find((p) => p.startsWith("extra:"));
      if (ePart) {
        longSleeveExtra = Number(ePart.replace("extra:", "").trim()) || 0;
      }
      const slPart = parts.find((p) => !p.startsWith("price:") && !p.startsWith("extra:"));
      if (slPart) {
        sleeves = slPart.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return { price, longSleeveExtra, prices, sleeves };
    }

    // Default plain comma-separated sleeves
    const splitted = placeholderStr.split(",").map((s) => s.trim()).filter(Boolean);
    if (splitted.length > 0) sleeves = splitted;
  }

  return { price, longSleeveExtra, prices, sleeves };
}

export function serializeVariantConfig(config: VariantConfig): string {
  return JSON.stringify({
    price: config.price || 0,
    longSleeveExtra: config.longSleeveExtra || 0,
    prices: config.prices || {},
    sleeves: Array.isArray(config.sleeves) ? config.sleeves.join(", ") : config.sleeves,
  });
}

/** Mengubah URL foto / Google Drive link menjadi URL gambar langsung (direct image endpoint) */
export function formatDirectImageUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "-") return "";
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) return trimmed;

  // Ekstrak ID berkas dari berbagai format URL Google Drive
  const driveMatch = trimmed.match(/(?:id=|d\/|file\/d\/|open\?id=)([a-zA-Z0-9_-]{25,})/);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }

  return trimmed;
}

/** Handler onError fallback otomatis untuk elemen <img> yang memuat gambar Google Drive */
export function handleImageLoadError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const img = e.currentTarget;
  const currentSrc = img.src || "";
  const tryCount = Number(img.dataset.tryCount || 0);

  if (tryCount >= 3) {
    img.style.display = "none";
    const parent = img.parentElement;
    if (parent && !parent.querySelector(".img-fallback-notice")) {
      const notice = document.createElement("div");
      notice.className = "img-fallback-notice";
      notice.style.cssText = "padding: 10px 14px; text-align: center; font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 8px; margin: 8px 0; width: 100%; box-sizing: border-box;";
      const driveMatch = currentSrc.match(/(?:id=|d\/|file\/d\/|open\?id=)([a-zA-Z0-9_-]{25,})/);
      const fileId = driveMatch ? driveMatch[1] : "";
      const openUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : currentSrc;
      notice.innerHTML = `<span>📷 Foto keterangan tidak dapat dimuat langsung. <a href="${openUrl}" target="_blank" rel="noreferrer" style="color:#b91c1c; font-weight:700; text-decoration:underline;">Klik di sini untuk membuka foto ↗</a></span>`;
      parent.appendChild(notice);
    }
    return;
  }

  img.dataset.tryCount = String(tryCount + 1);
  const driveMatch = currentSrc.match(/(?:id=|d\/|file\/d\/|open\?id=)([a-zA-Z0-9_-]{25,})/);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    if (tryCount === 0) {
      img.src = `https://lh3.googleusercontent.com/d/${fileId}`;
    } else if (tryCount === 1) {
      img.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
    } else if (tryCount === 2) {
      img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
}