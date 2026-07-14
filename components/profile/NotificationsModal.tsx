import { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, Modal, Switch } from 'react-native';
import { Megaphone, Bus, Tag, Lightbulb } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { makeStyles, ModalHeader } from './shared';

const NOTIF_KEY = '@veego_notif_v1';

export function NotificationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [trips, setTrips] = useState(true);
  const [promos, setPromos] = useState(false);
  const [system, setSystem] = useState(true);
  const [driver, setDriver] = useState(true);

  useEffect(() => {
    if (!visible) return;
    api.get('/users/me/notifications').then(({ data }) => {
      if (typeof data.notifTrips === 'boolean') setTrips(data.notifTrips);
      if (typeof data.notifPromos === 'boolean') setPromos(data.notifPromos);
      if (typeof data.notifSystem === 'boolean') setSystem(data.notifSystem);
      if (typeof data.notifDriverUpdates === 'boolean') setDriver(data.notifDriverUpdates);
    }).catch(() => {
      AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (typeof d.trips === 'boolean') setTrips(d.trips);
          if (typeof d.promos === 'boolean') setPromos(d.promos);
          if (typeof d.system === 'boolean') setSystem(d.system);
          if (typeof d.driver === 'boolean') setDriver(d.driver);
        } catch {}
      });
    });
  }, [visible]);

  const syncNotif = (apiField: string, localKey: string, value: boolean) => {
    api.patch('/users/me/notifications', { [apiField]: value }).catch(() => {});
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      const current = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify({ ...current, [localKey]: value }));
    });
  };

  const ITEMS = [
    { icon: Bus, label: t('notif_trips_label'), sub: t('notif_trips_sub'), value: trips, set: (v: boolean) => { setTrips(v); syncNotif('notifTrips', 'trips', v); } },
    { icon: Tag, label: t('notif_promos_label'), sub: t('notif_promos_sub'), value: promos, set: (v: boolean) => { setPromos(v); syncNotif('notifPromos', 'promos', v); } },
    { icon: Megaphone, label: t('notif_system_label'), sub: t('notif_system_sub'), value: system, set: (v: boolean) => { setSystem(v); syncNotif('notifSystem', 'system', v); } },
    { icon: Lightbulb, label: t('notif_driver_label'), sub: t('notif_driver_sub'), value: driver, set: (v: boolean) => { setDriver(v); syncNotif('notifDriverUpdates', 'driver', v); } },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('notif_settings_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {ITEMS.map((item, i) => (
            <View key={i} style={styles.toggleRow}>
              <View style={styles.toggleIcon}>
                <item.icon size={20} color={c.ink} />
              </View>
              <View style={styles.toggleMeta}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Text style={styles.toggleSub}>{item.sub}</Text>
              </View>
              <Switch value={item.value} onValueChange={(v) => { Haptics.selectionAsync(); item.set(v); }} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
