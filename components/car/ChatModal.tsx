import { useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { ArrowLeft, ArrowRight, MessageCircle, Hourglass, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { GlassView } from '@/components/ui/GlassView';
import { useRideChat } from '@/src/hooks/car/useRideChat';
import { useState } from 'react';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Shadows } from '@/constants/shadows';

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <GlassView strong borderRadius={0} style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            style={[styles.backBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: c.border }]}
          >
            {isRTL ? <ArrowRight size={20} color={c.ink} /> : <ArrowLeft size={20} color={c.ink} />}
          </TouchableOpacity>
          <View style={styles.headerMeta}>
            <View style={[styles.driverAvatar, { backgroundColor: c.ink }]}>
              <Text style={[styles.driverAvatarText, { color: c.isDark ? c.background : c.white }]}>
                {driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View>
              <Text style={[styles.headerName, { color: c.ink }]}>{driverName}</Text>
              <Text style={[styles.headerSub, { color: c.accent }]}>● Online</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </GlassView>

        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <MessageCircle size={42} color={c.silver} />
            <Text style={[styles.emptyText, { color: c.inkSoft }]}>
              {t('no_messages_yet') ?? 'No messages yet.\nSay hello to your driver!'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.messageList, { paddingBottom: Spacing.lg }]}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.isDriver ? styles.driverBubble : styles.userBubble]}>
                <View style={[
                  styles.bubbleInner,
                  item.isDriver
                    ? { backgroundColor: c.mist, borderBottomLeftRadius: 4 }
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
            backgroundColor: c.surface,
            paddingBottom: insets.bottom + 8,
            borderTopColor: c.border,
          },
        ]}>
          <TextInput
            style={[styles.input, { color: c.ink, backgroundColor: c.mist }]}
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
              ? <Hourglass size={16} color={c.silver} />
              : <Send size={16} color={text.trim() ? (c.isDark ? c.background : c.white) : c.silver} />
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
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: Shadows.small.elevation,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold },
  headerName: { fontSize: 15, fontWeight: Typography.weight.semibold },
  headerSub: { fontSize: 11, fontWeight: Typography.weight.medium },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: 40 },
  emptyText: { fontSize: Typography.size.sm, textAlign: 'center', lineHeight: 20 },
  messageList: { padding: Spacing.lg, gap: Spacing.sm },
  bubble: { width: '100%' },
  driverBubble: { alignItems: 'flex-start' },
  userBubble: { alignItems: 'flex-end' },
  bubbleInner: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: Spacing.xs },
  bubbleText: { fontSize: Typography.size.sm, lineHeight: 20 },
  bubbleTime: { fontSize: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: Spacing.lg, paddingVertical: 10, fontSize: Typography.size.sm, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
