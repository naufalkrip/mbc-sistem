/**
 * Penyimpanan lokal foto anggota (Hybrid Storage).
 * Memastikan foto profil anggota tetap tersimpan dan langsung tampil di UI
 * meskipun Apps Script backend belum di-deploy ulang atau respons server tertunda.
 */

const STORAGE_PREFIX = "mbc_member_photo_id_";
const NAME_PREFIX = "mbc_member_photo_name_";

export function saveMemberPhoto(id: string, name: string, photoBase64: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const cleanPhoto = (photoBase64 || "").trim();
    if (cleanPhoto) {
      if (id) localStorage.setItem(`${STORAGE_PREFIX}${id}`, cleanPhoto);
      if (name) localStorage.setItem(`${NAME_PREFIX}${name.toLowerCase().trim()}`, cleanPhoto);
    } else {
      if (id) localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
      if (name) localStorage.removeItem(`${NAME_PREFIX}${name.toLowerCase().trim()}`);
    }
  } catch {
    // Abaikan jika quota localStorage penuh
  }
}

export function getMemberPhoto(id?: string, name?: string): string | undefined {
  if (typeof window === "undefined" || !window.localStorage) return undefined;
  try {
    if (id) {
      const byId = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (byId) return byId;
    }
    if (name) {
      const byName = localStorage.getItem(`${NAME_PREFIX}${name.toLowerCase().trim()}`);
      if (byName) {
        // Otomatis tautkan ke ID jika ID sudah tersedia
        if (id) {
          try {
            localStorage.setItem(`${STORAGE_PREFIX}${id}`, byName);
          } catch {}
        }
        return byName;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function deleteMemberPhoto(id?: string, name?: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (id) localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
    if (name) localStorage.removeItem(`${NAME_PREFIX}${name.toLowerCase().trim()}`);
  } catch {}
}
