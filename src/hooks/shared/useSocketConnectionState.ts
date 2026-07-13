import { useEffect, useState } from 'react';
import { getSocketConnectionState, onSocketConnectionChange, type SocketConnectionState } from '@/src/api/socket';

/**
 * Subscribes to the socket's connection state (connected / connecting / disconnected)
 * so screens can show a lightweight "reconnecting" indicator. Read-only — does not
 * touch socket event contracts or connection logic, which live in src/api/socket.ts.
 */
export function useSocketConnectionState(): SocketConnectionState {
  const [state, setState] = useState<SocketConnectionState>(getSocketConnectionState());

  useEffect(() => {
    setState(getSocketConnectionState());
    return onSocketConnectionChange(setState);
  }, []);

  return state;
}
