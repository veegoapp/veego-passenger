/**
 * useMapCamera
 *
 * Encapsulates the map-readiness guard pattern shared by CarMap and
 * PassengerTrackingMap:
 *
 *   - mapRef       — attach to <MapView ref={mapRef} …/>
 *   - onMapReady   — pass to <MapView onMapReady={onMapReady} …/>
 *   - runOrQueueCamera(action) — call this instead of mapRef.current?.… directly
 *
 * Why the guard is needed:
 *   fitToCoordinates and animateToRegion silently discard calls made before
 *   the native MapView has finished initialising.  Camera actions that arrive
 *   before onMapReady fires are stored in pendingCameraRef; onMapReady drains
 *   and executes the latest one.  Later calls overwrite earlier ones so only
 *   the most recent intent fires — no stale camera positions accumulate.
 *
 * Usage:
 *   const { mapRef, runOrQueueCamera, onMapReady } = useMapCamera();
 *
 *   <MapView ref={mapRef} onMapReady={onMapReady} …>
 *
 *   runOrQueueCamera(() => {
 *     mapRef.current?.animateToRegion({ … }, 600);
 *   });
 */

import { useRef, useCallback } from 'react';
import MapView from 'react-native-maps';

interface UseMapCameraResult {
  /** Ref to attach to the <MapView> element. */
  mapRef: React.RefObject<MapView | null>;
  /**
   * Executes `action` immediately if the map is ready, otherwise stores it
   * for execution once onMapReady fires.  Subsequent calls before the map is
   * ready overwrite the stored action — only the most recent one executes.
   */
  runOrQueueCamera: (action: () => void) => void;
  /**
   * Pass this directly to <MapView onMapReady={onMapReady} />.
   * Sets the readiness flag and drains any pending camera action.
   */
  onMapReady: () => void;
}

export function useMapCamera(): UseMapCameraResult {
  const mapRef = useRef<MapView>(null);

  // Tracks whether the native MapView has finished initialising.
  const mapReadyRef = useRef(false);

  // Holds the most recent camera action queued before map-ready.
  // Overwritten on each new call so stale intents never fire.
  const pendingCameraRef = useRef<(() => void) | null>(null);

  const runOrQueueCamera = useCallback((action: () => void) => {
    if (mapReadyRef.current) {
      action();
    } else {
      pendingCameraRef.current = action;
    }
  }, []);

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;
    if (pendingCameraRef.current) {
      pendingCameraRef.current();
      pendingCameraRef.current = null;
    }
  }, []);

  return { mapRef, runOrQueueCamera, onMapReady };
}
