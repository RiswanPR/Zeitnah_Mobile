import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ZeitnahColors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// Ensure the root native window background matches the dark brand palette
SystemUI.setBackgroundColorAsync(ZeitnahColors.background).catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: ZeitnahColors.background,
    card: ZeitnahColors.cardSurface,
    text: ZeitnahColors.primaryText,
    border: ZeitnahColors.border,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(ZeitnahColors.background).catch(() => {});
  }, []);

  return (
    <ThemeProvider value={navigationTheme}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ZeitnahColors.background },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
