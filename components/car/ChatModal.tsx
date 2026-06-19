import { useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    const msg = text.trim();
    setText('');
    await sendMessage(msg);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const bgColor = c.isDark ? '#0f0f1e' : '#f4f4f8';
  const headerBg = c.isDark ? '#1a1a2e' : '#ffffff';
  const inputBg = c.isDark ? '#1a1a2e' : '#ffffff';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bgColor }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { backgroundColor: headerBg, paddingTop: Platform.OS === 'web' ? 20 : insets.top + 4 }]}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.backBtn}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color={c.ink} />
          </TouchableOpacity>
          <View style={styles.headerMeta}>
            <View style={[styles.driverAvatar, { backgroundColor: c.ink }]}>
              <Text style={[styles.driverAvatarText, { color: c.isDark ? c.background : c.white }]}>
                {driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View>
              <Text style={[styles.headerName, { color: c.ink }]}>{driverName}</Text>
              <Text style={[styles.headerSub, { color: c.accentMint }]}>● Online</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={42} color={c.silver} />
            <Text style={[styles.emptyText, { color: c.inkSoft }]}>
              {t('no_messages_yet') ?? 'No messages yet.\nSay hello to your driver!'}
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
                    ? { backgroundColor: c.isDark ? '#1e1e32' : '#ffffff', borderBottomLeftRadius: 4 }
                    : { backgroundColor: c.ink, borderBottomRightRadius: 4 },
                ]}>
                  <Text style={[styles.bubbleText, { color: item.isDriver ? c.ink : (c.isDark ? c.background : c.white) }]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.bubbleTime, { color: item.isDriver ? c.inkSoft : 'rgba(255,255,255,0.55)' }]}>
                    {item.time}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        <View style={[
          styles.inputBar,
          {
            backgroundColor: inputBg,
            paddingBottom: Platform.OS === 'web' ? 16 : insets.bottom + 8,
            borderTopColor: c.border,
          },
        ]}>
          <TextInput
            style={[styles.input, { color: c.ink, backgroundColor: c.isDark ? '#252540' : '#f2f2f5' }]}
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
            style={[styles.sendBtn, { backgroundColor: text.trim() && !sending ? c.ink : c.mist }]}
            onPress={handleSend}
            disabled={sending || !text.trim()}
            activeOpacity={0.85}
          >
            {sending
              ? <Ionicons name="hourglass-outline" size={16} color={c.silver} />
              : <Ionicons name="send" size={16} color={text.trim() ? (c.isDark ? c.background : c.white) : c.silver} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { fontSize: 14, fontWeight: '700' },
  headerName: { fontSize: 15, fontWeight: '600' },
  headerSub: { fontSize: 11, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  messageList: { padding: 16, gap: 8 },
  bubble: { width: '100%' },
  driverBubble: { alignItems: 'flex-start' },
  userBubble: { alignItems: 'flex-end' },
  bubbleInner: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
