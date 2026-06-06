type AuthEventType = 'auth:login' | 'auth:logout';
type Listener = () => void;

const _listeners = new Map<AuthEventType, Set<Listener>>();

export function onAuthEvent(event: AuthEventType, listener: Listener): () => void {
  if (!_listeners.has(event)) _listeners.set(event, new Set());
  _listeners.get(event)!.add(listener);
  return () => { _listeners.get(event)?.delete(listener); };
}

export function emitAuthEvent(event: AuthEventType): void {
  _listeners.get(event)?.forEach((cb) => cb());
}
