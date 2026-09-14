import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { cacheGet, cacheSet, cacheSubscribe } from "../services/cache";

interface UseApiOptions {
  pollingInterval?: number; // interval in ms for background sync (e.g. 10000ms)
  revalidateOnFocus?: boolean;
  immediate?: boolean; // fetch immediately on mount
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: (silent?: boolean) => Promise<void>;
  mutate: (newDataOrUpdater: T | ((prev: T | null) => T), syncServer?: boolean) => void;
}

/**
 * High-performance Realtime SWR Hook.
 * - Instan 0ms: Langsung render data dari in-memory / local cache tanpa loading spinner.
 * - Background Sync: Memperbarui data di latar belakang tanpa mengganggu interaksi pengguna.
 * - Realtime Sync: Otomatis sinkronisasi lintas komponen & tab browser saat data berubah.
 * - Window Focus Sync: Otomatis cek pembaruan saat pengguna kembali membuka tab.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  errorMessage = "Gagal mengambil data.",
  cacheKey?: string,
  options: UseApiOptions = { pollingInterval: 8000, revalidateOnFocus: true, immediate: true }
): UseApiResult<T> {
  const cached = useMemo(() => (cacheKey ? cacheGet<T>(cacheKey) : null), [cacheKey]);
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(false); // Start with false - show cached data instantly
  const [error, setError] = useState<string | null>(null);
  const { error: toastError } = useToast();

  const dataRef = useRef<T | null>(cached);
  dataRef.current = data;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const isInitialMount = useRef(true);

  // Realtime subscription to local cache updates
  useEffect(() => {
    if (!cacheKey) return;
    const unsub = cacheSubscribe((key, val) => {
      if (key === cacheKey && val !== undefined) {
        dataRef.current = val as T;
        setData(val as T);
        setLoading(false);
      }
    });
    return unsub;
  }, [cacheKey]);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent && dataRef.current === null) {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await fetcherRef.current();
        dataRef.current = result;
        setData(result);
        if (cacheKey) {
          cacheSet(cacheKey, result);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : errorMessage;
        if (dataRef.current === null) {
          setError(msg);
          toastError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, errorMessage]
  );

  // Initial fetch - run immediately on mount, then on refresh dependency changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (options.immediate !== false) {
        void refresh(true);
      }
    }
  }, [refresh, options.immediate]);

  // Realtime Polling & Window Focus Sync
  useEffect(() => {
    // 1. Focus revalidation
    const onFocus = () => {
      if (options.revalidateOnFocus !== false) {
        void refresh(true);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // 2. Periodic background polling - faster default (8s instead of 12s)
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const interval = options.pollingInterval ?? 8000;
    if (interval > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") {
          void refresh(true);
        }
      }, interval);
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (intervalId) clearInterval(intervalId);
    };
  }, [options.pollingInterval, options.revalidateOnFocus, refresh, options.immediate]);

  // Optimistic local mutation (Instant 0ms UI update)
  const mutate = useCallback(
    (newDataOrUpdater: T | ((prev: T | null) => T), syncServer = false) => {
      const nextVal =
        typeof newDataOrUpdater === "function"
          ? (newDataOrUpdater as (prev: T | null) => T)(dataRef.current)
          : newDataOrUpdater;

      dataRef.current = nextVal;
      setData(nextVal);
      if (cacheKey) {
        cacheSet(cacheKey, nextVal);
      }
      if (syncServer) {
        void refresh(true);
      }
    },
    [cacheKey, refresh]
  );

  return { data, loading, error, refresh, mutate };
}

/** Hook untuk state pagination sederhana */
export function usePagination(totalItems: number, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);

  return { page, setPage, totalPages, start, end, pageSize };
}