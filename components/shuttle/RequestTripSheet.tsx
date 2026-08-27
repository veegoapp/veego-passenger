import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView, BackHandler,
} from 'react-native';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import * as Haptics from 'expo-haptics';
import { CheckCircle, X, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { Animation } from '@/constants/animations';
import { submitTripRequest, TripRequestDirection } from '@/src/api/shuttleService';
import type { Route } from '@/constants/data';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

const OUTBOUND_SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00'];
const RETURN_SLOTS   = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_PANEL = '#14151A';
const C_TEAL = '#0E9F8E';
const C_CAP = '#9AA0A6';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_MIST = '#F0F2F3';

function makeStyles(c: ThemeColors, insetsBottom: number) {
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 10000, pointerEvents: 'box-none' as any },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      ...S.float,
      maxHeight: '88%',
    },
    sheetGlass: {
      backgroundColor: '#fff',
      borderTopLeftRadius: 30, borderTopRightRadius: 30,
      borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
      paddingBottom: Spacing.xxl,
    },
    handle: {
      width: 40, height: 5, borderRadius: 2.5,
      backgroundColor: 'rgba(0,0,0,0.14)',
      alignSelf: 'center', marginTop: 12, marginBottom: Spacing.xs,
    },

    header: {
      marginHorizontal: 16, marginTop: 4, marginBottom: 4,
      backgroundColor: C_PANEL, borderRadius: 22, padding: 18,
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    headerCap: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: C_CAP },
    closeBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 3 },

    scroll: { flexGrow: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: Spacing.sm },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: C_CAP,
      textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10,
    },

    directionRow: { flexDirection: 'row', padding: 4, gap: 2, backgroundColor: C_MIST, borderRadius: 16, marginBottom: Spacing.xl },
    dirBtn: {
      flex: 1, height: 42, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'row', gap: 6,
    },
    dirBtnActive: { backgroundColor: C_PANEL },
    dirBtnText: { fontSize: 12.5, fontWeight: '700', color: C_INK_SOFT },
    dirBtnTextActive: { color: '#ffffff' },

    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
    slotBtn: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      borderWidth: 1.5, borderColor: '#E2E5E8',
      backgroundColor: '#fff',
      minWidth: 68, alignItems: 'center',
    },
    slotBtnActive: { borderColor: C_PANEL, backgroundColor: C_PANEL },
    slotText: { fontSize: 12.5, fontWeight: '700', color: C_INK },
    slotTextActive: { color: '#ffffff' },

    ctaWrap: { paddingHorizontal: 20, paddingTop: Spacing.lg, paddingBottom: Spacing.lg + insetsBottom },
    ctaBtn: { borderRadius: 20, overflow: 'hidden' },
    ctaBtnGradient: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: Spacing.lg, backgroundColor: C_TEAL,
    },
    ctaBtnDisabled: { opacity: 0.35 },
    ctaBtnText: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: '#ffffff' },

    successWrap: {
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 28, paddingVertical: 36, gap: 14,
    },
    successIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: 'rgba(14,159,142,0.1)',
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
    },
    successTitle: { fontSize: 20, fontWeight: '800', color: C_INK, textAlign: 'center' },
    successMsg: { fontSize: Typography.size.sm, color: C_INK_SOFT, textAlign: 'center', lineHeight: 21 },
    doneBtn: { marginTop: Spacing.sm, borderRadius: 999, overflow: 'hidden' },
    doneBtnGradient: { paddingVertical: 14, paddingHorizontal: 40, backgroundColor: C_TEAL },
    doneBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  });
}

interface Props {
  visible: boolean;
  route: Route;
  onClose: () => void;
}

export function RequestTripSheet({ visible, route, onClose }: Props) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets.bottom), [c, insets.bottom]);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [direction, setDirection] = useState<TripRequestDirection>('one_way');
  const [outboundTime, setOutboundTime] = useState<string | null>(null);
  const [returnTime, setReturnTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setSuccess(false);
      setDirection('one_way');
      setOutboundTime(null);
      setReturnTime(null);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, ...Animation.spring.sheet }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: Animation.duration.fast, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const isValid = outboundTime !== null && (direction === 'one_way' || returnTime !== null);

  const handleSubmit = async () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await submitTripRequest({
        routeId: Number(route.id),
        direction,
        outboundTime: outboundTime!,
        ...(direction === 'round_trip' && returnTime ? { returnTime } : {}),
      });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (__DEV__) {
        console.error('[TripRequest] error status:', e?.response?.status);
        console.error('[TripRequest] error data:', JSON.stringify(e?.response?.data));
        console.error('[TripRequest] error message:', e?.message);
      }
      const code = e?.response?.data?.error;
      if (code === 'trip_requests_disabled') {
        showAppAlert('', t('trip_request_disabled'));
      } else {
        showAppAlert('', t('trip_request_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const routeName = route.name;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetGlass}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerCap}>{t('request_a_trip')}</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>{routeName}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <X size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {success ? (
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <CheckCircle size={38} color={C_TEAL} />
            </View>
            <Text style={styles.successTitle}>{t('trip_request_sent')}</Text>
            <Text style={styles.successMsg}>{t('trip_request_msg')}</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
              <View style={styles.doneBtnGradient}>
                <Text style={styles.doneBtnText}>{t('confirm')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Direction */}
              <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
                {t('trip_request_direction')}
              </Text>
              <View style={[styles.directionRow, isRTL && { flexDirection: 'row-reverse' }]}>
                {(['one_way', 'round_trip'] as TripRequestDirection[]).map((d) => {
                  const active = direction === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dirBtn, active && styles.dirBtnActive]}
                      onPress={() => { setDirection(d); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                    >
                      {d === 'round_trip' && (
                        <RotateCcw size={14} color={active ? '#fff' : C_INK_SOFT} />
                      )}
                      <Text style={[styles.dirBtnText, active && styles.dirBtnTextActive]}>
                        {t(d === 'one_way' ? 'one_way' : 'round_trip')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Outbound time */}
              <Text style={styles.sectionLabel}>{t('outbound_time')}</Text>
              <View style={styles.slotsGrid}>
                {OUTBOUND_SLOTS.map((slot) => {
                  const active = outboundTime === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.slotBtn, active && styles.slotBtnActive]}
                      onPress={() => { setOutboundTime(slot); Haptics.selectionAsync(); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Return time — only if round_trip */}
              {direction === 'round_trip' && (
                <>
                  <Text style={styles.sectionLabel}>{t('return_time')}</Text>
                  <View style={styles.slotsGrid}>
                    {RETURN_SLOTS.map((slot) => {
                      const active = returnTime === slot;
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[styles.slotBtn, active && styles.slotBtnActive]}
                          onPress={() => { setReturnTime(slot); Haptics.selectionAsync(); }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.ctaWrap}>
              <TouchableOpacity
                style={[styles.ctaBtn, (!isValid || loading) && styles.ctaBtnDisabled]}
                disabled={!isValid || loading}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <View style={styles.ctaBtnGradient}>
                  {loading ? (
                    <AppLoader size={24} />
                  ) : (
                    <>
                      <Text style={styles.ctaBtnText}>{t('send_request')}</Text>
                      {isRTL
                        ? <ArrowLeft size={18} color="#ffffff" />
                        : <ArrowRight size={18} color="#ffffff" />
                      }
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
        </View>
      </Animated.View>
    </View>
  );
}
