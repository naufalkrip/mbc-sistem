import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderWithAnswers } from "../types";
import { formatTanggalPanjang, formatNomorHp, formatRupiah } from "../utils/format";
import logoUrl from "../aset/logo.png";
import poppinsRegular from "../aset/fonts/Poppins-Regular.ttf";
import poppinsSemiBold from "../aset/fonts/Poppins-SemiBold.ttf";
import poppinsBold from "../aset/fonts/Poppins-Bold.ttf";

// ============================================================
// KONFIGURASI WARNA & UKURAN DESAIN MB CHONDRO
// Sesuai Spesifikasi: Modern Soft Red Organization Dashboard
// ============================================================
const MERAH_PRIMARY: [number, number, number] = [220, 23, 23]; // #DC1717
const MERAH_DARK: [number, number, number] = [153, 27, 27]; // #991B1B
const MERAH_SOFT: [number, number, number] = [254, 242, 242]; // #FEF2F2
const MERAH_LIGHT: [number, number, number] = [254, 226, 226]; // #FEE2E2
const TEKS_GELAP: [number, number, number] = [23, 23, 23]; // #171717
const TEKS_MUTED: [number, number, number] = [100, 116, 139]; // #64748B
const TEKS_SLATE: [number, number, number] = [71, 85, 105]; // #475569
const ABU_HEADER: [number, number, number] = [241, 243, 245]; // #F1F3F5
const BORDER_TABLE: [number, number, number] = [203, 213, 225]; // #CBD5E1
const BORDER_DARK: [number, number, number] = [71, 85, 105]; // #475569

const SIZES_ANAK = ["XS", "S", "M", "L", "XL", "XXL"];
const SIZES_DEWASA = ["S", "M", "L", "XL", "XXL", "XXXL"];

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
    // fallback Arial / Helvetica
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

/**
 * Normalisasi ukuran dan kategorisasi (anak vs dewasa)
 */
function normalizeSizeAndCategory(
  rawSize: string,
  rawLabel = "",
  productName = ""
): { size: string; category: "anak" | "dewasa" } {
  const combined = `${rawSize} ${rawLabel} ${productName}`.toUpperCase();
  const s = rawSize.trim().toUpperCase();

  const isAnak =
    combined.includes("ANAK") ||
    combined.includes("KIDS") ||
    combined.includes("BABY") ||
    s.startsWith("NO.") ||
    s.startsWith("NO ") ||
    s === "XS";

  let cleanSize = s.replace(/ANAK|DEWASA|KIDS|ADULT|\(|\)|\[|\]/g, "").trim();

  if (isAnak) {
    if (cleanSize === "NO. 2" || cleanSize === "NO.2" || cleanSize === "2") cleanSize = "XS";
    else if (cleanSize === "NO. 4" || cleanSize === "NO.4" || cleanSize === "4") cleanSize = "S";
    else if (cleanSize === "NO. 6" || cleanSize === "NO.6" || cleanSize === "6") cleanSize = "M";
    else if (cleanSize === "NO. 8" || cleanSize === "NO.8" || cleanSize === "8") cleanSize = "L";
    else if (cleanSize === "NO. 10" || cleanSize === "NO.10" || cleanSize === "10") cleanSize = "XL";
    else if (cleanSize === "NO. 12" || cleanSize === "NO.12" || cleanSize === "12") cleanSize = "XXL";
  }

  if (cleanSize === "3XL" || cleanSize.startsWith("3XL") || cleanSize.startsWith("XXXL")) cleanSize = "XXXL";
  else if (cleanSize === "2XL" || cleanSize.startsWith("2XL") || cleanSize.startsWith("XXL")) cleanSize = "XXL";
  else if (cleanSize.startsWith("XL")) cleanSize = "XL";
  else if (cleanSize.startsWith("XS")) cleanSize = "XS";
  else if (cleanSize === "S" || cleanSize.startsWith("S ")) cleanSize = "S";
  else if (cleanSize === "M" || cleanSize.startsWith("M ")) cleanSize = "M";
  else if (cleanSize === "L" || cleanSize.startsWith("L ")) cleanSize = "L";
  else if (cleanSize.includes("4XL") || cleanSize.includes("5XL")) cleanSize = "XXXL";

  const category: "anak" | "dewasa" = isAnak ? "anak" : "dewasa";
  return { size: cleanSize || "L", category };
}

export interface OrderParsedItem {
  size: string;
  category: "Anak" | "Dewasa";
  sleeve: "Pendek" | "Panjang";
  qty: number;
  unitPrice: number;
  unitPriceStr: string;
  subtotal: number;
  subtotalStr: string;
  sizeLabel: string;
}

export interface ParsedCustomerOrder {
  order: OrderWithAnswers;
  items: OrderParsedItem[];
  totalQty: number;
  totalPrice: number;
  totalPriceStr: string;
  tanggalStr: string;
  adminNote?: string;
}

/**
 * Parsing seluruh rincian item setiap pesanan customer
 */
export function parseCustomerOrder(order: OrderWithAnswers): ParsedCustomerOrder {
  const safeAnswers = Array.isArray(order.answers) ? order.answers : [];
  const items: OrderParsedItem[] = [];
  let explicitTotalQty = 0;
  let explicitTotalPriceStr = "";

  safeAnswers.forEach((ans) => {
    if (!ans) return;
    const val = typeof ans.value === "string" ? ans.value : (ans.value != null ? String(ans.value) : "");
    if (val.includes("•")) {
      const lines = val.split("\n");
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("•")) {
          // Format bullet: • 1x [Ukuran L - Pendek] @ Rp80.000 = Rp80.000
          const match = trimmed.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\](?:\s*@\s*(.*?)=\s*(.*?))?$/i);
          if (match) {
            const qty = parseInt(match[1], 10) || 1;
            const rawSize = match[2].trim();
            const rawSleeve = match[3].trim();
            const rawUnitPrice = match[4] ? match[4].trim() : "";
            const rawSubtotal = match[5] ? match[5].trim() : "";

            const { size, category } = normalizeSizeAndCategory(rawSize, String(ans.label || ""), "");
            const isPanjang = rawSleeve.toLowerCase().includes("panjang");
            const sleeve: "Pendek" | "Panjang" = isPanjang ? "Panjang" : "Pendek";
            const categoryLabel: "Anak" | "Dewasa" = category === "anak" ? "Anak" : "Dewasa";

            const unitPriceNum = rawUnitPrice ? parseInt(rawUnitPrice.replace(/\D/g, ""), 10) || 0 : 0;
            const subtotalNum = rawSubtotal
              ? parseInt(rawSubtotal.replace(/\D/g, ""), 10) || (unitPriceNum * qty)
              : (unitPriceNum * qty);

            items.push({
              size,
              category: categoryLabel,
              sleeve,
              qty,
              unitPrice: unitPriceNum,
              unitPriceStr: rawUnitPrice || (unitPriceNum > 0 ? formatRupiah(unitPriceNum) : "-"),
              subtotal: subtotalNum,
              subtotalStr: rawSubtotal || (subtotalNum > 0 ? formatRupiah(subtotalNum) : "-"),
              sizeLabel: `${size} ${categoryLabel}`,
            });
          }
        } else if (trimmed.includes("Total:")) {
          const matchTotal = trimmed.match(/Total:\s*(\d+)\s*pcs(?:\s*\|\s*(.*?))?$/i);
          if (matchTotal) {
            explicitTotalQty = parseInt(matchTotal[1], 10) || 0;
            if (matchTotal[2]) explicitTotalPriceStr = matchTotal[2].trim();
          }
        }
      });
    }
  });

  // Fallback jika jawaban tidak menggunakan format bullet
  if (items.length === 0) {
    const sizeAns = safeAnswers.find(
      (a) => a && (String(a?.label || "").toLowerCase().includes("ukuran") || String(a?.label || "").toLowerCase().includes("size"))
    );
    const sleeveAns = safeAnswers.find(
      (a) => a && (String(a?.label || "").toLowerCase().includes("lengan") || String(a?.label || "").toLowerCase().includes("model"))
    );
    const qtyAns = safeAnswers.find(
      (a) => a && (String(a?.label || "").toLowerCase().includes("jumlah") || String(a?.label || "").toLowerCase().includes("qty"))
    );
    const priceAns = safeAnswers.find(
      (a) => a && (String(a?.label || "").toLowerCase().includes("harga") || String(a?.label || "").toLowerCase().includes("total"))
    );

    const rawSize = sizeAns && sizeAns.value ? String(sizeAns.value).trim() : "L";
    const rawSleeve = sleeveAns && sleeveAns.value ? String(sleeveAns.value).trim() : "Pendek";
    const qty = qtyAns && qtyAns.value ? parseInt(String(qtyAns.value).replace(/\D/g, ""), 10) || 1 : 1;
    const rawPrice = priceAns && priceAns.value ? parseInt(String(priceAns.value).replace(/\D/g, ""), 10) || 0 : 0;

    const { size, category } = normalizeSizeAndCategory(rawSize, String(sizeAns?.label || ""), "");
    const isPanjang = rawSleeve.toLowerCase().includes("panjang");
    const sleeve: "Pendek" | "Panjang" = isPanjang ? "Panjang" : "Pendek";
    const categoryLabel: "Anak" | "Dewasa" = category === "anak" ? "Anak" : "Dewasa";

    items.push({
      size,
      category: categoryLabel,
      sleeve,
      qty,
      unitPrice: rawPrice > 0 ? Math.round(rawPrice / qty) : 0,
      unitPriceStr: rawPrice > 0 ? formatRupiah(Math.round(rawPrice / qty)) : "-",
      subtotal: rawPrice,
      subtotalStr: rawPrice > 0 ? formatRupiah(rawPrice) : "-",
      sizeLabel: `${size} ${categoryLabel}`,
    });
  }

  const calcTotalQty = items.reduce((sum, it) => sum + it.qty, 0);
  const calcTotalPrice = items.reduce((sum, it) => sum + it.subtotal, 0);

  const totalQty = explicitTotalQty > 0 ? explicitTotalQty : calcTotalQty;
  const totalPrice = explicitTotalPriceStr
    ? parseInt(explicitTotalPriceStr.replace(/\D/g, ""), 10) || calcTotalPrice
    : calcTotalPrice;
  const totalPriceStr = explicitTotalPriceStr || (totalPrice > 0 ? formatRupiah(totalPrice) : "-");

  // Format tanggal rapi
  let tanggalStr = "-";
  if (order.createdAt) {
    try {
      const d = new Date(order.createdAt);
      if (!Number.isNaN(d.getTime())) {
        const hariArr = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const bulanArr = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember",
        ];
        tanggalStr = `${hariArr[d.getDay()]}, ${d.getDate()} ${bulanArr[d.getMonth()]} ${d.getFullYear()}`;
      } else {
        tanggalStr = order.createdAt;
      }
    } catch {
      tanggalStr = order.createdAt;
    }
  }

  return {
    order,
    items,
    totalQty,
    totalPrice,
    totalPriceStr,
    tanggalStr,
    adminNote: order.adminNote || undefined,
  };
}

// ---------------- EXPORT CSV ----------------
export function exportOrdersToCSV(orders: OrderWithAnswers[], filename = "data-pesanan-mbc.csv") {
  const headers = [
    "No",
    "Nama Customer",
    "WhatsApp",
    "Tanggal Pesanan",
    "Rincian Item",
    "Total Pesanan",
    "Status Pesanan",
    "Status Pembayaran",
    "Nominal DP",
    "Catatan Admin",
  ];

  const rows = orders.map((o, idx) => {
    const parsed = parseCustomerOrder(o);
    const rincianText = parsed.items
      .map((it) => `${it.sizeLabel} (${it.sleeve}) ${it.qty}x @ ${it.unitPriceStr}`)
      .join(" ; ");

    const isLunas = o.paymentStatus === "lunas";
    const isDp = o.paymentStatus === "dp" || (o.dpAmount && o.dpAmount > 0);
    const bayarLabel = isLunas ? "LUNAS" : isDp ? "DP" : "BELUM DP";

    return [
      idx + 1,
      `"${(o.customerName || "").replace(/"/g, '""')}"`,
      `"${o.whatsapp || ""}"`,
      `"${parsed.tanggalStr}"`,
      `"${rincianText.replace(/"/g, '""')}"`,
      `"${parsed.totalPriceStr}"`,
      `"${(o.status || "masuk").toUpperCase()}"`,
      `"${bayarLabel}"`,
      o.dpAmount ? `"${formatRupiah(o.dpAmount)}"` : '""',
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

// ============================================================
// MAIN GENERATOR: PDF LAPORAN REKAP & DETAIL PESANAN MB CHONDRO
// Sesuai Spesifikasi Prompt Resmi
// ============================================================
export async function exportOrdersToPDF(
  orders: OrderWithAnswers[],
  filterTitle = "Semua Pesanan",
  filename = "laporan-pesanan-mbc.pdf"
) {
  // Format A4 Landscape [297 × 210 mm]
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [297, 210] });
  await ensureFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;
  const printWidth = pageWidth - 2 * margin; // 273mm

  // Parse seluruh customer orders
  const parsedOrders = orders.map((o) => parseCustomerOrder(o));

  // Hitung Agregasi untuk 5 Tabel Rekapitulasi
  const mapPendekAnak: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
  const mapPendekDewasa: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0, XXXL: 0 };
  const mapPanjangAnak: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
  const mapPanjangDewasa: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0, XXXL: 0 };

  parsedOrders.forEach((po) => {
    po.items.forEach((it) => {
      const isPanjang = it.sleeve === "Panjang";
      const isAnak = it.category === "Anak";
      const sz = it.size;

      if (!isPanjang) {
        if (isAnak) {
          mapPendekAnak[sz] = (mapPendekAnak[sz] || 0) + it.qty;
        } else {
          mapPendekDewasa[sz] = (mapPendekDewasa[sz] || 0) + it.qty;
        }
      } else {
        if (isAnak) {
          mapPanjangAnak[sz] = (mapPanjangAnak[sz] || 0) + it.qty;
        } else {
          mapPanjangDewasa[sz] = (mapPanjangDewasa[sz] || 0) + it.qty;
        }
      }
    });
  });

  const totPendekAnak = SIZES_ANAK.reduce((sum, sz) => sum + (mapPendekAnak[sz] || 0), 0);
  const totPendekDewasa = SIZES_DEWASA.reduce((sum, sz) => sum + (mapPendekDewasa[sz] || 0), 0);
  const totPanjangAnak = SIZES_ANAK.reduce((sum, sz) => sum + (mapPanjangAnak[sz] || 0), 0);
  const totPanjangDewasa = SIZES_DEWASA.reduce((sum, sz) => sum + (mapPanjangDewasa[sz] || 0), 0);
  const grandTotalItems = totPendekAnak + totPendekDewasa + totPanjangAnak + totPanjangDewasa;

  // -------------------------------------------------------------
  // RENDER HEADER HALAMAN UTAMA (HALAMAN 1)
  // -------------------------------------------------------------
  const drawMainHeader = async () => {
    // Aksen baris merah tipis di ujung atas halaman
    doc.setFillColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
    doc.rect(0, 0, pageWidth, 2.5, "F");

    // Bagian Kiri: Logo + MB CHONDRO + Subtitle
    let textLeftX = margin;
    const logo = await getLogo();
    if (logo) {
      const logoH = 14;
      const logoW = (logoH * logo.w) / logo.h;
      try {
        doc.addImage(logo.dataUrl, "PNG", margin, 6.5, logoW, logoH);
        textLeftX = margin + logoW + 4.5;
      } catch {}
    }

    doc.setFont("Poppins", "bold");
    doc.setFontSize(14);
    doc.setTextColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
    doc.text("MB CHONDRO", textLeftX, 12.5);

    doc.setFont("Poppins", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(TEKS_SLATE[0], TEKS_SLATE[1], TEKS_SLATE[2]);
    doc.text("Manajemen Organisasi & Pemesanan", textLeftX, 17.5);

    // Bagian Kanan: Judul Utama, Periode, Dicetak
    const titleText = "LAPORAN REKAP & DETAIL PESANAN";
    doc.setFont("Poppins", "bold");
    doc.setFontSize(13);
    doc.setTextColor(TEKS_GELAP[0], TEKS_GELAP[1], TEKS_GELAP[2]);
    const titleW = doc.getTextWidth(titleText);
    doc.text(titleText, pageWidth - margin - titleW, 11.5);

    doc.setFont("Poppins", "normal");
    doc.setFontSize(8);
    doc.setTextColor(TEKS_MUTED[0], TEKS_MUTED[1], TEKS_MUTED[2]);
    const filterInfo = `Kategori / Periode: ${filterTitle || "Semua Pesanan"}`;
    doc.text(filterInfo, pageWidth - margin - doc.getTextWidth(filterInfo), 16.5);

    const now = new Date();
    const cetakStr = `Dicetak: ${formatTanggalPanjang(now.toISOString())}`;
    doc.text(cetakStr, pageWidth - margin - doc.getTextWidth(cetakStr), 21);

    // Garis horizontal merah pemisah header dan isi dokumen
    doc.setDrawColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
    doc.setLineWidth(0.7);
    doc.line(margin, 25, pageWidth - margin, 25);
  };

  await drawMainHeader();

  // -------------------------------------------------------------
  // A. PERUBAHAN TABEL REKAP — HALAMAN 1
  // Susunan: 4 tabel pertama 2 kolom x 2 baris, Tabel TOTAL di bawahnya
  // -------------------------------------------------------------
  const rekapStartY = 29;
  const colWidth = (printWidth - 8) / 2; // 132.5mm per kolom
  const col1X = margin;
  const col2X = margin + colWidth + 8;

  // Fungsi pembantu render tabel rekap mini
  const renderRekapMiniTable = (
    title: string,
    sizes: string[],
    dataMap: Record<string, number>,
    totalSum: number,
    startX: number,
    startY: number
  ): number => {
    const tableRows = sizes.map((sz, idx) => [idx + 1, sz, dataMap[sz] || 0]);
    tableRows.push(["", "JUMLAH", totalSum]);

    autoTable(doc, {
      startY,
      margin: { left: startX, right: pageWidth - (startX + colWidth) },
      head: [
        [{ content: title, colSpan: 3, styles: { halign: "center", fontStyle: "bold", fillColor: MERAH_LIGHT, textColor: MERAH_DARK } }],
        ["No.", "Ukuran", "Jumlah"],
      ],
      body: tableRows,
      theme: "plain",
      styles: {
        font: "Poppins",
        fontSize: 7.2,
        textColor: TEKS_GELAP,
        cellPadding: { top: 1.4, right: 2, bottom: 1.4, left: 2 },
        halign: "center",
        lineWidth: 0.12,
        lineColor: BORDER_DARK,
      },
      headStyles: {
        fillColor: MERAH_SOFT,
        textColor: TEKS_GELAP,
        fontStyle: "bold",
        fontSize: 7.2,
        halign: "center",
        lineWidth: 0.12,
        lineColor: BORDER_DARK,
        cellPadding: { top: 1.6, right: 2, bottom: 1.6, left: 2 },
      },
      columnStyles: {
        0: { cellWidth: 16, halign: "center" },
        1: { cellWidth: (colWidth - 16) / 2, halign: "center", fontStyle: "bold" },
        2: { cellWidth: (colWidth - 16) / 2, halign: "center", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        // Baris JUMLAH dibuat tebal dengan background merah muda lembut
        if (data.section === "body" && data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = MERAH_LIGHT;
          data.cell.styles.textColor = MERAH_DARK;
        }
      },
    });

    return (doc as any).lastAutoTable.finalY;
  };

  // 1. Tabel 1 — PENDEK ANAK (Baris 1, Kolom 1)
  const finalYTab1 = renderRekapMiniTable("PENDEK ANAK", SIZES_ANAK, mapPendekAnak, totPendekAnak, col1X, rekapStartY);

  // 2. Tabel 2 — PENDEK DEWASA (Baris 1, Kolom 2)
  const finalYTab2 = renderRekapMiniTable("PENDEK DEWASA", SIZES_DEWASA, mapPendekDewasa, totPendekDewasa, col2X, rekapStartY);

  const row2StartY = Math.max(finalYTab1, finalYTab2) + 3;

  // 3. Tabel 3 — PANJANG ANAK (Baris 2, Kolom 1)
  const finalYTab3 = renderRekapMiniTable("PANJANG ANAK", SIZES_ANAK, mapPanjangAnak, totPanjangAnak, col1X, row2StartY);

  // 4. Tabel 4 — PANJANG DEWASA (Baris 2, Kolom 2)
  const finalYTab4 = renderRekapMiniTable("PANJANG DEWASA", SIZES_DEWASA, mapPanjangDewasa, totPanjangDewasa, col2X, row2StartY);

  const row3StartY = Math.max(finalYTab3, finalYTab4) + 3;

  // 5. Tabel 5 — TOTAL (Di bawah keempat tabel rekap)
  const totalRows = [
    ["PENDEK", "DEWASA", totPendekDewasa],
    ["PANJANG", "DEWASA", totPanjangDewasa],
    ["PENDEK", "ANAK", totPendekAnak],
    ["PANJANG", "ANAK", totPanjangAnak],
    ["TOTAL KESELURUHAN", "", grandTotalItems],
  ];

  autoTable(doc, {
    startY: row3StartY,
    margin: { left: margin, right: margin },
    head: [
      [{ content: "TOTAL REKAPITULASI MODEL & KATEGORI", colSpan: 3, styles: { halign: "center", fontStyle: "bold", fillColor: MERAH_LIGHT, textColor: MERAH_DARK } }],
      ["MODEL", "KATEGORI", "JUMLAH"],
    ],
    body: totalRows,
    theme: "plain",
    styles: {
      font: "Poppins",
      fontSize: 7.2,
      textColor: TEKS_GELAP,
      cellPadding: { top: 1.4, right: 3, bottom: 1.4, left: 3 },
      halign: "center",
      lineWidth: 0.12,
      lineColor: BORDER_DARK,
    },
    headStyles: {
      fillColor: MERAH_SOFT,
      textColor: TEKS_GELAP,
      fontStyle: "bold",
      fontSize: 7.2,
      halign: "center",
      lineWidth: 0.12,
      lineColor: BORDER_DARK,
      cellPadding: { top: 1.6, right: 3, bottom: 1.6, left: 3 },
    },
    columnStyles: {
      0: { cellWidth: printWidth * 0.38, halign: "center", fontStyle: "bold" },
      1: { cellWidth: printWidth * 0.38, halign: "center", fontStyle: "bold" },
      2: { cellWidth: printWidth * 0.24, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      // Baris TOTAL KESELURUHAN
      if (data.section === "body" && data.row.index === totalRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = MERAH_LIGHT;
        data.cell.styles.textColor = MERAH_DARK;
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 6;

  // -------------------------------------------------------------
  // B. LABEL MERAH "DAFTAR PESANAN CUSTOMER"
  // Rounded rectangle merah dengan tulisan putih
  // -------------------------------------------------------------
  const badgeW = 68;
  const badgeH = 7.2;
  doc.setFillColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
  doc.roundedRect(margin, currentY, badgeW, badgeH, 2, 2, "F");

  doc.setFont("Poppins", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DAFTAR PESANAN CUSTOMER", margin + badgeW / 2, currentY + 4.9, { align: "center" });

  currentY += badgeH + 3.5;

  // -------------------------------------------------------------
  // C. TABEL DETAIL CUSTOMER & RINCIAN ITEM BERUPA TABEL
  // Struktur Kolom: No | Nama Customer | WhatsApp | Tanggal | Rincian Item | Total Pesanan | Status | Pembayaran
  // -------------------------------------------------------------
  // Lebar Kolom Total: 273mm
  // 0: No (8mm)
  // 1: Nama Customer (36mm)
  // 2: WhatsApp (28mm)
  // 3: Tanggal (28mm)
  // 4: Rincian Item (109mm) -> Tempat render mini-table per customer
  // 5: Total Pesanan (24mm)
  // 6: Status (20mm)
  // 7: Pembayaran (20mm)

  const customerTableBody: any[] = parsedOrders.length === 0
    ? [
        [
          {
            content: "Tidak ada data pesanan yang sesuai kriteria filter saat ini.",
            colSpan: 8,
            styles: { halign: "center", fontStyle: "italic", textColor: TEKS_MUTED, cellPadding: 8 },
          },
        ],
      ]
    : parsedOrders.map((po, idx) => {
        // Teks kosong pada Rincian Item, Status, dan Pembayaran karena di-render custom di didDrawCell
        return [
          idx + 1,
          po.order.customerName || "-",
          po.order.whatsapp ? formatNomorHp(po.order.whatsapp) : "-",
          po.tanggalStr,
          "", // Rincian Item custom table
          po.totalPriceStr,
          "", // Status badge
          "", // Pembayaran badge
        ];
      });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      ["No.", "Nama Customer", "WhatsApp", "Tanggal", "Rincian Item", "Total Pesanan", "Status", "Pembayaran"],
    ],
    body: customerTableBody,
    theme: "plain",
    styles: {
      font: "Poppins",
      fontSize: 7.2,
      textColor: TEKS_GELAP,
      cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
      overflow: "linebreak",
      lineWidth: 0.1,
      lineColor: BORDER_TABLE,
      valign: "middle",
    },
    headStyles: {
      fillColor: ABU_HEADER,
      textColor: TEKS_GELAP,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      cellPadding: { top: 3.2, right: 2.5, bottom: 3.2, left: 2.5 },
      lineWidth: 0.12,
      lineColor: BORDER_DARK,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 36, fontStyle: "bold", halign: "left" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 28, halign: "center", fontSize: 6.8 },
      4: { cellWidth: 109 }, // Mini-table container
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 20, halign: "center" },
      7: { cellWidth: 20, halign: "center" },
    },
    showHead: "everyPage",
    rowPageBreak: "avoid", // Jangan memecah satu baris customer ke dua halaman
    didParseCell: (data) => {
      // Hitung tinggi minimal baris customer sesuai jumlah item rincian
      if (data.section === "body") {
        const rowIdx = data.row.index;
        const po = parsedOrders[rowIdx];
        if (po) {
          const itemCount = po.items.length || 1;
          const miniH = 4.5 + itemCount * 4.6 + (po.adminNote ? 4.8 : 0);
          data.cell.styles.minCellHeight = Math.max(12, miniH + 3);
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const rowIdx = data.row.index;
      const po = parsedOrders[rowIdx];
      if (!po) return;

      // 1. RENDER MINI-TABLE DI KOLOM 4 (RINCIAN ITEM)
      if (data.column.index === 4) {
        const cellX = data.cell.x + 1.2;
        const cellY = data.cell.y + 1.5;
        const cellW = data.cell.width - 2.4;

        // Proporsi kolom mini-table: Ukuran | Model Lengan | Qty | Harga
        const colW1 = 34; // Ukuran (misal: "L Dewasa", "M Anak")
        const colW2 = 25; // Model Lengan (misal: "Pendek", "Panjang")
        const colW3 = 18; // Qty (misal: "1 pcs")
        // Sisa lebar (cellW - 77) untuk kolom Harga

        const headerH = 4.2;
        const itemRowH = 4.4;

        // Background header mini-table
        doc.setFillColor(241, 243, 245);
        doc.rect(cellX, cellY, cellW, headerH, "F");

        // Teks header mini-table
        doc.setFont("Poppins", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Ukuran", cellX + 3, cellY + 3);
        doc.text("Model Lengan", cellX + colW1 + 3, cellY + 3);
        doc.text("Qty", cellX + colW1 + colW2 + colW3 / 2, cellY + 3, { align: "center" });
        doc.text("Harga", cellX + cellW - 3, cellY + 3, { align: "right" });

        // Garis pemisah header
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.1);
        doc.line(cellX, cellY + headerH, cellX + cellW, cellY + headerH);
        doc.line(cellX + colW1, cellY, cellX + colW1, cellY + headerH);
        doc.line(cellX + colW1 + colW2, cellY, cellX + colW1 + colW2, cellY + headerH);
        doc.line(cellX + colW1 + colW2 + colW3, cellY, cellX + colW1 + colW2 + colW3, cellY + headerH);

        // Render setiap item baris demi baris
        let currItemY = cellY + headerH;
        po.items.forEach((item, itIdx) => {
          if (itIdx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(cellX, currItemY, cellW, itemRowH, "F");
          }

          doc.setFont("Poppins", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(23, 23, 23);

          doc.text(item.sizeLabel || item.size, cellX + 3, currItemY + 3.1);
          doc.text(item.sleeve, cellX + colW1 + 3, currItemY + 3.1);
          doc.text(`${item.qty} pcs`, cellX + colW1 + colW2 + colW3 / 2, currItemY + 3.1, { align: "center" });
          doc.text(item.unitPriceStr || "-", cellX + cellW - 3, currItemY + 3.1, { align: "right" });

          // Grid lines baris item
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.1);
          doc.line(cellX, currItemY + itemRowH, cellX + cellW, currItemY + itemRowH);
          doc.line(cellX + colW1, currItemY, cellX + colW1, currItemY + itemRowH);
          doc.line(cellX + colW1 + colW2, currYItem(currItemY), cellX + colW1 + colW2, currItemY + itemRowH);
          doc.line(cellX + colW1 + colW2 + colW3, currItemY, cellX + colW1 + colW2 + colW3, currItemY + itemRowH);

          currItemY += itemRowH;
        });

        function currYItem(y: number) { return y; }

        // Border luar tabel mini rincian item
        const miniTotalH = headerH + po.items.length * itemRowH;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.12);
        doc.rect(cellX, cellY, cellW, miniTotalH, "S");

        // Catatan admin jika ada
        if (po.adminNote) {
          doc.setFont("Poppins", "normal");
          doc.setFontSize(6);
          doc.setTextColor(153, 27, 27);
          doc.text(`📌 Catatan: ${po.adminNote}`, cellX + 1, currItemY + 3.6);
        }
      }

      // 2. RENDER BADGE STATUS DI KOLOM 6
      if (data.column.index === 6) {
        const st = (po.order.status || "masuk").toLowerCase();
        let bg: [number, number, number] = [254, 243, 199];
        let text: [number, number, number] = [217, 119, 6];
        let border: [number, number, number] = [253, 230, 138];
        let label = "MASUK";

        if (st === "diproses") {
          bg = [219, 234, 254];
          text = [37, 99, 235];
          border = [191, 219, 254];
          label = "DIPROSES";
        } else if (st === "selesai") {
          bg = [220, 252, 231];
          text = [22, 163, 74];
          border = [187, 247, 208];
          label = "SELESAI";
        }

        const badgeW = 17;
        const badgeH = 5;
        const badgeX = data.cell.x + (data.cell.width - badgeW) / 2;
        const badgeY = data.cell.y + (data.cell.height - badgeH) / 2;

        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.15);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, "FD");

        doc.setFont("Poppins", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(text[0], text[1], text[2]);
        doc.text(label, badgeX + badgeW / 2, badgeY + 3.4, { align: "center" });
      }

      // 3. RENDER BADGE PEMBAYARAN DI KOLOM 7
      if (data.column.index === 7) {
        const isLunas = po.order.paymentStatus === "lunas";
        const isDp = po.order.paymentStatus === "dp" || (po.order.dpAmount && po.order.dpAmount > 0);

        let bg: [number, number, number] = [254, 226, 226];
        let text: [number, number, number] = [220, 38, 38];
        let border: [number, number, number] = [254, 202, 202];
        let label = "Belum DP";

        if (isLunas) {
          bg = [220, 252, 231];
          text = [22, 163, 74];
          border = [187, 247, 208];
          label = "Lunas";
        } else if (isDp) {
          bg = [254, 243, 199];
          text = [217, 119, 6];
          border = [253, 230, 138];
          const dpNominal = po.order.dpAmount ? formatRupiah(po.order.dpAmount).replace(" ", "") : "";
          label = dpNominal ? `DP ${dpNominal}` : "Sudah DP";
        }

        const badgeW = 18;
        const badgeH = 5;
        const badgeX = data.cell.x + (data.cell.width - badgeW) / 2;
        const badgeY = data.cell.y + (data.cell.height - badgeH) / 2;

        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.15);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, "FD");

        doc.setFont("Poppins", "bold");
        doc.setFontSize(5.8);
        doc.setTextColor(text[0], text[1], text[2]);
        doc.text(label, badgeX + badgeW / 2, badgeY + 3.4, { align: "center" });
      }
    },
  });

  // Teks ringkasan di bawah tabel utama pada halaman terakhir
  const finalTableY = (doc as any).lastAutoTable.finalY || 180;
  if (finalTableY < pageHeight - 16) {
    doc.setFont("Poppins", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEKS_MUTED[0], TEKS_MUTED[1], TEKS_MUTED[2]);
    doc.text(`Menampilkan 1–${orders.length} dari ${orders.length} pesanan.`, margin, finalTableY + 5);
  }

  // -------------------------------------------------------------
  // D. FOOTER KONSISTEN & HEADER HALAMAN LANJUTAN (HALAMAN 2+)
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Header untuk Halaman Lanjutan (Page 2 dan seterusnya)
    if (i > 1) {
      doc.setFillColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
      doc.rect(0, 0, pageWidth, 2, "F");

      doc.setFont("Poppins", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
      doc.text("MB CHONDRO", margin, 7.5);

      doc.setFont("Poppins", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(TEKS_SLATE[0], TEKS_SLATE[1], TEKS_SLATE[2]);
      doc.text("· Laporan Rekap & Detail Pesanan (Lanjutan)", margin + doc.getTextWidth("MB CHONDRO") + 2, 7.5);

      doc.setDrawColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, 10.5, pageWidth - margin, 10.5);
    }

    // Footer di setiap halaman
    const footerY = pageHeight - 8;

    // Garis merah pembatas footer
    doc.setDrawColor(MERAH_PRIMARY[0], MERAH_PRIMARY[1], MERAH_PRIMARY[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5);

    doc.setFont("Poppins", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(TEKS_SLATE[0], TEKS_SLATE[1], TEKS_SLATE[2]);

    // Kiri: Halaman X dari Y
    doc.text(`Halaman ${i} dari ${totalPages}`, margin, footerY + 1.5);

    // Kanan: MB CHONDRO — Laporan Pesanan
    const rightFooter = "MB CHONDRO — Laporan Pesanan";
    doc.text(rightFooter, pageWidth - margin - doc.getTextWidth(rightFooter), footerY + 1.5);
  }

  doc.save(filename);
}
