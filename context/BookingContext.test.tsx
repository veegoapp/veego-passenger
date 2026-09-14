import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { BookingProvider, useBooking } from './BookingContext';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/components/shared/AppAlertHost', () => ({
  showAppAlert: jest.fn(),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ t: (key: string) => key }),
}));

jest.mock('@/context/ServiceControlContext', () => ({
  useServiceControl: () => ({
    getService: () => ({ isEnabled: true, displayMode: 'live', unavailableMessage: null }),
  }),
}));

jest.mock('@/src/hooks/shared/usePassengerTracking', () => ({
  usePassengerTracking: jest.fn(),
}));

jest.mock('@/src/hooks/shared/backgroundLocationTask', () => ({
  PASSENGER_SHUTTLE_LOCATION_TASK: 'passenger-shuttle-location-task',
}));

jest.mock('@/src/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('@/src/api/socket', () => {
  const emitted: any[] = [];
  return {
    getSocket: jest.fn(async () => ({ emit: (...args: any[]) => emitted.push(args) })),
    __getEmitted: () => emitted,
    __reset: () => { emitted.length = 0; },
  };
});

const api = jest.requireMock('@/src/api/client').default;
const socketMock = jest.requireMock('@/src/api/socket');
const { router } = jest.requireMock('expo-router');
const { showAppAlert } = jest.requireMock('@/components/shared/AppAlertHost');

async function setupHook() {
  return renderHook(() => useBooking(), {
    wrapper: ({ children }) => <BookingProvider>{children}</BookingProvider>,
  });
}

const route = {
  id: 'route-1',
  name: 'Downtown Line',
  path: [],
  seatsLeft: 5,
  totalSeats: 14,
  pricingModel: 'flat',
} as any;

function lineDetailResponse(trips: any[] = [{ id: 10, availableSeats: 5, totalSeats: 14 }]) {
  return {
    data: {
      data: { stations: [], activeTrips: trips },
    },
  };
}

describe('BookingContext — full booking lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketMock.__reset();
    api.get.mockResolvedValue(lineDetailResponse());
  });

  it('carries a booking from route selection through confirmation, refresh and socket join', async () => {
    const { result } = await setupHook();

    await act(async () => { await result.current.openRoute(route); });
    expect(result.current.tripSheetOpen).toBe(true);
    expect(result.current.scheduledTrips).toHaveLength(1);

    await act(async () => {
      result.current.prepareBooking({ tripId: 10, route, fromIdx: 0 } as any);
    });
    expect(result.current.pendingBooking).toMatchObject({ tripId: 10 });

    api.post.mockResolvedValueOnce({ data: { id: 999 } });
    api.get.mockResolvedValueOnce(lineDetailResponse([{ id: 10, availableSeats: 4, totalSeats: 14 }]));

    await act(async () => { await result.current.handleConfirm('cash' as any); });
    // Flush the fire-and-forget refreshLineTrips()/socket join kicked off inside handleConfirm.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.confirmedBookingId).toBe('999');
    expect(result.current.confirmedTripId).toBe(10);
    expect(result.current.bookingError).toBeNull();
    expect(socketMock.__getEmitted()).toContainEqual(['passenger:join:trip', 10]);
    expect(router.push).not.toHaveBeenCalled(); // navigation is deferred via setTimeout
  });

  it('surfaces an insufficient-balance error (402) without confirming the booking', async () => {
    const { result } = await setupHook();
    await act(async () => { await result.current.openRoute(route); });
    await act(async () => {
      result.current.prepareBooking({ tripId: 10, route, fromIdx: 0 } as any);
    });

    api.post.mockRejectedValueOnce({
      response: { status: 402, data: { error: 'insufficient funds', required: 30, balance: 10 } },
    });

    await act(async () => { await result.current.handleConfirm('wallet' as any); });

    expect(result.current.confirmedBookingId).toBeNull();
    expect(result.current.bookingError).toBe('insufficient funds');
    expect(showAppAlert).toHaveBeenCalled();
  });

  it('a seats-taken 409 conflict leaves the pending booking intact for retry with a different trip', async () => {
    const { result } = await setupHook();
    await act(async () => { await result.current.openRoute(route); });
    await act(async () => {
      result.current.prepareBooking({ tripId: 10, route, fromIdx: 0 } as any);
    });

    api.post.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'seats no longer available' } },
    });

    await act(async () => { await result.current.handleConfirm('cash' as any); });

    expect(result.current.confirmedBookingId).toBeNull();
    expect(result.current.pendingBooking).toMatchObject({ tripId: 10 });
    expect(result.current.bookingError).toBeTruthy();
  });

  it('a network timeout reports an unclear outcome rather than a hard failure, since the booking may have gone through', async () => {
    const { result } = await setupHook();
    await act(async () => { await result.current.openRoute(route); });
    await act(async () => {
      result.current.prepareBooking({ tripId: 10, route, fromIdx: 0 } as any);
    });

    api.post.mockRejectedValueOnce(new Error('timeout'));

    await act(async () => { await result.current.handleConfirm('cash' as any); });

    expect(result.current.confirmedBookingId).toBeNull();
    expect(result.current.bookingError).toBe('booking_timeout_msg');
  });
});
