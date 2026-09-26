import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { OrderWithAnswers } from "../../types";
// Removed formatRupiah

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
      // Hanya rekap pesanan yang valid/aktif (menunggu, diproses, selesai)
      // Semua order yang di-pass sudah valid (masuk, diproses, selesai)

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
              const match = line.match(
                /•\s*(\d+)x\s*\[(?:Ukuran\s*)?(.*?)\s*-\s*(.*?)\]/i
              );
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
    
    // Sort logic (default by size/sleeve, or whatever feels natural)
    items.sort((a, b) => {
      if (a.product !== b.product) return a.product.localeCompare(b.product);
      if (a.size !== b.size) return a.size.localeCompare(b.size);
      return a.sleeve.localeCompare(b.sleeve);
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
    const groups: Record<string, RecapItem[]> = {};
    filteredRecap.forEach((item) => {
      if (!groups[item.product]) groups[item.product] = [];
      groups[item.product].push(item);
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
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--navy-900)" }}>
            REKAP PESANAN
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Ringkasan jumlah pesanan berdasarkan produk, size & lengan
          </span>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ textAlign: "center", padding: "8px 16px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>TOTAL PESANAN</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary-700)" }}>{totalQty} PCS</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 16px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>TOTAL VARIASI</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--navy-900)" }}>{totalVariants}</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 16px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>TOTAL ORDER</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--navy-900)" }}>{totalOrders}</div>
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
          {Object.entries(groupedByProduct).map(([productName, items]) => (
            <div key={productName}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy-900)", marginBottom: 12, textTransform: "uppercase", paddingBottom: 6, borderBottom: "2px solid var(--border)" }}>
                {productName}
              </div>
              
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "var(--bg-soft)" }}>
                    <tr>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: "40%" }}>Size</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: "35%" }}>Lengan</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr 
                        key={item.key} 
                        style={{ borderBottom: "1px solid var(--border-soft)", cursor: onItemClick ? "pointer" : "default" }}
                        onClick={() => onItemClick && onItemClick(item.product, item.size, item.sleeve)}
                      >
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "var(--navy-900)" }}>{item.size}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)" }}>{item.sleeve}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "var(--primary-700)", textAlign: "right" }}>
                          {item.qty} PCS
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
