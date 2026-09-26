import { API_URL } from "../config";
import type {
  Absensi,
  Anggota,
  ApiResult,
  DashboardData,
  Transaksi,
  TransaksiGroup,
  TransaksiDetail,
  TransaksiGroupWithStats,
  JenisTransaksi,
  RekrutmenForm,
  RekrutmenField,
  RekrutmenSubmission,
  RekrutmenAnswer,
  RekrutmenFormWithFields,
  RekrutmenSubmissionWithAnswers,
  RekrutmenStats,
  RekrutmenFieldOption,
  RekrutmenFieldType,
  RekrutmenSubmissionStatus,
  User,
  OrderForm,
  OrderField,
  OrderFormWithFields,
  OrderWithAnswers,
  OrderStats,
  OrderStatus,
} from "../types";
import { normAbsensi, normAnggota, normTransaksi, normalizeStatusAnggota, isValidPhotoUrl } from "../utils/format";
import { CACHE_KEYS, cacheSet, cacheMutate, cacheClear } from "./cache";
import { saveMemberPhoto, deleteMemberPhoto } from "./photoStorage";

// ============================================================
// SERVICE LAYER — semua komunikasi ke Google Apps Script
// ============================================================
// Semua request melewati fungsi `request` di bawah ini.
// POST menggunakan Content-Type "text/plain" agar tidak memicu
// preflight (OPTIONS) yang tidak didukung Apps Script Web App.
// ============================================================

export const API_CONFIGURED =
  API_URL.includes("REPLACE_WITH_YOUR_DEPLOYMENT_ID");

interface ApiResponse {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

const VALID_ACTIONS = new Set([
  "getDashboard",
  "getAnggota",
  "addAnggota",
  "updateAnggota",
  "deleteAnggota",
  "getAbsensi",
  "addAbsensi",
  "updateAbsensi",
  "deleteAbsensi",
  "saveAbsensiBatch",
  "updateAbsensiBatch",
  "deleteAbsensiBatch",
  "getKeuanganChondro",
  "addKeuanganChondro",
  "updateKeuanganChondro",
  "deleteKeuanganChondro",
  "getKeuanganMedia",
  "addKeuanganMedia",
  "updateKeuanganMedia",
  "deleteKeuanganMedia",
  "getTransaksiGroup",
  "addTransaksiGroup",
  "updateTransaksiGroup",
  "deleteTransaksiGroup",
  "getTransaksiDetail",
  "addTransaksiDetail",
  "updateTransaksiDetail",
  "deleteTransaksiDetail",
  "getRekrutmenForm",
  "addRekrutmenForm",
  "updateRekrutmenForm",
  "deleteRekrutmenForm",
  "getRekrutmenFields",
  "addRekrutmenField",
  "updateRekrutmenField",
  "deleteRekrutmenField",
  "reorderRekrutmenFields",
  "getRekrutmenSubmissions",
  "addRekrutmenSubmission",
  "updateRekrutmenSubmission",
  "deleteRekrutmenSubmission",
  "getRekrutmenSubmissionDetail",
  "getRekrutmenAnswers",
  "getRekrutmenStats",
  "login",
  "getUsers",
  "addUser",
  "updateUser",
  "deleteUser",
  "getOrderForms",
  "getOrderForm",
  "addOrderForm",
  "updateOrderForm",
  "deleteOrderForm",
  "getOrderFields",
  "addOrderField",
  "updateOrderField",
  "deleteOrderField",
  "reorderOrderFields",
  "getOrders",
  "addOrder",
  "updateOrderStatus",
  "deleteOrder",
  "getOrderStats",
  "getCouponLocations",
  "addCouponLocation",
  "updateCouponLocation",
  "deleteCouponLocation",
  "uploadOrderImage",
]);

type ActionName = (typeof VALID_ACTIONS extends Set<infer T> ? T : never) & string;

async function request<T>(action: ActionName, data?: Record<string, unknown>): Promise<T> {
  if (API_CONFIGURED) {
    throw new Error("API_URL belum dikonfigurasi. Baca README.md untuk langkah deploy.");
  }

  const body = JSON.stringify({ action, data: data ?? {} });
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
  } catch {
    throw new Error("Gagal menghubungi server. Periksa koneksi internet atau API_URL di src/config.ts.");
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Endpoint API tidak ditemukan (404). Pastikan API_URL di src/config.ts adalah URL deployment Apps Script yang masih aktif."
      );
    }
    if (response.status === 405) {
      throw new Error("Metode request tidak diizinkan (405). Periksa konfigurasi deployment Apps Script.");
    }
    throw new Error(`Server merespons dengan status ${response.status}.`);
  }

  const text = await response.text();
  let parsed: ApiResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Respons server tidak valid. Pastikan API_URL menunjuk ke deployment Apps Script yang benar.");
  }

  if (!parsed || parsed.success !== true) {
    throw new Error(parsed?.message || parsed?.error || "Terjadi kesalahan pada server.");
  }
  return parsed.data as T;
}

// ---------------- ANGGOTA ----------------

export async function getAnggota(): Promise<Anggota[]> {
  const raw = await request<unknown[]>("getAnggota");
  const list = (raw ?? []).map((item) => normAnggota(item as Record<string, unknown>));
  cacheSet(CACHE_KEYS.ANGGOTA, list);
  return list;
}

export async function addAnggota(data: Omit<Anggota, "id">): Promise<ApiResult<Anggota>> {
  try {
    const cleanStatus = normalizeStatusAnggota(data.status);
    const result = await request<Record<string, unknown>>("addAnggota", {
      nama: data.nama,
      namaPanggilan: data.namaPanggilan || "",
      divisi: data.divisi,
      jabatan: data.jabatan,
      noHp: data.noHp,
      status: cleanStatus,
      tanggalBergabung: data.tanggalBergabung,
      keterangan: data.keterangan,
      foto: data.foto || "",
    });
    const item = normAnggota(result);
    if (data.foto) {
      saveMemberPhoto(item.id, item.nama, data.foto);
    }
    cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) => [...(prev ?? []).filter((a) => a.id !== item.id), item]);
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: item, message: String(result?.message ?? "") };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

export async function updateAnggota(id: string, data: Omit<Anggota, "id">): Promise<ApiResult<Anggota>> {
  try {
    const cleanStatus = normalizeStatusAnggota(data.status);
    const result = await request<unknown>("updateAnggota", {
      id,
      nama: data.nama,
      namaPanggilan: data.namaPanggilan || "",
      divisi: data.divisi,
      jabatan: data.jabatan,
      noHp: data.noHp,
      status: cleanStatus,
      tanggalBergabung: data.tanggalBergabung,
      keterangan: data.keterangan,
      foto: data.foto || "",
    });
    const item = normAnggota(result as Record<string, unknown>);
    if (data.foto !== undefined) {
      saveMemberPhoto(id, data.nama, data.foto);
    }
    cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) => (prev ?? []).map((a) => (a.id === id ? item : a)));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

export async function deleteAnggota(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteAnggota", { id });
    deleteMemberPhoto(id);
    cacheMutate<Anggota[]>(CACHE_KEYS.ANGGOTA, (prev) => (prev ?? []).filter((a) => a.id !== id));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

// ---------------- ABSENSI ----------------

export async function getAbsensi(): Promise<Absensi[]> {
  const raw = await request<unknown[]>("getAbsensi");
  const list = (raw ?? []).map((item) => normAbsensi(item as Record<string, unknown>));
  cacheSet(CACHE_KEYS.ABSENSI, list);
  return list;
}

export async function addAbsensi(data: Omit<Absensi, "id" | "nama">): Promise<ApiResult<Absensi>> {
  try {
    const result = await request<unknown>("addAbsensi", {
      idAnggota: data.idAnggota,
      tanggal: data.tanggal,
      kegiatan: data.kegiatan,
      status: data.status,
      keterangan: data.keterangan,
      waktu: data.waktu,
    });
    const item = normAbsensi(result as Record<string, unknown>);
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => [...(prev ?? []).filter((a) => a.id !== item.id), item]);
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

export async function updateAbsensi(id: string, data: Omit<Absensi, "id" | "nama">): Promise<ApiResult<Absensi>> {
  try {
    const result = await request<unknown>("updateAbsensi", {
      id,
      idAnggota: data.idAnggota,
      tanggal: data.tanggal,
      kegiatan: data.kegiatan,
      status: data.status,
      keterangan: data.keterangan,
      waktu: data.waktu,
    });
    const item = normAbsensi(result as Record<string, unknown>);
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => (prev ?? []).map((a) => (a.id === id ? item : a)));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

export async function deleteAbsensi(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteAbsensi", { id });
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => (prev ?? []).filter((a) => a.id !== id));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

// ---------- Absensi BATCH (satu request untuk banyak baris → cepat/realtime) ----------

export async function saveAbsensiBatch(
  items: Omit<Absensi, "id" | "nama">[]
): Promise<ApiResult<Absensi[]>> {
  try {
    const result = await request<unknown[]>("saveAbsensiBatch", {
      items: items.map((d) => ({
        idAnggota: d.idAnggota,
        tanggal: d.tanggal,
        kegiatan: d.kegiatan,
        status: d.status,
        keterangan: d.keterangan,
        waktu: d.waktu,
      })),
    });
    const newItems = (result ?? []).map((r) => normAbsensi(r as Record<string, unknown>));
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => {
      const existing = (prev ?? []).filter((a) => !newItems.some((n) => n.id === a.id));
      return [...existing, ...newItems];
    });
    cacheClear(CACHE_KEYS.DASHBOARD);
    return {
      success: true,
      data: newItems,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

export async function updateAbsensiBatch(
  items: Omit<Absensi, "nama">[]
): Promise<ApiResult<Absensi[]>> {
  try {
    const result = await request<unknown[]>("updateAbsensiBatch", {
      items: items.map((d) => ({
        id: d.id,
        idAnggota: d.idAnggota,
        tanggal: d.tanggal,
        kegiatan: d.kegiatan,
        status: d.status,
        keterangan: d.keterangan,
        waktu: d.waktu,
      })),
    });
    const updatedItems = (result ?? []).map((r) => normAbsensi(r as Record<string, unknown>));
    const map = new Map(updatedItems.map((it) => [it.id, it]));
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => (prev ?? []).map((a) => map.get(a.id) ?? a));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return {
      success: true,
      data: updatedItems,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

export async function deleteAbsensiBatch(ids: string[]): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteAbsensiBatch", { ids });
    const idSet = new Set(ids);
    cacheMutate<Absensi[]>(CACHE_KEYS.ABSENSI, (prev) => (prev ?? []).filter((a) => !idSet.has(a.id)));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

// ---------------- KEUANGAN ----------------

type KeuanganSheet = "KEUANGAN_CHONDRO" | "KEUANGAN_MEDIA";

async function getKeuangan(sheet: KeuanganSheet): Promise<Transaksi[]> {
  const action = sheet === "KEUANGAN_CHONDRO" ? "getKeuanganChondro" : "getKeuanganMedia";
  const cacheKey = sheet === "KEUANGAN_CHONDRO" ? CACHE_KEYS.KEUANGAN_CHONDRO : CACHE_KEYS.KEUANGAN_MEDIA;
  const raw = await request<unknown[]>(action);
  const list = (raw ?? []).map((item) => normTransaksi(item as Record<string, unknown>));
  cacheSet(cacheKey, list);
  return list;
}

async function addKeuangan(sheet: KeuanganSheet, data: Omit<Transaksi, "id">): Promise<ApiResult<Transaksi>> {
  try {
    const action = (sheet === "KEUANGAN_CHONDRO" ? "addKeuanganChondro" : "addKeuanganMedia") as ActionName;
    const cacheKey = sheet === "KEUANGAN_CHONDRO" ? CACHE_KEYS.KEUANGAN_CHONDRO : CACHE_KEYS.KEUANGAN_MEDIA;
    const result = await request<unknown>(action, {
      tanggal: data.tanggal,
      jenis: data.jenis,
      kategori: data.kategori,
      keterangan: data.keterangan,
      nominal: data.nominal,
      penanggungJawab: data.penanggungJawab,
    });
    const item = normTransaksi(result as Record<string, unknown>);
    cacheMutate<Transaksi[]>(cacheKey, (prev) => [...(prev ?? []).filter((t) => t.id !== item.id), item]);
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function updateKeuangan(sheet: KeuanganSheet, id: string, data: Omit<Transaksi, "id">): Promise<ApiResult<Transaksi>> {
  try {
    const action = (sheet === "KEUANGAN_CHONDRO" ? "updateKeuanganChondro" : "updateKeuanganMedia") as ActionName;
    const cacheKey = sheet === "KEUANGAN_CHONDRO" ? CACHE_KEYS.KEUANGAN_CHONDRO : CACHE_KEYS.KEUANGAN_MEDIA;
    const result = await request<unknown>(action, {
      id,
      tanggal: data.tanggal,
      jenis: data.jenis,
      kategori: data.kategori,
      keterangan: data.keterangan,
      nominal: data.nominal,
      penanggungJawab: data.penanggungJawab,
    });
    const item = normTransaksi(result as Record<string, unknown>);
    cacheMutate<Transaksi[]>(cacheKey, (prev) => (prev ?? []).map((t) => (t.id === id ? item : t)));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function deleteKeuangan(sheet: KeuanganSheet, id: string): Promise<ApiResult<null>> {
  try {
    const action = (sheet === "KEUANGAN_CHONDRO" ? "deleteKeuanganChondro" : "deleteKeuanganMedia") as ActionName;
    const cacheKey = sheet === "KEUANGAN_CHONDRO" ? CACHE_KEYS.KEUANGAN_CHONDRO : CACHE_KEYS.KEUANGAN_MEDIA;
    await request<unknown>(action, { id });
    cacheMutate<Transaksi[]>(cacheKey, (prev) => (prev ?? []).filter((t) => t.id !== id));
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

export const getKeuanganChondro = () => getKeuangan("KEUANGAN_CHONDRO");
export const addKeuanganChondro = (data: Omit<Transaksi, "id">) => addKeuangan("KEUANGAN_CHONDRO", data);
export const updateKeuanganChondro = (id: string, data: Omit<Transaksi, "id">) => updateKeuangan("KEUANGAN_CHONDRO", id, data);
export const deleteKeuanganChondro = (id: string) => deleteKeuangan("KEUANGAN_CHONDRO", id);

export const getKeuanganMedia = () => getKeuangan("KEUANGAN_MEDIA");
export const addKeuanganMedia = (data: Omit<Transaksi, "id">) => addKeuangan("KEUANGAN_MEDIA", data);
export const updateKeuanganMedia = (id: string, data: Omit<Transaksi, "id">) => updateKeuangan("KEUANGAN_MEDIA", id, data);
export const deleteKeuanganMedia = (id: string) => deleteKeuangan("KEUANGAN_MEDIA", id);

// ---------------- TRANSAKSI (Kelompok Transaksi Temporer) ----------------

async function getTransaksiGroup(): Promise<TransaksiGroupWithStats[]> {
  const raw = await request<unknown[]>("getTransaksiGroup");
  const list = (raw ?? []).map((item) => normTransaksiGroup(item as Record<string, unknown>));
  cacheSet(CACHE_KEYS.TRANSAKSI, list);
  return list;
}

async function addTransaksiGroup(data: Omit<TransaksiGroup, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<TransaksiGroup>> {
  try {
    const result = await request<unknown>("addTransaksiGroup", {
      judul: data.judul,
      tanggal: data.tanggal,
      keterangan: data.keterangan,
    });
    const item = normTransaksiGroup(result as Record<string, unknown>);
    cacheMutate<TransaksiGroupWithStats[]>(CACHE_KEYS.TRANSAKSI, (prev) => [...(prev ?? []).filter((g) => g.id !== item.id), item]);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function updateTransaksiGroup(id: string, data: Omit<TransaksiGroup, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<TransaksiGroup>> {
  try {
    const result = await request<unknown>("updateTransaksiGroup", {
      id,
      judul: data.judul,
      tanggal: data.tanggal,
      keterangan: data.keterangan,
    });
    const item = normTransaksiGroup(result as Record<string, unknown>);
    cacheMutate<TransaksiGroupWithStats[]>(CACHE_KEYS.TRANSAKSI, (prev) => (prev ?? []).map((g) => (g.id === id ? { ...g, ...item } : g)));
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function deleteTransaksiGroup(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteTransaksiGroup", { id });
    cacheMutate<TransaksiGroupWithStats[]>(CACHE_KEYS.TRANSAKSI, (prev) => (prev ?? []).filter((g) => g.id !== id));
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

function normTransaksiGroup(item: Record<string, unknown>): TransaksiGroupWithStats {
  return {
    id: String(item.id ?? ""),
    judul: String(item.judul ?? ""),
    tanggal: String(item.tanggal ?? ""),
    keterangan: String(item.keterangan ?? ""),
    createdAt: String(item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
    totalTransaksi: Number(item.totalTransaksi ?? 0),
    totalPemasukan: Number(item.totalPemasukan ?? 0),
    totalPengeluaran: Number(item.totalPengeluaran ?? 0),
    saldo: Number(item.saldo ?? 0),
  };
}

// ---------------- TRANSAKSI DETAIL ----------------

async function getTransaksiDetail(groupId: string): Promise<TransaksiDetail[]> {
  const raw = await request<unknown[]>("getTransaksiDetail", { transaksiGroupId: groupId });
  const list = (raw ?? []).map((item) => normTransaksiDetail(item as Record<string, unknown>));
  cacheSet(`${CACHE_KEYS.TRANSAKSI_DETAIL}:${groupId}`, list);
  return list;
}

async function addTransaksiDetail(data: Omit<TransaksiDetail, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<TransaksiDetail>> {
  try {
    const result = await request<unknown>("addTransaksiDetail", {
      transaksiGroupId: data.transaksiGroupId,
      tanggal: data.tanggal,
      jenis: data.jenis,
      kategori: data.kategori,
      nominal: data.nominal,
      keterangan: data.keterangan,
    });
    const item = normTransaksiDetail(result as Record<string, unknown>);
    cacheMutate<TransaksiDetail[]>(`${CACHE_KEYS.TRANSAKSI_DETAIL}:${data.transaksiGroupId}`, (prev) => [...(prev ?? []).filter((d) => d.id !== item.id), item]);
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function updateTransaksiDetail(id: string, data: Omit<TransaksiDetail, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<TransaksiDetail>> {
  try {
    const result = await request<unknown>("updateTransaksiDetail", {
      id,
      transaksiGroupId: data.transaksiGroupId,
      tanggal: data.tanggal,
      jenis: data.jenis,
      kategori: data.kategori,
      nominal: data.nominal,
      keterangan: data.keterangan,
    });
    const item = normTransaksiDetail(result as Record<string, unknown>);
    cacheMutate<TransaksiDetail[]>(`${CACHE_KEYS.TRANSAKSI_DETAIL}:${data.transaksiGroupId}`, (prev) => (prev ?? []).map((d) => (d.id === id ? item : d)));
    return { success: true, data: item };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function deleteTransaksiDetail(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteTransaksiDetail", { id });
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

function normTransaksiDetail(item: Record<string, unknown>): TransaksiDetail {
  return {
    id: String(item.id ?? ""),
    transaksiGroupId: String(item.transaksiGroupId ?? ""),
    tanggal: String(item.tanggal ?? ""),
    jenis: (item.jenis as JenisTransaksi) ?? "Pengeluaran",
    kategori: String(item.kategori ?? ""),
    nominal: Number(item.nominal ?? 0),
    keterangan: String(item.keterangan ?? ""),
    createdAt: String(item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
  };
}

export const getTransaksiGroups = getTransaksiGroup;
export const addTransaksiGroupItem = addTransaksiGroup;
export const updateTransaksiGroupItem = updateTransaksiGroup;
export const deleteTransaksiGroupItem = deleteTransaksiGroup;

export const getTransaksiDetails = getTransaksiDetail;
export const addTransaksiDetailItem = addTransaksiDetail;
export const updateTransaksiDetailItem = updateTransaksiDetail;
export const deleteTransaksiDetailItem = deleteTransaksiDetail;

// ---------------- REKRUITMEN ----------------

async function getRekrutmenForm(): Promise<RekrutmenFormWithFields | null> {
  const raw = await request<unknown>("getRekrutmenForm");
  if (!raw || typeof raw !== "object" || !(raw as Record<string, unknown>).id) {
    return null;
  }
  const form = normRekrutmenForm(raw as Record<string, unknown>);
  const fieldsRaw = await request<unknown[]>("getRekrutmenFields", { formId: form.id });
  const fields = (fieldsRaw ?? []).map((item) => normRekrutmenField(item as Record<string, unknown>));
  const full = { ...form, fields };
  cacheSet(CACHE_KEYS.REKRUITMEN_FORM, full);
  return full;
}

async function addRekrutmenForm(data: Omit<RekrutmenForm, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<RekrutmenForm>> {
  try {
    const result = await request<unknown>("addRekrutmenForm", {
      title: data.title,
      description: data.description,
      status: data.status,
    });
    const form = normRekrutmenForm(result as Record<string, unknown>);
    cacheMutate<RekrutmenFormWithFields | null>(CACHE_KEYS.REKRUITMEN_FORM, (prev) => {
      if (!prev) return { ...form, fields: [] };
      return { ...prev, ...form };
    });
    return { success: true, data: form };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function updateRekrutmenForm(id: string, data: Omit<RekrutmenForm, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<RekrutmenForm>> {
  try {
    const result = await request<unknown>("updateRekrutmenForm", {
      id,
      title: data.title,
      description: data.description,
      status: data.status,
    });
    const form = normRekrutmenForm(result as Record<string, unknown>);
    cacheMutate<RekrutmenFormWithFields | null>(CACHE_KEYS.REKRUITMEN_FORM, (prev) => {
      if (!prev) return { ...form, fields: [] };
      return { ...prev, ...form };
    });
    return { success: true, data: form };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function deleteRekrutmenForm(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteRekrutmenForm", { id });
    cacheClear(CACHE_KEYS.REKRUITMEN_FORM);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

function normRekrutmenForm(item: Record<string, unknown>): RekrutmenForm {
  return {
    id: String(item.id ?? ""),
    title: String(item.title ?? ""),
    description: String(item.description ?? ""),
    status: (item.status as "dibuka" | "ditutup") ?? "ditutup",
    createdAt: String(item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
  };
}

async function getRekrutmenFields(formId: string): Promise<RekrutmenField[]> {
  const raw = await request<unknown[]>("getRekrutmenFields", { formId });
  return (raw ?? []).map((item) => normRekrutmenField(item as Record<string, unknown>));
}

async function addRekrutmenField(data: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<RekrutmenField>> {
  try {
    const result = await request<unknown>("addRekrutmenField", {
      formId: data.formId,
      label: data.label,
      description: data.description,
      fieldType: data.fieldType,
      placeholder: data.placeholder || "",
      required: data.required,
      options: typeof data.options === "string" ? data.options : JSON.stringify(data.options || []),
      sortOrder: data.sortOrder,
      exampleImageUrl: data.exampleImageUrl || "",
      exampleImageTitle: data.exampleImageTitle || "",
      maxFileSize: data.maxFileSize || (data.fieldType === "image" ? 2 : 5),
      allowedFileTypes: JSON.stringify(data.allowedFileTypes || []),
    });
    const field = normRekrutmenField(result as Record<string, unknown>);
    cacheMutate<RekrutmenFormWithFields | null>(CACHE_KEYS.REKRUITMEN_FORM, (prev) => {
      if (!prev) return null;
      return { ...prev, fields: [...prev.fields.filter((f) => f.id !== field.id), field] };
    });
    return { success: true, data: field };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function updateRekrutmenField(id: string, data: Omit<RekrutmenField, "id" | "createdAt" | "updatedAt">): Promise<ApiResult<RekrutmenField>> {
  try {
    const result = await request<unknown>("updateRekrutmenField", {
      id,
      formId: data.formId,
      label: data.label,
      description: data.description,
      fieldType: data.fieldType,
      placeholder: data.placeholder || "",
      required: data.required,
      options: typeof data.options === "string" ? data.options : JSON.stringify(data.options || []),
      sortOrder: data.sortOrder,
      exampleImageUrl: data.exampleImageUrl || "",
      exampleImageTitle: data.exampleImageTitle || "",
      maxFileSize: data.maxFileSize || (data.fieldType === "image" ? 2 : 5),
      allowedFileTypes: JSON.stringify(data.allowedFileTypes || []),
    });
    const field = normRekrutmenField(result as Record<string, unknown>);
    cacheMutate<RekrutmenFormWithFields | null>(CACHE_KEYS.REKRUITMEN_FORM, (prev) => {
      if (!prev) return null;
      return { ...prev, fields: prev.fields.map((f) => (f.id === id ? field : f)) };
    });
    return { success: true, data: field };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function deleteRekrutmenField(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteRekrutmenField", { id });
    cacheMutate<RekrutmenFormWithFields | null>(CACHE_KEYS.REKRUITMEN_FORM, (prev) => {
      if (!prev) return null;
      return { ...prev, fields: prev.fields.filter((f) => f.id !== id) };
    });
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

async function reorderRekrutmenFields(formId: string, fieldOrders: { id: string; sortOrder: number }[]): Promise<ApiResult<null>> {
  try {
    await request<unknown>("reorderRekrutmenFields", { formId, fieldOrders });
    const orderMap = new Map(fieldOrders.map((o) => [o.id, o.sortOrder]));
    cacheMutate<RekrutmenFormWithFields | null>(CACHE_KEYS.REKRUITMEN_FORM, (prev) => {
      if (!prev) return null;
      return {
        ...prev,
        fields: prev.fields.map((f) => ({
          ...f,
          sortOrder: orderMap.get(f.id) ?? f.sortOrder,
        })),
      };
    });
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal mengubah urutan." };
  }
}

function normRekrutmenField(item: Record<string, unknown>): RekrutmenField {
  let options: RekrutmenFieldOption[] = [];
  try {
    const opts = item.options;
    if (typeof opts === "string" && opts) {
      options = JSON.parse(opts);
    } else if (Array.isArray(opts)) {
      options = opts;
    }
  } catch {
    options = [];
  }

  let allowedFileTypes: string[] | undefined = undefined;
  try {
    if (typeof item.allowedFileTypes === "string" && item.allowedFileTypes) {
      allowedFileTypes = JSON.parse(item.allowedFileTypes);
    } else if (Array.isArray(item.allowedFileTypes)) {
      allowedFileTypes = item.allowedFileTypes;
    }
  } catch {
    allowedFileTypes = undefined;
  }

  const fieldType = (item.fieldType as RekrutmenFieldType) ?? "text";
  const isUpload = fieldType === "image" || fieldType === "file";

  const rawExImg = item.exampleImageUrl ? String(item.exampleImageUrl).trim() : "";
  const exImg =
    rawExImg && rawExImg !== "undefined" && rawExImg !== "null" && (rawExImg.startsWith("data:image/") || rawExImg.startsWith("http") || rawExImg.startsWith("//") || rawExImg.startsWith("blob:"))
      ? rawExImg
      : undefined;

  const rawExTitle = item.exampleImageTitle ? String(item.exampleImageTitle).trim() : "";
  const exTitle =
    rawExTitle && rawExTitle !== "undefined" && rawExTitle !== "null"
      ? rawExTitle
      : undefined;

  return {
    id: String(item.id ?? ""),
    formId: String(item.formId ?? ""),
    label: String(item.label ?? ""),
    description: String(item.description ?? ""),
    fieldType,
    placeholder: item.placeholder && String(item.placeholder) !== "undefined" ? String(item.placeholder) : undefined,
    required: Boolean(item.required),
    options,
    sortOrder: Number(item.sortOrder ?? 0),
    exampleImageUrl: exImg,
    exampleImageTitle: exTitle,
    maxFileSize: isUpload && item.maxFileSize ? Number(item.maxFileSize) : undefined,
    allowedFileTypes,
    createdAt: String(item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
  };
}

async function getRekrutmenSubmissions(formId: string): Promise<RekrutmenSubmissionWithAnswers[]> {
  const raw = await request<unknown[]>("getRekrutmenSubmissions", { formId });
  const list = Array.isArray(raw) ? raw : [];
  const submissions = list.map((item) => {
    const submission = normRekrutmenSubmission(item as Record<string, unknown>);
    return {
      ...submission,
      answers: Array.isArray((item as { answers?: unknown[] })?.answers)
        ? (item as { answers: unknown[] }).answers.map((a) => normRekrutmenAnswer(a as Record<string, unknown>))
        : [],
      form: { id: "", title: "", description: "", status: "ditutup" as const, createdAt: "", updatedAt: "" },
    };
  });
  cacheSet(CACHE_KEYS.REKRUITMEN_SUBMISSIONS, submissions);
  return submissions;
}

export interface NewRekrutmenSubmissionPayload {
  formId: string;
  status?: RekrutmenSubmissionStatus;
  adminNote?: string;
  answers?: {
    fieldId: string;
    value: string;
    fileUrl?: string | null;
    fileName?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
  }[];
}

async function addRekrutmenSubmission(data: NewRekrutmenSubmissionPayload): Promise<ApiResult<RekrutmenSubmission>> {
  try {
    const result = await request<unknown>("addRekrutmenSubmission", data as unknown as Record<string, unknown>);
    const sub = normRekrutmenSubmission(result as Record<string, unknown>);
    cacheMutate<RekrutmenSubmissionWithAnswers[]>(CACHE_KEYS.REKRUITMEN_SUBMISSIONS, (prev) => [
      ...(prev ?? []),
      { ...sub, answers: [], form: { id: "", title: "", description: "", status: "ditutup" as const, createdAt: "", updatedAt: "" } },
    ]);
    cacheClear(CACHE_KEYS.REKRUITMEN_STATS);
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: sub };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function updateRekrutmenSubmission(id: string, data: Partial<RekrutmenSubmission>): Promise<ApiResult<RekrutmenSubmission>> {
  try {
    const result = await request<unknown>("updateRekrutmenSubmission", { id, ...data });
    const sub = normRekrutmenSubmission(result as Record<string, unknown>);
    cacheMutate<RekrutmenSubmissionWithAnswers[]>(CACHE_KEYS.REKRUITMEN_SUBMISSIONS, (prev) =>
      (prev ?? []).map((s) => (s.id === id ? { ...s, ...sub } : s))
    );
    cacheClear(CACHE_KEYS.REKRUITMEN_STATS);
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: sub };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menyimpan data." };
  }
}

async function deleteRekrutmenSubmission(id: string): Promise<ApiResult<null>> {
  try {
    await request<unknown>("deleteRekrutmenSubmission", { id });
    cacheMutate<RekrutmenSubmissionWithAnswers[]>(CACHE_KEYS.REKRUITMEN_SUBMISSIONS, (prev) => (prev ?? []).filter((s) => s.id !== id));
    cacheClear(CACHE_KEYS.REKRUITMEN_STATS);
    cacheClear(CACHE_KEYS.DASHBOARD);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus data." };
  }
}

async function getRekrutmenSubmissionDetail(submissionId: string): Promise<RekrutmenSubmissionWithAnswers> {
  const [submissionRaw, answersRaw] = await Promise.all([
    request<unknown>("getRekrutmenSubmissionDetail", { submissionId }),
    request<unknown[]>("getRekrutmenAnswers", { submissionId }),
  ]);
  const submission = normRekrutmenSubmission(submissionRaw as Record<string, unknown>);
  const answers = (answersRaw ?? []).map((item) => {
    const answer = normRekrutmenAnswer(item as Record<string, unknown>);
    return { ...answer, field: normRekrutmenField(item as Record<string, unknown>) };
  });
  const formRaw = await request<unknown>("getRekrutmenForm");
  const form = normRekrutmenForm(formRaw as Record<string, unknown>);
  return { ...submission, answers, form };
}

function normRekrutmenSubmission(item: Record<string, unknown>): RekrutmenSubmission {
  return {
    id: String(item.id ?? ""),
    formId: String(item.formId ?? ""),
    status: (item.status as RekrutmenSubmissionStatus) ?? "menunggu",
    adminNote: String(item.adminNote ?? ""),
    submittedAt: String(item.submittedAt ?? ""),
    reviewedAt: item.reviewedAt ? String(item.reviewedAt) : null,
    reviewedBy: item.reviewedBy ? String(item.reviewedBy) : null,
  };
}

function normRekrutmenAnswer(item: Record<string, unknown>): RekrutmenAnswer & { field: RekrutmenField } {
  return {
    id: String(item.id ?? ""),
    submissionId: String(item.submissionId ?? ""),
    fieldId: String(item.fieldId ?? ""),
    value: String(item.value ?? ""),
    fileUrl: item.fileUrl ? String(item.fileUrl) : null,
    fileName: item.fileName ? String(item.fileName) : null,
    fileType: item.fileType ? String(item.fileType) : null,
    fileSize: item.fileSize ? Number(item.fileSize) : null,
    createdAt: String(item.createdAt ?? ""),
    field: (item.field ? normRekrutmenField(item.field as Record<string, unknown>) : {
      id: String(item.fieldId ?? ""),
      formId: "",
      label: "",
      description: "",
      fieldType: "text",
      required: false,
      options: [],
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    }),
  };
}

async function getRekrutmenStats(formId: string): Promise<RekrutmenStats> {
  const raw = await request<Record<string, unknown>>("getRekrutmenStats", { formId });
  const stats = {
    total: Number(raw?.total ?? 0),
    menunggu: Number(raw?.menunggu ?? 0),
    lolos: Number(raw?.lolos ?? 0),
    cadangan: Number(raw?.cadangan ?? 0),
    tidakLolos: Number(raw?.tidakLolos ?? 0),
  };
  cacheSet(CACHE_KEYS.REKRUITMEN_STATS, stats);
  return stats;
}

export const getRekrutmenFormData = getRekrutmenForm;
export const addRekrutmenFormItem = addRekrutmenForm;
export const updateRekrutmenFormItem = updateRekrutmenForm;
export const deleteRekrutmenFormItem = deleteRekrutmenForm;

export const getRekrutmenFieldsData = getRekrutmenFields;
export const addRekrutmenFieldItem = addRekrutmenField;
export const updateRekrutmenFieldItem = updateRekrutmenField;
export const deleteRekrutmenFieldItem = deleteRekrutmenField;
export const reorderRekrutmenFieldsItem = reorderRekrutmenFields;

export const getRekrutmenSubmissionsData = getRekrutmenSubmissions;
export const addRekrutmenSubmissionItem = addRekrutmenSubmission;
export const updateRekrutmenSubmissionItem = updateRekrutmenSubmission;
export const deleteRekrutmenSubmissionItem = deleteRekrutmenSubmission;
export const getRekrutmenSubmissionDetailData = getRekrutmenSubmissionDetail;
export const getRekrutmenStatsData = getRekrutmenStats;

export async function getRekrutmenImageBase64Item(payload: { fileId?: string; fileName?: string }): Promise<{ success: boolean; base64?: string; message?: string }> {
  try {
    const res = await request<{ success: boolean; base64?: string; message?: string }>("getRekrutmenImageBase64", payload as Record<string, unknown>);
    return res;
  } catch {
    return { success: false, message: "Gagal mengambil data gambar." };
  }
}

export async function updateRekrutmenAnswerPhotoItem(data: { answerId: string; fileBase64: string; fileName: string }): Promise<ApiResult<unknown>> {
  try {
    const res = await request<unknown>("updateRekrutmenAnswerPhoto", data as unknown as Record<string, unknown>);
    cacheClear(CACHE_KEYS.REKRUITMEN_SUBMISSIONS);
    return { success: true, data: res };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal memperbarui foto." };
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * In-memory / Session cache untuk foto yang di-resolve dari Google Drive
 */
const resolvedPhotoCache = new Map<string, string>();

export function getCachedResolvedPhoto(key: string): string | undefined {
  if (!key) return undefined;
  return resolvedPhotoCache.get(key);
}

export function setCachedResolvedPhoto(key: string, base64: string): void {
  if (!key || !base64) return;
  resolvedPhotoCache.set(key, base64);
}

/**
 * Ekstraksi informasi pas foto calon anggota secara cerdas dan mendalam
 * dari seluruh daftar jawaban pendaftar (kebal terhadap variasi nama label pertanyaan).
 */
export function extractCandidatePhotoInfo(answers: Array<{
  id?: string;
  fieldId?: string;
  value?: string;
  fileUrl?: string | null;
  fileBase64?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  field?: { label?: string; fieldType?: string };
}>): {
  url: string | null;
  fileName: string | null;
  label: string;
  answerId?: string;
  isBase64: boolean;
  isDrive: boolean;
  driveFileId?: string;
} {
  if (!Array.isArray(answers) || answers.length === 0) {
    return {
      url: null,
      fileName: null,
      label: "Foto Calon Anggota",
      isBase64: false,
      isDrive: false,
    };
  }

  // Cari jawaban yang cocok dengan kriteria pas foto calon
  const photoAnswer = answers.find((a) => {
    const label = (a.field?.label || "").toLowerCase();
    const fType = a.field?.fieldType || "";
    const mime = (a.fileType || "").toLowerCase();
    const fName = (a.fileName || "").toLowerCase();
    const val = (a.value || "");
    const fUrl = (a.fileUrl || a.fileBase64 || "");

    const isExplicitPhotoField =
      fType === "image" ||
      label.includes("pas foto") ||
      label.includes("foto") ||
      label.includes("photo") ||
      label.includes("profil") ||
      label.includes("selfie") ||
      label.includes("foto diri");

    const isImageFile =
      mime.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(fName) ||
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(val);

    const hasImageData =
      fUrl.startsWith("data:image/") ||
      fUrl.includes("drive.google.com") ||
      fUrl.includes("googleusercontent.com") ||
      val.startsWith("data:image/") ||
      val.includes("drive.google.com");

    return isExplicitPhotoField || (fType === "file" && (isImageFile || hasImageData)) || (isImageFile && hasImageData);
  });

  if (!photoAnswer) {
    return {
      url: null,
      fileName: null,
      label: "Foto Calon Anggota",
      isBase64: false,
      isDrive: false,
    };
  }

  let finalUrl = photoAnswer.fileUrl || photoAnswer.fileBase64 || null;
  if (!finalUrl && photoAnswer.value) {
    if (photoAnswer.value.startsWith("data:image/") || photoAnswer.value.startsWith("http")) {
      finalUrl = photoAnswer.value;
    }
  }

  const isBase64 = Boolean(finalUrl && finalUrl.startsWith("data:image/"));
  const isDrive = Boolean(
    finalUrl &&
    (finalUrl.includes("drive.google.com") || finalUrl.includes("googleusercontent.com"))
  );

  let driveFileId: string | undefined = undefined;
  if (finalUrl) {
    const match = finalUrl.match(/[\/|=]([a-zA-Z0-9_-]{25,})/);
    if (match) driveFileId = match[1];
  }

  return {
    url: finalUrl,
    fileName: photoAnswer.fileName || photoAnswer.value || "foto_calon.jpg",
    label: photoAnswer.field?.label || "Pas Foto Calon Anggota",
    answerId: photoAnswer.id,
    isBase64,
    isDrive,
    driveFileId,
  };
}

/**
 * Mengompres gambar menjadi format JPEG resolusi tajam (400x500 hingga 600x800)
 * dengan ukuran aman (<= 28.000 karakter Base64 / ~21 KB) dengan latar putih solid
 * agar 100% muat di sel Google Sheets tanpa risiko terpotong dan transparan PNG tidak menghitam.
 */
export function compressImageToSafeHd(file: File, maxChars = 28000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        return reject(new Error("File gambar kosong."));
      }
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak valid atau rusak."));
      img.onload = () => {
        let maxDim = 720;
        let quality = 0.76;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(dataUrl);
        }

        let result = "";
        for (let attempt = 0; attempt < 8; attempt++) {
          let width = img.width || 600;
          let height = img.height || 800;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          // Latar belakang putih solid agar gambar transparan (PNG) tidak menjadi hitam
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          result = canvas.toDataURL("image/jpeg", quality);

          if (result.length <= maxChars) {
            break;
          }
          maxDim = Math.round(maxDim * 0.84);
          quality = Math.max(0.52, quality - 0.07);
        }
        resolve(result || dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Mengompres gambar menjadi format Full HD (FHD 1080p / hingga 1920px) dengan kualitas tinggi
 * agar foto banner, panduan size chart kaos, dan visual produk tampil super tajam (tidak blur).
 */
export function compressImageToFhd(file: File, maxDim = 1920, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        return reject(new Error("File gambar kosong."));
      }
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak valid atau rusak."));
      img.onload = () => {
        let width = img.width || 1920;
        let height = img.height || 1080;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(dataUrl);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Latar belakang putih solid untuk gambar transparan PNG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Jika ukuran file asli sudah WebP atau PNG tajam, gunakan JPEG kualitas tinggi 0.88-0.90
        const result = canvas.toDataURL("image/jpeg", quality);
        resolve(result || dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadRekrutmenImageItem(
  base64OrFile: string | File,
  fileName?: string
): Promise<ApiResult<{ url: string; fileId?: string }>> {
  try {
    let base64 = "";
    let name = fileName || "foto_panduan.jpg";

    if (typeof base64OrFile === "string") {
      base64 = base64OrFile;
    } else {
      name = base64OrFile.name;
      base64 = await fileToBase64(base64OrFile);
    }

    const result = await request<{ url: string; fileId?: string }>("uploadRekrutmenImage", {
      base64,
      fileName: name,
    });
    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : "Gagal mengunggah foto ke server.",
    };
  }
}

export async function uploadOrderImageItem(
  base64OrFile: string | File,
  fileName?: string
): Promise<ApiResult<{ url: string; fileId?: string }>> {
  try {
    let base64 = "";
    let name = fileName || "foto_pesanan.jpg";

    if (typeof base64OrFile === "string") {
      base64 = base64OrFile;
    } else {
      name = base64OrFile.name;
      const isImg = base64OrFile.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|svg)$/i.test(name);
      if (isImg) {
        try {
          base64 = await compressImageToFhd(base64OrFile, 1600, 0.85);
        } catch {
          base64 = await fileToBase64(base64OrFile);
        }
      } else {
        base64 = await fileToBase64(base64OrFile);
      }
    }

    let driveUrl = "";
    let driveFileId = "";
    try {
      const result = await request<{ url: string; fileId?: string }>("uploadOrderImage", {
        base64,
        fileName: name,
      });
      if (result && result.url) {
        driveUrl = result.url;
        driveFileId = result.fileId || "";
      }
    } catch (error) {
      if (!API_CONFIGURED) {
        // Jika sedang menggunakan Apps Script asli (!API_CONFIGURED artinya menggunakan API asli),
        // kita TIDAK BOLEH fallback ke base64, karena string base64 raksasa akan
        // menyebabkan Google Sheets crash saat disimpan. Lempar error agar pengguna tahu.
        throw new Error(`Gagal mengunggah ke Apps Script: ${error instanceof Error ? error.message : "Error tidak diketahui"}`);
      }
    }

    // Jika menggunakan mock (API_CONFIGURED), fallback ke base64
    if (!driveUrl && API_CONFIGURED) {
      driveUrl = base64;
    }

    if (!driveUrl) {
      throw new Error("Gagal mendapatkan URL gambar.");
    }

    return {
      success: true,
      data: {
        url: driveUrl,
        fileId: driveFileId,
      },
    };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : "Gagal memproses gambar.",
    };
  }
}

// ---------------- DASHBOARD ----------------

export async function getDashboard(): Promise<DashboardData> {
  const raw = await request<Record<string, unknown>>("getDashboard");
  const dashboard = {
    anggota: (raw?.anggota ?? {}) as DashboardData["anggota"],
    absensi: (raw?.absensi ?? {}) as DashboardData["absensi"],
    keuanganChondro: (raw?.keuanganChondro ?? {}) as DashboardData["keuanganChondro"],
    keuanganMedia: (raw?.keuanganMedia ?? {}) as DashboardData["keuanganMedia"],
  };
  cacheSet(CACHE_KEYS.DASHBOARD, dashboard);
  return dashboard;
}

// ---------------- AUTENTIKASI & USERS ----------------

export async function loginApi(username: string, password: string): Promise<User> {
  const res = await request<User>("login", { username, password });
  return res;
}

export async function getUsersApi(): Promise<User[]> {
  return await request<User[]>("getUsers");
}

export async function addUserApi(data: Partial<User> & { password: string }): Promise<User> {
  return await request<User>("addUser", data as unknown as Record<string, unknown>);
}

export async function updateUserApi(data: Partial<User> & { id: string }): Promise<User> {
  return await request<User>("updateUser", data as unknown as Record<string, unknown>);
}

export async function deleteUserApi(id: string): Promise<{ message: string }> {
  return await request<{ message: string }>("deleteUser", { id });
}

// ============================================================
// KELOLA PESANAN (ORDERS & ORDER FORMS) API LAYER
// ============================================================

const LOCAL_ORDER_FORMS_KEY = "mbc_local_order_forms";
const LOCAL_ORDERS_KEY = "mbc_local_orders";

// Initial template forms if empty
const DEFAULT_INITIAL_FORMS: OrderFormWithFields[] = [
  {
    id: "of-kaos-mbc",
    title: "Formulir Pemesanan Kaos MB Chondro",
    description: "Silakan isi detail pemesanan kaos MB Chondro berikut ini. Pesanan Anda akan langsung diverifikasi dan diproses oleh tim admin MBC.",
    status: "aktif",
    publicLink: "/order/form/of-kaos-mbc",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: [
      {
        id: "fld-1",
        formId: "of-kaos-mbc",
        label: "Nama Lengkap Customer",
        description: "Nama pemesan / penanggung jawab",
        fieldType: "text",
        required: true,
        sortOrder: 0,
        placeholder: "Contoh: Ahmad Fauzi",
      },
      {
        id: "fld-2",
        formId: "of-kaos-mbc",
        label: "Nomor WhatsApp",
        description: "Nomor aktif untuk konfirmasi & update status pengerjaan",
        fieldType: "whatsapp",
        required: true,
        sortOrder: 1,
        placeholder: "081234567890",
      },
      {
        id: "fld-3",
        formId: "of-kaos-mbc",
        label: "Alamat Pengiriman / Domisili",
        description: "Alamat lengkap pengiriman kaos",
        fieldType: "textarea",
        required: true,
        sortOrder: 2,
        placeholder: "Jl. Pemuda No. 45, RT 02/03, Kel. Sukamaju...",
      },
      {
        id: "fld-4",
        formId: "of-kaos-mbc",
        label: "Model / Tipe Kaos",
        description: "Pilih model kaos MB Chondro yang dipesan",
        fieldType: "select",
        required: true,
        sortOrder: 3,
        options: [
          { id: "1", label: "Kaos Pendek MB Chondro (Cotton Combed 30s)" },
          { id: "2", label: "Kaos Panjang MB Chondro (Cotton Combed 30s)" },
          { id: "3", label: "Polo Shirt / Kaos Berkerah MB Chondro" },
          { id: "4", label: "Kaos Custom Event / Latihan MB Chondro" },
        ],
      },
      {
        id: "fld-5",
        formId: "of-kaos-mbc",
        label: "Jumlah Pesanan (Pcs)",
        description: "Kuantitas pesanan",
        fieldType: "number",
        required: true,
        sortOrder: 4,
        placeholder: "Contoh: 12",
      },
      {
        id: "fld-6",
        formId: "of-kaos-mbc",
        label: "Ukuran",
        description: "Pilih ukuran yang diinginkan",
        fieldType: "radio",
        required: false,
        sortOrder: 5,
        options: [
          { id: "s", label: "S" },
          { id: "m", label: "M" },
          { id: "l", label: "L" },
          { id: "xl", label: "XL" },
          { id: "xxl", label: "XXL" },
          { id: "custom", label: "Campur / Custom (Tulis di Catatan)" },
        ],
      },
      {
        id: "fld-7",
        formId: "of-kaos-mbc",
        label: "Warna Pilihan",
        description: "Warna dasar produk",
        fieldType: "select",
        required: false,
        sortOrder: 6,
        options: [
          { id: "merah", label: "Merah MBC (Utama)" },
          { id: "hitam", label: "Hitam Solid" },
          { id: "putih", label: "Putih Bersih" },
          { id: "navy", label: "Navy / Biru Dongker" },
        ],
      },
      {
        id: "fld-8",
        formId: "of-kaos-mbc",
        label: "Catatan Tambahan & Keterangan Khusus",
        description: "Rincian spesifikasi, sablon nama, deadline pengerjaan, dll.",
        fieldType: "textarea",
        required: false,
        sortOrder: 7,
        placeholder: "Misal: Rincian ukuran M=5, L=10, XL=5. Tambah sablon punggung.",
      },
      {
        id: "fld-9",
        formId: "of-kaos-mbc",
        label: "Upload Referensi Desain / Mockup",
        description: "Upload file gambar desain atau bukti contoh yang diinginkan (Opsional)",
        fieldType: "file",
        required: false,
        sortOrder: 8,
      },
    ],
  },
];

const DEFAULT_INITIAL_ORDERS: OrderWithAnswers[] = [
  {
    id: "ORD-001",
    formId: "of-kaos-mbc",
    customerName: "Ahmad",
    whatsapp: "081234567890",
    status: "masuk",
    adminNote: "Customer minta selesai tanggal 28 September",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    answers: [
      { id: "a1", orderId: "ORD-001", fieldId: "fld-1", label: "Nama Lengkap Customer", value: "Ahmad Fauzi" },
      { id: "a2", orderId: "ORD-001", fieldId: "fld-2", label: "Nomor WhatsApp", value: "081234567890" },
      { id: "a3", orderId: "ORD-001", fieldId: "fld-3", label: "Alamat Pengiriman / Domisili", value: "Jl. Veteran No. 12, Solo" },
      { id: "a4", orderId: "ORD-001", fieldId: "fld-4", label: "Jenis Pesanan", value: "Kaos Custom MB Chondro" },
      { id: "a5", orderId: "ORD-001", fieldId: "fld-5", label: "Jumlah Pesanan (Pcs)", value: "24" },
      { id: "a6", orderId: "ORD-001", fieldId: "fld-6", label: "Ukuran", value: "Campur / Custom (Tulis di Catatan)" },
      { id: "a7", orderId: "ORD-001", fieldId: "fld-7", label: "Warna Pilihan", value: "Merah MBC (Utama)" },
      { id: "a8", orderId: "ORD-001", fieldId: "fld-8", label: "Catatan Tambahan", value: "Ukuran M=10, L=10, XL=4. Desain bordir logo dada kiri." },
    ],
  },
  {
    id: "ORD-002",
    formId: "of-kaos-mbc",
    customerName: "Budi",
    whatsapp: "085712345678",
    status: "diproses",
    adminNote: "Proses cetak banner outdoor 3x1 meter",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    answers: [
      { id: "b1", orderId: "ORD-002", fieldId: "fld-1", label: "Nama Lengkap Customer", value: "Budi Santoso" },
      { id: "b2", orderId: "ORD-002", fieldId: "fld-2", label: "Nomor WhatsApp", value: "085712345678" },
      { id: "b3", orderId: "ORD-002", fieldId: "fld-3", label: "Alamat Pengiriman / Domisili", value: "Sekretariat Kampus" },
      { id: "b4", orderId: "ORD-002", fieldId: "fld-4", label: "Jenis Pesanan", value: "Banner / Spanduk Kegiatan" },
      { id: "b5", orderId: "ORD-002", fieldId: "fld-5", label: "Jumlah Pesanan (Pcs)", value: "2" },
      { id: "b8", orderId: "ORD-002", fieldId: "fld-8", label: "Catatan Tambahan", value: "Bahan flexi 340gr, mata ayam di tiap sudut." },
    ],
  },
  {
    id: "ORD-003",
    formId: "of-kaos-mbc",
    customerName: "Citra",
    whatsapp: "088912345678",
    status: "selesai",
    adminNote: "Pesanan sudah diambil di kantor MBC",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    answers: [
      { id: "c1", orderId: "ORD-003", fieldId: "fld-1", label: "Nama Lengkap Customer", value: "Citra Kirana" },
      { id: "c2", orderId: "ORD-003", fieldId: "fld-2", label: "Nomor WhatsApp", value: "088912345678" },
      { id: "c3", orderId: "ORD-003", fieldId: "fld-3", label: "Alamat Pengiriman / Domisili", value: "Perum Griya Indah Blok C2" },
      { id: "c4", orderId: "ORD-003", fieldId: "fld-4", label: "Jenis Pesanan", value: "Jersey Official MB Chondro" },
      { id: "c5", orderId: "ORD-003", fieldId: "fld-5", label: "Jumlah Pesanan (Pcs)", value: "5" },
      { id: "c6", orderId: "ORD-003", fieldId: "fld-6", label: "Ukuran", value: "M" },
      { id: "c7", orderId: "ORD-003", fieldId: "fld-7", label: "Warna Pilihan", value: "Hitam Solid" },
    ],
  },
];

function getLocalOrderForms(): OrderFormWithFields[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDER_FORMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(LOCAL_ORDER_FORMS_KEY, JSON.stringify(DEFAULT_INITIAL_FORMS));
  return DEFAULT_INITIAL_FORMS;
}

function saveLocalOrderForms(forms: OrderFormWithFields[]) {
  try {
    localStorage.setItem(LOCAL_ORDER_FORMS_KEY, JSON.stringify(forms));
  } catch {}
}

function getLocalOrders(): OrderWithAnswers[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(DEFAULT_INITIAL_ORDERS));
  return DEFAULT_INITIAL_ORDERS;
}

function saveLocalOrders(orders: OrderWithAnswers[]) {
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  } catch {}
}

// ---------------- API FUNCTIONS ----------------

export async function getOrderFormsApi(): Promise<OrderFormWithFields[]> {
  try {
    const remote = await request<OrderFormWithFields[]>("getOrderForms");
    if (Array.isArray(remote) && remote.length > 0) {
      cacheSet(CACHE_KEYS.ORDER_FORMS, remote);
      saveLocalOrderForms(remote);
      return remote;
    }
  } catch {
    // fallback local storage
  }
  const local = getLocalOrderForms();
  cacheSet(CACHE_KEYS.ORDER_FORMS, local);
  return local;
}

export async function getOrderFormDetailApi(id: string): Promise<OrderFormWithFields | null> {
  const forms = await getOrderFormsApi();
  if (!id) return forms[0] || null;
  return forms.find((f) => f.id === id) || forms[0] || null;
}

export async function saveOrderFormApi(
  formData: Omit<OrderForm, "createdAt" | "updatedAt"> & { fields: OrderField[] }
): Promise<ApiResult<OrderFormWithFields>> {
  const forms = getLocalOrderForms();
  const now = new Date().toISOString();
  let updatedForm: OrderFormWithFields;

  // Tentukan apakah ini update atau create SEBELUM forms di-mutate
  const isUpdate = Boolean(formData.id && forms.some((f) => f.id === formData.id));

  if (isUpdate) {
    // Update
    updatedForm = {
      ...formData,
      publicLink: formData.publicLink || `/order/form/${formData.id}`,
      createdAt: forms.find((f) => f.id === formData.id)?.createdAt || now,
      updatedAt: now,
      fields: formData.fields,
    };
    const newForms = forms.map((f) => (f.id === formData.id ? updatedForm : f));
    saveLocalOrderForms(newForms);
  } else {
    // Create new
    const newId = formData.id || "of-" + Math.random().toString(36).substring(2, 9);
    updatedForm = {
      ...formData,
      id: newId,
      publicLink: `/order/form/${newId}`,
      createdAt: now,
      updatedAt: now,
      fields: formData.fields.map((fld, idx) => ({
        ...fld,
        id: fld.id || "fld-" + Math.random().toString(36).substring(2, 8),
        formId: newId,
        sortOrder: idx,
      })),
    };
    forms.unshift(updatedForm);
    saveLocalOrderForms(forms);
  }

  // Sinkronisasi ke server Google Apps Script
  try {
    if (isUpdate) {
      await request("updateOrderForm", updatedForm as unknown as Record<string, unknown>);
    } else {
      await request("addOrderForm", updatedForm as unknown as Record<string, unknown>);
    }
  } catch {}

  cacheSet(CACHE_KEYS.ORDER_FORMS, getLocalOrderForms());
  cacheClear(CACHE_KEYS.ORDER_ACTIVE_FORM);
  return { success: true, data: updatedForm };
}

export async function deleteOrderFormApi(id: string): Promise<ApiResult<null>> {
  const forms = getLocalOrderForms().filter((f) => f.id !== id);
  saveLocalOrderForms(forms);
  cacheSet(CACHE_KEYS.ORDER_FORMS, forms);

  try {
    await request("deleteOrderForm", { id });
  } catch {}

  return { success: true, data: null };
}

export async function getOrdersApi(formId?: string): Promise<OrderWithAnswers[]> {
  try {
    const remote = await request<OrderWithAnswers[]>("getOrders", { formId });
    if (Array.isArray(remote) && remote.length > 0) {
      cacheSet(CACHE_KEYS.ORDERS, remote);
      saveLocalOrders(remote);
      return remote;
    }
  } catch {}

  let orders = getLocalOrders();
  if (formId) {
    orders = orders.filter((o) => o.formId === formId);
  }
  cacheSet(CACHE_KEYS.ORDERS, orders);
  return orders;
}

export async function submitCustomerOrderApi(payload: {
  formId: string;
  customerName?: string;
  whatsapp?: string;
  answers: {
    fieldId: string;
    label: string;
    value: string;
    fileUrl?: string | null;
    fileName?: string | null;
    fileType?: string | null;
  }[];
}): Promise<ApiResult<{ id: string; customerName: string; whatsapp: string; createdAt: string }>> {
  const orders = getLocalOrders();
  const nextNum = orders.length + 1;
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const clientOrderId = "ORD-" + ("000" + nextNum).slice(-4) + "-" + randomStr;
  const now = new Date().toISOString();

  let customerName = payload.customerName || "";
  let whatsapp = payload.whatsapp || "";

  if (!customerName || !whatsapp) {
    for (const ans of payload.answers) {
      const lbl = ans.label.toLowerCase();
      if (!customerName && (lbl.includes("nama") || lbl.includes("customer") || lbl.includes("lengkap"))) {
        customerName = ans.value.trim();
      }
      if (!whatsapp && (lbl.includes("wa") || lbl.includes("whatsapp") || lbl.includes("hp") || lbl.includes("telepon") || lbl.includes("phone"))) {
        whatsapp = ans.value.trim();
      }
    }
  }

  let finalOrderId = clientOrderId;

  // Sync dengan server Google Apps Script (kirim clientOrderId agar ID konsisten)
  try {
    const remoteRes = await request<{ id?: string; orderId?: string }>("addOrder", {
      ...payload,
      id: clientOrderId,
      customerName,
      whatsapp,
    } as unknown as Record<string, unknown>);

    if (remoteRes && (remoteRes.id || remoteRes.orderId)) {
      finalOrderId = String(remoteRes.id || remoteRes.orderId);
    }
  } catch (err) {
    console.warn("Sinkronisasi ke Google Apps Script backend dilewati/gagal:", err);
  }

  const newOrder: OrderWithAnswers = {
    id: finalOrderId,
    formId: payload.formId,
    customerName: customerName || "Customer",
    whatsapp: whatsapp || "-",
    status: "masuk",
    adminNote: "",
    createdAt: now,
    updatedAt: now,
    answers: payload.answers.map((a, idx) => ({
      id: "ans-" + idx + "-" + Math.random().toString(36).slice(2, 6),
      orderId: finalOrderId,
      fieldId: a.fieldId,
      label: a.label,
      value: a.value,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      fileType: a.fileType,
      createdAt: now,
    })),
  };

  orders.unshift(newOrder);
  saveLocalOrders(orders);
  cacheSet(CACHE_KEYS.ORDERS, orders);
  cacheClear(CACHE_KEYS.ORDER_STATS);

  return {
    success: true,
    data: {
      id: finalOrderId,
      customerName: newOrder.customerName,
      whatsapp: newOrder.whatsapp,
      createdAt: now,
    },
  };
}

export async function updateOrderStatusApi(
  id: string,
  status?: OrderStatus,
  adminNote?: string,
  dpAmount?: number,
  paymentStatus?: "belum_bayar" | "dp" | "lunas"
): Promise<ApiResult<OrderWithAnswers>> {
  const orders = getLocalOrders();
  const now = new Date().toISOString();
  let updatedOrder: OrderWithAnswers | null = null;

  const newOrders = orders.map((o) => {
    if (o.id === id) {
      updatedOrder = {
        ...o,
        status: status !== undefined ? status : o.status,
        adminNote: adminNote !== undefined ? adminNote : o.adminNote,
        dpAmount: dpAmount !== undefined ? dpAmount : o.dpAmount,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : o.paymentStatus,
        updatedAt: now,
      };
      return updatedOrder;
    }
    return o;
  });

  if (!updatedOrder) {
    return { success: false, message: "Pesanan tidak ditemukan." };
  }

  saveLocalOrders(newOrders);
  cacheSet(CACHE_KEYS.ORDERS, newOrders);
  cacheClear(CACHE_KEYS.ORDER_STATS);

  try {
    await request("updateOrderStatus", { id, status, adminNote, dpAmount, paymentStatus });
  } catch {}

  return { success: true, data: updatedOrder };
}

export async function deleteOrderApi(id: string): Promise<ApiResult<null>> {
  const orders = getLocalOrders().filter((o) => o.id !== id);
  saveLocalOrders(orders);
  cacheSet(CACHE_KEYS.ORDERS, orders);
  cacheClear(CACHE_KEYS.ORDER_STATS);

  try {
    await request("deleteOrder", { id });
  } catch {}

  return { success: true, data: null };
}

export async function getOrderStatsApi(formId?: string): Promise<OrderStats> {
  const orders = await getOrdersApi(formId);
  const total = orders.length;
  let masuk = 0;
  let diproses = 0;
  let selesai = 0;

  for (const o of orders) {
    if (o.status === "masuk") masuk++;
    else if (o.status === "diproses") diproses++;
    else if (o.status === "selesai") selesai++;
  }

  const stats: OrderStats = { total, masuk, diproses, selesai };
  cacheSet(CACHE_KEYS.ORDER_STATS, stats);
  return stats;
}

// ============================================================
// KUPON LOCATIONS API
// ============================================================

import type { CouponLocation, CouponStats } from "../types";

function normCouponLocation(raw: Record<string, unknown>): CouponLocation {
  const rawPhoto = String(raw.photoUrl ?? raw.photo_url ?? raw.foto ?? "");
  const photoUrl = isValidPhotoUrl(rawPhoto) ? rawPhoto.trim() : undefined;

  const rawQuota = raw.ticketQuota ?? raw.ticket_quota ?? raw.kuota ?? raw.quota;
  const ticketQuota = rawQuota !== undefined && rawQuota !== null && String(rawQuota).trim() !== "" ? Number(rawQuota) : null;

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? raw.nama ?? ""),
    picName: String(raw.picName ?? raw.pic_name ?? raw.pic ?? ""),
    whatsapp: String(raw.whatsapp ?? raw.wa ?? ""),
    latitude: parseFloat(String(raw.latitude ?? raw.lat ?? 0)),
    longitude: parseFloat(String(raw.longitude ?? raw.lng ?? raw.lon ?? 0)),
    address: String(raw.address ?? raw.alamat ?? ""),
    description: String(raw.description ?? raw.deskripsi ?? ""),
    photoUrl,
    ticketQuota: ticketQuota && !isNaN(ticketQuota) ? ticketQuota : null,
    status: (raw.status === "nonaktif" ? "nonaktif" : "aktif") as CouponLocation["status"],
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ""),
  };
}

export async function getCouponLocationsApi(activeOnly = false): Promise<CouponLocation[]> {
  const raw = await request<unknown[]>("getCouponLocations", { activeOnly });
  const list = (raw ?? []).map((item) => normCouponLocation(item as Record<string, unknown>));
  cacheSet(CACHE_KEYS.KUPON, list);
  return list;
}

export async function addCouponLocationApi(
  data: Omit<CouponLocation, "id" | "createdAt" | "updatedAt">
): Promise<ApiResult<CouponLocation>> {
  try {
    const raw = await request<Record<string, unknown>>("addCouponLocation", {
      name: data.name,
      picName: data.picName,
      whatsapp: data.whatsapp,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      description: data.description ?? "",
      photoUrl: data.photoUrl ?? "",
      ticketQuota: data.ticketQuota,
      status: data.status,
    });
    const loc = normCouponLocation(raw);
    cacheMutate<CouponLocation[]>(CACHE_KEYS.KUPON, (prev) => [loc, ...(prev ?? [])]);
    return { success: true, data: loc };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menambah lokasi." };
  }
}

export async function updateCouponLocationApi(
  data: Partial<CouponLocation> & { id: string }
): Promise<ApiResult<CouponLocation>> {
  try {
    const raw = await request<Record<string, unknown>>("updateCouponLocation", {
      id: data.id,
      name: data.name,
      picName: data.picName,
      whatsapp: data.whatsapp,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address,
      description: data.description ?? "",
      photoUrl: data.photoUrl ?? "",
      ticketQuota: data.ticketQuota,
      status: data.status,
    });
    const loc = normCouponLocation(raw);
    cacheMutate<CouponLocation[]>(CACHE_KEYS.KUPON, (prev) =>
      (prev ?? []).map((l) => (l.id === loc.id ? loc : l))
    );
    return { success: true, data: loc };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal memperbarui lokasi." };
  }
}

export async function deleteCouponLocationApi(id: string): Promise<ApiResult<null>> {
  try {
    await request("deleteCouponLocation", { id });
    cacheMutate<CouponLocation[]>(CACHE_KEYS.KUPON, (prev) =>
      (prev ?? []).filter((l) => l.id !== id)
    );
    return { success: true, data: null };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Gagal menghapus lokasi." };
  }
}

export function getCouponStatsFromList(list: CouponLocation[]): CouponStats {
  const aktif = list.filter((l) => l.status === "aktif").length;
  return { total: list.length, aktif, nonaktif: list.length - aktif };
}