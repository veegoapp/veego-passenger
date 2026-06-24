import { useRef, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Home, Ticket, Heart, Wallet, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/context/ThemeContext';
import { S } from '@/constants/colors';
import { useTabBar } from '@/context/TabBarContext';
import { usePaymentConfig } from '@/context/PaymentConfigContext';

// استيراد ضروري لمنع الـ Gesture Crash
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const TAB_ITEMS = [
  { name: 'index',     labelKey: 'home'      as const, icon: Home },
  { name: 'trips',     labelKey: 'trips'     as const, icon: Ticket },
  { name: 'favorites', labelKey: 'favorites' as const, icon: Heart },
  { name: 'wallet',    labelKey: 'wallet'    as const, icon: Wallet },
  { name: 'profile',   labelKey: 'profile'   as const, icon: User },
];

function VeeGoTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + 8;
  const { colors: c, t, language } = useTheme();
  const { walletFeature } = usePaymentConfig();
  const walletUnavailable = !walletFeature.isEnabled || walletFeature.displayMode !== 'live';

  const tabWidths  = useRef<number[]>([]);
  const tabOffsets = useRef<number[]>([]);
  const pillX = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(0)).current;
  const [pillReady, setPillReady] = useState(false);

  // ── Label cross-fade on language switch ───────────────────────────────────
  // Shared opacity for all tab icon+label pairs. On language change:
  //   1. Fade out quickly (100 ms) — old labels disappear
  //   2. Fade back in (180 ms) — new labels appear
  // The pill is NOT faded; it keeps moving so the two animations feel layered.
  const labelOpacity = useRef(new Animated.Value(1)).current;

  // ── Generation counter ────────────────────────────────────────────────────
  // Each language switch triggers an RTL/LTR reflow that changes every tab's
  // x-offset. We increment layoutGen so handleLayout can tell whether the
  // measurement it receives belongs to the *current* layout pass or a stale
  // one. We never reset pillReady — the pill stays visible throughout.
  const layoutGen     = useRef(0);
  const tabMeasureGen = useRef<number[]>([]);   // last gen each tab reported

  useEffect(() => {
    layoutGen.current += 1;
    // Fade labels out, let the RTL reflow + new text land, then fade in.
    Animated.sequence([
      Animated.timing(labelOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(labelOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab-navigation: animate pill whenever the active index changes ────────
  useEffect(() => {
    if (pillReady) animatePill(state.index);
  }, [state.index, pillReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const animatePill = (index: number) => {
    const x = tabOffsets.current[index];
    const w = tabWidths.current[index];
    if (x === undefined || !(w > 0)) return;
    Animated.spring(pillX, { toValue: x, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.75 }).start();
    Animated.spring(pillW, { toValue: w, useNativeDriver: false, damping: 22, stiffness: 220, mass: 0.75 }).start();
  };

  const handleLayout = (i: number, x: number, w: number) => {
    tabWidths.current[i]  = w;
    tabOffsets.current[i] = x;
    tabMeasureGen.current[i] = layoutGen.current;

    // All 5 tabs must have reported measurements for the *current* generation
    // before we reposition — this prevents landing on stale mixed values after
    // an RTL/LTR reflow.
    const currentGen = layoutGen.current;
    const allFresh   = TAB_ITEMS.every((_, idx) => tabMeasureGen.current[idx] === currentGen);
    if (!allFresh) return;

    const tx = tabOffsets.current[state.index];
    const tw = tabWidths.current[state.index];
    if (tx === undefined || !(tw > 0)) return;

    if (!pillReady) {
      // First mount: jump instantly, no animation
      pillX.setValue(tx);
      pillW.setValue(tw);
      setPillReady(true);
    } else {
      // Language reflow: animate smoothly to re-measured position
      animatePill(state.index);
    }
  };

  return (
    <View style={[styles.navOuter, { paddingBottom: bottom }]}>
      <View
        style={[
          styles.navInner,
          S.float,
          {
            backgroundColor: c.isDark ? 'rgba(26,28,50,0.97)' : 'rgba(255,255,255,0.96)',
            borderWidth: 1,
            borderColor: c.isDark ? 'rgba(90,95,160,0.15)' : 'rgba(0,0,0,0.04)',
          },
        ]}
      >
        {pillReady && (
          <Animated.View
            style={[
              styles.activePill,
              {
                // Dark mode: solid ink pill with light icon
                // Light mode: subtle tinted pill with dark icon (avoids white-on-white)
                backgroundColor: c.isDark ? c.ink : 'rgba(15,23,42,0.09)',
                left: pillX,
                width: pillW,
                pointerEvents: 'none' as any,
              },
            ]}
          />
        )}
        {TAB_ITEMS.map((item, i) => {
          const active = state.index === i;
          const isWallet = item.name === 'wallet';
          const isDisabledWallet = isWallet && walletUnavailable;
          // Light mode: always use dark ink so icon stays visible whether or not
          // the animated pill has finished measuring (prevents white-on-white flash
          // during RTL reset when pillReady is temporarily false).
          const iconColor = isDisabledWallet
            ? c.silver
            : active
              ? (c.isDark ? c.background : '#0F172A')
              : c.inkSoft;
          const labelColor = isDisabledWallet
            ? c.silver
            : active
              ? (c.isDark ? c.background : '#0F172A')
              : c.inkSoft;
          return (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              activeOpacity={0.8}
              onPress={() => {
                if (isDisabledWallet) {
                  Alert.alert(
                    t('wallet_title'),
                    walletFeature.unavailableMessage || t('wallet_coming_soon_msg'),
                  );
                  return;
                }
                navigation.navigate(item.name);
              }}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                handleLayout(i, x, width);
              }}
            >
              {/* labelOpacity fades icon+label together on language switch.
                  The pill sits outside this view so it stays fully opaque. */}
              <Animated.View style={[styles.navItemContent, { opacity: labelOpacity }]}>
                <View style={{ position: 'relative' }}>
                  <item.icon size={17} color={iconColor} style={{ zIndex: 2 }} />
                  {isDisabledWallet && (
                    <View style={styles.comingSoonDot} />
                  )}
                </View>
                <Text
                  style={[styles.navLabel, { color: labelColor, zIndex: 2 }]}
                  numberOfLines={1}
                >
                  {t(item.labelKey)}
                </Text>
              </Animated.View>
              {isDisabledWallet && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>{t('soon')}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TabBarWrapper(props: BottomTabBarProps) {
  const { visible } = useTabBar();
  if (!visible) return null;
  return <VeeGoTabBar {...props} />;
}

export default function TabLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <TabBarWrapper {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="trips" />
        <Tabs.Screen name="favorites" />
        <Tabs.Screen name="wallet" />
        <Tabs.Screen name="profile" />
        {/* تم حذف المسارات الفرعية من هنا لأنها لو مش موجودة كملفات بتسبب Crash */}
      </Tabs>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  navOuter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 4, zIndex: 99,
  },
  navInner: {
    flexDirection: 'row', borderRadius: 30,
    paddingVertical: 6, paddingHorizontal: 6,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 5,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    paddingVertical: 8, borderRadius: 24, gap: 2, zIndex: 2,
  },
  navItemContent: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  activePill: {
    position: 'absolute', top: 6, bottom: 6, borderRadius: 24, zIndex: 1,
  },
  navLabel: { fontSize: 10, fontWeight: '650', lineHeight: 13 },
  comingSoonDot: {
    position: 'absolute', top: -2, right: -4,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  comingSoonBadge: {
    position: 'absolute', top: -6, right: -8,
    backgroundColor: '#f59e0b', borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  comingSoonBadgeText: { fontSize: 7, fontWeight: '700', color: '#ffffff' },
});