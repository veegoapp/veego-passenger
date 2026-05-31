import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { MapPin, Car, Navigation, CheckCircle2 } from 'lucide-react-native';
import * as Location from 'expo-location';

import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard } from './DriverAssignedCard';

const USER_LOCATION = { latitude: 30.0444, longitude: 31.2357 };
const DRIVER_LOCATION = { latitude: 30.0390, longitude: 31.2290 };

type Phase = 'idle' | 'searching' | 'driver_assigned' | 'arrived' | 'started' | 'completed';

interface CarMapProps {
  destination?: string | null;
  onClose?: () => void;
}

export function CarMap({ destination, onClose }: CarMapProps) {
  const mapRef = useRef<MapView>(null);

  const [currentPhase, setCurrentPhase] = useState<Phase>('idle');
  const [selectedRideType, setSelectedRideType] = useState<'economy' | 'premium' | null>(null);
  const [liveLocation, setLiveLocation] = useState(USER_LOCATION);
  const [simulatedDriver] = useState(DRIVER_LOCATION);

  const destLat = liveLocation.latitude + 0.006;
  const destLon = liveLocation.longitude + 0.004;

  // عند تغيير الوجهة → ارجع لـ idle وافتح sheet اختيار الرايد
  useEffect(() => {
    if (destination) {
      setCurrentPhase('idle');
      setSelectedRideType(null);
    }
  }, [destination]);

  // أوتو انتقال: searching → driver_assigned بعد 10 ثواني
  useEffect(() => {
    if (currentPhase !== 'searching') return;
    const timer = setTimeout(() => setCurrentPhase('driver_assigned'), 10000);
    return () => clearTimeout(timer);
  }, [currentPhase]);

  // جلب الموقع الحقيقي
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setLiveLocation(coords);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 1000);
      } catch { }
    })();
  }, []);

  // زوم الخريطة تلقائي حسب الـ phase
  useEffect(() => {
    if (!mapRef.current) return;
    const coords = [{ latitude: liveLocation.latitude, longitude: liveLocation.longitude }];
    if (destination) coords.push({ latitude: destLat, longitude: destLon });
    if (['driver_assigned', 'arrived', 'started'].includes(currentPhase)) {
      coords.push({ latitude: simulatedDriver.latitude, longitude: simulatedDriver.longitude });
    }
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 340, left: 60 },
        animated: true,
      });
    }, 400);
  }, [currentPhase, destination, liveLocation]);

  // مسار منحني بين الموقع والوجهة
  const routeCoords = useMemo(() => {
    if (!destination) return [];
    return Array.from({ length: 16 }, (_, i) => {
      const t = i / 15;
      const lat = liveLocation.latitude + (destLat - liveLocation.latitude) * t;
      const lon = liveLocation.longitude + (destLon - liveLocation.longitude) * t;
      const offset = Math.sin(t * Math.PI) * 0.001;
      return { latitude: lat + offset, longitude: lon - offset };
    });
  }, [destination, liveLocation]);

  return (
    <View style={styles.container}>

      {/* الخريطة */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: liveLocation.latitude,
          longitude: liveLocation.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={false}
        compassEnabled={false}
      >
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          maximumZ={19}
          tileSize={256}
        />

        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#111827" strokeWidth={4} />
        )}

        {/* موقع المستخدم */}
        <Marker coordinate={liveLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.userDot}>
            <View style={styles.userDotInner} />
          </View>
        </Marker>

        {/* الوجهة */}
        {destination && (
          <Marker coordinate={{ latitude: destLat, longitude: destLon }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destPin}>
              <MapPin size={13} color="#ffffff" />
            </View>
          </Marker>
        )}

        {/* السائق */}
        {['driver_assigned', 'arrived', 'started'].includes(currentPhase) && (
          <Marker coordinate={simulatedDriver} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverDot}>
              <Car size={14} color="#ffffff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* زر إعادة التمركز */}
      <TouchableOpacity
        style={styles.locBtn}
        onPress={() => mapRef.current?.animateToRegion({ ...liveLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600)}
      >
        <Navigation size={18} color="#111827" fill="#111827" />
      </TouchableOpacity>

      {/* 1. اختيار نوع الرايد */}
      <RideOptionsSheet
        visible={currentPhase === 'idle' && !!destination}
        destination={destination || null}
        selected={selectedRideType}
        onSelect={setSelectedRideType}
        onConfirm={() => setCurrentPhase('searching')}
        onDismiss={() => { onClose?.(); }}
      />

      {/* 2. البحث عن سائق */}
      <DriverSearching
        visible={currentPhase === 'searching'}
        onCancel={() => { setCurrentPhase('idle'); onClose?.(); }}
      />

      {/* 3. السائق وصل */}
      <DriverAssignedCard
        visible={['driver_assigned', 'arrived'].includes(currentPhase)}
        rideType={selectedRideType}
        destination={destination || null}
        onCancel={() => { setCurrentPhase('idle'); onClose?.(); }}
        onStart={() => setCurrentPhase('started')}
      />

      {/* 4. الرحلة جارية */}
      {currentPhase === 'started' && (
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#111827" style={{ marginRight: 8 }} />
            <Text style={styles.statusTxt}>ON THE MOVE — TRACKING LIVE</Text>
          </View>
          <Text style={styles.etaTxt}>Estimated arrival: 12 mins</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10b981', marginTop: 14 }]}
            onPress={() => setCurrentPhase('completed')}
          >
            <Text style={styles.actionBtnTxt}>Arrived at Destination</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 5. انتهاء الرحلة */}
      {currentPhase === 'completed' && (
        <View style={styles.card}>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <CheckCircle2 size={44} color="#10b981" />
            <Text style={[styles.cardTitle, { marginTop: 10 }]}>Hope you enjoyed your ride!</Text>
            <Text style={styles.cardSub}>Payment settled successfully.</Text>
            <View style={styles.invoice}>
              <Text style={styles.invoiceLabel}>Total Fare</Text>
              <Text style={styles.invoiceAmount}>185.00 EGP</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, { width: '100%', backgroundColor: '#111827', marginTop: 4 }]}
              onPress={() => { setCurrentPhase('idle'); setSelectedRideType(null); onClose?.(); }}
            >
              <Text style={styles.actionBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  userDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(17,24,39,0.15)', alignItems: 'center', justifyContent: 'center' },
  userDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  destPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  driverDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 3 },

  locBtn: {
    position: 'absolute', bottom: 200, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },

  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  cardSub: { fontSize: 12.5, color: '#6b7280', marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusTxt: { fontSize: 11, fontWeight: '700', color: '#4b5563', letterSpacing: 0.5 },
  etaTxt: { fontSize: 15, fontWeight: '700', color: '#111827' },
  progressBar: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { width: '40%', height: '100%', backgroundColor: '#111827' },
  actionBtn: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionBtnTxt: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  invoice: { backgroundColor: '#f9fafb', width: '100%', borderRadius: 14, padding: 14, alignItems: 'center', marginVertical: 14 },
  invoiceLabel: { fontSize: 12, color: '#6b7280' },
  invoiceAmount: { fontSize: 22, fontWeight: '800', color: '#10b981', marginTop: 2 },
});
