import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';

export interface NearbyDriver {
  id: string | number;
  vehicleType: string;
  rating?: number;
  latitude: number;
  longitude: number;
  heading?: number;
  distanceKm?: number;
  etaMinutes?: number;
}

interface UseNearbyDriversOptions {
  /** Only polls while true — set to false once a ride is requested or the screen isn't visible. */
  isActive: boolean;
  location: { latitude: number; longitude: number } | null;
  /** Only drivers whose vehicleType matches this are returned — the backend
   * returns all online drivers regardless of service, so this filter is
   * client-side. */
  serviceType: 'car' | 'scooter' | 'delivery';
}

interface UseNearbyDriversResult {
  drivers: NearbyDriver[];
}

const POLL_INTERVAL_MS = 12000;
const MAX_RENDERED_DRIVERS = 15;

function normalizeDriver(raw: any): NearbyDriver | null {
  const latitude = raw?.currentLatitude ?? raw?.latitude;
  const longitude = raw?.currentLongitude ?? raw?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return {
    id: raw?.id ?? `${latitude},${longitude}`,
    vehicleType: raw?.vehicleType ?? 'car',
    rating: raw?.rating,
    latitude,
    longitude,
    heading: raw?.currentHeading,
    distanceKm: raw?.distanceKm,
    etaMinutes: raw?.etaMinutes,
  };
}

/**
 * Polls GET /nearby-drivers for the pre-booking map (car/scooter/delivery
 * only). Mirrors usePassengerTracking's isActive-driven interval lifecycle —
 * caller is responsible for flipping isActive to false once a ride is
 * requested, the phase leaves the pre-booking screen, or on unmount (the
 * effect cleanup below handles the unmount case automatically).
 */
export function useNearbyDrivers({ isActive, location, serviceType }: UseNearbyDriversOptions): UseNearbyDriversResult {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const serviceTypeRef = useRef(serviceType);
  serviceTypeRef.current = serviceType;

  const fetchDrivers = useCallback(async () => {
    const loc = locationRef.current;
    if (!loc) return;
    try {
      const { data } = await api.get('/nearby-drivers', {
        params: { lat: loc.latitude, lng: loc.longitude },
      });
      const raw: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const wantedType = serviceTypeRef.current;
      const normalized = raw
        .map(normalizeDriver)
        .filter((d): d is NearbyDriver => d !== null)
        // Backend returns all online drivers regardless of service — only
        // show the ones matching what the passenger is currently booking.
        .filter((d) => d.vehicleType.toLowerCase() === wantedType)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        .slice(0, MAX_RENDERED_DRIVERS);
      setDrivers(normalized);
    } catch {
      // Best-effort — nearby drivers are a decorative pre-booking signal,
      // never block or disrupt the booking flow on failure.
    }
  }, []);

  useEffect(() => {
    if (!isActive || !location) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDrivers([]);
      return;
    }

    fetchDrivers();
    intervalRef.current = setInterval(fetchDrivers, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, location, serviceType, fetchDrivers]);

  return { drivers };
}
