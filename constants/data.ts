/* ─────────────────────────────────────────────────────────────────
   VeeGo data types — aligned with Shuttle API Integration Report
   ───────────────────────────────────────────────────────────────── */

// ── Enums / union types ──────────────────────────────────────────

export type TripType = 'shuttle' | 'car' | 'scooter' | 'delivery';

export type ShuttleTripStatus =
  | 'waiting_driver'
  | 'scheduled'
  | 'driver_assigned'
  | 'active'
  | 'boarding'
  | 'completed'
  | 'cancelled'
  | 'upcoming';

/** Status values on a Booking object (§2.4) */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'boarded'
  | 'absent'
  | 'completed'
  | 'cancelled';

/** Payment status values on a Booking object (§2.4) */
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

// ── Sub-models ───────────────────────────────────────────────────

/** Time-slot entry returned in GET /shuttle/lines (§2.9) */
export interface TimeSlot {
  departureTime: string;    // "HH:MM" Cairo local time
  availableSeats: number;
  isBooked: boolean;
}

/** Response from GET /shuttle/my-debt (§13.1) */
export interface DebtInfo {
  hasDebt: boolean;
  debtAmount: number;
  offenceCount: number;
}

/**
 * Physical direction of a specific shuttle departure/trip along its route.
 * Distinct from `TripRequestDirection` ('one_way' | 'round_trip') in
 * shuttleService.ts, which describes a trip-request submission, not a
 * station/trip's direction of travel.
 */
export type ShuttleDirection = 'outbound' | 'return';

/**
 * Raw scheduled/active trip slot as returned inside GET /shuttle/lines/:id
 * (the `activeTrips`/`trips` array). Kept intentionally permissive — screens
 * have always treated these as loosely-typed backend payloads — but gives
 * `direction` a real type so it can be read safely where the backend
 * provides it, instead of falling back to `any`.
 */
export interface ShuttleTripSlot {
  id?: number | string;
  departureTime?: string;
  availableSeats?: number;
  totalSeats?: number;
  bookedSeats?: number;
  minRequired?: number;
  status?: string;
  shuttleStatus?: string;
  message?: string;
  /** Only present when the backend includes it; never fabricated client-side. */
  direction?: ShuttleDirection;
  [key: string]: any;
}

/** `shuttle` metadata block returned with POST /bookings (§2.10) */
export interface ShuttleBookingMeta {
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  minRequired: number;
  shuttleStatus: 'open' | 'active';
  message: string;
}

// ── Core models ──────────────────────────────────────────────────

/** Stop along a route — matches GET /routes/:id/stations (§2.2) */
export type Station = {
  id: string;
  name: string;
  nameAr: string | null;         // Arabic name (§3, §21.5)
  area: string;
  distance: string;
  eta: string;
  latitude?: number;
  longitude?: number;
  order?: number;                // 1-based position in route
  direction?: ShuttleDirection;
  segmentPrice?: number | null;  // partial-route pricing (§21.6)
};

/** Shuttle line / route — matches GET /shuttle/lines response (§2.9) */
export type Route = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;         // Arabic route name (§3)
  from: string;                  // English departure location
  fromAr: string | null;         // Arabic departure location (§3)
  to: string;                    // English destination
  toAr: string | null;           // Arabic destination (§3)
  stations: number;              // stationCount
  duration: string;              // formatted, e.g. "45 min"
  seatsLeft: number;
  totalSeats: number;
  price: number;                 // basePrice in EGP
  /** 'tiered' when the route charges a minimum fare below a coverage
   * threshold and the full `price` at/above it (based on boarding/
   * destination station); 'flat' (or absent, for older cached data) means
   * `price` is simply what every booking pays. */
  pricingModel?: 'flat' | 'tiered';
  /** Only present when pricingModel === 'tiered' — the minimum possible
   * fare on this route, i.e. what a short trip costs. `price` stays the
   * ceiling/full fare in that case. */
  startingPrice?: number;
  nextDeparture: string;
  color: string;                 // UI colour, not from API
  path: Station[];
  departureCount?: number;       // total departures for today (from GET /shuttle/lines/:id)
  openTrips?: number;            // trips in 'scheduled' state
  activeTrips?: number;          // trips in ['waiting_driver','driver_assigned'] state
  totalTrips?: number;
  minRequired?: number;          // min bookings to activate
  upcomingWeekStart?: string | null;
  timeslots?: TimeSlot[];        // preferred over deprecated timeSlots (§20)
  requestsEnabled?: boolean;     // whether "Request a Trip" is enabled for this route
};

/**
 * A booking record as displayed in the passenger's trip history.
 * Maps a booking (from GET /users/me/bookings) to a display-ready shape.
 */
export type Trip = {
  id: string;                    // booking id (string form)
  type: TripType;
  routeCode: string;
  routeName: string;             // English route name
  routeNameAr: string | null;    // Arabic route name (§3)
  from: string;                  // English departure
  fromAr: string | null;         // Arabic departure (§3)
  to: string;                    // English destination
  toAr: string | null;           // Arabic destination (§3)
  date: string;                  // formatted in Africa/Cairo (§21.9)
  time: string;                  // formatted in Africa/Cairo (§21.9)
  departureIso: string;          // raw UTC ISO string
  seat: string;
  status: ShuttleTripStatus;
  bookingStatus?: BookingStatus; // raw booking status (§2.4, §21.1)
  paymentStatus?: PaymentStatus; // payment status (§2.4)
  price: number;
  tripId?: number | string | null;
  bookingId?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  passengerCount?: number;
  minPassengers?: number;
  seatCount?: number;            // always 1 for shuttle (§11)
  promoCodeId?: number | null;   // applied promo (§2.4)
  vehicleType?: 'hiace' | 'minibus'; // (§2.3, §4)
  totalSeats?: number;           // from trip, not bus.capacity (§21.4)
  availableSeats?: number;
  /** This booking's specific trip direction, when the backend provides it. */
  direction?: ShuttleDirection;
  /** Whether this booking can be self-cancelled — from backend `canCancel`, with a status-based fallback when absent. */
  canCancel?: boolean;
  /** Driver's name and rating, sent by GET /shuttle/my-trips. */
  driverName?: string | null;
  driverRating?: number | null;
  /** The passenger's own rating already given for this trip, if any (used to show "already rated"). */
  passengerRating?: number | null;
};

/** Pending booking held in BookingContext while user reviews on /review-confirm */
export type Booking = {
  route: Route;
  fromIdx: number;
  toIdx: number;
  passengers: number;
  date: string;
  time: string;
  price: number;
  tripId?: number | null;
  seatCount?: number;
  paymentStatus?: PaymentStatus;
  promoCodeId?: number | null;
  /** The selected trip's direction, carried through from TripSheet when known. */
  direction?: ShuttleDirection;
  /** id of the station the passenger picked as boarding point (fromIdx's station). */
  boardingStationId?: string;
  /** id of the station the passenger picked as their destination (toIdx's station).
   * Required by the backend whenever the route uses tiered pricing. */
  alightingStationId?: string;
  /** Set once GET /trips/:id/fare-preview responds — the authoritative
   * per-seat fare for the picked boarding/destination pair. Falls back to
   * the client-estimated `price` above until this resolves. */
  farePerSeat?: number;
};

export type Notification = {
  id: string;
  type: 'trip' | 'promo' | 'system';
  title: string;
  body: string;
  createdAt: string;
  unread?: boolean;
};

// ── Date helpers ─────────────────────────────────────────────────

/**
 * "Today" in Africa/Cairo as { y, m, d } — trips are filtered against this
 * timezone (see tripSheetHelpers.ts::formatTripDateUTC), so the date picker
 * must be anchored the same way. Using device-local time here made booking
 * compare mismatched calendar dates on any device not already set to Cairo.
 */
function getCairoYMD(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return {
    y: Number(parts.find((p) => p.type === 'year')?.value),
    m: Number(parts.find((p) => p.type === 'month')?.value),
    d: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

export type DateOption = { id: string; label: string; day: string; date: string };

/**
 * 7-day date selector used in booking UI. A function, not a frozen constant —
 * computed once at module-import time, "today" could still read "Today" a
 * day (or more, across an app left backgrounded) after midnight, and picking
 * it would return zero trips. Call this fresh wherever the picker is shown.
 */
export function getDates(): DateOption[] {
  const result: DateOption[] = [];
  const { y, m, d } = getCairoYMD(new Date());
  for (let i = 0; i < 7; i++) {
    // Once anchored to Cairo's current calendar date, walk forward with pure
    // UTC-midnight arithmetic and format with timeZone: 'UTC' — the
    // calendar date this represents never shifts regardless of the device's
    // own timezone, and matches formatTripDateUTC's output format exactly.
    const anchor = new Date(Date.UTC(y, m - 1, d + i));
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(anchor);
    result.push({
      id: `d${i}`,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekday,
      day: String(anchor.getUTCDate()).padStart(2, '0'),
      date: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(anchor),
    });
  }
  return result;
}

// ── Capacity constants (§4) ───────────────────────────────────────

/** Platform-level vehicle capacity constants — do NOT use bus.capacity (§21.4) */
export const VEHICLE_CAPACITY: Record<string, { totalSeats: number; minRequired: number }> = {
  hiace:   { totalSeats: 14, minRequired: 7 },
  minibus: { totalSeats: 28, minRequired: 14 },
};

// ── Helpers ──────────────────────────────────────────────────────

export function calcSegmentPrice(route: Route, fromIdx: number, toIdx: number, pax: number) {
  const span = Math.max(1, Math.abs(toIdx - fromIdx));
  const perSegment = route.price / Math.max(1, route.path.length - 1);
  const segPrice = Math.max(perSegment * span, perSegment);
  return Math.round(segPrice * pax);
}

export function shuttleStatusLabel(status: string, lang: 'ar' | 'en' = 'ar'): string {
  if (lang === 'ar') {
    switch (status) {
      case 'waiting_driver':  return 'جاري البحث عن سائق';
      case 'scheduled':       return 'مؤكدة';
      case 'driver_assigned': return 'تم تعيين السائق';
      case 'active':          return 'جارية';
      case 'boarding':        return 'جاري الركوب';
      case 'completed':       return 'مكتملة';
      case 'cancelled':       return 'ملغية';
      case 'upcoming':        return 'قادمة';
      default:                return status;
    }
  }
  switch (status) {
    case 'waiting_driver':  return 'Searching for driver';
    case 'scheduled':       return 'Confirmed';
    case 'driver_assigned': return 'Driver assigned';
    case 'active':          return 'Active';
    case 'boarding':        return 'Boarding';
    case 'completed':       return 'Completed';
    case 'cancelled':       return 'Cancelled';
    case 'upcoming':        return 'Upcoming';
    default:                return status;
  }
}

/**
 * Returns true for statuses that mean the trip is still ahead (not done).
 * Used to split upcoming vs past in trip history.
 */
export function isShuttleTripUpcoming(status: ShuttleTripStatus | string): boolean {
  return ['waiting_driver', 'scheduled', 'driver_assigned', 'active', 'boarding', 'upcoming'].includes(status);
}

// D8-7: isTripStatusBookable was removed — dead (zero callers) and directly
// contradicted the live bookable-status check: this one excluded 'active'/
// 'boarding' from the bookable set, which the live one correctly includes.
// Canonical: components/shuttle/tripSheetHelpers.ts::isTripBookable().

/**
 * Parse a bilingual notification body separated by " / " (§3).
 * Returns the Arabic half for 'ar', English half for 'en'.
 */
export function parseNotificationBody(body: string, lang: 'ar' | 'en'): string {
  if (!body.includes(' / ')) return body;
  const [en, ar] = body.split(' / ');
  return lang === 'ar' ? (ar ?? body) : (en ?? body);
}

/**
 * Format a UTC ISO 8601 date string for display in Africa/Cairo timezone (§21.9).
 * Falls back to UTC if Intl timezone support is not available.
 */
export function formatCairoDateTime(raw: string, locale: string = 'en-US'): { date: string; time: string } {
  if (!raw) return { date: '—', time: '—' };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { date: raw, time: '—' };
  try {
    const time = new Intl.DateTimeFormat(locale, {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    // year included — a trip from a different year used to be
    // indistinguishable from one this year (e.g. "12 June" either way).
    const date = new Intl.DateTimeFormat(locale, {
      timeZone: 'Africa/Cairo',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
    return { date, time };
  } catch {
    return {
      date: d.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }),
    };
  }
}

/**
 * Format time-only from UTC ISO to Africa/Cairo display string.
 */
export function formatCairoTime(raw: string, locale: string = 'en-US'): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false });
  }
}
