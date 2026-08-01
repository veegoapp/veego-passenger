import { useEffect, useRef, useState } from 'react';
import { getSocketConnectionState, onSocketConnectionChange, type SocketConnectionState } from '@/src/api/socket';

/**
 * Subscribes to the socket's connection state with a 10-second debounce on
 * non-connected transitions. This prevents the "Reconnecting…" banner from
 * flashing during brief disconnects (token refresh, quick reconnect attempts,
 * network blip) — the banner only appears when the socket has genuinely been
 * unavailable for 10 seconds or more.
 *
 * Transitions TO 'connected' are applied immediately so the banner disappears
 * as soon as the connection is restored.
 */
const DISCONNECT_DEBOUNCE_MS = 10_000;

export function useSocketConnectionState(): SocketConnectionState {
  const [state, setState] = useState<SocketConnectionState>(getSocketConnectionState());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sync with the current global state on mount.
    setState(getSocketConnectionState());

    const unsubscribe = onSocketConnectionChange((next) => {
      if (next === 'connected') {
        // Clear any pending disconnect timer and surface immediately.
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setState('connected');
      } else {
        // Debounce: only show the banner after 10 seconds of non-connected state.
        if (timerRef.current !== null) return; // already waiting
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setState(getSocketConnectionState()); // read latest state at fire time
        }, DISCONNECT_DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return state;
}
