// Taiwan Weather GIS — Leaflet frontend. All weather values come from /api/* (SQLite).
"use strict";

// ---------------------------------------------------------------- preferences
const PREF_KEY = "twgis.prefs.v1";
const DEFAULT_PREFS = {
  lang: "zh-TW", layer: "temp", base: "street", rainPeriod: "rain_24hr",
  ov: { stations: false, counties: true, labels: false },
};

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    const p = { ...DEFAULT_PREFS, ...saved, ov: { ...DEFAULT_PREFS.ov, ...(saved.ov || {}) } };
    if (!STRINGS[p.lang]) p.lang = guessLang();
    return p;
  } catch {
    return { ...DEFAULT_PREFS, lang: guessLang() };
  }
}
function guessLang() {
  const n = (navigator.language || "zh-TW").toLowerCase();
  if (n.startsWith("ja")) return "ja";
  if (n.startsWith("ko")) return "ko";
  if (n.startsWith("zh")) return "zh-TW";
  return "en";
}
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

const state = loadPrefs();
state.county = "";
const t = (k) => STRINGS[state.lang][k] ?? STRINGS["zh-TW"][k] ?? k;

// ---------------------------------------------------------------- definitions
const LAYERS = [
  { id: "temp", ico: "🌡️" }, { id: "rain", ico: "🌧️" }, { id: "radar", ico: "🛰️" },
  { id: "typhoon", ico: "🌀" }, { id: "wind", ico: "💨" }, { id: "humidity", ico: "💧" },
  { id: "weather", ico: "⛅" },
];
const OBS_LAYERS = new Set(["temp", "wind", "humidity", "weather"]);

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const ESRI_ATTR = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
// Each basemap is one or more tile layers (base + optional label reference layer).
const BASEMAPS = {
  street: [{
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    opts: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  }],
  light: [
    { url: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, opts: { maxZoom: 16, attribution: ESRI_ATTR } },
    { url: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, opts: { maxZoom: 16 } },
  ],
  dark: [
    { url: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, opts: { maxZoom: 16, attribution: ESRI_ATTR } },
    { url: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, opts: { maxZoom: 16 } },
  ],
};

const TAIWAN_BOUNDS = [[21.85, 118.2], [26.4, 122.1]];
const RAIN_PERIODS = ["rain_now", "rain_10min", "rain_1hr", "rain_3hr", "rain_24hr"];

// ---------------------------------------------------------------- colour scales
const TEMP_STOPS = [[-5, "#5e3c99"], [0, "#3b4cc0"], [8, "#2c7bb6"], [14, "#00a6ca"], [18, "#00ccbc"],
  [22, "#90eb9d"], [25, "#ffff8c"], [28, "#f9d057"], [31, "#f29e2e"], [34, "#e76818"], [37, "#d7191c"], [40, "#8b0000"]];
const HUM_STOPS = [[20, "#a6611a"], [40, "#dfc27d"], [60, "#c7e9b4"], [75, "#41b6c4"], [90, "#225ea8"], [100, "#0c2c84"]];
// CWA rainfall palette (mm, lower bounds).
const RAIN_STEPS = [[1, "#9bffff"], [2, "#00cfff"], [6, "#0198ff"], [10, "#0165ff"], [15, "#309901"], [20, "#32ff00"],
  [30, "#f8ff00"], [40, "#ffcb00"], [50, "#ff9a00"], [70, "#fa0300"], [90, "#cc0003"], [110, "#a00000"],
  [130, "#98009a"], [150, "#c304cc"], [200, "#f805f3"], [300, "#fecbff"]];
const BFT_COLORS = ["#cfd8dc", "#b3e5fc", "#81d4fa", "#4fc3f7", "#26a69a", "#66bb6a", "#d4e157",
  "#ffca28", "#ffa726", "#ff7043", "#e53935", "#ad1457", "#6a1b9a"];
const BFT_LIMITS = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
const DBZ_STOPS = [[0, "#00ffff"], [5, "#00a3ff"], [10, "#005bff"], [15, "#0000ff"], [20, "#00ff00"], [25, "#00c800"],
  [30, "#009600"], [35, "#ffff00"], [40, "#ffc800"], [45, "#ff9600"], [50, "#ff0000"], [55, "#c80000"],
  [60, "#960000"], [65, "#ff00ff"]];

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function lerpColor(stops, v) {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [v1, c1] = stops[i];
    if (v <= v1) {
      const [v0, c0] = stops[i - 1];
      const f = (v - v0) / (v1 - v0);
      const a = hexToRgb(c0), b = hexToRgb(c1);
      return `rgb(${a.map((x, j) => Math.round(x + (b[j] - x) * f)).join(",")})`;
    }
  }
  return stops[stops.length - 1][1];
}
const tempColor = (v) => lerpColor(TEMP_STOPS, v);
const humColor = (v) => lerpColor(HUM_STOPS, v);
function rainColor(v) {
  let c = null;
  for (const [min, col] of RAIN_STEPS) if (v >= min) c = col;
  return c;
}
function beaufort(ms) {
  if (ms == null) return null;
  const i = BFT_LIMITS.findIndex((lim) => ms < lim);
  return i === -1 ? 12 : i;
}

// ---------------------------------------------------------------- formatting
const fmt1 = (v) => (v == null ? "—" : Number(v).toFixed(1));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function fmtTime(iso, withDate = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  const opts = { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" };
  if (withDate) Object.assign(opts, { month: "numeric", day: "numeric" });
  return new Intl.DateTimeFormat(state.lang, opts).format(d);
}
function isNight(iso) {
  const h = Number((iso || "").slice(11, 13));
  return h >= 18 || h < 6;
}
function wxEmoji(text, iso) {
  if (!text) return "❔";
  if (text.includes("雷")) return "⛈️";
  if (text.includes("雪")) return "🌨️";
  if (text.includes("雨")) return "🌧️";
  if (text.includes("霧")) return "🌫️";
  if (text.startsWith("陰")) return "☁️";
  if (text.startsWith("多雲")) return isNight(iso) ? "☁️" : "⛅";
  if (text.startsWith("晴")) return isNight(iso) ? "🌙" : "☀️";
  return "🌡️";
}
function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------------------------------------------------------------- data
const data = { obs: null, rain: null, typhoons: null, radar: null, counties: null, meta: null };

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
async function loadData() {
  const [obs, rain, typhoons, radar, meta] = await Promise.all([
    getJSON("/api/observations"), getJSON("/api/rain"), getJSON("/api/typhoons"),
    getJSON("/api/radar"), getJSON("/api/meta"),
  ]);
  Object.assign(data, { obs, rain, typhoons, radar, meta });
  if (!data.counties) data.counties = await getJSON("/static/data/taiwan_counties.geojson");
}

// ---------------------------------------------------------------- map
const map = L.map("map", { preferCanvas: true, zoomControl: false, minZoom: 4 });
L.control.zoom({ position: "topright" }).addTo(map);
L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
map.fitBounds(TAIWAN_BOUNDS);
map.attributionControl.addAttribution('Weather &copy; <a href="https://opendata.cwa.gov.tw/">CWA</a>');

const canvas = L.canvas({ padding: 0.5 });
let baseLayer = null;
const dataLayer = L.layerGroup().addTo(map);
const stationDots = L.layerGroup();
const labelLayer = L.layerGroup();
let countyLayer = null;
let meLayer = null;
let markerIndex = new Map(); // station_id → marker for the active layer
let radarState = { index: 0, timer: null, overlay: null };

// Spotlight for the selected county: dims everything outside it and outlines it.
// Its own SVG pane sits above the canvas markers (overlayPane) but below DOM markers.
map.createPane("countyFocus");
map.getPane("countyFocus").style.zIndex = 450;
map.getPane("countyFocus").style.pointerEvents = "none";
const focusRenderer = L.svg({ pane: "countyFocus", padding: 1 });
let focusLayer = null;

const legend = L.control({ position: "bottomright" });
legend.onAdd = () => L.DomUtil.create("div", "legend");
legend.addTo(map);

function setBase(id) {
  state.base = id;
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = L.layerGroup(BASEMAPS[id].map((b) => L.tileLayer(b.url, b.opts))).addTo(map);
  document.documentElement.dataset.theme = id === "dark" ? "dark" : "light";
  renderBaseList();
  if (countyLayer) countyLayer.setStyle(countyStyle);
  renderCountyFocus(false);
  savePrefs();
}

// ---------------------------------------------------------------- popups
function row(k, v) { return `<tr><td>${esc(k)}</td><td>${v}</td></tr>`; }

function obsPopup(s) {
  const wx = weatherText(s.weather, state.lang);
  const bft = beaufort(s.wind_speed);
  const dir = compass(s.wind_direction, state.lang);
  const wind = s.wind_speed == null ? t("no_data")
    : `${dir ? esc(dir) + " " : ""}${fmt1(s.wind_speed)} ${t("ms")} (${bft} ${t("beaufort")})`;
  return `<div class="pop">
    <h4>${esc(s.station_name)}</h4>
    <div class="where">${esc(countyName(s.county, state.lang))} · ${esc(s.town || "")}${s.altitude != null ? ` · ${t("altitude")} ${Math.round(s.altitude)} m` : ""}</div>
    <div class="hero"><span class="emo">${wxEmoji(s.weather, s.obs_time)}</span>
      <div><div class="big">${s.temperature == null ? "—" : fmt1(s.temperature) + "°C"}</div><div>${esc(wx || t("no_data"))}</div></div></div>
    <table>
      ${row(t("min_t") + " / " + t("max_t"), `${fmt1(s.min_t)} / ${fmt1(s.max_t)} °C`)}
      ${row(t("humidity"), s.humidity == null ? "—" : Math.round(s.humidity) + " %")}
      ${row(t("wind"), wind)}
      ${row(t("pressure"), s.pressure == null ? "—" : fmt1(s.pressure) + " hPa")}
      ${row(t("precip"), s.precipitation == null ? "—" : fmt1(s.precipitation) + " mm")}
      ${row(t("uv"), s.uv_index == null ? "—" : fmt1(s.uv_index))}
    </table>
    <div class="time">${t("obs_time")} ${fmtTime(s.obs_time)} · O-A0003-001 · ${esc(s.station_id)}</div>
  </div>`;
}

function rainPopup(s) {
  const v = s[state.rainPeriod];
  return `<div class="pop">
    <h4>${esc(s.station_name)}</h4>
    <div class="where">${esc(countyName(s.county, state.lang))} · ${esc(s.town || "")}</div>
    <div class="hero"><span class="emo">${v > 0 ? "🌧️" : "🌂"}</span>
      <div><div class="big">${v == null ? "—" : fmt1(v) + " mm"}</div><div>${t(state.rainPeriod)}</div></div></div>
    <table>${RAIN_PERIODS.map((p) => row(t(p), s[p] == null ? "—" : fmt1(s[p]) + " mm")).join("")}</table>
    <div class="time">${t("obs_time")} ${fmtTime(s.obs_time)} · O-A0002-001 · ${esc(s.station_id)}</div>
  </div>`;
}

// ---------------------------------------------------------------- layer renderers
function obsMarker(s, color, radius = 7) {
  const has = color != null;
  return L.circleMarker([s.lat, s.lon], {
    renderer: canvas, radius,
    color: state.base === "dark" ? "#0b0e13" : "#ffffff", weight: 1.2,
    fillColor: has ? color : "#9aa3af", fillOpacity: has ? 0.92 : 0.35,
  }).bindPopup(() => obsPopup(s), { maxWidth: 300 });
}

function renderObsLayer(valueOf, colorOf) {
  const list = [...data.obs.stations].sort((a, b) => (valueOf(a) ?? -1e9) - (valueOf(b) ?? -1e9));
  for (const s of list) {
    const v = valueOf(s);
    const m = obsMarker(s, v == null ? null : colorOf(v)).addTo(dataLayer);
    markerIndex.set(s.station_id, m);
  }
}

function renderRain() {
  const p = state.rainPeriod;
  const list = [...data.rain.stations].sort((a, b) => (a[p] ?? -1) - (b[p] ?? -1));
  for (const s of list) {
    const v = s[p];
    const wet = v != null && v >= 0.5;
    const m = L.circleMarker([s.lat, s.lon], {
      renderer: canvas,
      radius: wet ? 5 + Math.min(6, Math.sqrt(v) / 2) : 2.5,
      color: state.base === "dark" ? "#0b0e13" : "#ffffff", weight: wet ? 1 : 0,
      fillColor: wet ? (rainColor(v) || "#9bffff") : "#8a94a6",
      fillOpacity: wet ? 0.95 : (v == null ? 0.2 : 0.45),
    }).bindPopup(() => rainPopup(s), { maxWidth: 300 }).addTo(dataLayer);
    markerIndex.set(s.station_id, m);
  }
}

function windIcon(s) {
  const bft = beaufort(s.wind_speed);
  const color = BFT_COLORS[bft];
  if (s.wind_speed < 0.3 || s.wind_direction == null) {
    return L.divIcon({ className: "wind-icon", iconSize: [10, 10],
      html: `<svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="${color}" stroke-width="2"/></svg>` });
  }
  const len = 14 + Math.min(12, bft * 1.6);
  // CWA direction is where the wind comes FROM; the arrow points downwind.
  const rot = (s.wind_direction + 180) % 360;
  return L.divIcon({
    className: "wind-icon", iconSize: [len, len], iconAnchor: [len / 2, len / 2],
    html: `<svg width="${len}" height="${len}" viewBox="-12 -12 24 24" style="transform:rotate(${rot}deg)">
      <path d="M0,-11 L6,-2 L2,-2 L2,11 L-2,11 L-2,-2 L-6,-2 Z" fill="${color}" stroke="#1c2330" stroke-width="1" stroke-linejoin="round"/></svg>`,
  });
}

function renderWind() {
  for (const s of data.obs.stations) {
    if (s.wind_speed == null) continue;
    const m = L.marker([s.lat, s.lon], { icon: windIcon(s), keyboard: false, opacity: inCounty(s) ? 1 : 0.3 })
      .bindPopup(() => obsPopup(s), { maxWidth: 300 }).addTo(dataLayer);
    markerIndex.set(s.station_id, m);
  }
}

function renderWeather() {
  for (const s of data.obs.stations) {
    const m = L.marker([s.lat, s.lon], {
      icon: L.divIcon({ className: "wx-icon", iconSize: [22, 22], html: wxEmoji(s.weather, s.obs_time) }),
      keyboard: false, opacity: inCounty(s) ? 1 : 0.3,
    }).bindPopup(() => obsPopup(s), { maxWidth: 300 }).addTo(dataLayer);
    markerIndex.set(s.station_id, m);
  }
}

function renderRadar() {
  const frames = data.radar.frames;
  if (!frames.length) return;
  radarState.index = Math.min(radarState.index, frames.length - 1);
  if (radarState.index < 0 || radarState.fresh) radarState.index = frames.length - 1;
  radarState.fresh = false;
  const f = frames[radarState.index];
  radarState.overlay = L.imageOverlay(f.image_url, [[f.lat_min, f.lon_min], [f.lat_max, f.lon_max]],
    { opacity: 0.85, interactive: false }).addTo(dataLayer);
}

function showRadarFrame(i) {
  const frames = data.radar.frames;
  radarState.index = i;
  const f = frames[i];
  if (radarState.overlay) radarState.overlay.setUrl(f.image_url);
  updateBadge();
  const lbl = document.getElementById("radarTime");
  if (lbl) lbl.textContent = fmtTime(f.obs_time);
  const sl = document.getElementById("radarSlider");
  if (sl) sl.value = i;
}

function typhoonTracks(storm) {
  const past = storm.points.filter((p) => p.kind === "analysis").sort((a, b) => a.time.localeCompare(b.time));
  const fc = storm.points.filter((p) => p.kind === "forecast").sort((a, b) => a.forecast_hour - b.forecast_hour);
  return { past, fc, now: past[past.length - 1] };
}
function validTime(p) {
  return new Date(new Date(p.time).getTime() + p.forecast_hour * 3600e3).toISOString();
}
function typhoonName(s) {
  return state.lang === "zh-TW" ? `${s.name_zh}（${s.name_en}）` : `${s.name_en}${state.lang === "ja" ? `（${s.name_zh}）` : ""}`;
}
function typhoonPointPopup(s, p) {
  const when = p.kind === "forecast" ? `${fmtTime(validTime(p))} (+${p.forecast_hour} ${t("ty_hours")})` : fmtTime(p.time);
  return `<div class="pop"><h4>🌀 ${esc(typhoonName(s))}</h4>
    <div class="where">${p.kind === "forecast" ? t("ty_forecast") : t("ty_past")} · ${when}</div>
    <table>
      ${row(t("ty_position"), `${fmt1(p.lat)}°N ${fmt1(p.lon)}°E`)}
      ${row(t("ty_max_wind"), p.max_wind == null ? "—" : `${p.max_wind} ${t("ms")} (${beaufort(p.max_wind)} ${t("beaufort")})`)}
      ${row(t("ty_gust"), p.max_gust == null ? "—" : `${p.max_gust} ${t("ms")}`)}
      ${row(t("ty_pressure"), p.pressure == null ? "—" : `${p.pressure} hPa`)}
      ${row(t("ty_moving"), p.moving_dir ? `${esc(compassAbbr(p.moving_dir, state.lang))} ${p.moving_speed ?? "—"} ${t("kmh")}` : "—")}
      ${p.r15 ? row(t("ty_r15"), `${p.r15} ${t("km")}`) : ""}
      ${p.r25 ? row(t("ty_r25"), `${p.r25} ${t("km")}`) : ""}
      ${p.r70 ? row(t("ty_r70"), `${p.r70} ${t("km")}`) : ""}
    </table><div class="time">W-C0034-005</div></div>`;
}

function renderTyphoon() {
  const storms = data.typhoons.typhoons;
  const bounds = L.latLngBounds(TAIWAN_BOUNDS);
  for (const s of storms) {
    const { past, fc, now } = typhoonTracks(s);
    if (!now) continue;
    const pastLL = past.map((p) => [p.lat, p.lon]);
    const fcLL = [[now.lat, now.lon], ...fc.map((p) => [p.lat, p.lon])];
    // 70% probability cone approximated by the forecast circles.
    for (const p of fc) {
      if (p.r70) L.circle([p.lat, p.lon], { radius: p.r70 * 1000, color: "#e76818", weight: 1, opacity: 0.5, fillOpacity: 0.07, dashArray: "3 4", interactive: false }).addTo(dataLayer);
    }
    if (now.r15) L.circle([now.lat, now.lon], { radius: now.r15 * 1000, color: "#f29e2e", weight: 1.5, fillColor: "#f9d057", fillOpacity: 0.18 }).bindPopup(() => typhoonPointPopup(s, now)).addTo(dataLayer);
    if (now.r25) L.circle([now.lat, now.lon], { radius: now.r25 * 1000, color: "#d7191c", weight: 1.5, fillColor: "#d7191c", fillOpacity: 0.18 }).bindPopup(() => typhoonPointPopup(s, now)).addTo(dataLayer);
    L.polyline(pastLL, { color: "#d7191c", weight: 3 }).addTo(dataLayer);
    L.polyline(fcLL, { color: "#e76818", weight: 3, dashArray: "8 6" }).addTo(dataLayer);
    for (const p of past) {
      L.circleMarker([p.lat, p.lon], { renderer: canvas, radius: 3.5, color: "#fff", weight: 1, fillColor: "#d7191c", fillOpacity: 1 })
        .bindPopup(() => typhoonPointPopup(s, p)).addTo(dataLayer);
    }
    for (const p of fc) {
      L.circleMarker([p.lat, p.lon], { renderer: canvas, radius: 4.5, color: "#e76818", weight: 2, fillColor: "#fff", fillOpacity: 1 })
        .bindPopup(() => typhoonPointPopup(s, p)).bindTooltip(`+${p.forecast_hour}h`, { direction: "right" }).addTo(dataLayer);
    }
    const center = L.marker([now.lat, now.lon], {
      icon: L.divIcon({ className: "", iconSize: [26, 26], html: '<div class="ty-center">🌀</div>' }),
    }).bindPopup(() => typhoonPointPopup(s, now)).bindTooltip(typhoonName(s), { direction: "top", offset: [0, -12] }).addTo(dataLayer);
    markerIndex.set(s.typhoon_key, center);
    pastLL.concat(fcLL).forEach((ll) => bounds.extend(ll));
  }
  return bounds;
}

function renderDataLayer({ fit = false } = {}) {
  dataLayer.clearLayers();
  markerIndex = new Map();
  stopRadar();
  if (!data.obs) return;
  switch (state.layer) {
    case "temp": renderObsLayer((s) => s.temperature, tempColor); break;
    case "humidity": renderObsLayer((s) => s.humidity, humColor); break;
    case "wind": renderWind(); break;
    case "weather": renderWeather(); break;
    case "rain": renderRain(); break;
    case "radar": renderRadar(); break;
    case "typhoon": {
      const b = renderTyphoon();
      if (fit && data.typhoons.count) map.fitBounds(b, { padding: [30, 30] });
      break;
    }
  }
  if (fit && state.layer !== "typhoon" && !state.county) map.fitBounds(TAIWAN_BOUNDS);
  renderLabels();
  renderLegend();
  renderPanel();
  updateBadge();
  if (countyLayer) countyLayer.setStyle(countyStyle);
}

// ---------------------------------------------------------------- overlays
const MAIN_STATION = (s) => s.station_id.startsWith("46");

function renderLabels() {
  labelLayer.clearLayers();
  if (!state.ov.labels || !data.obs) return;
  const dense = map.getZoom() >= 9;
  const view = map.getBounds().pad(0.1);
  for (const s of data.obs.stations) {
    if (s.temperature == null || (!dense && !MAIN_STATION(s))) continue;
    if (!view.contains([s.lat, s.lon])) continue;
    L.tooltip({ permanent: true, direction: "top", className: "temp-label", offset: [0, -6], interactive: false,
      opacity: inCounty(s) ? 0.9 : 0.3 })
      .setLatLng([s.lat, s.lon]).setContent(`${Math.round(s.temperature)}°`).addTo(labelLayer);
  }
}

function renderStationDots() {
  stationDots.clearLayers();
  if (!data.obs) return;
  for (const s of data.obs.stations) {
    L.circleMarker([s.lat, s.lon], { renderer: canvas, radius: 2.5, weight: 1, color: "#fff", fillColor: "#1c2330", fillOpacity: 0.9 })
      .bindTooltip(`${s.station_name} · ${countyName(s.county, state.lang)}`, { direction: "top" })
      .bindPopup(() => obsPopup(s), { maxWidth: 300 })
      .addTo(stationDots);
  }
}

// County averages of the active metric, for the GeoJSON fill.
function countyMetric() {
  const pick = {
    temp: [data.obs, (s) => s.temperature, tempColor, "°C"],
    humidity: [data.obs, (s) => s.humidity, humColor, "%"],
    wind: [data.obs, (s) => s.wind_speed, (v) => BFT_COLORS[beaufort(v)], t("ms")],
    rain: [data.rain, (s) => s[state.rainPeriod], (v) => rainColor(v), "mm"],
  }[state.layer];
  if (!pick || !pick[0]) return null;
  const [src, valueOf, colorOf, unit] = pick;
  const acc = {};
  for (const s of src.stations) {
    const v = valueOf(s);
    if (v == null) continue;
    (acc[s.county] ||= []).push(v);
  }
  const avg = {};
  for (const [c, vs] of Object.entries(acc)) avg[c] = vs.reduce((a, b) => a + b, 0) / vs.length;
  return { avg, colorOf, unit };
}
let metricCache = null;

function countyStyle(feature) {
  const dark = state.base === "dark";
  const name = feature.properties.name;
  const v = metricCache && metricCache.avg[name];
  const fill = v != null ? metricCache.colorOf(v) : null;
  return {
    color: dark ? "#9aa3af" : "#4b5563",
    weight: 1.2,
    opacity: 0.9,
    fillColor: fill || "transparent",
    fillOpacity: fill ? 0.16 : 0,
  };
}

function renderCountyFocus(animate = true) {
  if (focusLayer) { map.removeLayer(focusLayer); focusLayer = null; }
  const f = state.county && data.counties
    && data.counties.features.find((x) => x.properties.name === state.county);
  if (!f) return;
  const dark = state.base === "dark";
  const accent = dark ? "#4c8dff" : "#1f6feb";
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const world = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
  const holes = polys.map((p) => p[0].map(([lon, lat]) => [lat, lon]));
  const common = { renderer: focusRenderer, pane: "countyFocus", interactive: false };
  focusLayer = L.layerGroup([
    L.polygon([world, ...holes], {
      ...common, stroke: false, fillRule: "evenodd",
      fillColor: dark ? "#000000" : "#0f172a", fillOpacity: dark ? 0.55 : 0.38,
      className: animate ? "county-mask animate" : "county-mask",
    }),
    L.geoJSON(f, { ...common, style: { color: accent, weight: 12, opacity: 0.25, fill: false } }),
    L.geoJSON(f, {
      ...common, style: { color: accent, weight: 3.5, opacity: 1, fill: false },
      className: animate ? "county-hl animate" : "county-hl",
    }),
  ]).addTo(map);
}

function buildCountyLayer() {
  countyLayer = L.geoJSON(data.counties, {
    style: countyStyle,
    onEachFeature: (f, layer) => {
      layer.bindTooltip(() => {
        const v = metricCache && metricCache.avg[f.properties.name];
        const name = countyName(f.properties.name, state.lang);
        return v == null ? name : `${name} · ${t("county_avg")} ${fmt1(v)} ${metricCache.unit}`;
      }, { sticky: true });
      layer.on({
        mouseover: () => layer.setStyle({ weight: 3 }),
        mouseout: () => countyLayer.resetStyle(layer),
        click: () => setCounty(f.properties.name),
      });
    },
  });
}

function applyOverlays() {
  metricCache = countyMetric();
  if (countyLayer) {
    countyLayer.setStyle(countyStyle);
    if (state.ov.counties) countyLayer.addTo(map); else map.removeLayer(countyLayer);
    if (state.ov.counties) countyLayer.bringToBack();
  }
  if (state.ov.stations) stationDots.addTo(map); else map.removeLayer(stationDots);
  if (state.ov.labels) labelLayer.addTo(map); else map.removeLayer(labelLayer);
  renderLabels();
}

map.on("zoomend moveend", () => { if (state.ov.labels) renderLabels(); });

// ---------------------------------------------------------------- legend
function gradientLegend(title, stops, ticks) {
  const lo = stops[0][0], hi = stops[stops.length - 1][0];
  const cells = Array.from({ length: 40 }, (_, i) => `<span style="background:${lerpColor(stops, lo + (hi - lo) * i / 39)}"></span>`).join("");
  return `<div class="t">${title}</div><div class="bar">${cells}</div><div class="ticks">${ticks.map((x) => `<span>${x}</span>`).join("")}</div>`;
}
function renderLegend() {
  const el = legend.getContainer();
  let html = "";
  switch (state.layer) {
    case "temp": html = gradientLegend(t("legend_temp"), TEMP_STOPS, [-5, 5, 15, 25, 35, 40]); break;
    case "humidity": html = gradientLegend(t("legend_humidity"), HUM_STOPS, [20, 40, 60, 80, 100]); break;
    case "radar": html = gradientLegend(t("legend_radar"), DBZ_STOPS, [0, 15, 30, 45, 65]); break;
    case "rain":
      html = `<div class="t">${t("legend_rain")} · ${t(state.rainPeriod)}</div><div class="bar">${RAIN_STEPS.map(([, c]) => `<span style="background:${c}"></span>`).join("")}</div>
        <div class="ticks"><span>1</span><span>10</span><span>30</span><span>70</span><span>150</span><span>300</span></div>`;
      break;
    case "wind":
      html = `<div class="t">${t("legend_wind")}</div><div class="bar">${BFT_COLORS.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
        <div class="ticks"><span>0</span><span>3</span><span>6</span><span>9</span><span>12</span></div>`;
      break;
    case "weather":
      html = `<div class="t">${t("layer_weather")}</div><div class="list">${["晴", "多雲", "陰", "有雨", "有雷雨", "有霧"]
        .map((w) => `<span>${wxEmoji(w, "2000-01-01T12:00:00+08:00")} ${esc(weatherText(w, state.lang) || w)}</span>`).join("")}<span>🌙 ${esc(weatherText("晴", state.lang))}</span></div>`;
      break;
    case "typhoon":
      html = `<div class="t">${t("layer_typhoon")}</div>
        <div><span style="color:#d7191c">━━</span> ${t("ty_past")}</div>
        <div><span style="color:#e76818">╍╍</span> ${t("ty_forecast")}</div>
        <div><span style="color:#f29e2e">◯</span> ${t("ty_r15")}</div>
        <div><span style="color:#d7191c">◯</span> ${t("ty_r25")}</div>
        <div><span style="color:#e76818">┄</span> ${t("ty_r70")}</div>`;
      break;
  }
  el.innerHTML = html;
  el.style.display = html ? "" : "none";
}

// ---------------------------------------------------------------- side panel
function inCounty(s) { return !state.county || s.county === state.county; }

function statCard(k, v, sub, id) {
  return `<div class="stat${id ? " clickable" : ""}"${id ? ` data-station="${esc(id)}"` : ""}>
    <div class="k">${esc(k)}</div><div class="v">${v}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div>`;
}
function rankList(title, list, valueOf, unit) {
  if (!list.length) return "";
  return `<p class="rank-title">${esc(title)}</p><ul class="rank">${list.map((s) =>
    `<li data-station="${esc(s.station_id)}"><span class="n">${esc(s.station_name)} <span class="muted small">${esc(countyName(s.county, state.lang))}</span></span><span class="v">${fmt1(valueOf(s))}${unit}</span></li>`).join("")}</ul>`;
}
function extremes(list, valueOf) {
  const v = list.filter((s) => valueOf(s) != null).sort((a, b) => valueOf(b) - valueOf(a));
  const avg = v.length ? v.reduce((a, s) => a + valueOf(s), 0) / v.length : null;
  return { sorted: v, hi: v[0], lo: v[v.length - 1], avg };
}
function scopeLabel() {
  return state.county ? countyName(state.county, state.lang) : t("all_counties");
}

function renderPanel() {
  const el = document.getElementById("layerPanel");
  if (!data.obs) { el.innerHTML = ""; return; }
  const clear = state.county
    ? ` <button class="chip clear-county" data-clear-county aria-label="${esc(t("all_counties"))}">✕</button>` : "";
  const title = `<h3>${LAYERS.find((l) => l.id === state.layer).ico} ${t("layer_" + state.layer)} · ${esc(scopeLabel())}${clear}</h3>`;
  const obs = data.obs.stations.filter(inCounty);
  let html = "";

  if (state.layer === "temp" || state.layer === "humidity" || state.layer === "wind") {
    const cfg = {
      temp: [(s) => s.temperature, "°", "ranking_hot", "ranking_cold"],
      humidity: [(s) => s.humidity, "%", "ranking_humid", null],
      wind: [(s) => s.wind_speed, "", "ranking_windy", null],
    }[state.layer];
    const [valueOf, unit, hotKey, coldKey] = cfg;
    const e = extremes(obs, valueOf);
    const u = state.layer === "wind" ? ` ${t("ms")}` : unit;
    html = `${title}<div class="stats">
      ${statCard(t("highest"), e.hi ? fmt1(valueOf(e.hi)) + u : "—", e.hi && e.hi.station_name, e.hi && e.hi.station_id)}
      ${state.layer === "wind" ? statCard(t("bft_max"), e.hi ? beaufort(valueOf(e.hi)) : "—", e.hi && e.hi.station_name, e.hi && e.hi.station_id)
        : statCard(t("lowest"), e.lo ? fmt1(valueOf(e.lo)) + u : "—", e.lo && e.lo.station_name, e.lo && e.lo.station_id)}
      ${statCard(t("average"), e.avg == null ? "—" : fmt1(e.avg) + u, "")}
      ${statCard(t("station_count"), e.sorted.length, `${t("obs_time")} ${fmtTime(data.obs.obs_time, false)}`)}
    </div>
    ${rankList(t(hotKey), e.sorted.slice(0, 5), valueOf, u)}
    ${coldKey ? rankList(t(coldKey), e.sorted.slice(-5).reverse(), valueOf, u) : ""}`;
  } else if (state.layer === "rain") {
    const p = state.rainPeriod;
    const list = data.rain.stations.filter(inCounty);
    const e = extremes(list, (s) => s[p]);
    const wet = e.sorted.filter((s) => s[p] > 0);
    html = `${title}<div class="chips" role="group" aria-label="${esc(t("rain_period"))}">${RAIN_PERIODS.map((k) =>
      `<button class="chip" data-period="${k}" aria-pressed="${k === p}">${t(k)}</button>`).join("")}</div>
      <div class="stats" style="margin-top:10px">
        ${statCard(t("max"), e.hi ? fmt1(e.hi[p]) + " mm" : "—", e.hi && e.hi.station_name, e.hi && e.hi.station_id)}
        ${statCard(t("raining_stations"), `${wet.length}`, `/ ${e.sorted.length} ${t("stations")}`)}
      </div>
      ${rankList(t("ranking_wet"), wet.slice(0, 5), (s) => s[p], " mm")}`;
  } else if (state.layer === "weather") {
    const counts = {};
    for (const s of obs) { const k = s.weather || "—"; counts[k] = (counts[k] || 0) + 1; }
    html = `${title}<ul class="rank">${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([w, n]) =>
      `<li><span class="n">${w === "—" ? "❔ " + t("no_data") : wxEmoji(w, data.obs.obs_time) + " " + esc(weatherText(w, state.lang))}</span><span class="v">${n}</span></li>`).join("")}</ul>`;
  } else if (state.layer === "radar") {
    const frames = data.radar.frames;
    if (!frames.length) html = `${title}<p class="muted">${t("no_data")}</p>`;
    else {
      const f = frames[radarState.index] || frames[frames.length - 1];
      html = `${title}<div class="stats">${statCard(t("radar_time"), `<span id="radarTime">${fmtTime(f.obs_time)}</span>`, `${frames.length} ${t("radar_frames")}`)}</div>
        ${frames.length > 1 ? `<div class="radar-ctl"><button class="btn small-btn" id="radarPlay">▶ ${t("radar_play")}</button>
          <input type="range" id="radarSlider" min="0" max="${frames.length - 1}" value="${radarState.index}" aria-label="${esc(t("radar_time"))}"></div>` : ""}`;
    }
  } else if (state.layer === "typhoon") {
    const storms = data.typhoons.typhoons;
    html = `<h3>🌀 ${t("layer_typhoon")}</h3>` + (storms.length ? storms.map((s) => {
      const { now } = typhoonTracks(s);
      if (!now) return "";
      return `<div class="stat clickable" data-typhoon="${esc(s.typhoon_key)}" style="margin-bottom:8px">
        <div class="v">${esc(typhoonName(s))}</div>
        <div class="s">${fmtTime(now.time)} · ${fmt1(now.lat)}°N ${fmt1(now.lon)}°E</div>
        <div class="stats" style="margin-top:8px">
          ${statCard(t("ty_max_wind"), `${now.max_wind ?? "—"} ${t("ms")}`, `${beaufort(now.max_wind)} ${t("beaufort")}`)}
          ${statCard(t("ty_pressure"), `${now.pressure ?? "—"}`, "hPa")}
          ${statCard(t("ty_moving"), esc(compassAbbr(now.moving_dir, state.lang) || "—"), `${now.moving_speed ?? "—"} ${t("kmh")}`)}
          ${statCard(t("ty_r15"), `${now.r15 ?? "—"}`, t("km"))}
        </div></div>`;
    }).join("") : `<p class="muted">${t("no_typhoon")}</p>`);
  }
  el.innerHTML = html;
}

document.getElementById("layerPanel").addEventListener("click", (ev) => {
  if (ev.target.closest("[data-clear-county]")) { setCounty(""); return; }
  const period = ev.target.closest("[data-period]");
  if (period) { state.rainPeriod = period.dataset.period; savePrefs(); renderDataLayer(); applyOverlays(); return; }
  const st = ev.target.closest("[data-station]");
  if (st) { focusStation(st.dataset.station); return; }
  const ty = ev.target.closest("[data-typhoon]");
  if (ty) { const m = markerIndex.get(ty.dataset.typhoon); if (m) { map.flyTo(m.getLatLng(), 6); m.openPopup(); } return; }
  if (ev.target.closest("#radarPlay")) toggleRadar();
});
document.getElementById("layerPanel").addEventListener("input", (ev) => {
  if (ev.target.id === "radarSlider") { stopRadar(); showRadarFrame(Number(ev.target.value)); }
});

function toggleRadar() {
  if (radarState.timer) { stopRadar(); return; }
  const btn = document.getElementById("radarPlay");
  if (btn) btn.textContent = `⏸ ${t("radar_pause")}`;
  radarState.timer = setInterval(() => {
    showRadarFrame((radarState.index + 1) % data.radar.frames.length);
  }, 700);
}
function stopRadar() {
  if (radarState.timer) clearInterval(radarState.timer);
  radarState.timer = null;
  const btn = document.getElementById("radarPlay");
  if (btn) btn.textContent = `▶ ${t("radar_play")}`;
}

function focusStation(id) {
  const m = markerIndex.get(id);
  if (!m) return;
  closeSidebarMobile();
  map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 11), { duration: 0.8 });
  map.once("moveend", () => m.openPopup());
}

function updateBadge() {
  const el = document.getElementById("obsBadge");
  if (!data.obs) { el.textContent = ""; return; }
  let time = data.obs.obs_time, src = "O-A0003-001";
  if (state.layer === "rain") { time = data.rain.obs_time; src = "O-A0002-001"; }
  if (state.layer === "radar") { const f = data.radar.frames[radarState.index]; time = f && f.obs_time; src = "O-A0058-003"; }
  if (state.layer === "typhoon") {
    const now = data.typhoons.typhoons.map((s) => typhoonTracks(s).now).filter(Boolean)[0];
    time = now && now.time; src = "W-C0034-005";
  }
  el.textContent = `${t("layer_" + state.layer)} · ${t("obs_time")} ${fmtTime(time)} · ${src}`;
}

// ---------------------------------------------------------------- controls
function renderLayerList() {
  const el = document.getElementById("layerList");
  el.innerHTML = LAYERS.map((l) => `<button class="layer-btn" role="radio" aria-checked="${l.id === state.layer}" data-layer="${l.id}">
    <span class="ico" aria-hidden="true">${l.ico}</span><span>${t("layer_" + l.id)}</span></button>`).join("");
}
document.getElementById("layerList").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-layer]");
  if (!b || b.dataset.layer === state.layer) return;
  state.layer = b.dataset.layer;
  radarState.fresh = true;
  savePrefs();
  renderLayerList();
  map.closePopup();
  renderDataLayer({ fit: state.layer === "typhoon" });
  applyOverlays();
});

function renderBaseList() {
  document.getElementById("baseList").innerHTML = ["street", "light", "dark"].map((id) =>
    `<button role="radio" aria-checked="${id === state.base}" data-base="${id}">${t("base_" + id)}</button>`).join("");
}
document.getElementById("baseList").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-base]");
  if (b) { setBase(b.dataset.base); renderDataLayer(); applyOverlays(); }
});

for (const [id, key] of [["ovStations", "stations"], ["ovCounties", "counties"], ["ovLabels", "labels"]]) {
  const cb = document.getElementById(id);
  cb.checked = state.ov[key];
  cb.addEventListener("change", () => { state.ov[key] = cb.checked; savePrefs(); applyOverlays(); });
}

function renderCountySelect() {
  const el = document.getElementById("countySelect");
  const names = data.counties ? data.counties.features.map((f) => f.properties.name) : [];
  const order = Object.keys(COUNTIES).filter((c) => names.includes(c));
  el.innerHTML = `<option value="">${t("all_counties")}</option>` +
    order.map((c) => `<option value="${esc(c)}"${c === state.county ? " selected" : ""}>${esc(countyName(c, state.lang))}</option>`).join("");
}
document.getElementById("countySelect").addEventListener("change", (ev) => setCounty(ev.target.value));

function setCounty(name) {
  state.county = state.county === name && name ? "" : name;
  document.getElementById("countySelect").value = state.county;
  if (countyLayer) countyLayer.setStyle(countyStyle);
  renderCountyFocus();
  renderDataLayer();
  applyOverlays();
  if (state.county && countyLayer) {
    const layer = countyLayer.getLayers().find((l) => l.feature.properties.name === state.county);
    if (layer) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  } else {
    map.fitBounds(TAIWAN_BOUNDS);
  }
  renderPanel();
}

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && state.county && !ev.target.closest?.("input, select")) setCounty("");
});

// search across both station networks
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q || !data.obs) { searchResults.hidden = true; return; }
  const match = (s) => s.station_name.toLowerCase().includes(q) || s.station_id.toLowerCase().includes(q)
    || (s.town || "").includes(q) || countyName(s.county, state.lang).toLowerCase().includes(q);
  const hits = [
    ...data.obs.stations.filter(match).map((s) => ({ s, kind: "obs" })),
    ...data.rain.stations.filter(match).map((s) => ({ s, kind: "rain" })),
  ].slice(0, 10);
  searchResults.innerHTML = hits.length ? hits.map(({ s, kind }) =>
    `<li data-id="${esc(s.station_id)}" data-kind="${kind}"><span>${kind === "rain" ? "🌧️" : "🌡️"} ${esc(s.station_name)}</span>
      <span class="sub">${esc(countyName(s.county, state.lang))} ${esc(s.town || "")}</span></li>`).join("")
    : `<li class="muted">${t("no_match")}</li>`;
  searchResults.hidden = false;
});
searchResults.addEventListener("click", (ev) => {
  const li = ev.target.closest("[data-id]");
  if (!li) return;
  const want = li.dataset.kind === "rain" ? "rain" : (OBS_LAYERS.has(state.layer) ? state.layer : "temp");
  if (want !== state.layer) {
    state.layer = want; savePrefs(); renderLayerList(); renderDataLayer(); applyOverlays();
  }
  searchResults.hidden = true;
  searchInput.value = "";
  focusStation(li.dataset.id);
});
document.addEventListener("click", (ev) => { if (!ev.target.closest(".search-wrap")) searchResults.hidden = true; });

// locate
document.getElementById("locateBtn").addEventListener("click", () => {
  toast(t("locating"));
  map.locate({ setView: false, enableHighAccuracy: true, timeout: 10000 });
});
map.on("locationfound", (e) => {
  if (meLayer) map.removeLayer(meLayer);
  meLayer = L.layerGroup([
    L.circle(e.latlng, { radius: e.accuracy, color: "#1f6feb", weight: 1, fillOpacity: 0.08, interactive: false }),
    L.marker(e.latlng, { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [16, 16] }) }),
  ]).addTo(map);
  let best = null, bestD = Infinity;
  for (const s of data.obs ? data.obs.stations : []) {
    const d = haversineKm([e.latlng.lat, e.latlng.lng], [s.lat, s.lon]);
    if (d < bestD) { best = s; bestD = d; }
  }
  map.flyTo(e.latlng, 11);
  hideToast();
  closeSidebarMobile();
  if (best) {
    L.popup({ maxWidth: 300 }).setLatLng(e.latlng).setContent(
      `<div class="pop"><h4>📌 ${t("you_are_here")}</h4><div class="where">${t("nearest")}: ${esc(best.station_name)} · ${bestD.toFixed(1)} ${t("km")}</div></div>` +
      obsPopup(best).replace('<div class="pop">', '<div class="pop" style="margin-top:8px">')).openOn(map);
  }
});
map.on("locationerror", (e) => toast(t("locate_fail") + e.message, 4000));

// refresh (ETL → DB), then re-read from DB
const refreshBtn = document.getElementById("refreshBtn");
refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.lastElementChild.textContent = t("refreshing");
  try {
    const r = await fetch("/api/refresh", { method: "POST" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await reload();
    toast(t("refresh_done"));
  } catch (e) {
    toast(`${t("refresh_fail")}: ${e.message}`, 4000);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.lastElementChild.textContent = t("refresh");
  }
});

// language
const langSelect = document.getElementById("langSelect");
langSelect.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
langSelect.addEventListener("change", () => { state.lang = langSelect.value; savePrefs(); applyLang(); });

function applyLang() {
  document.documentElement.lang = state.lang;
  document.title = t("title");
  langSelect.value = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  map.closePopup();
  renderLayerList();
  renderBaseList();
  renderCountySelect();
  renderStationDots();
  renderLegend();
  renderPanel();
  updateBadge();
  renderUpdated();
  // typhoon tooltips carry names; rebuild when shown
  if (state.layer === "typhoon") renderDataLayer();
}

function renderUpdated() {
  const el = document.getElementById("updatedInfo");
  if (!data.meta) { el.textContent = ""; return; }
  const times = Object.values(data.meta.last_fetch).sort();
  el.textContent = times.length ? `${t("updated")}: ${fmtTime(times[times.length - 1])}` : "";
  refreshBtn.hidden = !data.meta.refresh_enabled;
}

// mobile drawer
const sidebar = document.getElementById("sidebar");
document.getElementById("openSidebar").addEventListener("click", () => sidebar.classList.add("open"));
document.getElementById("closeSidebar").addEventListener("click", () => sidebar.classList.remove("open"));
function closeSidebarMobile() { sidebar.classList.remove("open"); }
map.on("click", closeSidebarMobile);

// toast
let toastTimer = null;
function toast(msg, ms = 2500) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
}
function hideToast() { document.getElementById("toast").hidden = true; }

// ---------------------------------------------------------------- boot
async function reload() {
  await loadData();
  if (!countyLayer) buildCountyLayer();
  radarState.fresh = true;
  renderStationDots();
  renderCountySelect();
  renderDataLayer();
  applyOverlays();
  renderUpdated();
}

setBase(state.base);
applyLang();
reload().then(() => {
  // The container may not have had its final size when Leaflet first measured it.
  map.invalidateSize();
  if (state.layer === "typhoon") renderDataLayer({ fit: true });
  else map.fitBounds(TAIWAN_BOUNDS);
}).catch((e) => toast(`${t("refresh_fail")}: ${e.message}`, 6000));
// Re-read from the DB periodically (the ETL may have run in the background).
setInterval(() => reload().catch(() => {}), 5 * 60 * 1000);
