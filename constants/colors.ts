export type ThemeColors = {
  ink: string;
  inkSoft: string;
  silver: string;
  mist: string;
  snow: string;
  background: string;
  white: string;
  border: string;
  accentMint: string;
  badge: string;
  luxeGrad: readonly [string, string];
  luxeSoftGrad: readonly [string, string];
  gradientPrimary: readonly [string, string];
  isDark: boolean;
  // Canonical design-token aliases (source of truth for future UI work).
  // These mirror the legacy fields above so existing call sites keep working.
  primary: string;
  accent: string;
  surface: string;
  text: string;
  mutedText: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  // Ride-cycle sheet tokens (Lovable) — single source for the card/surface/
  // gold values that used to be re-declared as local hex literals in every
  // ride-cycle sheet (RideOptionsSheet, DriverSearching, DriverAssignedCard,
  // RatingSheet, ChatModal, CancelReasonSheet). `white` and `border` already
  // matched those literals exactly, so only the muted-surface and gold tones
  // needed a new home.
  surfaceMuted: string;
  gold: string;
  // Single source for the two-stop gradient used behind Shuttle/trip "info"
  // cards (RouteCard, TripSheetSections stat cards, trip-detail card) — was
  // re-declared as a local ['#1e1e3a','#16162e'] / ['#ffffff','#f7f7fc']
  // literal at every call site. Dark mode is flat and matches `surface`/
  // `white` exactly so these cards read identically to GlassView-based cards
  // (HistoryTripCard, UpcomingTripCard) instead of drifting to their own shade.
  cardGrad: readonly [string, string];
};

export const LIGHT: ThemeColors = {
  ink: '#1e1e28',
  // Aligned to Driver's mutedForeground (#6B7280) — see palette audit.
  inkSoft: '#6B7280',
  silver: '#c3c3cc',
  // Aligned to Driver's secondary/muted (#EAEDF2).
  mist: '#EAEDF2',
  snow: '#f8f8fb',
  background: '#fafafd',
  white: '#ffffff',
  // Aligned to Driver's border (rgba(0,0,0,0.08)).
  border: 'rgba(0,0,0,0.08)',
  accentMint: '#55c49a',
  // Aligned to Driver's destructive/error (#E85454) — was a second, unrelated red.
  badge: '#E85454',
  // Flattened to Driver's solid light background (#FAFAFD) — both stops equal
  // so the page reads as one flat color instead of a purple-grey gradient,
  // matching the Driver app. Kept as two-stop tuples so all LinearGradient
  // call sites stay unchanged. Dark mode keeps its gradient below.
  luxeGrad: ['#fafafd', '#fafafd'],
  luxeSoftGrad: ['#fafafd', '#fafafd'],
  // Shared VeeGo ink gradient — same identity used for the ride-journey CTA
  // gradients on the Driver app (mirrors that app's `gradientPrimary`).
  gradientPrimary: ['#2d2d42', '#1e1e28'],
  isDark: false,
  primary: '#1e1e28',
  accent: '#55c49a',
  surface: '#ffffff',
  text: '#1e1e28',
  // Aligned to Driver's mutedForeground (#6B7280).
  mutedText: '#6B7280',
  success: '#3CC97A',
  warning: '#D5A623',
  // Aligned to Driver's destructive/error (#E85454) — was #D6432D.
  error: '#E85454',
  info: '#3D52D5',
  surfaceMuted: '#f7f8fc',
  gold: '#C8A535',
  cardGrad: ['#ffffff', '#f7f7fc'],
};

export const DARK: ThemeColors = {
  ink: '#e8e8f2',
  // Aligned to Driver's mutedForeground (#B0B0B0) — see palette audit.
  inkSoft: '#B0B0B0',
  silver: '#3a3a58',
  // Aligned to Driver's secondary/muted (#16161A).
  mist: '#16161A',
  snow: '#16162a',
  background: '#0f0f1e',
  // Aligned to Driver's card/surface (#16162A) — was #1a1a2e, so dark-mode
  // cards built on `white` now match `surface` (and Driver) exactly.
  white: '#16162a',
  // Aligned to Driver's border (#2A2A2A) — was navy-tinted #2c2c46.
  border: '#2A2A2A',
  accentMint: '#55c49a',
  // Aligned to Driver's destructive/error (#E85454) — was a second, unrelated red.
  badge: '#E85454',
  luxeGrad: ['#1e1e32', '#0f0f1e'],
  luxeSoftGrad: ['#181828', '#0f0f1e'],
  gradientPrimary: ['#2d2d42', '#1e1e28'],
  isDark: true,
  // Aligned to Driver's dark tint/primary (#2d2d42) — was #1e1e28, which sat
  // almost on top of the dark background (#0f0f1e) with too little contrast.
  primary: '#2d2d42',
  accent: '#55c49a',
  surface: '#16162a',
  text: '#e8e8f2',
  // Aligned to Driver's mutedForeground (#B0B0B0).
  mutedText: '#B0B0B0',
  success: '#3CC97A',
  warning: '#D5A623',
  // Aligned to Driver's destructive/error (#E85454) — was #D6432D.
  error: '#E85454',
  info: '#3D52D5',
  surfaceMuted: '#16162a',
  gold: '#C8A535',
  // Flat, not a real gradient — same '#16162a' as `surface`/`white` so every
  // dark-mode card (GlassView or LinearGradient-based) renders the identical shade.
  cardGrad: ['#16162a', '#16162a'],
};

export function makeGlassStyle(c: ThemeColors) {
  return {
    backgroundColor: c.isDark ? 'rgba(28,30,54,0.94)' : 'rgba(255,255,255,0.78)',

    // Matches GlassView's own border treatment (components/ui/GlassView.tsx) —
    // a defined edge is what gives glass surfaces depth/structure instead of
    // reading as a flat, washed-out panel.
    borderWidth: 1,
    borderColor: c.border,

    shadowColor: c.isDark ? '#000' : '#1e1e28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: c.isDark ? 0.5 : 0.08,
    shadowRadius: 18,
    elevation: 4,
  };
}

export const S = {
  luxe: {
    shadowColor: '#1e1e28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  float: {
    shadowColor: '#1e1e28',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.13,
    shadowRadius: 30,
    elevation: 10,
  },
};

export const C = LIGHT;
export const glassStyle = makeGlassStyle(LIGHT);