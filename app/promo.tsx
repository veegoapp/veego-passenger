import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Animated,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ArrowLeft, ArrowRight, Check, Tag, XCircle, Clock, Inbox } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { usePromos } from '@/src/hooks/shared/usePromos';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.lg, gap: Spacing.md,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: S.card, borderWidth: 1, borderColor: S.hair,
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 19, color: S.ink, letterSpacing: -0.4, fontWeight: '800' },
    headerSub: { fontSize: 12.5, color: S.inkSoft, marginTop: 1, fontWeight: '600' },

    inputSection: { paddingHorizontal: 20, marginBottom: Spacing.xl },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    inputWrap: {
      flex: 1, height: 52, backgroundColor: S.card, borderRadius: 18, borderWidth: 1.5, borderColor: S.hair,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, gap: 10,
    },
    inputField: { flex: 1, fontSize: 14.5, fontWeight: '600', letterSpacing: 0.5 },
    applyBtn: {
      height: 52, paddingHorizontal: 22, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    applyBtnText: { fontSize: 13.5, fontWeight: '700', color: '#ffffff' },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: S.cap,
      textTransform: 'uppercase', letterSpacing: 1.2,
      paddingHorizontal: 20, marginBottom: Spacing.md,
    },
    promoList: { paddingHorizontal: 20, gap: Spacing.md },
    promoCard: {
      borderRadius: 22, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    },
    promoInner: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
    promoIconWrap: {
      width: 52, height: 52, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    promoMeta: { flex: 1 },
    promoTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 },
    promoSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
    promoExpiry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 6 },
    promoExpiryText: { fontSize: 10.5, color: 'rgba(255,255,255,0.6)' },
    promoRight: { alignItems: 'flex-end', gap: 6 },
    promoDiscount: {
      fontSize: 20, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5,
    },
    promoCodeBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: Spacing.xs,
    },
    promoCodeText: {
      fontSize: 11, fontWeight: '700', color: '#ffffff', letterSpacing: 1,
    },

    successWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg,
    },
    successCircle: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: S.teal, alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { fontSize: 20, color: S.ink, letterSpacing: -0.3, textAlign: 'center', fontWeight: '800' },
    successSub: { fontSize: 13.5, color: S.inkSoft, textAlign: 'center', lineHeight: 21 },
    successBtn: {
      marginTop: Spacing.sm, height: 52, paddingHorizontal: 40, borderRadius: 999,
      backgroundColor: S.panel, alignItems: 'center', justifyContent: 'center',
    },
    successBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },

    emptyState: {
      alignItems: 'center', gap: Spacing.md, paddingVertical: 40, paddingHorizontal: Spacing.xxl,
    },
    emptyIcon: {
      width: 64, height: 64, borderRadius: 20, backgroundColor: S.surfaceMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    emptyText: { fontSize: 13.5, color: S.inkSoft, textAlign: 'center', lineHeight: 21 },
  });
}

/**
 * Normalise a discount string from the backend into the current locale.
 * Backend may send "20 EGP", "20%", or a raw number string.
 * - Percentage values are returned as-is.
 * - Fixed-amount values have their "EGP" suffix replaced with the localised
 *   currency label so Arabic users see "ج.م" instead of "EGP".
 */
function normalizeDiscount(discount: string, egpLabel: string): string {
  const trimmed = discount.trim();
  if (!trimmed) return trimmed;
  // Percentage — no currency label needed
  if (trimmed.endsWith('%')) return trimmed;
  // Strip any trailing "EGP" suffix (case-insensitive) and re-attach locale label
  const match = trimmed.match(/^(.+?)\s*EGP$/i);
  if (match) return `${match[1].trim()} ${egpLabel}`;
  return trimmed;
}

export default function PromoScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { t, language, isRTL } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setValidating(true);
    const result = await validateCode(trimmed);
    setValidating(false);

    if (result.valid) {
      setAppliedCode(trimmed);
      setApplied(true);
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAppAlert(t('promo_code_invalid'), result.message ?? t('promo_code_invalid_msg'));
    }
  };

  // Confirm with user before applying deep-link promo code
  useEffect(() => {
    if (prefillCode && !autoApplied.current) {
      autoApplied.current = true;
      const trimmed = prefillCode.trim().toUpperCase();
      setCode(trimmed);
      showAppAlert(
        t('promo_apply') || 'Apply Promo Code',
        `Apply code "${trimmed}"?`,
        [
          { text: t('cancel') || 'Cancel', style: 'cancel' },
          { text: t('promo_apply') || 'Apply', onPress: () => handleApply(trimmed) },
        ],
      );
    }
  }, [prefillCode]);

  const handleCardPress = (cardCode: string) => {
    Haptics.selectionAsync();
    setCode(cardCode);
    handleApply(cardCode);
  };

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={S.ink} /> : <ArrowLeft size={18} color={S.ink} />}
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
            <Text style={{ fontWeight: '800', color: S.teal }}>{appliedCode}</Text>
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
              <View style={styles.inputWrap}>
                <Tag size={16} color={S.inkSoft} />
                <TextInput
                  style={[styles.inputField, { color: S.ink }]}
                  placeholder={t('promo_input_placeholder')}
                  placeholderTextColor={S.cap}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  onSubmitEditing={() => handleApply(code)}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                {code.length > 0 && (
                  <TouchableOpacity onPress={() => setCode('')}>
                    <XCircle size={16} color={S.cap} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: code.trim() && !validating ? S.panel : S.surfaceMuted }]}
                onPress={() => handleApply(code)}
                activeOpacity={0.85}
                disabled={validating}
              >
                {validating
                  ? <AppLoader size={24} />
                  : <Text style={[styles.applyBtnText, { color: code.trim() ? '#ffffff' : S.inkSoft }]}>
                      {t('promo_apply')}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('promo_featured')}</Text>
          <View style={styles.promoList}>
            {promos.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Inbox size={28} color={S.inkSoft} />
                </View>
                <Text style={styles.emptyText}>{t('promo_no_featured')}</Text>
              </View>
            ) : (
              promos.map((promo) => (
                <TouchableOpacity
                  key={promo.code}
                  style={styles.promoCard}
                  onPress={() => handleCardPress(promo.code)}
                  activeOpacity={0.88}
                >
                  <View style={[styles.promoInner, { backgroundColor: promo.color }]}>
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
                      <Text style={styles.promoDiscount}>{normalizeDiscount(promo.discount, t('egp'))}</Text>
                      <View style={styles.promoCodeBadge}>
                        <Text style={styles.promoCodeText}>{promo.code}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
