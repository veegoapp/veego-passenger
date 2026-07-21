import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, KeyboardAvoidingView, SafeAreaView, Platform,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { Home, Briefcase, MapPin, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import {
  getSavedLocations, createSavedLocation, updateSavedLocation, deleteSavedLocation,
  type SavedLocationRecord,
} from '@/src/api/savedLocationsService';
import { getPlaceAutocomplete, getPlaceDetails, generateSessionToken, type PlaceSuggestion } from '@/src/api/placesService';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { makeStyles, ModalHeader } from './shared';

type LocationLabel = 'home' | 'work' | 'other';
type ScreenMode = 'list' | 'form';

function iconForLabel(label?: string) {
  const normalized = (label || '').toLowerCase();
  if (normalized === 'home') return Home;
  if (normalized === 'work') return Briefcase;
  return MapPin;
}

export function SavedLocationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t, language } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [view, setView] = useState<ScreenMode>('list');
  const [locations, setLocations] = useState<SavedLocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState<LocationLabel>('other');
  const [formAddress, setFormAddress] = useState('');
  const [formCoords, setFormCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressSessionToken, setAddressSessionToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getSavedLocations();
      setLocations(list);
    } catch {
      // Non-fatal — list just stays empty/stale, consistent with the Home
      // screen's own saved-locations fetch failure handling.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setView('list');
      refresh();
    }
  }, [visible, refresh]);

  // Address autocomplete inside the add/edit form — same backend endpoints
  // and session-token technique as the Home screen's destination search,
  // just scoped to this form instead of reusing that screen's state.
  useEffect(() => {
    if (!addressQuery || addressQuery.trim().length < 2 || !addressSessionToken) {
      setAddressSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await getPlaceAutocomplete(
          addressQuery, addressSessionToken, language === 'ar' ? 'ar' : 'en', undefined, controller.signal,
        );
        setAddressSuggestions(results);
      } catch {}
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [addressQuery, addressSessionToken, language]);

  const handleAddressQueryChange = (text: string) => {
    setAddressQuery(text);
    setFormCoords(null); // retyping invalidates whatever was previously resolved
    if (!addressSessionToken) setAddressSessionToken(generateSessionToken());
  };

  const handlePickAddress = async (s: PlaceSuggestion) => {
    if (!addressSessionToken) return;
    try {
      const details = await getPlaceDetails(s.placeId, addressSessionToken);
      if (!details) {
        Alert.alert(t('error'), t('location_error_msg'));
        return;
      }
      setFormAddress(details.address || s.description);
      setAddressQuery(details.address || s.description);
      setFormCoords({ latitude: details.latitude, longitude: details.longitude });
      setAddressSuggestions([]);
      setAddressSessionToken(null);
    } catch {
      Alert.alert(t('error'), t('location_error_msg'));
    }
  };

  const openAddForm = () => {
    Haptics.selectionAsync();
    setEditingId(null);
    setFormName('');
    setFormLabel('other');
    setFormAddress('');
    setFormCoords(null);
    setAddressQuery('');
    setAddressSuggestions([]);
    setAddressSessionToken(null);
    setView('form');
  };

  const openEditForm = (loc: SavedLocationRecord) => {
    Haptics.selectionAsync();
    setEditingId(loc.id);
    setFormName(loc.name);
    setFormLabel(loc.label === 'home' || loc.label === 'work' ? loc.label : 'other');
    setFormAddress(loc.address);
    setFormCoords({ latitude: loc.latitude, longitude: loc.longitude });
    setAddressQuery(loc.address);
    setAddressSuggestions([]);
    setAddressSessionToken(null);
    setView('form');
  };

  const handleSave = async () => {
    if (saving) return;
    if (!formName.trim() || !formCoords) {
      Alert.alert(t('error'), t('saved_location_missing_fields'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        address: formAddress || addressQuery,
        latitude: formCoords.latitude,
        longitude: formCoords.longitude,
        label: formLabel,
      };
      if (editingId != null) {
        await updateSavedLocation(editingId, payload);
      } else {
        await createSavedLocation(payload);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      setView('list');
    } catch (e: any) {
      const status = e?.response?.status;
      const msg: string = e?.response?.data?.message ?? e?.response?.data?.error ?? '';
      if (status === 409) {
        const isMax = /max|limit|20/i.test(msg);
        Alert.alert(t('error'), isMax ? t('saved_locations_limit_reached') : t('saved_location_duplicate'));
      } else {
        Alert.alert(t('error'), msg || t('saved_location_save_failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (loc: SavedLocationRecord) => {
    Alert.alert(t('delete_saved_location'), t('delete_saved_location_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete_saved_location'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSavedLocation(loc.id);
            await refresh();
          } catch (e: any) {
            Alert.alert(t('error'), e?.response?.data?.message ?? t('saved_location_save_failed'));
          }
        },
      },
    ]);
  };

  const handleModalClose = () => {
    setView('list');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleModalClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader
          title={view === 'form' ? t(editingId != null ? 'edit_saved_location' : 'add_saved_location') : t('saved_locations')}
          onClose={() => (view === 'form' ? setView('list') : handleModalClose())}
          actionLabel={view === 'list' ? t('add_saved_location') : (saving ? t('saved') : t('save_location_btn'))}
          onAction={view === 'list' ? openAddForm : handleSave}
          actionDisabled={view === 'form' && saving}
        />

        {view === 'list' ? (
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {loading ? (
              <AppLoader size={28} />
            ) : locations.length === 0 ? (
              <Text style={[styles.cardSub, { textAlign: 'center', marginTop: Spacing.xl }]}>
                {t('no_saved_locations_yet')}
              </Text>
            ) : (
              locations.map((loc) => {
                const Icon = iconForLabel(loc.label);
                return (
                  <View key={loc.id} style={styles.cardRow}>
                    <View style={styles.cardIconBox}>
                      <Icon size={18} color={c.ink} />
                    </View>
                    <View style={styles.cardLabel}>
                      <Text style={styles.cardName}>{loc.name}</Text>
                      {!!loc.address && <Text style={styles.cardSub} numberOfLines={1}>{loc.address}</Text>}
                    </View>
                    {loc.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>{t('default_label')}</Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => openEditForm(loc)} activeOpacity={0.75} style={{ padding: Spacing.xs }}>
                      <Pencil size={16} color={c.inkSoft} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(loc)} activeOpacity={0.75} style={{ padding: Spacing.xs }}>
                      <Trash2 size={16} color={c.badge} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('location_name_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder={t('location_name_placeholder')}
                  placeholderTextColor={c.silver}
                />
              </View>

              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.inputLabel}>{t('location_label_field')}</Text>
                <View style={styles.issueRow}>
                  {(['home', 'work', 'other'] as const).map((key) => {
                    const active = formLabel === key;
                    const labelKey = key === 'home' ? 'label_home' : key === 'work' ? 'label_work' : 'label_other';
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.issueChip, active ? styles.issueChipActive : styles.issueChipInactive]}
                        onPress={() => { Haptics.selectionAsync(); setFormLabel(key); }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.issueChipText, { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>
                          {t(labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.inputLabel}>{t('location_address_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={addressQuery}
                  onChangeText={handleAddressQueryChange}
                  placeholder={t('location_address_placeholder')}
                  placeholderTextColor={c.silver}
                />
                {addressSuggestions.length > 0 && (
                  <View style={{ borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
                    {addressSuggestions.map((s) => (
                      <TouchableOpacity
                        key={s.placeId}
                        style={{ padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.white }}
                        onPress={() => handlePickAddress(s)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: Typography.weight.medium, color: c.ink }}>{s.mainText}</Text>
                        {!!s.secondaryText && (
                          <Text style={{ fontSize: 11.5, color: c.inkSoft }} numberOfLines={1}>{s.secondaryText}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                activeOpacity={0.9}
                disabled={saving}
              >
                {saving ? <AppLoader size={24} /> : <Text style={styles.primaryBtnText}>{t('save_location_btn')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
