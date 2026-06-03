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

    getSocket().then((socket) => {
      socket.on('notification:new', (data: any) => {
        setNotifications((prev) => [mapApiNotif({ ...data, unread: true }), ...prev]);
      });
    }).catch(() => {});

    return () => {
      getSocket().then((socket) => {
        socket.off('notification:new');
      }).catch(() => {});
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return { notifications, unreadCount, loading, error, markAllRead, refresh: fetchNotifications };
}
