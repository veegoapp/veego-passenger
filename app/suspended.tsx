import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldOff, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    iconCircle: {
      width: 96, height: 96, borderRadius: 32,
      backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22, fontWeight: '700', color: c.ink, textAlign: 'center',
      letterSpacing: -0.5, fontFamily: 'Inter_700Bold', marginBottom: 14, lineHeight: 30,
    },
    body: {
      fontSize: 14, color: c.inkSoft, textAlign: 'center', lineHeight: 22, marginBottom: 32,
    },
    primaryBtn: {
      width: '100%', height: 56, borderRadius: 20, backgroundColor: c.ink,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginBottom: 12, ...S.float,
    },
    primaryBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '700' },
    secondaryBtn: { paddingVertical: 12 },
    secondaryBtnText: { fontSize: 14, color: c.inkSoft },
  });
}

const SUPPORT_URL = 'https://wa.me/201000000000';

export default function SuspendedScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 40 : insets.top;
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handleContactSupport = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(SUPPORT_URL).catch(() => {
      router.push('/support' as any);
    });
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1, paddingTop: top }}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <ShieldOff size={44} color="#ef4444" strokeWidth={1.8} />
        </View>

        <Text style={styles.title}>
          تم إيقاف حسابك بسبب تكرار الغياب.{'\n'}تواصل مع الدعم لإعادة التفعيل.
        </Text>

        <Text style={styles.body}>
          Your account has been suspended due to repeated no-shows.{'\n'}
          Please contact support to reactivate it.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleContactSupport}
          activeOpacity={0.88}
        >
          <MessageCircle size={20} color={c.isDark ? c.background : c.white} />
          <Text style={styles.primaryBtnText}>تواصل مع الدعم · Contact Support</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
