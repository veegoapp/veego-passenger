import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Text,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { MapPin, Car, Navigation, Search, CheckCircle2 } from 'lucide-react-native';
import * as Location from 'expo-location';
import { ScrollView } from 'react-native-gesture-handler';

import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard } from './DriverAssignedCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const USER_LOCATION = { latitude: 30.0444, longitude: 31.2357 };
const DRIVER_LOCATION = { latitude: 30.0390, longitude: 31.2290 };

type Phase = 'idle' | 'searching' | 'driver_assigned' | 'arrived' | 'started' | 'completed';

interface CarMapProps {
  phase?: Phase;
  destination?: string | null;
  onCloseShuttleSheet?: () => void;
}

export function CarMap({ destination: initialDestination, onCloseShuttleSheet }: CarMapProps) {
  const mapRef = useRef<MapView>(null);

  const [currentPhase, setCurrentPhase] = useState<Phase>('idle');
  const [selectedRideType, setSelectedRideType] = useState<'economy' | 'premium' | null>(null);
  const [destination, setDestination] = useState<string | null>(initialDestination || 'Smart Village');
  const [liveLocation, setLiveLocation] = useState(USER_LOCATION);
  const [simulatedDriver, setSimulatedDriver] = useState(DRIVER_LOCATION);

  const destLat = liveLocation.latitude + 0.006;
  const destLon = liveLocation.longitude + 0.004;

  const curvedRouteCoordinates = useMemo(() => {
    if (!destination) return [];
    const points = [];
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = liveLocation.latitude + (destLat - liveLocation.latitude) * t;
      const lon = liveLocation.longitude + (destLon - liveLocation.longitude) * t;
      const offset = Math.sin(t * Math.PI) * 0.001;
      points.push({ latitude: lat + offset, longitude: lon - offset });
    }
    return points;
  }, [destination, liveLocation]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const currentCoords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setLiveLocation(currentCoords);
        mapRef.current?.animateToRegion({ ...currentCoords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 1000);
      } catch (error) {
        console.log('Location fetch omitted or error:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const coords = [{ latitude: liveLocation.latitude, longitude: liveLocation.longitude }];
    if (destination) coords.push({ latitude: destLat, longitude: destLon });
    if (['driver_assigned', 'arrived', 'started'].includes(currentPhase)) {
      coords.push({ latitude: simulatedDriver.latitude, longitude: simulatedDriver.longitude });
    }
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    }, 300);
  }, [currentPhase, destination, simulatedDriver, liveLocation]);

  return (
    <View style={styles.container}>

      {/* Map */}
      <View style={styles.mapWrapper}>
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

          {destination && curvedRouteCoordinates.length > 0 && (
            <Polyline
              coordinates={curvedRouteCoordinates}
              strokeColor="#111827"
              strokeWidth={4}
            />
          )}

          <Marker coordinate={{ latitude: liveLocation.latitude, longitude: liveLocation.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarkerContainer}>
              <View style={styles.userMarkerDot} />
            </View>
          </Marker>

          {destination && (
            <Marker coordinate={{ latitude: destLat, longitude: destLon }} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.destMarkerContainer}>
                <View style={styles.destMarkerCircle}>
                  <MapPin size={13} color="#ffffff" />
                </View>
              </View>
            </Marker>
          )}

          {['driver_assigned', 'arrived', 'started'].includes(currentPhase) && (
            <Marker coordinate={{ latitude: simulatedDriver.latitude, longitude: simulatedDriver.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarkerBox}>
                <Car size={14} color="#ffffff" />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Floating search box */}
        <View style={styles.floatingSearchBox}>
          <View style={styles.searchRow}>
            <View style={[styles.indicatorDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.locationText}>Maadi Degla, Cairo</Text>
          </View>
          <View style={styles.searchDivider} />
          <View style={styles.searchRow}>
            <View style={[styles.indicatorDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.locationText, { flex: 1 }]}>{destination || 'Where to?'}</Text>
            <Search size={16} color="#9ca3af" />
          </View>
        </View>

        {/* My location button */}
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={() => mapRef.current?.animateToRegion({ ...liveLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600)}
        >
          <Navigation size={18} color="#111827" fill="#111827" />
        </TouchableOpacity>
      </View>

      {/* Phase: idle — ride options */}
      <RideOptionsSheet
        visible={currentPhase === 'idle'}
        destination={destination}
        selected={selectedRideType}
        onSelect={setSelectedRideType}
        onConfirm={() => setCurrentPhase('searching')}
        onDismiss={() => {
          if (onCloseShuttleSheet) onCloseShuttleSheet();
        }}
      />

      {/* Phase: searching */}
      <DriverSearching
        visible={currentPhase === 'searching'}
      />

      {/* Phase: driver_assigned / arrived */}
      <DriverAssignedCard
        visible={['driver_assigned', 'arrived'].includes(currentPhase)}
        rideType={selectedRideType}
        destination={destination}
        onCancel={() => setCurrentPhase('idle')}
      />

      {/* Phase: started */}
      {currentPhase === 'started' && (
        <View style={styles.bottomSheetCard}>
          <View style={styles.statusRowHeader}>
            <ActivityIndicator size="small" color="#111827" style={{ marginRight: 8 }} />
            <Text style={styles.phaseIndicatorTxt}>On the move... Tracking path live</Text>
          </View>
          <Text style={styles.etaCounterLabel}>Estimated Time to Destination: 12 mins</Text>
          <View style={styles.linearBarContainer}>
            <View style={styles.linearBarFillProgress} />
          </View>
          <TouchableOpacity
            style={[styles.confirmBoardedBtn, { marginTop: 15, backgroundColor: '#10b981' }]}
            onPress={() => setCurrentPhase('completed')}
          >
            <Text style={styles.confirmBoardedBtnTxt}>End Simulation Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Phase: completed */}
      {currentPhase === 'completed' && (
        <View style={styles.bottomSheetCard}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <CheckCircle2 size={40} color="#10b981" />
            <Text style={[styles.sheetTitle, { marginTop: 10 }]}>Hope you enjoyed your ride!</Text>
            <Text style={styles.sheetSubtitle}>Your account payment settlement completed smoothly.</Text>

            <View style={styles.invoiceFlatCard}>
              <Text style={styles.invoiceFlatLabel}>Total Fare Charged</Text>
              <Text style={styles.invoiceFlatPrice}>185.00 EGP</Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmBoardedBtn, { width: '100%', backgroundColor: '#111827' }]}
              onPress={() => {
                setCurrentPhase('idle');
                setSelectedRideType(null);
              }}
            >
              <Text style={styles.confirmBoardedBtnTxt}>Done & Back Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manual test panel */}
      <View style={styles.manualTestControlPanel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 10 }}>
          <Text style={styles.testLabelTxt}>Test Steps:</Text>
          <TouchableOpacity style={styles.testMiniBtn} onPress={() => setCurrentPhase('idle')}><Text style={styles.testMiniBtnTxt}>Idle</Text></TouchableOpacity>
          <TouchableOpacity style={styles.testMiniBtn} onPress={() => setCurrentPhase('searching')}><Text style={styles.testMiniBtnTxt}>Searching</Text></TouchableOpacity>
          <TouchableOpacity style={styles.testMiniBtn} onPress={() => setCurrentPhase('driver_assigned')}><Text style={styles.testMiniBtnTxt}>Assigned</Text></TouchableOpacity>
          <TouchableOpacity style={styles.testMiniBtn} onPress={() => setCurrentPhase('arrived')}><Text style={styles.testMiniBtnTxt}>Arrived</Text></TouchableOpacity>
          <TouchableOpacity style={styles.testMiniBtn} onPress={() => setCurrentPhase('started')}><Text style={styles.testMiniBtnTxt}>Started</Text></TouchableOpacity>
          <TouchableOpacity style={styles.testMiniBtn} onPress={() => setCurrentPhase('completed')}><Text style={styles.testMiniBtnTxt}>Completed</Text></TouchableOpacity>
        </ScrollView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  mapWrapper: { flex: 1, position: 'relative' },

  userMarkerContainer: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(17,24,39,0.15)', alignItems: 'center', justifyContent: 'center' },
  userMarkerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  destMarkerContainer: { alignItems: 'center' },
  destMarkerCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  driverMarkerBox: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 3 },

  floatingSearchBox: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 26 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  locationText: { fontSize: 13.5, fontWeight: '500', color: '#1f2937' },
  searchDivider: { height: 1, backgroundColor: 'rgba(229, 231, 235, 0.7)', marginVertical: 8, marginLeft: 16 },

  myLocationButton: {
    position: 'absolute',
    bottom: 310,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },

  bottomSheetCard: {
    position: 'absolute',
    bottom: 75,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  sheetSubtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 3, lineHeight: 17 },
  statusRowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  phaseIndicatorTxt: { fontSize: 11.5, fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' },
  confirmBoardedBtn: { backgroundColor: '#111827', height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  confirmBoardedBtnTxt: { color: '#ffffff', fontSize: 13.5, fontWeight: '600' },

  etaCounterLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 6 },
  linearBarContainer: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  linearBarFillProgress: { width: '40%', height: '100%', backgroundColor: '#111827' },

  invoiceFlatCard: { backgroundColor: '#f9fafb', width: '100%', padding: 12, borderRadius: 14, alignItems: 'center', marginVertical: 12 },
  invoiceFlatLabel: { fontSize: 12, color: '#6b7280' },
  invoiceFlatPrice: { fontSize: 20, fontWeight: '800', color: '#10b981', marginTop: 2 },

  manualTestControlPanel: { position: 'absolute', bottom: 15, left: 0, right: 0, height: 45, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb', justifyContent: 'center' },
  testLabelTxt: { fontSize: 11, fontWeight: '700', color: '#6b7280', alignSelf: 'center', marginRight: 4 },
  testMiniBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'center' },
  testMiniBtnTxt: { fontSize: 11, fontWeight: '600', color: '#1f2937' },
});
