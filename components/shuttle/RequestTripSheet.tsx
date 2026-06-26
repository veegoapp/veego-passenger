import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle, X, ArrowRight, ArrowLeft, Clock, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { submitTripRequest, TripRequestDirection } from '@/src/api/shuttleService';
import type { Route } from '@/constants/data';

const OUTBOUND_SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00'];
const RETURN_SLOTS   = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'];

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 10000, pointerEvents: 'box-none' as any },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.isDark ? '#16162a' : '#f5f5fa',
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      ...S.float, paddingBottom: 32,
      maxHeight: '88%',
    },
    handle: {
      width: 44, height: 5, borderRadius: 2.5,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
      alignSelf: 'center', marginTop: 14, marginBottom: 4,
    },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.ink },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center',
    },
    routeTag: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    routeTagText: { fontSize: 12, color: c.inkSoft, fontWeight: '500' },

    scroll: { flexGrow: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },

    sectionLabel: {
      fontSize: 12, fontWeight: '700', color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
    },

    directionRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    dirBtn: {
      flex: 1, paddingVertical: 11, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: c.border,
      backgroundColor: c.white,
      flexDirection: 'row', gap: 6,
    },
    dirBtnActive: { borderColor: c.ink, backgroundColor: c.ink },
    dirBtnText: { fontSize: 14, fontWeight: '600', color: c.inkSoft },
    dirBtnTextActive: { color: c.isDark ? c.background : '#ffffff' },

    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    slotBtn: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.border,
      backgroundColor: c.white,
      minWidth: 68, alignItems: 'center',
    },
    slotBtnActive: { borderColor: c.ink, backgroundColor: c.ink },
    slotText: { fontSize: 13, fontWeight: '600', color: c.ink },
    slotTextActive: { color: c.isDark ? c.background : '#ffffff' },

    ctaWrap: { paddingHorizontal: 20, paddingTop: 16 },
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 16, borderRadius: 20,
      backgroundColor: c.ink,
    },
    ctaBtnDisabled: { opacity: 0.35 },
    ctaBtnText: { fontSize: 16, fontWeight: '700', color: c.isDark ? c.background : '#ffffff' },

    successWrap: {
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 28, paddingVertical: 36, gap: 14,
    },
    successIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: 'rgba(22,163,74,0.12)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    successTitle: { fontSize: 20, fontWeight: '700', color: c.ink, textAlign: 'center' },
    successMsg: { fontSize: 14, color: c.inkSoft, textAlign: 'center', lineHeight: 21 },
    doneBtn: {
      marginTop: 8, paddingVertical: 14, paddingHorizontal: 40,
      borderRadius: 18, backgroundColor: c.ink,
    },
    doneBtnText: { fontSize: 15, fontWeight: '700', color: c.isDark ? c.background : '#ffffff' },
  });
}

interface Props {
  visible: boolean;
  route: Route;
  onClose: () => void;
}

export function RequestTripSheet({ visible, route, onClose }: Props) {
  const { colors: c, t, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

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
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isValid = outboundTime !== null && (direction === 'one_way' || returnTime !== null);

  const handleSubmit = async () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await submitTripRequest({
        routeId: route.id,
        direction,
        outboundTime: outboundTime!,
        ...(direction === 'round_trip' && returnTime ? { returnTime } : {}),
      });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('[TripRequest] error status:', e?.response?.status);
      console.error('[TripRequest] error data:', JSON.stringify(e?.response?.data));
      console.error('[TripRequest] error message:', e?.message);
      const code = e?.response?.data?.error;
      if (code === 'trip_requests_disabled') {
        Alert.alert('', t('trip_request_disabled'));
      } else {
        Alert.alert('', t('trip_request_error'));
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
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={styles.routeTag}>
            <Text style={styles.headerTitle}>{t('request_a_trip')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.routeTagText} numberOfLines={1}>{routeName}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={15} color={c.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {success ? (
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <CheckCircle size={38} color="#16a34a" />
            </View>
            <Text style={styles.successTitle}>{t('trip_request_sent')}</Text>
            <Text style={styles.successMsg}>{t('trip_request_msg')}</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>{t('confirm')}</Text>
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
                        <RotateCcw size={14} color={active ? (c.isDark ? c.background : '#fff') : c.inkSoft} />
                      )}
                      <Text style={[styles.dirBtnText, active && styles.dirBtnTextActive]}>
                        {t(d === 'one_way' ? 'one_way' : 'round_trip')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Outbound time */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock size={13} color={c.inkSoft} />
                <Text style={styles.sectionLabel}>{t('outbound_time')}</Text>
              </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Clock size={13} color={c.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('return_time')}</Text>
                  </View>
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
                {loading ? (
                  <ActivityIndicator color={c.isDark ? c.background : '#ffffff'} />
                ) : (
                  <>
                    <Text style={styles.ctaBtnText}>{t('send_request')}</Text>
                    {isRTL
                      ? <ArrowLeft size={18} color={c.isDark ? c.background : '#ffffff'} />
                      : <ArrowRight size={18} color={c.isDark ? c.background : '#ffffff'} />
                    }
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}
