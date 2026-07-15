import { useState, useEffect, useRef, useCallback } from 'react';
import { getRideMessages, sendRideMessage } from '../../api/rideService';
import { getSocket } from '../../api/socket';

export interface ChatMessage {
  id: string;
  text: string;
  isDriver: boolean;
  time: string;
}

function formatTime(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function normalizeMessages(raw: any[]): ChatMessage[] {
  return raw.map((m, i) => ({
    id: m.id ?? String(i),
    text: m.text ?? m.message ?? m.content ?? '',
    isDriver: m.senderRole === 'driver' || m.isDriver === true,
    time: formatTime(m.sentAt ?? m.createdAt),
  }));
}

export function useRideChat(tripId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const listenerRef = useRef(false);

  useEffect(() => {
    if (!tripId) { setMessages([]); return; }
    getRideMessages(tripId)
      .then((data) => {
        const raw: any[] =
          data?.data ?? data?.messages ?? (Array.isArray(data) ? data : []);
        setMessages(normalizeMessages(raw));
      })
      .catch(() => {});
  }, [tripId]);

  useEffect(() => {
    if (!tripId || listenerRef.current) return;
    listenerRef.current = true;

    const handler = (data: any) => {
      if (String(data.rideId) !== String(tripId)) return;
      const isDriver = data.senderRole === 'driver' || data.isDriver === true;
      // A ride has exactly one passenger — any non-driver message on this ride's
      // socket event is always an echo of a message this same user already
      // added optimistically in sendMessage(), so skip it to avoid a duplicate.
      if (!isDriver) return;
      setMessages((prev) => [
        ...prev,
        {
          id: data.id ?? String(Date.now()),
          text: data.text ?? data.message ?? data.content ?? '',
          isDriver,
          time: formatTime(data.sentAt ?? data.createdAt),
        },
      ]);
    };

    getSocket().then((socket) => {
      socket.on('ride:message:new', handler);
    }).catch(() => {});

    return () => {
      getSocket().then((socket) => {
        socket.off('ride:message:new', handler);
      }).catch(() => {});
      listenerRef.current = false;
    };
  }, [tripId]);

  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!tripId || !text.trim() || sending) return false;
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    setMessages((prev) => [...prev, { id: tempId, text: text.trim(), isDriver: false, time: timeStr }]);

    try {
      await sendRideMessage(tripId, text.trim());
      return true;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return false;
    } finally {
      setSending(false);
    }
  }, [tripId, sending]);

  return { messages, sending, sendMessage };
}
