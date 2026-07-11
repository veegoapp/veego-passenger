import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';
import { useTheme } from '@/context/ThemeContext';

// react-native-webview's public entry point only re-exports a few event
// types (not WebViewErrorEvent/WebViewHttpErrorEvent), so these are derived
// from the WebView component's own public prop types instead of reaching
// into the package's internal lib/ path.
type WebViewErrorEvent = Parameters<NonNullable<WebViewProps['onError']>>[0];
type WebViewHttpErrorEvent = Parameters<NonNullable<WebViewProps['onHttpError']>>[0];

export type PaymobCheckoutOutcome = 'success' | 'pending' | 'failed' | 'cancelled' | 'error';

interface PaymobCheckoutModalProps {
  visible: boolean;
  iframeUrl: string | null;
  merchantOrderId: string | null;
  /** Fires exactly once per checkout session, whatever the outcome. */
  onClose: (outcome: PaymobCheckoutOutcome) => void;
}

/**
 * Paymob's hosted payment page appends the same result fields used in its
 * server-to-server webhook (success / pending / error_occured /
 * merchant_order_id) to the page URL once a card attempt has been
 * processed. We use that only to decide when to stop showing the checkout
 * page and what to tell the caller — never as proof the wallet was
 * credited. The actual credit is confirmed separately by polling the
 * balance, since crediting happens asynchronously via the HMAC-verified
 * webhook and may lag behind this redirect.
 */
function parseOutcomeFromUrl(url: string, merchantOrderId: string | null): PaymobCheckoutOutcome | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const params = parsed.searchParams;
  if (!params.has('success')) return null;

  const urlOrderId = params.get('merchant_order_id');
  if (merchantOrderId && urlOrderId && urlOrderId !== merchantOrderId) {
    // Redirect belongs to a different order — ignore it.
    return null;
  }

  const success = params.get('success') === 'true';
  const pending = params.get('pending') === 'true';
  const errorOccured = params.get('error_occured') === 'true';

  if (pending) return 'pending';
  if (success && !errorOccured) return 'success';
  return 'failed';
}

export function PaymobCheckoutModal({ visible, iframeUrl, merchantOrderId, onClose }: PaymobCheckoutModalProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      resolvedRef.current = false;
      setLoading(true);
    }
  }, [visible, iframeUrl]);

  const resolveOnce = useCallback((outcome: PaymobCheckoutOutcome) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onClose(outcome);
  }, [onClose]);

  const handleNavChange = useCallback((navState: WebViewNavigation) => {
    const outcome = parseOutcomeFromUrl(navState.url, merchantOrderId);
    if (outcome) resolveOnce(outcome);
  }, [merchantOrderId, resolveOnce]);

  // The header back/close button is the only way to report a user-initiated
  // cancellation — closing this modal is never treated as a successful payment.
  const handleManualClose = useCallback(() => {
    resolveOnce('cancelled');
  }, [resolveOnce]);

  const handleLoadError = useCallback((_e: WebViewErrorEvent) => {
    resolveOnce('error');
  }, [resolveOnce]);

  const handleHttpError = useCallback((e: WebViewHttpErrorEvent) => {
    if (e.nativeEvent.statusCode >= 400) resolveOnce('error');
  }, [resolveOnce]);

  const bgColor = c.isDark ? '#0f0f1e' : '#f4f4f8';
  const headerBg = c.isDark ? '#1a1a2e' : '#ffffff';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleManualClose}
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
    >
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 4, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleManualClose} activeOpacity={0.8} style={styles.closeBtn}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color={c.ink} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.ink }]} numberOfLines={1}>
            {t('paymob_checkout_title')}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {iframeUrl ? (
          <WebView
            source={{ uri: iframeUrl }}
            onNavigationStateChange={handleNavChange}
            onLoadEnd={() => setLoading(false)}
            onError={handleLoadError}
            onHttpError={handleHttpError}
            startInLoadingState={false}
            style={{ flex: 1, backgroundColor: bgColor }}
          />
        ) : null}

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={c.ink} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
