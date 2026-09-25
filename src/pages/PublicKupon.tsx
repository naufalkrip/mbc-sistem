import { useState, useMemo, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getCouponLocationsApi } from "../services/api";
import type { CouponLocation } from "../types";
import { isValidPhotoUrl } from "../utils/format";

// Fix leaflet icon Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeKuponIcon(active: boolean) {
  const size = active ? 38 : 32;
  return new L.DivIcon({
    html: `<div style="background:${active ? "#b91c1c" : "#dc2626"};color:white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(220,38,38,${active ? "0.65" : "0.4"});border:2px solid white;transition:all 0.2s;"><span style="transform:rotate(45deg);font-size:${active ? "16" : "13"}px;">🎟️</span></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4],
  });
}

function formatWa(wa: string): string {
  const clean = wa.replace(/\D/g, "");
  if (clean.startsWith("0")) return "62" + clean.slice(1);
  if (clean.startsWith("62")) return clean;
  return "62" + clean;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Smooth fly-to component
function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16, { animate: true, duration: 1.2 });
  }, [coords, map]);
  return null;
}

// Lightbox 100% Fullscreen
function Lightbox({ src, title, onClose }: { src: string; title?: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "#000000",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        animation: "pkFadeIn 0.2s ease",
        cursor: "zoom-out",
        overflow: "hidden",
      }}
    >
      {/* Top Floating Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)",
          zIndex: 10,
        }}
      >
        <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.8)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>📷</span>
          <span style={{ maxWidth: "70vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title || "Foto Lokasi"}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255, 255, 255, 0.22)",
            border: "1px solid rgba(255, 255, 255, 0.35)",
            color: "#ffffff",
            borderRadius: "50px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          ✕ Tutup
        </button>
      </div>

      {/* Gambar Full Layar (100% Layar) */}
      <img
        src={src}
        alt={title || "Foto lokasi full"}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: "100vw",
          maxHeight: "100vh",
          objectFit: "contain",
          display: "block",
          userSelect: "none",
        }}
      />

      {/* Petunjuk Bawah */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          color: "rgba(255,255,255,0.75)",
          fontSize: "0.8rem",
          background: "rgba(0,0,0,0.6)",
          padding: "6px 14px",
          borderRadius: 20,
          backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}
      >
        Ketuk foto / layar untuk menutup
      </div>
    </div>
  );
}

export function PublicKupon() {
  const [locations, setLocations] = useState<CouponLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"semua" | "terdekat">("semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [detailLoc, setDetailLoc] = useState<CouponLocation | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ src: string; title: string } | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const data = await getCouponLocationsApi(true);
      setLocations(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (filter === "terdekat" && !userPos) {
      navigator.geolocation?.getCurrentPosition(
        pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { /* silently ignore — don't crash */ }
      );
    }
  }, [filter, userPos]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (locations.length === 0) return [-6.92, 109.62];
    const lat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
    const lng = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;
    return [lat, lng];
  }, [locations]);

  const filtered = useMemo(() => {
    let list = [...locations];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(l => l.name.toLowerCase().includes(q) || l.picName.toLowerCase().includes(q) || l.address.toLowerCase().includes(q));
    if (filter === "terdekat" && userPos) {
      list = list.sort((a, b) => haversine(userPos.lat, userPos.lng, a.latitude, a.longitude) - haversine(userPos.lat, userPos.lng, b.latitude, b.longitude));
    }
    return list;
  }, [locations, search, filter, userPos]);

  const handleSelectLoc = (loc: CouponLocation) => {
    setSelectedId(loc.id);
    setFlyTo([loc.latitude, loc.longitude]);
  };

  return (
    <div className="pk-root">
      <style>{`
        .pk-root { min-height:100vh; font-family:'Poppins','Inter',sans-serif; background:#f8f9fa; display:flex; flex-direction:column; }
        .pk-header { background:#dc2626; color:white; box-shadow:0 2px 12px rgba(220,38,38,0.3); }
        .pk-header-inner { display:flex; align-items:center; justify-content:space-between; padding:14px 20px 10px; }
        .pk-brand { display:flex; align-items:center; gap:12px; }
        .pk-brand-logo { font-size:2rem; line-height:1; }
        .pk-brand-name { font-size:1.1rem; font-weight:800; letter-spacing:0.5px; }
        .pk-brand-sub { font-size:0.72rem; opacity:0.88; }
        .pk-count { text-align:center; }
        .pk-count-num { font-size:1.6rem; font-weight:800; display:block; line-height:1; }
        .pk-count-lbl { font-size:0.68rem; opacity:0.8; display:block; }
        .pk-tagline { padding:8px 20px 14px; border-top:1px solid rgba(255,255,255,0.2); font-size:0.82rem; opacity:0.92; }
        .pk-tagline p { margin:0; }
        .pk-controls { background:white; padding:12px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.08); display:flex; flex-direction:column; gap:10px; }
        .pk-search-wrap { display:flex; align-items:center; gap:8px; background:#f1f5f9; border-radius:50px; padding:8px 14px; border:1px solid #e2e8f0; }
        .pk-search-input { flex:1; border:none; background:transparent; outline:none; font-size:0.88rem; color:#1e293b; font-family:inherit; }
        .pk-search-input::placeholder { color:#94a3b8; }
        .pk-pills { display:flex; gap:8px; }
        .pk-pill { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:50px; padding:5px 14px; font-size:0.78rem; font-weight:500; cursor:pointer; color:#475569; font-family:inherit; transition:all 0.2s; }
        .pk-pill:hover { background:#fee2e2; border-color:#fca5a5; color:#dc2626; }
        .pk-pill.active { background:#dc2626; border-color:#dc2626; color:white; }
        .pk-main { display:flex; flex:1; flex-direction:column; }
        @media(min-width:768px){ .pk-main{ flex-direction:row; } .pk-map-wrap{ flex:1.4; } .pk-list-wrap{ width:340px; overflow-y:auto; } }
        .pk-map-wrap { height:55vw; min-height:300px; max-height:60vh; position:relative; background:#e8f4f8; }
        @media(min-width:768px){ .pk-map-wrap{ height:auto; max-height:none; min-height:500px; } }
        .pk-map-overlay { height:100%; width:100%; opacity:0; transition:opacity 0.5s; }
        .pk-map-overlay.visible { opacity:1; }
        .pk-center { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:#64748b; font-size:0.9rem; }
        .pk-spinner { width:32px; height:32px; border:3px solid #e2e8f0; border-top-color:#dc2626; border-radius:50%; animation:pkSpin 0.8s linear infinite; }
        @keyframes pkSpin { to { transform:rotate(360deg); } }
        @keyframes pkFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pkSlideUp { from { transform:translateY(60px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        .pk-retry { background:#dc2626; color:white; border:none; border-radius:8px; padding:8px 18px; font-size:0.85rem; cursor:pointer; font-family:inherit; }
        .pk-list-wrap { background:white; display:flex; flex-direction:column; border-left:1px solid #e2e8f0; max-height:60vh; overflow-y:auto; }
        @media(min-width:768px){ .pk-list-wrap{ max-height:none; } }
        .pk-list-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 10px; border-bottom:1px solid #e2e8f0; position:sticky; top:0; background:white; z-index:1; }
        .pk-list-title { font-size:0.88rem; font-weight:700; color:#1e293b; }
        .pk-list-badge { font-size:0.75rem; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:50px; }
        .pk-empty { padding:32px 16px; text-align:center; color:#64748b; font-size:0.85rem; }
        .pk-card { display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:background 0.15s; }
        .pk-card:hover { background:#fef2f2; }
        .pk-card.selected { background:#fff1f1; border-left:3px solid #dc2626; }
        .pk-card-thumb { width:52px; height:52px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; flex-shrink:0; }
        .pk-card-thumb-ph { width:52px; height:52px; background:#fee2e2; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; }
        .pk-card-body { flex:1; min-width:0; }
        .pk-card-name { font-size:0.86rem; font-weight:700; color:#1e293b; margin-bottom:2px; }
        .pk-card-addr { font-size:0.75rem; color:#64748b; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pk-card-pic { font-size:0.73rem; color:#94a3b8; }
        .pk-card-dist { font-size:0.72rem; color:#dc2626; font-weight:600; margin-top:2px; }
        .pk-card-btns { display:flex; flex-direction:column; gap:6px; flex-shrink:0; }
        .pk-card-btn { background:#dc2626; color:white; border:none; border-radius:8px; padding:6px 12px; font-size:0.73rem; font-weight:600; cursor:pointer; font-family:inherit; text-align:center; text-decoration:none; }
        .pk-card-btn:hover { background:#b91c1c; }
        .pk-card-btn-gmaps { background:#eff6ff; color:#1a73e8; border:1px solid #bfdbfe; }
        .pk-card-btn-gmaps:hover { background:#dbeafe; }
        .pk-popup-wrap .leaflet-popup-content-wrapper { border-radius:12px!important; box-shadow:0 4px 24px rgba(0,0,0,0.15)!important; padding:0!important; overflow:hidden; }
        .pk-popup-wrap .leaflet-popup-content { margin:0!important; width:220px!important; }
        .pk-popup-photo-wrap { position:relative; cursor:zoom-in; }
        .pk-popup-photo { width:100%; height:105px; object-fit:cover; display:block; }
        .pk-popup-photo-badge { position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.65); color:white; font-size:0.65rem; padding:2px 6px; border-radius:10px; backdrop-filter:blur(2px); pointer-events:none; }
        .pk-popup-title { font-size:0.88rem; font-weight:700; color:#1e293b; padding:10px 12px 4px; font-family:Poppins,sans-serif; }
        .pk-popup-row { font-size:0.75rem; color:#475569; padding:2px 12px; font-family:Poppins,sans-serif; }
        .pk-popup-wa { color:#16a34a; text-decoration:none; font-weight:600; }
        .pk-popup-actions { display:flex; gap:6px; padding:8px 12px 10px; }
        .pk-popup-btn { flex:1; padding:6px 0; border-radius:6px; font-size:0.73rem; font-weight:600; cursor:pointer; border:none; font-family:Poppins,sans-serif; text-align:center; text-decoration:none; display:inline-block; }
        .pk-popup-btn-detail { background:#dc2626; color:white; }
        .pk-popup-btn-detail:hover { background:#b91c1c; }
        .pk-popup-btn-gmaps { background:#e8f0fe; color:#1a73e8; border:1px solid #c2e7ff; }
        .pk-popup-btn-gmaps:hover { background:#d2e3fc; }
        .pk-popup-btn-wa { background:#dcfce7; color:#16a34a; }
        .pk-detail-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:flex-end; justify-content:center; backdrop-filter:blur(2px); }
        @media(min-width:640px){ .pk-detail-backdrop{ align-items:center; } }
        .pk-detail-modal { background:white; border-radius:20px 20px 0 0; width:100%; max-width:480px; max-height:92vh; position:relative; animation:pkSlideUp 0.3s ease; overflow:hidden; }
        @media(min-width:640px){ .pk-detail-modal{ border-radius:16px; } }
        .pk-detail-close { position:absolute; top:14px; right:14px; background:rgba(255,255,255,0.9); border:none; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9rem; color:#1e293b; z-index:10; box-shadow:0 2px 6px rgba(0,0,0,0.2); }
        .pk-detail-scroll { overflow-y:auto; max-height:92vh; padding-bottom:24px; }
        .pk-detail-photo-wrap { position:relative; width:100%; height:220px; background:#000; cursor:zoom-in; overflow:hidden; }
        .pk-detail-photo { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.3s; }
        .pk-detail-photo-wrap:hover .pk-detail-photo { transform:scale(1.02); }
        .pk-photo-badge { position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,0.72); backdrop-filter:blur(4px); color:white; font-size:0.75rem; font-weight:600; padding:6px 12px; border-radius:20px; display:flex; align-items:center; gap:6px; pointer-events:none; border:1px solid rgba(255,255,255,0.2); box-shadow:0 2px 6px rgba(0,0,0,0.3); }
        .pk-detail-title { font-size:1.15rem; font-weight:800; color:#1e293b; padding:16px 20px 8px; }
        .pk-detail-info { padding:0 20px; display:flex; flex-direction:column; gap:8px; }
        .pk-detail-row { display:flex; gap:10px; font-size:0.85rem; color:#475569; }
        .pk-detail-row span:first-child { flex-shrink:0; width:22px; }
        .pk-detail-wa { color:#16a34a; text-decoration:none; font-weight:600; }
        .pk-detail-actions { display:flex; flex-direction:column; gap:10px; padding:16px 20px 0; }
        .pk-btn { display:flex; align-items:center; justify-content:center; gap:8px; text-align:center; padding:13px 16px; border-radius:10px; font-size:0.88rem; font-weight:700; cursor:pointer; border:none; font-family:inherit; text-decoration:none; transition:all 0.2s; }
        .pk-btn-gmaps { background:#1a73e8; color:white; box-shadow:0 3px 10px rgba(26,115,232,0.3); }
        .pk-btn-gmaps:hover { background:#1557b0; box-shadow:0 4px 14px rgba(26,115,232,0.45); }
        .pk-btn-wa { background:#16a34a; color:white; }
        .pk-btn-wa:hover { background:#15803d; }
        .pk-btn-map { background:#f1f5f9; color:#1e293b; }
        .pk-btn-map:hover { background:#e2e8f0; }
        .pk-footer { background:#1e293b; color:#94a3b8; text-align:center; padding:12px; font-size:0.75rem; font-family:Poppins,sans-serif; }
      `}</style>

      {/* HEADER */}
      <header className="pk-header">
        <div className="pk-header-inner">
          <div className="pk-brand">
            <div className="pk-brand-logo">🎟️</div>
            <div>
              <div className="pk-brand-name">MB CHONDRO</div>
              <div className="pk-brand-sub">Peta Penjualan Kupon Jalan Sehat</div>
            </div>
          </div>
          <div className="pk-count">
            <span className="pk-count-num">{locations.length}</span>
            <span className="pk-count-lbl">Lokasi</span>
          </div>
        </div>
        <div className="pk-tagline">
          <p>Temukan lokasi pembelian kupon <strong>Jalan Sehat MB Chondro</strong> terdekat dari Anda.</p>
        </div>
      </header>

      {/* SEARCH + FILTER */}
      <div className="pk-controls">
        <div className="pk-search-wrap">
          <span style={{ fontSize:"0.9rem" }}>🔍</span>
          <input className="pk-search-input" placeholder="Cari lokasi penjualan..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:"0.8rem" }}>✕</button>}
        </div>
        <div className="pk-pills">
          <button className={`pk-pill${filter === "semua" ? " active" : ""}`} onClick={() => setFilter("semua")}>Semua Lokasi</button>
          <button className={`pk-pill${filter === "terdekat" ? " active" : ""}`} onClick={() => setFilter("terdekat")}>📍 Terdekat</button>
        </div>
      </div>

      {/* MAIN: MAP + LIST */}
      <div className="pk-main">
        {/* MAP */}
        <div className="pk-map-wrap">
          {loading ? (
            <div className="pk-center"><div className="pk-spinner" /><span>Memuat peta...</span></div>
          ) : error ? (
            <div className="pk-center">
              <span>❌ Peta tidak dapat dimuat</span>
              <button className="pk-retry" onClick={load}>Coba Lagi</button>
            </div>
          ) : (
            <div className={`pk-map-overlay${mapVisible ? " visible" : ""}`}>
              <MapContainer center={defaultCenter} zoom={12} style={{ height:"100%", width:"100%" }} whenReady={() => setMapVisible(true)}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                <FlyTo coords={flyTo} />
                {filtered.map(loc => (
                  <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={makeKuponIcon(selectedId === loc.id)}
                    eventHandlers={{ click: () => setSelectedId(loc.id) }}>
                    <Popup className="pk-popup-wrap">
                      <div>
                        {loc.photoUrl && isValidPhotoUrl(loc.photoUrl) && (
                          <div
                            className="pk-popup-photo-wrap"
                            onClick={() => setLightboxPhoto({ src: loc.photoUrl!, title: loc.name })}
                            title="Klik untuk lihat foto full screen"
                          >
                            <img
                              src={loc.photoUrl}
                              alt={loc.name}
                              className="pk-popup-photo"
                              onError={(e) => { (e.currentTarget as HTMLElement).parentElement!.style.display = "none"; }}
                            />
                            <div className="pk-popup-photo-badge">🔍 Full Screen</div>
                          </div>
                        )}
                        <div className="pk-popup-title">🎟️ {loc.name}</div>
                        <div className="pk-popup-row">📍 {loc.address}</div>
                        <div className="pk-popup-row">👤 {loc.picName}</div>
                        <div className="pk-popup-row">📱 <a href={`https://wa.me/${formatWa(loc.whatsapp)}`} target="_blank" rel="noreferrer" className="pk-popup-wa">{loc.whatsapp}</a></div>
                        <div className="pk-popup-actions">
                          <button className="pk-popup-btn pk-popup-btn-detail" onClick={() => setDetailLoc(loc)}>Detail</button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="pk-popup-btn pk-popup-btn-gmaps"
                            title="Buka rute di Google Maps"
                          >
                            📍 Maps
                          </a>
                          <a href={`https://wa.me/${formatWa(loc.whatsapp)}`} target="_blank" rel="noreferrer" className="pk-popup-btn pk-popup-btn-wa">💬 Chat</a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>

        {/* OUTLET LIST */}
        <div className="pk-list-wrap">
          <div className="pk-list-hdr">
            <span className="pk-list-title">📍 Lokasi Penjualan</span>
            <span className="pk-list-badge">{filtered.length} lokasi</span>
          </div>
          {filtered.length === 0 ? (
            <div className="pk-empty">🎟️ {search ? "Tidak ada lokasi yang cocok." : "Belum ada lokasi tersedia."}</div>
          ) : (
            <div>
              {filtered.map(loc => (
                <div key={loc.id} className={`pk-card${selectedId === loc.id ? " selected" : ""}`} onClick={() => handleSelectLoc(loc)}>
                  <div>
                    {loc.photoUrl && isValidPhotoUrl(loc.photoUrl)
                      ? (
                        <img
                          src={loc.photoUrl}
                          alt={loc.name}
                          className="pk-card-thumb"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxPhoto({ src: loc.photoUrl!, title: loc.name });
                          }}
                          title="Klik untuk foto full screen"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                        />
                      )
                      : <div className="pk-card-thumb-ph">🎟️</div>
                    }
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-card-name">{loc.name}</div>
                    <div className="pk-card-addr">📍 {loc.address}</div>
                    <div className="pk-card-pic">👤 {loc.picName}</div>
                    {userPos && (
                      <div className="pk-card-dist">{haversine(userPos.lat, userPos.lng, loc.latitude, loc.longitude).toFixed(1)} km</div>
                    )}
                  </div>
                  <div className="pk-card-btns">
                    <button className="pk-card-btn" onClick={e => { e.stopPropagation(); setDetailLoc(loc); }}>Detail</button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="pk-card-btn pk-card-btn-gmaps"
                      onClick={e => e.stopPropagation()}
                      title="Buka rute di Google Maps"
                    >
                      📍 Maps
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL */}
      {detailLoc && (
        <div className="pk-detail-backdrop" onClick={() => setDetailLoc(null)}>
          <div className="pk-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="pk-detail-close" onClick={() => setDetailLoc(null)} aria-label="Tutup detail">✕</button>
            <div className="pk-detail-scroll">
              {detailLoc.photoUrl && isValidPhotoUrl(detailLoc.photoUrl) && (
                <div
                  className="pk-detail-photo-wrap"
                  onClick={() => setLightboxPhoto({ src: detailLoc.photoUrl!, title: detailLoc.name })}
                  title="Klik untuk melihat foto full screen (layar penuh)"
                >
                  <img
                    src={detailLoc.photoUrl}
                    alt={detailLoc.name}
                    className="pk-detail-photo"
                    onError={(e) => { (e.currentTarget as HTMLElement).parentElement!.style.display = "none"; }}
                  />
                  <div className="pk-photo-badge">
                    <span>🔍</span> Klik untuk Layar Penuh
                  </div>
                </div>
              )}
              <h2 className="pk-detail-title">🎟️ {detailLoc.name}</h2>
              <div className="pk-detail-info">
                <div className="pk-detail-row"><span>📍</span><span>{detailLoc.address}</span></div>
                {detailLoc.description && <div className="pk-detail-row"><span>ℹ️</span><span>{detailLoc.description}</span></div>}
                <div className="pk-detail-row"><span>👤</span><span>{detailLoc.picName}</span></div>
                <div className="pk-detail-row"><span>📱</span>
                  <a href={`https://wa.me/${formatWa(detailLoc.whatsapp)}`} target="_blank" rel="noreferrer" className="pk-detail-wa">{detailLoc.whatsapp}</a>
                </div>
                <div className="pk-detail-row"><span>📌</span><span style={{ fontFamily:"monospace", fontSize:"0.8rem" }}>{detailLoc.latitude}, {detailLoc.longitude}</span></div>
              </div>
              <div className="pk-detail-actions">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${detailLoc.latitude},${detailLoc.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="pk-btn pk-btn-gmaps"
                >
                  <span style={{ fontSize: "1.1rem" }}>📍</span> Buka di Google Maps
                </a>
                <a href={`https://wa.me/${formatWa(detailLoc.whatsapp)}`} target="_blank" rel="noreferrer" className="pk-btn pk-btn-wa">
                  <span>💬</span> Hubungi Penjual via WhatsApp
                </a>
                <button className="pk-btn pk-btn-map" onClick={() => { handleSelectLoc(detailLoc); setDetailLoc(null); }}>
                  <span>🗺️</span> Tampilkan di Peta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX 100% FULLSCREEN */}
      {lightboxPhoto && (
        <Lightbox
          src={lightboxPhoto.src}
          title={lightboxPhoto.title}
          onClose={() => setLightboxPhoto(null)}
        />
      )}

      {/* FOOTER */}
      <footer className="pk-footer">© {new Date().getFullYear()} MB Chondro Dimuko · Jalan Sehat</footer>
    </div>
  );
}
