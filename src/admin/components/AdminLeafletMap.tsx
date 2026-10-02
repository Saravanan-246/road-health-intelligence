import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Real Leaflet map with OpenStreetMap tiles, rendered in a WebView.
 * Display only: every marker value (colour, priority, status) comes from the screen.
 * Without internet it falls back to a plain plot of the saved coordinates, labelled as such.
 */
export interface MapMarker {
  id: string;
  label: string;
  lat: number;
  lon: number;
  color: string;
  review: boolean;
  typeLabel: string;
  priority: number;
  status: string;
}

export type MapStatus = 'loading' | 'ready' | 'offline';

/** A circular area drawn under the markers (used for risk hotspots). */
export interface MapArea {
  id: string;
  label: string;
  lat: number;
  lon: number;
  radius: number;
  color: string;
  /** Popup lines, already formatted by the screen. */
  lines: string[];
}

/** A point of interest drawn as a small square (demo critical facilities). */
export interface MapPoi {
  id: string;
  code: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
}

/** A selected defect with the individual report positions behind it. */
export interface MapFocus {
  id: string;
  lat: number;
  lon: number;
  points: { lat: number; lon: number; accuracy: number | null; label: string }[];
}

interface Props {
  markers: MapMarker[];
  me: { lat: number; lon: number; accuracy: number | null } | null;
  onOpen: (id: string) => void;
  onStatus?: (status: MapStatus) => void;
  areas?: MapArea[];
  onOpenArea?: (id: string) => void;
  /** Changing this re-fits the view (e.g. when switching map modes). */
  fitKey?: string;
  pois?: MapPoi[];
  focus?: MapFocus | null;
}

const LOAD_TIMEOUT_MS = 15_000;

const MAP_HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
  html, body, #map { height: 100%; margin: 0; background: #E9EEF5; }
  .mk { width: 30px; height: 30px; box-sizing: border-box; border-radius: 15px; border: 2px solid #fff;
        color: #fff; font: 800 10px/26px -apple-system, Roboto, sans-serif; text-align: center;
        box-shadow: 0 1px 4px rgba(11,31,58,.45); }
  .mk.review { border: 3px solid #F5B700; line-height: 24px; }
  .pop { font: 13px/1.35 -apple-system, Roboto, sans-serif; color: #0B1F3A; min-width: 170px; }
  .pop + .pop { border-top: 1px solid #E4E7EC; margin-top: 8px; padding-top: 8px; }
  .pop b { font-size: 15px; }
  .pop .st { font-weight: 700; color: #0F766E; }
  .pop .rv { font-weight: 700; color: #8A6100; }
  .pop button { margin-top: 6px; width: 100%; border: 0; border-radius: 6px; padding: 8px; background: #1D4ED8;
                color: #fff; font: 600 13px -apple-system, Roboto, sans-serif; }
  .fit { background: #fff; border: 0; border-radius: 4px; padding: 7px 10px; color: #0B1F3A;
         font: 600 12px -apple-system, Roboto, sans-serif; box-shadow: 0 1px 5px rgba(0,0,0,.35); }
  .hs { display: inline-block; white-space: nowrap; padding: 3px 7px; border-radius: 4px; color: #fff;
        font: 800 11px/1.2 -apple-system, Roboto, sans-serif; box-shadow: 0 1px 4px rgba(11,31,58,.45);
        transform: translate(-50%, -50%); }
  .pop .hl { font-weight: 700; color: #7A2E0E; }
  .poi { min-width: 18px; height: 18px; padding: 0 3px; box-sizing: border-box; border-radius: 3px; background: #344054;
         border: 1px solid #fff; color: #fff; font: 800 9px/16px -apple-system, Roboto, sans-serif; text-align: center;
         transform: translate(-50%, -50%); box-shadow: 0 1px 3px rgba(11,31,58,.4); }
  .pop .demo { color: #8A6100; font-size: 11px; }
</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  function post(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  if (!window.L) { post({ type: 'error' }); return; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var map = L.map('map', { zoomControl: true }).setView([0, 0], 2);
  // OpenStreetMap standard tiles (attribution required by the OSM tile usage policy).
  var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  var tileErrors = 0, loadedAny = false, reportedFail = false;
  function watch(layer) {
    layer.on('tileload', function () { loadedAny = true; });
    layer.on('tileerror', function () {
      if (loadedAny || reportedFail) return;
      if (++tileErrors > 8) { reportedFail = true; post({ type: 'tiles-failed' }); }
    });
  }
  watch(tiles);

  var areaLayer = L.layerGroup().addTo(map);
  var poiLayer = L.layerGroup().addTo(map);
  var focusLayer = L.layerGroup().addTo(map);
  var layer = L.layerGroup().addTo(map);
  var meLayer = L.layerGroup().addTo(map);
  var data = { markers: [], me: null, areas: [], pois: [], focus: null, fitKey: '' };
  var fitted = false;

  function fit() {
    if (data.focus) {
      var fp = [[data.focus.lat, data.focus.lon]].concat(data.focus.points.map(function (p) { return [p.lat, p.lon]; }));
      map.fitBounds(L.latLngBounds(fp), { padding: [60, 60], maxZoom: 19 });
      return;
    }
    var pts = data.markers.map(function (d) { return [d.lat, d.lon]; });
    (data.areas || []).forEach(function (a) {
      var b = L.latLng(a.lat, a.lon).toBounds(a.radius * 2);
      pts.push([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]);
    });
    if (!pts.length) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 17 });
  }

  function renderAreas() {
    areaLayer.clearLayers();
    (data.areas || []).forEach(function (a) {
      var html = '<div class="pop"><b>' + esc(a.id) + '</b><br>' +
        a.lines.map(esc).join('<br>') + '<button data-area="' + esc(a.id) + '">View Hotspot</button></div>';
      L.circle([a.lat, a.lon], { radius: a.radius, color: a.color, weight: 2, dashArray: '6 4', fillColor: a.color, fillOpacity: 0.12 })
        .bindPopup(html, { maxWidth: 240 }).addTo(areaLayer);
      L.marker([a.lat, a.lon], {
        icon: L.divIcon({ className: '', html: '<div class="hs" style="background:' + esc(a.color) + '">' + esc(a.label) + '</div>', iconSize: [0, 0] }),
        keyboard: false
      }).bindPopup(html, { maxWidth: 240 }).addTo(areaLayer);
    });
  }

  function popupHtml(items) {
    return items.map(function (d) {
      return '<div class="pop"><b>' + esc(d.id) + '</b><br>' + esc(d.typeLabel) + '<br>Priority ' + esc(d.priority) +
        '<br><span class="st">' + esc(d.status) + '</span>' + (d.review ? ' <span class="rv">· UNDER REVIEW</span>' : '') +
        '<button data-id="' + esc(d.id) + '">View Details</button></div>';
    }).join('');
  }

  // Group markers that overlap on screen at the current zoom.
  function render() {
    layer.clearLayers();
    var groups = [];
    data.markers.forEach(function (d) {
      var p = map.latLngToContainerPoint([d.lat, d.lon]);
      var g = null;
      for (var i = 0; i < groups.length; i++) {
        if (Math.hypot(groups[i].p.x - p.x, groups[i].p.y - p.y) < 28) { g = groups[i]; break; }
      }
      if (g) g.items.push(d); else groups.push({ p: p, items: [d] });
    });
    groups.forEach(function (g) {
      var lead = g.items[0];
      var review = g.items.some(function (i) { return i.review; });
      var text = g.items.length > 1 ? '&times;' + g.items.length : esc(lead.label);
      var html = '<div class="mk' + (review ? ' review' : '') + '" style="background:' + esc(lead.color) + '">' + text + '</div>';
      L.marker([lead.lat, lead.lon], {
        icon: L.divIcon({ className: '', html: html, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] }),
        keyboard: false
      }).bindPopup(popupHtml(g.items), { maxWidth: 240 }).addTo(layer);
    });
  }

  function renderPois() {
    poiLayer.clearLayers();
    (data.pois || []).forEach(function (p) {
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: '', html: '<div class="poi">' + esc(p.code) + '</div>', iconSize: [0, 0] }),
        keyboard: false
      }).bindPopup('<div class="pop"><b>' + esc(p.name) + '</b><br>' + esc(p.category) +
        '<br><span class="demo">DEMO data — staged placeholder, not a real facility</span></div>', { maxWidth: 240 }).addTo(poiLayer);
    });
  }

  function renderFocus() {
    focusLayer.clearLayers();
    if (!data.focus) return;
    L.circle([data.focus.lat, data.focus.lon], { radius: 4, color: '#0B1F3A', weight: 3, fill: false }).addTo(focusLayer);
    data.focus.points.forEach(function (p) {
      if (p.accuracy) L.circle([p.lat, p.lon], { radius: p.accuracy, color: '#475467', weight: 1, dashArray: '3 3', fillOpacity: 0.05 }).addTo(focusLayer);
      L.circleMarker([p.lat, p.lon], { radius: 5, color: '#0B1F3A', weight: 2, fillColor: '#fff', fillOpacity: 1 })
        .bindPopup('<div class="pop"><b>' + esc(p.label) + '</b><br>' + (p.accuracy ? 'GPS ±' + esc(Math.round(p.accuracy)) + ' m' : 'GPS accuracy unknown') + '</div>')
        .addTo(focusLayer);
    });
  }

  map.on('popupopen', function (e) {
    var buttons = e.popup.getElement().querySelectorAll('button[data-id]');
    Array.prototype.forEach.call(buttons, function (b) {
      b.onclick = function () { post({ type: 'open', id: b.getAttribute('data-id') }); };
    });
    var areaButtons = e.popup.getElement().querySelectorAll('button[data-area]');
    Array.prototype.forEach.call(areaButtons, function (b) {
      b.onclick = function () { post({ type: 'area', id: b.getAttribute('data-area') }); };
    });
  });

  function renderMe(pan) {
    meLayer.clearLayers();
    if (!data.me) return;
    var ll = [data.me.lat, data.me.lon];
    if (data.me.accuracy) L.circle(ll, { radius: data.me.accuracy, color: '#1D4ED8', weight: 1, fillColor: '#1D4ED8', fillOpacity: 0.12 }).addTo(meLayer);
    L.circleMarker(ll, { radius: 7, color: '#fff', weight: 3, fillColor: '#1D4ED8', fillOpacity: 1 }).bindPopup('Your device GPS position').addTo(meLayer);
    if (pan) map.setView(ll, Math.max(map.getZoom(), 15));
  }

  var Fit = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function () {
      var b = L.DomUtil.create('button', 'fit');
      b.textContent = 'Fit defects';
      L.DomEvent.disableClickPropagation(b);
      b.onclick = fit;
      return b;
    }
  });
  map.addControl(new Fit());
  map.on('zoomend', render);

  window.rg = {
    update: function (next) {
      var meChanged = JSON.stringify(next.me) !== JSON.stringify(data.me);
      if (next.fitKey !== data.fitKey) fitted = false;
      data = next;
      if (!fitted && (data.markers.length || (data.areas || []).length || data.focus)) { fitted = true; fit(); }
      renderAreas();
      renderPois();
      renderFocus();
      render();
      if (meChanged) renderMe(!!next.me);
    }
  };
  post({ type: 'ready' });
})();
</script>
</body></html>`;

export default function AdminLeafletMap({ markers, me, onOpen, onStatus, areas = [], onOpenArea, fitKey = '', pois = [], focus = null }: Props) {
  const webRef = useRef<WebView>(null);
  const [status, setStatusState] = useState<MapStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const setStatus = (s: MapStatus) => {
    setStatusState(s);
    onStatus?.(s);
  };

  // Leaflet comes from a CDN; if it hasn't started in time, assume no connection.
  useEffect(() => {
    if (status !== 'loading') return;
    const t = setTimeout(() => setStatus('offline'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status, attempt]);

  const payload = JSON.stringify({ markers, me, areas, fitKey, pois, focus });
  useEffect(() => {
    if (status === 'ready') webRef.current?.injectJavaScript(`window.rg && window.rg.update(${payload}); true;`);
  }, [payload, status]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type?: string; id?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') setStatus('ready');
    else if (msg.type === 'error' || msg.type === 'tiles-failed') setStatus('offline');
    else if (msg.type === 'open' && typeof msg.id === 'string') onOpen(msg.id);
    else if (msg.type === 'area' && typeof msg.id === 'string') onOpenArea?.(msg.id);
  };

  if (status === 'offline') {
    return (
      <OfflineLocations
        markers={markers}
        areas={areas}
        pois={pois}
        onOpenArea={onOpenArea}
        onOpen={onOpen}
        onRetry={() => {
          setAttempt((a) => a + 1);
          setStatus('loading');
        }}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <WebView
        key={attempt}
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: MAP_HTML }}
        onMessage={onMessage}
        onError={() => setStatus('offline')}
        onShouldStartLoadWithRequest={(req) => {
          // Attribution links open in the phone browser instead of replacing the map.
          if (req.url.startsWith('http')) {
            Linking.openURL(req.url).catch(() => undefined);
            return false;
          }
          return true;
        }}
        setSupportMultipleWindows={false}
        // OSM tile policy asks apps to identify themselves.
        applicationNameForUserAgent="RoadGuardAI/1.0 (hackathon prototype)"
        style={styles.web}
      />
      {status === 'loading' ? (
        <View style={styles.cover}>
          <ActivityIndicator color="#1D4ED8" />
          <Text style={styles.coverText}>Loading map…</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- offline fallback: saved coordinates on a plain plot (not a street map) ---------- */

const PAD = 0.14;
const MIN_SPAN_DEG = 0.002;
const DOT = 28;
const RING = 76;

function OfflineLocations({
  markers,
  areas,
  pois,
  onOpen,
  onOpenArea,
  onRetry,
}: {
  markers: MapMarker[];
  areas: MapArea[];
  pois: MapPoi[];
  onOpen: (id: string) => void;
  onOpenArea?: (id: string) => void;
  onRetry: () => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const dots: { x: number; y: number; items: MapMarker[] }[] = [];
  const rings: { x: number; y: number; area: MapArea }[] = [];
  const squares: { x: number; y: number; poi: MapPoi }[] = [];

  const points = [
    ...markers.map((m) => ({ lat: m.lat, lon: m.lon })),
    ...areas.map((a) => ({ lat: a.lat, lon: a.lon })),
    ...pois.map((p) => ({ lat: p.lat, lon: p.lon })),
  ];
  if (points.length && box.w && box.h) {
    const lats = points.map((m) => m.lat);
    const lons = points.map((m) => m.lon);
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
    const cos = Math.cos((cy * Math.PI) / 180);
    const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lons) - Math.min(...lons)) * cos, MIN_SPAN_DEG);
    const scale = (Math.min(box.w, box.h) * (1 - 2 * PAD)) / span;
    const project = (lat: number, lon: number) => ({ x: box.w / 2 + (lon - cx) * cos * scale, y: box.h / 2 - (lat - cy) * scale });
    for (const a of areas) rings.push({ ...project(a.lat, a.lon), area: a });
    for (const p of pois) squares.push({ ...project(p.lat, p.lon), poi: p });
    for (const m of markers) {
      const { x, y } = project(m.lat, m.lon);
      const hit = dots.find((d) => Math.hypot(d.x - x, d.y - y) < DOT);
      if (hit) hit.items.push(m);
      else dots.push({ x, y, items: [m] });
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.offlineHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.offlineTitle}>Map connection unavailable</Text>
          <Text style={styles.offlineText}>Showing saved defect locations — coordinates only, not a street map.</Text>
        </View>
        <Pressable onPress={onRetry} hitSlop={8} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
      <View style={styles.plot} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Text style={styles.north}>N ↑</Text>
        {rings.map((r) => (
          <Pressable
            key={r.area.id}
            onPress={() => onOpenArea?.(r.area.id)}
            hitSlop={6}
            style={[styles.ring, { left: r.x - RING / 2, top: r.y - RING / 2, borderColor: r.area.color }]}
          >
            <Text style={[styles.ringLabel, { backgroundColor: r.area.color }]}>{r.area.label}</Text>
          </Pressable>
        ))}
        {squares.map((s) => (
          <View key={s.poi.id} style={[styles.poi, { left: s.x - 10, top: s.y - 9 }]} accessibilityLabel={`${s.poi.name}, demo data`}>
            <Text style={styles.poiText}>{s.poi.code}</Text>
          </View>
        ))}
        {dots.map((d) => (
          <Pressable
            key={d.items[0].id}
            disabled={d.items.length > 1}
            onPress={() => onOpen(d.items[0].id)}
            hitSlop={8}
            style={[
              styles.dot,
              { left: d.x - DOT / 2, top: d.y - DOT / 2, backgroundColor: d.items[0].color },
              d.items.some((i) => i.review) && styles.dotReview,
            ]}
          >
            <Text style={styles.dotText}>{d.items.length > 1 ? `×${d.items.length}` : d.items[0].label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#E9EEF5' },
  web: { flex: 1, backgroundColor: '#E9EEF5' },
  cover: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#E9EEF5',
  },
  coverText: { fontSize: 13, color: '#475467' },
  offlineHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: '#FEF6D8' },
  offlineTitle: { fontSize: 14, fontWeight: '700', color: '#6B4E00' },
  offlineText: { fontSize: 12, color: '#6B4E00' },
  retry: { borderRadius: 8, borderWidth: 1, borderColor: '#6B4E00', paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { fontSize: 13, fontWeight: '700', color: '#6B4E00' },
  plot: { flex: 1, overflow: 'hidden' },
  north: { position: 'absolute', top: 8, left: 10, fontSize: 12, fontWeight: '700', color: '#475467' },
  dot: {
    position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  dotReview: { borderColor: '#F5B700', borderWidth: 3 },
  dotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  ring: {
    position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'flex-start',
  },
  ringLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', marginTop: -9 },
  poi: {
    position: 'absolute', minWidth: 20, height: 18, borderRadius: 3, backgroundColor: '#344054', borderWidth: 1,
    borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  poiText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
