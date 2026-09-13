import { useApi } from "../hooks/useApi";
import { useToast } from "../contexts/ToastContext";
import { Keuangan } from "../components/keuangan/Keuangan";
import type { Transaksi } from "../types";
import {
  addKeuanganMedia,
  deleteKeuanganMedia,
  getKeuanganMedia,
  updateKeuanganMedia,
} from "../services/api";
import { CACHE_KEYS } from "../services/cache";

export function KeuanganMedia() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { data, loading, refresh } = useApi<Transaksi[]>(getKeuanganMedia, "Gagal mengambil data.", CACHE_KEYS.KEUANGAN_MEDIA);

  const handleSave = async (payload: Omit<Transaksi, "id">, id?: string): Promise<boolean> => {
    const result = id
      ? await updateKeuanganMedia(id, payload)
      : await addKeuanganMedia(payload);
    if (result.success) {
      toastSuccess("Data berhasil disimpan.");
      return true;
    }
    toastError(result.message);
    return false;
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const result = await deleteKeuanganMedia(id);
    if (result.success) {
      toastSuccess("Data berhasil dihapus.");
      return true;
    }
    toastError(result.message);
    return false;
  };

  return (
    <Keuangan
      title="Keuangan Media mbc sistem"
      subtitle="Keuangan Media mbc sistem"
      loading={loading}
      transaksi={data ?? []}
      onRefresh={refresh}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}