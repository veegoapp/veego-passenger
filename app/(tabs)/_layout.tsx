import { useRef, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Home, Ticket, Heart, Wallet, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/context/ThemeContext';
import { S } from '@/constants/colors';
import { useTabBar } from '@/context/TabBarContext';

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
  const bottom = Platform.OS === 'web' ? 24 : insets.bottom + 8;
  const { colors: c, t, language } = useTheme();

  const tabWidths = useRef<number[]>([]);
  const tabOffsets = useRef<number[]>([]);
  const pillX = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(0)).current;
  const [pillReady, setPillReady] = useState(false);

  useEffect(() => {
    setPillReady(false);
    tabWidths.current = [];
    tabOffsets.current = [];
  }, [language]);

  const animatePill = (index: number) => {
    const x = tabOffsets.current[index];
    const w = tabWidths.current[index];
    if (x !== undefined && w > 0) {
      Animated.spring(pillX, {
        toValue: x,
        useNativeDriver: false,
        damping: 22,
        stiffness: 220,
        mass: 0.75,
      }).start();
      Animated.spring(pillW, {
        toValue: w,
        useNativeDriver: false,
        damping: 22,
        stiffness: 220,
        mass: 0.75,
      }).start();
    }
  };

  useEffect(() => {
    if (pillReady) {
      animatePill(state.index);
    }
  }, [state.index, pillReady]);

  const handleLayout = (i: number, x: number, w: number) => {
    tabWidths.current[i] = w;
    tabOffsets.current[i] = x;
    const allSet =
      tabWidths.current.length === TAB_ITEMS.length &&
      tabOffsets.current.length === TAB_ITEMS.length &&
      tabWidths.current.every((v) => v > 0);
    if (allSet) {
      if (!pillReady) {
        const initX = tabOffsets.current[state.index];
        const initW = tabWidths.current[state.index];
        if (initX !== undefined && initW !== undefined && initW > 0) {
          pillX.setValue(initX);
          pillW.setValue(initW);
          setPillReady(true);
        }
      } else {
        animatePill(state.index);
      }
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
                backgroundColor: c.ink,
                left: pillX,
                width: pillW,
                pointerEvents: 'none' as any,
              },
            ]}
          />
        )}
        {TAB_ITEMS.map((item, i) => {
          const active = state.index === i;
          return (
            <TouchableOpacity
              key={item.name}
              style={styles.navItem}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(item.name)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                handleLayout(i, x, width);
              }}
            >
              <item.icon
                size={17}
                color={active ? (c.isDark ? c.background : c.white) : c.inkSoft}
                style={{ zIndex: 2 }}
              />
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft, zIndex: 2 },
                ]}
                numberOfLines={1}
              >
                {t(item.labelKey)}
              </Text>
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
  activePill: {
    position: 'absolute', top: 6, bottom: 6, borderRadius: 24, zIndex: 1,
  },
  navLabel: { fontSize: 10, fontWeight: '650', lineHeight: 13 },
});