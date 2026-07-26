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

  const applySnapshot = useCallback((value: unknown, source: 'REST' | 'socket') => {
    try {
      const nextSession = adaptPassengerActiveSession(value);
      if (!mountedRef.current) return;
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

    try {
      const rawSession = await fetchPassengerActiveSession();
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
      if (nextState !== 'active' || !mountedRef.current || !initializedRef.current) return;
      if (__DEV__) console.log('[ActiveSession] foreground resume — refreshing session');
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