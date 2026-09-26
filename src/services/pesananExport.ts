import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderWithAnswers } from "../types";
import { formatTanggalPanjang, formatNomorHp, formatRupiah, getSizeRank } from "../utils/format";
import logoUrl from "../aset/logo.png";
import poppinsRegular from "../aset/fonts/Poppins-Regular.ttf";
import poppinsSemiBold from "../aset/fonts/Poppins-SemiBold.ttf";
import poppinsBold from "../aset/fonts/Poppins-Bold.ttf";

const A4: [number, number] = [210, 297]; // Portrait
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

function drawDoubleLine(doc: jsPDF, y: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...BURGUNDY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y + 1.0, w - MARGIN, y + 1.0);
}

function drawPageFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const y = h - 9;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y - 2, w - MARGIN, y - 2);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: A4 });
  await ensureFonts(doc);

  const w = doc.internal.pageSize.getWidth();

  // Top band
  doc.setFillColor(...BURGUNDY);
  doc.rect(0, 0, w, 2.5, "F");

  // Kop Organisasi
  let textX = MARGIN;
  const logo = await getLogo();
  if (logo) {
    const logoH = 13.5;
    const logoW = (logoH * logo.w) / logo.h;
    try {
      doc.addImage(logo.dataUrl, "PNG", MARGIN, 8, logoW, logoH);
      textX = MARGIN + logoW + 5.5;
    } catch {}
  }

  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BURGUNDY);
  doc.text("MB CHONDRO", textX, 13);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text("SISTEM MANAJEMEN ORGANISASI & PEMESANAN", textX, 17.5);

  const printDate = `Dicetak: ${formatTanggalPanjang(new Date().toISOString())}`;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(printDate, w - MARGIN - doc.getTextWidth(printDate), 17.5);

  drawDoubleLine(doc, 25);

  // Judul Laporan
  doc.setFont("Poppins", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Laporan Rekap & Detail Pesanan Customer", MARGIN, 32);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Filter / Kategori: ${filterTitle} · Total Data: ${orders.length} Pesanan`, MARGIN, 37);

  // Calculate Summary Statistics (Rekap)
  const masukCount = orders.filter((o) => o.status === "masuk").length;
  const diprosesCount = orders.filter((o) => o.status === "diproses").length;
  const selesaiCount = orders.filter((o) => o.status === "selesai").length;

  const lunasCount = orders.filter((o) => o.paymentStatus === "lunas").length;
  const dpCount = orders.filter((o) => o.paymentStatus === "dp" || (o.dpAmount && o.dpAmount > 0)).length;
  const belumBayarCount = orders.filter((o) => o.paymentStatus === "belum_bayar" && (!o.dpAmount || o.dpAmount === 0)).length;
  const totalDpAmount = orders.reduce((sum, o) => sum + (o.dpAmount || 0), 0);

  // Draw Summary Panel Box
  const summaryBoxY = 41;
  const boxHeight = 21;
  doc.setFillColor(...ROW_ALT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, summaryBoxY, w - 2 * MARGIN, boxHeight, "FD");

  doc.setFont("Poppins", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BURGUNDY);
  doc.text("RINGKASAN REKAP PESANAN & STATUS PEMBAYARAN", MARGIN + 4, summaryBoxY + 5);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BODY);
  doc.text(`Status Pengerjaan :  Masuk (${masukCount})   |   Diproses (${diprosesCount})   |   Selesai (${selesaiCount})`, MARGIN + 4, summaryBoxY + 11);
  doc.text(`Status Pembayaran :  Lunas (${lunasCount})   |   DP (${dpCount})   |   Belum Bayar (${belumBayarCount})   |   Total DP Terkumpul: ${formatRupiah(totalDpAmount)}`, MARGIN + 4, summaryBoxY + 16.5);

  // ----------------------------------------------------
  // REKAPITULASI TOTAL UKURAN & LENGAN PRODUK (FOR PDF)
  // ----------------------------------------------------
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

    // Separate sleeve: Lengan Pendek first, Lengan Panjang second
    const isPanjangA = a.sleeve.toLowerCase().includes("panjang");
    const isPanjangB = b.sleeve.toLowerCase().includes("panjang");
    if (isPanjangA !== isPanjangB) {
      return isPanjangA ? 1 : -1;
    }

    // Sort by size rank (anak-anak ke dewasa, terkecil ke terbesar)
    const rankA = getSizeRank(a.size);
    const rankB = getSizeRank(b.size);
    if (rankA !== rankB) return rankA - rankB;

    return a.size.localeCompare(b.size);
  });

  let currentY = summaryBoxY + boxHeight + 4;

  // Render Product Size & Sleeve Summary Table if items exist
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
      margin: { left: MARGIN, right: MARGIN },
      head: [["No", "Nama Produk", "Model Lengan", "Size / Ukuran", "Total Pcs"]],
      body: recapTableData,
      theme: "plain",
      styles: {
        font: "Poppins",
        fontSize: 7.5,
        textColor: BODY,
        cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
        overflow: "linebreak",
        lineWidth: 0.1,
        lineColor: LINE,
      },
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      },
      alternateRowStyles: {
        fillColor: ROW_ALT,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 55, fontStyle: "bold" },
        2: { cellWidth: 45 },
        3: { cellWidth: 45, fontStyle: "bold" },
        4: { cellWidth: 29, halign: "right", fontStyle: "bold" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Section Header for Customer Detail
  doc.setFont("Poppins", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text("RINCIAN DETAIL PESANAN PER CUSTOMER", MARGIN, currentY);

  // Table Data (Detailed Customer breakdown without ID)
  const tableData = orders.map((o, idx) => {
    const safeAnswers = Array.isArray(o.answers) ? o.answers : [];

    // Customer & Contact
    const waText = o.whatsapp ? formatNomorHp(o.whatsapp) : "-";
    const customerCell = `${o.customerName || "-"}\nWA: ${waText}`;

    // Tanggal
    const tanggalCell = formatTanggalPanjang(o.createdAt).split(" ").slice(0, 3).join(" ");

    // Main Product / Jenis
    const jenisAnswer = safeAnswers.find(
      (a) =>
        a &&
        (String(a?.label || "").toLowerCase().includes("jenis") ||
          String(a?.label || "").toLowerCase().includes("produk") ||
          String(a?.label || "").toLowerCase().includes("model"))
    );
    const mainProduct = jenisAnswer?.value ? String(jenisAnswer.value) : "";

    // Parse Variants & Qty
    const variantLines: string[] = [];
    let totalQty = 0;
    let totalPriceStr = "";

    safeAnswers.forEach((ans) => {
      if (!ans) return;
      const ansValStr = typeof ans.value === "string" ? ans.value : (ans.value != null ? String(ans.value) : "");
      if (ansValStr.includes("•")) {
        const lines = ansValStr.split("\n");
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("•")) {
            variantLines.push(trimmed);
          } else if (trimmed.includes("Total:")) {
            const matchTotal = trimmed.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*(.*?))?$/i);
            if (matchTotal) {
              totalQty = parseInt(matchTotal[1], 10);
              if (matchTotal[2]) totalPriceStr = matchTotal[2].trim();
            }
          }
        });
      }
    });

    // Other Form Details
    const otherDetails: string[] = [];
    safeAnswers.forEach((ans) => {
      if (!ans) return;
      const label = String(ans.label || "").trim();
      const val = typeof ans.value === "string" ? ans.value : String(ans.value || "");
      if (!label || !val) return;

      const lowerLabel = label.toLowerCase();
      if (
        lowerLabel.includes("nama") ||
        lowerLabel.includes("whatsapp") ||
        lowerLabel.includes("no hp") ||
        lowerLabel.includes("jenis")
      ) {
        return;
      }
      if (val.includes("•")) return;

      otherDetails.push(`${label}: ${val}`);
    });

    const rincianParts: string[] = [];
    if (mainProduct) {
      rincianParts.push(`Produk: ${mainProduct}`);
    }
    if (variantLines.length > 0) {
      rincianParts.push("Varian / Size:");
      variantLines.forEach((vl) => rincianParts.push(`  ${vl}`));
    }
    if (totalQty > 0 || totalPriceStr) {
      rincianParts.push(`Total: ${totalQty > 0 ? totalQty + " pcs" : ""} ${totalPriceStr ? "| " + totalPriceStr : ""}`);
    }
    if (otherDetails.length > 0) {
      rincianParts.push("Detail Form:");
      otherDetails.forEach((od) => rincianParts.push(`  • ${od}`));
    }
    if (o.adminNote) {
      rincianParts.push(`Catatan: ${o.adminNote}`);
    }

    const detailText = rincianParts.length > 0 ? rincianParts.join("\n") : "Pesanan Custom";

    // Status Pesanan
    const statusText = (o.status || "masuk").toUpperCase();

    // Pembayaran Text
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
      customerCell,
      tanggalCell,
      detailText,
      statusText,
      paymentText,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: MARGIN, right: MARGIN },
    head: [["No", "Customer & Kontak", "Tanggal", "Rincian Item & Detail Pesanan", "Status", "Pembayaran"]],
    body: tableData,
    theme: "plain",
    styles: {
      font: "Poppins",
      fontSize: 8,
      textColor: BODY,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      overflow: "linebreak",
      lineWidth: 0.1,
      lineColor: LINE,
    },
    headStyles: {
      fillColor: BURGUNDY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.2,
      halign: "left",
      cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 },
    },
    alternateRowStyles: {
      fillColor: ROW_ALT,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 38, fontStyle: "bold" },
      2: { cellWidth: 24 },
      3: { cellWidth: 68 },
      4: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
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
