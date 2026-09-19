// client.ts builds its axios instance (and registers interceptors) at
// import time. Babel hoists ES `import` statements above other top-level
// statements when compiling to CommonJS, so a jest.mock() factory here must
// be fully self-contained (no closures over outer `const`s) — otherwise
// `./client`'s module-level `axios.create()` call can run before an outer
// variable it reads has been assigned. The mock instance/spies are
// therefore attached to the mocked module itself and pulled back out via
// `require('axios')` below.
jest.mock('axios', () => {
  const mockRequestInterceptors: Array<(config: any) => any> = [];
  const mockResponseInterceptors: Array<{ onFulfilled: (r: any) => any; onRejected: (e: any) => any }> = [];
  const mockAxiosPost = jest.fn();
  const mockAxiosInstance: any = jest.fn((config: any) => mockAxiosInstance._retryImpl(config));
  mockAxiosInstance.interceptors = {
    request: { use: (fn: any) => mockRequestInterceptors.push(fn) },
    response: { use: (onFulfilled: any, onRejected: any) => mockResponseInterceptors.push({ onFulfilled, onRejected }) },
  };
  mockAxiosInstance._retryImpl = (_config: any) => Promise.resolve({ data: {} });

  return {
    __esModule: true,
    default: {
      create: () => mockAxiosInstance,
      post: (...args: any[]) => mockAxiosPost(...args),
    },
    __mock: { mockRequestInterceptors, mockResponseInterceptors, mockAxiosPost, mockAxiosInstance },
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { tokenStore } from './client';

const { mockRequestInterceptors, mockResponseInterceptors, mockAxiosPost, mockAxiosInstance } =
  (jest.requireMock('axios') as any).__mock;

const mockedGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockedReplace = router.replace as jest.Mock;

function runRequestInterceptor(config: any = { headers: {} }) {
  return mockRequestInterceptors[0](config);
}

function runResponseErrorInterceptor(error: any) {
  return mockResponseInterceptors[0].onRejected(error);
}

describe('api client request interceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance._retryImpl = (_config: any) => Promise.resolve({ data: {} });
  });

  it('attaches a bearer token from SecureStore when present', async () => {
    mockedGetItemAsync.mockResolvedValue('stored-token');

    const config = await runRequestInterceptor({ headers: {} });

    expect(config.headers['Authorization']).toBe('Bearer stored-token');
  });

  it('leaves the Authorization header unset when no token is stored', async () => {
    mockedGetItemAsync.mockResolvedValue(null);

    const config = await runRequestInterceptor({ headers: {} });

    expect(config.headers['Authorization']).toBeUndefined();
  });
});

describe('api client response interceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance._retryImpl = (_config: any) => Promise.resolve({ data: {} });
  });

  it('redirects to /suspended on a 403 account_suspended error without attempting a refresh, carrying the suspension reason', async () => {
    const error = {
      response: { status: 403, data: { reason: 'account_suspended', suspensionReason: 'low_rating_threshold' } },
      config: { headers: {} },
    };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(mockedReplace).toHaveBeenCalledWith({ pathname: '/suspended', params: { reason: 'low_rating_threshold' } });
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('redirects to /suspended with an empty reason when the body omits suspensionReason', async () => {
    const error = {
      response: { status: 403, data: { reason: 'account_suspended' } },
      config: { headers: {} },
    };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(mockedReplace).toHaveBeenCalledWith({ pathname: '/suspended', params: { reason: '' } });
  });

  it('does not redirect for a 403 with an unrelated reason', async () => {
    const error = {
      response: { status: 403, data: { reason: 'forbidden' } },
      config: { headers: {} },
    };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(mockedReplace).not.toHaveBeenCalledWith('/suspended');
  });

  it('refreshes the access token on 401 and retries the original request once', async () => {
    mockedGetItemAsync.mockResolvedValue('old-refresh-token');
    mockAxiosPost.mockResolvedValue({ data: { accessToken: 'new-access-token' } });
    mockAxiosInstance._retryImpl = (config: any) => Promise.resolve({ data: 'retried', headers: config.headers });

    const originalRequest: any = { headers: {}, _retry: false };
    const error = { response: { status: 401 }, config: originalRequest };

    const result = await runResponseErrorInterceptor(error);

    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      { refreshToken: 'old-refresh-token' },
    );
    expect(originalRequest._retry).toBe(true);
    expect(originalRequest.headers['Authorization']).toBe('Bearer new-access-token');
    expect((result as any).data).toBe('retried');
  });

  it('does not retry a request that already failed once (avoids infinite refresh loop)', async () => {
    const originalRequest: any = { headers: {}, _retry: true };
    const error = { response: { status: 401 }, config: originalRequest };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('clears tokens and redirects to /auth when the refresh token itself is rejected', async () => {
    mockedGetItemAsync.mockResolvedValue('bad-refresh-token');
    mockAxiosPost.mockRejectedValue({ response: { status: 401, data: {} } });

    const originalRequest: any = { headers: {}, _retry: false };
    const error = { response: { status: 401 }, config: originalRequest };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(tokenStore.TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(tokenStore.REFRESH_KEY);
    expect(mockedReplace).toHaveBeenCalledWith('/auth');
  });

  it('redirects to /verify-phone (not /auth) when the refresh rejection requires OTP', async () => {
    mockedGetItemAsync.mockResolvedValue('bad-refresh-token');
    mockAxiosPost.mockRejectedValue({
      response: { status: 403, data: { requiresOtp: true, phone: '+201234567890' } },
    });

    const originalRequest: any = { headers: {}, _retry: false };
    const error = { response: { status: 401 }, config: originalRequest };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(mockedReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/verify-phone' }),
    );
    expect(mockedReplace).not.toHaveBeenCalledWith('/auth');
  });

  it('does NOT clear tokens when the refresh call fails with a transient network/server error', async () => {
    mockedGetItemAsync.mockResolvedValue('refresh-token');
    mockAxiosPost.mockRejectedValue(new Error('network down'));

    const originalRequest: any = { headers: {}, _retry: false };
    const error = { response: { status: 401 }, config: originalRequest };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('propagates a non-401/403 error unchanged', async () => {
    const error = { response: { status: 500 }, config: { headers: {} } };

    await expect(runResponseErrorInterceptor(error)).rejects.toBe(error);

    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });
});
