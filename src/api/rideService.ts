/**
 * Ride Service — all passenger-facing ride (car / scooter / delivery) API
 * calls in one place, mirroring the shuttleService.ts pattern.
 *
 * Pure API-access layer: every function wraps exactly one endpoint with the
 * exact path and request body previously issued inline from useRide.ts,
 * useRideChat.ts, CarServiceScreen.tsx, and trip-tracking.tsx. Responses are
 * returned RAW (no envelope unwrapping) so callers keep their existing
 * `data?.data ?? data` handling unchanged.
 *
 * Base URL: EXPO_PUBLIC_API_URL. Protected routes send
 * Authorization: Bearer <token> via the Axios interceptor in client.ts.
 */

import api from './client';

export interface RideRequestPayload {
  type: 'car' | 'scooter' | 'delivery';
  pickup: { latitude: number; longitude: number; address?: string };
  dropoff: { latitude: number; longitude: number; address?: string };
  /** Real car-category slug (e.g. 'economy' | 'economy_plus' | 'comfort') for
   *  the passenger's selected tier — backend's /rides/request expects this
   *  exact field name (RequestRideBody.categorySlug). */
  categorySlug?: string;
  promoCode?: string;
  recipientName?: string;
  recipientPhone?: string;
  /** Defaults to 'cash' — preserves prior hardcoded behavior when omitted. */
  paymentMethod?: 'cash' | 'wallet';
}

/** GET /rides/:id — single ride snapshot (polling, reconnect recovery, deep links). */
export async function getRide(rideId: string | number): Promise<any> {
  const { data } = await api.get(`/rides/${rideId}`);
  return data;
}

/** GET /rides/active — the caller's current non-terminal ride, if any. */
export async function getActiveRide(): Promise<any> {
  const { data } = await api.get('/rides/active');
  return data;
}

/** GET /rides/estimate — price/ETA estimate for a pickup→dropoff pair. */
export async function getRideEstimate(
  pickup: { latitude: number; longitude: number },
  dropoff: { latitude: number; longitude: number },
  serviceType: 'car' | 'scooter' | 'delivery',
): Promise<any> {
  const { data } = await api.get('/rides/estimate', {
    params: {
      pickupLat: pickup.latitude, pickupLng: pickup.longitude,
      dropoffLat: dropoff.latitude, dropoffLng: dropoff.longitude,
      serviceType,
    },
  });
  return data;
}

/** POST /rides/request — request a new ride. Body construction moved verbatim from useRide.ts. */
export async function requestRide(payload: RideRequestPayload): Promise<any> {
  const { data } = await api.post('/rides/request', {
    vehicleType:        payload.type,
    pickupLatitude:     payload.pickup.latitude,
    pickupLongitude:    payload.pickup.longitude,
    pickupAddress:      payload.pickup.address ?? '',
    dropoffLatitude:    payload.dropoff.latitude,
    dropoffLongitude:   payload.dropoff.longitude,
    dropoffAddress:     payload.dropoff.address ?? '',
    paymentMethod:      payload.paymentMethod ?? 'cash',
    ...(payload.categorySlug ? { categorySlug: payload.categorySlug } : {}),
    ...(payload.promoCode ? { promoCode: payload.promoCode } : {}),
    ...(payload.recipientName ? { recipientName: payload.recipientName } : {}),
    ...(payload.recipientPhone ? { recipientPhone: payload.recipientPhone } : {}),
  });
  return data;
}

/** PATCH /rides/:id/cancel — cancel a ride, with an optional reason. */
export async function cancelRide(
  rideId: string | number,
  reason?: string,
): Promise<{ refundAmount?: number; cancellationFee?: number }> {
  const { data } = await api.patch(`/rides/${rideId}/cancel`, reason ? { reason } : {});
  const d = data?.data ?? data ?? {};
  return {
    refundAmount: typeof d.refundAmount === 'number' ? d.refundAmount : undefined,
    cancellationFee: typeof d.cancellationFee === 'number' ? d.cancellationFee : undefined,
  };
}

/** GET /rides/:id/messages — in-ride chat history. */
export async function getRideMessages(rideId: string | number): Promise<any> {
  const { data } = await api.get(`/rides/${rideId}/messages`);
  return data;
}

/** POST /rides/:id/messages — send an in-ride chat message (caller passes the already-trimmed text). */
export async function sendRideMessage(rideId: string | number, text: string): Promise<void> {
  await api.post(`/rides/${rideId}/messages`, { text });
}

/** POST /rides/:id/sos — durable passenger SOS on a ride (lat/lng required by the backend). */
export async function sendRideSos(
  rideId: string | number,
  body: { latitude?: number; longitude?: number; notes?: string; action?: string },
): Promise<any> {
  const { data } = await api.post(`/rides/${rideId}/sos`, body);
  return data;
}
