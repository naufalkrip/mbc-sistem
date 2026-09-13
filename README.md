# MB CHONDRO — Sistem Manajemen Organisasi

Website manajemen organisasi mbc sistem berbasis **React + Vite + TypeScript** dengan backend **Google Apps Script** dan database **Google Spreadsheet**.

```
React Website
      ↓ (fetch → src/services/api.ts)
Google Apps Script Web App (apps-script/Code.gs)
      ↓
Google Spreadsheet (ANGGOTA, ABSENSI, KEUANGAN_CHONDRO, KEUANGAN_MEDIA)
```

---

## Fitur

- **Dashboard** — ringkasan anggota, absensi, dan keuangan kedua kas
- **Data Anggota** — CRUD, search, filter divisi/status, detail
- **Absensi** — input, riwayat, filter, rekap per anggota
- **Keuangan mbc sistem** — CRUD transaksi, saldo, filter, format Rupiah
- **Keuangan Media** — sama dengan keuangan utama (sheet terpisah)
- **Laporan PDF** — 4 jenis laporan + filter periode + download PDF (jsPDF)

---

## Cara Menjalankan (Development)

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

---

## 1. Siapkan Backend Google Apps Script

1. Buka project Apps Script:
   `https://script.google.com/u/0/home/projects/1zJPjV4XTa6dZe0KHpHKEI2qfMA-WtEh1ekF8BCNb9DwE5_O8BAAh274l/edit`

2. Ganti seluruh isi **Code.gs** dengan isi file
   [`apps-script/Code.gs`](./apps-script/Code.gs) di project ini.

3. Klik **Deploy → New deployment** → pilih **Web app**:
   - **Description**: `mbc sistem API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`

4. Klik **Deploy** → salin **Web app URL** (berakhiran `/exec`).

5. Buka `src/config.ts` di project ini dan isi:

```ts
export const API_URL = "https://script.google.com/macros/s/<ID_DEPLOYMENT>/exec";
```

> Catatan: `ensureSetup()` di Code.gs **otomatis membuat** sheet `ANGGOTA`, `ABSENSI`,
> `KEUANGAN_CHONDRO`, `KEUANGAN_MEDIA` beserta header bila belum ada.
> Script **tidak menghapus** data yang sudah ada.

## 2. Struktur Spreadsheet

### Sheet ANGGOTA
| ID Anggota | Nama Lengkap | Divisi | Jabatan | No. HP | Status | Tanggal Bergabung | Keterangan |
|---|---|---|---|---|---|---|---|
| MB001 | Ahmad | Musik | Anggota | 08xxxx | Aktif | 2026-01-01 | - |

Status valid: `Aktif`, `Cuti`, `Tidak Aktif`

### Sheet ABSENSI
| ID Absensi | ID Anggota | Nama | Tanggal | Kegiatan | Status Kehadiran | Keterangan | Waktu |
|---|---|---|---|---|---|---|---|
| ABS001 | MB001 | Ahmad | 2026-08-16 | Latihan Musik | Hadir | - | Pagi |

Status valid: `Hadir`, `Izin`, `Sakit`, `Cuti`, `Alpa`
Waktu valid: `Pagi`, `Siang`, `Malam`

### Sheet KEUANGAN_CHONDRO & KEUANGAN_MEDIA
| ID Transaksi | Tanggal | Jenis | Kategori | Keterangan | Nominal | Penanggung Jawab |
|---|---|---|---|---|---|---|
| TRX001 | 2026-08-16 | Pemasukan | Iuran | Iuran bulanan | 150000 | Budi |

Jenis valid: `Pemasukan`, `Pengeluaran`. Saldo = Pemasukan − Pengeluaran.

---

## Struktur Project

```
src/
├── components/
│   ├── layout/        → Sidebar, Header, Layout
│   ├── ui/            → StatCard, DataTable, Modal, Toast, Pagination, dll.
│   ├── dashboard/
│   ├── anggota/
│   ├── absensi/
│   ├── keuangan/      → Keuangan.tsx (dipakai Chondro & Media)
│   └── laporan/
├── pages/             → Dashboard, Anggota, Absensi, KeuanganChondro, KeuanganMedia, Laporan
├── services/api.ts    → semua komunikasi ke Apps Script (single source)
├── contexts/ToastContext.tsx
├── hooks/useApi.ts
├── types/index.ts
├── utils/             → format.ts, pdf.ts
├── config.ts          → API_URL & konstanta
├── App.tsx
├── main.tsx
└── index.css
```

Semua akses data **hanya** melalui `src/services/api.ts` — tidak ada fetch berulang di komponen.

## Build Production

```bash
npm run build
npm run preview   # pratinjau hasil build lokal
```

Hasil build berada di folder `dist/` dan dapat di-deploy ke hosting statis
(Netlify, Vercel, GitHub Pages, dll).

## Typecheck

```bash
npm run typecheck
```

## Keamanan

- Tidak ada kredensial / API key di frontend.
- Spreadsheet hanya diakses melalui Apps Script (bukan dari browser).
- Opsional: aktifkan proteksi token di `Code.gs` dengan mengisi variabel `API_TOKEN`.