import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import { useRecentSearches } from './useRecentSearches';

describe('useRecentSearches', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts empty when nothing is stored', async () => {
    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.recents).toEqual([]);
  });

  it('loads previously stored recents on mount', async () => {
    await AsyncStorage.setItem('@veego_recent_car_v1', JSON.stringify([{ address: 'Cairo' }]));

    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.recents).toEqual([{ address: 'Cairo' }]);
  });

  it('coerces a legacy plain string[] into RecentLocation objects', async () => {
    await AsyncStorage.setItem('@veego_recent_scooter_v1', JSON.stringify(['Giza', 'Maadi']));

    const { result } = await renderHook(() => useRecentSearches('scooter'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.recents).toEqual([{ address: 'Giza' }, { address: 'Maadi' }]);
  });

  it('drops malformed entries when coercing legacy data', async () => {
    await AsyncStorage.setItem('@veego_recent_car_v1', JSON.stringify([{ address: 'Cairo' }, { no_address: true }, 42]));

    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.recents).toEqual([{ address: 'Cairo' }]);
  });

  it('keeps recents empty (not crash) on malformed JSON in storage', async () => {
    await AsyncStorage.setItem('@veego_recent_car_v1', 'not json');

    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.recents).toEqual([]);
  });

  it('adds a new recent to the front of the list', async () => {
    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addRecent('New Cairo', { latitude: 30.03, longitude: 31.49 }); });

    expect(result.current.recents).toEqual([{ address: 'New Cairo', latitude: 30.03, longitude: 31.49 }]);
  });

  it('deduplicates by address, moving the repeated entry to the front', async () => {
    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addRecent('Cairo'); });
    await act(async () => { await result.current.addRecent('Giza'); });
    await act(async () => { await result.current.addRecent('Cairo'); });

    expect(result.current.recents).toEqual([{ address: 'Cairo' }, { address: 'Giza' }]);
  });

  it('caps the list at MAX_RECENTS (5)', async () => {
    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });

    for (const addr of ['a', 'b', 'c', 'd', 'e', 'f']) {
      await act(async () => { await result.current.addRecent(addr); });
    }

    expect(result.current.recents).toHaveLength(5);
    expect(result.current.recents.map((r) => r.address)).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('persists added recents to AsyncStorage under the per-service key', async () => {
    const { result } = await renderHook(() => useRecentSearches('delivery'));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addRecent('Nasr City'); });

    const stored = await AsyncStorage.getItem('@veego_recent_delivery_v1');
    expect(JSON.parse(stored as string)).toEqual([{ address: 'Nasr City' }]);
  });

  it('clearRecents empties the list and removes the storage key', async () => {
    const { result } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.addRecent('Cairo'); });

    await act(async () => { await result.current.clearRecents(); });

    expect(result.current.recents).toEqual([]);
    expect(await AsyncStorage.getItem('@veego_recent_car_v1')).toBeNull();
  });

  it('keeps separate storage per service', async () => {
    const { result: car } = await renderHook(() => useRecentSearches('car'));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await car.current.addRecent('Cairo'); });

    const { result: scooter } = await renderHook(() => useRecentSearches('scooter'));
    await act(async () => { await Promise.resolve(); });

    expect(scooter.current.recents).toEqual([]);
  });
});
