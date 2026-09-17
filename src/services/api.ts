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
} from "../types";
import { normAbsensi, normAnggota, normTransaksi, normalizeStatusAnggota } from "../utils/format";
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