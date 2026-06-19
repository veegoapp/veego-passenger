import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const MAPLIBRE_CSS_ID = 'maplibre-gl-css';
function ensureMaplibreCSS() {
  if (document.getElementById(MAPLIBRE_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = MAPLIBRE_CSS_ID;
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.min.css';
  document.head.appendChild(link);
}

const DEFAULT_CENTER: [number, number] = [30.5523, 25.4529];

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

interface LatLng {
  latitude: number;
  longitude: number;
}

interface StationMarker extends LatLng {
  id: string;
  name: string;
}

interface RealMapProps {
  style?: object;
  pickup?: LatLng;
  dropoff?: LatLng;
  driverLocation?: LatLng;
  stationMarkers?: StationMarker[];
  defaultCenter?: LatLng;
}

function svgEl(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

const mkPin = (color: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2.2"/>
    <text x="14" y="18" text-anchor="middle" fill="white" font-size="10"
      font-family="sans-serif" font-weight="bold">${label}</text>
    <line x1="14" y1="26" x2="14" y2="34" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

const DRIVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <circle cx="16" cy="16" r="14" fill="#2563eb" opacity="0.2"/>
  <circle cx="16" cy="16" r="10" fill="#2563eb" stroke="white" stroke-width="2"/>
  <path d="M10 15 h12 M13 12 l3 3 l3-3 M11 18 c0 2 2 3 5 3s5-1 5-3"
    stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <line x1="16" y1="26" x2="16" y2="38" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const STATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="28" viewBox="0 0 22 28">
  <circle cx="11" cy="11" r="9" fill="#6366f1" stroke="white" stroke-width="2"/>
  <circle cx="11" cy="11" r="3" fill="white"/>
  <line x1="11" y1="20" x2="11" y2="27" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export function RealMap({
  style,
  pickup,
  dropoff,
  driverLocation,
  stationMarkers = [],
  defaultCenter,
}: RealMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    ensureMaplibreCSS();

    const pts = [driverLocation, pickup, dropoff, defaultCenter].filter(Boolean) as LatLng[];
    const center: [number, number] = pts.length
      ? [pts.reduce((s, p) => s + p.longitude, 0) / pts.length, pts.reduce((s, p) => s + p.latitude, 0) / pts.length]
      : DEFAULT_CENTER;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: 12,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      for (const s of stationMarkers) {
        new maplibregl.Marker({ element: svgEl(STATION_SVG), anchor: 'bottom' })
          .setLngLat([s.longitude, s.latitude])
          .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setText(s.name))
          .addTo(map);
      }

      if (pickup) {
        new maplibregl.Marker({ element: svgEl(mkPin('#22c55e', 'P')), anchor: 'bottom' })
          .setLngLat([pickup.longitude, pickup.latitude])
          .setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setText('Pickup'))
          .addTo(map);
      }

      if (dropoff) {
        new maplibregl.Marker({ element: svgEl(mkPin('#ef4444', 'D')), anchor: 'bottom' })
          .setLngLat([dropoff.longitude, dropoff.latitude])
          .setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setText('Dropoff'))
          .addTo(map);
      }

      if (driverLocation) {
        const marker = new maplibregl.Marker({ element: svgEl(DRIVER_SVG), anchor: 'bottom' })
          .setLngLat([driverLocation.longitude, driverLocation.latitude])
          .setPopup(new maplibregl.Popup({ offset: 22, closeButton: false }).setText('Driver'))
          .addTo(map);
        driverMarkerRef.current = marker;
      }

      const routePts = [driverLocation, pickup, dropoff].filter(Boolean) as LatLng[];
      if (routePts.length >= 2) {
        const coords = routePts.map((p) => [p.longitude, p.latitude] as [number, number]);
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.8 },
        });
      }

      const allPts = [driverLocation, pickup, dropoff, ...stationMarkers].filter(Boolean) as LatLng[];
      if (allPts.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        allPts.forEach((p) => bounds.extend([p.longitude, p.latitude]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 500 });
      }
    });

    return () => {
      driverMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!driverLocation || !driverMarkerRef.current) return;
    driverMarkerRef.current.setLngLat([driverLocation.longitude, driverLocation.latitude]);
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="box-none">
      {/* @ts-ignore – div valid in Expo web */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
