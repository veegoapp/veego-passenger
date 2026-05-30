import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '@/constants/colors';

const LANG_KEY = '@veego_lang_selected';
const SESSION_KEY = '@veego_session_v1';
const { width } = Dimensions.get('window');

export default function SplashPage() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, damping: 22, stiffness: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 22, stiffness: 100, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoRotate, { toValue: 8, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoRotate, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoRotate, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(barOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(barWidth, { toValue: width * 0.55, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    ]).start();

    const t = setTimeout(async () => {
      try {
        const langSelected = await AsyncStorage.getItem(LANG_KEY);
        if (!langSelected) {
          router.replace('/lang-select');
          return;
        }
        const session = await AsyncStorage.getItem(SESSION_KEY);
        if (session) {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      } catch {
        router.replace('/lang-select');
      }
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  const rotateDeg = logoRotate.interpolate({ inputRange: [-8, 8], outputRange: ['-8deg', '8deg'] });

  return (
    <LinearGradient colors={C.luxeGrad} style={styles.root}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate: rotateDeg }] }]}>
          <View style={styles.iconInner}>
            <Navigation size={32} color={C.white} />
          </View>
          <View style={styles.iconGlow} />
        </Animated.View>
        <Text style={styles.wordmark}>VeeGo</Text>
        <Text style={styles.tagline}>Your daily route, simplified</Text>
        <View style={styles.barWrap}>
          <Animated.View style={[styles.bar, { width: barWidth, opacity: barOpacity }]} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', gap: 16 },
  iconWrap: { position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  iconInner: {
    width: 80, height: 80, borderRadius: 28, backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.25, shadowRadius: 32, elevation: 10,
  },
  iconGlow: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(30,30,40,0.08)',
  },
  wordmark: { fontSize: 46, fontWeight: '700', color: C.ink, letterSpacing: -2.5, fontFamily: 'Inter_700Bold' },
  tagline: { fontSize: 13, color: C.inkSoft, letterSpacing: 0.2, fontFamily: 'Inter_400Regular' },
  barWrap: {
    width: 220, height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden', marginTop: 8,
  },
  bar: { height: 4, borderRadius: 2, backgroundColor: C.ink },
});
