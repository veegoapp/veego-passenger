/**
 * Ride Service — all passenger-facing ride (car / scooter / delivery) API
 * calls in one place, mirroring the shuttleService.ts pattern.
 *
 * Pure API-access layer: every function wraps exactly one endpoint with the
 * exact path and request body previously issued inline from useRide.ts,
 * useRideChat.ts, and CarServiceScreen.tsx. Responses are
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
  paymentMethod?: 'cash' | 'wallet' | 'instapay';
}

/** GET /rides/:id — single ride snapshot (polling, reconnect recovery, deep links). */
export async function getRide(rideId: string | number): Promise<any> {
  const { data } = await api.get(`/rides/${rideId}`);
  return data;
}

export interface RideMyTripsResponse {
  data: any[];
  meta: { total: number; page: number; limit: number };
}

/** GET /rides/my — passenger's ride (car/scooter/delivery) history, paginated. */
export async function getMyRides(page = 1, limit = 10): Promise<RideMyTripsResponse> {
  const { data } = await api.get('/rides/my', { params: { page, limit } });
  const meta = data?.meta ?? {};
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    meta: {
      total: Number(meta.total) || 0,
      page: Number(meta.page) || page,
      limit: Number(meta.limit) || limit,
    },
  };
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

/** PATCH /rides/:id/payment-method — switch payment method after a driver is
 *  assigned but before the trip completes. Backend rejects 'instapay' with a
 *  400 when the assigned driver doesn't have InstaPay enabled. */
export async function updatePaymentMethod(
  rideId: string | number,
  method: 'cash' | 'wallet' | 'instapay',
): Promise<any> {
  const { data } = await api.patch(`/rides/${rideId}/payment-method`, { paymentMethod: method });
  return data;
}

export interface InstapayInfo {
  link: string;
  qrDataUrl: string;
  paymentStatus: string;
}

/** GET /rides/:id/instapay — fallback fetch for the InstaPay link/QR/status
 *  (e.g. when the ride:completed socket payload was missed). */
export async function getInstapayInfo(rideId: string | number): Promise<InstapayInfo> {
  const { data } = await api.get(`/rides/${rideId}/instapay`);
  const d = data?.data ?? data ?? {};
  return { link: d.link, qrDataUrl: d.qrDataUrl, paymentStatus: d.paymentStatus };
}

/** POST /rides/:id/instapay/mark-paid — passenger declares they've sent the
 *  money; only valid while paymentStatus === "awaiting_payment". */
export async function markInstapayPaid(rideId: string | number): Promise<any> {
  const { data } = await api.post(`/rides/${rideId}/instapay/mark-paid`);
  return data;
}
