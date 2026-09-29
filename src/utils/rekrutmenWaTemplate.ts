import { formatNomorWhatsAppUrl } from "./format";
import type { RekrutmenSubmissionWithAnswers } from "../types";

export interface RekrutmenWaSettings {
  namaTempat: string;
  titikGmaps: string;
  tanggalWaktu: string;
  templateSkrining: string;
  templateLolos: string;
  templateGeneral: string;
}

export const REKRUTMEN_WA_SETTINGS_KEY = "rekrutmen_wa_template_settings_v1";

export const DEFAULT_REKRUTMEN_WA_SETTINGS: RekrutmenWaSettings = {
  namaTempat: "Basecamp MB Chondro Wonopringgo (Jl. Raya Wonopringgo No. 12, Pekalongan)",
  titikGmaps: "https://maps.app.goo.gl/WonopringgoPekalongan",
  tanggalWaktu: "Sabtu, 15 Oktober 2026 (Pukul 14.00 WIB)",
  templateSkrining: `Halo Kak *{nama}* 👋

Terima kasih telah mendaftar di *{judul_form}* MB Chondro Wonopringgo untuk posisi *{posisi}*.

Kami menginformasikan bahwa akan ada tahapan skrining lanjutan / audisi calon anggota yang akan dilaksanakan pada:

📅 *JADWAL & LOKASI SKRINING*
────────────────────
🗓️ *Tanggal & Waktu:* {tanggal_waktu}
📍 *Nama Tempat:* {nama_tempat}
🗺️ *Titik GMaps:* {titik_gmaps}
────────────────────

Mohon untuk mempersiapkan diri dan hadir tepat waktu. Silakan membalas pesan ini untuk konfirmasi kehadiran Anda ya kak.

Terima kasih 🙏
*MB Chondro Wonopringgo*`,

  templateLolos: `Halo Kak *{nama}* 👋

🎉 *SELAMAT!* Berdasarkan hasil seleksi penerimaan calon anggota *{judul_form}* MB Chondro Wonopringgo (Posisi: *{posisi}*), Anda dinyatakan *LOLOS* sebagai Calon Anggota MB Chondro Wonopringgo!

📋 *INFORMASI & KETENTUAN TAHAP SELANJUTNYA:*
────────────────────
🗓️ *Jadwal Perdana / Training:* {tanggal_waktu}
📍 *Nama Tempat / Basecamp:* {nama_tempat}
🗺️ *Titik GMaps:* {titik_gmaps}
────────────────────

*Ketentuan Masa Training:*
1. Anda resmi memasuki masa *Training Calon Anggota* Chondro Wonopringgo.
2. Selama masa training, diwajibkan *mengikuti 3 (tiga) kali penampilan* secara aktif sebagai syarat pengukuhan anggota resmi.{catatan}

Mohon membalas pesan ini untuk konfirmasi penerimaan dan kesediaan Anda ya kak.

Selamat bergabung dan semangat berproses bersama keluarga besar MB Chondro Wonopringgo! 🎺🥁✨`,

  templateGeneral: `Halo Kak *{nama}* 👋

Informasi mengenai pendaftaran Anda pada *{judul_form}* MB Chondro Wonopringgo (Posisi: *{posisi}*).

📍 *Informasi Lokasi & Jadwal:*
• Tempat: {nama_tempat}
• Titik GMaps: {titik_gmaps}
• Tanggal & Waktu: {tanggal_waktu}

{catatan}

Terima kasih atas partisipasi Anda 🙏
*MB Chondro Wonopringgo*`,
};

export function getRekrutmenWaSettings(): RekrutmenWaSettings {
  try {
    const saved = localStorage.getItem(REKRUTMEN_WA_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        namaTempat: parsed.namaTempat ?? DEFAULT_REKRUTMEN_WA_SETTINGS.namaTempat,
        titikGmaps: parsed.titikGmaps ?? DEFAULT_REKRUTMEN_WA_SETTINGS.titikGmaps,
        tanggalWaktu: parsed.tanggalWaktu ?? DEFAULT_REKRUTMEN_WA_SETTINGS.tanggalWaktu,
        templateSkrining: parsed.templateSkrining ?? DEFAULT_REKRUTMEN_WA_SETTINGS.templateSkrining,
        templateLolos: parsed.templateLolos ?? DEFAULT_REKRUTMEN_WA_SETTINGS.templateLolos,
        templateGeneral: parsed.templateGeneral ?? DEFAULT_REKRUTMEN_WA_SETTINGS.templateGeneral,
      };
    }
  } catch (e) {
    console.error("Gagal membaca settings WA rekrutmen dari localStorage", e);
  }
  return DEFAULT_REKRUTMEN_WA_SETTINGS;
}

export function saveRekrutmenWaSettings(settings: RekrutmenWaSettings): void {
  try {
    localStorage.setItem(REKRUTMEN_WA_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Gagal menyimpan settings WA rekrutmen ke localStorage", e);
  }
}

export function buildRekrutmenWaMessage(
  templateType: "skrining" | "lolos" | "general",
  params: {
    nama?: string;
    judulForm?: string;
    posisi?: string;
    catatan?: string;
    customSettings?: Partial<RekrutmenWaSettings>;
  }
): string {
  const settings = getRekrutmenWaSettings();
  const namaTempat = params.customSettings?.namaTempat ?? settings.namaTempat;
  const titikGmaps = params.customSettings?.titikGmaps ?? settings.titikGmaps;
  const tanggalWaktu = params.customSettings?.tanggalWaktu ?? settings.tanggalWaktu;

  let rawTemplate = settings.templateSkrining;
  if (templateType === "lolos") rawTemplate = settings.templateLolos;
  if (templateType === "general") rawTemplate = settings.templateGeneral;

  if (params.customSettings) {
    if (templateType === "skrining" && params.customSettings.templateSkrining) {
      rawTemplate = params.customSettings.templateSkrining;
    } else if (templateType === "lolos" && params.customSettings.templateLolos) {
      rawTemplate = params.customSettings.templateLolos;
    } else if (templateType === "general" && params.customSettings.templateGeneral) {
      rawTemplate = params.customSettings.templateGeneral;
    }
  }

  const cleanNama = (params.nama || "Calon Anggota").trim();
  const cleanJudul = (params.judulForm || "Rekrutmen").trim();
  const cleanPosisi = (params.posisi || "-").trim();
  const noteStr = params.catatan && params.catatan.trim()
    ? `\n\n📌 *Catatan Tambahan Reviewer:*\n${params.catatan.trim()}`
    : "";

  return rawTemplate
    .replace(/{nama}/g, cleanNama)
    .replace(/{judul_form}/g, cleanJudul)
    .replace(/{posisi}/g, cleanPosisi)
    .replace(/{nama_tempat}/g, namaTempat)
    .replace(/{titik_gmaps}/g, titikGmaps)
    .replace(/{tanggal_waktu}/g, tanggalWaktu)
    .replace(/{catatan}/g, noteStr);
}

export function buildRekrutmenWaLink(
  nomorHp: string | number | null | undefined,
  templateType: "skrining" | "lolos" | "general",
  params: {
    nama?: string;
    judulForm?: string;
    posisi?: string;
    catatan?: string;
    customSettings?: Partial<RekrutmenWaSettings>;
  }
): string | null {
  const cleanNumber = formatNomorWhatsAppUrl(nomorHp);
  if (!cleanNumber) return null;

  const pesan = buildRekrutmenWaMessage(templateType, params);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(pesan)}`;
}

export function extractCandidateHpAndPosition(submission: RekrutmenSubmissionWithAnswers) {
  if (!submission || !Array.isArray(submission.answers)) {
    return { nama: "Calon Anggota", rawHp: "", hp: "", posisi: "-" };
  }

  const namaAnswer = submission.answers.find((a) => {
    const lbl = (a.field?.label || "").toLowerCase();
    return lbl.includes("nama") && !lbl.includes("panggilan") && !lbl.includes("orang tua") && !lbl.includes("ibu");
  });
  const nama = namaAnswer?.value?.trim() || "Calon Anggota";

  const hpField = submission.answers.find(
    (a) =>
      (a.field?.label || "").toLowerCase().includes("hp") ||
      (a.field?.label || "").toLowerCase().includes("telepon") ||
      (a.field?.label || "").toLowerCase().includes("whatsapp") ||
      (a.field?.label || "").toLowerCase().includes("wa") ||
      (a.field?.label || "").toLowerCase().includes("kontak")
  );
  const rawHp = hpField?.value?.trim() || "";
  const cleanHp = formatNomorWhatsAppUrl(rawHp);

  const pilihanField =
    submission.answers.find((a) => (a.field?.label || "").toLowerCase().includes("bakat")) ||
    submission.answers.find((a) => {
      const lbl = (a.field?.label || "").toLowerCase();
      return (
        lbl.includes("instrumen") ||
        lbl.includes("alat") ||
        lbl.includes("seksi") ||
        lbl.includes("divisi") ||
        lbl.includes("posisi") ||
        lbl.includes("pilihan 1") ||
        lbl.includes("minat")
      );
    }) ||
    submission.answers.find((a) => {
      const lbl = (a.field?.label || "").toLowerCase();
      return lbl.includes("marching") && !lbl.includes("pengalaman");
    });

  const posisi = pilihanField?.value?.trim() || "-";

  return { nama, rawHp, hp: cleanHp, posisi };
}
