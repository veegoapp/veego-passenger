import { useRef, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { ArrowLeft, ArrowRight, Phone, MoreVertical, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useRideChat } from '@/src/hooks/car/useRideChat';

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  driverName: string;
  tripId: string | null;
}

export function ChatModal({ visible, onClose, driverName, tripId }: ChatModalProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const { messages, sending, sendMessage } = useRideChat(visible ? tripId : null);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    Haptics.selectionAsync();
    const msg = text.trim();
    setText('');
    await sendMessage(msg);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const cardBg    = c.white;
  const surfaceBg = c.surfaceMuted;
  const borderCol = c.border;
  const screenBg  = c.isDark ? c.background : c.surfaceMuted;

  const initials = driverName
    ? driverName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: screenBg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={[
          styles.header,
          {
            backgroundColor: cardBg,
            borderBottomColor: borderCol,
            paddingTop: insets.top + 4,
          },
        ]}>
          {/* Back button */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            style={[styles.iconBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
            aria-label="Back to ride"
          >
            {isRTL
              ? <ArrowRight size={18} color={c.ink} strokeWidth={2.2} />
              : <ArrowLeft  size={18} color={c.ink} strokeWidth={2.2} />
            }
          </TouchableOpacity>

          {/* Driver identity */}
          <View style={styles.headerMeta}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <Text style={[styles.avatarText, { color: c.ink }]}>{initials}</Text>
              </View>
              {/* Online dot */}
              <View style={[styles.onlineDot, { borderColor: cardBg, backgroundColor: c.success }]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.headerName, { color: c.ink }]} numberOfLines={1}>{driverName || '—'}</Text>
              <Text style={[styles.headerOnline, { color: c.inkSoft }]}>{'Online'}</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
              activeOpacity={0.8}
              aria-label="Call driver"
            >
              <Phone size={18} color={c.ink} strokeWidth={1.9} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
              activeOpacity={0.8}
              aria-label="More options"
            >
              <MoreVertical size={18} color={c.ink} strokeWidth={1.9} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Messages ── */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: c.ink }]}>{t('no_messages_yet') ?? 'No messages yet'}</Text>
            <Text style={[styles.emptySubtitle, { color: c.inkSoft }]}>Say hello to your driver!</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={{ width: '100%', alignItems: item.isDriver ? 'flex-start' : 'flex-end' }}>
                <View style={[
                  styles.bubble,
                  item.isDriver
                    ? { backgroundColor: surfaceBg, borderWidth: 1, borderColor: borderCol, borderBottomLeftRadius: 4 }
                    : { backgroundColor: c.primary, borderBottomRightRadius: 4 },
                ]}>
                  <Text style={[styles.bubbleText, { color: item.isDriver ? c.ink : '#ffffff' }]}>
                    {item.text}
                  </Text>
                  <Text style={[
                    styles.bubbleTime,
                    { color: item.isDriver ? c.inkSoft : 'rgba(255,255,255,0.65)' },
                  ]}>
                    {item.time}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        {/* ── Input bar ── */}
        <View style={[
          styles.inputBar,
          {
            backgroundColor: cardBg,
            borderTopColor: borderCol,
            paddingBottom: insets.bottom + 8,
          },
        ]}>
          <View style={[styles.inputWrap, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <TextInput
              style={[styles.input, { color: c.ink }]}
              placeholder={t('type_message')}
              placeholderTextColor={c.inkSoft}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={300}
              textAlign={isRTL ? 'right' : 'left'}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: text.trim() && !sending ? c.primary : c.border },
              ]}
              onPress={handleSend}
              disabled={sending || !text.trim()}
              activeOpacity={0.85}
            >
              <Send size={16} color={text.trim() ? '#ffffff' : c.inkSoft} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerMeta: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  headerName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  headerOnline: { fontSize: 13, marginTop: 1 },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  emptySubtitle: { fontSize: 13 },

  bubble: {
    maxWidth: '82%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 11, fontWeight: '500', textAlign: 'right' },

  inputBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  input: {
    flex: 1, fontSize: 15, maxHeight: 112, minHeight: 44,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
});
