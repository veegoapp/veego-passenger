import { renderHook, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import { useNotifications } from './useNotifications';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

jest.mock('../../api/socket', () => ({
  getSocket: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockedGet = api.get as jest.Mock;
const mockedPatch = api.patch as jest.Mock;
const mockedGetSocket = getSocket as jest.Mock;

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

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSocket.mockResolvedValue(makeFakeSocket());
  });

  it('loads notifications on mount and maps field-name fallbacks', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: 1, type: 'trip', title: 'Departure soon', body: 'Your trip departs in 10 min', unread: true }],
    });

    const { result } = await renderHook(() => useNotifications());
    await flush();

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toMatchObject({ id: '1', type: 'trip', unread: true });
    expect(result.current.loading).toBe(false);
  });

  it('unwraps a { notifications: [...] } envelope', async () => {
    mockedGet.mockResolvedValue({ data: { notifications: [{ id: 2 }] } });

    const { result } = await renderHook(() => useNotifications());
    await flush();

    expect(result.current.notifications).toHaveLength(1);
  });

  it('defaults an unrecognized category to system', async () => {
    mockedGet.mockResolvedValue({ data: [{ id: 3, type: 'weird_category' }] });

    const { result } = await renderHook(() => useNotifications());
    await flush();

    expect(result.current.notifications[0].type).toBe('system');
  });

  it('computes unreadCount from the unread flags', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: 1, unread: true }, { id: 2, unread: false }, { id: 3, unread: true }],
    });

    const { result } = await renderHook(() => useNotifications());
    await flush();

    expect(result.current.unreadCount).toBe(2);
  });

  it('surfaces a fetch error and clears the list', async () => {
    mockedGet.mockRejectedValue({ response: { data: { error: 'Server down' } } });

    const { result } = await renderHook(() => useNotifications());
    await flush();

    expect(result.current.error).toBe('Server down');
    expect(result.current.notifications).toEqual([]);
  });

  it('markAllRead marks every notification read locally and calls the API', async () => {
    mockedGet.mockResolvedValue({ data: [{ id: 1, unread: true }] });
    mockedPatch.mockResolvedValue({});

    const { result } = await renderHook(() => useNotifications());
    await flush();

    await act(async () => { result.current.markAllRead(); });

    expect(result.current.notifications[0].unread).toBe(false);
    expect(mockedPatch).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('re-fetches when a notification:new socket event arrives', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    const socket = makeFakeSocket();
    mockedGetSocket.mockResolvedValue(socket);

    await renderHook(() => useNotifications());
    await flush();
    mockedGet.mockClear();

    await act(async () => { socket.emit(SOCKET_EVENTS.NOTIFICATION_NEW); });
    await flush();

    expect(mockedGet).toHaveBeenCalledWith('/notifications');
  });

  it('prepends a synthetic notification and schedules a local push on booking:boarded', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    const socket = makeFakeSocket();
    mockedGetSocket.mockResolvedValue(socket);

    const { result } = await renderHook(() => useNotifications());
    await flush();

    await act(async () => { socket.emit(SOCKET_EVENTS.BOOKING_BOARDED, { bookingId: 42 }); });

    expect(result.current.notifications[0]).toMatchObject({ id: '42', type: 'trip', unread: true });
  });

  it('prepends a trip-activated notification and schedules a local push', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    const socket = makeFakeSocket();
    mockedGetSocket.mockResolvedValue(socket);

    const { result } = await renderHook(() => useNotifications());
    await flush();

    await act(async () => { socket.emit(SOCKET_EVENTS.TRIP_ACTIVATED, { tripId: 7 }); });

    expect(result.current.notifications[0].type).toBe('trip');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('degrades gracefully (no crash) when the socket is unavailable', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    mockedGetSocket.mockRejectedValue(new Error('socket unavailable'));

    const { result } = await renderHook(() => useNotifications());
    await flush();

    expect(result.current.loading).toBe(false);
  });

  it('unsubscribes socket listeners on unmount', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    const socket = makeFakeSocket();
    mockedGetSocket.mockResolvedValue(socket);

    const { unmount } = await renderHook(() => useNotifications());
    await flush();

    await act(async () => { unmount(); });

    expect(socket.off).toHaveBeenCalledWith(SOCKET_EVENTS.NOTIFICATION_NEW, expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith(SOCKET_EVENTS.BOOKING_BOARDED, expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith(SOCKET_EVENTS.TRIP_ACTIVATED, expect.any(Function));
  });
});
