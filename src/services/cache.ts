// ============================================================
// REALTIME & HIGH-SPEED CACHE ENGINE (MB CHONDRO)
// ============================================================
// Mendukung In-Memory 0ms, LocalStorage Persistance,
// SWR (Stale-While-Revalidate), dan Realtime Multi-Tab Sync.
// ============================================================

const CACHE_PREFIX = "mbc-cache:";
const TTL = 24 * 60 * 60 * 1000; // 24 jam agar instan setiap buka halaman

export const CACHE_KEYS = {
  ANGGOTA: "anggota",
  ABSENSI: "absensi",
  KEUANGAN_CHONDRO: "keuangan-chondro",
  KEUANGAN_MEDIA: "keuangan-media",
  TRANSAKSI: "transaksi",
  TRANSAKSI_DETAIL: "transaksi-detail",
  REKRUITMEN: "rekrutmen",
  REKRUITMEN_FORM: "rekrutmen-form",
  REKRUITMEN_SUBMISSIONS: "rekrutmen-submissions",
  REKRUITMEN_STATS: "rekrutmen-stats",
  ORDER_FORMS: "order-forms",
  ORDER_ACTIVE_FORM: "order-active-form",
  ORDERS: "orders",
  ORDER_STATS: "order-stats",
  DASHBOARD: "dashboard",
  KUPON: "kupon-locations",
  KUPON_STATS: "kupon-stats",
} as const;

interface CacheEntry {
  t: number;
  v: unknown;
}

// In-Memory Fast Cache
const memoryCache = new Map<string, unknown>();

// Event listeners for realtime local reactivity
type CacheListener = (key: string, value: unknown) => void;
const listeners = new Set<CacheListener>();

// BroadcastChannel for cross-tab sync if supported
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("mbc_realtime_sync");
    broadcastChannel.onmessage = (event) => {
      if (event.data && typeof event.data.key === "string") {
        memoryCache.set(event.data.key, event.data.value);
        listeners.forEach((fn) => fn(event.data.key, event.data.value));
      }
    };
  }
} catch {
  // broadcastChannel not supported
}

export function cacheGet<T>(key: string): T | null {
  // 1. Check in-memory first (0ms instant)
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.t !== "number" || !("v" in parsed)) return null;
    if (Date.now() - parsed.t > TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    // Populate in-memory
    memoryCache.set(key, parsed.v);
    return parsed.v as T;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown, notify = true): void {
  // Update in-memory
  memoryCache.set(key, value);

  // Update localStorage
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // Abaikan jika localStorage penuh
  }

  // Broadcast & notify listeners
  if (notify) {
    listeners.forEach((fn) => {
      try {
        fn(key, value);
      } catch (err) {
        console.error("Cache listener error:", err);
      }
    });

    try {
      broadcastChannel?.postMessage({ key, value });
    } catch {
      // ignore
    }
  }
}

export function cacheMutate<T>(key: string, updater: (prev: T | null) => T): T {
  const current = cacheGet<T>(key);
  const updated = updater(current);
  cacheSet(key, updated, true);
  return updated;
}

export function cacheSubscribe(callback: CacheListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function cacheClear(key: string): void {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}