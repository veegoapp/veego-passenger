import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { IllustRoute, IllustSeat, IllustCity } from '@/components/Illustrations';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useTheme();

  const STEPS = [
    {
      tag: t('onboarding_tag1'),
      title: t('onboarding_title1'),
      body: t('onboarding_body1'),
      Illust: IllustRoute,
    },
    {
      tag: t('onboarding_tag2'),
      title: t('onboarding_title2'),
      body: t('onboarding_body2'),
      Illust: IllustSeat,
    },
    {
      tag: t('onboarding_tag3'),
      title: t('onboarding_title3'),
      body: t('onboarding_body3'),
      Illust: IllustCity,
    },
  ];

  const next = () => {
    Haptics.selectionAsync();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      scrollRef.current?.scrollTo({ x: (step + 1) * width, animated: true });
    } else {
      router.replace('/auth');
    }
  };

  return (
    <LinearGradient colors={C.luxeGrad} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>VeeGo</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/auth')} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={styles.skipText}>{t('skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {STEPS.map((s, i) => (
          <OnboardingSlide key={i} step={s} active={i === step} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <DotItem key={i} active={i === step} done={i < step} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.9}>
          <Text style={styles.nextText}>{step === STEPS.length - 1 ? t('get_started') : t('continue')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function OnboardingSlide({ step, active }: { step: typeof STEPS[0]; active: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (active) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 120, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [active]);

  return (
    <Animated.View style={[styles.slide, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.illustBox}>
        <step.Illust />
      </View>
      <View style={styles.textBox}>
        <View style={styles.tagBox}>
          <Text style={styles.tagText}>{step.tag}</Text>
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
      </View>
    </Animated.View>
  );
}

function DotItem({ active, done }: { active: boolean; done: boolean }) {
  const dotWidth = useRef(new Animated.Value(6)).current;
  const dotOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(dotWidth, { toValue: active ? 22 : 6, damping: 18, useNativeDriver: false }),
      Animated.timing(dotOpacity, { toValue: active ? 1 : done ? 0.7 : 0.4, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [active, done]);

  return (
    <Animated.View
      style={[
        styles.dot,
        active ? styles.dotActive : styles.dotInactive,
        { width: dotWidth, opacity: dotOpacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 24,
  },
  logo: {},
  logoText: { fontSize: 24, fontWeight: '700', color: C.ink, letterSpacing: -1.2, fontFamily: 'Inter_700Bold' },
  skipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)' },
  skipText: { fontSize: 13, color: C.inkSoft, fontWeight: '500' },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    gap: 28,
  },
  illustBox: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    maxHeight: 320,
    backgroundColor: C.snow,
    shadowColor: C.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4,
  },
  textBox: { gap: 12 },
  tagBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30,30,40,0.08)', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 10.5, fontWeight: '600', color: C.ink, textTransform: 'uppercase', letterSpacing: 1.3 },
  title: { fontSize: 32, fontWeight: '700', color: C.ink, letterSpacing: -1.2, lineHeight: 38, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 15, color: C.inkSoft, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  footer: {
    padding: 28, paddingBottom: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: C.ink },
  dotInactive: { backgroundColor: C.silver },
  nextBtn: {
    flex: 1, height: 56, borderRadius: 20, backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 8,
  },
  nextText: { color: C.white, fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
