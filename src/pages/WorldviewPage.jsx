/**
 * WorldviewPage.jsx  —  Vulture Vision × NASA Worldview
 *
 * Drop-in page for Lovable.ai / Vite + React projects.
 *
 * Features
 *   • Leaflet map with GIBS WMTS tile layer
 *   • Layer switcher (fire, flood, AQI, true-colour, geostationary)
 *   • Date picker synced to temporal layers
 *   • Bounding-box AOI draw → export config for Python back-end
 *   • "Open in Worldview" deep-link button
 *   • Real-time layer badge (GOES, <3 h latency)
 *
 * Install deps (Lovable terminal):
 *   npm install leaflet react-leaflet date-fns
 *
 * Import in your router:
 *   import WorldviewPage from "@/pages/WorldviewPage";
 *   <Route path="/worldview" element={<WorldviewPage />} />
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  Rectangle,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import { format, subDays } from "date-fns";
import "leaflet/dist/leaflet.css";

// ---------------------------------------------------------------------------
// GIBS layer definitions — mirrors python/nasa_worldview.py
// ---------------------------------------------------------------------------
const GIBS_BASE =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/GoogleMapsCompatible_Level{maxZoom}/{z}/{y}/{x}.jpg";

const LAYERS = [
  {
    id: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    label: "True Color (VIIRS)",
    tag: "base",
    maxZoom: 8,
    format: "jpg",
    realtime: false,
  },
  {
    id: "VIIRS_SNPP_Fires_375m_Day",
    label: "🔥 Active Fires (Day)",
    tag: "fire",
    maxZoom: 8,
    format: "png",
    realtime: false,
  },
  {
    id: "VIIRS_SNPP_Fires_375m_Night",
    label: "🔥 Active Fires (Night)",
    tag: "fire",
    maxZoom: 8,
    format: "png",
    realtime: false,
  },
  {
    id: "VIIRS_SNPP_Flood_2Day",
    label: "🌊 Flood Extent (2-day)",
    tag: "flood",
    maxZoom: 8,
    format: "png",
    realtime: false,
  },
  {
    id: "VIIRS_SNPP_Aerosol_Optical_Depth",
    label: "💨 Aerosol / AQI",
    tag: "aqi",
    maxZoom: 6,
    format: "png",
    realtime: false,
  },
  {
    id: "MODIS_Terra_Land_Surface_Temp_Day",
    label: "🌡 Land Temp (Day)",
    tag: "thermal",
    maxZoom: 7,
    format: "png",
    realtime: false,
  },
  {
    id: "GOES-East_ABI_Band2_Red_Visible_1km",
    label: "📡 GOES-East Visible (NRT)",
    tag: "realtime",
    maxZoom: 7,
    format: "jpg",
    realtime: true,
  },
  {
    id: "GOES-West_ABI_Band2_Red_Visible_1km",
    label: "📡 GOES-West Visible (NRT)",
    tag: "realtime",
    maxZoom: 7,
    format: "jpg",
    realtime: true,
  },
  {
    id: "MODIS_Terra_Snow_Cover_Daily",
    label: "❄️ Snow Cover",
    tag: "terrain",
    maxZoom: 7,
    format: "png",
    realtime: false,
  },
];

const TAG_COLORS = {
  base: "#3b82f6",
  fire: "#ef4444",
  flood: "#06b6d4",
  aqi: "#a855f7",
  thermal: "#f97316",
  realtime: "#22c55e",
  terrain: "#84cc16",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildTileUrl(layerId, date, maxZoom) {
  return GIBS_BASE.replace("{layer}", layerId)
    .replace(/{date}/g, date)
    .replace(/{maxZoom}/g, maxZoom);
}

function buildWorldviewUrl(layerIds, bbox, date) {
  const layers = layerIds.join(",");
  const bboxStr = bbox
    ? `${bbox[1][1]},${bbox[0][0]},${bbox[0][1]},${bbox[1][0]}`
    : "-180,-90,180,90";
  return `https://worldview.earthdata.nasa.gov/?l=${layers}&t=${date}&v=${bboxStr}`;
}

// ---------------------------------------------------------------------------
// AOI rectangle draw hook
// ---------------------------------------------------------------------------
function AOIDrawer({ drawing, onBBoxChange }) {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);

  useMapEvents({
    mousedown(e) {
      if (!drawing) return;
      setStart(e.latlng);
      setEnd(e.latlng);
    },
    mousemove(e) {
      if (!drawing || !start) return;
      setEnd(e.latlng);
    },
    mouseup(e) {
      if (!drawing || !start) return;
      const bbox = [
        [Math.min(start.lat, e.latlng.lat), Math.min(start.lng, e.latlng.lng)],
        [Math.max(start.lat, e.latlng.lat), Math.max(start.lng, e.latlng.lng)],
      ];
      onBBoxChange(bbox);
      setStart(null);
      setEnd(null);
    },
  });

  if (!start || !end) return null;
  return (
    <Rectangle
      bounds={[start, end]}
      pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.1 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function WorldviewPage() {
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(yesterday);
  const [activeBaseId, setActiveBaseId] = useState(LAYERS[0].id);
  const [overlayIds, setOverlayIds] = useState([LAYERS[1].id]); // fires on by default
  const [aoi, setAoi] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [exportJson, setExportJson] = useState(null);
  const [showExport, setShowExport] = useState(false);

  const baseLayer = LAYERS.find((l) => l.id === activeBaseId) || LAYERS[0];

  // Build export config (mirrors worldview_embed_config() in Python)
  useEffect(() => {
    if (!aoi) return;
    const [[minLat, minLon], [maxLat, maxLon]] = aoi;
    const allLayers = [activeBaseId, ...overlayIds];
    const config = {
      layers: allLayers,
      date: selectedDate,
      zoom: 7,
      lat: +((minLat + maxLat) / 2).toFixed(5),
      lon: +((minLon + maxLon) / 2).toFixed(5),
      bbox: { minLon, minLat, maxLon, maxLat },
      worldviewUrl: buildWorldviewUrl(allLayers, aoi, selectedDate),
    };
    setExportJson(JSON.stringify(config, null, 2));
  }, [aoi, activeBaseId, overlayIds, selectedDate]);

  const toggleOverlay = (id) => {
    setOverlayIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const realtimeLayers = overlayIds
    .map((id) => LAYERS.find((l) => l.id === id))
    .filter(Boolean)
    .filter((l) => l.realtime);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0a0f1a",
        color: "#e2e8f0",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 20px",
          background: "#0d1424",
          borderBottom: "1px solid #1e3a5f",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🦅</span>
          <span
            style={{
              fontWeight: 700,
              letterSpacing: 3,
              color: "#38bdf8",
              fontSize: 13,
              textTransform: "uppercase",
            }}
          >
            Vulture Vision
          </span>
          <span
            style={{
              color: "#475569",
              fontSize: 11,
              marginLeft: 4,
              letterSpacing: 2,
            }}
          >
            × NASA WORLDVIEW
          </span>
        </div>

        {realtimeLayers.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#064e3b",
              border: "1px solid #059669",
              borderRadius: 4,
              padding: "3px 10px",
              fontSize: 11,
              color: "#6ee7b7",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
                display: "inline-block",
                animation: "pulse 1.5s infinite",
              }}
            />
            LIVE · &lt;3 h latency
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {/* Date picker */}
          <label
            style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}
          >
            DATE
            <input
              type="date"
              value={selectedDate}
              max={yesterday}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#e2e8f0",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            />
          </label>

          {/* Draw AOI */}
          <button
            onClick={() => setDrawing((v) => !v)}
            style={{
              background: drawing ? "#f59e0b" : "#1e293b",
              color: drawing ? "#000" : "#94a3b8",
              border: `1px solid ${drawing ? "#f59e0b" : "#334155"}`,
              borderRadius: 4,
              padding: "4px 12px",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: 1,
            }}
          >
            {drawing ? "✏ DRAWING AOI…" : "✏ DRAW AOI"}
          </button>

          {/* Export config */}
          {exportJson && (
            <button
              onClick={() => setShowExport((v) => !v)}
              style={{
                background: "#1e3a5f",
                color: "#38bdf8",
                border: "1px solid #1e4976",
                borderRadius: 4,
                padding: "4px 12px",
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              {"{ } EXPORT CONFIG"}
            </button>
          )}

          {/* Open in Worldview */}
          <a
            href={buildWorldviewUrl([activeBaseId, ...overlayIds], aoi, selectedDate)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#172554",
              color: "#93c5fd",
              border: "1px solid #1d4ed8",
              borderRadius: 4,
              padding: "4px 12px",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: 1,
              textDecoration: "none",
            }}
          >
            ↗ OPEN IN WORLDVIEW
          </a>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 230,
            background: "#0d1424",
            borderRight: "1px solid #1e3a5f",
            overflowY: "auto",
            padding: "12px 0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "0 14px 8px",
              fontSize: 9,
              letterSpacing: 3,
              color: "#475569",
              textTransform: "uppercase",
            }}
          >
            Base Layer
          </div>
          {LAYERS.filter((l) => l.tag === "base").map((l) => (
            <LayerRow
              key={l.id}
              layer={l}
              selected={activeBaseId === l.id}
              onClick={() => setActiveBaseId(l.id)}
            />
          ))}

          <div
            style={{
              padding: "16px 14px 8px",
              fontSize: 9,
              letterSpacing: 3,
              color: "#475569",
              textTransform: "uppercase",
            }}
          >
            Overlays
          </div>
          {LAYERS.filter((l) => l.tag !== "base").map((l) => (
            <LayerRow
              key={l.id}
              layer={l}
              selected={overlayIds.includes(l.id)}
              checkbox
              onClick={() => toggleOverlay(l.id)}
            />
          ))}

          {/* AOI info */}
          {aoi && (
            <div
              style={{
                margin: "16px 14px 0",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: 10,
                fontSize: 10,
                color: "#94a3b8",
                lineHeight: 1.7,
              }}
            >
              <div style={{ color: "#f59e0b", fontWeight: 700, marginBottom: 4 }}>
                AOI SELECTED
              </div>
              <div>N {aoi[1][0].toFixed(3)}°</div>
              <div>S {aoi[0][0].toFixed(3)}°</div>
              <div>E {aoi[1][1].toFixed(3)}°</div>
              <div>W {aoi[0][1].toFixed(3)}°</div>
              <button
                onClick={() => setAoi(null)}
                style={{
                  marginTop: 8,
                  background: "transparent",
                  border: "1px solid #475569",
                  color: "#64748b",
                  borderRadius: 3,
                  padding: "2px 8px",
                  fontSize: 9,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                CLEAR AOI
              </button>
            </div>
          )}
        </aside>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer
            center={[20, 0]}
            zoom={3}
            style={{ width: "100%", height: "100%", background: "#0a0f1a" }}
            zoomControl={false}
          >
            <ZoomControl position="bottomright" />

            {/* Base layer */}
            <TileLayer
              key={`${activeBaseId}_${selectedDate}`}
              url={buildTileUrl(baseLayer.id, selectedDate, baseLayer.maxZoom)}
              attribution="NASA GIBS / Worldview"
              tileSize={256}
              maxZoom={baseLayer.maxZoom}
              opacity={1}
            />

            {/* Overlay layers */}
            {overlayIds.map((id) => {
              const l = LAYERS.find((x) => x.id === id);
              if (!l) return null;
              return (
                <TileLayer
                  key={`${id}_${selectedDate}`}
                  url={buildTileUrl(l.id, selectedDate, l.maxZoom)}
                  tileSize={256}
                  maxZoom={l.maxZoom}
                  opacity={0.8}
                />
              );
            })}

            {/* AOI rectangle */}
            {aoi && (
              <Rectangle
                bounds={aoi}
                pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.1 }}
              />
            )}

            {/* Draw hook */}
            <AOIDrawer drawing={drawing} onBBoxChange={(bb) => { setAoi(bb); setDrawing(false); }} />
          </MapContainer>

          {/* Crosshair cursor when drawing */}
          {drawing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                cursor: "crosshair",
                pointerEvents: "none",
                zIndex: 1000,
              }}
            />
          )}
        </div>
      </div>

      {/* ── Export JSON panel ──────────────────────────────────── */}
      {showExport && exportJson && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowExport(false)}
        >
          <div
            style={{
              background: "#0d1424",
              border: "1px solid #1e4976",
              borderRadius: 8,
              padding: 24,
              maxWidth: 560,
              width: "90%",
              boxShadow: "0 0 40px rgba(56,189,248,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, letterSpacing: 2, color: "#38bdf8" }}>
                EMBED CONFIG  —  pass to Python / React
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(exportJson)}
                style={{
                  background: "#1e3a5f",
                  color: "#93c5fd",
                  border: "1px solid #1d4ed8",
                  borderRadius: 4,
                  padding: "3px 10px",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                COPY
              </button>
            </div>
            <pre
              style={{
                background: "#060d1a",
                padding: 16,
                borderRadius: 6,
                fontSize: 11,
                color: "#7dd3fc",
                overflowX: "auto",
                margin: 0,
                border: "1px solid #0c2544",
              }}
            >
              {exportJson}
            </pre>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .leaflet-container { background: #0a0f1a !important; }
        .leaflet-control-zoom a {
          background: #0d1424 !important;
          color: #38bdf8 !important;
          border-color: #1e3a5f !important;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer row sub-component
// ---------------------------------------------------------------------------
function LayerRow({ layer, selected, checkbox, onClick }) {
  const tagColor = TAG_COLORS[layer.tag] || "#94a3b8";
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 14px",
        cursor: "pointer",
        background: selected ? "rgba(56,189,248,0.07)" : "transparent",
        borderLeft: selected ? `2px solid ${tagColor}` : "2px solid transparent",
        transition: "all 0.15s",
      }}
    >
      {checkbox ? (
        <span
          style={{
            width: 13,
            height: 13,
            borderRadius: 3,
            border: `1.5px solid ${selected ? tagColor : "#334155"}`,
            background: selected ? tagColor : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            flexShrink: 0,
          }}
        >
          {selected && "✓"}
        </span>
      ) : (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: selected ? tagColor : "#1e293b",
            border: `1.5px solid ${selected ? tagColor : "#334155"}`,
            flexShrink: 0,
          }}
        />
      )}
      <div>
        <div style={{ fontSize: 11, color: selected ? "#e2e8f0" : "#94a3b8", lineHeight: 1.3 }}>
          {layer.label}
        </div>
        {layer.realtime && (
          <div style={{ fontSize: 9, color: "#22c55e", letterSpacing: 1 }}>NRT · 10 MIN</div>
        )}
      </div>
    </div>
  );
}
