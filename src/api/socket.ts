import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { tokenStore, registerSocketReconnect } from './client';

const _rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!_rawApiUrl) {
  console.warn('[VeeGo] EXPO_PUBLIC_API_URL is not set. Socket will not connect until BACKEND_URL is added to Replit Secrets.');
}

// ✅ Same KEY=VALUE normalization as client.ts
const _normalized = (_rawApiUrl ?? '').includes('=')
  ? (_rawApiUrl ?? '').split('=').slice(1).join('=').trim()
  : (_rawApiUrl ?? '').trim();
const _apiBase: string = _normalized.startsWith('http')
  ? _normalized
  : _normalized
    ? `https://${_normalized}`
    : 'http://localhost:3000';
const SOCKET_URL = _apiBase.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;

  const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    path: '/api/socket.io',
    transports: Platform.OS === 'web' ? ['websocket', 'polling'] : ['websocket'],
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    timeout: 10000,
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] connection error:', err.message);
  });

  return socket;
}

export function getSocketSync(): Socket | null {
  return socket && socket.connected ? socket : null;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ✅ Call this after token refresh to reconnect with new token
export async function reconnectSocket(): Promise<void> {
  disconnectSocket();
  await getSocket();
}

// Register reconnect hook with client.ts so it fires on every token refresh
registerSocketReconnect(reconnectSocket);

export type RideStatus =
  | 'searching'
  | 'driver_assigned'
  | 'arrived'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'timeout';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

export interface RideSocketEvents {
  'ride:driver_assigned': (data: { rideId: string; driver: { name: string; phone: string; vehicle: string; rating: number }; eta: number }) => void;
  'ride:driver_location': (data: { rideId: string; location: DriverLocation }) => void;
  'ride:arrived': (data: { rideId: string }) => void;
  'ride:started': (data: { rideId: string }) => void;
  'ride:completed': (data: { rideId: string; fare: number }) => void;
  'ride:cancelled': (data: { rideId: string; reason: string }) => void;
  'ride:driver_cancelled': (data: { rideId?: string; reason?: string }) => void;
  'ride:no_show_cancelled': (data: { rideId?: string; reason?: string }) => void;
  'ride:timeout': (data: { rideId: string }) => void;
  'notification:new': (data: { id: string; type: string; title: string; body: string; createdAt: string }) => void;
  'booking:boarded': (data: { bookingId: string; passengerId?: string; timestamp: string }) => void;
}
