import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Plus,
  Copy,
  ExternalLink,
  MessageCircle,
  Eye,
  CheckCircle2,
  Clock,
  Layers,
  FileSpreadsheet,
  FileText,
  Edit,
  Trash2,
  Check,
  X,
  QrCode,
  Download,
} from "lucide-react";
import type {
  OrderWithAnswers,
  OrderFormWithFields,
  OrderStatus,
  OrderStats,
} from "../types";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import {
  getOrderFormsApi,
  getOrdersApi,
  saveOrderFormApi,
  deleteOrderFormApi,
  updateOrderStatusApi,
  deleteOrderApi,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import { formatTanggalPanjang, formatNomorHp, buatLinkWhatsAppPesanan } from "../utils/format";
import { DataTable, type Column } from "../components/ui/DataTable";
import { SearchBar } from "../components/ui/SearchBar";
import { Filter as FilterComp } from "../components/ui/Filter";
import { OrderDetailModal } from "../components/pesanan/OrderDetailModal";
import { OrderFormBuilderModal } from "../components/pesanan/OrderFormBuilderModal";
import { exportOrdersToCSV, exportOrdersToPDF } from "../services/pesananExport";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";

export function KelolaPesanan() {
  const { success: toastSuccess, error: toastError } = useToast();

  // Tab State
  const [activeTab, setActiveTab] = useState<"pesanan" | "formulir">("pesanan");

  // Fetch Forms
  const {
    data: forms,
    refresh: refreshForms,
  } = useApi<OrderFormWithFields[]>(
    getOrderFormsApi,
    "Gagal memuat daftar formulir pesanan.",
    CACHE_KEYS.ORDER_FORMS,
    { pollingInterval: 10000, revalidateOnFocus: true, immediate: true }
  );

  // Fetch Orders
  const {
    data: orders,
    loading: loadingOrders,
    refresh: refreshOrders,
  } = useApi<OrderWithAnswers[]>(
    () => getOrdersApi(),
    "Gagal memuat data pesanan.",
    CACHE_KEYS.ORDERS,
    { pollingInterval: 8000, revalidateOnFocus: true, immediate: true }
  );

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<OrderWithAnswers | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<OrderFormWithFields | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<"semua" | OrderStatus>("semua");
  const [dateFilter, setDateFilter] = useState<"semua" | "hari_ini" | "7_hari" | "30_hari">("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});
  const [qrModalData, setQrModalData] = useState<{ title: string; url: string; filename: string } | null>(null);

  // Delete confirm state
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  // Summary Cards Data
  const orderList = useMemo(() => orders || [], [orders]);
  const stats: OrderStats = useMemo(() => {
    let masuk = 0;
    let diproses = 0;
    let selesai = 0;
    orderList.forEach((o) => {
      if (o.status === "masuk") masuk++;
      else if (o.status === "diproses") diproses++;
      else if (o.status === "selesai") selesai++;
    });
    return {
      total: orderList.length,
      masuk,
      diproses,
      selesai,
    };
  }, [orderList]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const query = searchQuery.toLowerCase().trim();

    return orderList.filter((o) => {
      // 1. Status Filter
      if (statusFilter !== "semua" && o.status !== statusFilter) {
        return false;
      }

      // 2. Date Filter
      if (dateFilter !== "semua") {
        const orderDate = new Date(o.createdAt);
        const diffMs = now.getTime() - orderDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);

        if (dateFilter === "hari_ini") {
          const isToday =
            orderDate.getDate() === now.getDate() &&
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === "7_hari") {
          if (diffDays > 7) return false;
        } else if (dateFilter === "30_hari") {
          if (diffDays > 30) return false;
        }
      }

      // 3. Search Query (ID, Nama Customer, WhatsApp)
      if (query) {
        const matchId = o.id.toLowerCase().includes(query);
        const matchName = (o.customerName || "").toLowerCase().includes(query);
        const matchWa = (o.whatsapp || "").toLowerCase().includes(query);
        if (!matchId && !matchName && !matchWa) return false;
      }

      return true;
    });
  }, [orderList, statusFilter, dateFilter, searchQuery]);

  // Handlers
  const handleUpdateStatus = async (id: string, status: OrderStatus, adminNote?: string) => {
    const res = await updateOrderStatusApi(id, status, adminNote);
    if (res.success) {
      void refreshOrders(true);
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder((prev) => (prev ? { ...prev, status, adminNote: adminNote ?? prev.adminNote } : null));
      }
      return true;
    }
    return false;
  };

  const handleDeleteOrder = (id: string) => {
    setDeleteOrderId(id);
  };

  const handleConfirmDeleteOrder = async () => {
    if (!deleteOrderId) return;
    setDeletingOrder(true);
    const res = await deleteOrderApi(deleteOrderId);
    setDeletingOrder(false);
    if (res.success) {
      toastSuccess(`Pesanan ${deleteOrderId} berhasil dihapus.`);
      setDeleteOrderId(null);
      void refreshOrders(true);
    } else {
      toastError("Gagal menghapus pesanan.");
    }
  };

  const handleCopyLink = (formId: string) => {
    const fullUrl = `${window.location.origin}/order/form/${formId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkMap((prev) => ({ ...prev, [formId]: true }));
    toastSuccess("Tautan formulir publik berhasil disalin!");
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [formId]: false }));
    }, 2500);
  };

  const handleToggleFormStatus = async (form: OrderFormWithFields) => {
    const newStatus = form.status === "aktif" ? "nonaktif" : "aktif";
    const res = await saveOrderFormApi({
      ...form,
      status: newStatus,
    });
    if (res.success) {
      toastSuccess(`Formulir "${form.title}" sekarang ${newStatus.toUpperCase()}`);
      void refreshForms(true);
    } else {
      toastError("Gagal mengubah status formulir.");
    }
  };

  const handleDeleteForm = async (id: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus formulir "${title}" beserta data pertanyaannya?`)) return;
    const res = await deleteOrderFormApi(id);
    if (res.success) {
      toastSuccess("Formulir berhasil dihapus.");
      void refreshForms(true);
    } else {
      toastError("Gagal menghapus formulir.");
    }
  };

  const handleExportCSV = () => {
    exportOrdersToCSV(filteredOrders, `data-pesanan-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`);
    toastSuccess("Data pesanan berhasil diekspor ke CSV!");
  };

  const handleExportPDF = async () => {
    await exportOrdersToPDF(
      filteredOrders,
      statusFilter.toUpperCase(),
      `laporan-pesanan-${statusFilter}-${new Date().toISOString().slice(0, 10)}.pdf`
    );
    toastSuccess("Laporan PDF pesanan berhasil diunduh!");
  };

  // Columns for DataTable (Desktop)
  const columns: Column<OrderWithAnswers>[] = [
    {
      key: "id",
      header: "ID Pesanan",
      render: (row) => (
        <span style={{ fontWeight: 700, color: "var(--primary-700)", letterSpacing: "0.5px" }}>
          {row.id}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (row) => (
        <div>
          <strong style={{ display: "block", color: "var(--text)" }}>{row.customerName || "-"}</strong>
        </div>
      ),
    },
    {
      key: "whatsapp",
      header: "WhatsApp",
      render: (row) => {
        const jenisAnswer = row.answers.find(
          (a) => a.label.toLowerCase().includes("jenis") || a.label.toLowerCase().includes("produk")
        );
        const waLink = buatLinkWhatsAppPesanan(
          row.whatsapp,
          row.customerName,
          row.id,
          jenisAnswer?.value,
          row.status
        );
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>{formatNomorHp(row.whatsapp)}</span>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                title="Chat WhatsApp Customer"
                style={{
                  color: "#25D366",
                  padding: 4,
                  borderRadius: 6,
                  display: "inline-flex",
                }}
              >
                <MessageCircle size={15} />
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: "jenis",
      header: "Jenis Pesanan",
      render: (row) => {
        const jenisAnswer = row.answers.find(
          (a) => a.label.toLowerCase().includes("jenis") || a.label.toLowerCase().includes("produk")
        );
        const qtyAnswer = row.answers.find(
          (a) => a.label.toLowerCase().includes("jumlah") || a.label.toLowerCase().includes("qty")
        );
        return (
          <div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
              {jenisAnswer ? jenisAnswer.value : "Pesanan Custom"}
            </span>
            {qtyAnswer && (
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                Jumlah: {qtyAnswer.value} pcs
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "createdAt",
      header: "Tanggal",
      render: (row) => (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {formatTanggalPanjang(row.createdAt).split(" ").slice(0, 3).join(" ")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        return (
          <span
            className={`status-pill status-${row.status}`}
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
            }}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      key: "aksi",
      header: "Aksi",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSelectedOrder(row)}
            style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Eye size={13} />
            <span>Detail</span>
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => handleDeleteOrder(row.id)}
            title="Hapus Pesanan"
            style={{ color: "var(--danger)", padding: 4 }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="orders-page-container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* SUMMARY PANEL (RED BRAND GRADIENT PANEL KHAS MBC SISTEM) */}
      <div className="summary-panel animate-fade-slide-up">
        <div className="summary-panel-header">
          <div>
            <h3>Ringkasan Pesanan</h3>
            <p>Pilih status pada kartu di bawah untuk menyaring data pesanan secara cepat</p>
          </div>
          {stats.masuk > 0 && (
            <div
              style={{
                padding: "6px 14px",
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(8px)",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🔴</span>
              <span>{stats.masuk} Pesanan Baru Belum Diproses</span>
            </div>
          )}
        </div>

        {/* 4 Stat Cards Grid (Clickable for fast filtering) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {/* Card 1: Total Pesanan */}
          <div
            onClick={() => {
              setStatusFilter("semua");
              setActiveTab("pesanan");
            }}
            className={`rekrutmen-stat-card ${activeTab === "pesanan" && statusFilter === "semua" ? "active" : ""}`}
            title="Klik untuk melihat semua pesanan"
          >
            <div className="rekrutmen-stat-head">
              <Package size={15} /> Total Pesanan
            </div>
            <div className="rekrutmen-stat-value">
              {stats.total}
            </div>
            <span className="rekrutmen-stat-sub">Semua riwayat pesanan ↗</span>
          </div>

          {/* Card 2: Pesanan Masuk */}
          <div
            onClick={() => {
              setStatusFilter("masuk");
              setActiveTab("pesanan");
            }}
            className={`rekrutmen-stat-card ${activeTab === "pesanan" && statusFilter === "masuk" ? "active" : ""}`}
            title="Klik untuk menyaring pesanan masuk"
          >
            <div className="rekrutmen-stat-head">
              <Clock size={15} /> Pesanan Masuk
            </div>
            <div className="rekrutmen-stat-value">
              {stats.masuk}
            </div>
            <span className="rekrutmen-stat-sub">
              {stats.masuk > 0 ? "🔴 Menunggu diproses ↗" : "Belum ada antrean baru ↗"}
            </span>
          </div>

          {/* Card 3: Sedang Diproses */}
          <div
            onClick={() => {
              setStatusFilter("diproses");
              setActiveTab("pesanan");
            }}
            className={`rekrutmen-stat-card ${activeTab === "pesanan" && statusFilter === "diproses" ? "active" : ""}`}
            title="Klik untuk menyaring pesanan yang sedang diproses"
          >
            <div className="rekrutmen-stat-head">
              <Layers size={15} /> Sedang Diproses
            </div>
            <div className="rekrutmen-stat-value">
              {stats.diproses}
            </div>
            <span className="rekrutmen-stat-sub">🔵 Dalam pengerjaan tim ↗</span>
          </div>

          {/* Card 4: Pesanan Selesai */}
          <div
            onClick={() => {
              setStatusFilter("selesai");
              setActiveTab("pesanan");
            }}
            className={`rekrutmen-stat-card ${activeTab === "pesanan" && statusFilter === "selesai" ? "active" : ""}`}
            title="Klik untuk menyaring pesanan selesai"
          >
            <div className="rekrutmen-stat-head">
              <CheckCircle2 size={15} /> Pesanan Selesai
            </div>
            <div className="rekrutmen-stat-value">
              {stats.selesai}
            </div>
            <span className="rekrutmen-stat-sub">🟢 Selesai dikerjakan ↗</span>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS (DAFTAR PESANAN vs FORMULIR AKTIF) & ACTION */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setActiveTab("pesanan")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "pesanan" ? "2px solid var(--primary-700)" : "2px solid transparent",
              padding: "10px 4px",
              fontWeight: activeTab === "pesanan" ? 700 : 500,
              color: activeTab === "pesanan" ? "var(--primary-700)" : "var(--text-muted)",
              fontSize: 14,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Package size={16} />
            <span>Daftar Pesanan ({orderList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("formulir")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "formulir" ? "2px solid var(--primary-700)" : "2px solid transparent",
              padding: "10px 4px",
              fontWeight: activeTab === "formulir" ? 700 : 500,
              color: activeTab === "formulir" ? "var(--primary-700)" : "var(--text-muted)",
              fontSize: 14,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileText size={16} />
            <span>Formulir Pesanan ({forms?.length || 0})</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          {forms && forms.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                const defaultForm = forms[0];
                setQrModalData({
                  title: defaultForm.title,
                  url: `${window.location.origin}/order/form/${defaultForm.id}`,
                  filename: `qr-pesanan-${defaultForm.id}.png`,
                });
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Tampilkan QR Code formulir pesanan"
            >
              <QrCode size={16} /> QR Code Pesanan
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingForm(null);
              setIsBuilderOpen(true);
            }}
          >
            <Plus size={17} /> Tambah Formulir Pesanan
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: DAFTAR PESANAN */}
      {activeTab === "pesanan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* FILTER & SEARCH BAR */}
          <div
            style={{
              background: "#ffffff",
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Top row: Status Tabs & Export */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {/* Segmented Status Filter */}
              <div
                style={{
                  display: "inline-flex",
                  background: "var(--bg-soft)",
                  padding: 4,
                  borderRadius: "var(--radius-sm)",
                  gap: 4,
                }}
              >
                {[
                  { key: "semua", label: "Semua", count: stats.total },
                  { key: "masuk", label: "Masuk", count: stats.masuk },
                  { key: "diproses", label: "Diproses", count: stats.diproses },
                  { key: "selesai", label: "Selesai", count: stats.selesai },
                ].map((tab) => {
                  const active = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key as any)}
                      style={{
                        background: active ? "#ffffff" : "transparent",
                        color: active ? "var(--primary-700)" : "var(--text-secondary)",
                        fontWeight: active ? 700 : 500,
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        boxShadow: active ? "var(--shadow-sm)" : "none",
                      }}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  );
                })}
              </div>

              {/* Action Export Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExportCSV}
                  title="Ekspor data pesanan ke CSV"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px" }}
                >
                  <FileSpreadsheet size={14} />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExportPDF}
                  title="Ekspor laporan pesanan ke PDF"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px" }}
                >
                  <FileText size={14} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Toolbar row: SearchBar, Filter Status, Filter Periode, & Reset Filter matching Rekrutmen */}
            <div className="toolbar" style={{ marginTop: 4 }}>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari nama customer / ID / no. WhatsApp..."
              />
              <FilterComp
                label="Status"
                value={statusFilter === "semua" ? "" : statusFilter}
                onChange={(val) => setStatusFilter((val || "semua") as any)}
                options={[
                  { value: "", label: "Semua Status" },
                  { value: "masuk", label: "Masuk" },
                  { value: "diproses", label: "Diproses" },
                  { value: "selesai", label: "Selesai" },
                ]}
              />
              <FilterComp
                label="Periode"
                value={dateFilter === "semua" ? "" : dateFilter}
                onChange={(val) => setDateFilter((val || "semua") as any)}
                options={[
                  { value: "", label: "Semua Periode" },
                  { value: "hari_ini", label: "Hari Ini" },
                  { value: "7_hari", label: "7 Hari Terakhir" },
                  { value: "30_hari", label: "30 Hari Terakhir" },
                ]}
              />
              {(Boolean(searchQuery.trim()) || statusFilter !== "semua" || dateFilter !== "semua") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("semua");
                    setDateFilter("semua");
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "12px",
                    color: "#dc2626",
                  }}
                  title="Reset semua filter pencarian"
                >
                  <X size={13} /> Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* TABLE OF ORDERS */}
          <DataTable
            columns={columns}
            data={filteredOrders}
            loading={loadingOrders}
            rowKey={(r) => r.id}
            emptyTitle="Belum Ada Pesanan"
            emptyMessage={
              searchQuery || statusFilter !== "semua" || dateFilter !== "semua"
                ? "Tidak ada pesanan yang sesuai dengan filter pencarian."
                : "Customer yang mengisi formulir pemesanan akan otomatis muncul di sini."
            }
          />
        </div>
      )}

      {/* TAB CONTENT 2: FORMULIR AKTIF */}
      {activeTab === "formulir" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {(forms || []).map((form) => {
              const count = orderList.filter((o) => o.formId === form.id).length;
              const isCopied = copiedLinkMap[form.id];

              return (
                <div
                  key={form.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 16,
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                        {form.title}
                      </h4>
                      <span
                        className={`status-pill ${form.status === "aktif" ? "status-lolos" : "status-menunggu"}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: 20,
                        }}
                      >
                        {form.status}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {form.description || "Tidak ada deskripsi."}
                    </p>

                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
                      <span>
                        Pertanyaan: <strong>{form.fields?.length || 0} butir</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Tanggapan: <strong>{count} pesanan</strong>
                      </span>
                    </div>
                  </div>

                  {/* Public Link Preview Box */}
                  <div
                    style={{
                      background: "var(--bg-soft)",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-soft)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {`${window.location.origin}/order/form/${form.id}`}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setQrModalData({
                            title: form.title,
                            url: `${window.location.origin}/order/form/${form.id}`,
                            filename: `qr-pesanan-${form.id}.png`,
                          })
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--primary-700)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Lihat & unduh QR Code"
                      >
                        <QrCode size={13} />
                        <span>QR</span>
                      </button>
                      <span style={{ color: "var(--border)" }}>•</span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(form.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: isCopied ? "var(--green-600)" : "var(--primary-700)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? "Disalin!" : "Salin"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: 10,
                      borderTop: "1px solid var(--border-soft)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setEditingForm(form);
                          setIsBuilderOpen(true);
                        }}
                        style={{ padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Edit size={13} />
                        <span>Edit</span>
                      </button>

                      <Link
                        to={`/order/form/${form.id}`}
                        target="_blank"
                        className="btn-secondary"
                        style={{ padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                      >
                        <ExternalLink size={13} />
                        <span>Preview</span>
                      </Link>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setQrModalData({
                            title: form.title,
                            url: `${window.location.origin}/order/form/${form.id}`,
                            filename: `qr-pesanan-${form.id}.png`,
                          })
                        }
                        style={{ padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                        title="Lihat & unduh QR Code formulir pesanan"
                      >
                        <QrCode size={13} />
                        <span>QR Code</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleToggleFormStatus(form)}
                        style={{
                          padding: "5px 10px",
                          fontSize: 11,
                          color: form.status === "aktif" ? "var(--text-muted)" : "var(--green-700)",
                        }}
                      >
                        {form.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                      </button>

                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleDeleteForm(form.id, form.title)}
                        title="Hapus Formulir"
                        style={{ color: "var(--danger)", padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* FORM BUILDER MODAL */}
      <OrderFormBuilderModal
        key={isBuilderOpen ? (editingForm ? `edit-${editingForm.id}-${editingForm.updatedAt || ""}` : "create-new-form") : "closed"}
        open={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false);
          setEditingForm(null);
        }}
        formToEdit={editingForm}
        onSave={async (formData) => {
          const res = await saveOrderFormApi({
            id: formData.id || "",
            title: formData.title,
            description: formData.description,
            status: formData.status,
            bannerImageUrl: formData.bannerImageUrl,
            bannerImageTitle: formData.bannerImageTitle,
            fields: formData.fields,
          });
          if (res.success) {
            void refreshForms(true);
            return true;
          }
          return false;
        }}
      />

      {/* CONFIRM DELETE PESANAN DIALOG */}
      <ConfirmDialog
        open={deleteOrderId !== null}
        title="Hapus Pesanan?"
        message={`Data pesanan ${deleteOrderId ?? ""} akan dihapus secara permanen dari sistem.`}
        loading={deletingOrder}
        onConfirm={handleConfirmDeleteOrder}
        onCancel={() => setDeleteOrderId(null)}
      />

      {/* MODAL QR CODE FORMULIR PESANAN */}
      {qrModalData && (
        <Modal
          open={Boolean(qrModalData)}
          title={`QR Code ${qrModalData.title}`}
          onClose={() => setQrModalData(null)}
          size="sm"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, flexWrap: "wrap" }}>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrModalData.url)}`}
                download={qrModalData.filename}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} /> Unduh Gambar
              </a>
              <button className="btn btn-primary btn-sm" onClick={() => setQrModalData(null)}>
                Selesai
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "12px 0" }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrModalData.url)}`}
              alt={`QR Code ${qrModalData.title}`}
              style={{
                width: 200,
                height: 200,
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--border)",
                padding: 8,
                background: "#ffffff",
                boxShadow: "var(--shadow-sm)",
              }}
            />

            <div
              style={{
                width: "100%",
                background: "var(--bg-soft)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {qrModalData.url}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrModalData.url);
                  toastSuccess("Tautan formulir pesanan berhasil disalin!");
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, padding: "2px 8px", flexShrink: 0 }}
              >
                <Copy size={13} /> Salin
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
              Customer dapat memindai QR code ini melalui kamera smartphone untuk langsung membuka formulir pemesanan.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
