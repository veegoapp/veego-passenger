/**
 * Pure helpers shared by TripSheet and its extracted presentation sections
 * (TripSheetSections.tsx). Moved verbatim from TripSheet.tsx — no logic changes.
 */

/**
 * §21.2: statuses that mean the trip is ahead and accepting new bookings.
 * Expanded from the old 'open'/'active' check to include all pre-departure states.
 */
export const BOOKABLE_STATUSES = ['scheduled', 'waiting_driver', 'driver_assigned', 'open', 'active', 'boarding'];
export const ACTIVE_STATUSES   = ['active', 'driver_assigned', 'boarding'];

export function isTripBookable(trip: any): boolean {
  const status = (trip?.status ?? trip?.shuttleStatus ?? '').toLowerCase();
  return BOOKABLE_STATUSES.includes(status) && (trip?.availableSeats ?? 0) > 0;
}

export function shuttleStatusLabel(trip: any, t: (key: string) => string): string {
  const status = (trip?.status ?? trip?.shuttleStatus ?? '').toLowerCase();
  switch (status) {
    case 'scheduled':       return t('status_confirmed');
    case 'waiting_driver':  return t('status_searching');
    case 'driver_assigned': return t('status_driver_assigned');
    case 'open':            return t('status_open');
    case 'active':          return t('status_active_trip');
    case 'boarding':        return t('status_boarding');
    case 'completed':       return t('status_completed');
    case 'cancelled':       return t('status_cancelled_trip');
    default:                return status || t('status_upcoming');
  }
}

export function shuttleStatusColor(trip: any): string {
  const status = (trip?.status ?? trip?.shuttleStatus ?? '').toLowerCase();
  switch (status) {
    case 'scheduled':       return '#2563eb'; // blue — confirmed, waiting min pax
    case 'waiting_driver':  return '#d97706'; // amber — searching
    case 'driver_assigned': return '#059669'; // green — driver found
    case 'open':            return '#d97706'; // amber
    case 'active':          return '#16a34a'; // green — en route
    case 'boarding':        return '#7c3aed'; // purple — boarding now
    case 'cancelled':       return '#dc2626'; // red
    default:                return '#6b7280'; // gray
  }
}

/** §21.9: Display departure dates in Africa/Cairo timezone, not UTC */
export function formatTripDateUTC(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}
