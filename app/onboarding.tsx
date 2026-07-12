import { useState, useRef, useEffect, type ComponentType } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Animated,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { Animation } from '@/constants/animations';
import { IllustMultiModal, IllustModePicker, IllustConnected } from '@/components/shared/Illustrations';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Shadows } from '@/constants/shadows';
import { VeeGoButton } from '@/components/ui/VeeGoButton';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@veego_has_seen_onboarding';

async function finishOnboarding() {
  try { await AsyncStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
  router.replace('/auth');
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();

  const STEPS = [
    {
      tag: t('onboarding_tag1'),
      title: t('onboarding_title1'),
      body: t('onboarding_body1'),
      Illust: IllustMultiModal,
    },
    {
      tag: t('onboarding_tag2'),
      title: t('onboarding_title2'),
      body: t('onboarding_body2'),
      Illust: IllustModePicker,
    },
    {
      tag: t('onboarding_tag3'),
      title: t('onboarding_title3'),
      body: t('onboarding_body3'),
      Illust: IllustConnected,
    },
  ];

  const next = () => {
    Haptics.selectionAsync();
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      scrollRef.current?.scrollTo({ x: (step + 1) * width, animated: true });
    } else {
      finishOnboarding();
    }
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newStep = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newStep !== step && newStep >= 0 && newStep < STEPS.length) setStep(newStep);
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.logo}>
          <Text style={[styles.logoText, { color: c.ink }]}>VeeGo</Text>
        </View>
        <TouchableOpacity
          onPress={finishOnboarding}
          style={[styles.skipBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)' }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('skip')}
        >
          <Text style={[styles.skipText, { color: c.inkSoft }]}>{t('skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {STEPS.map((s, i) => (
          <OnboardingSlide key={i} step={s} active={i === step} colors={c} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {STEPS.map((_, i) => (
            <DotItem key={i} active={i === step} done={i < step} colors={c} />
          ))}
        </View>
        <VeeGoButton
          title={step === STEPS.length - 1 ? t('get_started') : t('continue')}
          onPress={next}
          size="large"
          icon={isRTL ? <ArrowLeft size={18} color={c.isDark ? c.background : c.white} /> : <ArrowRight size={18} color={c.isDark ? c.background : c.white} />}
          iconPosition="right"
          style={styles.nextBtn}
        />
      </View>
    </LinearGradient>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];
function OnboardingSlide({ step, active, colors: c }: { step: { tag: string; title: string; body: string; Illust: ComponentType<{ colors: ThemeColors }> }; active: boolean; colors: ThemeColors }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (active) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: Animation.duration.slow, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...Animation.spring.sheet }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [active]);

  return (
    <Animated.View style={[styles.slide, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.illustBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <step.Illust colors={c} />
      </View>
      <View style={styles.textBox}>
        <View style={[styles.tagBox, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(30,30,40,0.08)' }]}>
          <Text style={[styles.tagText, { color: c.ink }]}>{step.tag}</Text>
        </View>
        <Text style={[styles.title, { color: c.ink }]}>{step.title}</Text>
        <Text style={[styles.body, { color: c.inkSoft }]}>{step.body}</Text>
      </View>
    </Animated.View>
  );
}

function DotItem({ active, done, colors: c }: { active: boolean; done: boolean; colors: ThemeColors }) {
  const dotWidth = useRef(new Animated.Value(6)).current;
  const dotOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(dotWidth, { toValue: active ? 22 : 6, useNativeDriver: false, ...Animation.spring.tabBar }),
      Animated.timing(dotOpacity, { toValue: active ? 1 : done ? 0.7 : 0.4, duration: Animation.duration.fast, useNativeDriver: false }),
    ]).start();
  }, [active, done]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: active ? c.ink : c.silver },
        { width: dotWidth, opacity: dotOpacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  logo: {},
  logoText: { fontSize: 24, fontWeight: Typography.weight.bold, letterSpacing: -1.2, fontFamily: 'Inter_700Bold' },
  skipBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: 20 },
  skipText: { fontSize: 13, fontWeight: Typography.weight.medium },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Spacing.xxl,
    gap: 28,
  },
  illustBox: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    maxHeight: 320,
  },
  textBox: { gap: Spacing.md },
  tagBox: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    paddingHorizontal: Spacing.md, paddingVertical: 5,
  },
  tagText: { fontSize: 10.5, fontWeight: Typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 1.3 },
  title: { fontSize: 32, fontWeight: Typography.weight.bold, letterSpacing: -1.2, lineHeight: 38, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  footer: {
    paddingHorizontal: 28, paddingTop: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  nextBtn: {
    flex: 1,
    shadowColor: '#1e1e28', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: Shadows.large.elevation,
  },
});
