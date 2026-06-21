import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, MapPin, Navigation, Phone, Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { PassengerTrackingMap } from '@/components/shared/PassengerTrackingMap';
import { getSocket, getSocketSync } from '@/src/api/socket';
import type { DriverLocation } from '@/src/api/socket';
import api, { tokenStore } from '@/src/api/client';
import { getErrorMessage } from '@/src/utils/errorMessages';

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
  const [status, setStatus] = useState<TripStatus>('driver_assigned');
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  const socketListening = useRef(false);

  // Task 6: Load full ride data when opened via deep link (veego://ride/{id})
  useEffect(() => {
    const deepId = params.id;
    if (!deepId) return;

    setDeepLinkLoading(true);
    api.get(`/rides/${deepId}`)
      .then(async (res) => {
        const d = res.data?.data ?? res.data;
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
          router.replace({ pathname: '/receipt', params: { id: deepId } } as any);
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
    api.get(`/rides/${rideId}`).then((res) => {
      const d = res.data?.data ?? res.data;
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
    }).catch(() => {});
  }, [params.rideId]);

  useEffect(() => {
    const rideId = params.rideId;
    if (!rideId || socketListening.current) return;
    socketListening.current = true;

    // ✅ Store named handler references so socket.off removes only OUR listeners
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
      // Synchronous cleanup — avoids stale listener leak from async getSocket()
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

  const statusColor = STATUS_COLORS[status] ?? '#2563eb';
  const statusLabel = t((STATUS_LABEL_KEYS[status] ?? 'loading') as any);
  const isTerminal = status === 'completed' || status === 'cancelled' || status === 'timeout';

  if (deepLinkLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 14 }}>{t('loading_ride')}</Text>
      </View>
    );
  }

  if (deepLinkError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>{t('ride_not_found')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>{deepLinkError}</Text>
        <TouchableOpacity
          style={[styles.doneBtn, { paddingHorizontal: 32 }]}
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
      </View>

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
              <TouchableOpacity style={styles.callBtn} activeOpacity={0.85}>
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
    paddingHorizontal: 16, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,14,34,0.97)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },

  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  driverInfo: { flex: 1 },
  driverName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  vehicleText: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  callBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.4)',
    backgroundColor: 'rgba(37,99,235,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  routeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    marginBottom: 4,
  },
  routeItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  routeDot: { width: 9, height: 9, borderRadius: 5 },
  routeText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 },
  routeDash: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 },

  doneBtn: {
    marginTop: 12, backgroundColor: '#2563eb',
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
