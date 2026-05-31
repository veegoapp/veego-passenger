import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MOCK_DESTINATIONS, USER_LOCATION } from './carMapData';

async function fetchOSRMRoute(coords: [number, number][]): Promise<[number, number][] | null> {
  if (coords.length < 2) return null;
  try {
    const c = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${c}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return data.routes[0].geometry.coordinates as [number, number][];
  } catch {
    return null;
  }
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

function svgEl(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

const PICKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <circle cx="9" cy="9" r="7" fill="#22c55e" stroke="white" stroke-width="2"/>
</svg>`;

const DROPOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <circle cx="14" cy="14" r="12" fill="#ef4444" stroke="white" stroke-width="2.5"/>
  <text x="14" y="18.5" text-anchor="middle" fill="white" font-size="11"
    font-family="sans-serif" font-weight="bold">D</text>
  <line x1="14" y1="26" x2="14" y2="34" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const DRIVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
  <circle cx="19" cy="19" r="17" fill="#2563eb" opacity="0.18"/>
  <circle cx="19" cy="19" r="13" fill="#2563eb" stroke="white" stroke-width="2.5"/>
  <path d="M12 17.5 h14 M15 14 l4 3.5 l4-3.5 M13 21 c0 2.5 2.8 4.5 6 4.5s6-2 6-4.5"
    stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <line x1="19" y1="32" x2="19" y2="44" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

type Phase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'arrived' | 'started' | 'completed';

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

interface CarMapProps {
  phase: Phase;
  destination: string | null;
  driverLocation?: DriverLocation | null;
}

export function CarMap({ destination, driverLocation }: CarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastLocUpdate = useRef(0);

  const pickupCoords: [number, number] = [USER_LOCATION.longitude, USER_LOCATION.latitude];
  const destCoords: [number, number] | null = destination && MOCK_DESTINATIONS[destination]
    ? [MOCK_DESTINATIONS[destination].longitude, MOCK_DESTINATIONS[destination].latitude]
    : null;
  const driverCoords: [number, number] | null = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude]
    : null;

  useEffect(() => {
    if (!containerRef.current) return;

    const allPts = [driverCoords ?? pickupCoords, pickupCoords, destCoords].filter(Boolean) as [number, number][];
    const center: [number, number] = allPts.length
      ? [
          allPts.reduce((s, p) => s + p[0], 0) / allPts.length,
          allPts.reduce((s, p) => s + p[1], 0) / allPts.length,
        ]
      : pickupCoords;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: 13,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', async () => {
      new maplibregl.Marker({ element: svgEl(PICKUP_SVG), anchor: 'center' })
        .setLngLat(pickupCoords)
        .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setText('Your location'))
        .addTo(map);

      if (destCoords) {
        new maplibregl.Marker({ element: svgEl(DROPOFF_SVG), anchor: 'bottom' })
          .setLngLat(destCoords)
          .setPopup(new maplibregl.Popup({ offset: 22, closeButton: false }).setText(destination ?? 'Dropoff'))
          .addTo(map);
      }

      const startCoords = driverCoords ?? pickupCoords;
      const driverEl = svgEl(DRIVER_SVG);
      const driverMarker = new maplibregl.Marker({ element: driverEl, anchor: 'bottom' })
        .setLngLat(startCoords)
        .addTo(map);
      driverMarkerRef.current = driverMarker;

      const routePts = [startCoords, pickupCoords, destCoords].filter(Boolean) as [number, number][];
      if (routePts.length >= 2) {
        const osrmCoords = await fetchOSRMRoute(routePts);
        const coords = osrmCoords ?? routePts;
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} },
        });
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.4 },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 3.5, 'line-opacity': 0.9 },
        });
      }

      const bounds = new maplibregl.LngLatBounds();
      routePts.forEach((p) => bounds.extend(p));
      if (routePts.length > 1) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 600 });
      }
    });

    return () => {
      driverMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    if (now - lastLocUpdate.current < 1500) return;
    lastLocUpdate.current = now;
    if (!driverLocation || !driverMarkerRef.current) return;
    driverMarkerRef.current.setLngLat([driverLocation.longitude, driverLocation.latitude]);
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* @ts-ignore – div valid in Expo web */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
