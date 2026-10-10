import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CommentsSheet } from '../components/overlays/CommentsSheet';
import { ShareSheet } from '../components/overlays/ShareSheet';
import { colors } from '../theme/tokens';

/**
 * Root layout. Expo Router renders `src/app` as the route tree; everything
 * else lives outside that folder.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />

        {/*
         * Sheets live above the navigator on purpose. Inside a tab screen they
         * would sit underneath the floating tab bar, which clips their input
         * row and cancel button — and in the real app a comment sheet covers
         * the tab bar too.
         */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <CommentsSheet />
          <ShareSheet />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
