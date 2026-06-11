export type Station = {
  id: string;
  name: string;
  area: string;
  distance: string;
  eta: string;
  latitude?: number;
  longitude?: number;
};

export type Route = {
  id: string;
  code: string;
  name: string;
  from: string;
  to: string;
  stations: number;
  duration: string;
  seatsLeft: number;
  totalSeats: number;
  price: number;
  nextDeparture: string;
  color: string;
  path: Station[];
};

export type TripType = 'shuttle' | 'car' | 'scooter';

export type ShuttleTripStatus =
  | 'waiting_driver'
  | 'scheduled'
  | 'driver_assigned'
  | 'active'
  | 'boarding'
  | 'completed'
  | 'cancelled'
  | 'upcoming';

export type Trip = {
  id: string;
  type: TripType;
  routeCode: string;
  routeName: string;
  from: string;
  to: string;
  date: string;
  time: string;
  departureIso: string;
  seat: string;
  status: ShuttleTripStatus;
  price: number;
  tripId?: number | string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  passengerCount?: number;
  minPassengers?: number;
};

export type Notification = {
  id: string;
  type: 'trip' | 'promo' | 'system';
  title: string;
  body: string;
  createdAt: string;
  unread?: boolean;
};

export type Booking = {
  route: Route;
  fromIdx: number;
  toIdx: number;
  passengers: number;
  date: string;
  time: string;
  price: number;
  tripId?: number | null;
};

export const stations: Station[] = [];

export const routes: Route[] = [];


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

export const TIMES = ['08:45', '09:15', '09:45', '10:15', '10:45', '11:15'];

export function calcSegmentPrice(route: Route, fromIdx: number, toIdx: number, pax: number) {
  const span = Math.max(1, Math.abs(toIdx - fromIdx));
  const perSegment = route.price / Math.max(1, route.path.length - 1);
  const segPrice = Math.max(perSegment * span, perSegment);
  return Math.round(segPrice * pax);
}

export function shuttleStatusLabel(status: string, lang: 'ar' | 'en' = 'ar'): string {
  if (lang === 'ar') {
    switch (status) {
      case 'waiting_driver': return 'جاري البحث عن سائق';
      case 'scheduled':      return 'مؤكدة';
      case 'driver_assigned': return 'تم تعيين السائق';
      case 'active':         return 'جارية';
      case 'boarding':       return 'جاري الركوب';
      case 'completed':      return 'مكتملة';
      case 'cancelled':      return 'ملغية';
      case 'upcoming':       return 'قادمة';
      default:               return status;
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

export function isShuttleTripUpcoming(status: ShuttleTripStatus | string): boolean {
  return ['waiting_driver', 'scheduled', 'driver_assigned', 'active', 'boarding', 'upcoming'].includes(status);
}
