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
// In-flight connection attempt, shared by concurrent getSocket() callers.
// Without this, two callers seeing `socket === null` at the same time (e.g.
// ActiveSessionContext's init and useRide's setupSocketListeners) would each
// create their own io() instance — the second one's `if (socket) socket.
// disconnect()` would tear down the first caller's still-being-set-up
// socket, orphaning its listeners on a dead instance.
let connectPromise: Promise<Socket> | null = null;

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

  // Coalesce concurrent callers onto the same in-flight connection attempt
  // instead of each racing to create/replace the socket.
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      if (socket) {
        socket.disconnect();
        socket = null;
      }

      const s = io(SOCKET_URL, {
        path: '/api/socket.io',
        transports: ['websocket'],
        // Fetch the freshest token on EVERY (re)connection attempt instead of
        // capturing a single token at creation time. socket.io reuses the
        // initial `auth` object for all of its own built-in reconnections, so a
        // static token that expired mid-ride made every reconnect attempt fail
        // auth on the server — exhausting reconnectionAttempts and leaving the
        // socket permanently dead ("Reconnecting…" that never clears, no
        // ride:started/completed/cancelled events, a frozen trip screen). As a
        // function it is re-invoked before each attempt and picks up the token
        // the REST layer's 401→refresh flow rotated into secure storage.
        auth: async (cb: (data: Record<string, unknown>) => void) => {
          try {
            const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);
            cb(token ? { token } : {});
          } catch {
            cb({});
          }
        },
        reconnection: true,
        // Never permanently give up. Combined with the fresh-token `auth` above,
        // the socket keeps retrying with exponential backoff and self-heals as
        // soon as a valid token / working network is available, instead of
        // freezing on a stuck "Reconnecting…" banner after 10 stale-token
        // failures (reconnect_failed, which nothing was recovering from).
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 8000,
        timeout: 10000,
      });

      setConnectionState('connecting');
      s.on('connect', () => setConnectionState('connected'));
      s.on('disconnect', () => setConnectionState('disconnected'));
      s.on('reconnect_attempt', () => setConnectionState('connecting'));
      s.on('connect_error', (err) => {
        setConnectionState('disconnected');
        if (__DEV__) console.warn('[Socket] connection error:', err.message);
      });

      socket = s;
      return s;
    } finally {
      // Cleared regardless of success/failure so a later (non-concurrent)
      // call — e.g. after this socket disconnects again — starts a fresh
      // attempt rather than reusing a resolved/rejected promise forever.
      connectPromise = null;
    }
  })();

  return connectPromise;
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
  /** Raw ground speed in metres/second, forwarded by the backend from the
   *  driver's enriched ride payload. Optional/inert today — reserved for the
   *  later heading-smoothing / dead-reckoning phases. */
  speed?: number;
  /** Horizontal accuracy in metres. Optional/inert today — reserved for
   *  accuracy-gating in a later phase. */
  accuracy?: number;
  /** Driver DEVICE GPS fix time, epoch ms. Optional/inert today — the tracking
   *  buffer paces on local arrival time in Phase 3A; this is reserved for
   *  timestamp-based interpolation in a later phase. */
  timestamp?: number;
  /** Epoch ms the server recorded this position at, when known (e.g. from an
   *  ActiveSession snapshot's driver.location.updatedAt). Absent for raw live
   *  socket ticks, which are inherently "now" by virtue of just arriving. */
  updatedAtMs?: number;
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
