import { renderHook, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import api from '../../api/client';
import { useTheme } from '@/context/ThemeContext';
import { maybePromptBatteryOptimization } from './batteryOptimization';
import { usePushToken } from './usePushToken';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('./batteryOptimization', () => ({
  maybePromptBatteryOptimization: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

const mockedPost = api.post as jest.Mock;
const mockedUseTheme = useTheme as jest.Mock;
const mockedGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockedRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockedGetToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockedPrompt = maybePromptBatteryOptimization as jest.Mock;

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

describe('usePushToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseTheme.mockReturnValue({ t: (key: string) => `t:${key}` });
    mockedGetPermissions.mockResolvedValue({ status: 'granted' });
    mockedGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    mockedPost.mockResolvedValue({});
  });

  it('registers the push token with the backend when permission is already granted', async () => {
    await renderHook(() => usePushToken());
    await flush();

    expect(mockedRequestPermissions).not.toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalledWith('/users/me/push-token', {
      token: 'ExponentPushToken[abc]',
      platform: expect.any(String),
    });
  });

  it('requests permission when not already granted', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'undetermined' });
    mockedRequestPermissions.mockResolvedValue({ status: 'granted' });

    await renderHook(() => usePushToken());
    await flush();

    expect(mockedRequestPermissions).toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalled();
  });

  it('does not register a token when permission is denied', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'denied' });
    mockedRequestPermissions.mockResolvedValue({ status: 'denied' });

    await renderHook(() => usePushToken());
    await flush();

    expect(mockedGetToken).not.toHaveBeenCalled();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('prompts the battery-optimization dialog only after the token registers successfully', async () => {
    await renderHook(() => usePushToken());
    await flush();

    expect(mockedPrompt).toHaveBeenCalledWith(expect.objectContaining({
      title: 't:battery_optimization_title',
    }));
  });

  it('does not prompt battery optimization when registration fails', async () => {
    mockedPost.mockRejectedValue(new Error('network down'));

    await renderHook(() => usePushToken());
    await flush();

    expect(mockedPrompt).not.toHaveBeenCalled();
  });

  it('does not throw when getExpoPushTokenAsync itself fails', async () => {
    mockedGetToken.mockRejectedValue(new Error('no push service'));

    await expect(renderHook(() => usePushToken())).resolves.toBeDefined();
    await flush();

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('only registers once even if the hook re-renders', async () => {
    const { rerender } = await renderHook(() => usePushToken());
    await flush();
    mockedPost.mockClear();

    await act(async () => { rerender(undefined); });
    await flush();

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('removes the foreground notification listener on unmount', async () => {
    const remove = jest.fn();
    (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({ remove });

    const { unmount } = await renderHook(() => usePushToken());
    await flush();

    await act(async () => { unmount(); });

    expect(remove).toHaveBeenCalled();
  });
});
