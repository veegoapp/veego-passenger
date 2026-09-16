import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import { NotificationItemSchema, checkContract } from '../../api/schemas';
import type { Notification } from '@/constants/data';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAllRead: () => void;
  refresh: () => void;
}

// Raw shape of a notification as it may arrive from either the REST list
// endpoint or the `notification:new` socket event. Field-name fallbacks
// below are intentionally kept (existing behavior) — this type only
// documents the boundary, it does not enforce a stricter shape.
interface RawNotification {
  id?: string | number;
  type?: string;
  category?: string;
  title?: string;
  subject?: string;
  body?: string;
  message?: string;
  content?: string;
  createdAt?: string;
  time?: string;
  timestamp?: string;
  unread?: boolean;
  isRead?: boolean;
  // Only present on a live `notification:new` socket payload (H19) — see
  // lib/sendNotification.ts on the backend. Categories other than
  // "trip"/"trip_available"/"shuttle"/"promo" map to the generic 'system'
  // bucket above and never carry these, so it's harmless when absent.
  screen?: string;
  entityId?: number | string;
  deepLink?: string;
}

function mapApiNotif(n: RawNotification): Notification {
  const cat = (n.type ?? n.category ?? 'system').toLowerCase();
  const type: Notification['type'] =
    (cat === 'trip' || cat === 'trip_available' || cat === 'shuttle') ? 'trip'
    : cat === 'promo' ? 'promo'
    : 'system';
  return {
    id: String(n.id ?? Math.random()),
    type,
    title: n.title ?? n.subject ?? '',
    body: n.body ?? n.message ?? n.content ?? '',
    createdAt: n.createdAt ?? n.time ?? n.timestamp ?? '',
    unread: n.unread ?? (n.isRead === false),
    screen: n.screen,
    entityId: n.entityId,
    deepLink: n.deepLink,
  };
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketSetup = useRef(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/notifications');
      const list = Array.isArray(data) ? data : data.notifications ?? data.data ?? data.items ?? [];
      if (__DEV__ && list.length > 0) checkContract('Notification', list[0], NotificationItemSchema);
      setNotifications(list.map(mapApiNotif));
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load notifications';
      setError(msg);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    api.patch('/notifications/read-all').catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();

    if (socketSetup.current) return;
    socketSetup.current = true;

    // Named handlers defined here so cleanup can reference them synchronously.
    // The live socket payload is built by the backend's sendNotification(),
    // which mirrors the REST notification shape field-for-field (see its own
    // comment there) PLUS screen/entityId/deepLink navigation metadata that
    // GET /notifications never returns (H19 — those aren't persisted to the
    // notifications table). Mapping it directly and merging it into state —
    // instead of discarding it for a full re-fetch, which would immediately
    // overwrite this richer payload with the REST shape that lacks it — is
    // what keeps that metadata available for the tap handler in
    // app/notifications.tsx. Falls back to a re-fetch only if the payload is
    // missing/malformed.
    const onNotificationNew = (payload?: RawNotification) => {
      if (payload?.id == null) {
        fetchNotifications();
        return;
      }
      const notif = mapApiNotif(payload);
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)].slice(0, 100));
    };

    const onBoarded = (data: any) => {
      const boardedNotif: Notification = {
        id: String(data.bookingId ?? Math.random()),
        type: 'trip',
        title: 'Boarding confirmed',
        body: 'Your boarding has been scanned. Enjoy your ride!',
        createdAt: data.timestamp ?? new Date().toISOString(),
        unread: true,
      };
      // Capped: these socket-triggered prepends have no server-side bound,
      // so without a cap this list could grow for as long as the app session
      // lasts (unlike fetchNotifications(), which reflects whatever the
      // server returns).
      setNotifications((prev) => [boardedNotif, ...prev].slice(0, 100));
    };

    const onTripActivated = (data: any) => {
      const activatedNotif: Notification = {
        id: `trip-activated-${data.tripId ?? Math.random()}`,
        type: 'trip',
        title: '🚌 Your trip is now Active!',
        body: 'Minimum passengers reached — your shuttle trip has been confirmed and is now active.',
        createdAt: data.activatedAt ?? new Date().toISOString(),
        unread: true,
      };
      setNotifications((prev) => [activatedNotif, ...prev].slice(0, 100));

      Notifications.scheduleNotificationAsync({
        content: {
          title: '🚌 Your trip is now Active!',
          body: 'Minimum passengers reached — your shuttle trip has been confirmed and is now active.',
          sound: true,
          data: { tripId: data.tripId, type: 'trip_activated' },
        },
        trigger: null,
      }).catch(() => {});
    };

    // Resolved socket stored so cleanup is synchronous — no async in the return fn
    let resolvedSocket: ReturnType<typeof import('socket.io-client').io> | null = null;
    let isMounted = true;
    let onReconnect: (() => void) | null = null;

    (async () => {
      try {
        const socket = await getSocket();
        if (!isMounted) return;
        resolvedSocket = socket as any;

        socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
        socket.on(SOCKET_EVENTS.BOOKING_BOARDED, onBoarded);
        socket.on(SOCKET_EVENTS.TRIP_ACTIVATED, onTripActivated);

        // No-op: the backend already auto-joins the passenger's personal room on
        // every connect/reconnect from the auth handshake, so no join emit is needed here.
        onReconnect = async () => {};
        socket.on('connect', onReconnect as any);
      } catch {
        // Socket unavailable — graceful degradation, no polling fallback needed
      }
    })();

    return () => {
      isMounted = false;
      socketSetup.current = false; // allow re-registration on next mount
      if (resolvedSocket) {
        (resolvedSocket as any).off(SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
        (resolvedSocket as any).off(SOCKET_EVENTS.BOOKING_BOARDED, onBoarded);
        (resolvedSocket as any).off(SOCKET_EVENTS.TRIP_ACTIVATED, onTripActivated);
        if (onReconnect) (resolvedSocket as any).off('connect', onReconnect);
      }
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return { notifications, unreadCount, loading, error, markAllRead, refresh: fetchNotifications };
}
