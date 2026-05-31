import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions, Animated, Platform, Linking, Alert, Modal, TextInput, FlatList } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { MapPin, Car, Search, Phone, MessageSquare, XCircle, Navigation } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// البيانات الثابتة الافتراضية بدلاً من ملف الـ Context
const USER_LOCATION = { latitude: 30.0444, longitude: 31.2357 };
const MOCK_DRIVER = {
  name: 'Ahmed Hassan',
  vehicle: 'Toyota Camry 2022',
  plate: 'WG 1234',
  rating: 4.8,
  trips: 1247,
  eta: 3,
  phone: '+201234567890'
};

export function CarMap({ destination: initialDestination = 'Smart Village', onCloseShuttleSheet }: any) {
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'searching' | 'driver_assigned'>('idle');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: '1', text: 'على الطريق إليك الآن 👋', isDriver: true, time: '10:32' },
    { id: '2', text: 'حركة المرور خفيفة اليوم، سأصل قريباً 🚗', isDriver: true, time: '10:33' }
  ]);
  const [chatText, setChatText] = useState('');

  // أنيميشن النبض للرادار
  const pulseRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentPhase === 'searching') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseRing, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseRing, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      pulse.start();

      // محاكاة قبول الكابتن للرحلة بعد 3.5 ثانية
      const timer = setTimeout(() => {
        setCurrentPhase('driver_assigned');
      }, 3500);

      return () => {
        pulse.stop();
        clearTimeout(timer);
      };
    }
  }, [currentPhase]);

  const scale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] });
  const opacity = pulseRing.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.2, 0] });

  const handleCall = () => {
    const url = `tel:${MOCK_DRIVER.phone}`;
    Linking.openURL(url).catch(() => Alert.alert('خطأ', 'جهازك لا يدعم إجراء المكالمات'));
  };

  const handleSendMessage = () => {
    if (!chatText.trim()) return;
    const newMsg = { id: Date.now().toString(), text: chatText.trim(), isDriver: false, time: 'الان' };
    setMessages(prev => [...prev, newMsg]);
    setChatText('');
  };

  return (
    <View style={styles.container}>
      {/* 1. الخريطة تبدأ أسفل الهيدر وتأخذ المساحة بالكامل */}
      <View style={styles.mapWrapper}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={{ ...USER_LOCATION, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        >
          <UrlTile urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" maximumZ={19} tileSize={256} />

          {/* ماركر المستخدم */}
          <Marker coordinate={USER_LOCATION}>
            <View style={styles.userMarkerDot} />
          </Marker>
        </MapView>
      </View>

      {/* 2. بوكس البحث (منين لفين) شغال وشكله ممتاز */}
      <View style={styles.floatingSearchBox}>
        <View style={styles.searchRow}>
          <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.text}>الموقع الحالي (Current Location)</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.searchRow}>
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.text}>{initialDestination}</Text>
          <Search size={16} color="#9ca3af" style={{ marginLeft: 'auto' }} />
        </View>
      </View>

      {/* 3. واجهة الـ IDLE (البداية قبل الطلب) */}
      {currentPhase === 'idle' && (
        <View style={styles.bottomSheetCard}>
          <Text style={styles.sheetTitle}>جاهز لبدء رحلتك؟</Text>
          <TouchableOpacity style={styles.btn} onPress={() => setCurrentPhase('searching')}>
            <Text style={styles.btnText}>اطلب كابتن الآن</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. واجهة الـ SEARCHING (الرادار والنبض الأخضر) */}
      {currentPhase === 'searching' && (
        <View style={styles.bottomSheetCard}>
          <View style={styles.radarContainer}>
            <Animated.View style={[styles.ring, { transform: [{ scale }], opacity }]} />
            <View style={styles.iconCircle}>
              <Text style={{ fontSize: 24 }}>⚡</Text>
            </View>
          </View>
          <Text style={[styles.sheetTitle, { textAlign: 'center', marginTop: 10 }]}>جاري البحث عن كابتن...</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ef4444' }]} onPress={() => setCurrentPhase('idle')}>
            <Text style={styles.btnText}>إلغاء البحث</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 5. واجهة الـ DRIVER_ASSIGNED (كارد بيانات الكابتن أحمد حسن) */}
      {currentPhase === 'driver_assigned' && (
        <View style={styles.bottomSheetCard}>
          <View style={styles.etaRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.etaText}>الكابتن يصلك خلال {MOCK_DRIVER.eta} دقائق</Text>
          </View>

          <View style={styles.driverCard}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>AH</Text>
            </View>
            <View style={styles.driverMeta}>
              <Text style={styles.driverName}>{MOCK_DRIVER.name}</Text>
              <Text style={styles.driverStats}>⭐ {MOCK_DRIVER.rating} • {MOCK_DRIVER.trips} رحلة</Text>
            </View>
            <View style={styles.vehicleBlock}>
              <Text style={styles.vehicleText}>{MOCK_DRIVER.vehicle}</Text>
              <View style={styles.plateBadge}>
                <Text style={styles.plateText}>{MOCK_DRIVER.plate}</Text>
              </View>
            </View>
          </View>

          {/* أزرار التحكم (شات - اتصال - إلغاء) */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={() => setChatOpen(true)}>
              <MessageSquare size={18} color="#fff" />
              <Text style={styles.chatBtnText}>المحادثة</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleBtn} onPress={handleCall}>
              <Phone size={18} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: '#ffeeec' }]} onPress={() => setCurrentPhase('idle')}>
              <XCircle size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 6. مودال الشات (Chat Window) */}
      <Modal visible={chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setChatOpen(false)} style={styles.backBtn}>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>رجوع</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>{MOCK_DRIVER.name}</Text>
          <View style={{ width: 50 }} />
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.isDriver ? styles.driverBubble : styles.userBubble]}>
              <View style={[styles.bubbleInner, { backgroundColor: item.isDriver ? '#f3f4f6' : '#111827' }]}>
                <Text style={{ color: item.isDriver ? '#000' : '#fff', fontSize: 14 }}>{item.text}</Text>
              </View>
            </View>
          )}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="اكتب رسالة للكابتن..."
            value={chatText}
            onChangeText={setChatText}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>إرسال</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapWrapper: { flex: 1 },
  floatingSearchBox: { position: 'absolute', top: 20, left: 16, right: 16, backgroundColor: '#fff', padding: 15, borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  text: { fontSize: 13, color: '#111', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8, marginLeft: 18 },

  // الكارد السفلي الآمن المرفوع فوق الـ Navigation Bar
  bottomSheetCard: { position: 'absolute', bottom: 110, left: 16, right: 16, backgroundColor: '#fff', padding: 20, borderRadius: 24, elevation: 15, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15 },
  sheetTitle: { fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 10 },
  btn: { backgroundColor: '#111827', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // استايلات الرادار والبحث
  radarContainer: { alignItems: 'center', justifyContent: 'center', height: 80, marginVertical: 10 },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#10b981' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e6f7f0', alignItems: 'center', justifyContent: 'center' },

  // استايلات كارد الكابتن وبياناته
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  etaText: { fontSize: 13, fontWeight: '600', color: '#10b981' },
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  avatarWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#3a7bd5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  driverMeta: { flex: 1, marginLeft: 10, gap: 2 },
  driverName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  driverStats: { fontSize: 12, color: '#6b7280' },
  vehicleBlock: { alignItems: 'flex-end', gap: 4 },
  vehicleText: { fontSize: 11, color: '#4b5563' },
  plateBadge: { backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  plateText: { fontSize: 12, fontWeight: 'bold', color: '#111827' },

  // أزرار الشات والاتصال
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 },
  chatBtn: { flex: 1, height: 48, backgroundColor: '#111827', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chatBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  circleBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },

  // استايلات شاشة الشات المودال
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 40 },
  backBtn: { padding: 8 },
  chatHeaderTitle: { fontSize: 16, fontWeight: 'bold' },
  bubble: { width: '100%', marginVertical: 4 },
  driverBubble: { alignItems: 'flex-start' },
  userBubble: { alignItems: 'flex-end' },
  bubbleInner: { padding: 12, borderRadius: 16, maxWidth: '75%' },
  inputBar: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center', gap: 10 },
  chatInput: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 20, fontSize: 14 },
  sendBtn: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  userMarkerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#111', borderWidth: 2, borderColor: '#fff' }
});