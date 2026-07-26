/**
 * Passenger ActiveSession contract.
 *
 * The backend sends ISO timestamp strings over JSON. They are represented as
 * strings here rather than Date objects so the transport shape is preserved.
 */

export type ActiveSessionTimestamp = string;

export type PassengerSessionType = 'ride' | 'shuttle_booking';

export type PassengerRideVehicleType = 'car' | 'scooter' | 'delivery';

export type PassengerRideStatus =
  | 'requested'
  | 'searching'
  | 'driver_assigned'
  | 'driver_arrived'
  | 'active';

export type PassengerShuttleBookingStatus = 'pending' | 'confirmed' | 'boarded';

export type PassengerShuttleTripStatus =
  | 'scheduled'
  | 'waiting_driver'
  | 'driver_assigned'
  | 'boarding'
  | 'active';

export interface PassengerRideLocation {
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: ActiveSessionTimestamp | null;
}

export interface PassengerRideDriverVehicle {
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface PassengerRideDriver {
  id: number;
  name: string;
  phone: string | null;
  rating: number | null;
  vehicleType: string | null;
  location: PassengerRideLocation | null;
  vehicle: PassengerRideDriverVehicle | null;
}

export interface PassengerRideRecipient {
  name: string;
  phone: string;
}

export interface PassengerRidePromoCode {
  code: string;
  discountType: string;
  discountValue: number | null;
}

export interface PassengerRideDispatchState {
  currentRound: number;
  roundStartedAt: ActiveSessionTimestamp;
  status: string;
}

export interface PassengerRidePoint {
  latitude: number;
  longitude: number;
  address: string;
}

export interface PassengerRideSession {
  sessionType: 'ride';
  vehicleType: PassengerRideVehicleType;
  rideId: number;
  status: PassengerRideStatus;
  requestedCategory: string | null;
  pickup: PassengerRidePoint;
  dropoff: PassengerRidePoint;
  recipient: PassengerRideRecipient | null;
  distanceKm: number | null;
  estimatedDurationMinutes: number | null;
  estimatedPrice: number | null;
  finalPrice: number | null;
  waitingCharge: number;
  paymentMethod: string;
  promoCode: PassengerRidePromoCode | null;
  driver: PassengerRideDriver | null;
  dispatchState: PassengerRideDispatchState | null;
  requestedAt: ActiveSessionTimestamp;
  driverAssignedAt: ActiveSessionTimestamp | null;
  driverArrivedAt: ActiveSessionTimestamp | null;
  driverArrivedLocation: { lat: number; lng: number } | null;
  startedAt: ActiveSessionTimestamp | null;
}

export interface PassengerShuttleRoute {
  id: number;
  name: string;
  nameAr: string | null;
  fromLocation: string;
  toLocation: string;
}

export interface PassengerShuttleDriver {
  id: number;
  name: string;
  phone: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
}

export interface PassengerShuttleTrip {
  id: number;
  status: PassengerShuttleTripStatus;
  vehicleType: string;
  departureTime: ActiveSessionTimestamp;
  arrivalTime: ActiveSessionTimestamp;
  direction: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  minRequired: number;
  route: PassengerShuttleRoute;
  driver: PassengerShuttleDriver | null;
}

export interface PassengerShuttleBoardingStation {
  id: number;
  name: string;
  nameAr: string | null;
  latitude: number;
  longitude: number;
  order: number;
}

export interface PassengerShuttleSession {
  sessionType: 'shuttle_booking';
  bookingId: number;
  bookingStatus: PassengerShuttleBookingStatus;
  seatCount: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  trip: PassengerShuttleTrip;
  boardingStation: PassengerShuttleBoardingStation | null;
  createdAt: ActiveSessionTimestamp;
}

export type PassengerActiveSession = PassengerRideSession | PassengerShuttleSession;

export interface PassengerActiveSessionResponse {
  data: PassengerActiveSession | null;
}

export type PassengerSessionSnapshotPayload = PassengerActiveSessionResponse;

/**
 * Client-normalized models retain the complete backend object through `raw`.
 * The added fields are client concerns and do not replace contract fields.
 */
export interface NormalizedPassengerRideSession extends PassengerRideSession {
  kind: 'ride';
  serviceType: PassengerRideVehicleType;
  raw: PassengerRideSession;
}

export interface NormalizedPassengerShuttleSession extends PassengerShuttleSession {
  kind: 'shuttle';
  serviceType: 'shuttle';
  raw: PassengerShuttleSession;
}

export type NormalizedPassengerActiveSession =
  | NormalizedPassengerRideSession
  | NormalizedPassengerShuttleSession;