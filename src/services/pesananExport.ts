import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderWithAnswers } from "../types";
import { formatTanggalPanjang, formatNomorHp, formatRupiah, getSizeRank } from "../utils/format";
import logoUrl from "../aset/logo.png";
import poppinsRegular from "../aset/fonts/Poppins-Regular.ttf";
import poppinsSemiBold from "../aset/fonts/Poppins-SemiBold.ttf";
import poppinsBold from "../aset/fonts/Poppins-Bold.ttf";

const MARGIN = 14;

const BURGUNDY: [number, number, number] = [127, 29, 29]; // #7F1D1D
const NAVY: [number, number, number] = [15, 23, 42]; // #0F172A
const BODY: [number, number, number] = [30, 41, 59]; // #1E293B
const SLATE: [number, number, number] = [71, 85, 105]; // #475569
const MUTED: [number, number, number] = [100, 116, 139]; // #64748B
const WHITE: [number, number, number] = [255, 255, 255];
const LINE: [number, number, number] = [226, 232, 240]; // #E2E8F0
const ROW_ALT: [number, number, number] = [248, 250, 252];

let fontsLoaded = false;
async function ensureFonts(doc: jsPDF) {
  if (fontsLoaded) return;
  try {
    const toBase64 = async (url: string) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return btoa(bin);
    };

    const [reg, semi, bld] = await Promise.all([
      toBase64(poppinsRegular),
      toBase64(poppinsSemiBold),
      toBase64(poppinsBold),
    ]);

    doc.addFileToVFS("Poppins-Regular.ttf", reg);
    doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
    doc.addFileToVFS("Poppins-SemiBold.ttf", semi);
    doc.addFont("Poppins-SemiBold.ttf", "Poppins", "bold");
    doc.addFileToVFS("Poppins-Bold.ttf", bld);
    doc.addFont("Poppins-Bold.ttf", "Poppins", "bold");
    fontsLoaded = true;
  } catch {
    // fallback helvetica
  }
}

let logoCache: { dataUrl: string; w: number; h: number } | null = null;
async function getLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (logoCache) return logoCache;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      logoCache = { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
      resolve(logoCache);
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}

function drawPageFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const y = h - 9;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y - 2, w - MARGIN, y - 2);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("MB CHONDRO · Sistem Manajemen Organisasi & Pemesanan", MARGIN, y + 1.5);

  const right = `Halaman ${pageNumber} dari ${totalPages}`;
  doc.text(right, w - MARGIN - doc.getTextWidth(right), y + 1.5);
}

// ---------------- EXPORT CSV ----------------
export function exportOrdersToCSV(orders: OrderWithAnswers[], filename = "data-pesanan-mbc.csv") {
  const headers = [
    "ID Pesanan",
    "Customer",
    "WhatsApp",
    "Status",
    "Tanggal Pesanan",
    "Rincian Jawaban",
    "Catatan Admin",
  ];

  const rows = orders.map((o) => {
    const safeAnswers = Array.isArray(o.answers) ? o.answers : [];
    const detailText = safeAnswers
      .map((a) => `${a?.label || ""}: ${a?.value || ""}`)
      .join(" | ")
      .replace(/"/g, '""');

    return [
      `"${o.id}"`,
      `"${(o.customerName || "").replace(/"/g, '""')}"`,
      `"${o.whatsapp || ""}"`,
      `"${(o.status || "").toUpperCase()}"`,
      `"${formatTanggalPanjang(o.createdAt)}"`,
      `"${detailText}"`,
      `"${(o.adminNote || "").replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------- EXPORT PDF ----------------
export async function exportOrdersToPDF(
  orders: OrderWithAnswers[],
  filterTitle = "Semua Pesanan",
  filename = "laporan-pesanan-mbc.pdf"
) {
  // Format Landscape A4 [297 x 210 mm] agar seluruh informasi muat dengan rapi & lega
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [297, 210] });
  await ensureFonts(doc);

  const w = doc.internal.pageSize.getWidth(); // 297mm
  const margin = 12;
  const printW = w - 2 * margin; // 273mm

  // Accent band di bagian paling atas
  doc.setFillColor(BURGUNDY[0], BURGUNDY[1], BURGUNDY[2]);
  doc.rect(0, 0, w, 2.5, "F");

  // Kop Organisasi
  let textX = margin;
  const logo = await getLogo();
  if (logo) {
    const logoH = 13;
    const logoW = (logoH * logo.w) / logo.h;
    try {
      doc.addImage(logo.dataUrl, "PNG", margin, 7.5, logoW, logoH);
      textX = margin + logoW + 5;
    } catch {}
  }

  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(BURGUNDY[0], BURGUNDY[1], BURGUNDY[2]);
  doc.text("MB CHONDRO", textX, 12.5);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text("SISTEM MANAJEMEN ORGANISASI & PEMESANAN", textX, 17);

  const printDate = `Dicetak: ${formatTanggalPanjang(new Date().toISOString())}`;
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(printDate, w - margin - doc.getTextWidth(printDate), 17);

  // Garis pemisah ganda
  doc.setDrawColor(BURGUNDY[0], BURGUNDY[1], BURGUNDY[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, 23.5, w - margin, 23.5);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.15);
  doc.line(margin, 24.3, w - margin, 24.3);

  // Judul Laporan
  doc.setFont("Poppins", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("Laporan Rekap & Detail Pesanan Customer", margin, 31);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`Kategori: ${filterTitle}   ·   Total Data: ${orders.length} Pesanan`, margin, 36);

  // Hitung Statistik Ringkasan
  const masukCount = orders.filter((o) => o.status === "masuk").length;
  const diprosesCount = orders.filter((o) => o.status === "diproses").length;
  const selesaiCount = orders.filter((o) => o.status === "selesai").length;

  const lunasCount = orders.filter((o) => o.paymentStatus === "lunas").length;
  const dpCount = orders.filter((o) => o.paymentStatus === "dp" || (o.dpAmount && o.dpAmount > 0)).length;
  const belumBayarCount = orders.filter((o) => o.paymentStatus === "belum_bayar" && (!o.dpAmount || o.dpAmount === 0)).length;
  const totalDpAmount = orders.reduce((sum, o) => sum + (o.dpAmount || 0), 0);

  // Box Panel Ringkasan Rekap
  const summaryBoxY = 39.5;
  const boxHeight = 17;
  doc.setFillColor(ROW_ALT[0], ROW_ALT[1], ROW_ALT[2]);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, summaryBoxY, printW, boxHeight, "FD");

  doc.setFont("Poppins", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BURGUNDY[0], BURGUNDY[1], BURGUNDY[2]);
  doc.text("RINGKASAN REKAP PESANAN & STATUS PEMBAYARAN", margin + 4, summaryBoxY + 5);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(BODY[0], BODY[1], BODY[2]);
  doc.text(`Status Pengerjaan :  Masuk (${masukCount})   |   Diproses (${diprosesCount})   |   Selesai (${selesaiCount})`, margin + 4, summaryBoxY + 10);
  doc.text(`Status Pembayaran :  Lunas (${lunasCount})   |   DP (${dpCount})   |   Belum Bayar (${belumBayarCount})   |   Total DP Terkumpul: ${formatRupiah(totalDpAmount)}`, margin + 4, summaryBoxY + 14.5);

  // Rekapitulasi Produk & Ukuran
  const recapMap = new Map<string, { product: string; size: string; sleeve: string; qty: number }>();

  orders.forEach((o) => {
    const safeAnswers = Array.isArray(o.answers) ? o.answers : [];
    const jenisAnswer = safeAnswers.find(
      (a) =>
        a &&
        (String(a?.label || "").toLowerCase().includes("jenis") ||
          String(a?.label || "").toLowerCase().includes("produk"))
    );
    const productName = jenisAnswer && typeof jenisAnswer.value === "string" ? jenisAnswer.value : "Pesanan Produk";

    safeAnswers.forEach((ans) => {
      if (!ans) return;
      const ansValStr = typeof ans.value === "string" ? ans.value : String(ans.value || "");
      if (ansValStr.includes("•")) {
        const lines = ansValStr.split("\n");
        lines.forEach((line) => {
          if (line.trim().startsWith("•")) {
            const match = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\]/i);
            if (match) {
              const qty = parseInt(match[1], 10);
              const size = match[2].trim();
              const sleeve = match[3].trim();

              const key = `${productName}|${size}|${sleeve}`;
              const existing = recapMap.get(key);
              if (existing) {
                existing.qty += qty;
              } else {
                recapMap.set(key, { product: productName, size, sleeve, qty });
              }
            }
          }
        });
      }
    });
  });

  const recapItems = Array.from(recapMap.values());
  recapItems.sort((a, b) => {
    if (a.product !== b.product) return a.product.localeCompare(b.product);
    const isPanjangA = a.sleeve.toLowerCase().includes("panjang");
    const isPanjangB = b.sleeve.toLowerCase().includes("panjang");
    if (isPanjangA !== isPanjangB) return isPanjangA ? 1 : -1;
    const rankA = getSizeRank(a.size);
    const rankB = getSizeRank(b.size);
    if (rankA !== rankB) return rankA - rankB;
    return a.size.localeCompare(b.size);
  });

  let currentY = summaryBoxY + boxHeight + 4;

  if (recapItems.length > 0) {
    const recapTableData = recapItems.map((item, idx) => [
      idx + 1,
      item.product,
      item.sleeve,
      item.size,
      `${item.qty} Pcs`,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["No", "Nama Produk", "Model Lengan", "Size / Ukuran", "Total Pcs"]],
      body: recapTableData,
      theme: "plain",
      styles: {
        font: "Poppins",
        fontSize: 7,
        textColor: BODY,
        cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
        overflow: "linebreak",
        lineWidth: 0.1,
        lineColor: LINE,
      },
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "left",
        cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
      },
      alternateRowStyles: {
        fillColor: ROW_ALT,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 85, fontStyle: "bold" },
        2: { cellWidth: 65 },
        3: { cellWidth: 65, fontStyle: "bold" },
        4: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;
  }

  // Section Sub-Header
  doc.setFont("Poppins", "bold");
  doc.setFontSize(9);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("DAFTAR & RINCIAN DETAIL PESANAN", margin, currentY);

  // Lebar kolom tabel utama (Total: 273mm)
  // 0: No (8mm)
  // 1: ID Pesanan (22mm)
  // 2: Customer & WA (40mm)
  // 3: Tanggal Pesanan (24mm)
  // 4: Rincian Jawaban & Detail Pesanan (125mm)
  // 5: Status (22mm)
  // 6: Pembayaran (32mm)

  const tableData = orders.map((o, idx) => {
    const safeAnswers = Array.isArray(o.answers) ? o.answers : [];

    const idText = o.id || `ORD-${idx + 1}`;
    const waText = o.whatsapp ? formatNomorHp(o.whatsapp) : "-";
    const customerCell = `${o.customerName || "-"}\nWA: ${waText}`;
    const tanggalCell = formatTanggalPanjang(o.createdAt);

    // Susun seluruh jawaban & informasi formulir tanpa ada yang terlewat
    const rincianParts: string[] = [];

    safeAnswers.forEach((ans) => {
      if (!ans) return;
      const label = String(ans.label || "").trim();
      const val = typeof ans.value === "string" ? ans.value : (ans.value != null ? String(ans.value) : "");

      if (!label && !val && !ans.fileUrl) return;

      const lowerLabel = label.toLowerCase();
      // Lewati pengulangan nama/WA jika sudah ada di kolom Customer & WA
      if (
        lowerLabel === "nama" ||
        lowerLabel === "nama lengkap" ||
        lowerLabel === "nama customer" ||
        lowerLabel === "nomor whatsapp" ||
        lowerLabel === "no whatsapp" ||
        lowerLabel === "no hp" ||
        lowerLabel === "no. whatsapp"
      ) {
        return;
      }

      // Format matriks varian / ukuran jika ada
      if (val.includes("•")) {
        rincianParts.push(`[${label || "Rincian Ukuran & Qty"}]`);
        const lines = val.split("\n");
        lines.forEach((l) => {
          if (l.trim()) rincianParts.push(`  ${l.trim()}`);
        });
        return;
      }

      // Jawaban pertanyaan biasa
      if (label) {
        rincianParts.push(`• ${label}: ${val || "-"}`);
      } else if (val) {
        rincianParts.push(`• ${val}`);
      }

      // Tautan / Lampiran Berkas File jika ada
      if (ans.fileUrl) {
        rincianParts.push(`  📷 File: ${ans.fileName || "Berkas Terlampir"} (${ans.fileUrl})`);
      }
    });

    if (o.adminNote) {
      rincianParts.push(`📌 Catatan Admin: ${o.adminNote}`);
    }

    const detailText = rincianParts.length > 0 ? rincianParts.join("\n") : "Tidak Ada Detail Tambahan";

    const statusText = (o.status || "masuk").toUpperCase();

    const isLunas = o.paymentStatus === "lunas";
    const isDp = o.paymentStatus === "dp" || (o.dpAmount && o.dpAmount > 0);
    let paymentText = "Belum Bayar";
    if (isLunas) {
      paymentText = "✓ LUNAS";
    } else if (isDp) {
      paymentText = `DP: ${formatRupiah(o.dpAmount || 0)}`;
    }

    return [
      idx + 1,
      idText,
      customerCell,
      tanggalCell,
      detailText,
      statusText,
      paymentText,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: margin, right: margin },
    head: [["No", "ID Pesanan", "Customer & Kontak", "Tanggal Pesanan", "Rincian Jawaban & Detail Pesanan", "Status", "Pembayaran"]],
    body: tableData,
    theme: "plain",
    styles: {
      font: "Poppins",
      fontSize: 7,
      textColor: BODY,
      cellPadding: { top: 2.2, right: 2.5, bottom: 2.2, left: 2.5 },
      overflow: "linebreak",
      lineWidth: 0.1,
      lineColor: LINE,
    },
    headStyles: {
      fillColor: BURGUNDY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 40, fontStyle: "bold" },
      3: { cellWidth: 24 },
      4: { cellWidth: 125 },
      5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => {},
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  doc.save(filename);
}
