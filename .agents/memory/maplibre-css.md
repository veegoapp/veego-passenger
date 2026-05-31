---
name: MapLibre CSS injection
description: How to inject maplibre-gl CSS in this Expo web project; +html.tsx and CSS imports both broken
---

Two broken approaches in this project:

1. `import 'maplibre-gl/dist/maplibre-gl.css'` in a .tsx file — Metro does not process CSS imports, causes bundler crash.
2. `app/+html.tsx` importing from `expo-router/html` — the `expo-router@6.0.24` package has a broken `html.js` that tries to load `build/static/html` which doesn't exist → Metro crash.

**Fix:** Inject the CDN stylesheet via DOM in `components/shared/WebMap.web.tsx`:

```ts
function ensureMaplibreCSS() {
  if (document.getElementById('maplibre-gl-css')) return;
  const link = document.createElement('link');
  link.id = 'maplibre-gl-css';
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.min.css';
  document.head.appendChild(link);
}
```
Call this at the top of the map's `useEffect`.

**Why:** Self-contained, no external file dependencies, works with Metro's web bundler constraints.

**How to apply:** Any `.web.tsx` component that needs CSS from a library (maplibre-gl, leaflet, etc.) must inject it via DOM — never import CSS files or rely on `+html.tsx` in this project.
