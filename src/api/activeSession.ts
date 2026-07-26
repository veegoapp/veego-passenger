import api from './client';
import type {
  PassengerActiveSession,
  PassengerActiveSessionResponse,
} from '@/src/session/activeSessionTypes';

/**
 * The existing Axios base URL may already include `/api`. Build the relative
 * request path accordingly so the final URL is always `/api/passenger/session`
 * and never `/api/api/passenger/session` or `/passenger/session`.
 */
export function getPassengerSessionPath(baseUrl: string | undefined = api.defaults.baseURL): string {
  const path = (baseUrl ?? '').split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return /(?:^|\/)api$/.test(path) ? '/passenger/session' : '/api/passenger/session';
}

export async function fetchPassengerActiveSession(): Promise<PassengerActiveSession | null> {
  const response = await api.get<PassengerActiveSessionResponse>(
    getPassengerSessionPath(),
  );
  return response.data.data;
}