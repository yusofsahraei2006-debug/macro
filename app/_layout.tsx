import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { DiaryProvider } from '@/hooks/useDiary';
import { HealthProvider } from '@/hooks/useHealth';

function Shell() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="search" />
        <Stack.Screen name="log" />
        <Stack.Screen name="custom-food" />
        <Stack.Screen name="meals" />
        <Stack.Screen name="meal-edit" />
        <Stack.Screen name="quick-add" />
        <Stack.Screen name="weight" />
        <Stack.Screen name="measurements" />
        <Stack.Screen name="water-history" />
        <Stack.Screen
          name="add"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DiaryProvider>
            <HealthProvider>
              <Shell />
            </HealthProvider>
          </DiaryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
