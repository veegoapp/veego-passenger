/**
 * Socket event name constants for the passenger app.
 * Mirrors artifacts/api-server/src/lib/socket-events.ts — keep in sync.
 */

export const SOCKET_EVENTS = {
  // Server → Passenger
  RIDE_DRIVER_ASSIGNED:   "ride:driver_assigned",
  RIDE_DRIVER_ARRIVED:    "ride:driver_arrived",
  RIDE_ARRIVED:           "ride:arrived",
  RIDE_DRIVER_LOCATION:   "ride:driver_location",
  RIDE_STARTED:           "ride:started",
  RIDE_COMPLETED:         "ride:completed",
  RIDE_CANCELLED:         "ride:cancelled",
  RIDE_TIMEOUT:           "ride:timeout",
  RIDE_DEVIATION_WARNING: "ride:deviation_warning",
  NOTIFICATION_NEW:       "notification:new",
  BOOKING_BOARDED:        "booking:boarded",
  TRIP_CHAT_MESSAGE:      "trip:chat:message",

  // Client → Server
  JOIN:                   "join",
  PASSENGER_JOIN_TRIP:    "passenger:join:trip",
} as const;

export type PassengerSocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
