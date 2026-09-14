import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { fetchPassengerActiveSession } from '@/src/api/activeSession';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import { ActiveSessionProvider, useActiveSession } from './ActiveSessionContext';

jest.mock('@/src/api/activeSession', () => ({
  fetchPassengerActiveSession: jest.fn(),
}));

// Self-contained fake pub/sub for auth events, exposing an `emit` escape
// hatch via the mocked module itself (jest.mock factories can't close over
// outer-scope consts — see lib/api/_client.test.ts in the driver repo for
// the same pattern/reasoning).
jest.mock('@/src/api/authEvents', () => {
  let listeners: Record<string, Set<any>> = { 'auth:login': new Set(), 'auth:logout': new Set() };
  return {
    onAuthEvent: (event: any, cb: any) => {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    __emit: (event: any) => listeners[event].forEach((cb: any) => cb()),
    // Each test renders a fresh Provider instance; without a reset, listener
    // sets from every prior test's (unmounted-but-still-registered) instance
    // would keep accumulating and firing on later __emit() calls.
    __reset: () => { listeners = { 'auth:login': new Set(), 'auth:logout': new Set() }; },
  };
});

jest.mock('@/src/api/socket', () => {
  let connectionListeners: Set<any> = new Set();
  let currentSocket: any = null;
  return {
    getSocket: jest.fn(async () => currentSocket),
    getSocketSync: jest.fn(() => currentSocket),
    onSocketConnectionChange: (cb: any) => {
      connectionListeners.add(cb);
      return () => connectionListeners.delete(cb);
    },
    reconnectSocket: jest.fn(async () => {}),
    __setSocket: (s: any) => { currentSocket = s; },
    __emitConnectionChange: (state: any) => connectionListeners.forEach((cb: any) => cb(state)),
    __reset: () => { connectionListeners = new Set(); currentSocket = null; },
  };
});

// jest-expo's own preset already provides a working react-native mock;
// replacing the whole module (even spreading jest.requireActual over it)
// pulls in real native-module lookups (DevMenu, etc.) that crash under
// Jest. Instead, just spy on the one method this context calls.
const appStateListeners = new Set<(state: string) => void>();
function emitAppState(state: string) {
  appStateListeners.forEach((cb) => cb(state));
}

const mockedFetchSession = fetchPassengerActiveSession as jest.Mock;
const authEventsMock = jest.requireMock('@/src/api/authEvents');
const socketMock = jest.requireMock('@/src/api/socket');

function makeFakeSocket() {
  const handlers = new Map<string, Set<(...args: any[]) => void>>();
  return {
    on: jest.fn((event: string, cb: (...args: any[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(cb);
    }),
    off: jest.fn((event: string, cb: (...args: any[]) => void) => {
      handlers.get(event)?.delete(cb);
    }),
    emit(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((cb) => cb(payload));
    },
  };
}

const rideSession = {
  sessionType: 'ride',
  vehicleType: 'car',
  rideId: 42,
  status: 'searching',
  requestedCategory: null,
  pickup: { latitude: 30.0, longitude: 31.0, address: 'A' },
  dropoff: { latitude: 30.1, longitude: 31.1, address: 'B' },
  recipient: null,
  distanceKm: null,
  estimatedDurationMinutes: null,
  estimatedPrice: null,
  finalPrice: null,
  waitingCharge: 0,
  paymentMethod: 'cash',
  promoCode: null,
  driver: null,
  dispatchState: null,
  requestedAt: '2026-01-01T00:00:00.000Z',
  driverAssignedAt: null,
  driverArrivedAt: null,
  driverArrivedLocation: null,
  startedAt: null,
};

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

let currentUnmount: (() => Promise<void> | void) | null = null;

async function setupHook() {
  const rendered = await renderHook(() => useActiveSession(), {
    wrapper: ({ children }) => <ActiveSessionProvider>{children}</ActiveSessionProvider>,
  });
  currentUnmount = rendered.unmount;
  return rendered;
}

describe('ActiveSessionContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authEventsMock.__reset();
    socketMock.__reset();
    mockedFetchSession.mockResolvedValue(null);
    appStateListeners.clear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, cb: any) => {
      appStateListeners.add(cb);
      return { remove: jest.fn(() => appStateListeners.delete(cb)) } as any;
    });
  });

  afterEach(async () => {
    if (currentUnmount) {
      await act(async () => { await currentUnmount!(); });
      currentUnmount = null;
    }
  });

  it('starts with no session and not initialized', async () => {
    const { result } = await setupHook();

    expect(result.current.session).toBeNull();
    expect(result.current.initialized).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('initializeActiveSession loads the session via REST and marks initialized', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();

    await act(async () => { await result.current.initializeActiveSession(); });

    expect(result.current.session).toMatchObject({ kind: 'ride', rideId: 42 });
    expect(result.current.initialized).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('sets initialized=true even when the REST fetch fails (does not block the app)', async () => {
    mockedFetchSession.mockRejectedValue(new Error('network down'));
    const { result } = await setupHook();

    await act(async () => { await result.current.initializeActiveSession(); });

    expect(result.current.initialized).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.session).toBeNull();
  });

  it('a transient refresh failure does not erase an already-loaded session', async () => {
    mockedFetchSession.mockResolvedValueOnce(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });
    expect(result.current.session).not.toBeNull();

    mockedFetchSession.mockRejectedValueOnce(new Error('flaky'));
    await act(async () => { await result.current.refreshActiveSession(); });

    expect(result.current.session).not.toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('applies a session:snapshot socket event on top of the current session', async () => {
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });

    await act(async () => {
      socket.emit(SOCKET_EVENTS.SESSION_SNAPSHOT, { data: { ...rideSession, rideId: 99 } });
    });

    expect(result.current.session).toMatchObject({ rideId: 99 });
  });

  it('ignores a malformed session:snapshot payload (missing "data" key)', async () => {
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });
    mockedFetchSession.mockResolvedValueOnce(rideSession);
    await act(async () => { await result.current.refreshActiveSession(); });
    const before = result.current.session;

    await act(async () => { socket.emit(SOCKET_EVENTS.SESSION_SNAPSHOT, { notData: true }); });

    expect(result.current.session).toBe(before);
  });

  it('discards a stale REST response that a newer socket snapshot has already superseded', async () => {
    // attachSocket() only runs *after* the first refreshActiveSession()
    // resolves (see initializeActiveSession's source), so the race this
    // guards against can only happen on a later refresh — once the socket
    // listener is already attached — not on the very first initialization.
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);
    mockedFetchSession.mockResolvedValueOnce(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });

    let resolveFetch!: (v: unknown) => void;
    mockedFetchSession.mockImplementationOnce(() => new Promise((resolve) => { resolveFetch = resolve; }));
    let refreshPromise!: Promise<void>;
    await act(async () => { refreshPromise = result.current.refreshActiveSession(); });

    // A newer snapshot lands via socket while that REST refresh is still in flight.
    await act(async () => {
      socket.emit(SOCKET_EVENTS.SESSION_SNAPSHOT, { data: { ...rideSession, rideId: 7 } });
    });
    expect(result.current.session).toMatchObject({ rideId: 7 });

    // The slower REST response now resolves with an OLDER-looking session —
    // it must not overwrite the newer socket-delivered one.
    await act(async () => { resolveFetch({ ...rideSession, rideId: 1 }); await refreshPromise; });

    expect(result.current.session).toMatchObject({ rideId: 7 });
  });

  it('initializes automatically on an auth:login event', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();

    await act(async () => { authEventsMock.__emit('auth:login'); await flush(); });

    expect(result.current.initialized).toBe(true);
    expect(result.current.session).not.toBeNull();
  });

  it('clears the session and resets initialized on an auth:logout event', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });
    expect(result.current.session).not.toBeNull();

    await act(async () => { authEventsMock.__emit('auth:logout'); });

    expect(result.current.session).toBeNull();
    expect(result.current.initialized).toBe(false);
  });

  it('refreshes the session on foreground resume once initialized', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });
    mockedFetchSession.mockClear();

    await act(async () => { emitAppState('active'); await flush(); });

    expect(mockedFetchSession).toHaveBeenCalled();
  });

  it('does not refresh on foreground resume before the session is initialized', async () => {
    await setupHook();
    mockedFetchSession.mockClear();

    await act(async () => { emitAppState('active'); await flush(); });

    expect(mockedFetchSession).not.toHaveBeenCalled();
  });

  it('forces a socket reconnect only when resuming from a real background state', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });

    await act(async () => { emitAppState('background'); await flush(); });
    await act(async () => { emitAppState('active'); await flush(); });

    expect(socketMock.reconnectSocket).toHaveBeenCalled();
  });

  it('does not force a socket reconnect on a mere "inactive" flap (no real suspension)', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });

    await act(async () => { emitAppState('inactive'); await flush(); });
    await act(async () => { emitAppState('active'); await flush(); });

    expect(socketMock.reconnectSocket).not.toHaveBeenCalled();
  });

  it('clearActiveSession clears the session and error directly', async () => {
    mockedFetchSession.mockResolvedValue(rideSession);
    const { result } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });

    await act(async () => { result.current.clearActiveSession(); });

    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('unsubscribes everything on unmount', async () => {
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);
    const { result, unmount } = await setupHook();
    await act(async () => { await result.current.initializeActiveSession(); });

    await act(async () => { unmount(); });

    // A socket event after unmount must not throw or update anything.
    expect(() => socket.emit(SOCKET_EVENTS.SESSION_SNAPSHOT, { data: rideSession })).not.toThrow();
  });
});
