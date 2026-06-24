import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import type { Notification } from '@/constants/data';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAllRead: () => void;
  refresh: () => void;
}

function mapApiNotif(n: any): Notification {
  const cat = (n.type ?? n.category ?? 'system').toLowerCase();
  return {
    id: String(n.id ?? n._id ?? Math.random()),
    type: (cat === 'trip' || cat === 'promo' || cat === 'system') ? cat as any : 'system',
    title: n.title ?? n.subject ?? '',
    body: n.body ?? n.message ?? n.content ?? '',
    createdAt: n.createdAt ?? n.created_at ?? n.time ?? n.timestamp ?? '',
    unread: n.unread ?? (n.isRead === false) ?? (n.is_read === false) ?? false,
  };
}

async function fetchUserId(): Promise<number | null> {
  try {
    const { data } = await api.get('/users/me');
    const d = data.user ?? data.profile ?? data;
    return d.id ?? d.userId ?? d.user_id ?? null;
  } catch {
    return null;
  }
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

    // Named handlers defined here so cleanup can reference them synchronously
    const onNotificationNew = (data: any) => {
      setNotifications((prev) => [mapApiNotif({ ...data, unread: true }), ...prev]);
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
      setNotifications((prev) => [boardedNotif, ...prev]);
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
      setNotifications((prev) => [activatedNotif, ...prev]);

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

        // Join the passenger-specific room
        const userId = await fetchUserId();
        if (!isMounted) return;
        if (userId) socket.emit('join', `passenger:${userId}`);

        socket.on('notification:new', onNotificationNew);
        socket.on('booking:boarded', onBoarded);
        socket.on('trip:activated', onTripActivated);

        // Re-join room after socket reconnects (e.g. network recovery)
        onReconnect = async () => {
          const uid = await fetchUserId();
          if (uid && resolvedSocket) (resolvedSocket as any).emit('join', `passenger:${uid}`);
        };
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
