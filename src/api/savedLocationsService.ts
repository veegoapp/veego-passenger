/**
 * Saved Locations Service — passenger-managed saved places (Home/Work/Other).
 * Mirrors the shuttleService.ts pattern: thin wrappers around one endpoint each.
 *
 * Note: the Home screen's own read of GET /user/locations
 * (app/(tabs)/index.tsx's fetchSavedLocations) is left untouched — it already
 * works and isn't required to route through this file. This service exists
 * for the new saved-locations management UI (create/update/delete), and for
 * that screen's own list fetch.
 */

import api from './client';

export interface SavedLocationPayload {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  label?: string;
  isDefault?: boolean;
}

export interface SavedLocationRecord extends SavedLocationPayload {
  id: string | number;
}

function normalizeSavedLocation(item: any): SavedLocationRecord {
  return {
    id: item?.id,
    name: item?.name ?? item?.label ?? '',
    address: item?.address ?? '',
    latitude: item?.latitude ?? 0,
    longitude: item?.longitude ?? 0,
    label: item?.label,
    isDefault: item?.isDefault ?? false,
  };
}

/** GET /user/locations — list the passenger's saved places. */
export async function getSavedLocations(): Promise<SavedLocationRecord[]> {
  const { data } = await api.get('/user/locations');
  const raw: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return raw.map(normalizeSavedLocation);
}

/** POST /user/locations — create a saved place. */
export async function createSavedLocation(payload: SavedLocationPayload): Promise<SavedLocationRecord> {
  const { data } = await api.post('/user/locations', payload);
  return normalizeSavedLocation(data?.data ?? data);
}

/** PATCH /user/locations/:id — update a saved place. */
export async function updateSavedLocation(
  id: string | number,
  payload: Partial<SavedLocationPayload>,
): Promise<SavedLocationRecord> {
  const { data } = await api.patch(`/user/locations/${id}`, payload);
  return normalizeSavedLocation(data?.data ?? data);
}

/** DELETE /user/locations/:id — remove a saved place. */
export async function deleteSavedLocation(id: string | number): Promise<void> {
  await api.delete(`/user/locations/${id}`);
}
