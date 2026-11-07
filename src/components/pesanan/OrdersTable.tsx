import { Eye, MessageCircle, Trash2 } from "lucide-react";
import type { OrderWithAnswers } from "../../types";
import { formatRupiah } from "../../utils/format";
import { ActionDropdown } from "../ui/ActionDropdown";
import { Loading } from "../ui/Loading";
import { EmptyState } from "../ui/EmptyState";

interface OrdersTableProps {
  orders: OrderWithAnswers[];
  loading?: boolean;
  onOrderClick: (order: OrderWithAnswers) => void;
  onOpenBroadcast: (order: OrderWithAnswers) => void;
  onDeleteOrder: (id: string) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  pageSize?: number;
}


/** Hitung total PCS seluruh variasi dalam satu pesanan */
export function calculateOrderTotalQty(order: OrderWithAnswers): number {
  const safeAnswers = Array.isArray(order.answers) ? order.answers : [];

  let totalFromBullets = 0;
  let foundBullets = false;

  safeAnswers.forEach((ans) => {
    if (!ans) return;
    const ansValStr = typeof ans.value === "string" ? ans.value : String(ans.value || "");
    if (ansValStr.includes("•")) {
      const lines = ansValStr.split("\n");
      lines.forEach((line) => {
        if (line.trim().startsWith("•")) {
          const match = line.match(/•\s*(\d+)x/i);
          if (match) {
            totalFromBullets += parseInt(match[1], 10);
            foundBullets = true;
          }
        }
      });
    }
  });

  if (foundBullets && totalFromBullets > 0) {
    return totalFromBullets;
  }

  for (const ans of safeAnswers) {
    if (!ans) continue;
    const str = String(ans.value || "");
    const matchTotal = str.match(/Total:\s*(\d+)\s*pcs/i);
    if (matchTotal) {
      return parseInt(matchTotal[1], 10);
    }
  }

  const qtyAns = safeAnswers.find(
    (a) =>
      a &&
      (String(a?.label || "").toLowerCase().includes("jumlah") ||
        String(a?.label || "").toLowerCase().includes("qty") ||
        String(a?.label || "").toLowerCase().includes("kuantitas"))
  );
  if (qtyAns && qtyAns.value) {
    const num = parseInt(String(qtyAns.value).replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return 1;
}

/** Ekstrak nama produk dari pesanan */
function getOrderProduct(order: OrderWithAnswers): string {
  if (!order.answers || !Array.isArray(order.answers)) return "Kaos MB Chondro";
  const prodAns = order.answers.find(
    (a) =>
      a &&
      (String(a.label || "").toLowerCase().includes("produk") ||
        String(a.label || "").toLowerCase().includes("jenis") ||
        String(a.label || "").toLowerCase().includes("model") ||
        String(a.label || "").toLowerCase().includes("kaos") ||
        String(a.label || "").toLowerCase().includes("tipe"))
  );
  if (prodAns && prodAns.value) {
    const val = String(prodAns.value).split("\n")[0].trim();
    if (val && !val.startsWith("•")) return val;
  }
  return "Kaos MB Chondro";
}

/** Render badge status pembayaran (Belum DP / Sudah DP / Lunas) */
function renderPaymentBadge(order: OrderWithAnswers) {
  const paymentStatus = order.paymentStatus || (order.dpAmount && order.dpAmount > 0 ? "dp" : "belum_bayar");

  if (paymentStatus === "lunas") {
    return (
      <span className="payment-badge payment-lunas" title="Pesanan Lunas">
        Lunas
      </span>
    );
  }

  if (paymentStatus === "dp") {
    const formattedAmount = order.dpAmount && order.dpAmount > 0 ? formatRupiah(order.dpAmount).replace(" ", "") : "";
    return (
      <span className="payment-badge payment-dp" title={`Sudah Bayar Uang Muka (DP): ${formattedAmount || ""}`}>
        {formattedAmount ? `DP ${formattedAmount}` : "Sudah DP"}
      </span>
    );
  }

  return (
    <span className="payment-badge payment-belum-dp" title="Belum Membayar DP">
      Belum DP
    </span>
  );
}

/** Format ringkas nominal rupiah untuk badge compact mobile (misal: 50000 -> 50rb, 1500000 -> 1.5jt) */
function formatShortRupiah(amount: number): string {
  if (!amount || amount <= 0) return "";
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}rb`;
  }
  return String(amount);
}

function renderPaymentBadgeCompact(order: OrderWithAnswers) {
  const paymentStatus = order.paymentStatus || (order.dpAmount && order.dpAmount > 0 ? "dp" : "belum_bayar");

  if (paymentStatus === "lunas") {
    return (
      <span className="payment-badge compact payment-lunas" title="Pesanan Lunas">
        Lunas
      </span>
    );
  }

  if (paymentStatus === "dp") {
    const shortAmount = order.dpAmount && order.dpAmount > 0 ? formatShortRupiah(order.dpAmount) : "";
    const fullAmount = order.dpAmount && order.dpAmount > 0 ? formatRupiah(order.dpAmount) : "";
    return (
      <span
        className="payment-badge compact payment-dp"
        title={fullAmount ? `Sudah DP: ${fullAmount}` : "Sudah DP"}
      >
        {shortAmount ? `DP ${shortAmount}` : "DP"}
      </span>
    );
  }

  return (
    <span className="payment-badge compact payment-belum-dp" title="Belum Membayar DP">
      Belum DP
    </span>
  );
}

export function OrdersTable({
  orders,
  loading = false,
  onOrderClick,
  onOpenBroadcast,
  onDeleteOrder,
  emptyTitle = "Belum Ada Pesanan",
  emptyMessage = "Customer yang mengisi formulir pemesanan akan otomatis muncul di sini.",
}: OrdersTableProps) {
  if (loading) {
    return (
      <div className="orders-table-wrapper-box">
        <Loading label="Memuat data pesanan..." />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="orders-table-wrapper-box">
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="orders-table-container">
      {/* ============================================================
          1. DESKTOP & TABLET TABLE (>= 768px, 6 KOLOM LENGKAP)
          ============================================================ */}
      <div className="orders-table-desktop-view">
        <table className="orders-table-minimal">
          <colgroup>
            <col style={{ width: "6%" }} />
            <col style={{ width: "36%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>

          <thead>
            <tr>
              <th className="th-center">No.</th>
              <th className="th-left">Nama Customer</th>
              <th className="th-center">Jumlah</th>
              <th className="th-center">Status Pesanan</th>
              <th className="th-center">Pembayaran</th>
              <th className="th-center">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order, index) => {
              const rowNumber = index + 1;
              const totalPcs = calculateOrderTotalQty(order);
              const product = getOrderProduct(order);

              const statusText =
                order.status === "masuk"
                  ? "Masuk"
                  : order.status === "diproses"
                  ? "Diproses"
                  : order.status === "selesai"
                  ? "Selesai"
                  : order.status;

              return (
                <tr
                  key={order.id}
                  className="orders-row-clickable"
                  onClick={() => onOrderClick(order)}
                >
                  <td className="td-center order-no-col">
                    <span className="order-no-text">{rowNumber}</span>
                  </td>

                  <td className="td-left">
                    <div
                      className="order-customer-name"
                      title={`Customer: ${order.customerName || "-"} | Produk: ${product}`}
                    >
                      {order.customerName || "-"}
                    </div>
                  </td>

                  <td className="td-center">
                    <span className="order-qty-text">{totalPcs} pcs</span>
                  </td>

                  <td className="td-center">
                    <span className={`order-status-badge status-${order.status}`}>
                      {statusText}
                    </span>
                  </td>

                  <td className="td-center">
                    {renderPaymentBadge(order)}
                  </td>

                  <td className="td-center">
                    <div
                      className="orders-action-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ActionDropdown
                        variant="minimal"
                        style={{
                          width: 68,
                          height: 30,
                        }}
                        items={[
                          {
                            label: "Detail Pesanan",
                            icon: <Eye size={13} />,
                            onClick: () => onOrderClick(order),
                          },
                          {
                            label: "Kirim WhatsApp",
                            icon: <MessageCircle size={13} />,
                            onClick: () => onOpenBroadcast(order),
                          },
                          {
                            label: "Hapus Pesanan",
                            icon: <Trash2 size={13} />,
                            onClick: () => onDeleteOrder(order.id),
                            danger: true,
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============================================================
          2. MOBILE TABLE (< 768px, 5 KOLOM HORIZONTAL TANPA SCROLLBAR)
          ============================================================ */}
      <div className="orders-table-mobile-view">
        <table className="orders-table-mobile-compact">
          <colgroup>
            <col style={{ width: "26px" }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: "42px" }} />
            <col style={{ width: "58px" }} />
            <col style={{ width: "68px" }} />
          </colgroup>

          <thead>
            <tr>
              <th className="th-mobile-no">No.</th>
              <th className="th-mobile-cust">Customer</th>
              <th className="th-mobile-qty">Jml</th>
              <th className="th-mobile-status">Status</th>
              <th className="th-mobile-bayar">Bayar</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order, index) => {
              const rowNumber = index + 1;
              const totalPcs = calculateOrderTotalQty(order);

              const statusText =
                order.status === "masuk"
                  ? "Masuk"
                  : order.status === "diproses"
                  ? "Diproses"
                  : order.status === "selesai"
                  ? "Selesai"
                  : order.status;

              return (
                <tr
                  key={order.id}
                  className="orders-mobile-row"
                  onClick={() => onOrderClick(order)}
                >
                  <td className="td-mobile-no">
                    <span>{rowNumber}</span>
                  </td>

                  <td className="td-mobile-cust">
                    <span className="mobile-customer-name" title={order.customerName || "-"}>
                      {order.customerName || "-"}
                    </span>
                  </td>

                  <td className="td-mobile-qty">
                    <span className="mobile-qty-text">{totalPcs} pcs</span>
                  </td>

                  <td className="td-mobile-status">
                    <span className={`order-status-badge compact status-${order.status}`}>
                      {statusText}
                    </span>
                  </td>

                  <td className="td-mobile-bayar">
                    {renderPaymentBadgeCompact(order)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
