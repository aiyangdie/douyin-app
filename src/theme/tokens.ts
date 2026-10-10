/**
 * Design tokens for the app.
 *
 * Douyin's dark theme is essentially pure black chrome around full-bleed
 * video, with two brand accents (red + cyan) used sparingly.
 */

export const colors = {
  /** Page background behind the video feed. */
  background: '#000000',
  /** Raised surfaces: sheets, cards, tab bar. */
  surface: '#161823',
  /** Slightly lighter surface for pressed states / inputs. */
  surfaceMuted: '#22242F',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.78)',
  textTertiary: 'rgba(255, 255, 255, 0.48)',

  /** Douyin's signature rose red — likes, active tabs, badges. */
  brand: '#FE2C55',
  /** The cyan half of the logo; used for the music disc and highlights. */
  brandCyan: '#25F4EE',

  divider: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  scrim: 'rgba(0, 0, 0, 0.65)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 14,
  body: 15,
  title: 17,
  heading: 20,
} as const;

/** Standard gutter for screen content, matching the feed's left rail. */
export const SCREEN_PADDING = 16;

/** Height of the custom tab bar, excluding the safe-area inset. */
export const TAB_BAR_HEIGHT = 52;
