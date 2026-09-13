import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Absensi,
  Anggota,
  Transaksi,
  TransaksiGroupWithStats,
  TransaksiDetail,
  RekrutmenForm,
  RekrutmenSubmissionWithAnswers,
} from "../types";
import {
  formatRupiah,
  formatTanggal,
  formatTanggalPanjang,
  hitungSaldo,
  hitungStatKehadiran,
  statusKeHuruf,
  formatNomorHp,
} from "../utils/format";
import logoUrl from "../aset/logo.png";
import poppinsRegular from "../aset/fonts/Poppins-Regular.ttf";
import poppinsSemiBold from "../aset/fonts/Poppins-SemiBold.ttf";
import poppinsBold from "../aset/fonts/Poppins-Bold.ttf";
import { getRekrutmenImageBase64Item } from "./api";

// ============================================================
// DESIGN SYSTEM PDF MB CHONDRO — "OFFICIAL ORGANIZATION REPORT"
// ============================================================
// Satu template global untuk SEMUA jenis laporan:
//   - Kertas A4 (ISO 216) 210 × 297 mm (Landscape / Portrait)
//   - Font: Poppins (Regular, SemiBold, Bold) di-embed saat runtime (fallback Helvetica)
//   - Kop Resmi 2-Tahap:
//       1. Identitas Organisasi (Logo + MB CHONDRO + SISTEM MANAJEMEN) di kiri, Periode & Cetak di kanan
//       2. Garis Pemisah Ganda (Burgundy + Slate)
//       3. Judul & Subtitle Laporan di bawah garis kop
//   - Rekap Metrik: Kartu ringkasan clean dengan aksen burgundy
//   - Tabel: Lebar kolom proporsional, alignment presisi, auto linebreak, header berulang di halaman lanjutan
//   - Footer: Garis pemisah tipis + identitas di kiri + "Halaman X dari Y" di kanan
// ============================================================

const BURGUNDY: [number, number, number] = [127, 29, 29]; // #7F1D1D - Merah Maroon mbc sistem
const NAVY: [number, number, number] = [15, 23, 42]; // #0F172A - Teks Utama / Judul
const BODY: [number, number, number] = [30, 41, 59]; // #1E293B - Teks Isi Tabel
const SLATE: [number, number, number] = [71, 85, 105]; // #475569 - Teks Sekunder
const MUTED: [number, number, number] = [100, 116, 139]; // #64748B - Label / Tanggal
const WHITE: [number, number, number] = [255, 255, 255];
const LINE: [number, number, number] = [226, 232, 240]; // #E2E8F0 - Border Tipis
const ROW_ALT: [number, number, number] = [248, 250, 252]; // #F8FAFC - Baris Berselang

// Warna latar status kehadiran pada matriks rekap
const STATUS_BG: Record<string, [number, number, number]> = {
  "•": [241, 245, 249], // Hadir - netral terang
  I: [254, 249, 195], // Izin - kuning lembut
  S: [254, 226, 226], // Sakit - merah muda lembut
  C: [237, 233, 254], // Cuti - ungu muda
  A: [255, 237, 213], // Alpa - oranye muda
  "*": [248, 250, 252], // Tidak ada catatan - abu-abu sangat muda
};

// Warna teks status kehadiran
const STATUS_TEXT: Record<string, [number, number, number]> = {
  "•": [30, 41, 59], // Hadir - gelap netral
  I: [161, 98, 7], // Izin - kuning/coklat tua
  S: [185, 28, 28], // Sakit - merah tua
  C: [109, 40, 217], // Cuti - ungu tua
  A: [194, 65, 12], // Alpa - oranye tua
  "*": [148, 163, 184], // Tidak ada catatan - abu-abu
};

const FONT_FALLBACK = "helvetica";
let fontFamily = FONT_FALLBACK;
let fontsReady = false;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Muat & embed Poppins (Regular/SemiBold/Bold) ke jsPDF — dijalankan sekali. */
async function ensureFonts(doc: jsPDF) {
  if (fontsReady) {
    doc.setFont(fontFamily, "normal");
    return;
  }
  try {
    const variants: { src: string; name: string; style: "normal" | "semibold" | "bold" }[] = [
      { src: poppinsRegular, name: "Poppins-Regular.ttf", style: "normal" },
      { src: poppinsSemiBold, name: "Poppins-SemiBold.ttf", style: "semibold" },
      { src: poppinsBold, name: "Poppins-Bold.ttf", style: "bold" },
    ];
    for (const v of variants) {
      const buf = await (await fetch(v.src)).arrayBuffer();
      doc.addFileToVFS(v.name, arrayBufferToBase64(buf));
      doc.addFont(v.name, "Poppins", v.style);
    }
    fontFamily = "Poppins";
  } catch {
    fontFamily = FONT_FALLBACK;
  }
  fontsReady = true;
  doc.setFont(fontFamily, "normal");
}

function semiboldStyle(): string {
  return fontFamily === "Poppins" ? "semibold" : "bold";
}

// Standar Ukuran Kertas A4 (ISO 216): 210 × 297 mm
const A4: [number, number] = [210, 297];

const MARGIN = 16;
const MARGIN_BOTTOM = 16;

const FONT_ORG = 16.5; // Nama organisasi
const FONT_ORG_SUB = 9.5; // Sub-identitas organisasi
const FONT_TITLE = 14.5; // Judul laporan
const FONT_SUBTITLE = 9; // Deskripsi laporan
const FONT_META = 8.5; // Periode & tanggal cetak
const FONT_TABLE = 8.5; // Isi & header tabel
const FONT_FOOTER = 8; // Footer dokumen

const SIMBOL_KEHADIRAN: Record<string, string> = {
  H: "•",
  I: "I",
  S: "S",
  C: "C",
  A: "A",
};

function simbolKehadiran(huruf: string): string {
  return SIMBOL_KEHADIRAN[huruf] ?? huruf;
}

// ---------- Logo Cache & Transparansi ----------
let logoCache: { dataUrl: string; w: number; h: number } | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat logo"));
    img.src = src;
  });
}

async function getLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (logoCache) return logoCache;
  try {
    const img = await loadImage(logoUrl);
    const maxDim = 900;
    const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 2);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      logoCache = { dataUrl: canvas.toDataURL("image/png"), w, h };
      return logoCache;
    }

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const crop = document.createElement("canvas");
    crop.width = cw;
    crop.height = ch;
    const cctx = crop.getContext("2d");
    if (!cctx) return null;
    cctx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    logoCache = { dataUrl: crop.toDataURL("image/png"), w: cw, h: ch };
    return logoCache;
  } catch {
    logoCache = null;
    return null;
  }
}

// ---------- Elemen Garis & Header ----------

function addTopBand(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BURGUNDY);
  doc.rect(0, 0, w, 2.5, "F");
}

function drawDoubleLine(doc: jsPDF, y: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...BURGUNDY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y + 1.0, w - MARGIN, y + 1.0);
}

/**
 * Header Halaman Pertama:
 * 1. Kop Organisasi di atas (Logo + Identitas di kiri, Periode + Dicetak di kanan).
 * 2. Garis Pemisah Ganda.
 * 3. Judul & Subtitle Laporan di bawah garis pemisah.
 */
async function drawFullHeader(
  doc: jsPDF,
  judul: string,
  subtitle: string,
  periode: string
): Promise<number> {
  await ensureFonts(doc);
  const w = doc.internal.pageSize.getWidth();
  addTopBand(doc);

  // --- 1. KOP ORGANISASI ---
  let textX = MARGIN;
  const logo = await getLogo();
  if (logo) {
    const logoH = 13.5;
    const logoW = (logoH * logo.w) / logo.h;
    try {
      doc.addImage(logo.dataUrl, "PNG", MARGIN, 8, logoW, logoH);
      textX = MARGIN + logoW + 5.5;
    } catch {
      // jika render gagal, fallback ke textX normal
    }
  }

  // Nama Organisasi
  doc.setFont(fontFamily, semiboldStyle());
  doc.setFontSize(FONT_ORG);
  doc.setTextColor(...BURGUNDY);
  doc.text("MB CHONDRO", textX, 15.5);

  // Tagline / Identitas
  doc.setFont(fontFamily, semiboldStyle());
  doc.setFontSize(FONT_ORG_SUB);
  doc.setTextColor(...NAVY);
  doc.text("SISTEM MANAJEMEN ORGANISASI", textX, 21.5);

  // Meta Periode & Tanggal Cetak (Kanan Atas)
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(FONT_META);
  doc.setTextColor(...SLATE);

  const periodeText = `Periode: ${periode}`;
  const cetakText = `Dicetak: ${formatTanggalPanjang(new Date().toISOString())}`;
  doc.text(periodeText, w - MARGIN, 15.5, { align: "right" });
  doc.text(cetakText, w - MARGIN, 21.5, { align: "right" });

  // Garis Pemisah Kop
  const lineY = 26.5;
  drawDoubleLine(doc, lineY);

  // --- 2. JUDUL & SUBTITLE LAPORAN (DI BAWAH GARIS KOP) ---
  let currentY = lineY + 7;
  const cleanJudul = judul.trim().toUpperCase();
  const reportTitle = cleanJudul.startsWith("LAPORAN")
    ? cleanJudul
    : `LAPORAN ${cleanJudul}`;

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(FONT_TITLE);
  doc.setTextColor(...NAVY);
  doc.text(reportTitle, MARGIN, currentY);

  if (subtitle && subtitle.trim()) {
    currentY += 5;
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(FONT_SUBTITLE);
    doc.setTextColor(...SLATE);
    doc.text(subtitle, MARGIN, currentY, { maxWidth: w - MARGIN * 2 });
  }

  return currentY + 4;
}

/** Header Halaman Lanjutan (Page 2+) */
function drawCompactHeader(doc: jsPDF) {
  addTopBand(doc);
  doc.setFont(fontFamily, semiboldStyle());
  doc.setFontSize(8.5);
  doc.setTextColor(...BURGUNDY);
  doc.text("MB CHONDRO — SISTEM MANAJEMEN ORGANISASI", MARGIN, 11);
  drawDoubleLine(doc, 13.5);
}

/** Footer Halaman: Garis tipis + Nama sistem di kiri + Nomor halaman di kanan */
function drawPageFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, h - MARGIN_BOTTOM + 2, w - MARGIN, h - MARGIN_BOTTOM + 2);

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(FONT_FOOTER);
  doc.setTextColor(...MUTED);
  doc.text("MB CHONDRO — Sistem Manajemen Organisasi", MARGIN, h - MARGIN_BOTTOM + 7);
  doc.text(`Halaman ${pageNumber} dari ${totalPages}`, w - MARGIN, h - MARGIN_BOTTOM + 7, {
    align: "right",
  });
}

// ---------- Summary / Kartu Ringkasan ----------

export interface SummaryItem {
  label: string;
  value: string;
}

/**
 * Render panel kartu ringkasan metrik (Summary Box) yang rapi, fluid, dan tidak tumpang tindih.
 */
function drawSummary(doc: jsPDF, items: SummaryItem[], startY: number): number {
  if (!items || items.length === 0) return startY;

  const w = doc.internal.pageSize.getWidth();
  const usable = w - MARGIN * 2;
  const numItems = items.length;

  // Tentukan kolom (maksimal 4 atau 5 per baris agar teks leluasa)
  const maxCols = numItems <= 4 ? numItems : numItems === 5 ? 5 : 4;
  const rows = Math.ceil(numItems / maxCols);

  const padTop = 3.5;
  const padBottom = 3.5;
  const rowH = 11;
  const labelSize = 7.5;
  const valueSize = 10.5;

  const accentW = 1.5;
  const padLeft = 4;
  const padRight = 4;
  const boxX = MARGIN;
  const boxY = startY + 1;
  const boxW = usable;
  const boxH = padTop + rows * rowH + padBottom;
  const cellW = (boxW - accentW - padLeft - padRight) / maxCols;

  // Background terang & border tipis
  doc.setFillColor(...ROW_ALT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");

  // Aksen merah maroon di tepi kiri
  doc.setFillColor(...BURGUNDY);
  doc.roundedRect(boxX, boxY + 1.5, accentW, boxH - 3, 0.75, 0.75, "F");

  items.forEach((item, i) => {
    const col = i % maxCols;
    const row = Math.floor(i / maxCols);
    const x = boxX + accentW + padLeft + col * cellW + 2;
    const labelY = boxY + padTop + row * rowH + 2.5;

    // Label
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(labelSize);
    doc.setTextColor(...MUTED);
    doc.text(item.label, x, labelY, { maxWidth: cellW - 4 });

    // Nilai
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(valueSize);
    doc.setTextColor(...NAVY);
    doc.text(item.value, x, labelY + 4.5, { maxWidth: cellW - 4 });
  });

  return boxY + boxH + 4.5;
}

/**
 * Ringkasan Khusus Matriks Rekap Absensi (Grid 4 Kolom x 2 Baris Seimbang)
 */
function drawAbsensiRekapSummary(
  doc: jsPDF,
  items: SummaryItem[],
  startY: number
): number {
  const w = doc.internal.pageSize.getWidth();
  const usable = w - MARGIN * 2;

  const COLS = 4;
  const ROWS = 2;

  const padTop = 3.5;
  const padBottom = 3.5;
  const rowH = 11.5;
  const labelSize = 8;
  const valueSize = 11;

  const accentW = 1.5;
  const padLeft = 4;
  const padRight = 4;
  const boxX = MARGIN;
  const boxY = startY + 1;
  const boxW = usable;
  const boxH = padTop + ROWS * rowH + padBottom;
  const cellW = (boxW - accentW - padLeft - padRight) / COLS;

  doc.setFillColor(...ROW_ALT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");

  doc.setFillColor(...BURGUNDY);
  doc.roundedRect(boxX, boxY + 1.5, accentW, boxH - 3, 0.75, 0.75, "F");

  items.forEach((item, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = boxX + accentW + padLeft + col * cellW + cellW / 2;
    const labelY = boxY + padTop + row * rowH + 2.5;

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(labelSize);
    doc.setTextColor(...MUTED);
    doc.text(item.label, x, labelY, { align: "center" });

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(valueSize);
    doc.setTextColor(...NAVY);
    doc.text(item.value, x, labelY + 4.8, { align: "center" });
  });

  return boxY + boxH + 4;
}

// ============================================================
// GENERATOR UTAMA PDF
// ============================================================

type Align = "left" | "center" | "right";

interface TableOptions {
  columns: string[];
  rows: (string | number)[][];
  columnAligns?: Align[];
  columnWidthRatios?: number[]; // rasio proporsional lebar kolom
  cellPadding?: number | { top: number; right: number; bottom: number; left: number };
  minCellHeight?: number;
  columnFontSizes?: number[];
  didParseCell?: (hookData: any) => void;
}

interface FooterTableOptions extends TableOptions {
  title: string;
  tableFontSize?: number;
  startNewPage?: boolean;
}

interface CreatePdfOptions extends TableOptions {
  orientation?: "portrait" | "landscape";
  summary?: SummaryItem[];
  drawSummaryCustom?: (doc: jsPDF, items: SummaryItem[], startY: number) => number;
  legend?: string;
  tableFontSize?: number;
  fileName?: string;
  footerTable?: FooterTableOptions;
}

function buildColumnStyles(
  columnAligns: Align[] | undefined,
  columnWidthRatios: number[] | undefined,
  usableWidth: number,
  columnFontSizes?: number[]
): Record<number, { halign?: Align; cellWidth?: number; fontSize?: number }> {
  const styles: Record<number, { halign?: Align; cellWidth?: number; fontSize?: number }> = {};
  const totalRatio = columnWidthRatios?.reduce((a, b) => a + b, 0) ?? 0;

  columnAligns?.forEach((align, i) => {
    if (align) styles[i] = { ...(styles[i] ?? {}), halign: align };
  });

  columnWidthRatios?.forEach((ratio, i) => {
    if (ratio && totalRatio > 0) {
      styles[i] = {
        ...(styles[i] ?? {}),
        cellWidth: (ratio / totalRatio) * usableWidth,
      };
    }
  });

  columnFontSizes?.forEach((fontSize, i) => {
    if (fontSize) styles[i] = { ...(styles[i] ?? {}), fontSize };
  });

  return styles;
}

async function createPdf(
  judul: string,
  subtitle: string,
  periode: string,
  opts: CreatePdfOptions
) {
  const orientation = opts.orientation ?? "landscape";
  const doc = new jsPDF({ orientation, unit: "mm", format: A4 });
  const fontSize = opts.tableFontSize ?? FONT_TABLE;
  await ensureFonts(doc);

  const usableWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
  let startY = await drawFullHeader(doc, judul, subtitle, periode);

  if (opts.summary && opts.summary.length > 0) {
    if (opts.drawSummaryCustom) {
      startY = opts.drawSummaryCustom(doc, opts.summary, startY);
    } else {
      startY = drawSummary(doc, opts.summary, startY);
    }
  }

  if (opts.legend) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(FONT_META);
    doc.setTextColor(...SLATE);
    doc.text(opts.legend, MARGIN, startY, { maxWidth: usableWidth });
    startY += 4.5;
  }

  startY += 1;

  const runTable = (
    table: TableOptions,
    tableStartY: number,
    tableFontSizeOverride?: number
  ) => {
    const tableFont = tableFontSizeOverride ?? fontSize;
    const colStyles = buildColumnStyles(
      table.columnAligns,
      table.columnWidthRatios,
      usableWidth,
      table.columnFontSizes
    );

    autoTable(doc, {
      startY: tableStartY,
      head: [table.columns],
      body: table.rows,
      margin: { left: MARGIN, right: MARGIN, top: 20, bottom: MARGIN_BOTTOM },
      styles: {
        font: fontFamily,
        fontSize: tableFont,
        cellPadding: table.cellPadding ?? { top: 2.4, right: 2.2, bottom: 2.4, left: 2.2 },
        textColor: BODY,
        lineColor: LINE,
        lineWidth: 0.15,
        overflow: "linebreak",
        valign: "middle",
        minCellHeight: table.minCellHeight ?? 6.5,
      },
      headStyles: {
        fillColor: BURGUNDY,
        textColor: WHITE,
        fontStyle: semiboldStyle() as "bold" | "italic" | "normal" | "bolditalic",
        fontSize: tableFont,
        halign: "center",
        cellPadding: { top: 2.8, right: 2.2, bottom: 2.8, left: 2.2 },
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: colStyles,
      rowPageBreak: "avoid",
      didParseCell: table.didParseCell,
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawCompactHeader(doc);
        }
      },
    });
  };

  runTable(opts, startY);

  // Footer Table (mis. Rekap Per Anggota pada Laporan Absensi)
  if (opts.footerTable) {
    const ft = opts.footerTable;
    const lastY = (doc as any).lastAutoTable?.finalY ?? startY;
    const pageH = doc.internal.pageSize.getHeight();
    let y = lastY + 8;

    if (ft.startNewPage || y + 24 > pageH - MARGIN_BOTTOM) {
      doc.addPage(A4, orientation);
      drawCompactHeader(doc);
      y = 20;
    }

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(ft.title, MARGIN, y);

    doc.setDrawColor(...BURGUNDY);
    doc.setLineWidth(0.35);
    doc.line(MARGIN, y + 1.5, doc.internal.pageSize.getWidth() - MARGIN, y + 1.5);
    y += 5.5;

    runTable(ft, y, ft.tableFontSize);
  }

  // Draw footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  const slug = judul.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(opts.fileName ?? `Laporan-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ============================================================
// 1. LAPORAN DATA ANGGOTA (Landscape A4)
// ============================================================
export async function laporanAnggota(anggota: Anggota[], periode: string) {
  const aktif = anggota.filter((a) => a.status === "Aktif").length;
  const cuti = anggota.filter((a) => a.status === "Cuti").length;
  const tidakAktif = anggota.filter((a) => a.status === "Tidak Aktif").length;

  const rows = anggota.map((a, i) => [
    i + 1,
    a.nama || "-",
    a.divisi || "-",
    a.noHp || "-",
    a.status || "-",
    formatTanggal(a.tanggalBergabung),
    a.keterangan || "-",
  ]);

  await createPdf(
    "DATA ANGGOTA MB CHONDRO",
    "Rekapitulasi data seluruh anggota aktif dan kepengurusan mbc sistem",
    periode,
    {
      orientation: "landscape",
      columns: ["No", "Nama Lengkap", "Divisi", "No. WhatsApp / HP", "Status", "Tgl Bergabung", "Keterangan"],
      rows,
      summary: [
        { label: "Total Anggota", value: `${anggota.length} Orang` },
        { label: "Anggota Aktif", value: `${aktif} Orang` },
        { label: "Status Cuti", value: `${cuti} Orang` },
        { label: "Tidak Aktif", value: `${tidakAktif} Orang` },
      ],
      columnWidthRatios: [10, 52, 32, 36, 26, 34, 75],
      columnAligns: ["center", "left", "left", "center", "center", "center", "left"],
      fileName: `Laporan-data-anggota-${new Date().toISOString().slice(0, 10)}.pdf`,
    }
  );
}

// ============================================================
// 2. LAPORAN RIWAYAT ABSENSI CATATAN (Landscape A4)
// ============================================================
export async function laporanAbsensi(absensi: Absensi[], periode: string) {
  const stat = hitungStatKehadiran(absensi);

  const rows = [...absensi]
    .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""))
    .map((a, i) => [
      i + 1,
      a.nama || "-",
      formatTanggal(a.tanggal),
      a.kegiatan || "-",
      a.waktu || "-",
      a.status || "-",
      a.keterangan || "-",
    ]);

  await createPdf(
    "RIWAYAT PRESENSI MB CHONDRO",
    "Catatan riwayat kehadiran anggota per sesi kegiatan mbc sistem",
    periode,
    {
      orientation: "landscape",
      columns: ["No", "Nama Lengkap", "Tanggal", "Kegiatan", "Waktu", "Status", "Keterangan"],
      rows,
      summary: [
        { label: "Total Hadir", value: `${stat.hadir} Sesi` },
        { label: "Total Izin", value: `${stat.izin} Sesi` },
        { label: "Total Sakit", value: `${stat.sakit} Sesi` },
        { label: "Total Cuti", value: `${stat.cuti} Sesi` },
        { label: "Total Alpa", value: `${stat.alpa} Sesi` },
        { label: "Persentase Kehadiran", value: `${stat.persentase}%` },
      ],
      columnWidthRatios: [10, 52, 28, 62, 24, 26, 63],
      columnAligns: ["center", "left", "center", "left", "center", "center", "left"],
      fileName: `Laporan-riwayat-absensi-${new Date().toISOString().slice(0, 10)}.pdf`,
    }
  );
}

// ============================================================
// 3. LAPORAN REKAP KEHADIRAN MATRIKS (Landscape A4)
// ============================================================
export async function laporanAbsensiRekap(
  anggota: Anggota[],
  absensi: Absensi[],
  periode: string
) {
  const sesiMap = new Map<string, Absensi[]>();
  for (const a of absensi) {
    const k = `${a.tanggal}|${(a.kegiatan || "").trim()}`;
    const arr = sesiMap.get(k);
    if (arr) arr.push(a);
    else sesiMap.set(k, [a]);
  }

  const kolomKunci = Array.from(sesiMap.keys()).sort((x, y) => {
    const [xd, xk] = x.split("|");
    const [yd, yk] = y.split("|");
    const c = xd.localeCompare(yd);
    if (c !== 0) return c;
    return (xk || "").localeCompare(yk || "");
  });

  const kolomHeader = kolomKunci.map((k) => {
    const [tanggal, kegiatan] = k.split("|");
    return `${formatTanggal(tanggal).slice(0, 5)}\n${kegiatan || "Kegiatan"}`;
  });

  const statusByMember = new Map<string, Map<string, string>>();
  const urutanPrioritas = ["Hadir", "Izin", "Sakit", "Cuti", "Alpa"];
  const ambilTerbaik = (a: string, b: string) =>
    urutanPrioritas.indexOf(a) < urutanPrioritas.indexOf(b) ? a : b;

  for (const a of absensi) {
    let m = statusByMember.get(a.idAnggota);
    if (!m) {
      m = new Map();
      statusByMember.set(a.idAnggota, m);
    }
    const kunci = `${a.tanggal}|${(a.kegiatan || "").trim()}`;
    const huruf = statusKeHuruf(a.status);
    m.set(kunci, m.has(kunci) ? ambilTerbaik(huruf, m.get(kunci) as string) : huruf);
  }

  const rows = anggota.map((ag, i) => [
    i + 1,
    ag.nama || "-",
    ag.divisi || "-",
    ...kolomKunci.map((k) => simbolKehadiran(statusByMember.get(ag.id)?.get(k) ?? "*")),
  ]);

  const rekapRows = anggota.map((ag, i) => {
    const m = statusByMember.get(ag.id);
    let hadir = 0,
      izin = 0,
      sakit = 0,
      cuti = 0,
      alpa = 0;
    for (const k of kolomKunci) {
      const letter = m?.get(k) ?? "*";
      if (letter === "H") hadir++;
      else if (letter === "I") izin++;
      else if (letter === "S") sakit++;
      else if (letter === "C") cuti++;
      else if (letter === "A") alpa++;
    }
    return [i + 1, ag.nama, hadir, izin, sakit, cuti, alpa, hadir + izin + sakit + cuti + alpa];
  });

  const stat = hitungStatKehadiran(absensi);
  const dateRatio = 8;
  const columnWidthRatios = [10, 52, 28, ...kolomKunci.map(() => dateRatio)];

  await createPdf("REKAPITULASI PRESENSI MB CHONDRO", "Matriks rekap kehadiran anggota per kegiatan & tanggal", periode, {
    orientation: "landscape",
    columns: ["No", "Nama Anggota", "Divisi", ...kolomHeader],
    rows,
    summary: [
      { label: "Total Anggota", value: `${anggota.length} Orang` },
      { label: "Total Hadir", value: `${stat.hadir} Sesi` },
      { label: "Total Izin", value: `${stat.izin} Sesi` },
      { label: "Total Sakit", value: `${stat.sakit} Sesi` },
      { label: "Total Cuti", value: `${stat.cuti} Sesi` },
      { label: "Total Alpa", value: `${stat.alpa} Sesi` },
      { label: "Persentase Kehadiran", value: `${stat.persentase}%` },
    ],
    drawSummaryCustom: drawAbsensiRekapSummary,
    tableFontSize: Math.max(7, Math.min(FONT_TABLE, 8)),
    columnWidthRatios,
    columnAligns: ["center", "left", "left", ...kolomKunci.map<Align>(() => "center")],
    fileName: `Laporan-rekap-absensi-${new Date().toISOString().slice(0, 10)}.pdf`,
    didParseCell: (hookData) => {
      if (hookData.column.index >= 3 && hookData.cell.section === "body") {
        const status = String(hookData.cell.raw);
        const bg = STATUS_BG[status] ?? STATUS_BG["*"];
        const tc = STATUS_TEXT[status] ?? STATUS_TEXT["*"];
        hookData.cell.styles.fillColor = bg;
        hookData.cell.styles.textColor = tc;
        hookData.cell.styles.halign = "center";
        hookData.cell.styles.valign = "middle";
      }
    },
    footerTable: {
      title: "REKAPITULASI TOTAL KEHADIRAN PER ANGGOTA",
      columns: ["No", "Nama Anggota", "Hadir", "Izin", "Sakit", "Cuti", "Alpa", "Total Kehadiran"],
      rows: rekapRows,
      tableFontSize: FONT_TABLE,
      startNewPage: true,
      columnWidthRatios: [10, 65, 24, 24, 24, 24, 24, 30],
      columnAligns: ["center", "left", "center", "center", "center", "center", "center", "center"],
    },
  });
}

// ============================================================
// 4. LAPORAN KEUANGAN KAS (Kas Chondro & Media) (Landscape A4)
// ============================================================
export async function laporanKeuangan(
  transaksi: Transaksi[],
  periode: string,
  judulKas: string
) {
  const saldo = hitungSaldo(transaksi);
  const sorted = [...transaksi].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));

  let running = 0;
  const rows = sorted.map((t, i) => {
    const nominal = Number(t.nominal) || 0;
    const pemasukan = t.jenis === "Pemasukan" ? nominal : 0;
    const pengeluaran = t.jenis === "Pengeluaran" ? nominal : 0;
    running += pemasukan - pengeluaran;
    return [
      i + 1,
      formatTanggal(t.tanggal),
      t.keterangan || "-",
      pemasukan ? formatRupiah(pemasukan) : "-",
      pengeluaran ? formatRupiah(pengeluaran) : "-",
      formatRupiah(running),
    ];
  });

  await createPdf(
    judulKas.toUpperCase(),
    `Laporan arus kas pemasukan dan pengeluaran ${judulKas}`,
    periode,
    {
      orientation: "landscape",
      columns: ["No", "Tanggal", "Keterangan / Rincian Transaksi", "Pemasukan", "Pengeluaran", "Saldo Kas"],
      rows,
      summary: [
        { label: "Total Pemasukan", value: formatRupiah(saldo.pemasukan) },
        { label: "Total Pengeluaran", value: formatRupiah(saldo.pengeluaran) },
        { label: "Sisa Saldo Kas", value: formatRupiah(saldo.saldo) },
      ],
      columnWidthRatios: [10, 30, 100, 42, 42, 44],
      columnAligns: ["center", "center", "left", "right", "right", "right"],
      fileName: `Laporan-${judulKas.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`,
    }
  );
}

// ============================================================
// 5. LAPORAN TRANSAKSI TEMPORER (Landscape A4)
// ============================================================
export async function laporanTransaksi(
  group: TransaksiGroupWithStats,
  details: TransaksiDetail[]
) {
  const sorted = [...details].sort((a, b) => (a.tanggal || "").localeCompare(b.tanggal || ""));
  let totalPemasukan = 0;
  let totalPengeluaran = 0;
  let running = 0;

  const rows = sorted.map((t, i) => {
    const nominal = Number(t.nominal) || 0;
    const pemasukan = t.jenis === "Pemasukan" ? nominal : 0;
    const pengeluaran = t.jenis === "Pengeluaran" ? nominal : 0;
    totalPemasukan += pemasukan;
    totalPengeluaran += pengeluaran;
    running += pemasukan - pengeluaran;

    return [
      i + 1,
      formatTanggal(t.tanggal),
      t.keterangan || "-",
      t.kategori || "-",
      pemasukan ? formatRupiah(pemasukan) : "-",
      pengeluaran ? formatRupiah(pengeluaran) : "-",
      formatRupiah(running),
    ];
  });

  const saldo = totalPemasukan - totalPengeluaran;
  const subtitle = group.keterangan
    ? `Laporan transaksi ${group.judul} — ${group.keterangan}`
    : `Laporan arus kas mutasi transaksi temporer ${group.judul}`;

  await createPdf(
    `TRANSAKSI TEMPORER — ${group.judul.toUpperCase()}`,
    subtitle,
    formatTanggalPanjang(group.tanggal),
    {
      orientation: "landscape",
      columns: ["No", "Tanggal", "Keterangan / Rincian Transaksi", "Kategori", "Pemasukan", "Pengeluaran", "Saldo Kas"],
      rows,
      summary: [
        { label: "Nama Transaksi", value: group.judul },
        { label: "Total Transaksi", value: `${details.length} Data` },
        { label: "Total Pemasukan", value: formatRupiah(totalPemasukan) },
        { label: "Total Pengeluaran", value: formatRupiah(totalPengeluaran) },
        { label: "Sisa Saldo Kas", value: formatRupiah(saldo) },
      ],
      columnWidthRatios: [10, 28, 92, 35, 33, 33, 34],
      columnAligns: ["center", "center", "left", "left", "right", "right", "right"],
      fileName: `Laporan-transaksi-${group.judul.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`,
    }
  );
}

// ============================================================
// ELEMEN KHUSUS REKRUTMEN: FOTO & PENILAIAN SELEKSI
// ============================================================

function normalizeImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:image/")) return url;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

function fetchImageAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cleanSrc = normalizeImageUrl(src);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    const timer = setTimeout(() => {
      resolve(null);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 400;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = cleanSrc;
  });
}

async function loadCandidatePhoto(
  submission: RekrutmenSubmissionWithAnswers
): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
  // Cari jawaban yang bertipe image atau memiliki kata kunci 'foto'
  const photoAnswer = submission.answers.find(
    (a) =>
      a.field?.fieldType === "image" ||
      a.fileType?.startsWith("image/") ||
      a.field?.label?.toLowerCase().includes("pas foto") ||
      a.field?.label?.toLowerCase().includes("foto") ||
      Boolean(a.fileName && /\.(jpe?g|png|webp|gif)$/i.test(a.fileName)) ||
      (a.fileUrl && (a.fileUrl.startsWith("data:image/") || /\.(jpe?g|png|webp|gif)/i.test(a.fileUrl) || a.fileUrl.includes("drive.google.com") || a.fileUrl.includes("lh3"))) ||
      (a.value && (a.value.startsWith("data:image/") || /\.(jpe?g|png|webp|gif)/i.test(a.value)))
  );

  if (!photoAnswer) return null;

  let rawSrc =
    photoAnswer.fileBase64 ||
    (photoAnswer.value && (photoAnswer.value.startsWith("data:image/") || photoAnswer.value.startsWith("http")) ? photoAnswer.value : null) ||
    photoAnswer.fileUrl;

  // Jika rawSrc belum berupa Data URL, coba ambil langsung dari backend Google Drive
  if (!rawSrc || !rawSrc.startsWith("data:image/")) {
    try {
      const match = rawSrc ? rawSrc.match(/[\/|=]([a-zA-Z0-9_-]{25,})/) : null;
      const fetched = await getRekrutmenImageBase64Item({
        fileId: match ? match[1] : undefined,
        fileName: photoAnswer.fileName || photoAnswer.value,
      });
      if (fetched.success && fetched.base64) {
        rawSrc = fetched.base64;
      }
    } catch {}
  }

  if (!rawSrc) return null;

  if (rawSrc.startsWith("data:image/")) {
    const isPng = rawSrc.startsWith("data:image/png");
    return { dataUrl: rawSrc, format: isPng ? "PNG" : "JPEG" };
  }

  try {
    const dataUrl = await fetchImageAsDataUrl(rawSrc);
    if (dataUrl) {
      return { dataUrl, format: "JPEG" };
    }
  } catch {
    // Fallback jika fetch gambar eksternal gagal
  }

  return null;
}

function drawPhotoPlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...ROW_ALT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "FD");

  // Bingkai putus-putus
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.rect(x + 1.5, y + 1.5, w - 3, h - 3, "D");
  doc.setLineDashPattern([], 0);

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text("PAS FOTO", x + w / 2, y + h / 2 - 2, { align: "center" });
  doc.setFontSize(6.5);
  doc.text("3 x 4 cm", x + w / 2, y + h / 2 + 2.5, { align: "center" });
}

async function drawCandidateSummaryWithPhoto(
  doc: jsPDF,
  items: SummaryItem[],
  submission: RekrutmenSubmissionWithAnswers,
  startY: number
): Promise<number> {
  const w = doc.internal.pageSize.getWidth();
  const leftX = MARGIN;
  const photoW = 36;
  const photoH = 48;
  const photoMarginRight = MARGIN;
  const photoX = w - photoMarginRight - photoW;
  const summaryW = photoX - leftX - 6;
  const boxH = Math.max(photoH, items.length * 10.5 + 4);

  // 1. Kotak Summary Informasi Calon di Sisi Kiri
  const itemH = (boxH - (items.length - 1) * 2.2) / items.length;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const iy = startY + i * (itemH + 2.2);

    doc.setFillColor(...ROW_ALT);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.roundedRect(leftX, iy, summaryW, itemH, 1.2, 1.2, "FD");

    // Aksen merah mbc sistem di sisi kiri item
    doc.setFillColor(...BURGUNDY);
    doc.roundedRect(leftX, iy + 0.5, 1.5, itemH - 1, 0.75, 0.75, "F");

    // Label
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    doc.text(it.label, leftX + 6, iy + itemH / 2 - 1.5);

    // Value
    doc.setFont(fontFamily, semiboldStyle());
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    const valText = doc.splitTextToSize(it.value, summaryW - 14)[0] || it.value;
    doc.text(valText, leftX + 6, iy + itemH / 2 + 3.4);
  }

  // 2. Kotak Pas Foto Calon Anggota di Sisi Kanan
  const photoY = startY;
  const photo = await loadCandidatePhoto(submission);

  if (photo) {
    try {
      // Background putih
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.rect(photoX - 0.5, photoY - 0.5, photoW + 1, photoH + 1, "FD");

      // Embed Foto Calon Anggota
      doc.addImage(photo.dataUrl, photo.format, photoX, photoY, photoW, photoH);

      // Frame Border Foto
      doc.setDrawColor(...BURGUNDY);
      doc.setLineWidth(0.4);
      doc.rect(photoX, photoY, photoW, photoH, "D");

      // Keterangan di bawah foto
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...SLATE);
      doc.text("Foto Calon Anggota", photoX + photoW / 2, photoY + photoH + 3.5, { align: "center" });
    } catch {
      drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH);
    }
  } else {
    drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH);
  }

  return startY + boxH + 4.5;
}

function drawSelectionDecisionBox(doc: jsPDF, startY: number): number {
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = w - MARGIN * 2;
  const boxX = MARGIN;
  const boxW = usable;
  const boxH = 46; // Tinggi proporsional untuk area penilaian + tanda tangan

  let boxY = startY + 4;
  if (boxY + boxH > pageH - MARGIN_BOTTOM - 2) {
    boxY = pageH - MARGIN_BOTTOM - boxH - 2;
  }

  // Background terang & border tipis
  doc.setFillColor(...ROW_ALT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.roundedRect(boxX, boxY, boxW, boxH, 1.5, 1.5, "FD");

  // Aksen burgundy di sisi kiri
  doc.setFillColor(...BURGUNDY);
  doc.roundedRect(boxX, boxY + 1.5, 1.5, boxH - 3, 0.75, 0.75, "F");

  // Judul Box
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text("HASIL PENILAIAN & KEPUTUSAN SELEKSI CALON ANGGOTA", boxX + 6, boxY + 5.8);

  // Garis tipis pembatas
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.15);
  doc.line(boxX + 6, boxY + 8, boxX + boxW - 6, boxY + 8);

  // Checkbox pilihan: Lolos, Cadangan, Tidak Lolos
  const checkY = boxY + 14.5;
  const cbSize = 4.5;

  // 1. Kotak [ ] Lolos
  const lolosX = boxX + 7;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.rect(lolosX, checkY - 3.4, cbSize, cbSize, "D");
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52); // Green
  doc.text("LOLOS", lolosX + cbSize + 3, checkY);

  // 2. Kotak [ ] Cadangan
  const cadanganX = boxX + 50;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.rect(cadanganX, checkY - 3.4, cbSize, cbSize, "D");
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 64, 175); // Blue
  doc.text("CADANGAN", cadanganX + cbSize + 3, checkY);

  // 3. Kotak [ ] Tidak Lolos
  const tidakLolosX = boxX + 100;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.rect(tidakLolosX, checkY - 3.4, cbSize, cbSize, "D");
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(185, 28, 28); // Red
  doc.text("TIDAK LOLOS", tidakLolosX + cbSize + 3, checkY);

  // Area Catatan Penilai
  const noteY = boxY + 22.5;
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(...SLATE);
  doc.text("Catatan Penilai:", boxX + 7, noteY);

  // Garis catatan tangan (handwritten notes)
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(boxX + 30, noteY, boxX + boxW - 60, noteY);
  doc.line(boxX + 7, noteY + 6, boxX + boxW - 60, noteY + 6);
  doc.line(boxX + 7, noteY + 12, boxX + boxW - 60, noteY + 12);
  doc.line(boxX + 7, noteY + 18, boxX + boxW - 60, noteY + 18);

  // Blok Tanda Tangan Penguji di Kanan
  const signX = boxX + boxW - 52;
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text("..................., .................... 2026", signX + 24, noteY - 3.5, { align: "center" });
  doc.text("Tim Penilai / Penguji mbc sistem,", signX + 24, noteY + 1.5, { align: "center" });

  doc.setFont(fontFamily, "normal");
  doc.setTextColor(...BODY);
  doc.text("( .................................................... )", signX + 24, noteY + 18, { align: "center" });

  return boxY + boxH + 3;
}

/**
 * Render 1 lembar khusus untuk 1 calon anggota baru (A4 Portrait) lengkap dengan Pas Foto
 */
async function renderCandidateSheet(
  doc: jsPDF,
  form: RekrutmenForm,
  submission: RekrutmenSubmissionWithAnswers,
  periodLabel?: string
) {
  const nama =
    submission.answers.find((a) => a.field?.label?.toLowerCase().includes("nama"))?.value ||
    "Calon Anggota";
  const rawHp =
    submission.answers.find(
      (a) =>
        a.field?.label?.toLowerCase().includes("hp") ||
        a.field?.label?.toLowerCase().includes("telepon") ||
        a.field?.label?.toLowerCase().includes("whatsapp") ||
        a.field?.label?.toLowerCase().includes("wa") ||
        a.field?.label?.toLowerCase().includes("kontak")
    )?.value ?? "";
  const hp = formatNomorHp(rawHp);

  const statusText =
    submission.status === "menunggu"
      ? "Menunggu"
      : submission.status === "lolos"
      ? "Lolos"
      : submission.status === "cadangan"
      ? "Cadangan"
      : "Tidak Lolos";

  const subtitle = `${nama} · ${form.title || "Rekrutmen Calon Anggota Baru"}`;
  const periode = periodLabel || formatTanggalPanjang(submission.submittedAt);

  let startY = await drawFullHeader(doc, "BIODATA & PENILAIAN CALON ANGGOTA", subtitle, periode);

  // Summary ringkas calon anggota dengan Pas Foto di sisi kanan
  startY = await drawCandidateSummaryWithPhoto(
    doc,
    [
      { label: "Nama Calon Anggota", value: nama },
      { label: "No. WhatsApp / HP", value: hp },
      { label: "Tanggal Pendaftaran", value: formatTanggal(submission.submittedAt) },
      { label: "Status Seleksi", value: statusText },
    ],
    submission,
    startY
  );

  const rows = submission.answers.map((a, i) => {
    const isPhoto =
      a.field?.fieldType === "image" ||
      a.field?.label?.toLowerCase().includes("foto") ||
      Boolean(a.fileUrl && (a.fileUrl.startsWith("data:image/") || a.fileUrl.includes("drive.google.com")));

    const isPhoneField =
      (a.field?.label || "").toLowerCase().includes("hp") ||
      (a.field?.label || "").toLowerCase().includes("telepon") ||
      (a.field?.label || "").toLowerCase().includes("whatsapp") ||
      (a.field?.label || "").toLowerCase().includes("wa") ||
      (a.field?.label || "").toLowerCase().includes("kontak");

    let val = a.value || "-";
    if (isPhoto) {
      val = "✓ Pas Foto Resmi Terlampir";
    } else if (a.field?.fieldType === "file" && a.fileUrl) {
      val = a.fileName ?? "Berkas Dokumen Terlampir";
    } else if (a.field?.fieldType === "checkbox") {
      val = a.value.split(",").filter(Boolean).join(", ");
    } else if (isPhoneField && a.value) {
      val = formatNomorHp(a.value);
    }

    return [
      i + 1,
      a.field?.label || `Pertanyaan ${i + 1}`,
      val,
    ];
  });

  const usableWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const colStyles = buildColumnStyles(
    ["center", "left", "left"],
    [8, 54, 88],
    usableWidth
  );

  autoTable(doc, {
    startY: startY,
    head: [["No", "Pertanyaan / Dokumen Formulir", "Jawaban Calon Anggota"]],
    body: rows,
    margin: { left: MARGIN, right: MARGIN, top: 20, bottom: 20 },
    styles: {
      font: fontFamily,
      fontSize: 9.2,
      cellPadding: { top: 3.0, right: 3.0, bottom: 3.0, left: 3.0 },
      textColor: BODY,
      lineColor: LINE,
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 7.5,
    },
    headStyles: {
      fillColor: BURGUNDY,
      textColor: WHITE,
      fontStyle: semiboldStyle() as "bold" | "italic" | "normal" | "bolditalic",
      fontSize: 9.8,
      halign: "center",
      cellPadding: { top: 3.2, right: 3.0, bottom: 3.2, left: 3.0 },
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: colStyles,
    rowPageBreak: "avoid",
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? (startY + 40);
  drawSelectionDecisionBox(doc, finalY + 4);
}

// ============================================================
// 6. LAPORAN DAFTAR CALON ANGGOTA BARU (1 Lembar per 1 Calon)
// ============================================================
export async function laporanRekrutmen(
  form: RekrutmenForm,
  submissions: RekrutmenSubmissionWithAnswers[],
  periodLabel?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: A4 });
  await ensureFonts(doc);

  if (submissions.length === 0) {
    let startY = await drawFullHeader(
      doc,
      "PENILAIAN CALON ANGGOTA",
      form.title || "Rekrutmen mbc sistem",
      periodLabel || formatTanggalPanjang(new Date().toISOString())
    );
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text("Tidak ada data calon anggota untuk dicetak.", MARGIN, startY + 10);
  } else {
    for (let i = 0; i < submissions.length; i++) {
      if (i > 0) {
        doc.addPage(A4, "portrait");
      }
      await renderCandidateSheet(doc, form, submissions[i], periodLabel);
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  doc.save(
    `Lembar-penilaian-${(form.title || "calon-anggota").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

// ============================================================
// 7. LAPORAN BIODATA DETAIL CALON ANGGOTA (1 Lembar per Calon)
// ============================================================
export async function laporanRekrutmenDetail(
  form: RekrutmenForm,
  submission: RekrutmenSubmissionWithAnswers
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: A4 });
  await ensureFonts(doc);

  await renderCandidateSheet(doc, form, submission);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  const nama =
    submission.answers.find((a) => a.field?.label?.toLowerCase().includes("nama"))?.value ||
    "calon-anggota";
  doc.save(
    `Lembar-penilaian-${nama.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}