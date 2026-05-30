import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const _rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!_rawApiUrl) {
  throw new Error(
    '[VeeGo] EXPO_PUBLIC_API_URL is not set. ' +
    'Create a .env file in artifacts/passenger-app/ with:\n' +
    '  EXPO_PUBLIC_API_URL=https://<your-replit-domain>/api'
  );
}
const BASE_URL: string = _rawApiUrl.startsWith('http') ? _rawApiUrl : `https://${_rawApiUrl}`;

console.log('[VeeGo] API base URL:', BASE_URL);

const TOKEN_KEY = 'veego_access_token';
const REFRESH_KEY = 'veego_refresh_token';

async function getToken(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setToken(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

async function removeToken(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

export const tokenStore = { getToken, setToken, removeToken, TOKEN_KEY, REFRESH_KEY };

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const fullUrl = `${config.baseURL ?? BASE_URL}${config.url ?? ''}`;
  console.log(`[API] --> ${config.method?.toUpperCase()} ${fullUrl}`);
  if (config.data) {
    const safeData = { ...config.data };
    if (safeData.password) safeData.password = '***';
    console.log('[API] --> payload:', JSON.stringify(safeData));
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API] <-- ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '?';
    const body = error.response?.data;
    console.warn(`[API] <-- ERROR ${status} ${url}:`, JSON.stringify(body ?? error.message));

    const originalRequest = error.config;
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
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        refreshQueue = [];
        await removeToken(TOKEN_KEY);
        await removeToken(REFRESH_KEY);
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
