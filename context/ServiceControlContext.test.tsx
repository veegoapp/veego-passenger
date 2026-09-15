import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ServiceControlProvider, useServiceControl } from './ServiceControlContext';

jest.mock('@/components/shared/AppAlertHost', () => ({
  showAppAlert: jest.fn(),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@/src/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  tokenStore: { getToken: jest.fn(), TOKEN_KEY: 'veego_access_token' },
}));

jest.mock('@/src/api/socket', () => {
  let currentSocket: any = null;
  return {
    getSocket: jest.fn(async () => {
      if (!currentSocket) currentSocket = { on: jest.fn(), off: jest.fn() };
      return currentSocket;
    }),
    disconnectSocket: jest.fn(),
    __setSocket: (socket: any) => { currentSocket = socket; },
    __reset: () => { currentSocket = null; },
  };
});

jest.mock('@/src/api/authEvents', () => {
  const listeners: Record<string, Set<any>> = { 'auth:login': new Set(), 'auth:logout': new Set() };
  return {
    onAuthEvent: (event: string, cb: any) => {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    __emit: (event: string) => { listeners[event]?.forEach((cb) => cb()); },
    __reset: () => { listeners['auth:login'].clear(); listeners['auth:logout'].clear(); },
  };
});

const api = jest.requireMock('@/src/api/client').default;
const { tokenStore } = jest.requireMock('@/src/api/client');
const socketMock = jest.requireMock('@/src/api/socket');
const authEventsMock = jest.requireMock('@/src/api/authEvents');

function makeFakeSocket() {
  const listeners = new Map<string, Set<any>>();
  return {
    on: (event: string, cb: any) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    },
    off: (event: string, cb: any) => { listeners.get(event)?.delete(cb); },
    __emit: (event: string, payload: any) => { listeners.get(event)?.forEach((cb) => cb(payload)); },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

let currentUnmount: (() => Promise<void>) | null = null;

async function setupHook() {
  const rendered = await renderHook(() => useServiceControl(), {
    wrapper: ({ children }) => <ServiceControlProvider>{children}</ServiceControlProvider>,
  });
  currentUnmount = rendered.unmount;
  return rendered;
}

function shuttleControl(overrides: Record<string, any> = {}) {
  return {
    serviceType: 'shuttle',
    isEnabled: true,
    displayMode: 'live',
    unavailableMessage: null,
    unavailableAction: 'none',
    activeZoneIds: [],
    maintenanceEta: null,
    ...overrides,
  };
}

describe('ServiceControlContext (passenger)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketMock.__reset();
    authEventsMock.__reset();
    tokenStore.getToken.mockResolvedValue(null);
    api.get.mockResolvedValue({ data: { data: [] } });
  });

  afterEach(async () => {
    if (currentUnmount) {
      await act(async () => { await currentUnmount!(); });
      currentUnmount = null;
    }
  });

  it('initializes automatically when a token already exists on mount, then again on auth:login', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [shuttleControl()] } });

    const { result } = await setupHook();
    await flush();

    expect(result.current.getService('shuttle')).toMatchObject({ isEnabled: true });
    expect(result.current.isLoading).toBe(false);
  });

  it('stays idle (no fetch) until auth:login fires when no token exists on mount', async () => {
    const { result } = await setupHook();
    await flush();

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.services).toEqual({});

    api.get.mockResolvedValue({ data: { data: [shuttleControl()] } });
    await act(async () => { authEventsMock.__emit('auth:login'); });
    await flush();

    expect(result.current.getService('shuttle')).toMatchObject({ isEnabled: true });
  });

  it('auth:logout clears services and detaches the socket', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [shuttleControl()] } });

    const { result } = await setupHook();
    await flush();
    expect(result.current.getService('shuttle')).not.toBeNull();

    await act(async () => { authEventsMock.__emit('auth:logout'); });

    expect(result.current.services).toEqual({});
    expect(socketMock.disconnectSocket).toHaveBeenCalled();
  });

  it('applies a real-time service:control:changed socket patch for a single service', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [shuttleControl()] } });
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);

    const { result } = await setupHook();
    await flush();

    await act(async () => {
      socket.__emit('service:control:changed', shuttleControl({ isEnabled: false, displayMode: 'maintenance' }));
    });

    expect(result.current.getService('shuttle')).toMatchObject({ isEnabled: false, displayMode: 'maintenance' });
  });

  it('retries the initial fetch with backoff and eventually succeeds', async () => {
    jest.useFakeTimers();
    try {
      tokenStore.getToken.mockResolvedValue('existing-token');
      api.get
        .mockRejectedValueOnce(new Error('down'))
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce({ data: { data: [shuttleControl()] } });

      const { result } = await setupHook();
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
      await act(async () => { await jest.advanceTimersByTimeAsync(4000); });

      expect(api.get).toHaveBeenCalledTimes(3);
      expect(result.current.getService('shuttle')).toMatchObject({ isEnabled: true });
      expect(result.current.isLoading).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('handleServiceTap allows the tap only when the service is live and visible in the zone', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [shuttleControl()] } });
    const { result } = await setupHook();
    await flush();

    const onAllow = jest.fn();
    await act(async () => { result.current.handleServiceTap('shuttle', onAllow); });
    expect(onAllow).toHaveBeenCalled();
  });

  it('handleServiceTap blocks a coming_soon service without calling onAllow', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [shuttleControl({ displayMode: 'coming_soon' })] } });
    const { result } = await setupHook();
    await flush();

    const onAllow = jest.fn();
    await act(async () => { result.current.handleServiceTap('shuttle', onAllow); });
    expect(onAllow).not.toHaveBeenCalled();
  });

  it('handleServiceTap fails closed (blocks) for a service the backend never returned', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [] } });
    const { result } = await setupHook();
    await flush();

    const onAllow = jest.fn();
    await act(async () => { result.current.handleServiceTap('delivery', onAllow); });
    expect(onAllow).not.toHaveBeenCalled();
  });

  it('isServiceVisibleForZone hides a zone-restricted service once the user zone is known and excluded', async () => {
    const Location = jest.requireMock('expo-location');
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    api.get.mockImplementation((url: string) => {
      if (url === '/zones/locate') return Promise.resolve({ data: { data: { id: 99 } } });
      return Promise.resolve({ data: { data: [shuttleControl({ activeZoneIds: [1, 2] })] } });
    });
    tokenStore.getToken.mockResolvedValue('existing-token');

    const { result } = await setupHook();
    await flush();

    expect(result.current.userZoneId).toBe(99);
    expect(result.current.isServiceVisibleForZone('shuttle')).toBe(false);
  });
});
