import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

const MAPLIBRE_CSS_ID = 'maplibre-gl-css';
const MAPLIBRE_CSS_HREF =
  'https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.min.css';

function ensureMaplibreCSS() {
  if (document.getElementById(MAPLIBRE_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = MAPLIBRE_CSS_ID;
  link.rel = 'stylesheet';
  link.href = MAPLIBRE_CSS_HREF;
  document.head.appendChild(link);
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

async function fetchOSRMRoute(
  coords: [number, number][],
): Promise<[number, number][] | null> {
  if (coords.length < 2) return null;
  try {
    const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return data.routes[0].geometry.coordinates as [number, number][];
  } catch {
    return null;
  }
}

export function makeSvgEl(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

export interface MarkerSpec {
  lngLat: [number, number];
  svg: string;
  anchor?: maplibregl.PositionAnchor;
  popupText?: string;
  popupOffset?: number;
}

export interface WebMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MarkerSpec[];
  routePoints?: [number, number][];
  routeColor?: string;
  onLoad?: (map: maplibregl.Map) => void;
}

export function WebMap({
  center,
  zoom = 13,
  markers = [],
  routePoints = [],
  routeColor = '#2563eb',
  onLoad,
}: WebMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    ensureMaplibreCSS();

    const map = new maplibregl.Map({
      container: el,
      style: OSM_STYLE,
      center,
      zoom,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    map.on('load', async () => {
      for (const m of markers) {
        const mk = new maplibregl.Marker({
          element: makeSvgEl(m.svg),
          anchor: m.anchor ?? 'center',
        }).setLngLat(m.lngLat);

        if (m.popupText) {
          mk.setPopup(
            new maplibregl.Popup({
              offset: m.popupOffset ?? 14,
              closeButton: false,
            }).setText(m.popupText),
          );
        }
        mk.addTo(map);
      }

      if (routePoints.length >= 2) {
        const osrm = await fetchOSRMRoute(routePoints);
        const coords = osrm ?? routePoints;
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {},
          },
        });
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.3 },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': routeColor,
            'line-width': 3.5,
            'line-opacity': 0.9,
          },
        });
      }

      const allPts = [
        ...routePoints,
        ...markers.map((m) => m.lngLat),
      ] as [number, number][];

      if (allPts.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        allPts.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 600 });
      }

      onLoad?.(map);
    });

    return () => {
      map.remove();
    };
  }, []); // intentionally run once — map is fully controlled imperatively

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
