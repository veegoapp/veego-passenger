/**
 * Places Service — backend-proxied Google Places Autocomplete + Details.
 * Mirrors the shuttleService.ts pattern: thin wrappers, no Google key ever
 * touches the app bundle (the backend holds it server-side).
 */

import api from './client';

export interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PlaceAutocompleteBias {
  lat?: number;
  lng?: number;
  radius?: number;
}

/** GET /places/autocomplete — session-token-scoped suggestions for the typed text. */
export async function getPlaceAutocomplete(
  input: string,
  sessionToken: string,
  lang: 'en' | 'ar',
  bias?: PlaceAutocompleteBias,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const { data } = await api.get('/places/autocomplete', {
    params: {
      input,
      sessiontoken: sessionToken,
      lang,
      ...(bias?.lat != null ? { lat: bias.lat } : {}),
      ...(bias?.lng != null ? { lng: bias.lng } : {}),
      ...(bias?.radius != null ? { radius: bias.radius } : {}),
    },
    signal,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

/** GET /places/details — resolves a placeId (same session as the autocomplete call) to final coordinates. */
export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails | null> {
  const { data } = await api.get('/places/details', {
    params: { placeId, sessiontoken: sessionToken },
  });
  return data?.data ?? null;
}

/**
 * Lightweight UUID v4-shaped generator for the autocomplete session token.
 * No crypto/uuid dependency needed — the token only needs to be unique
 * enough to scope one search session for Google's session-token billing,
 * not cryptographically secure.
 */
export function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
