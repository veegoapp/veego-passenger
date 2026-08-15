/**
 * User Service — passenger account/profile API calls in one place, mirroring
 * the shuttleService/rideService pattern.
 *
 * Pure API-access layer: every function wraps exactly one endpoint with the
 * exact path and request body previously issued inline from UI components
 * (profile modals, TermsModal, EmergencyContactModal, SafetySheet).
 * Responses are returned RAW so callers keep their existing handling.
 */

import api from './client';

/** GET /users/me/emergency-contact — the passenger's saved emergency contact (or null). */
export async function getEmergencyContact(): Promise<any> {
  const { data } = await api.get('/users/me/emergency-contact');
  return data;
}

/** PATCH /users/me/emergency-contact — save/update the emergency contact (caller passes trimmed values). */
export async function updateEmergencyContact(body: { name: string; phone: string }): Promise<any> {
  const { data } = await api.patch('/users/me/emergency-contact', body);
  return data;
}

/** GET /user/me/passenger-rating — the passenger's own average rating. */
export async function getPassengerRating(): Promise<any> {
  const { data } = await api.get('/user/me/passenger-rating');
  return data;
}

/** GET /user/ratings/given — ratings this passenger has given to drivers. */
export async function getGivenRatings(): Promise<any> {
  const { data } = await api.get('/user/ratings/given');
  return data;
}

/** PATCH /users/me/password — change the account password. */
export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch('/users/me/password', { currentPassword, newPassword });
}

/** GET /users/me/notifications — server-side notification preferences. */
export async function getNotificationPrefs(): Promise<any> {
  const { data } = await api.get('/users/me/notifications');
  return data;
}

/** PATCH /users/me/notifications — update a single notification preference field. */
export async function updateNotificationPrefs(patch: Record<string, boolean>): Promise<any> {
  const { data } = await api.patch('/users/me/notifications', patch);
  return data;
}

/** GET /terms/passenger — current passenger terms document (raw). */
export async function getPassengerTerms(): Promise<any> {
  const { data } = await api.get('/terms/passenger');
  return data;
}

/** POST /terms/accept — record acceptance of a passenger-terms version. */
export async function acceptPassengerTerms(version: number): Promise<void> {
  await api.post('/terms/accept', { app: 'passenger', version });
}

/** POST /support/tickets — open a support ticket. */
export async function createSupportTicket(issueType: string, message: string): Promise<any> {
  const { data } = await api.post('/support/tickets', { issueType, message });
  return data;
}

/**
 * POST /support/tickets — open a trip-linked support ticket.
 * Sends the booking/ride id and serviceType alongside the issue so ops can
 * look up the trip directly from the ticket. Auth token is added automatically
 * by the Axios request interceptor in client.ts.
 */
export async function createTripSupportTicket(body: {
  issueType: string;
  message: string;
  serviceType: 'shuttle' | 'car' | 'scooter' | 'delivery';
  bookingId?: string | number | null;
  rideId?: string | number | null;
}): Promise<any> {
  const { data } = await api.post('/support/tickets', body);
  return data;
}

/**
 * POST /support/tickets/:id/attachments — upload one attachment (caller builds the FormData).
 * Needs both transformRequest (stop axios from touching the FormData body)
 * and the explicit multipart Content-Type (override the `api` instance's
 * default 'application/json' header) — see the full explanation on the
 * avatar upload in app/(tabs)/profile.tsx. Without the header override this
 * silently fails as a generic "Network Error": RN's native networking layer
 * only serializes a FormData body into multipart when it sees a
 * 'multipart/form-data' Content-Type, and otherwise never sends the request.
 */
export async function uploadSupportAttachment(ticketId: string | number, form: FormData): Promise<void> {
  await api.post(`/support/tickets/${ticketId}/attachments`, form, {
    transformRequest: (data) => data,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
