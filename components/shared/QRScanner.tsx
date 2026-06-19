import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, QrCode, Check, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

export interface QRScanResult {
  data: string;
  type: string;
}

interface QRScannerProps {
  onScanned: (result: QRScanResult) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export function QRScanner({ onScanned, onClose, title, subtitle }: QRScannerProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const cornerAnim = useRef(new Animated.Value(0)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Animate corner brackets + scan line
  useEffect(() => {
    Animated.timing(cornerAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    scanLoop.start();
    return () => scanLoop.stop();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned || !mountedRef.current) return;
    setScanned(true);

    // Validate QR format — expect a VeeGo booking ID or JSON
    let parsedData = data;
    let isValid = false;

    try {
      const parsed = JSON.parse(data);
      if (parsed.bookingId || parsed.id) {
        isValid = true;
        parsedData = parsed.bookingId ?? parsed.id;
      }
    } catch {
      // Plain string — check if it looks like a booking ID (e.g. VG-XXXXX)
      if (/^(VG-|#VG-|VEEGO-)/i.test(data) || /^[a-f0-9]{8,}$/i.test(data)) {
        isValid = true;
        parsedData = data.replace(/^#/, '');
      }
    }

    if (!isValid) {
      Alert.alert(
        t('qr_invalid_title'),
        t('qr_invalid_msg'),
        [{ text: t('qr_scan_again'), onPress: () => { if (mountedRef.current) setScanned(false); } }]
      );
      return;
    }

    onScanned({ data: parsedData, type });
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: '#0d0e22' }]}>
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 60 : insets.top) + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={styles.unsupportedWrap}>
          <QrCode size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.unsupportedTitle}>{t('qr_camera_web')}</Text>
          <Text style={styles.unsupportedSub}>{t('qr_camera_web_sub')}</Text>
          <TouchableOpacity style={styles.closeFullBtn} onPress={onClose}>
            <Text style={styles.closeFullBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: '#0d0e22', alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#55c49a" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: '#0d0e22' }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={styles.permissionWrap}>
          <View style={styles.permissionIcon}>
            <Camera size={40} color="#55c49a" />
          </View>
          <Text style={styles.permissionTitle}>{t('qr_camera_permission_title')}</Text>
          <Text style={styles.permissionSub}>{t('qr_camera_permission_msg')}</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permissionBtnText}>{t('qr_allow_camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelPermBtn} onPress={onClose}>
            <Text style={styles.cancelPermBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const scanLineY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlay with cutout */}
      <View style={styles.overlay}>
        <View style={[styles.overlayRow, { height: (styles.container as any).flex ? 100 : 120 }]} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          {/* Scan frame */}
          <Animated.View style={[styles.scanFrame, { opacity: cornerAnim }]}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Animated scan line */}
            {!scanned && (
              <Animated.View style={[styles.scanLineBar, { transform: [{ translateY: scanLineY }] }]} />
            )}

            {scanned && (
              <View style={styles.scannedOverlay}>
                <View style={styles.scannedCheck}>
                  <Check size={32} color="#ffffff" />
                </View>
              </View>
            )}
          </Animated.View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <X size={20} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{title ?? t('qr_scan_boarding')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Bottom hint */}
      <View style={[styles.bottomHint, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.hintText}>
          {subtitle ?? t('qr_align_hint')}
        </Text>
        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={styles.rescanBtnText}>{t('qr_tap_scan_again')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const FRAME_SIZE = 240;
const CORNER_SIZE = 28;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  overlayRow: { backgroundColor: 'rgba(0,0,0,0.6)', width: '100%' },
  overlayMiddle: { flexDirection: 'row', flex: 1 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },

  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#55c49a',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: 6 },

  scanLineBar: {
    position: 'absolute', left: 8, right: 8, height: 2,
    backgroundColor: '#55c49a',
    shadowColor: '#55c49a', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6,
    elevation: 4,
  },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(85,196,154,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  scannedCheck: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#55c49a',
    alignItems: 'center', justifyContent: 'center',
  },

  bottomHint: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    alignItems: 'center', gap: 12, paddingHorizontal: 24,
  },
  hintText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  rescanBtn: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#55c49a',
  },
  rescanBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  unsupportedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  unsupportedTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  unsupportedSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 },
  closeFullBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 16, backgroundColor: '#55c49a' },
  closeFullBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  permissionIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(85,196,154,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  permissionSub: { fontSize: 13.5, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 21 },
  permissionBtn: { marginTop: 8, width: '100%', height: 52, borderRadius: 18, backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center' },
  permissionBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  cancelPermBtn: { paddingVertical: 8 },
  cancelPermBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
});
