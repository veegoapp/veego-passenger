export const ERROR_MESSAGES: Record<string, string> = {
  SEAT_COUNT_EXCEEDED: "Not enough seats available on this trip",
  TRIP_FULLY_BOOKED: "This trip is fully booked",
  PROMO_EXPIRED: "This promo code has expired",
  PROMO_LIMIT_REACHED: "This promo code is no longer available",
  PROMO_USER_LIMIT_REACHED: "You have already used this promo code",
  INSUFFICIENT_BALANCE: "Your wallet balance is insufficient",
  RIDE_ALREADY_ACTIVE: "You already have an active ride",
  PRICING_UNAVAILABLE: "Pricing is currently unavailable, please try again",
  INVALID_REQUEST: "Invalid request, please check your inputs",
  RIDE_NOT_FOUND: "Ride not found",
  BOOKING_DUPLICATE: "You already have a booking on this trip",
};

export function getErrorMessage(code?: string, fallback?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return fallback || "Something went wrong, please try again";
}
