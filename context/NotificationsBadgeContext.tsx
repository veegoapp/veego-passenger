import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '@/src/api/client';
import { getSocket } from '@/src/api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';

/**
 * App-wide unread-notification count, live-updated over the socket.
 *
 * Previously the only listener for `notification:new` lived inside the
 * Notifications screen itself (useNotifications) — a passenger sitting on
 * Home or Wallet when their trip was auto-cancelled got no in-app signal at
 * all until they happened to open Notifications. This mirrors the same
 * REST count Home already fetched once on mount, but keeps it live by
 * listening at the root, where the socket connection is already shared.
 */

type NotificationsBadgeContextValue = {
  unreadCount: number;
  refresh: () => void;
};

const NotificationsBadgeContext = createContext<NotificationsBadgeContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

export function NotificationsBadgeProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    api.get('/notifications?limit=20')
      .then(({ data }) => {
        if (!mountedRef.current) return;
        const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setUnreadCount(list.filter((n) => n.isRead === false).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    let cleanedUp = false;
    let resolvedSocket: Awaited<ReturnType<typeof getSocket>> | null = null;
    const onNotificationNew = () => refresh();

    getSocket().then((socket) => {
      if (cleanedUp) return;
      resolvedSocket = socket;
      socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
    }).catch(() => {});

    return () => {
      mountedRef.current = false;
      cleanedUp = true;
      resolvedSocket?.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
    };
  }, [refresh]);

  return (
    <NotificationsBadgeContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationsBadgeContext.Provider>
  );
}

export function useNotificationsBadge(): NotificationsBadgeContextValue {
  return useContext(NotificationsBadgeContext);
}
