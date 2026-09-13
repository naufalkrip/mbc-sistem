import type { JenisTransaksi, WaktuAbsensi } from "../config";
import type { Absensi, Anggota, RekapAbsensi, SesiAbsensi, Transaksi } from "../types";

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

/** Normalisasi data anggota dari API (Apps Script dapat mengirim data dengan kunci berbeda) */
export function normAnggota(raw: Record<string, unknown>): Anggota {
  return {
    id: String(raw.IDAnggota ?? raw.id ?? ""),
    nama: String(raw.NamaLengkap ?? raw.nama ?? ""),
    divisi: String(raw.Divisi ?? raw.divisi ?? ""),
    jabatan: String(raw.Jabatan ?? raw.jabatan ?? ""),
    noHp: String(raw.NoHP ?? raw.noHp ?? ""),
    status: (raw.Status ?? raw.status ?? "Aktif") as Anggota["status"],
    tanggalBergabung: String(raw.TanggalBergabung ?? raw.tanggalBergabung ?? ""),
    keterangan: String(raw.Keterangan ?? raw.keterangan ?? ""),
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