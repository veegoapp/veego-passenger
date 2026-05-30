import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { C } from '@/constants/colors';

export function IllustRoute() {
  return (
    <View style={styles.container}>
      <View style={styles.illustBg} />
      <Svg viewBox="0 0 300 280" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="routeLine" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#4a9fcc" />
            <Stop offset="1" stopColor="#8b6fd4" />
          </LinearGradient>
        </Defs>
        <Path
          d="M40,220 C90,200 90,120 150,120 C210,120 210,60 260,40"
          stroke="url(#routeLine)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 6"
        />
        {([[40, 220], [150, 120], [260, 40]] as [number, number][]).map(([x, y], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r="14" fill="white" stroke="#1e1e28" strokeWidth="2" />
            <Circle cx={x} cy={y} r="4" fill="#1e1e28" />
          </G>
        ))}
      </Svg>
    </View>
  );
}

function SeatCell({ index, taken, isMe }: { index: number; taken: boolean; isMe: boolean }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.delay(index * 30),
      Animated.spring(scale, { toValue: 1, damping: 15, delay: index * 30, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, delay: index * 30, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.seat,
        isMe ? styles.seatMe : taken ? styles.seatTaken : styles.seatFree,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

export function IllustSeat() {
  const seats = Array.from({ length: 16 }, (_, i) => ({
    index: i,
    taken: [1, 4, 9, 12].includes(i),
    isMe: i === 6,
  }));
  return (
    <View style={styles.container}>
      <View style={styles.illustBg} />
      <View style={styles.seatGrid}>
        {seats.map((s) => (
          <SeatCell key={s.index} {...s} />
        ))}
      </View>
    </View>
  );
}

export function IllustCity() {
  return (
    <View style={styles.container}>
      <View style={styles.illustBg} />
      <Svg viewBox="0 0 300 280" style={StyleSheet.absoluteFillObject}>
        <G fill="#e8e8ee">
          <Rect x="30" y="140" width="40" height="120" rx="6" />
          <Rect x="80" y="100" width="50" height="160" rx="6" />
          <Rect x="140" y="60" width="50" height="200" rx="6" />
          <Rect x="200" y="120" width="35" height="140" rx="6" />
          <Rect x="245" y="160" width="30" height="100" rx="6" />
        </G>
        <G>
          <Rect x="100" y="200" width="100" height="40" rx="10" fill="#1e1e28" />
          <Circle cx="120" cy="245" r="8" fill="#1e1e28" />
          <Circle cx="180" cy="245" r="8" fill="#1e1e28" />
          <Rect x="110" y="210" width="22" height="14" rx="3" fill="white" opacity="0.5" />
          <Rect x="140" y="210" width="22" height="14" rx="3" fill="white" opacity="0.5" />
          <Rect x="170" y="210" width="22" height="14" rx="3" fill="white" opacity="0.5" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  illustBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: '#f8f8fb',
    shadowColor: '#1e1e28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  seatGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  seat: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  seatMe: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  seatTaken: {
    backgroundColor: C.mist,
    borderColor: C.mist,
  },
  seatFree: {
    backgroundColor: C.white,
    borderColor: C.border,
  },
});
