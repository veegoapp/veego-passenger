import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  TouchableOpacity, 
  Platform, 
  Text, 
  Dimensions, 
  PanResponder,
  Modal,
  ActivityIndicator
} from 'react-native';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { 
  MapPin, 
  Car, 
  Navigation, 
  Star, 
  Phone, 
  MessageSquare, 
  XCircle, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronDown,
  User,
  Search
} from 'lucide-react-native';
import * as Location from 'expo-location';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// إحداثيات افتراضية ثابتة للـ Mock
const USER_LOCATION = { latitude: 30.0444, longitude: 31.2357 };
const DRIVER_LOCATION = { latitude: 30.0390, longitude: 31.2290 };

type Phase = 'idle' | 'searching' | 'driver_assigned' | 'arrived' | 'started' | 'completed';

interface CarMapProps {
  phase?: Phase;
  destination?: string | null;
  onCloseShuttleSheet?: () => void; // متاح لربطه مع إغلاق صفحة الشاتيل عند السحب لأسفل
}

export function CarMap({ destination: initialDestination, onCloseShuttleSheet }: CarMapProps) {
  const mapRef = useRef<MapView>(null);
  const radarPulse = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // إدارة الحالات يدوياً للتيست الكامل بناءً على رغبتك
  const [currentPhase, setCurrentPhase] = useState<Phase>('idle');
  const [destination, setDestination] = useState<string | null>(initialDestination || 'Smart Village');
  const [liveLocation, setLiveLocation] = useState(USER_LOCATION);
  const [simulatedDriver, setSimulatedDriver] = useState(DRIVER_LOCATION);

  // إحداثيات الوجهة التخيلية المقيدة بموقعك
  const destLat = liveLocation.latitude + 0.006;
  const destLon = liveLocation.longitude + 0.004;

  // تأثير لوجيك الرادار النبضي المطور في مرحلة البحث
  useEffect(() => {
    if (currentPhase === 'searching') {
      radarPulse.setValue(0);
      Animated.loop(
        Animated.timing(radarPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      radarPulse.setValue(0);
    }
  }, [currentPhase]);

  // توليد مسار شوارع ملتوي ومنحني بدقة لإلغاء فكرة الخط المستقيم
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

  // جلب موقع العميل الفعلي فور تشغيل الخريطة
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const currentCoords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setLiveLocation(currentCoords);
        mapRef.current?.animateToRegion({ ...currentCoords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 1000);
      } catch (error) {
        console.log("Location fetch omitted or error:", error);
      }
    })();
  }, []);

  // التحكم التلقائي بالكاميرا والزوم لمتابعة حركة الماركرز بدقة وحساب الـ padding السفلية للـ Sheets
  useEffect(() => {
    if (!mapRef.current) return;
    const coords = [{ latitude: liveLocation.latitude, longitude: liveLocation.longitude }];
    if (destination) coords.push({ latitude: destLat, longitude: destLon });
    if (['driver_assigned', 'arrived', 'started'].includes(currentPhase)) {
      coords.push({ latitude: simulatedDriver.latitude, longitude: simulatedDriver.longitude });
    }
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 180, right: 60, bottom: 340, left: 60 },
        animated: true,
      });
    }, 300);
  }, [currentPhase, destination, simulatedDriver, liveLocation]);

  // إعداد سحب الـ Sheet لأسفل للتراجع (Swipe Down Gesture)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          // السحب لأسفل كافٍ للتراجع
          if (onCloseShuttleSheet) onCloseShuttleSheet();
          setCurrentPhase('idle');
          Animated.timing(panY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>

      {/* 📍 الخريطة: تبدأ من أعلى الشاشة تحت أزرار التحكم تماماً */}
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

          {/* ماركر العميل الذكي بدون حواف أو خطوط بيضاء مخربة للمظهر */}
          <Marker coordinate={{ latitude: liveLocation.latitude, longitude: liveLocation.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarkerContainer}>
              <View style={styles.userMarkerDot} />
            </View>
          </Marker>

          {/* ماركر الوجهة المستهدفة */}
          {destination && (
            <Marker coordinate={{ latitude: destLat, longitude: destLon }} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.destMarkerContainer}>
                <View style={styles.destMarkerCircle}>
                  <MapPin size={13} color="#ffffff" />
                </View>
              </View>
            </Marker>
          )}

          {/* ماركر الكابتن التفاعلي */}
          {['driver_assigned', 'arrived', 'started'].includes(currentPhase) && (
            <Marker coordinate={{ latitude: simulatedDriver.latitude, longitude: simulatedDriver.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.driverMarkerBox}>
                <Car size={14} color="#ffffff" />
              </View>
            </Marker>
          )}
        </MapView>

        {/* 🔍 بوكس البحث المطور: عائم بتأثير شفاف ناعم (Glassmorphism Concept) وبدون خطوط بيضاء داخلية */}
        <View style={styles.floatingSearchBox}>
          <View style={styles.searchRow}>
            <View style={[styles.indicatorDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.locationText}>Maadi Degla, Cairo</Text>
          </View>
          <View style={styles.searchDivider} />
          <View style={styles.searchRow}>
            <View style={[styles.indicatorDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.locationText}>{destination || 'Where to?'}</Text>
            <Search size={16} color="#9ca3af" style={styles.searchIconRight} />
          </View>
        </View>

        {/* زر الفلوتنج لإعادة التمركز */}
        <TouchableOpacity style={styles.myLocationButton} onPress={() => mapRef.current?.animateToRegion({ ...liveLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600)}>
          <Navigation size={18} color="#111827" fill="#111827" />
        </TouchableOpacity>
      </View>

      {/* 🛠️ لوحات التحكم السفلية المدمجة والذكية - مقسمة حسب كل مرحلة يدوية */}

      {/* 1. مرحلة الخمول البدئية - إتاحة طلب الرحلة يدويًا */}
      {currentPhase === 'idle' && (
        <View style={styles.bottomSheetCard}>
          <Text style={styles.sheetTitle}>Ready for your next destination?</Text>
          <Text style={styles.sheetSubtitle}>Get matched with top rated local drivers instantly.</Text>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setCurrentPhase('searching')}>
            <Text style={styles.primaryActionBtnTxt}>Search for Driver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. مرحلة البحث المتقدمة - رادار متوهج ومتحرك شيك */}
      {currentPhase === 'searching' && (
        <View style={styles.bottomSheetCard}>
          <View style={styles.radarContainer}>
            <Animated.View style={[styles.radarWave, {
              transform: [{ scale: radarPulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.2] }) }],
              opacity: radarPulse.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.4, 0.2, 0] })
            }]} />
            <Animated.View style={[styles.radarWave, {
              transform: [{ scale: radarPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }) }],
              opacity: radarPulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.2, 0] }),
              animationDelay: '0.5s'
            }]} />
            <View style={styles.radarCore}>
              <Car size={24} color="#ffffff" />
            </View>
          </View>
          <Text style={[styles.sheetTitle, { textAlign: 'center', marginTop: 16 }]}>Searching for near drivers...</Text>
          <Text style={[styles.sheetSubtitle, { textAlign: 'center', marginBottom: 15 }]}>Contacting nearby luxury shuttles & cars.</Text>

          <TouchableOpacity style={styles.cancelLink} onPress={() => setCurrentPhase('idle')}>
            <XCircle size={16} color="#ef4444" />
            <Text style={styles.cancelLinkTxt}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. كارد بيانات السائق الاحترافي والشامل (تم قبول الطلب أو وصل تحت البيت) */}
      {['driver_assigned', 'arrived'].includes(currentPhase) && (
        <View style={styles.bottomSheetCard}>
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragBarHandle} />
          </View>

          <View style={styles.statusRowHeader}>
            <View style={[styles.phaseIndicatorTag, { backgroundColor: currentPhase === 'arrived' ? '#ef4444' : '#10b981' }]} />
            <Text style={styles.phaseIndicatorTxt}>
              {currentPhase === 'arrived' ? 'Captain has arrived downstairs!' : 'Captain is approaching your location'}
            </Text>
          </View>

          {/* تفاصيل الكابتن والمركبة الفخمة */}
          <View style={styles.driverInfoBody}>
            <View style={styles.avatarProfilePlaceholder}>
              <User size={20} color="#6b7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverProfileName}>Captain Ahmed Mansour</Text>
              <View style={styles.starRowInline}>
                <Star size={13} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.starRatingVal}>4.96 • Verified VeeGo Driver</Text>
              </View>
            </View>
            <View style={styles.vehiclePlateBadge}>
              <Text style={styles.plateTextCode}>ن د ر ٥٩٧</Text>
              <Text style={styles.vehicleSubName}>Hyundai Elantra</Text>
            </View>
          </View>

          {/* صف الأزرار التفاعلية الجاهزة للربط بالباك إند والـ API */}
          <View style={styles.driverActionButtonsRow}>
            <TouchableOpacity style={styles.iconSecondaryBtn} onPress={() => alert('Connecting voice call via VeeGo VoIP...')}>
              <Phone size={16} color="#1f2937" />
              <Text style={styles.iconSecondaryBtnTxt}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconSecondaryBtn} onPress={() => alert('Opening Direct Chat View...')}>
              <MessageSquare size={16} color="#1f2937" />
              <Text style={styles.iconSecondaryBtnTxt}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.iconSecondaryBtn, { borderColor: '#fee2e2' }]} onPress={() => setCurrentPhase('idle')}>
              <XCircle size={16} color="#ef4444" />
              <Text style={[styles.iconSecondaryBtnTxt, { color: '#ef4444' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* زر التأكيد اليدوي للركوب للتيست وعرض الأزرار */}
          <TouchableOpacity style={styles.confirmBoardedBtn} onPress={() => setCurrentPhase('started')}>
            <Text style={styles.confirmBoardedBtnTxt}>I have boarded the car</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. أثناء سير الرحلة الفعلي في الطريق للوجهة */}
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
          <TouchableOpacity style={[styles.confirmBoardedBtn, { marginTop: 15, backgroundColor: '#10b981' }]} onPress={() => setCurrentPhase('completed')}>
            <Text style={styles.confirmBoardedBtnTxt}>End Simulation Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 5. شاشة الفاتورة والإنهاء المستقرة الأنيقة الفلات بدون حواف عشوائية */}
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

            <TouchableOpacity style={[styles.confirmBoardedBtn, { width: '100%', backgroundColor: '#111827' }]} onPress={() => setCurrentPhase('idle')}>
              <Text style={styles.confirmBoardedBtnTxt}>Done & Back Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 🎛️ لوحة التبديل السريع اليدوية (Manual Test Panel) بالأسفل تماماً لتمكينك من فحص كل الواجهات والأشكال براحتك */}
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

// استخدام سكرول فيو مبسط للوحة الاختبار التفاعلية
import { ScrollView } from 'react-native-gesture-handler';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  mapWrapper: { flex: 1, position: 'relative' },

  // استايل ماركرز فلات ونظيفة تماماً
  userMarkerContainer: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(17,24,39,0.15)', alignItems: 'center', justifyContent: 'center' },
  userMarkerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  destMarkerContainer: { alignItems: 'center' },
  destMarkerCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  driverMarkerBox: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 3 },

  // 🔍 البوكس العائم الشفاف المتناسق هندسياً تحت أزرار الفئات
  floatingSearchBox: {
    position: 'absolute',
    top: 15,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.6)',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 26 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  locationText: { fontSize: 13.5, fontWeight: '500', color: '#1f2937' },
  searchDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8, marginLeft: 16 },
  searchIconRight: { marginLeft: 'auto' },

  myLocationButton: {
    position: 'absolute',
    bottom: 290,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },

  // 💳 استايل الكروت السفلية النظيفة (Flat Concept)
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
  dragHandleContainer: { width: '100%', alignItems: 'center', paddingBottom: 10, marginTop: -6 },
  dragBarHandle: { width: 38, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 },

  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  sheetSubtitle: { fontSize: 12.5, color: '#6b7280', marginTop: 3, lineHeight: 17 },
  primaryActionBtn: { backgroundColor: '#111827', height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  primaryActionBtnTxt: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  // لوجيك الرادار
  radarContainer: { alignItems: 'center', justifyContent: 'center', height: 80, marginTop: 10 },
  radarCore: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  radarWave: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(17,24,39,0.2)' },
  cancelLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  cancelLinkTxt: { fontSize: 13, fontWeight: '600', color: '#ef4444' },

  // بيانات الكابتن الفخمة والمحترفة
  statusRowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  phaseIndicatorTag: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  phaseIndicatorTxt: { fontSize: 11.5, fontWeight: '600', color: '#4b5563', textTransform: 'uppercase' },
  driverInfoBody: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatarProfilePlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  driverProfileName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  starRowInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  starRatingVal: { fontSize: 11.5, color: '#6b7280' },
  vehiclePlateBadge: { backgroundColor: '#f3f4f6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center' },
  plateTextCode: { fontSize: 13, fontWeight: '700', color: '#111827' },
  vehicleSubName: { fontSize: 9.5, color: '#6b7280', marginTop: 1 },

  // صف أزرار التحكم الفلات والمستعدة للـ API
  driverActionButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  iconSecondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  iconSecondaryBtnTxt: { fontSize: 12.5, fontWeight: '600', color: '#1f2937' },
  confirmBoardedBtn: { backgroundColor: '#111827', height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  confirmBoardedBtnTxt: { color: '#ffffff', fontSize: 13.5, fontWeight: '600' },

  // شريط خط السير المستمر
  etaCounterLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 6 },
  linearBarContainer: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  linearBarFillProgress: { width: '40%', height: '100%', backgroundColor: '#111827' },

  // الفاتورة الفلات
  invoiceFlatCard: { backgroundColor: '#f9fafb', width: '100%', padding: 12, borderRadius: 14, alignItems: 'center', marginVertical: 12 },
  invoiceFlatLabel: { fontSize: 12, color: '#6b7280' },
  invoiceFlatPrice: { fontSize: 20, fontWeight: '800', color: '#10b981', marginTop: 2 },

  // لوحة التيست السفلية المريحة
  manualTestControlPanel: { position: 'absolute', bottom: 15, left: 0, right: 0, height: 45, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb', justifyContent: 'center' },
  testLabelTxt: { fontSize: 11, fontWeight: '700', color: '#6b7280', alignSelf: 'center', marginRight: 4 },
  testMiniBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'center' },
  testMiniBtnTxt: { fontSize: 11, fontWeight: '600', color: '#1f2937' }
});