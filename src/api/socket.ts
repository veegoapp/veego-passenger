import { io, Socket } from 'socket.io-client';
import { tokenStore, registerSocketReconnect } from './client';
import { normalizeApiUrl } from './normalizeApiUrl';
import type { PassengerSessionSnapshotPayload } from '@/src/session/activeSessionTypes';

const _rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!_rawApiUrl) {
  console.warn('[VeeGo] EXPO_PUBLIC_API_URL is not set. Socket will not connect until BACKEND_URL is added to Replit Secrets.');
}

const _apiBase: string = normalizeApiUrl(_rawApiUrl);
// Socket-only: strip a trailing /api since socket.io connects at the host root.
const SOCKET_URL = _apiBase.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export type SocketConnectionState = 'connected' | 'connecting' | 'disconnected';
let connectionState: SocketConnectionState = 'disconnected';
const connectionListeners = new Set<(state: SocketConnectionState) => void>();

function setConnectionState(next: SocketConnectionState) {
  if (connectionState === next) return;
  connectionState = next;
  connectionListeners.forEach((listener) => listener(connectionState));
}

/** Current socket connection state, for screens that want to show a "reconnecting" indicator. */
export function getSocketConnectionState(): SocketConnectionState {
  return connectionState;
}

/** Subscribe to socket connection-state changes. Returns an unsubscribe function. */
export function onSocketConnectionChange(listener: (state: SocketConnectionState) => void): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;

  const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    path: '/api/socket.io',
    transports: ['websocket'],
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    timeout: 10000,
  });

  setConnectionState('connecting');
  socket.on('connect', () => setConnectionState('connected'));
  socket.on('disconnect', () => setConnectionState('disconnected'));
  socket.on('reconnect_attempt', () => setConnectionState('connecting'));
  socket.on('connect_error', (err) => {
    setConnectionState('disconnected');
    if (__DEV__) console.warn('[Socket] connection error:', err.message);
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
  setConnectionState('disconnected');
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

// Maps the backend's raw ride_status enum values (see rideStatusEnum in
// lib/db/src/schema/rides.ts: requested/searching/driver_assigned/
// driver_arrived/active/completed/cancelled) onto this app's RideStatus
// union. Single normalization boundary — any socket payload or REST
// response carrying a raw backend status string must pass through this
// before being assigned to RideState.status.
const BACKEND_TO_APP_RIDE_STATUS: Record<string, RideStatus> = {
  requested: 'searching',
  searching: 'searching',
  driver_assigned: 'driver_assigned',
  driver_arrived: 'arrived',
  active: 'started',
  completed: 'completed',
  cancelled: 'cancelled',
};

export function normalizeRideStatus(raw: string | null | undefined): RideStatus | undefined {
  if (!raw) return undefined;
  return BACKEND_TO_APP_RIDE_STATUS[raw];
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

// Note: this interface documents known socket event payload shapes for
// reference — it is not currently passed as a generic to `Socket<...>`, so
// it does not constrain any `socket.on`/`socket.off` call site today. Adding
// or widening entries here is inert with respect to existing behavior.
export interface RideSocketEvents {
  'ride:driver_assigned': (data: { rideId: string; driver: { name: string; phone: string; vehicle: string; rating: number }; eta: number }) => void;
  'ride:driver_location': (data: { rideId: string; location: DriverLocation }) => void;
  /** Canonical event name emitted by the backend when the driver arrives at pickup. */
  'ride:driver_arrived': (data: { rideId: string }) => void;
  'ride:started': (data: { rideId: string }) => void;
  'ride:completed': (data: { rideId: string; fare: number }) => void;
  'ride:cancelled': (data: { rideId: string; reason: string }) => void;
  'ride:driver_cancelled': (data: { rideId?: string; reason?: string }) => void;
  'ride:no_show_cancelled': (data: { rideId?: string; reason?: string }) => void;
  'ride:timeout': (data: { rideId: string }) => void;
  'notification:new': (data: { id: string; type: string; title: string; body: string; createdAt: string }) => void;
  'booking:boarded': (data: { bookingId: string | number; passengerId?: string | number; userId?: number; tripId?: number; timestamp?: string }) => void;
  // Shuttle live-tracking events (used by app/trip-detail.tsx, app/ticket.tsx,
  // app/(tabs)/trips.tsx) — shape reflects the superset of fields actually
  // read across those handlers.
  'shuttle:driver:location': (data: { tripId: string | number; driverId?: string | number; lat: number; lng: number; heading?: number }) => void;
  'shuttle:trip:status': (data: { tripId: string | number; status?: string; passengerCount?: number }) => void;
  'trip:activated': (data: { tripId: string | number; activatedAt?: string }) => void;
  'session:snapshot': (data: PassengerSessionSnapshotPayload) => void;
}
