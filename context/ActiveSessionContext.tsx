import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchPassengerActiveSession } from '@/src/api/activeSession';
import { onAuthEvent } from '@/src/api/authEvents';
import { tokenStore } from '@/src/api/client';
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
  error: Error | null;
  initializeActiveSession: () => Promise<void>;
  refreshActiveSession: () => Promise<void>;
  clearActiveSession: () => void;
};

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  session: null,
  loading: false,
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
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const socketListenerAttachedRef = useRef(false);
  const initializationRef = useRef(false);

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
    const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);
    if (!token || !mountedRef.current) return;

    initializationRef.current = true;
    try {
      await Promise.all([attachSocket(), refreshActiveSession()]);
    } finally {
      initializationRef.current = false;
    }
  }, [attachSocket, refreshActiveSession]);

  const clearActiveSession = useCallback(() => {
    if (!mountedRef.current) return;
    setSession(null);
    setError(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const attachAfterSocketReconnect = (state: SocketConnectionState) => {
      if (state !== 'connected' || !mountedRef.current) return;
      const currentSocket = getSocketSync();
      if (!currentSocket || currentSocket === socketRef.current) return;
      attachSocket().catch((socketError) => {
        if (__DEV__) console.warn('[ActiveSession] socket listener setup failed:', socketError);
      });
    };

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
    });

    tokenStore.getToken(tokenStore.TOKEN_KEY).then((token) => {
      if (token && mountedRef.current) {
        initializeActiveSession().catch((initError) => {
          if (__DEV__) console.warn('[ActiveSession] initialization failed:', initError);
        });
      }
    }).catch(() => {});

    return () => {
      mountedRef.current = false;
      unsubscribeSocket();
      unsubscribeLogin();
      unsubscribeLogout();
      detachSocket();
    };
  }, [attachSocket, clearActiveSession, detachSocket, initializeActiveSession]);

  const value = useMemo<ActiveSessionContextValue>(() => ({
    session,
    loading,
    error,
    initializeActiveSession,
    refreshActiveSession,
    clearActiveSession,
  }), [
    session,
    loading,
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