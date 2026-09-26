import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderWithAnswers } from "../types";
import { formatTanggalPanjang } from "../utils/format";
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
  doc.text("Laporan Data Pesanan Customer", MARGIN, 33);

  doc.setFont("Poppins", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Filter / Kategori: ${filterTitle} · Total: ${orders.length} pesanan`, MARGIN, 38);

  // Table Data
  const tableData = orders.map((o, idx) => {
    // Ambil produk singkat dari answers
    const safeAnswers = Array.isArray(o.answers) ? o.answers : [];
    const jenisAnswer = safeAnswers.find((a) =>
      String(a?.label || "").toLowerCase().includes("jenis") || String(a?.label || "").toLowerCase().includes("produk")
    );
    const qtyAnswer = safeAnswers.find((a) =>
      String(a?.label || "").toLowerCase().includes("jumlah") || String(a?.label || "").toLowerCase().includes("qty")
    );
    const orderDesc = [
      jenisAnswer?.value || "-",
      qtyAnswer ? `(${qtyAnswer.value})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return [
      idx + 1,
      o.id,
      o.customerName,
      o.whatsapp,
      orderDesc || "Pesanan Custom",
      formatTanggalPanjang(o.createdAt).split(" ").slice(0, 3).join(" "),
      o.status.toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: 43,
    margin: { left: MARGIN, right: MARGIN },
    head: [["No", "ID", "Customer", "WhatsApp", "Jenis Pesanan", "Tanggal", "Status"]],
    body: tableData,
    theme: "plain",
    styles: {
      font: "Poppins",
      fontSize: 8,
      textColor: BODY,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
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
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 35 },
      3: { cellWidth: 28 },
      4: { cellWidth: 42 },
      5: { cellWidth: 25 },
      6: { cellWidth: 20, halign: "center", fontStyle: "bold" },
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
