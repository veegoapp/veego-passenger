// Single shared home for session/token persistence helpers.
//
// Consolidates logic that used to be independently duplicated in
// app/index.tsx, app/verify-phone.tsx, and components/auth/shared.tsx.
// Storage key and JSON shape are unchanged from those prior copies —
// this file is a move, not a redesign.
import * as SecureStore from 'expo-secure-store';
import { tokenStore } from './client';
import { AuthTokenResponseSchema, checkContract } from './schemas';

export const SESSION_KEY = '@veego_session_v1';

/**
 * Persists the lightweight session record (identifier/name/loggedInAt) used
 * to restore a "logged in" UI state without decoding the JWT everywhere.
 * Same key and JSON shape as the previous per-screen copies.
 */
export async function saveSession(identifier: string, name?: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify({ identifier, name: name || '', loggedInAt: Date.now() }),
    );
  } catch (err: any) {
    console.error('[session] saveSession failed', err?.message);
  }
}

/** Removes the session record (used on logout / failed refresh). */
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

/**
 * Persists access/refresh tokens from an auth response into SecureStore via
 * tokenStore. Field-name fallbacks (accessToken/access_token/token, etc.)
 * match the previous per-screen copies exactly.
 */
export async function persistTokens(data: any): Promise<{ accessToken?: string; refreshToken?: string }> {
  checkContract('Auth token', data, AuthTokenResponseSchema);
  const accessToken = data.accessToken ?? data.access_token ?? data.token;
  const refreshToken = data.refreshToken ?? data.refresh_token;
  if (accessToken) await tokenStore.setToken(tokenStore.TOKEN_KEY, accessToken);
  if (refreshToken) await tokenStore.setToken(tokenStore.REFRESH_KEY, refreshToken);
  return { accessToken, refreshToken };
}
