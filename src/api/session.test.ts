jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./client', () => ({
  tokenStore: {
    TOKEN_KEY: 'veego_access_token',
    REFRESH_KEY: 'veego_refresh_token',
    setToken: jest.fn().mockResolvedValue(undefined),
  },
}));

import * as SecureStore from 'expo-secure-store';
import { tokenStore } from './client';
import { saveSession, clearSession, persistTokens, SESSION_KEY } from './session';

const mockedSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;
const mockedSetToken = tokenStore.setToken as jest.Mock;

describe('saveSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists identifier, name, and a loggedInAt timestamp under the session key', async () => {
    const before = Date.now();
    await saveSession('user-1', 'Sara');
    const after = Date.now();

    expect(mockedSetItemAsync).toHaveBeenCalledTimes(1);
    const [key, value] = mockedSetItemAsync.mock.calls[0];
    expect(key).toBe(SESSION_KEY);
    const parsed = JSON.parse(value);
    expect(parsed.identifier).toBe('user-1');
    expect(parsed.name).toBe('Sara');
    expect(parsed.loggedInAt).toBeGreaterThanOrEqual(before);
    expect(parsed.loggedInAt).toBeLessThanOrEqual(after);
  });

  it('falls back to an empty name when none is given', async () => {
    await saveSession('user-2');

    const [, value] = mockedSetItemAsync.mock.calls[0];
    expect(JSON.parse(value).name).toBe('');
  });

  it('does not throw when SecureStore write fails', async () => {
    mockedSetItemAsync.mockRejectedValueOnce(new Error('disk full'));

    await expect(saveSession('user-3')).resolves.toBeUndefined();
  });
});

describe('clearSession', () => {
  it('deletes the session record', async () => {
    await clearSession();
    expect(mockedDeleteItemAsync).toHaveBeenCalledWith(SESSION_KEY);
  });
});

describe('persistTokens', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads accessToken/refreshToken in the primary (camelCase) shape', async () => {
    const result = await persistTokens({ accessToken: 'a1', refreshToken: 'r1' });

    expect(result).toEqual({ accessToken: 'a1', refreshToken: 'r1' });
    expect(mockedSetToken).toHaveBeenCalledWith(tokenStore.TOKEN_KEY, 'a1');
    expect(mockedSetToken).toHaveBeenCalledWith(tokenStore.REFRESH_KEY, 'r1');
  });

  it('falls back to snake_case field names', async () => {
    const result = await persistTokens({ access_token: 'a2', refresh_token: 'r2' });

    expect(result).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('falls back to a bare "token" field for the access token', async () => {
    const result = await persistTokens({ token: 'a3' });

    expect(result.accessToken).toBe('a3');
  });

  it('does not persist a refresh token when none is present in the response', async () => {
    await persistTokens({ accessToken: 'a4' });

    expect(mockedSetToken).toHaveBeenCalledTimes(1);
    expect(mockedSetToken).toHaveBeenCalledWith(tokenStore.TOKEN_KEY, 'a4');
  });

  it('does not persist anything when the response has neither token field', async () => {
    await persistTokens({ user: { id: 1 } });

    expect(mockedSetToken).not.toHaveBeenCalled();
  });
});
