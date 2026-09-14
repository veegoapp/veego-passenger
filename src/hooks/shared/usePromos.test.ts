import { renderHook, act } from '@testing-library/react-native';
import api from '../../api/client';
import { useTheme } from '../../../context/ThemeContext';
import { usePromos } from './usePromos';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

const mockedGet = api.get as jest.Mock;
const mockedPost = api.post as jest.Mock;
const mockedUseTheme = useTheme as jest.Mock;

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('usePromos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseTheme.mockReturnValue({ t: (key: string) => key });
  });

  it('loads and maps the available promos on mount', async () => {
    mockedGet.mockResolvedValue({
      data: { data: [{ code: 'WELCOME10', title: 'Welcome', discount: '10%', icon: 'gift' }] },
    });

    const { result } = await renderHook(() => usePromos());
    await flush();

    expect(mockedGet).toHaveBeenCalledWith('/promo/available');
    expect(result.current.promos).toHaveLength(1);
    expect(result.current.promos[0]).toMatchObject({ code: 'WELCOME10', titleEn: 'Welcome', discount: '10%' });
    expect(result.current.loading).toBe(false);
  });

  it('accepts a bare array in addition to a { data: [...] } envelope', async () => {
    mockedGet.mockResolvedValue({ data: [{ code: 'A' }] });

    const { result } = await renderHook(() => usePromos());
    await flush();

    expect(result.current.promos).toHaveLength(1);
  });

  it('silently returns an empty list on a 403/404 (admin-only or not-found)', async () => {
    mockedGet.mockRejectedValue({ response: { status: 404 } });

    const { result } = await renderHook(() => usePromos());
    await flush();

    expect(result.current.promos).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('validateCode returns a percentage-formatted discount', async () => {
    mockedPost.mockResolvedValue({ data: { valid: true, discountValue: 15, discountType: 'percentage' } });

    const { result } = await renderHook(() => usePromos());
    await flush();

    const outcome = await result.current.validateCode('SAVE15');

    expect(outcome).toEqual({ valid: true, discount: '15%', message: undefined });
    expect(mockedPost).toHaveBeenCalledWith('/promo/validate', { code: 'SAVE15' });
  });

  it('validateCode returns a currency-formatted discount for a flat amount', async () => {
    mockedPost.mockResolvedValue({ data: { valid: true, discountValue: 20, discountType: 'flat' } });

    const { result } = await renderHook(() => usePromos());
    await flush();

    const outcome = await result.current.validateCode('FLAT20');

    expect(outcome.discount).toBe('20 egp');
  });

  it('validateCode returns invalid with the backend message on a 400/404/422', async () => {
    mockedPost.mockRejectedValue({ response: { status: 400, data: { error: 'Code not found' } } });

    const { result } = await renderHook(() => usePromos());
    await flush();

    const outcome = await result.current.validateCode('BADCODE');

    expect(outcome).toEqual({ valid: false, message: 'Code not found' });
  });

  it('validateCode falls back to a translated generic message on an unexpected error', async () => {
    mockedPost.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => usePromos());
    await flush();

    const outcome = await result.current.validateCode('X');

    expect(outcome).toEqual({ valid: false, message: 'promo_validate_error' });
  });

  it('validatePromo delegates to validateCode', async () => {
    mockedPost.mockResolvedValue({ data: { valid: true, discountValue: 5, discountType: 'percentage' } });

    const { result } = await renderHook(() => usePromos());
    await flush();

    const outcome = await result.current.validatePromo('P5');

    expect(outcome.valid).toBe(true);
    expect(mockedPost).toHaveBeenCalledWith('/promo/validate', { code: 'P5' });
  });
});
