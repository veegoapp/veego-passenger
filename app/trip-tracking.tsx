import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, MapPin, Navigation, Phone, Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { PassengerTrackingMap } from '@/components/PassengerTrackingMap';
import { getSocket } from '@/src/api/socket';
import type { DriverLocation } from '@/src/api/socket';

const STATUS_LABELS: Record<string, string> = {
  searching: 'Finding your driver…',
  driver_assigned: 'Driver is on the way',
  arrived: 'Driver has arrived',
  started: 'Trip in progress',
  completed: 'Trip completed',
  cancelled: 'Trip cancelled',
  timeout: 'Request timed out',
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

type TripStatus = keyof typeof STATUS_LABELS;

export default function TripTrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useTheme();
  const params = useLocalSearchParams<{
    rideId: string;
    pickupLat: string;
    pickupLng: string;
    dropoffLat: string;
    dropoffLng: string;
    driverLat?: string;
    driverLng?: string;
    driverName?: string;
    driverVehicle?: string;
    driverRating?: string;
    driverPhone?: string;
  }>();

  const pickup = params.pickupLat && params.pickupLng
    ? { latitude: parseFloat(params.pickupLat), longitude: parseFloat(params.pickupLng) }
    : null;

  const dropoff = params.dropoffLat && params.dropoffLng
    ? { latitude: parseFloat(params.dropoffLat), longitude: parseFloat(params.dropoffLng) }
    : null;

  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    params.driverLat && params.driverLng
      ? { latitude: parseFloat(params.driverLat), longitude: parseFloat(params.driverLng) }
      : null
  );
  const [status, setStatus] = useState<TripStatus>('driver_assigned');
  const socketListening = useRef(false);

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
      // ✅ Pass handler reference — removes only this component's listeners
      getSocket().then((socket) => {
        socket.off('ride:driver_location', onDriverLocation);
        socket.off('ride:arrived', onArrived);
        socket.off('ride:started', onStarted);
        socket.off('ride:completed', onCompleted);
        socket.off('ride:cancelled', onCancelled);
      }).catch(() => {});
      socketListening.current = false;
    };
  }, [params.rideId]);

  const statusColor = STATUS_COLORS[status] ?? '#2563eb';
  const statusLabel = STATUS_LABELS[status] ?? 'Tracking ride…';
  const isTerminal = status === 'completed' || status === 'cancelled' || status === 'timeout';

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
        {params.driverName ? (
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {params.driverName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{params.driverName}</Text>
              <View style={styles.driverMeta}>
                {params.driverRating && (
                  <View style={styles.ratingRow}>
                    <Star size={11} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>{parseFloat(params.driverRating).toFixed(1)}</Text>
                  </View>
                )}
                {params.driverVehicle && (
                  <Text style={styles.vehicleText}>{params.driverVehicle}</Text>
                )}
              </View>
            </View>
            {params.driverPhone ? (
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
              <Text style={styles.driverName}>Your Driver</Text>
              <Text style={styles.vehicleText}>Tracking live location…</Text>
            </View>
          </View>
        )}

        {/* Route summary */}
        {(pickup || dropoff) && (
          <View style={styles.routeRow}>
            {pickup && (
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.routeText} numberOfLines={1}>Pickup</Text>
              </View>
            )}
            {pickup && dropoff && <View style={styles.routeDash} />}
            {dropoff && (
              <View style={styles.routeItem}>
                <MapPin size={10} color="#ef4444" />
                <Text style={styles.routeText} numberOfLines={1}>Dropoff</Text>
              </View>
            )}
          </View>
        )}

        {isTerminal && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Text style={styles.doneBtnText}>
              {status === 'completed' ? 'Done' : 'Go Back'}
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
