// Lightweight pub/sub for saved-locations changes — mirrors authEvents.ts.
// Lets screens with no parent/child relationship (Home's destination search
// vs. Profile's saved-locations management) invalidate each other without a
// shared context.

type SavedLocationsEventType = 'savedLocations:changed';
type Listener = () => void;

const _listeners = new Map<SavedLocationsEventType, Set<Listener>>();

export function onSavedLocationsEvent(event: SavedLocationsEventType, listener: Listener): () => void {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event)!.add(listener);
  return () => { _listeners.get(event)?.delete(listener); };
}

export function emitSavedLocationsEvent(event: SavedLocationsEventType): void {
  _listeners.get(event)?.forEach((cb) => cb());
}
