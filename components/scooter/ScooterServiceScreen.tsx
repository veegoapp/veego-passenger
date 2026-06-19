import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ArrowLeft, ArrowRight, Bike } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';

interface ScooterServiceScreenProps {
  onBack: () => void;
  embedded?: boolean;
}

function makeStyles(c: ThemeColors, insetTop: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#0d0e22',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    backBtn: {
      position: 'absolute',
      top: insetTop + 8,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: 'rgba(85,196,154,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(85,196,154,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: '#ffffff',
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 10,
    },
    sub: {
      fontSize: 14.5,
      color: 'rgba(255,255,255,0.5)',
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}

export function ScooterServiceScreen({ onBack, embedded }: ScooterServiceScreenProps) {
  const { isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const insetTop = Platform.OS === 'web' ? 60 : insets.top;

  const c = { isDark: true } as ThemeColors;
  const styles = makeStyles(c, insetTop);

  return (
    <View style={styles.root}>
      {!embedded && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
          {isRTL ? <ArrowRight size={18} color="#ffffff" /> : <ArrowLeft size={18} color="#ffffff" />}
        </TouchableOpacity>
      )}
      <View style={styles.iconWrap}>
        <Bike size={40} color="#55c49a" />
      </View>
      <Text style={styles.title}>Coming Soon</Text>
      <Text style={styles.sub}>Scooter service is{'\n'}coming to your city soon.</Text>
    </View>
  );
}
