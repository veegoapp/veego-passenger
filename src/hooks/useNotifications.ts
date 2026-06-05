import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import { getSocket } from '../api/socket';
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

    (async () => {
      try {
        const socket = await getSocket();

        // Join the passenger-specific room for real-time shuttle events
        // room: passenger:<userId>  (per API contract §7 Real-time Updates)
        const userId = await fetchUserId();
        if (userId) {
          socket.emit('join', `passenger:${userId}`);
        }

        // notification:new — trip cancelled (with refund) or other server push
        socket.on('notification:new', (data: any) => {
          setNotifications((prev) => [mapApiNotif({ ...data, unread: true }), ...prev]);
        });

        // booking:boarded — passenger scanned/boarded by driver
        socket.on('booking:boarded', (data: any) => {
          const boardedNotif: Notification = {
            id: String(data.bookingId ?? Math.random()),
            type: 'trip',
            title: 'Boarding confirmed',
            body: 'Your boarding has been scanned. Enjoy your ride!',
            createdAt: data.timestamp ?? new Date().toISOString(),
            unread: true,
          };
          setNotifications((prev) => [boardedNotif, ...prev]);
        });
      } catch {
        // Socket unavailable — graceful degradation
      }
    })();

    return () => {
      getSocket().then((socket) => {
        socket.off('notification:new');
        socket.off('booking:boarded');
      }).catch(() => {});
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return { notifications, unreadCount, loading, error, markAllRead, refresh: fetchNotifications };
}
