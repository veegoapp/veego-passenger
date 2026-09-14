import { renderHook, act } from '@testing-library/react-native';
import { usePaginatedList, type PaginatedPage } from './usePaginatedList';

function page(items: number[], page: number, total: number): PaginatedPage<number> {
  return { items, page, total };
}

describe('usePaginatedList', () => {
  it('loads the first page on mount', async () => {
    const fetcher = jest.fn().mockResolvedValue(page([1, 2, 3], 1, 10));

    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });

    expect(fetcher).toHaveBeenCalledWith(1);
    expect(result.current.items).toEqual([1, 2, 3]);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(true);
  });

  it('reports hasMore=false once every item has loaded', async () => {
    const fetcher = jest.fn().mockResolvedValue(page([1, 2, 3], 1, 3));

    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.hasMore).toBe(false);
  });

  it('appends (not replaces) items on loadMore', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(page([1, 2], 1, 4))
      .mockResolvedValueOnce(page([3, 4], 2, 4));

    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.items).toEqual([1, 2]);

    await act(async () => { await result.current.loadMore(); });

    expect(fetcher).toHaveBeenCalledWith(2);
    expect(result.current.items).toEqual([1, 2, 3, 4]);
  });

  it('does not call the fetcher again once there is nothing more to load', async () => {
    const fetcher = jest.fn().mockResolvedValue(page([1, 2], 1, 2));

    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.loadMore(); });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refresh() replaces the list from page 1 rather than appending', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(page([1, 2], 1, 4))
      .mockResolvedValueOnce(page([9], 1, 1));

    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.items).toEqual([1, 2]);

    await act(async () => { await result.current.refresh(); });

    expect(result.current.items).toEqual([9]);
  });

  it('sets refreshing (not loading) true while a refresh is in flight', async () => {
    const fetcher = jest.fn().mockResolvedValue(page([1], 1, 1));
    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });

    let deferredResolve!: (v: PaginatedPage<number>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { deferredResolve = resolve; }));

    let refreshPromise!: Promise<void>;
    await act(async () => { refreshPromise = result.current.refresh(); });

    expect(result.current.refreshing).toBe(true);
    expect(result.current.loading).toBe(false);

    await act(async () => { deferredResolve(page([2], 1, 1)); await refreshPromise; });
    expect(result.current.refreshing).toBe(false);
  });

  it('surfaces a specific error message from the response body', async () => {
    const fetcher = jest.fn().mockRejectedValue({ response: { data: { error: 'Rate limited' } } });

    const { result } = await renderHook(() => usePaginatedList(fetcher));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.error).toBe('Rate limited');
    expect(result.current.items).toEqual([]);
  });

  it('falls back to the caller-supplied error message when the rejection carries no message at all', async () => {
    // A bare object (no .message, no .response.data.error/.message) is the
    // only shape that actually reaches the fallback — extractErrorMessage's
    // `??` chain stops at the first non-nullish value, and Error's own
    // `.message` defaults to '' (falsy but not nullish), so `new Error()`
    // would resolve to '' rather than the fallback.
    const fetcher = jest.fn().mockRejectedValue({});

    const { result } = await renderHook(() => usePaginatedList(fetcher, 'Custom fallback'));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.error).toBe('Custom fallback');
  });

  it('clears a previous error and reloads items on retry()', async () => {
    const fetcher = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page([1], 1, 1));

    const { result } = await renderHook(() => usePaginatedList(fetcher, 'failed'));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error).toBe('boom');

    await act(async () => { await result.current.retry(); });

    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([1]);
  });
});
