import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { USE_NATIVE_DRIVER } from '../../lib/animation';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { colors } from '../../theme/tokens';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Sheet height in pixels. */
  height: number;
  children: ReactNode;
  /** Tapping the dimmed area above the sheet closes it. */
  dismissOnBackdrop?: boolean;
}

/**
 * Slide-up sheet with a dimmed backdrop.
 *
 * The subtree stays mounted and is parked one sheet-height below the viewport
 * while closed. That keeps the open/close animations honest without a
 * mount-tracking effect (which would set state during an effect and cascade a
 * second render), and it preserves scroll position between openings.
 */
export function BottomSheet({
  visible,
  onClose,
  height,
  children,
  dismissOnBackdrop = true,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useAnimatedValue(height);
  const backdrop = useAnimatedValue(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : height,
        duration: visible ? 260 : 220,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(backdrop, {
        toValue: visible ? 1 : 0,
        duration: visible ? 260 : 200,
        easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [visible, height, translateY, backdrop]);

  return (
    <View
      style={styles.root}
      pointerEvents={visible ? 'box-none' : 'none'}
      // Closed sheets sit below the fold; clip so they cannot extend the page.
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="关闭"
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.host}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            { height, paddingBottom: Math.max(insets.bottom, 8) },
            { transform: [{ translateY }] },
          ]}
        >
          <View style={styles.grabber} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  host: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    marginTop: 8,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
