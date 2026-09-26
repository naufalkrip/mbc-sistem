import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { OrderWithAnswers } from "../../types";
import { getSizeRank } from "../../utils/format";

interface OrderRecapProps {
  orders: OrderWithAnswers[];
  onItemClick?: (product: string, size: string, sleeve: string) => void;
}

interface RecapItem {
  key: string;
  product: string;
  size: string;
  sleeve: string;
  qty: number;
}

export function OrderRecap({ orders, onItemClick }: OrderRecapProps) {
  const [search, setSearch] = useState("");

  const recapData = useMemo(() => {
    const map = new Map<string, RecapItem>();

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
                const existing = map.get(key);
                if (existing) {
                  existing.qty += qty;
                } else {
                  map.set(key, { key, product: productName, size, sleeve, qty });
                }
              }
            }
          });
        }
      });
    });

    const items = Array.from(map.values());

    // Sort: Product -> Sleeve (Pendek first, Panjang second) -> Size Rank (Anak ke Dewasa, terkecil ke terbesar)
    items.sort((a, b) => {
      if (a.product !== b.product) return a.product.localeCompare(b.product);

      const isPanjangA = a.sleeve.toLowerCase().includes("panjang");
      const isPanjangB = b.sleeve.toLowerCase().includes("panjang");
      if (isPanjangA !== isPanjangB) {
        return isPanjangA ? 1 : -1;
      }

      const rankA = getSizeRank(a.size);
      const rankB = getSizeRank(b.size);
      if (rankA !== rankB) return rankA - rankB;

      return a.size.localeCompare(b.size);
    });

    return items;
  }, [orders]);

  const filteredRecap = useMemo(() => {
    if (!search.trim()) return recapData;
    const q = search.toLowerCase();
    return recapData.filter(
      (item) =>
        item.product.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.sleeve.toLowerCase().includes(q)
    );
  }, [recapData, search]);

  const groupedByProduct = useMemo(() => {
    const groups: Record<string, { pendek: RecapItem[]; panjang: RecapItem[] }> = {};
    filteredRecap.forEach((item) => {
      if (!groups[item.product]) {
        groups[item.product] = { pendek: [], panjang: [] };
      }
      const isPanjang = item.sleeve.toLowerCase().includes("panjang");
      if (isPanjang) {
        groups[item.product].panjang.push(item);
      } else {
        groups[item.product].pendek.push(item);
      }
    });
    return groups;
  }, [filteredRecap]);

  const totalQty = recapData.reduce((acc, item) => acc + item.qty, 0);
  const totalVariants = recapData.length;
  const totalOrders = orders.length;

  if (orders.length === 0) return null;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--navy-900)" }}>
            REKAP PESANAN PRODUK
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Diurutkan dari size terkecil ke terbesar (Anak-anak → Dewasa), dipisah per tipe Lengan
          </span>
        </div>

        <div className="rekap-summary-row" style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", maxWidth: "100%" }}>
          <div style={{ textAlign: "center", padding: "8px 14px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--border)", flex: "1 0 auto" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2, whiteSpace: "nowrap" }}>TOTAL PESANAN</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--primary-700)" }}>{totalQty} PCS</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 14px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--border)", flex: "1 0 auto" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2, whiteSpace: "nowrap" }}>TOTAL VARIASI</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy-900)" }}>{totalVariants}</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 14px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--border)", flex: "1 0 auto" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2, whiteSpace: "nowrap" }}>TOTAL ORDER</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy-900)" }}>{totalOrders}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16, position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          type="text"
          className="form-input"
          placeholder="Cari size, lengan, produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", paddingLeft: 36, fontSize: 13 }}
        />
      </div>

      {filteredRecap.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--bg-soft)", borderRadius: 8 }}>
          Tidak ada rekap yang sesuai.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Object.entries(groupedByProduct).map(([productName, sections]) => (
            <div key={productName} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", textTransform: "uppercase", paddingBottom: 6, borderBottom: "2px solid var(--border)" }}>
                {productName}
              </div>

              {/* 1. TABEL LENGAN PENDEK */}
              {sections.pendek.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--navy-900)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👕</span> TABEL LENGAN PENDEK ({sections.pendek.reduce((a, b) => a + b.qty, 0)} PCS)
                  </div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ background: "#f8fafc" }}>
                        <tr>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "var(--navy-900)", borderBottom: "1px solid var(--border)", width: "40%" }}>Size / Ukuran</th>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: "35%" }}>Model Lengan</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", fontSize: 11.5, fontWeight: 700, color: "var(--navy-900)", borderBottom: "1px solid var(--border)" }}>Jumlah (Pcs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.pendek.map((item) => (
                          <tr
                            key={item.key}
                            style={{ borderBottom: "1px solid var(--border-soft)", cursor: onItemClick ? "pointer" : "default" }}
                            onClick={() => onItemClick && onItemClick(item.product, item.size, item.sleeve)}
                          >
                            <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--navy-900)" }}>{item.size}</td>
                            <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)" }}>{item.sleeve}</td>
                            <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--primary-700)", textAlign: "right" }}>
                              {item.qty} PCS
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. TABEL LENGAN PANJANG */}
              {sections.panjang.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--navy-900)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👕</span> TABEL LENGAN PANJANG ({sections.panjang.reduce((a, b) => a + b.qty, 0)} PCS)
                  </div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ background: "#f8fafc" }}>
                        <tr>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "var(--navy-900)", borderBottom: "1px solid var(--border)", width: "40%" }}>Size / Ukuran</th>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: "35%" }}>Model Lengan</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", fontSize: 11.5, fontWeight: 700, color: "var(--navy-900)", borderBottom: "1px solid var(--border)" }}>Jumlah (Pcs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.panjang.map((item) => (
                          <tr
                            key={item.key}
                            style={{ borderBottom: "1px solid var(--border-soft)", cursor: onItemClick ? "pointer" : "default", background: "#ffffff" }}
                            onClick={() => onItemClick && onItemClick(item.product, item.size, item.sleeve)}
                          >
                            <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "var(--navy-900)" }}>{item.size}</td>
                            <td style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text)" }}>{item.sleeve}</td>
                            <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--primary-700)", textAlign: "right" }}>
                              {item.qty} PCS
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
