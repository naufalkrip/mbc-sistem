import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { Keuangan } from "../components/keuangan/Keuangan";
import type { Transaksi } from "../types";
import {
  addKeuanganChondro,
  deleteKeuanganChondro,
  getKeuanganChondro,
  updateKeuanganChondro,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";

export function KeuanganChondro() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { data, loading, refresh } = useApi<Transaksi[]>(getKeuanganChondro, "Gagal mengambil data.", CACHE_KEYS.KEUANGAN_CHONDRO);

  const handleSave = async (payload: Omit<Transaksi, "id">, id?: string): Promise<boolean> => {
    const result = id
      ? await updateKeuanganChondro(id, payload)
      : await addKeuanganChondro(payload);
    if (result.success) {
      toastSuccess("Data berhasil disimpan.");
      return true;
    }
    toastError(result.message);
    return false;
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const result = await deleteKeuanganChondro(id);
    if (result.success) {
      toastSuccess("Data berhasil dihapus.");
      return true;
    }
    toastError(result.message);
    return false;
  };

  return (
    <Keuangan
      title="Keuangan mbc sistem"
      subtitle="Keuangan mbc sistem"
      loading={loading}
      transaksi={data ?? []}
      onRefresh={refresh}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}