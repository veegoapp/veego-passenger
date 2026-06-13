/**
 * Shuttle Service — all passenger-facing shuttle API calls in one place.
 * Aligned with Shuttle API Integration Report (June 2026).
 *
 * Base URL: EXPO_PUBLIC_API_URL (injected from BACKEND_URL Replit Secret)
 * All protected routes send Authorization: Bearer <token> via the Axios interceptor.
 */

import api from './client';
import type { DebtInfo, ShuttleBookingMeta } from '@/constants/data';

// ── Request / response types ─────────────────────────────────────

export interface CreateBookingBody {
  tripId: number;
  seatCount: 1;          // shuttle rule: always exactly 1 (§11)
  promoCode?: string;
}

export interface CreateBookingResult {
  id: number;
  userId: number;
  tripId: number;
  seatCount: number;
  totalPrice: number;
  status: string;         // 'pending' | 'confirmed' — see §21.1
  paymentStatus: string;  // 'pending' | 'paid'
  promoCodeId: number | null;
  createdAt: string;
  updatedAt: string;
  shuttle: ShuttleBookingMeta; // real-time seat counts after booking (§2.10)
}

export interface CancelBookingResult {
  ok: boolean;
  bookingId: number;
  refunded: boolean;      // true if cancelled > 12h before departure
}

// ── Public endpoints (no auth required) ─────────────────────────

/** GET /shuttle/lines — list all active routes with trip counts & time-slots (§5.1) */
export async function getShuttleLines() {
  const { data } = await api.get('/shuttle/lines');
  return data;
}

/** GET /shuttle/lines/:id — route detail with stations + next 20 trips (§5.2) */
export async function getShuttleLine(id: string | number) {
  const { data } = await api.get(`/shuttle/lines/${id}`);
  return data;
}

/** GET /trips/:id — single trip detail (§10.2) */
export async function getTrip(tripId: string | number) {
  const { data } = await api.get(`/trips/${tripId}`);
  return data?.data ?? data;
}

/** GET /routes/:id/stations — ordered station list for a route (§7.1) */
export async function getRouteStations(routeId: string | number) {
  const { data } = await api.get(`/routes/${routeId}/stations`);
  return Array.isArray(data) ? data : data?.data ?? data?.stations ?? [];
}

// ── Authenticated passenger endpoints ────────────────────────────

/**
 * GET /users/me/bookings — complete booking history with embedded trip data (§11.5).
 * Replaces the deprecated /shuttle/my-trips endpoint.
 */
export async function getMyBookings() {
  const { data } = await api.get('/users/me/bookings');
  return Array.isArray(data) ? data : data?.data ?? data?.bookings ?? [];
}

/**
 * GET /bookings/:id — single booking (§11.2).
 * Response includes embedded trip data on most backends.
 */
export async function getBooking(bookingId: string | number) {
  const { data } = await api.get(`/bookings/${bookingId}`);
  return data?.data ?? data;
}

/**
 * POST /bookings — book a seat on a trip (§11.1).
 * Deducts wallet balance atomically. Returns booking + shuttle metadata block.
 *
 * Error codes to handle:
 *  400 — seatCount ≠ 1, trip unavailable, fully booked, insufficient wallet
 *  409 — duplicate booking or race condition (seats just taken)
 */
export async function createBooking(body: CreateBookingBody): Promise<CreateBookingResult> {
  const { data } = await api.post('/bookings', body);
  return data;
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

/**
 * GET /shuttle/my-debt — passenger outstanding cash debt and offence count (§13.1).
 * Must be checked on app launch; show a prominent banner if hasDebt === true (§21.7).
 */
export async function getMyDebt(): Promise<DebtInfo> {
  const { data } = await api.get('/shuttle/my-debt');
  return data;
}
