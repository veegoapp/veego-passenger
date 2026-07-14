/**
 * Socket event name constants for the passenger app.
 * Mirrors artifacts/api-server/src/lib/socket-events.ts — keep in sync.
 */

export const SOCKET_EVENTS = {
  // Server → Passenger
  RIDE_DRIVER_ASSIGNED:          "ride:driver_assigned",
  RIDE_DRIVER_ARRIVED:           "ride:driver_arrived",
  RIDE_ETA_UPDATE:               "ride:eta_update",
  RIDE_ARRIVED:                  "ride:arrived",
  RIDE_WAITING_CHARGE_STARTED:   "ride:waiting:charge:started",
  RIDE_WAITING_CHARGE_UPDATED:   "ride:waiting:charge:updated",
  RIDE_WAITING_CHARGE_CAPPED:    "ride:waiting:charge:capped",
  RIDE_DRIVER_LOCATION:          "ride:driver_location",
  RIDE_STARTED:                  "ride:started",
  RIDE_COMPLETED:                "ride:completed",
  RIDE_CANCELLED:                "ride:cancelled",
  RIDE_DRIVER_CANCELLED:         "ride:driver_cancelled",
  RIDE_NO_SHOW_CANCELLED:        "ride:no_show_cancelled",
  RIDE_STATUS_CHANGED:           "ride:status:changed",
  RIDE_DEVIATION_WARNING:        "ride:deviation:warning",
  RIDE_MESSAGE_NEW:              "ride:message:new",
  NOTIFICATION_NEW:              "notification:new",
  BOOKING_BOARDED:               "booking:boarded",
  PASSENGER_TRIP_TRACKING:       "passenger:trip:tracking",
  SURGE_UPDATED:                 "surge:updated",
  SERVICE_CONTROL_CHANGED:       "service:control:changed",
  SERVICE_SETTINGS_CHANGED:      "service:settings:changed",
  WALLET_FEATURE_CHANGED:        "wallet:feature:changed",
  PAYMENT_METHODS_CHANGED:       "payment:methods:changed",
  SOS_TRIGGERED:                 "sos:triggered",
  SHUTTLE_DRIVER_LOCATION:       "shuttle:driver:location",
  TRIP_CHAT_MESSAGE:             "trip:chat:message",
  TRIP_ACTIVATED:                "trip:activated",

  // Passenger → Server
  JOIN:                          "join",
  PASSENGER_JOIN_TRIP:           "passenger:join:trip",
  LEAVE_TRIP:                    "leave:trip",
  PASSENGER_SOS:                 "passenger:sos",
} as const;

export type PassengerSocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
