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

export type TripType = 'shuttle' | 'car' | 'bike';

export type Trip = {
  id: string;
  type: TripType;
  routeCode: string;
  routeName: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seat: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  price: number;
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
};

export const stations: Station[] = [
  { id: 's1', name: 'الخارجة - وسط المدينة', area: 'الخارجة', distance: '240 م', eta: '3 دقائق', latitude: 25.4456, longitude: 30.5480 },
  { id: 's2', name: 'سوق الخارجة', area: 'الخارجة', distance: '650 م', eta: '7 دقائق', latitude: 25.4425, longitude: 30.5445 },
  { id: 's3', name: 'مستشفى الخارجة', area: 'الخارجة', distance: '1.1 كم', eta: '12 دقيقة', latitude: 25.4510, longitude: 30.5420 },
  { id: 's4', name: 'جامعة وادي الجديد', area: 'الخارجة', distance: '1.6 كم', eta: '16 دقيقة', latitude: 25.4580, longitude: 30.5390 },
  { id: 's5', name: 'الداخلة - موط', area: 'الداخلة', distance: '2.0 كم', eta: '21 دقيقة', latitude: 25.4950, longitude: 30.5280 },
  { id: 's6', name: 'قصر الداخلة', area: 'الداخلة', distance: '2.4 كم', eta: '24 دقيقة', latitude: 25.5020, longitude: 30.5250 },
];

const path = (ids: string[]) =>
  ids.map((id) => stations.find((s) => s.id === id)!).filter(Boolean);

export const routes: Route[] = [
  {
    id: 'r1',
    code: 'L01',
    name: 'خط الخارجة السريع',
    from: 'الخارجة - وسط المدينة',
    to: 'جامعة وادي الجديد',
    stations: 5,
    duration: '28 دقيقة',
    seatsLeft: 7,
    totalSeats: 18,
    price: 15,
    nextDeparture: '08:45',
    color: '#d8ecf7',
    path: path(['s1', 's2', 's3', 's5', 's4']),
  },
  {
    id: 'r2',
    code: 'L02',
    name: 'خط الداخلة',
    from: 'مستشفى الخارجة',
    to: 'قصر الداخلة',
    stations: 6,
    duration: '34 دقيقة',
    seatsLeft: 3,
    totalSeats: 18,
    price: 20,
    nextDeparture: '09:10',
    color: '#d5f0e5',
    path: path(['s3', 's2', 's1', 's5', 's4', 's6']),
  },
  {
    id: 'r3',
    code: 'L03',
    name: 'خط الجامعة',
    from: 'الداخلة - موط',
    to: 'سوق الخارجة',
    stations: 4,
    duration: '22 دقيقة',
    seatsLeft: 12,
    totalSeats: 18,
    price: 12,
    nextDeparture: '09:25',
    color: '#e3daf5',
    path: path(['s5', 's4', 's3', 's2']),
  },
  {
    id: 'r4',
    code: 'L04',
    name: 'خط الليل',
    from: 'جامعة وادي الجديد',
    to: 'الخارجة - وسط المدينة',
    stations: 5,
    duration: '30 دقيقة',
    seatsLeft: 16,
    totalSeats: 18,
    price: 10,
    nextDeparture: '22:15',
    color: '#f5f0d3',
    path: path(['s4', 's5', 's3', 's2', 's1']),
  },
];

export const upcomingTrips: Trip[] = [
  {
    id: 't1',
    type: 'shuttle',
    routeCode: 'L01',
    routeName: 'خط الخارجة السريع',
    from: 'الخارجة - وسط المدينة',
    to: 'جامعة وادي الجديد',
    date: 'اليوم',
    time: '08:45',
    seat: 'B3',
    status: 'upcoming',
    price: 15,
  },
  {
    id: 't2',
    type: 'car',
    routeCode: 'CAR',
    routeName: 'رحلة خاصة',
    from: 'سوق الخارجة',
    to: 'الداخلة - موط',
    date: 'غداً',
    time: '07:30',
    seat: '—',
    status: 'upcoming',
    price: 45,
  },
];

export const pastTrips: Trip[] = [
  {
    id: 'p1',
    type: 'shuttle',
    routeCode: 'L02',
    routeName: 'خط الداخلة',
    from: 'مستشفى الخارجة',
    to: 'قصر الداخلة',
    date: '18 مايو',
    time: '18:20',
    seat: 'C4',
    status: 'completed',
    price: 20,
  },
  {
    id: 'p2',
    type: 'bike',
    routeCode: 'BIKE',
    routeName: 'دراجة نارية',
    from: 'الخارجة - وسط المدينة',
    to: 'سوق الخارجة',
    date: '16 مايو',
    time: '08:45',
    seat: '—',
    status: 'completed',
    price: 15,
  },
  {
    id: 'p3',
    type: 'shuttle',
    routeCode: 'L01',
    routeName: 'خط الخارجة السريع',
    from: 'الخارجة - وسط المدينة',
    to: 'جامعة وادي الجديد',
    date: '14 مايو',
    time: '08:45',
    seat: 'B1',
    status: 'completed',
    price: 15,
  },
];

export const notifications: Notification[] = [
  {
    id: 'n1',
    category: 'trip',
    title: 'الباص يصل خلال 3 دقائق',
    body: 'L01 خط الخارجة السريع يصل إلى الخارجة - وسط المدينة.',
    time: 'منذ دقيقتين',
    unread: true,
  },
  {
    id: 'n2',
    category: 'promo',
    title: 'خصم 20% على رحلات الصباح',
    body: 'استمتع بخصم على جميع المغادرات قبل الساعة 9 هذا الأسبوع.',
    time: 'منذ ساعة',
    unread: true,
  },
  {
    id: 'n3',
    category: 'system',
    title: 'محطة جديدة أُضيفت',
    body: 'قصر الداخلة أصبح الآن جزءاً من خط الداخلة.',
    time: 'أمس',
  },
  {
    id: 'n4',
    category: 'trip',
    title: 'اكتملت رحلتك',
    body: 'شكراً على ركوبك خط الداخلة. قيّم رحلتك.',
    time: 'منذ يومين',
  },
];

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
