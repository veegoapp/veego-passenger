import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Linking } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, MapPin, Navigation, Phone, ShieldAlert, Star } from 'lucide-react-native';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { ConnectionBanner } from '@/components/shared/ConnectionBanner';
import { useTheme } from '@/context/ThemeContext';
import { PassengerTrackingMap } from '@/components/shared/PassengerTrackingMap';
import { getSocket, getSocketSync } from '@/src/api/socket';
import type { DriverLocation } from '@/src/api/socket';
import { tokenStore } from '@/src/api/client';
import { getRide } from '@/src/api/rideService';
import { getErrorMessage } from '@/src/utils/errorMessages';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { selectActiveRide } from '@/src/session/activeRideSelectors';

const STATUS_LABEL_KEYS: Record<string, string> = {
  searching: 'status_finding_driver',
  driver_assigned: 'status_driver_on_way',
  arrived: 'status_driver_arrived',
  started: 'status_trip_in_progress',
  completed: 'status_trip_completed',
  cancelled: 'status_trip_cancelled',
  timeout: 'status_request_timeout',
};

const STATUS_COLORS: Record<string, string> = {
  searching: '#f59e0b',
  driver_assigned: '#2563eb',
  arrived: '#22c55e',
  started: '#2563eb',
  completed: '#10b981',
  cancelled: '#ef4444',
  timeout: '#ef4444',
};

type TripStatus = keyof typeof STATUS_LABEL_KEYS;

// Mirrors the `vehicleType` field the backend echoes back on a ride record
// (see rideService.ts's POST /rides/request body and useTrips.ts's
// `trip.vehicleType`) — only 'scooter' gets its own marker today, everything
// else (car/delivery/unknown) keeps the existing car marker.
function normalizeVehicleType(raw: unknown): 'car' | 'scooter' {
  return raw === 'scooter' ? 'scooter' : 'car';
}

export default function TripTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL, t } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    rideId?: string;
    pickupLat?: string;
    pickupLng?: string;
    dropoffLat?: string;
    dropoffLng?: string;
  }>();

  // ── ActiveSession integration ───────────────────────────────────────────
  // Use the centralized session as the primary source for rideId-matched
  // screens. This avoids a separate REST round-trip when state is already
  // available and ensures session:snapshot events keep this screen in sync.
  const { session } = useActiveSession();
  const activeRideSnapshot = useMemo(() => selectActiveRide(session), [session]);

  const [pickup, setPickup] = useState<{ latitude: number; longitude: number } | null>(
    params.pickupLat && params.pickupLng
      ? { latitude: parseFloat(params.pickupLat), longitude: parseFloat(params.pickupLng) }
      : null
  );
  const [dropoff, setDropoff] = useState<{ latitude: number; longitude: number } | null>(
    params.dropoffLat && params.dropoffLng
      ? { latitude: parseFloat(params.dropoffLat), longitude: parseFloat(params.dropoffLng) }
      : null
  );
  const [driverInfo, setDriverInfo] = useState<{
    name?: string; vehicle?: string; rating?: string; phone?: string;
  }>({});

  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // This screen only ever tracks car/scooter/delivery rides (shuttle uses
  // trip-detail.tsx instead) — default to 'car', refine to 'scooter' below
  // once the ride's vehicleType is known.
  const [vehicleType, setVehicleType] = useState<'car' | 'scooter'>('car');
  const [status, setStatus] = useState<TripStatus>('driver_assigned');
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const socketListening = useRef(false);

  // ── Seed from ActiveSession ───────────────────────────────────────────────
  // When the centralized session has data for the ride this screen is tracking,
  // apply it immediately (no REST round-trip needed). This also re-applies on
  // every session:snapshot that the ActiveSessionContext receives, keeping
  // driver info and location up to date from the authoritative snapshot.
  //
  // The deep-link path (params.id) fetches its own data independently because
  // it must perform an ownership check before rendering anything.
  useEffect(() => {
    const rideId = params.rideId;
    if (!rideId || !activeRideSnapshot) return;
    if (activeRideSnapshot.rideId !== rideId) return;

    // Status — map the selector's RideStatus to this screen's TripStatus
    // (the value sets are identical, so a direct cast is safe).
    setStatus(activeRideSnapshot.status as TripStatus);

    // Driver info
    if (activeRideSnapshot.driver) {
      const d = activeRideSnapshot.driver;
      setDriverInfo({
        name: d.name || undefined,
        vehicle: d.vehicle || undefined,
        rating: d.rating != null ? String(d.rating) : undefined,
        phone: d.phone || undefined,
      });
    }

    // Driver location
    if (activeRideSnapshot.driverLocation) {
      setDriverLocation(activeRideSnapshot.driverLocation);
    }

    // Vehicle type for the map marker
    setVehicleType(normalizeVehicleType(activeRideSnapshot.rideType));

    // Pickup / dropoff coords from ActiveSession (fills in when nav params
    // didn't carry them, e.g. after a cold-start recovery).
    if (!pickup) {
      setPickup({
        latitude: activeRideSnapshot.pickup.latitude,
        longitude: activeRideSnapshot.pickup.longitude,
      });
    }
    if (!dropoff) {
      setDropoff({
        latitude: activeRideSnapshot.dropoff.latitude,
        longitude: activeRideSnapshot.dropoff.longitude,
      });
    }
  }, [activeRideSnapshot, params.rideId]);

  // Task 6: Load full ride data when opened via deep link (veego://ride/{id})
  useEffect(() => {
    const deepId = params.id;
    if (!deepId) return;

    setDeepLinkLoading(true);
    getRide(deepId)
      .then(async (res) => {
        const d = res?.data ?? res;
        const rideStatus: string = d?.status ?? d?.rideStatus ?? '';
        const normalized = rideStatus.toLowerCase();

        // Ownership check: ride must belong to authenticated user
        try {
          const tok = await tokenStore.getToken(tokenStore.TOKEN_KEY);
          if (tok) {
            const payload = JSON.parse(atob(tok.split('.')[1]));
            const currentUserId = payload.sub ?? payload.userId ?? payload.id ?? null;
            const ridePassengerId = d?.passengerId ?? d?.userId ?? null;
            if (currentUserId != null && ridePassengerId != null &&
                String(ridePassengerId) !== String(currentUserId)) {
              router.replace('/(tabs)' as any);
              return;
            }
          }
        } catch {}

        if (normalized === 'completed' || normalized === 'cancelled') {
          // receipt.tsx reads `rideId` (not `id`) and uses it both to check
          // whether this ride was already rated and to submit the rating —
          // passing the wrong key silently broke that lookup and the
          // eventual POST /rides/:id/rate-driver call.
          const fare = d?.fare ?? d?.finalPrice;
          const pickupAddress = d?.pickupAddress ?? d?.pickup_address;
          const dropoffAddress = d?.dropoffAddress ?? d?.dropoff_address;
          router.replace({
            pathname: '/receipt',
            params: {
              rideId: deepId,
              ...(fare != null ? { fare: String(fare) } : {}),
              ...(pickupAddress ? { pickup: pickupAddress } : {}),
              ...(dropoffAddress ? { dropoff: dropoffAddress } : {}),
              ...(d?.driver?.name ? { driverName: d.driver.name } : {}),
              ...(d?.driver?.rating != null ? { driverRating: String(d.driver.rating) } : {}),
            },
          } as any);
          return;
        }

        if (d?.pickupLatitude != null && d?.pickupLongitude != null) {
          setPickup({ latitude: d.pickupLatitude, longitude: d.pickupLongitude });
        }
        if (d?.dropoffLatitude != null && d?.dropoffLongitude != null) {
          setDropoff({ latitude: d.dropoffLatitude, longitude: d.dropoffLongitude });
        }
        if (d?.driver) {
          setDriverInfo({
            name: d.driver.name,
            vehicle: d.driver.vehicle,
            rating: d.driver.rating != null ? String(d.driver.rating) : undefined,
            phone: d.driver.phone,
          });
        }
        if (d?.driverLocation) {
          setDriverLocation(d.driverLocation);
        }
        if (d?.vehicleType != null || d?.type != null || d?.serviceType != null) {
          setVehicleType(normalizeVehicleType(d.vehicleType ?? d.type ?? d.serviceType));
        }
        if (normalized && normalized in STATUS_LABEL_KEYS) {
          setStatus(normalized as TripStatus);
        }
      })
      .catch((e: any) => {
        const code: string = e?.response?.data?.code ?? '';
        const status = e?.response?.status;
        if (code === 'RIDE_NOT_FOUND' || status === 403 || status === 404) {
          setDeepLinkError(getErrorMessage(code, e?.response?.data?.message));
        }
      })
      .finally(() => setDeepLinkLoading(false));
  }, [params.id]);

  // Fetch ride/driver info from server on mount (never trust nav params for sensitive data)
  useEffect(() => {
    const rideId = params.rideId;
    if (!rideId) return;
    getRide(rideId).then((res) => {
      const d = res?.data ?? res;
      if (d?.driver) {
        setDriverInfo({
          name: d.driver.name,
          vehicle: d.driver.vehicle,
          rating: d.driver.rating != null ? String(d.driver.rating) : undefined,
          phone: d.driver.phone,
        });
      }
      if (d?.driverLocation) setDriverLocation(d.driverLocation);
      if (d?.pickupLatitude != null && d?.pickupLongitude != null) {
        setPickup({ latitude: d.pickupLatitude, longitude: d.pickupLongitude });
      }
      if (d?.dropoffLatitude != null && d?.dropoffLongitude != null) {
        setDropoff({ latitude: d.dropoffLatitude, longitude: d.dropoffLongitude });
      }
      if (d?.vehicleType != null || d?.type != null || d?.serviceType != null) {
        setVehicleType(normalizeVehicleType(d.vehicleType ?? d.type ?? d.serviceType));
      }
    }).catch(() => {});
  }, [params.rideId]);

  useEffect(() => {
    const rideId = params.rideId;
    if (!rideId || socketListening.current) return;
    socketListening.current = true;

    const onDriverLocation = (data: any) => {
      if (data.rideId !== rideId) return;
      setDriverLocation(data.location);
    };
    const onArrived = (data: any) => {
      if (data.rideId !== rideId) return;
      setStatus('arrived');
    };
    const onStarted = (data: any) => {
      if (data.rideId !== rideId) return;
      setStatus('started');
    };
    const onCompleted = (data: any) => {
      if (data.rideId !== rideId) return;
      setStatus('completed');
      setTimeout(() => router.back(), 3000);
    };
    const onCancelled = (data: any) => {
      if (data.rideId !== rideId) return;
      setStatus('cancelled');
      setTimeout(() => router.back(), 3000);
    };

    getSocket().then((socket) => {
      socket.on('ride:driver_location', onDriverLocation);
      socket.on('ride:arrived', onArrived);
      socket.on('ride:started', onStarted);
      socket.on('ride:completed', onCompleted);
      socket.on('ride:cancelled', onCancelled);
    }).catch(() => {});

    return () => {
      const s = getSocketSync();
      if (s) {
        s.off('ride:driver_location', onDriverLocation);
        s.off('ride:arrived', onArrived);
        s.off('ride:started', onStarted);
        s.off('ride:completed', onCompleted);
        s.off('ride:cancelled', onCancelled);
      }
      socketListening.current = false;
    };
  }, [params.rideId]);

  const tripPhase = useMemo<'driver_arriving' | 'trip_started' | null>(() => {
    if (status === 'driver_assigned' || status === 'arrived') return 'driver_arriving';
    if (status === 'started') return 'trip_started';
    return null;
  }, [status]);

  const statusColor = STATUS_COLORS[status] ?? '#2563eb';
  const statusLabel = t((STATUS_LABEL_KEYS[status] ?? 'loading') as any);
  const isTerminal = status === 'completed' || status === 'cancelled' || status === 'timeout';

  if (deepLinkLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <AppLoader />
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: Spacing.md, fontSize: Typography.size.sm }}>{t('loading_ride')}</Text>
      </View>
    );
  }

  if (deepLinkError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }]}>
        <Text style={{ color: '#ef4444', fontSize: Typography.size.md, fontWeight: Typography.weight.bold, textAlign: 'center', marginBottom: Spacing.sm }}>{t('ride_not_found')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginBottom: Spacing.xl }}>{deepLinkError}</Text>
        <TouchableOpacity
          style={[styles.doneBtn, { paddingHorizontal: Spacing.xxl }]}
          onPress={() => router.replace('/(tabs)' as any)}
          activeOpacity={0.9}
        >
          <Text style={styles.doneBtnText}>{t('go_home')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PassengerTrackingMap
        pickup={pickup}
        dropoff={dropoff}
        driverLocation={driverLocation}
        vehicleType={vehicleType}
        tripPhase={tripPhase}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          {isRTL ? <ArrowRight size={20} color="#fff" /> : <ArrowLeft size={20} color="#fff" />}
        </TouchableOpacity>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          {status === 'searching' && (
            <ActivityIndicator size="small" color={statusColor} style={{ marginRight: 6 }} />
          )}
          {status !== 'searching' && (
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          )}
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {/* SOS — only once the ride is underway */}
        {status === 'started' && (
          <TouchableOpacity
            style={styles.sosBtn}
            onPress={() => setSafetyOpen(true)}
            activeOpacity={0.85}
            accessibilityLabel="Send SOS"
          >
            <ShieldAlert size={16} color="#fff" />
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        )}
      </View>

      <SafetySheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        rideId={params.rideId ?? params.id ?? null}
        driverName={driverInfo.name}
        vehicle={driverInfo.vehicle}
        fallbackCoords={pickup}
      />

      {/* Realtime connection indicator */}
      <ConnectionBanner style={{ position: 'absolute', top: insets.top + 64, alignSelf: 'center', zIndex: 40 }} />

      {/* Bottom card */}
      <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
        {/* Driver info */}
        {driverInfo.name ? (
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {driverInfo.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverInfo.name}</Text>
              <View style={styles.driverMeta}>
                {driverInfo.rating && (
                  <View style={styles.ratingRow}>
                    <Star size={11} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>{parseFloat(driverInfo.rating).toFixed(1)}</Text>
                  </View>
                )}
                {driverInfo.vehicle && (
                  <Text style={styles.vehicleText}>{driverInfo.vehicle}</Text>
                )}
              </View>
            </View>
            {driverInfo.phone ? (
              <TouchableOpacity
                style={styles.callBtn}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(`tel:${driverInfo.phone}`)}
              >
                <Phone size={18} color="#2563eb" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Navigation size={18} color="#fff" />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{t('your_driver')}</Text>
              <Text style={styles.vehicleText}>{t('tracking_live')}</Text>
            </View>
          </View>
        )}

        {/* Route summary */}
        {(pickup || dropoff) && (
          <View style={styles.routeRow}>
            {pickup && (
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.routeText} numberOfLines={1}>{t('pickup')}</Text>
              </View>
            )}
            {pickup && dropoff && <View style={styles.routeDash} />}
            {dropoff && (
              <View style={styles.routeItem}>
                <MapPin size={10} color="#ef4444" />
                <Text style={styles.routeText} numberOfLines={1}>{t('dropoff')}</Text>
              </View>
            )}
          </View>
        )}

        {isTerminal && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Text style={styles.doneBtnText}>
              {status === 'completed' ? t('done') : t('go_back')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0e22' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
    paddingHorizontal: Spacing.lg, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: Spacing.sm,
    borderRadius: 99, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: Typography.weight.semibold },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dc2626', borderRadius: 99,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8, elevation: 6,
  },
  sosBtnText: { fontSize: Typography.size.xs, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,14,34,0.97)',
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: 20, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: Spacing.lg,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { color: '#fff', fontSize: Typography.size.lg, fontWeight: Typography.weight.bold },
  driverInfo: { flex: 1 },
  driverName: { color: '#fff', fontSize: Typography.size.md, fontWeight: Typography.weight.bold },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: '#f59e0b', fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
  vehicleText: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.size.xs },
  callBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.4)',
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  routeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    marginBottom: Spacing.xs,
  },
  routeItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  routeDot: { width: 9, height: 9, borderRadius: 5 },
  routeText: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.size.xs, flex: 1 },
  routeDash: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 },

  doneBtn: {
    marginTop: Spacing.md, backgroundColor: '#2563eb',
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: Typography.weight.bold, fontSize: 15 },
});
