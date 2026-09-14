import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { TransaksiList } from "../components/transaksi/TransaksiList";
import type { TransaksiGroupWithStats } from "../types";
import {
  addTransaksiGroupItem,
  deleteTransaksiGroupItem,
  getTransaksiGroups,
  getTransaksiDetails,
  updateTransaksiGroupItem,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";
import { laporanTransaksi } from "../services/pdf";

export function Transaksi() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  // Faster polling (5s) for real-time feel on transaksi page
  const { data, loading, refresh } = useApi<TransaksiGroupWithStats[]>(
    getTransaksiGroups,
    "Gagal mengambil data transaksi.",
    CACHE_KEYS.TRANSAKSI,
    { pollingInterval: 5000, revalidateOnFocus: true, immediate: true }
  );

  const handleSave = async (
    payload: Omit<TransaksiGroupWithStats, "id" | "createdAt" | "updatedAt" | "totalTransaksi" | "totalPemasukan" | "totalPengeluaran" | "saldo">,
    id?: string
  ): Promise<{ success: boolean; id?: string }> => {
    const result = id
      ? await updateTransaksiGroupItem(id, payload)
      : await addTransaksiGroupItem(payload);
    if (result.success) {
      toastSuccess(id ? "Transaksi berhasil diperbarui." : "Transaksi baru berhasil dibuat.");
      return { success: true, id: result.data.id };
    }
    toastError(result.message);
    return { success: false };
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const result = await deleteTransaksiGroupItem(id);
    if (result.success) {
      toastSuccess("Transaksi berhasil dihapus.");
      return true;
    }
    toastError(result.message);
    return false;
  };

  const handleNavigateToDetail = (id: string) => {
    navigate(`/transaksi/${id}`);
  };

  const handleDownloadPdf = async (group: TransaksiGroupWithStats) => {
    try {
      const details = await getTransaksiDetails(group.id);
      await laporanTransaksi(group, details);
      toastSuccess("PDF berhasil diunduh.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Gagal membuat PDF.");
    }
  };

  return (
    <TransaksiList
      loading={loading}
      groups={data ?? []}
      onRefresh={refresh}
      onSave={handleSave}
      onDelete={handleDelete}
      onNavigateToDetail={handleNavigateToDetail}
      onDownloadPdf={handleDownloadPdf}
    />
  );
}