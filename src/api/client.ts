import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { router } from 'expo-router';

const _rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!_rawApiUrl) {
  console.warn(
    '[VeeGo] EXPO_PUBLIC_API_URL is not set. ' +
    'Add BACKEND_URL to Replit Secrets to connect to a real backend.'
  );
}
const _normalizedUrl = (_rawApiUrl ?? '').includes('=')
  ? (_rawApiUrl ?? '').split('=').slice(1).join('=').trim()
  : (_rawApiUrl ?? '').trim();
const BASE_URL: string = _normalizedUrl.startsWith('http')
  ? _normalizedUrl
  : _normalizedUrl
    ? `https://${_normalizedUrl}`
    : 'http://localhost:3000';

const TOKEN_KEY = 'veego_access_token';
const REFRESH_KEY = 'veego_refresh_token';

async function getToken(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null; // Web uses httpOnly cookies; tokens not stored client-side
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setToken(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return; // Web: server sets httpOnly cookies on login
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

async function removeToken(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return; // Web: call POST /auth/logout to clear server-side cookie
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

export const tokenStore = { getToken, setToken, removeToken, TOKEN_KEY, REFRESH_KEY };

let _socketReconnect: (() => Promise<void>) | null = null;
export function registerSocketReconnect(fn: () => Promise<void>): void {
  _socketReconnect = fn;
}

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: Platform.OS === 'web', // send httpOnly cookies on web
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const status = error.response?.status;
    const reason = error.response?.data?.reason ?? error.response?.data?.code ?? '';
    const originalRequest = error.config;

    // Fix 8: Account suspended — block navigation entirely
    if (status === 403 && reason === 'account_suspended') {
      router.replace('/suspended' as any);
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = await getToken(REFRESH_KEY);
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newAccessToken = data.accessToken ?? data.access_token ?? data.token;
        await setToken(TOKEN_KEY, newAccessToken);
        refreshQueue.forEach((cb) => cb(newAccessToken));
        refreshQueue = [];
        if (_socketReconnect) { _socketReconnect().catch(() => {}); }
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        refreshQueue = [];
        await removeToken(TOKEN_KEY);
        await removeToken(REFRESH_KEY);
        const rfBody = refreshError?.response?.data ?? {};
        if (refreshError?.response?.status === 403 && rfBody.requiresOtp) {
          // Phone not yet verified — redirect to OTP screen silently
          router.replace({ pathname: '/verify-phone', params: { phone: rfBody.phone, maskedPhone: rfBody.maskedPhone ?? rfBody.phone } } as any);
        } else {
          router.replace('/auth');
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
