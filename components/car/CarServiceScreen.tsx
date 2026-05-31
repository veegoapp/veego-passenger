import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, FlatList, Animated, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { CarMap, MOCK_DESTINATIONS } from './CarMap';
import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard } from './DriverAssignedCard';

type CarPhase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned';

interface CarServiceScreenProps {
  onBack: () => void;
}

const WADI_LOCS = Object.keys(MOCK_DESTINATIONS);

function makeStyles(c: ThemeColors, insetTop: number) {
  const inputBg = c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';
  const inputBorder = c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d0e22' },
    topOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      paddingTop: insetTop + 8,
    },
    topBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingBottom: 10,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
    },
    titleBlock: { flex: 1 },
    topTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500' },
    topSubtitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
    notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    searchWrap: { paddingHorizontal: 16, paddingBottom: 0 },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', height: 52,
      borderRadius: 18, paddingHorizontal: 16, gap: 10,
      backgroundColor: inputBg,
      borderWidth: 1.5, borderColor: inputBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
    },
    searchText: { flex: 1, fontSize: 14, fontWeight: '500' },
    searchPlaceholder: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '400' },
    destTag: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(85,196,154,0.2)', borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 4,
    },
    destTagText: { fontSize: 11.5, color: '#55c49a', fontWeight: '500', maxWidth: 120 },
    clearBtn: { padding: 4 },
    selectingModal: { flex: 1, backgroundColor: c.isDark ? '#0f0f1e' : '#f4f4f8' },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingBottom: 12,
      paddingTop: Platform.OS === 'web' ? 20 : insetTop + 8,
      backgroundColor: c.isDark ? '#1a1a2e' : '#ffffff',
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    modalBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontWeight: '600', color: c.ink, flex: 1 },
    searchInputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginVertical: 12, height: 48,
      borderRadius: 16, paddingHorizontal: 14, borderWidth: 1,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.white,
      borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: c.ink },
    locItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 15,
      borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.border,
    },
    locIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    locText: { flex: 1, fontSize: 13.5, color: c.ink, fontWeight: '500' },
    locArrow: {},
    emptyTip: { paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' },
    emptyTipText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
  });
}

export function CarServiceScreen({ onBack }: CarServiceScreenProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const insetTop = Platform.OS === 'web' ? 60 : insets.top;
  const styles = useMemo(() => makeStyles(c, insetTop), [c, insetTop]);

  const [phase, setPhase] = useState<CarPhase>('idle');
  const [destination, setDestination] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<'economy' | 'premium' | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredLocs = searchQuery.trim()
    ? WADI_LOCS.filter(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : WADI_LOCS;

  const handleSelectDestination = (loc: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setDestination(loc);
    setPhase('ride_options');
  };

  const handleConfirmRide = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('searching');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPhase('driver_assigned');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 3500);
  };

  const handleCancel = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setPhase('idle');
    setDestination(null);
    setSelectedRide(null);
  };

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  return (
    <View style={styles.root}>
      {/* Full-screen map */}
      <CarMap phase={phase} destination={destination} />

      {/* Top overlay */}
      <View style={styles.topOverlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={18} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={styles.topTitle}>{t('good_morning')}</Text>
            <Text style={styles.topSubtitle}>VeeGo</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} activeOpacity={0.85}>
            <Ionicons name="notifications-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Car-specific search box */}
        <View style={styles.searchWrap}>
          <TouchableOpacity
            style={styles.searchBox}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setSearchQuery('');
              setPhase('selecting');
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="search-outline" size={16} color={destination ? '#55c49a' : 'rgba(255,255,255,0.5)'} />
            {destination ? (
              <>
                <View style={styles.destTag}>
                  <Ionicons name="location" size={12} color="#55c49a" />
                  <Text style={styles.destTagText} numberOfLines={1}>{destination}</Text>
                </View>
                <TouchableOpacity style={styles.clearBtn} onPress={handleCancel}>
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.searchPlaceholder}>{t('where_going_car')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Destination selector modal */}
      <Modal
        visible={phase === 'selecting'}
        animationType="slide"
        onRequestClose={() => setPhase('idle')}
      >
        <View style={styles.selectingModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalBackBtn} onPress={() => setPhase('idle')} activeOpacity={0.8}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={18} color={c.ink} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('choose_dest')}</Text>
          </View>

          <View style={styles.searchInputRow}>
            <Ionicons name="search-outline" size={15} color={c.inkSoft} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('search_dest')}
              placeholderTextColor={c.inkSoft}
              autoFocus
              textAlign={isRTL ? 'right' : 'left'}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={c.silver} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredLocs}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.locItem}
                onPress={() => handleSelectDestination(item)}
                activeOpacity={0.8}
              >
                <View style={styles.locIcon}>
                  <Ionicons name="location-outline" size={16} color={c.inkSoft} />
                </View>
                <Text style={styles.locText}>{item}</Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={14} color={c.silver} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyTip}>
                <Ionicons name="search-outline" size={28} color={c.silver} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTipText}>{t('no_results')}</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Phase overlays */}
      <RideOptionsSheet
        visible={phase === 'ride_options'}
        destination={destination}
        selected={selectedRide}
        onSelect={setSelectedRide}
        onConfirm={handleConfirmRide}
        onDismiss={handleCancel}
      />

      <DriverSearching visible={phase === 'searching'} />

      <DriverAssignedCard
        visible={phase === 'driver_assigned'}
        rideType={selectedRide}
        destination={destination}
        onCancel={handleCancel}
      />
    </View>
  );
}
