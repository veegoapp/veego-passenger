import { useTheme } from '@/context/ThemeContext';

// ── "C · Split Panel" design tokens ─────────────────────────────────────────
// The Split-Panel redesign (DriverAssignedCard, RideOptionsSheet,
// TripCompletedSheet, RatingSheet, HistoryTripCard, wallet/profile/trip-detail,
// and others) shipped with a single fixed hex palette, independent of the
// app's light/dark theme — every dark-mode toggle left these screens looking
// identical to light mode. This is the shared, theme-aware replacement:
// same shape (same field names every file already used as C_BG/C_INK/etc,
// just sourced from here instead of a local hex literal), computed against
// the app's existing LIGHT/DARK tokens (constants/colors.ts) so it matches
// the rest of the app's dark mode instead of inventing a new one.
//
// The always-dark "panel" side of the split-card design (left rail /
// dark header) stays a fixed near-black in both modes — it's a deliberate
// dark accent surface by design, not something that should go "more dark"
// or invert. Only the light "card" side, ink/caption text, hairlines, and
// backgrounds actually change between light and dark mode. Status/accent
// hues (teal, mint, gold star, red, green) are unchanged — they're already
// legible on both a white and a dark surface.
export type SplitColors = {
  isDark: boolean;
  /** Page background behind the split card. */
  bg: string;
  /** Always-dark panel/rail side of the split card — fixed in both modes. */
  panel: string;
  /** Light "card" side of the split card — flips dark-mode surface. */
  card: string;
  /** Muted secondary surface (chips, list rows) inside a card. */
  surfaceMuted: string;
  /** Primary text on a card surface. */
  ink: string;
  /** Secondary/muted text on a card surface. */
  inkSoft: string;
  /** Caption/label text on a card surface (dimmer than inkSoft). */
  cap: string;
  /** Caption text meant for use directly on the dark panel (both modes). */
  capOnDark: string;
  /** Hairline border/divider on a card surface. */
  hair: string;
  teal: string;
};

export function makeSplitColors(isDark: boolean): SplitColors {
  return {
    isDark,
    bg: isDark ? '#0f0f1e' : '#EEF0F2',
    panel: '#14151A',
    card: isDark ? '#16162a' : '#FFFFFF',
    surfaceMuted: isDark ? '#1c1d2e' : '#F0F2F3',
    ink: isDark ? '#e8e8f2' : '#14151A',
    inkSoft: isDark ? '#B0B0B0' : '#6B7178',
    cap: isDark ? '#8A9096' : '#9AA0A6',
    capOnDark: '#8A9096',
    hair: isDark ? '#2A2A2A' : '#EEF0F1',
    teal: '#0E9F8E',
  };
}

export function useSplitColors(): SplitColors {
  const { darkMode } = useTheme();
  return makeSplitColors(darkMode);
}
