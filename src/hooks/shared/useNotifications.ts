import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
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
}

function mapApiNotif(n: RawNotification): Notification {
  const cat = (n.type ?? n.category ?? 'system').toLowerCase();
  return {
    id: String(n.id ?? Math.random()),
    type: (cat === 'trip' || cat === 'promo' || cat === 'system') ? cat as any : 'system',
    title: n.title ?? n.subject ?? '',
    body: n.body ?? n.message ?? n.content ?? '',
    createdAt: n.createdAt ?? n.time ?? n.timestamp ?? '',
    unread: n.unread ?? (n.isRead === false),
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
    // REST GET /notifications remains the source of truth for full notification
    // objects — the socket event only signals that something changed, so we
    // re-fetch rather than splice a partial socket payload into the list.
    const onNotificationNew = () => {
      fetchNotifications();
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

        socket.on('notification:new', onNotificationNew);
        socket.on('booking:boarded', onBoarded);
        socket.on('trip:activated', onTripActivated);

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
        (resolvedSocket as any).off('notification:new', onNotificationNew);
        (resolvedSocket as any).off('booking:boarded', onBoarded);
        (resolvedSocket as any).off('trip:activated', onTripActivated);
        if (onReconnect) (resolvedSocket as any).off('connect', onReconnect);
      }
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return { notifications, unreadCount, loading, error, markAllRead, refresh: fetchNotifications };
}
