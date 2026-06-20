import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

const DEFAULT_CENTER: [number, number] = [30.5523, 25.4529];

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: "© <a href='https://carto.com/attributions'>CARTO</a> © <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

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

function makeSvgEl(svg: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = svg;
  return el;
}

const PICKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
  <circle cx="15" cy="15" r="13" fill="#22c55e" stroke="white" stroke-width="2.5"/>
  <text x="15" y="19.5" text-anchor="middle" fill="white" font-size="11"
    font-family="sans-serif" font-weight="bold">P</text>
  <line x1="15" y1="28" x2="15" y2="36" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const DROPOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
  <circle cx="15" cy="15" r="13" fill="#ef4444" stroke="white" stroke-width="2.5"/>
  <text x="15" y="19.5" text-anchor="middle" fill="white" font-size="11"
    font-family="sans-serif" font-weight="bold">D</text>
  <line x1="15" y1="28" x2="15" y2="36" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const DRIVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
  <circle cx="19" cy="19" r="17" fill="#2563eb" opacity="0.18"/>
  <circle cx="19" cy="19" r="13" fill="#2563eb" stroke="white" stroke-width="2.5"/>
  <path d="M12 17.5 h14 M15 14 l4 3.5 l4-3.5 M13 21 c0 2.5 2.8 4.5 6 4.5s6-2 6-4.5"
    stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <line x1="19" y1="32" x2="19" y2="44" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

export interface Station {
  id: number;
  name: string;
  order: number;
  latitude: number;
  longitude: number;
  status: 'completed' | 'active' | 'pending';
}

export interface TrackingMapProps {
  pickup?: { latitude: number; longitude: number } | null;
  dropoff?: { latitude: number; longitude: number } | null;
  driverLocation?: { latitude: number; longitude: number } | null;
  stations?: Station[];
  passengerStationId?: number | null;
  style?: object;
}

export function PassengerTrackingMap({ pickup, dropoff, driverLocation, stations = [], passengerStationId, style }: TrackingMapProps) {
  const { t } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastLocUpdate = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const pts = [driverLocation, pickup, dropoff].filter(Boolean) as Array<{ latitude: number; longitude: number }>;
    const center: [number, number] = pts.length
      ? [
          pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
          pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
        ]
      : DEFAULT_CENTER;

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
      if (pickup) {
        new maplibregl.Marker({ element: makeSvgEl(PICKUP_SVG), anchor: 'bottom' })
          .setLngLat([pickup.longitude, pickup.latitude])
          .setPopup(new maplibregl.Popup({ offset: 22, closeButton: false }).setHTML(`<b>${t('pickup')}</b>`))
          .addTo(map);
      }

      if (dropoff) {
        new maplibregl.Marker({ element: makeSvgEl(DROPOFF_SVG), anchor: 'bottom' })
          .setLngLat([dropoff.longitude, dropoff.latitude])
          .setPopup(new maplibregl.Popup({ offset: 22, closeButton: false }).setHTML(`<b>${t('dropoff')}</b>`))
          .addTo(map);
      }

      // Station markers (shuttle stops)
      const sorted = [...stations].sort((a, b) => a.order - b.order);
      sorted.forEach((station) => {
        const isPassenger = passengerStationId != null && station.id === passengerStationId;
        const color = station.status === 'completed' ? '#22c55e' : station.status === 'active' ? '#2563eb' : '#94a3b8';
        const border = isPassenger ? '#f59e0b' : '#ffffff';
        const size = isPassenger ? 32 : 26;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="${border}" stroke-width="2.5"/>
          <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif">${station.order}</text>
        </svg>`;
        new maplibregl.Marker({ element: makeSvgEl(svg), anchor: 'center' })
          .setLngLat([station.longitude, station.latitude])
          .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(`<b>${station.name}</b>`))
          .addTo(map);
      });

      // Driver / bus marker
      const driverLoc = driverLocation ?? pickup;
      if (driverLoc) {
        const el = makeSvgEl(DRIVER_SVG);
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([driverLoc.longitude, driverLoc.latitude])
          .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`<b>${t('driver_label')}</b>`))
          .addTo(map);
        driverMarkerRef.current = marker;
      }

      // Route line — through stations if available, else driver→pickup→dropoff
      const routePts: [number, number][] = sorted.length >= 2
        ? [
            ...(driverLocation ? [[driverLocation.longitude, driverLocation.latitude] as [number, number]] : []),
            ...sorted.map((s) => [s.longitude, s.latitude] as [number, number]),
          ]
        : ([driverLocation, pickup, dropoff].filter(Boolean) as Array<{ latitude: number; longitude: number }>)
            .map((p) => [p.longitude, p.latitude] as [number, number]);

      if (routePts.length >= 2) {
        const routeCoords = (await fetchOSRMRoute(routePts)) ?? routePts;
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords }, properties: {} },
        });
        map.addLayer({
          id: 'route-casing', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.5 },
        });
        map.addLayer({
          id: 'route-line', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563eb', 'line-width': 3.5, 'line-opacity': 0.9 },
        });
      }

      const allPts: Array<{ latitude: number; longitude: number }> = [
        ...(stations.length > 0
          ? stations.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))
          : ([pickup, dropoff].filter(Boolean) as Array<{ latitude: number; longitude: number }>)),
        ...(driverLocation ? [driverLocation] : []),
      ];
      if (allPts.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        allPts.forEach((p) => bounds.extend([p.longitude, p.latitude]));
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
    const map = mapRef.current;
    if (map) {
      map.easeTo({ center: [driverLocation.longitude, driverLocation.latitude], duration: 800 });
    }
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      {/* @ts-ignore – div is valid in Expo web context */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
