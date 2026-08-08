/**
 * Presentation sections extracted verbatim from app/(tabs)/index.tsx (Home).
 *
 * Pure presentation components: all state, data fetching, and handlers stay
 * in HomeScreen and arrive here as props (including the makeStyles result,
 * passed as `styles`). No JSX structure, style, or logic changes.
 */
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bus, Car, Bike as ScooterIcon, Package, Bell, Search,
  ArrowRight, ArrowLeft, Navigation, Wrench, AlertCircle,
} from 'lucide-react-native';
import type { ThemeColors } from '@/constants/colors';
import type { ServiceType } from '@/context/ServiceControlContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { GlassView } from '@/components/ui/GlassView';

type T = (key: string) => string;

export const SERVICES = [
  { id: 'shuttle' as const, labelKey: 'shuttle' as const, icon: Bus },
  { id: 'car' as const, labelKey: 'car' as const, icon: Car },
  { id: 'scooter' as const, labelKey: 'scooter' as const, icon: ScooterIcon },
  { id: 'delivery' as const, labelKey: 'delivery' as const, icon: Package },
];

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  label?: string;
  isDefault?: boolean;
  /** Present on unresolved Google Places suggestions — latitude/longitude are
   * placeholders until /places/details resolves them (see app/(tabs)/index.tsx). */
  placeId?: string;
}

/** ── Greeting + notification/profile icons ── */
export function HomeHeader({ styles, gs, c, t, greetingKey, firstName, avatarInitials, unreadCount, onNotifications, onProfile }: {
  styles: any; gs: object; c: ThemeColors; t: T;
  greetingKey: string; firstName: string; avatarInitials: string; unreadCount: number;
  onNotifications: () => void; onProfile: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.brandLockup}>
          <View style={styles.brandIcon}>
            <Navigation size={16} color="#ffffff" />
          </View>
          <Text style={styles.wordmark}>Vee<Text style={styles.wordmarkAccent}>Go</Text></Text>
        </View>
        <View style={styles.headerDivider} />
        <View>
          <Text style={styles.greeting}>{t(greetingKey)}</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={onNotifications} accessibilityLabel="Notifications">
          <GlassView style={styles.iconBtn} borderRadius={20}>
            <Bell size={18} color={c.ink} strokeWidth={2} />
            {unreadCount > 0 && (
              <View style={[styles.notifDot, { backgroundColor: c.error }]}>
                <Text style={styles.notifDotText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            )}
          </GlassView>
        </TouchableOpacity>
        <TouchableOpacity style={styles.avatar} onPress={onProfile} accessibilityLabel="Profile">
          <Text style={styles.avatarText}>{avatarInitials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** ── Service tabs grid (shuttle / car / scooter / delivery) ── */
export function ServiceGrid({ styles, c, t, mode, getService, isServiceVisibleForZone, onServicePress }: {
  styles: any; c: ThemeColors; t: T; mode: string;
  getService: (id: ServiceType) => any;
  isServiceVisibleForZone: (id: ServiceType) => boolean;
  onServicePress: (id: string) => void;
}) {
  return (
    <View style={styles.serviceGrid}>
      {SERVICES.map((svc) => {
        const ctrl = getService(svc.id as ServiceType);
        const displayMode = ctrl?.displayMode ?? 'live';
        const isEnabled = ctrl?.isEnabled ?? true;

        // Zone check: hide service if user is outside all active zones
        if (!isServiceVisibleForZone(svc.id as ServiceType)) return null;

        // isEnabled = false → hide service completely (strict spec rule)
        if (ctrl && !isEnabled) return null;

        const active = mode === svc.id && displayMode === 'live';
        const isComingSoon = displayMode === 'coming_soon';
        const isMaintenance = displayMode === 'maintenance';
        const isUnavailable = displayMode === 'unavailable';
        const isDisabled = isComingSoon || isMaintenance || isUnavailable;

        const btnStyle = active
          ? styles.serviceBtnActive
          : isDisabled
          ? styles.serviceBtnSoon
          : styles.serviceBtnInactive;

        const iconColor = active
          ? (c.isDark ? c.background : c.white)
          : c.inkSoft;

        const badgeText = isComingSoon
          ? t('soon')
          : isMaintenance
          ? (ctrl?.maintenanceEta ? `${t('back_label')} ${ctrl.maintenanceEta}` : t('maintenance_badge'))
          : isUnavailable
          ? t('service_unavailable')
          : null;

        const labelColor = active ? (c.isDark ? c.background : c.white) : c.ink;

        return (
          <TouchableOpacity
            key={svc.id}
            style={[styles.serviceBtn, btnStyle]}
            onPress={() => !isDisabled && onServicePress(svc.id)}
            activeOpacity={isDisabled ? 1 : 0.8}
          >
            {badgeText ? (
              <View style={styles.soonBadgeFloat}>
                <Text style={styles.soonBadgeText}>{badgeText}</Text>
              </View>
            ) : null}
            <View style={[styles.serviceIconBox, active && styles.serviceIconBoxActive]}>
              {isMaintenance
                ? <Wrench size={15} color={c.inkSoft} />
                : <svc.icon size={15} color={iconColor} />
              }
            </View>
            <Text
              style={[styles.serviceLabel, { color: labelColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {t(svc.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** ── §21.7: Outstanding debt banner ── */
export function DebtBanner({ c, t }: { c: ThemeColors; t: T }) {
  return (
    <View style={{
      marginHorizontal: 20,
      marginBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.isDark ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.08)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.25)',
      padding: Spacing.md,
    }}>
      <AlertCircle size={16} color="#dc2626" style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: Typography.weight.bold, color: '#dc2626', marginBottom: 2 }}>
          {t('debt_banner_title')}
        </Text>
        <Text style={{ fontSize: Typography.size.xs, color: c.isDark ? 'rgba(220,38,38,0.8)' : '#7f1d1d', lineHeight: 17 }}>
          {t('debt_banner_body')}
        </Text>
      </View>
    </View>
  );
}

/** ── Debt check failed — distinct from "no debt" / "has debt" states, with retry ── */
export function DebtErrorBanner({ c, t, onRetry }: { c: ThemeColors; t: T; onRetry: () => void }) {
  return (
    <View style={{
      marginHorizontal: 20,
      marginBottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14,
      padding: Spacing.md,
    }}>
      <AlertCircle size={16} color={c.inkSoft} />
      <Text style={{ flex: 1, fontSize: Typography.size.xs, color: c.inkSoft, lineHeight: 17 }}>
        {t('debt_check_failed')}
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.75}>
        <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: c.ink }}>
          {t('retry')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** ── Zone-filtered services banner ── */
export function ZoneServicesBanner({ c, t, hiddenCount, userZoneId }: {
  c: ThemeColors; t: T; hiddenCount: number; userZoneId: unknown;
}) {
  if (hiddenCount === 0 || userZoneId === undefined) return null;
  return (
    <View style={{
      marginHorizontal: 20, marginTop: -4, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      backgroundColor: c.isDark ? 'rgba(255,180,0,0.10)' : 'rgba(245,158,11,0.08)',
      borderRadius: Radius.md, borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,180,0,0.20)' : 'rgba(245,158,11,0.2)',
      padding: 10,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginTop: 5 }} />
      <Text style={{ flex: 1, fontSize: 11.5, color: c.isDark ? '#f59e0b' : '#92400e', lineHeight: 16 }}>
        {hiddenCount === 1
          ? t('service_not_available_1')
          : t('services_not_available_n').replace('{n}', String(hiddenCount))}
      </Text>
    </View>
  );
}

/** ── Active shuttle booking hero card ── */
export function ActiveBookingHero({ styles, c, t, isAr, isRTL, onPress,
  routeName, routeNameAr, time, fromName, fromNameAr, toName,
}: {
  styles: any; c: ThemeColors; t: T; isAr: boolean; isRTL: boolean; onPress: () => void;
  /** Route display name (English) */
  routeName: string;
  /** Route display name (Arabic) — null when not available */
  routeNameAr: string | null;
  /** Formatted departure time string */
  time: string;
  /** Boarding station name (English) */
  fromName: string;
  /** Boarding station name (Arabic) — null when not available */
  fromNameAr: string | null;
  /** Destination location name — toLocation from the route; no Arabic in contract */
  toName: string;
}) {
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2e2e3e']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>{t('next_departure')}</Text>
            <Text style={styles.heroRouteName}>{isAr ? (routeNameAr ?? routeName) : routeName}</Text>
          </View>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{time}</Text></View>
        </View>
        <View style={styles.heroBottom}>
          <View style={styles.heroStation}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
            <Text style={styles.heroStationName}>
              {isAr ? (fromNameAr ?? fromName) : fromName}
            </Text>
          </View>
          {isRTL ? <ArrowLeft size={12} color="rgba(255,255,255,0.5)" /> : <ArrowRight size={12} color="rgba(255,255,255,0.5)" />}
          <View style={styles.heroStation}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#55c49a' }} />
            <Text style={styles.heroStationName}>{toName}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** ── Dedicated destination search screen (modal) ── */
export function DestinationSearchModal({
  styles, c, t, isRTL, top,
  activeSearchField, setActiveSearchField, typedText, setTypedText,
  pickupLocation, destinationLocation, filteredSuggestions,
  onClose, onPickSuggestion,
}: {
  styles: any; c: ThemeColors; t: T; isRTL: boolean; top: number;
  activeSearchField: 'from' | 'to' | null;
  setActiveSearchField: (f: 'from' | 'to' | null) => void;
  typedText: string; setTypedText: (s: string) => void;
  pickupLocation: string; destinationLocation: string;
  filteredSuggestions: SavedLocation[];
  onClose: () => void; onPickSuggestion: (item: SavedLocation) => void;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.searchScreenRoot, { paddingTop: top + 8 }]}>
        <View style={styles.searchScreenHeader}>
          <TouchableOpacity style={styles.searchScreenBackBtn} onPress={onClose} activeOpacity={0.8}>
            {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
          </TouchableOpacity>
          <Text style={styles.searchScreenTitle}>{t('choose_dest')}</Text>
        </View>

        <View style={[styles.mapSearchBox, { marginHorizontal: Spacing.md }]}>
          {/* A) Current pickup location */}
          <TouchableOpacity
            style={[styles.mapInputRow, activeSearchField === 'from' && styles.mapInputRowActive]}
            onPress={() => { setActiveSearchField('from'); setTypedText(''); }}
          >
            <View style={{ width: 20, alignItems: 'center' }}><View style={styles.dotGreen} /></View>
            {activeSearchField === 'from' ? (
              <TextInput
                style={styles.mapInputText}
                value={typedText}
                onChangeText={setTypedText}
                placeholder={t('enter_pickup')}
                placeholderTextColor={c.inkSoft}
                textAlign={isRTL ? 'right' : 'left'}
                autoFocus
              />
            ) : (
              <Text style={styles.mapInputText} numberOfLines={1}>{pickupLocation || t('current_location')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.mapInputDivider} />

          {/* B) Destination input field */}
          <TouchableOpacity
            style={[styles.mapInputRow, activeSearchField === 'to' && styles.mapInputRowActive]}
            onPress={() => { setActiveSearchField('to'); setTypedText(''); }}
          >
            <View style={{ width: 20, alignItems: 'center' }}><View style={styles.dotRed} /></View>
            {activeSearchField === 'to' ? (
              <TextInput
                style={styles.mapInputText}
                value={typedText}
                onChangeText={setTypedText}
                placeholder={t('where_to')}
                placeholderTextColor={c.inkSoft}
                textAlign={isRTL ? 'right' : 'left'}
                autoFocus
              />
            ) : (
              <Text
                style={[styles.mapInputText, !destinationLocation && styles.mapInputPlaceholder]}
                numberOfLines={1}
              >
                {destinationLocation || t('where_to')}
              </Text>
            )}
            <Search size={14} color={c.inkSoft} />
          </TouchableOpacity>
        </View>

        {/* C) Previously used destinations */}
        <Text style={styles.savedSectionLabel}>{t('saved_locations')}</Text>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {filteredSuggestions.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: c.inkSoft, textAlign: 'center', lineHeight: 19 }}>
                {typedText.trim().length >= 2 ? t('no_results_found') : t('no_saved_locations')}
              </Text>
            </View>
          ) : (
            filteredSuggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: c.border }}
                onPress={() => onPickSuggestion(item)}
              >
                <Navigation size={15} color={c.inkSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: Typography.weight.medium, color: c.ink }}>{item.name}</Text>
                  {!!item.address && <Text style={{ fontSize: 11.5, color: c.inkSoft }} numberOfLines={1}>{item.address}</Text>}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** ── Bottom floating service cards (new home layout) ── */
export function ServiceCards({ c, t, getService, isServiceVisibleForZone, onServicePress }: {
  c: ThemeColors; t: T;
  getService: (id: ServiceType) => any;
  isServiceVisibleForZone: (id: ServiceType) => boolean;
  onServicePress: (id: string) => void;
}) {
  const CARD_ITEMS = [
    { id: 'shuttle' as const, icon: Bus,         labelKey: 'svc_card_shuttle' },
    { id: 'car'     as const, icon: Car,         labelKey: 'svc_card_car' },
    { id: 'scooter' as const, icon: ScooterIcon, labelKey: 'svc_card_scooter' },
    { id: 'delivery' as const, icon: Package,    labelKey: 'svc_card_delivery' },
  ];

  return (
    <View style={scStyles.row}>
      {CARD_ITEMS.map((item) => {
        const ctrl = getService(item.id as ServiceType);
        const isEnabled  = ctrl?.isEnabled  ?? true;
        const displayMode = ctrl?.displayMode ?? 'live';
        if (!isServiceVisibleForZone(item.id as ServiceType)) return null;
        if (ctrl && !isEnabled) return null;
        const isDisabled = displayMode === 'coming_soon' || displayMode === 'maintenance' || displayMode === 'unavailable';
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={item.id}
            style={[scStyles.card, { backgroundColor: c.white, borderColor: c.border, opacity: isDisabled ? 0.5 : 1 }]}
            onPress={() => !isDisabled && onServicePress(item.id)}
            activeOpacity={0.75}
            disabled={isDisabled}
          >
            <Icon size={28} color={c.ink} strokeWidth={1.6} />
            <Text style={[scStyles.label, { color: c.ink }]}>{t(item.labelKey)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const scStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
});
