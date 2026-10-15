/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Official Zeitnah User Panel Color System
 */
export const ZeitnahColors = {
  background: '#070B14',
  brandNavy: '#12314C',
  brandMint: '#9FD5B2',
  brandYellow: '#F6ED4A',
  cardSurface: '#0B111E',
  secondarySurface: '#0F1728',
  elevatedSurface: '#152033',
  primaryText: '#FFFFFF',
  secondaryText: '#94A3B8',
  mutedText: '#64748B',
  border: '#1E293B',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#38BDF8',
} as const;

export type ZeitnahThemeColors = typeof ZeitnahColors;
export type ZeitnahColorKey = keyof ZeitnahThemeColors;

export const Colors = {
  light: {
    text: ZeitnahColors.primaryText,
    background: ZeitnahColors.background,
    backgroundElement: ZeitnahColors.cardSurface,
    backgroundSelected: ZeitnahColors.secondarySurface,
    textSecondary: ZeitnahColors.secondaryText,
  },
  dark: {
    text: ZeitnahColors.primaryText,
    background: ZeitnahColors.background,
    backgroundElement: ZeitnahColors.cardSurface,
    backgroundSelected: ZeitnahColors.secondarySurface,
    textSecondary: ZeitnahColors.secondaryText,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const ZeitnahTheme = {
  colors: ZeitnahColors,
  fonts: Fonts,
  spacing: Spacing,
  bottomTabInset: BottomTabInset,
  maxContentWidth: MaxContentWidth,
} as const;

export default ZeitnahTheme;
