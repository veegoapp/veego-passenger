import { renderHook, act } from '@testing-library/react-native';
import { getMyTrips } from '../../api/shuttleService';
import { getMyRides } from '../../api/rideService';
import { useTrips } from './useTrips';

jest.mock('../../api/shuttleService', () => ({
  getMyTrips: jest.fn(),
}));

jest.mock('../../api/rideService', () => ({
  getMyRides: jest.fn(),
}));

const mockedGetMyTrips = getMyTrips as jest.Mock;
const mockedGetMyRides = getMyRides as jest.Mock;

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

function shuttleBooking(overrides: Record<string, any> = {}) {
  return {
    bookingId: 1, tripId: 10, routeName: 'Route A', toLocation: 'Downtown',
    fromStation: { id: 1, name: 'Station A' }, departureTime: '2026-06-01T08:00:00.000Z',
    status: 'confirmed', tripStatus: 'scheduled', ticketPrice: 25,
    ...overrides,
  };
}

function ride(overrides: Record<string, any> = {}) {
  return {
    id: 100, vehicleType: 'car', status: 'completed',
    completedAt: '2026-05-01T10:00:00.000Z',
    pickup: { address: 'A' }, dropoff: { address: 'B' }, finalPrice: 40,
    ...overrides,
  };
}

describe('useTrips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyTrips.mockResolvedValue({ data: [], page: 1, total: 0 });
    mockedGetMyRides.mockResolvedValue({ data: [], meta: { page: 1, total: 0 } });
  });

  it('puts an upcoming-status shuttle booking into upcomingTrips, not pastTrips', async () => {
    mockedGetMyTrips.mockResolvedValue({ data: [shuttleBooking()], page: 1, total: 1 });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingTrips).toHaveLength(1);
    expect(result.current.pastTrips).toHaveLength(0);
    expect(result.current.upcomingTrips[0].routeName).toBe('Route A');
  });

  it('puts a completed shuttle booking into pastTrips, not upcomingTrips', async () => {
    mockedGetMyTrips.mockResolvedValue({
      data: [shuttleBooking({ bookingId: 2, tripStatus: 'completed' })], page: 1, total: 1,
    });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingTrips).toHaveLength(0);
    expect(result.current.pastTrips).toHaveLength(1);
  });

  it('never shows a ride in upcomingTrips (rides have no upcoming concept)', async () => {
    mockedGetMyRides.mockResolvedValue({ data: [ride()], meta: { page: 1, total: 1 } });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingTrips).toHaveLength(0);
    expect(result.current.pastTrips).toHaveLength(1);
    expect(result.current.pastTrips[0].type).toBe('car');
  });

  it('merges shuttle history and ride history into one pastTrips list, newest first', async () => {
    mockedGetMyTrips.mockResolvedValue({
      data: [shuttleBooking({ bookingId: 3, tripStatus: 'completed', departureTime: '2026-01-01T00:00:00.000Z' })],
      page: 1, total: 1,
    });
    mockedGetMyRides.mockResolvedValue({
      data: [ride({ id: 101, completedAt: '2026-03-01T00:00:00.000Z' })], meta: { page: 1, total: 1 },
    });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.pastTrips).toHaveLength(2);
    // The March ride is newer than the January shuttle trip.
    expect(result.current.pastTrips[0].type).toBe('car');
    expect(result.current.pastTrips[1].type).toBe('shuttle');
  });

  it('sorts upcomingTrips soonest-first', async () => {
    mockedGetMyTrips.mockResolvedValue({
      data: [
        shuttleBooking({ bookingId: 4, departureTime: '2026-08-01T00:00:00.000Z' }),
        shuttleBooking({ bookingId: 5, departureTime: '2026-07-01T00:00:00.000Z' }),
      ],
      page: 1, total: 2,
    });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingTrips.map((t) => t.bookingId)).toEqual(['5', '4']);
  });

  it('isolates upcoming loading/error from a rides-fetch failure', async () => {
    mockedGetMyTrips.mockResolvedValue({ data: [shuttleBooking()], page: 1, total: 1 });
    mockedGetMyRides.mockRejectedValue(new Error('rides endpoint down'));

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingError).toBeNull();
    expect(result.current.upcomingLoading).toBe(false);
    expect(result.current.upcomingTrips).toHaveLength(1);
    // The overall (combined) error still reflects the rides failure.
    expect(result.current.error).toBeTruthy();
  });

  it('derives canCancel from the fallback status set when the backend omits canCancel', async () => {
    mockedGetMyTrips.mockResolvedValue({
      data: [shuttleBooking({ tripStatus: 'scheduled' })], page: 1, total: 1,
    });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingTrips[0].canCancel).toBe(true);
  });

  it('respects an explicit canCancel:false from the backend even for a normally-cancellable status', async () => {
    mockedGetMyTrips.mockResolvedValue({
      data: [shuttleBooking({ tripStatus: 'scheduled', canCancel: false })], page: 1, total: 1,
    });

    const { result } = await renderHook(() => useTrips());
    await flush();

    expect(result.current.upcomingTrips[0].canCancel).toBe(false);
  });

  it('loadMore fetches the next page from whichever source still has more', async () => {
    mockedGetMyTrips.mockResolvedValue({ data: [shuttleBooking()], page: 1, total: 1 });
    mockedGetMyRides
      .mockResolvedValueOnce({ data: [ride()], meta: { page: 1, total: 2 } })
      .mockResolvedValueOnce({ data: [ride({ id: 102 })], meta: { page: 2, total: 2 } });

    const { result } = await renderHook(() => useTrips());
    await flush();

    await act(async () => { await result.current.loadMore(); });

    expect(mockedGetMyRides).toHaveBeenCalledTimes(2);
    // Shuttle already had everything (total 1) so it should not be asked for page 2.
    expect(mockedGetMyTrips).toHaveBeenCalledTimes(1);
  });

  it('refresh() reloads both sources', async () => {
    const { result } = await renderHook(() => useTrips());
    await flush();
    mockedGetMyTrips.mockClear();
    mockedGetMyRides.mockClear();

    await act(async () => { await result.current.refresh(); });

    expect(mockedGetMyTrips).toHaveBeenCalledWith(1, 10);
    expect(mockedGetMyRides).toHaveBeenCalledWith(1, 10);
  });
});
