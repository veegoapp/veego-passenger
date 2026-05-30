import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ArrowLeft, Check, Tag, XCircle, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { usePromos } from '@/src/hooks/usePromos';

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    },
    headerText: { flex: 1 },
    headerTitle: {
      fontSize: 20, fontWeight: '700', color: c.ink, letterSpacing: -0.5, fontFamily: 'Inter_700Bold',
    },
    headerSub: { fontSize: 12.5, color: c.inkSoft, marginTop: 1 },

    inputSection: { paddingHorizontal: 20, marginBottom: 24 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    inputWrap: {
      flex: 1, height: 52, borderRadius: 18, borderWidth: 1.5,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
    },
    inputField: { flex: 1, fontSize: 14.5, fontWeight: '600', letterSpacing: 0.5 },
    applyBtn: {
      height: 52, paddingHorizontal: 22, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    applyBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 1.2,
      paddingHorizontal: 20, marginBottom: 12,
    },
    promoList: { paddingHorizontal: 20, gap: 12 },
    promoCard: {
      borderRadius: 22, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    },
    promoGrad: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
    promoIconWrap: {
      width: 52, height: 52, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    promoMeta: { flex: 1 },
    promoTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 },
    promoSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
    promoExpiry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    promoExpiryText: { fontSize: 10.5, color: 'rgba(255,255,255,0.6)' },
    promoRight: { alignItems: 'flex-end', gap: 6 },
    promoDiscount: {
      fontSize: 20, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5,
    },
    promoCodeBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    promoCodeText: {
      fontSize: 11, fontWeight: '700', color: '#ffffff', letterSpacing: 1,
    },

    successWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16,
    },
    successCircle: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { fontSize: 22, fontWeight: '700', color: c.ink, letterSpacing: -0.4, textAlign: 'center' },
    successSub: { fontSize: 14, color: c.inkSoft, textAlign: 'center', lineHeight: 21 },
    successBtn: {
      marginTop: 8, height: 52, paddingHorizontal: 40, borderRadius: 18,
      backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center',
    },
    successBtnText: { fontSize: 15, fontWeight: '700', color: c.isDark ? c.background : c.white },
  });
}

export default function PromoScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, glassStyle: gs, t, language } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isAr = language === 'ar';

  // Deep-link pre-fill: /promo?code=XXXX
  const { code: prefillCode } = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(prefillCode ?? '');
  const [applied, setApplied] = useState(false);
  const [appliedCode, setAppliedCode] = useState('');
  const [validating, setValidating] = useState(false);
  const checkScale = useRef(new Animated.Value(0)).current;
  const autoApplied = useRef(false);

  const { promos, validateCode } = usePromos();

  const handleApply = async (inputCode: string) => {
    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setValidating(true);
    const result = await validateCode(trimmed);
    setValidating(false);

    if (result.valid) {
      setAppliedCode(trimmed);
      setApplied(true);
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }).start();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('promo_code_invalid'), result.message ?? t('promo_code_invalid_msg'));
    }
  };

  // Auto-apply when arriving via deep-link notification
  useEffect(() => {
    if (prefillCode && !autoApplied.current) {
      autoApplied.current = true;
      const trimmed = prefillCode.trim().toUpperCase();
      setCode(trimmed);
      // Small delay to let component mount fully before calling API
      setTimeout(() => handleApply(trimmed), 400);
    }
  }, [prefillCode]);

  const handleCardPress = (cardCode: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setCode(cardCode);
    handleApply(cardCode);
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft size={18} color={c.ink} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('promo_title')}</Text>
          <Text style={styles.headerSub}>{t('promo_subtitle')}</Text>
        </View>
      </View>

      {applied ? (
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: checkScale }] }]}>
            <Check size={42} color="#ffffff" />
          </Animated.View>
          <Text style={styles.successTitle}>{t('promo_code_applied')}</Text>
          <Text style={styles.successSub}>
            <Text style={{ fontWeight: '700', color: '#55c49a' }}>{appliedCode}</Text>
            {'\n'}{t('promo_code_applied_msg')}
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Text style={styles.successBtnText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <View style={styles.inputSection}>
            <View style={styles.inputRow}>
              <View style={[gs, styles.inputWrap, { borderColor: c.border }]}>
                <Tag size={16} color={c.inkSoft} />
                <TextInput
                  style={[styles.inputField, { color: c.ink }]}
                  placeholder={t('promo_input_placeholder')}
                  placeholderTextColor={c.inkSoft}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={() => handleApply(code)}
                />
                {code.length > 0 && (
                  <TouchableOpacity onPress={() => setCode('')}>
                    <XCircle size={16} color={c.silver} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: code.trim() && !validating ? c.ink : c.mist }]}
                onPress={() => handleApply(code)}
                activeOpacity={0.85}
                disabled={validating}
              >
                {validating
                  ? <ActivityIndicator color={c.white} size="small" />
                  : <Text style={[styles.applyBtnText, { color: code.trim() ? (c.isDark ? c.background : '#ffffff') : c.inkSoft }]}>
                      {t('promo_apply')}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('promo_featured')}</Text>
          <View style={styles.promoList}>
            {promos.map((promo) => (
              <TouchableOpacity
                key={promo.code}
                style={styles.promoCard}
                onPress={() => handleCardPress(promo.code)}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[promo.color, `${promo.color}cc`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.promoGrad}
                >
                  <View style={styles.promoIconWrap}>
                    {React.createElement(promo.icon as React.ComponentType<{size?:number;color?:string}>, { size: 24, color: '#ffffff' })}
                  </View>
                  <View style={styles.promoMeta}>
                    <Text style={styles.promoTitle}>{isAr ? promo.titleAr : promo.titleEn}</Text>
                    <Text style={styles.promoSub}>{isAr ? promo.subtitleAr : promo.subtitleEn}</Text>
                    <View style={styles.promoExpiry}>
                      <Clock size={11} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.promoExpiryText}>
                        {t('promo_expires')} {isAr ? promo.expiresAr : promo.expiresEn}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.promoRight}>
                    <Text style={styles.promoDiscount}>{promo.discount}</Text>
                    <View style={styles.promoCodeBadge}>
                      <Text style={styles.promoCodeText}>{promo.code}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </LinearGradient>
  );
}
