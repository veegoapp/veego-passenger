import { renderHook, act } from '@testing-library/react-native';
import api from '../../api/client';
import { useWallet } from './useWallet';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedGet = api.get as jest.Mock;

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('useWallet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads balance and transactions on mount', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 150, spent: 40 } });
      if (path === '/wallet/transactions') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('unexpected path'));
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.balance).toBe(150);
    expect(result.current.spent).toBe(40);
    expect(result.current.loading).toBe(false);
  });

  it('parses a string-typed balance/spent', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: '99.5', monthlySpent: '10' } });
      return Promise.resolve({ data: [] });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.balance).toBe(99.5);
    expect(result.current.spent).toBe(10);
  });

  it('does not crash on a wallet fetch failure, but leaves balance at 0 with no error set', async () => {
    // Both requests go through Promise.allSettled, so a rejected /wallet
    // call never reaches the outer try/catch — `error` is only ever set by
    // a genuinely unexpected exception, not by either endpoint's own
    // rejection. This looks like a UX gap (the screen just shows a silent
    // 0 balance) but it is the actual current behavior, not a crash.
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.reject({ response: { data: { error: 'Server down' } } });
      return Promise.resolve({ data: [] });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.balance).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('classifies a credit transaction (positive amount) correctly', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 0 } });
      return Promise.resolve({
        data: [{ id: 1, amount: 50, transactionType: 'ride_earning' }],
      });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].type).toBe('credit');
    expect(result.current.transactions[0].kind).toBe('deposit');
  });

  it('classifies a debit (payment) transaction correctly', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 0 } });
      return Promise.resolve({
        data: [{ id: 2, amount: 30, transactionType: 'booking_payment' }],
      });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.transactions[0].type).toBe('debit');
    expect(result.current.transactions[0].kind).toBe('payment');
  });

  it('classifies a refund transaction correctly', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 0 } });
      return Promise.resolve({
        data: [{ id: 3, amount: 20, transactionType: 'refund', description: 'Ride refund' }],
      });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.transactions[0].kind).toBe('refund');
    expect(result.current.transactions[0].titleEn).toBeTruthy();
  });

  it('always reports amount as the absolute magnitude', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 0 } });
      return Promise.resolve({ data: [{ id: 4, amount: -75, transactionType: 'payout' }] });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.transactions[0].amount).toBe(75);
  });

  it('unwraps a { transactions: [...] } envelope in addition to a bare array', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 0 } });
      return Promise.resolve({ data: { transactions: [{ id: 5, amount: 10 }] } });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.transactions).toHaveLength(1);
  });

  it('does not let a transactions-fetch failure clear a successfully-loaded balance', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 200 } });
      return Promise.reject(new Error('tx endpoint down'));
    });

    const { result } = await renderHook(() => useWallet());
    await flush();

    expect(result.current.balance).toBe(200);
    // Promise.allSettled means the transactions rejection alone does not set `error`.
    expect(result.current.error).toBeNull();
  });

  it('refresh() re-fetches both endpoints', async () => {
    mockedGet.mockImplementation((path: string) => {
      if (path === '/wallet') return Promise.resolve({ data: { balance: 1 } });
      return Promise.resolve({ data: [] });
    });

    const { result } = await renderHook(() => useWallet());
    await flush();
    mockedGet.mockClear();

    await act(async () => { result.current.refresh(); await Promise.resolve(); await Promise.resolve(); });

    expect(mockedGet).toHaveBeenCalledWith('/wallet');
    expect(mockedGet).toHaveBeenCalledWith('/wallet/transactions');
  });
});
