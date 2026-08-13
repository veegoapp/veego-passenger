import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchPassengerActiveSession } from '@/src/api/activeSession';
import { onAuthEvent } from '@/src/api/authEvents';
import {
  getSocket,
  getSocketSync,
  onSocketConnectionChange,
  reconnectSocket,
  type SocketConnectionState,
} from '@/src/api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import { adaptPassengerActiveSession } from '@/src/session/activeSessionAdapter';
import type {
  NormalizedPassengerActiveSession,
  PassengerSessionSnapshotPayload,
} from '@/src/session/activeSessionTypes';

type ActiveSessionContextValue = {
  session: NormalizedPassengerActiveSession | null;
  loading: boolean;
  initialized: boolean;
  error: Error | null;
  initializeActiveSession: () => Promise<void>;
  refreshActiveSession: () => Promise<void>;
  clearActiveSession: () => void;
};

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  session: null,
  loading: false,
  initialized: false,
  error: null,
  initializeActiveSession: async () => {},
  refreshActiveSession: async () => {},
  clearActiveSession: () => {},
});

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<NormalizedPassengerActiveSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const socketListenerAttachedRef = useRef(false);
  const initializationRef = useRef(false);
  // Mirrors the `initialized` state so AppState / socket callbacks can read it
  // without capturing a stale closure value.
  const initializedRef = useRef(false);
  // Bumped every time a snapshot is actually applied (REST or socket).
  // refreshActiveSession() captures this before its awaited fetch and checks
  // it again after — if a newer snapshot (e.g. a faster session:snapshot
  // socket event) landed in the meantime, the slower REST response is
  // discarded instead of regressing state that's already more current.
  const snapshotGenerationRef = useRef(0);

  const applySnapshot = useCallback((value: unknown, source: 'REST' | 'socket') => {
    try {
      const nextSession = adaptPassengerActiveSession(value);
      if (!mountedRef.current) return;
      snapshotGenerationRef.current += 1;
      setSession(nextSession);
      if (source === 'REST') setError(null);
      if (__DEV__) {
        console.log(
          `[ActiveSession] ${source === 'socket' ? 'session:snapshot' : 'session fetch'} received`,
        );
      }
    } catch (conversionError) {
      if (__DEV__) {
        console.warn('[ActiveSession] adapter conversion failure:', conversionError);
      }
      if (source === 'REST' && mountedRef.current) {
        setError(toError(conversionError));
      }
    }
  }, []);

  const handleSnapshot = useCallback((payload: PassengerSessionSnapshotPayload) => {
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
      if (__DEV__) console.warn('[ActiveSession] invalid session:snapshot payload');
      return;
    }
    applySnapshot(payload.data, 'socket');
  }, [applySnapshot]);

  const attachSocket = useCallback(async () => {
    const socket = await getSocket();
    if (!mountedRef.current) return;
    if (socketRef.current === socket && socketListenerAttachedRef.current) return;

    if (socketRef.current && socketListenerAttachedRef.current) {
      socketRef.current.off(SOCKET_EVENTS.SESSION_SNAPSHOT, handleSnapshot);
    }

    socketRef.current = socket;
    socketListenerAttachedRef.current = true;
    socket.on(SOCKET_EVENTS.SESSION_SNAPSHOT, handleSnapshot);
  }, [handleSnapshot]);

  const detachSocket = useCallback(() => {
    if (socketRef.current && socketListenerAttachedRef.current) {
      socketRef.current.off(SOCKET_EVENTS.SESSION_SNAPSHOT, handleSnapshot);
    }
    socketRef.current = null;
    socketListenerAttachedRef.current = false;
  }, [handleSnapshot]);

  const refreshActiveSession = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    if (__DEV__) console.log('[ActiveSession] session fetch started');
    const generationAtStart = snapshotGenerationRef.current;

    try {
      const rawSession = await fetchPassengerActiveSession();
      if (snapshotGenerationRef.current !== generationAtStart) {
        // Something newer (a socket session:snapshot, or another overlapping
        // refresh) already landed while this request was in flight — applying
        // this response now would regress state backward.
        if (__DEV__) console.log('[ActiveSession] discarding stale REST response — superseded by a newer snapshot');
        return;
      }
      applySnapshot(rawSession, 'REST');
    } catch (fetchError) {
      // A transient failure must not erase an existing session.
      if (mountedRef.current) setError(toError(fetchError));
      if (__DEV__) console.warn('[ActiveSession] session fetch failed:', fetchError);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [applySnapshot]);

  const initializeActiveSession = useCallback(async () => {
    if (initializationRef.current || !mountedRef.current) return;

    initializationRef.current = true;
    try {
      await refreshActiveSession();
      attachSocket().catch((socketError) => {
        if (__DEV__) console.warn('[ActiveSession] socket listener setup failed:', socketError);
      });
    } finally {
      if (mountedRef.current) setInitialized(true);
      initializationRef.current = false;
    }
  }, [attachSocket, refreshActiveSession]);

  const clearActiveSession = useCallback(() => {
    if (!mountedRef.current) return;
    setSession(null);
    setError(null);
  }, []);

  // Keep initializedRef in sync so callbacks that outlive renders can read it.
  useEffect(() => {
    initializedRef.current = initialized;
  }, [initialized]);

  useEffect(() => {
    mountedRef.current = true;

    // ── Zombie-socket tracking ──────────────────────────────────────────
    // Tracks the AppState value as of the last change event, so the handler
    // below can tell a real background→active resume (the OS actually
    // suspended JS execution) apart from an 'inactive' flap (control center,
    // app switcher, a permission dialog) that never suspended anything.
    let previousAppState: AppStateStatus = AppState.currentState;

    // ── Socket reconnect recovery ─────────────────────────────────────────
    // When the socket gets a brand-new instance (e.g. after a token-refresh
    // reconnect), re-attach the session:snapshot listener.  Then immediately
    // kick off a REST refresh as a fallback: the server emits session:snapshot
    // the instant the socket connects, so if the snapshot arrived before the
    // listener was re-attached we would have missed it.  The subsequent REST
    // call covers that race window.
    //
    // For Socket.IO's built-in auto-reconnect (same socket instance), the
    // listener is never removed and session:snapshot is received normally —
    // no REST fallback is needed for that case.
    const attachAfterSocketReconnect = (state: SocketConnectionState) => {
      if (state !== 'connected' || !mountedRef.current) return;
      const currentSocket = getSocketSync();
      if (!currentSocket || currentSocket === socketRef.current) return;

      attachSocket()
        .then(() => {
          // Fallback REST refresh to cover the snapshot race on new socket instances.
          if (!mountedRef.current || !initializedRef.current) return;
          refreshActiveSession().catch((err) => {
            if (__DEV__) console.warn('[ActiveSession] post-reconnect fallback refresh failed:', err);
          });
        })
        .catch((socketError) => {
          if (__DEV__) console.warn('[ActiveSession] socket listener setup failed:', socketError);
        });
    };

    // ── App foreground recovery ───────────────────────────────────────────
    // When the app returns from the background, refresh the session via REST
    // so the UI reflects any server-side changes that happened while offline.
    //
    // Rules (per contract):
    //   - data exists  → update ActiveSessionContext  (handled by applySnapshot)
    //   - data is null → clear active session         (handled by applySnapshot)
    //   - request fails → keep previous session        (refreshActiveSession never clears on error)
    //
    // Only runs when the user is already initialized (i.e. authenticated).
    // Unauthenticated foreground resumes are handled separately by useAuthOnResume
    // in app/index.tsx and do not need a session refresh.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const wasBackground = previousAppState === 'background';
      previousAppState = nextState;
      if (nextState !== 'active' || !mountedRef.current || !initializedRef.current) return;
      if (__DEV__) console.log('[ActiveSession] foreground resume — refreshing session');

      // ── Zombie-socket recovery ──────────────────────────────────────────
      // A socket can report `connected: true` while its transport is actually
      // dead: the OS freezes JS timers (including socket.io's own engine.io
      // ping-timeout) while the app is backgrounded, and a TCP connection
      // silently dropped during that suspension (carrier/NAT idle reap) never
      // fires a `disconnect` event to correct the flag. The result is a
      // socket that looks alive but has stopped delivering ride:driver_location
      // and every other event until the user force-closes the app. Only a
      // real 'background' state can cause this — 'inactive' is a transient
      // flap with no meaningful suspension — so this is gated on the
      // previous AppState rather than firing on every resume.
      //
      // reconnectSocket() tears down and rebuilds the socket unconditionally;
      // it's safe to call even when the connection turns out to be fine
      // (cheap, and this only runs on a real background resume, not on every
      // token refresh — see softReconnectSocket for that hot path). The
      // existing onSocketConnectionChange listener below picks up the new
      // instance and re-attaches session:snapshot; useDriverLocationSocket /
      // useRide's own onSocketConnectionChange listeners do the same for
      // ride:driver_location and the rest of the ride event stream.
      if (wasBackground) {
        if (__DEV__) console.log('[ActiveSession] resumed from background — forcing socket reconnect to clear any zombie connection');
        reconnectSocket().catch((err) => {
          if (__DEV__) console.warn('[ActiveSession] forced socket reconnect on resume failed:', err);
        });
      }

      refreshActiveSession().catch((err) => {
        if (__DEV__) console.warn('[ActiveSession] foreground resume refresh failed:', err);
      });
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    const unsubscribeSocket = onSocketConnectionChange(attachAfterSocketReconnect);
    const unsubscribeLogin = onAuthEvent('auth:login', () => {
      initializeActiveSession().catch((initError) => {
        if (__DEV__) console.warn('[ActiveSession] initialization failed:', initError);
      });
    });
    const unsubscribeLogout = onAuthEvent('auth:logout', () => {
      initializationRef.current = false;
      detachSocket();
      clearActiveSession();
      setInitialized(false);
    });

    return () => {
      mountedRef.current = false;
      appStateSub.remove();
      unsubscribeSocket();
      unsubscribeLogin();
      unsubscribeLogout();
      detachSocket();
    };
  }, [attachSocket, clearActiveSession, detachSocket, initializeActiveSession, refreshActiveSession]);

  const value = useMemo<ActiveSessionContextValue>(() => ({
    session,
    loading,
    initialized,
    error,
    initializeActiveSession,
    refreshActiveSession,
    clearActiveSession,
  }), [
    session,
    loading,
    initialized,
    error,
    initializeActiveSession,
    refreshActiveSession,
    clearActiveSession,
  ]);

  return (
    <ActiveSessionContext.Provider value={value}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession(): ActiveSessionContextValue {
  return useContext(ActiveSessionContext);
}