import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  G,
} from 'react-native-svg';
import type { ThemeColors } from '@/constants/colors';
import { Shadows } from '@/constants/shadows';

type GlyphProps = { x: number; y: number; s?: number; tone?: 'dark' | 'light'; c: ThemeColors };

/** Small flat vehicle/service glyphs shared across the onboarding illustrations. */
function GlyphBus({ x, y, s = 1, tone = 'dark', c }: GlyphProps) {
  const fill = tone === 'dark' ? c.ink : c.white;
  return (
    <G transform={`translate(${x}, ${y}) scale(${s})`}>
      <Rect x={0} y={0} width={40} height={22} rx={7} fill={fill} />
      <Rect x={5} y={5} width={12} height={8} rx={2} fill={c.white} opacity={tone === 'dark' ? 0.5 : 0} />
      <Rect x={5} y={5} width={12} height={8} rx={2} fill={c.ink} opacity={tone === 'light' ? 0.12 : 0} />
      <Rect x={23} y={5} width={12} height={8} rx={2} fill={c.white} opacity={tone === 'dark' ? 0.5 : 0} />
      <Rect x={23} y={5} width={12} height={8} rx={2} fill={c.ink} opacity={tone === 'light' ? 0.12 : 0} />
      <Circle cx={9} cy={24} r={4.5} fill={fill} />
      <Circle cx={31} cy={24} r={4.5} fill={fill} />
      <Rect x={16} y={16} width={8} height={4} rx={1.5} fill={c.accentMint} />
    </G>
  );
}

function GlyphCar({ x, y, s = 1, tone = 'dark', c }: GlyphProps) {
  const fill = tone === 'dark' ? c.ink : c.white;
  return (
    <G transform={`translate(${x}, ${y}) scale(${s})`}>
      <Rect x={0} y={10} width={44} height={14} rx={7} fill={fill} />
      <Rect x={9} y={0} width={24} height={12} rx={5} fill={fill} />
      <Rect x={12} y={2.5} width={8} height={7} rx={2} fill={c.white} opacity={tone === 'dark' ? 0.5 : 0} />
      <Rect x={12} y={2.5} width={8} height={7} rx={2} fill={c.ink} opacity={tone === 'light' ? 0.12 : 0} />
      <Rect x={23} y={2.5} width={8} height={7} rx={2} fill={c.white} opacity={tone === 'dark' ? 0.5 : 0} />
      <Rect x={23} y={2.5} width={8} height={7} rx={2} fill={c.ink} opacity={tone === 'light' ? 0.12 : 0} />
      <Circle cx={10} cy={26} r={5.5} fill={fill} />
      <Circle cx={34} cy={26} r={5.5} fill={fill} />
      <Rect x={37} y={13} width={5} height={3} rx={1.5} fill={c.accentMint} />
    </G>
  );
}

function GlyphScooter({ x, y, s = 1, tone = 'dark', c }: GlyphProps) {
  const stroke = tone === 'dark' ? c.ink : c.white;
  return (
    <G transform={`translate(${x}, ${y}) scale(${s})`}>
      <Circle cx={6} cy={26} r={5.5} fill="none" stroke={stroke} strokeWidth={3.5} />
      <Circle cx={34} cy={26} r={5.5} fill="none" stroke={stroke} strokeWidth={3.5} />
      <Path d="M6,26 L6,10 L28,10 L28,3" stroke={stroke} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M6,26 L34,26" stroke={stroke} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Rect x={20} y={0} width={14} height={4.5} rx={2.25} fill={c.accentMint} />
    </G>
  );
}

function GlyphBox({ x, y, s = 1, tone = 'dark', c }: GlyphProps) {
  const fill = tone === 'dark' ? c.ink : c.white;
  return (
    <G transform={`translate(${x}, ${y}) scale(${s})`}>
      <Rect x={2} y={4} width={32} height={26} rx={5} fill={fill} />
      <Path d="M2,14 L34,14 M18,4 L18,30" stroke={tone === 'dark' ? c.white : c.ink} strokeWidth={1.5} opacity={0.3} />
      <Rect x={13} y={0} width={10} height={8} rx={2} fill={c.accentMint} />
    </G>
  );
}

const badge = { w: 64, h: 64, r: 18 };

/** Slide 1 — "One app, every way to move": a hub connecting all four service modes. */
export function IllustMultiModal({ colors: c }: { colors: ThemeColors }) {
  return (
    <View style={styles.container}>
      <View style={[styles.illustBg, { backgroundColor: c.snow }]} />
      <Svg viewBox="0 0 300 280" style={StyleSheet.absoluteFillObject}>
        <G>
          <Path d="M150,140 L56,52" stroke={c.border} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
          <Path d="M150,140 L244,52" stroke={c.border} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
          <Path d="M150,140 L56,228" stroke={c.border} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
          <Path d="M150,140 L244,228" stroke={c.border} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        </G>

        <Rect x={24} y={20} width={badge.w} height={badge.h} rx={badge.r} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphBus x={32} y={34} s={0.85} c={c} />

        <Rect x={212} y={20} width={badge.w} height={badge.h} rx={badge.r} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphCar x={220} y={38} s={0.8} c={c} />

        <Rect x={24} y={196} width={badge.w} height={badge.h} rx={badge.r} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphScooter x={38} y={210} s={0.75} c={c} />

        <Rect x={212} y={196} width={badge.w} height={badge.h} rx={badge.r} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphBox x={228} y={214} s={0.75} c={c} />

        <Circle cx="150" cy="140" r="36" fill={c.ink} />
        <Circle cx="150" cy="140" r="11" fill={c.accentMint} />
      </Svg>
    </View>
  );
}

/** Slide 2 — "Move your way": four service cards, one actively chosen. */
export function IllustModePicker({ colors: c }: { colors: ThemeColors }) {
  return (
    <View style={styles.container}>
      <View style={[styles.illustBg, { backgroundColor: c.snow }]} />
      <Svg viewBox="0 0 300 280" style={StyleSheet.absoluteFillObject}>
        <Rect x={24} y={26} width={122} height={100} rx={22} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphBus x={64} y={62} s={0.85} c={c} />

        {/* Selected: Car */}
        <Rect x={154} y={26} width={122} height={100} rx={22} fill={c.ink} stroke={c.accentMint} strokeWidth={2.5} />
        <GlyphCar x={192} y={62} s={0.8} tone="light" c={c} />

        <Rect x={24} y={144} width={122} height={100} rx={22} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphScooter x={68} y={182} s={0.75} c={c} />

        <Rect x={154} y={144} width={122} height={100} rx={22} fill={c.white} stroke={c.border} strokeWidth={1} />
        <GlyphBox x={196} y={182} s={0.75} c={c} />
      </Svg>
    </View>
  );
}

/** Slide 3 — "Everything connected": booking/tracking flowing into one wallet. */
export function IllustConnected({ colors: c }: { colors: ThemeColors }) {
  return (
    <View style={styles.container}>
      <View style={[styles.illustBg, { backgroundColor: c.snow }]} />
      <Svg viewBox="0 0 300 280" style={StyleSheet.absoluteFillObject}>
        <Path
          d="M90,64 C120,64 130,64 150,80 C170,96 180,96 210,96"
          stroke={c.border}
          strokeWidth="2.5"
          strokeDasharray="2 7"
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx="90" cy="64" r="9" fill={c.white} stroke={c.ink} strokeWidth="2" />
        <Circle cx="90" cy="64" r="3" fill={c.ink} />
        <Circle cx="210" cy="96" r="9" fill={c.white} stroke={c.ink} strokeWidth="2" />
        <Circle cx="210" cy="96" r="3" fill={c.ink} />

        <Path d="M150,110 L150,158" stroke={c.ink} strokeWidth="2.5" strokeLinecap="round" />
        <Circle cx="150" cy="134" r="7" fill={c.accentMint} />

        <Rect x={62} y={168} width={176} height={92} rx={22} fill={c.ink} />
        <Rect x={84} y={190} width={44} height={8} rx={4} fill={c.accentMint} />
        <Rect x={84} y={210} width={90} height={7} rx={3.5} fill={c.white} opacity={0.5} />
        <Rect x={84} y={226} width={60} height={7} rx={3.5} fill={c.white} opacity={0.3} />
        <Circle cx="204" cy="228" r="14" fill={c.white} opacity={0.1} />
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
    shadowColor: '#1e1e28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: Shadows.medium.elevation,
  },
});
