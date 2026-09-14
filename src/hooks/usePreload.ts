import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getDashboard, getAbsensi, getAnggota, getKeuanganChondro, getKeuanganMedia, getTransaksiGroups } from "../services/api";
import { CACHE_KEYS, cacheGet } from "../services/cache";

const CRITICAL_CACHES = [
  { key: CACHE_KEYS.DASHBOARD, fetcher: getDashboard },
  { key: CACHE_KEYS.ANGGOTA, fetcher: getAnggota },
  { key: CACHE_KEYS.ABSENSI, fetcher: getAbsensi },
  { key: CACHE_KEYS.KEUANGAN_CHONDRO, fetcher: getKeuanganChondro },
  { key: CACHE_KEYS.KEUANGAN_MEDIA, fetcher: getKeuanganMedia },
  { key: CACHE_KEYS.TRANSAKSI, fetcher: getTransaksiGroups },
];

let preloadInitiated = false;

/**
 * Hook untuk pre-fetch data kritis saat aplikasi pertama kali dimuat
 * dan saat navigasi ke halaman tertentu
 */
export function usePreloadCriticalData() {
  const location = useLocation();
  const preloadedRef = useRef<Set<string>>(new Set());

  // Preload critical data on app mount (once)
  useEffect(() => {
    if (preloadInitiated) return;
    preloadInitiated = true;

    // Fire-and-forget preload untuk data utama
    CRITICAL_CACHES.forEach(({ key, fetcher }) => {
      // Hanya preload jika belum ada di cache
      if (!cacheGet(key)) {
        fetcher().catch(() => {
          // Silent fail - cache akan diisi saat user membuka halaman
        });
      }
    });
  }, []);

  // Route-based preload - prefetch data untuk halaman yang akan dikunjungi
  useEffect(() => {
    const path = location.pathname;
    
    // Prefetch berdasarkan route
    const prefetchForRoute = async () => {
      switch (path) {
        case "/":
        case "/dashboard":
          if (!preloadedRef.current.has("dashboard")) {
            preloadedRef.current.add("dashboard");
            await Promise.all([
              getDashboard().catch(() => {}),
              getAnggota().catch(() => {}),
              getAbsensi().catch(() => {}),
              getKeuanganChondro().catch(() => {}),
              getKeuanganMedia().catch(() => {}),
            ]);
          }
          break;
        case "/anggota":
          if (!preloadedRef.current.has("anggota")) {
            preloadedRef.current.add("anggota");
            await getAnggota().catch(() => {});
          }
          break;
        case "/absensi":
          if (!preloadedRef.current.has("absensi")) {
            preloadedRef.current.add("absensi");
            await Promise.all([
              getAbsensi().catch(() => {}),
              getAnggota().catch(() => {}),
            ]);
          }
          break;
        case "/keuangan":
          if (!preloadedRef.current.has("keuangan")) {
            preloadedRef.current.add("keuangan");
            await getKeuanganChondro().catch(() => {});
          }
          break;
        case "/keuangan-media":
          if (!preloadedRef.current.has("keuangan-media")) {
            preloadedRef.current.add("keuangan-media");
            await getKeuanganMedia().catch(() => {});
          }
          break;
        case "/transaksi":
          if (!preloadedRef.current.has("transaksi")) {
            preloadedRef.current.add("transaksi");
            await getTransaksiGroups().catch(() => {});
          }
          break;
        case "/rekrutmen":
          if (!preloadedRef.current.has("rekrutmen")) {
            preloadedRef.current.add("rekrutmen");
            // Rekrutmen data akan di-load oleh halaman itself
          }
          break;
      }
    };

    // Debounce prefetch untuk menghindari request berlebihan
    const timer = setTimeout(() => {
      prefetchForRoute();
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);
}

/**
 * Fungsi untuk manual preload data tertentu
 * Bisa dipanggil sebelum navigasi (misal: onMouseEnter di link navigasi)
 */
export function preloadRouteData(path: string): void {
  const cached = new Set<string>();
  
  switch (path) {
    case "/":
    case "/dashboard":
      if (!cached.has("dashboard")) {
        cached.add("dashboard");
        Promise.all([
          getDashboard().catch(() => {}),
          getAnggota().catch(() => {}),
          getAbsensi().catch(() => {}),
          getKeuanganChondro().catch(() => {}),
          getKeuanganMedia().catch(() => {}),
        ]);
      }
      break;
    case "/anggota":
      if (!cached.has("anggota")) {
        cached.add("anggota");
        getAnggota().catch(() => {});
      }
      break;
    case "/absensi":
      if (!cached.has("absensi")) {
        cached.add("absensi");
        Promise.all([
          getAbsensi().catch(() => {}),
          getAnggota().catch(() => {}),
        ]);
      }
      break;
    case "/keuangan":
      if (!cached.has("keuangan")) {
        cached.add("keuangan");
        getKeuanganChondro().catch(() => {});
      }
      break;
    case "/keuangan-media":
      if (!cached.has("keuangan-media")) {
        cached.add("keuangan-media");
        getKeuanganMedia().catch(() => {});
      }
      break;
    case "/transaksi":
      if (!cached.has("transaksi")) {
        cached.add("transaksi");
        getTransaksiGroups().catch(() => {});
      }
      break;
  }
}