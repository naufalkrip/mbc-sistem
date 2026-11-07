import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp, X, Shirt } from "lucide-react";
import type { OrderWithAnswers } from "../../types";

interface OrderRecapProps {
  orders: OrderWithAnswers[];
  onItemClick?: (product: string, size: string, sleeve: string) => void;
}

const SIZES_ANAK = ["XS", "S", "M", "L", "XL", "XXL"];
const SIZES_DEWASA = ["S", "M", "L", "XL", "XXL", "XXXL"];

/**
 * Normalisasi ukuran dan kategorisasi (anak vs dewasa)
 */
function normalizeSizeAndCategory(
  rawSize: string,
  rawLabel: string,
  productName: string
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

  // Bersihkan teks ukuran
  let cleanSize = s.replace(/ANAK|DEWASA|KIDS|ADULT|\(|\)|\[|\]/g, "").trim();

  // Mapping ukuran nomor anak jika ada
  if (isAnak) {
    if (cleanSize === "NO. 2" || cleanSize === "NO.2" || cleanSize === "2") cleanSize = "XS";
    else if (cleanSize === "NO. 4" || cleanSize === "NO.4" || cleanSize === "4") cleanSize = "S";
    else if (cleanSize === "NO. 6" || cleanSize === "NO.6" || cleanSize === "6") cleanSize = "M";
    else if (cleanSize === "NO. 8" || cleanSize === "NO.8" || cleanSize === "8") cleanSize = "L";
    else if (cleanSize === "NO. 10" || cleanSize === "NO.10" || cleanSize === "10") cleanSize = "XL";
    else if (cleanSize === "NO. 12" || cleanSize === "NO.12" || cleanSize === "12") cleanSize = "XXL";
  }

  // Standarisasi varian 3XL / XXXL
  if (cleanSize === "3XL" || cleanSize.startsWith("3XL") || cleanSize.startsWith("XXXL")) cleanSize = "XXXL";
  else if (cleanSize === "2XL" || cleanSize.startsWith("2XL") || cleanSize.startsWith("XXL")) cleanSize = "XXL";
  else if (cleanSize.startsWith("XL")) cleanSize = "XL";
  else if (cleanSize.startsWith("XS")) cleanSize = "XS";
  else if (cleanSize === "S" || cleanSize.startsWith("S ")) cleanSize = "S";
  else if (cleanSize === "M" || cleanSize.startsWith("M ")) cleanSize = "M";
  else if (cleanSize === "L" || cleanSize.startsWith("L ")) cleanSize = "L";
  else if (cleanSize.includes("4XL") || cleanSize.includes("5XL")) cleanSize = "XXXL";

  const category: "anak" | "dewasa" = isAnak ? "anak" : "dewasa";

  return { size: cleanSize, category };
}

export function OrderRecap({ orders, onItemClick }: OrderRecapProps) {
  const [search, setSearch] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Perhitungan Data 4 Tabel & Subtotal / Grand Total
  const {
    mapPendekAnak,
    mapPendekDewasa,
    mapPanjangAnak,
    mapPanjangDewasa,
    subtotalPendekAnak,
    subtotalPendekDewasa,
    subtotalPanjangAnak,
    subtotalPanjangDewasa,
    totalLenganPendek,
    totalLenganPanjang,
    totalKeseluruhan,
  } = useMemo(() => {
    const pendekAnak: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    const pendekDewasa: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0, XXXL: 0 };
    const panjangAnak: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    const panjangDewasa: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0, XXXL: 0 };

    orders.forEach((o) => {
      const safeAnswers = Array.isArray(o.answers) ? o.answers : [];

      const jenisAnswer = safeAnswers.find(
        (a) =>
          a &&
          (String(a?.label || "").toLowerCase().includes("jenis") ||
            String(a?.label || "").toLowerCase().includes("produk"))
      );
      const productName = jenisAnswer && typeof jenisAnswer.value === "string" ? jenisAnswer.value : "Pesanan Kaos";

      let foundBullets = false;

      safeAnswers.forEach((ans) => {
        if (!ans) return;
        const ansValStr = typeof ans.value === "string" ? ans.value : String(ans.value || "");
        if (ansValStr.includes("•")) {
          const lines = ansValStr.split("\n");
          lines.forEach((line) => {
            if (line.trim().startsWith("•")) {
              const match = line.match(/•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\]/i);
              if (match) {
                const qty = parseInt(match[1], 10) || 1;
                const rawSize = match[2].trim();
                const sleeveStr = match[3].trim().toLowerCase();

                const isPanjang = sleeveStr.includes("panjang");
                const { size, category } = normalizeSizeAndCategory(rawSize, String(ans.label || ""), productName);

                if (!isPanjang) {
                  if (category === "anak") {
                    pendekAnak[size] = (pendekAnak[size] || 0) + qty;
                  } else {
                    pendekDewasa[size] = (pendekDewasa[size] || 0) + qty;
                  }
                } else {
                  if (category === "anak") {
                    panjangAnak[size] = (panjangAnak[size] || 0) + qty;
                  } else {
                    panjangDewasa[size] = (panjangDewasa[size] || 0) + qty;
                  }
                }
                foundBullets = true;
              }
            }
          });
        }
      });

      // Fallback jika bukan format bullet
      if (!foundBullets) {
        const sizeAns = safeAnswers.find(
          (a) =>
            a &&
            (String(a?.label || "").toLowerCase().includes("ukuran") ||
              String(a?.label || "").toLowerCase().includes("size"))
        );
        const sleeveAns = safeAnswers.find(
          (a) =>
            a &&
            (String(a?.label || "").toLowerCase().includes("lengan") ||
              String(a?.label || "").toLowerCase().includes("model"))
        );
        const qtyAns = safeAnswers.find(
          (a) =>
            a &&
            (String(a?.label || "").toLowerCase().includes("jumlah") ||
              String(a?.label || "").toLowerCase().includes("qty"))
        );

        if (sizeAns && sizeAns.value) {
          const qty = qtyAns ? parseInt(String(qtyAns.value).replace(/\D/g, ""), 10) || 1 : 1;
          const rawSize = String(sizeAns.value).trim();
          const sleeveStr = sleeveAns ? String(sleeveAns.value).toLowerCase() : "";
          const isPanjang = sleeveStr.includes("panjang");

          const { size, category } = normalizeSizeAndCategory(rawSize, String(sizeAns.label || ""), productName);

          if (!isPanjang) {
            if (category === "anak") {
              pendekAnak[size] = (pendekAnak[size] || 0) + qty;
            } else {
              pendekDewasa[size] = (pendekDewasa[size] || 0) + qty;
            }
          } else {
            if (category === "anak") {
              panjangAnak[size] = (panjangAnak[size] || 0) + qty;
            } else {
              panjangDewasa[size] = (panjangDewasa[size] || 0) + qty;
            }
          }
        }
      }
    });

    const subPendekAnak = SIZES_ANAK.reduce((sum, sz) => sum + (pendekAnak[sz] || 0), 0);
    const subPendekDewasa = SIZES_DEWASA.reduce((sum, sz) => sum + (pendekDewasa[sz] || 0), 0);
    const subPanjangAnak = SIZES_ANAK.reduce((sum, sz) => sum + (panjangAnak[sz] || 0), 0);
    const subPanjangDewasa = SIZES_DEWASA.reduce((sum, sz) => sum + (panjangDewasa[sz] || 0), 0);

    const totPendek = subPendekAnak + subPendekDewasa;
    const totPanjang = subPanjangAnak + subPanjangDewasa;
    const totAll = totPendek + totPanjang;

    return {
      mapPendekAnak: pendekAnak,
      mapPendekDewasa: pendekDewasa,
      mapPanjangAnak: panjangAnak,
      mapPanjangDewasa: panjangDewasa,
      subtotalPendekAnak: subPendekAnak,
      subtotalPendekDewasa: subPendekDewasa,
      subtotalPanjangAnak: subPanjangAnak,
      subtotalPanjangDewasa: subPanjangDewasa,
      totalLenganPendek: totPendek,
      totalLenganPanjang: totPanjang,
      totalKeseluruhan: totAll,
    };
  }, [orders]);

  if (orders.length === 0) return null;

  // Render Tabel Kategori dengan alignment baru
  const renderTable = (
    title: string,
    sizes: string[],
    dataMap: Record<string, number>,
    subtotal: number,
    sleeveType: string,
    categoryType: string
  ) => {
    return (
      <div className="rekap-table-card">
        {/* Header Kategori – merah marun */}
        <div className="rekap-category-header">
          <span className="rekap-category-title">{title}</span>
        </div>
        <table className="rekap-category-table">
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "40%" }} />
            <col style={{ width: "40%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-center">NO.</th>
              <th className="text-center">UKURAN</th>
              <th className="text-center">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((sz, idx) => {
              const qty = dataMap[sz] || 0;
              const isSearchMatch =
                search.trim() &&
                (sz.toLowerCase().includes(search.toLowerCase().trim()) ||
                  title.toLowerCase().includes(search.toLowerCase().trim()));

              return (
                <tr
                  key={sz}
                  className={`rekap-data-row ${isSearchMatch ? "rekap-row-highlight" : ""}`}
                  onClick={() => onItemClick && onItemClick("Kaos", sz, `${sleeveType} ${categoryType}`)}
                  title={`Klik untuk menyaring pesanan ${title} ukuran ${sz}`}
                >
                  <td className="text-center text-muted">{idx + 1}</td>
                  <td className="text-center font-medium">{sz}</td>
                  <td className="text-center rekap-col-qty">
                    {qty > 0 ? qty : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="rekap-subtotal-row">
              <td colSpan={2} className="rekap-subtotal-label">
                JUMLAH
              </td>
              <td className="rekap-subtotal-qty">
                {subtotal} PCS
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="rekap-produk-container">
      {/* Header Rekap */}
      <div className="rekap-header-bar">
        <div className="rekap-header-title-box">
          <div className="rekap-icon-box">
            <Shirt size={18} />
          </div>
          <div>
            <h3 className="rekap-main-heading">REKAP PESANAN PRODUK</h3>
            <p className="rekap-sub-heading">
              Rekap jumlah pesanan berdasarkan model lengan, kategori, dan ukuran.
            </p>
          </div>
        </div>
        <div className="rekap-header-right">
          <div className="rekap-header-stats-chips">
            <div className="rekap-stat-chip">
              <span className="rekap-stat-chip-label">Total Pendek:</span>
              <span className="rekap-stat-chip-val">{totalLenganPendek} PCS</span>
            </div>
            <div className="rekap-stat-chip">
              <span className="rekap-stat-chip-label">Total Panjang:</span>
              <span className="rekap-stat-chip-val">{totalLenganPanjang} PCS</span>
            </div>
            <div className="rekap-stat-chip rekap-stat-chip-total">
              <span className="rekap-stat-chip-label">Total Keseluruhan:</span>
              <span className="rekap-stat-chip-val">{totalKeseluruhan} PCS</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rekap-toggle-btn"
            title={isCollapsed ? "Buka Rekap Produk" : "Tutup Rekap Produk"}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>{isCollapsed ? "Buka" : "Tutup"}</span>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Pencarian */}
          <div className="rekap-search-wrapper">
            <Search size={15} className="rekap-search-icon" />
            <input
              type="text"
              className="rekap-search-input"
              placeholder="Cari ukuran, misalnya S, M, XL, Anak, Pendek..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="rekap-search-clear" title="Hapus pencarian">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Grid 2x2 */}
          <div className="rekap-grid-2x2">
            {renderTable("PENDEK ANAK", SIZES_ANAK, mapPendekAnak, subtotalPendekAnak, "Pendek", "Anak")}
            {renderTable("PENDEK DEWASA", SIZES_DEWASA, mapPendekDewasa, subtotalPendekDewasa, "Pendek", "Dewasa")}
            {renderTable("PANJANG ANAK", SIZES_ANAK, mapPanjangAnak, subtotalPanjangAnak, "Panjang", "Anak")}
            {renderTable("PANJANG DEWASA", SIZES_DEWASA, mapPanjangDewasa, subtotalPanjangDewasa, "Panjang", "Dewasa")}
          </div>

          {/* Grand Summary */}
          <div className="rekap-grand-summary-card">
            <div className="rekap-grand-stat-item">
              <span className="rekap-grand-stat-label">TOTAL LENGAN PENDEK</span>
              <span className="rekap-grand-stat-val">{totalLenganPendek} PCS</span>
            </div>
            <div className="rekap-grand-stat-item">
              <span className="rekap-grand-stat-label">TOTAL LENGAN PANJANG</span>
              <span className="rekap-grand-stat-val">{totalLenganPanjang} PCS</span>
            </div>
            <div className="rekap-grand-stat-item rekap-grand-stat-total">
              <span className="rekap-grand-stat-label">TOTAL KESELURUHAN</span>
              <span className="rekap-grand-stat-val rekap-maroon-text">{totalKeseluruhan} PCS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
