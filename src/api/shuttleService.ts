/**
 * Shuttle Service — all passenger-facing shuttle API calls in one place.
 * Aligned with Shuttle API Integration Report (June 2026).
 *
 * Base URL: EXPO_PUBLIC_API_URL (injected from BACKEND_URL Replit Secret)
 * All protected routes send Authorization: Bearer <token> via the Axios interceptor.
 */

import api from './client';
import type { DebtInfo } from '@/constants/data';
import { checkContract, DebtInfoSchema } from './schemas';

// ── Request / response types ─────────────────────────────────────

export interface CancelBookingResult {
  ok: boolean;
  bookingId: number;
  refunded: boolean;      // true only when a wallet credit was actually issued
  refundAmount: number;   // 0 when refunded is false (e.g. cash booking, or within 12h)
}

// ── Authenticated passenger endpoints ────────────────────────────

export interface ShuttleMyTripsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

/** GET /shuttle/my-trips — passenger's shuttle bookings (upcoming + history), paginated. */
export async function getMyTrips(page = 1, limit = 10): Promise<ShuttleMyTripsResponse> {
  const { data } = await api.get('/shuttle/my-trips', { params: { page, limit } });
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    total: Number(data?.total) || 0,
    page: Number(data?.page) || page,
    limit: Number(data?.limit) || limit,
  };
}

/**
 * DELETE /shuttle/bookings/:id — passenger self-cancel with 12-hour refund policy (§11.4, §21.3).
 * Preferred over deprecated PATCH /bookings/:id/cancel.
 *
 * Refund policy:
 *  Cancelled > 12h before departure → full wallet refund (refunded: true)
 *  Cancelled ≤ 12h before departure → no refund (refunded: false)
 *
 * Errors: 400 if already cancelled or boarded; 403 if not own booking; 404 if not found.
 */
export async function cancelBooking(bookingId: string | number): Promise<CancelBookingResult> {
  const { data } = await api.delete(`/shuttle/bookings/${bookingId}`);
  return data;
}

// ── Trip Requests ─────────────────────────────────────────────────

export type TripRequestDirection = 'one_way' | 'round_trip';

export interface SubmitTripRequestBody {
  routeId: string | number;
  direction: TripRequestDirection;
  outboundTime: string;  // "HH:MM"
  returnTime?: string;   // "HH:MM" — required if direction === 'round_trip'
}

export interface SubmitTripRequestResult {
  data: Record<string, unknown>;
  message: string;
  messageEn: string;
}

/**
 * GET /api/trip-requests/enabled-routes — returns the routes that have
 * requestsEnabled = true. Only IDs are used by the app for fast lookup.
 */
export async function getEnabledTripRequestRoutes(): Promise<Set<number>> {
  const { data } = await api.get('/api/trip-requests/enabled-routes');
  const list: any[] = Array.isArray(data) ? data : data.data ?? [];
  return new Set(list.map((r: any) => Number(r.id)));
}

/**
 * POST /api/trip-requests — passenger submits a trip request for a route.
 * Only works when requestsEnabled === true for the route.
 * Errors: 403 trip_requests_disabled, 400 validation.
 */
export async function submitTripRequest(body: SubmitTripRequestBody): Promise<SubmitTripRequestResult> {
  const { data } = await api.post('/api/trip-requests', body);
  return data;
}

/**
 * GET /shuttle/my-debt — passenger outstanding cash debt and offence count (§13.1).
 * Must be checked on app launch; show a prominent banner if hasDebt === true (§21.7).
 */
export async function getMyDebt(): Promise<DebtInfo> {
  const { data } = await api.get('/shuttle/my-debt');
  checkContract('Debt info', data, DebtInfoSchema);
  return data;
}

/** GET /shuttle/trips/:id/availability — live seat availability for a shuttle trip. */
export async function getTripAvailability(tripId: string | number) {
  const { data } = await api.get(`/shuttle/trips/${tripId}/availability`);
  return data;
}

/** POST /trips/:id/sos — durable passenger SOS on a shuttle trip (coords nullable). */
export async function sendTripSos(
  tripId: string | number,
  body: { latitude?: number | null; longitude?: number | null; notes?: string; action?: string },
): Promise<any> {
  const { data } = await api.post(`/trips/${tripId}/sos`, body);
  return data;
}

/** POST /shuttle/ratings — rate the driver after a completed shuttle trip. */
export async function submitShuttleRating(body: { tripId: number; rateeId: number; stars: number }): Promise<void> {
  await api.post('/shuttle/ratings', body);
}
