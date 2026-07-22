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
};

/** Pending booking held in BookingContext while user reviews in ConfirmSheet */
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

/** 7-day date selector used in booking UI */
export const DATES = (() => {
  const result: { id: string; label: string; day: string; date: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    result.push({
      id: `d${i}`,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate().toString().padStart(2, '0'),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }
  return result;
})();

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

/**
 * Returns true if a trip can still be booked (§21.2).
 * Note: "active" here means trip.status, not shuttleStatus.
 */
export function isTripStatusBookable(status: string): boolean {
  return ['scheduled', 'waiting_driver', 'driver_assigned'].includes(status.toLowerCase());
}

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
export function formatCairoDateTime(raw: string): { date: string; time: string } {
  if (!raw) return { date: '—', time: '—' };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { date: raw, time: '—' };
  try {
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      month: 'long',
      day: 'numeric',
    }).format(d);
    return { date, time };
  } catch {
    return {
      date: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }),
    };
  }
}

/**
 * Format time-only from UTC ISO to Africa/Cairo display string.
 */
export function formatCairoTime(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false });
  }
}
