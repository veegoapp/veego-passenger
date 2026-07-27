import { useCallback, useEffect, useRef, useState } from 'react';

export interface PaginatedPage<T> {
  items: T[];
  page: number;
  total: number;
}

export interface UsePaginatedListResult<T> {
  items: T[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

type Fetcher<T> = (page: number) => Promise<PaginatedPage<T>>;

function extractErrorMessage(e: any, fallback: string): string {
  return e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? fallback;
}

/**
 * Generic page-based list loader: normalizes loading/refreshing/error/retry/
 * load-more behavior for any endpoint, regardless of that endpoint's own
 * pagination response shape — callers adapt their raw response into
 * { items, page, total } before handing it to `fetcher`.
 */
export function usePaginatedList<T>(fetcher: Fetcher<T>, errorFallback = 'Failed to load'): UsePaginatedListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchPage = useCallback(async (pageNum: number, mode: 'initial' | 'refresh' | 'more') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const result = await fetcherRef.current(pageNum);
      setItems((prev) => (pageNum === 1 ? result.items : [...prev, ...result.items]));
      setPage(result.page);
      setTotal(result.total);
    } catch (e: any) {
      setError(extractErrorMessage(e, errorFallback));
      if (pageNum === 1) setItems([]);
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, [errorFallback]);

  const refresh = useCallback(() => fetchPage(1, 'refresh'), [fetchPage]);
  const retry = useCallback(() => fetchPage(1, 'initial'), [fetchPage]);

  const loadMore = useCallback(async () => {
    if (items.length >= total) return;
    await fetchPage(page + 1, 'more');
  }, [fetchPage, page, items.length, total]);

  useEffect(() => {
    fetchPage(1, 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMore = items.length < total;

  return { items, loading, refreshing, error, hasMore, loadMore, refresh, retry };
}
