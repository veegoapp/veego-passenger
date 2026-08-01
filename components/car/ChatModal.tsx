import { useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { ArrowLeft, ArrowRight, Send, Hourglass } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useRideChat } from '@/src/hooks/car/useRideChat';
import { useState } from 'react';

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

  const isDark = c.isDark;
  const headerBg = isDark ? '#16162a' : '#ffffff';
  const borderColor = isDark ? '#2c2c46' : '#e5e5ea';
  const surfaceBg = isDark ? '#1e1e32' : '#f8f8fb';
  const mutedText = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.4)';

  const initials = driverName
    ? driverName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: isDark ? '#0f0f1e' : '#f8f8fb' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={[styles.header, {
          backgroundColor: headerBg,
          borderBottomColor: borderColor,
          paddingTop: insets.top + 4,
        }]}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            style={[styles.backBtn, { backgroundColor: surfaceBg, borderColor }]}
          >
            {isRTL
              ? <ArrowRight size={18} color={c.ink} strokeWidth={2} />
              : <ArrowLeft size={18} color={c.ink} strokeWidth={2} />
            }
          </TouchableOpacity>

          <View style={styles.headerMeta}>
            <View style={[styles.driverAvatar, { backgroundColor: c.primary }]}>
              <Text style={styles.driverAvatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={[styles.headerName, { color: c.ink }]}>{driverName}</Text>
              <Text style={[styles.headerSub, { color: c.accent }]}>● Online</Text>
            </View>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {/* ── Messages ── */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: surfaceBg, borderColor }]}>
              <Send size={22} color={mutedText} strokeWidth={1.8} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.ink }]}>
              {t('no_messages_yet') ?? 'No messages yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: mutedText }]}>
              Say hello to your driver!
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.isDriver ? styles.driverBubble : styles.userBubble]}>
                <View style={[
                  styles.bubbleInner,
                  item.isDriver
                    ? { backgroundColor: isDark ? '#1e1e32' : '#ffffff', borderColor, borderWidth: 1, borderBottomLeftRadius: 4 }
                    : { backgroundColor: c.primary, borderBottomRightRadius: 4 },
                ]}>
                  <Text style={[
                    styles.bubbleText,
                    { color: item.isDriver ? c.ink : '#ffffff' },
                  ]}>
                    {item.text}
                  </Text>
                  <Text style={[
                    styles.bubbleTime,
                    { color: item.isDriver ? mutedText : 'rgba(255,255,255,0.55)' },
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
            backgroundColor: headerBg,
            borderTopColor: borderColor,
            paddingBottom: insets.bottom + 8,
          },
        ]}>
          <View style={[styles.inputWrap, { backgroundColor: surfaceBg, borderColor }]}>
            <TextInput
              style={[styles.input, { color: c.ink }]}
              placeholder={t('type_message')}
              placeholderTextColor={mutedText}
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
                { backgroundColor: text.trim() && !sending ? c.primary : (isDark ? '#2c2c46' : '#e5e5ea') },
              ]}
              onPress={handleSend}
              disabled={sending || !text.trim()}
              activeOpacity={0.85}
            >
              {sending
                ? <Hourglass size={15} color={mutedText} />
                : <Send size={15} color={text.trim() ? '#ffffff' : mutedText} strokeWidth={2} />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 14, fontWeight: '700' as any, color: '#ffffff' },
  headerName: { fontSize: 15, fontWeight: '700' as any, letterSpacing: -0.2 },
  headerSub: { fontSize: 11, fontWeight: '600' as any, marginTop: 1 },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' as any, letterSpacing: -0.2 },
  emptySubtitle: { fontSize: 13, fontWeight: '500' as any },

  messageList: { padding: 16, gap: 10 },
  bubble: { width: '100%', marginBottom: 4 },
  driverBubble: { alignItems: 'flex-start' },
  userBubble: { alignItems: 'flex-end' },
  bubbleInner: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontWeight: '500' as any },

  inputBar: {
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  input: {
    flex: 1, fontSize: 14.5, maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
});
