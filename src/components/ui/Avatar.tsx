import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

import { colors } from '../../theme/tokens';

interface AvatarProps {
  source: ImageSourcePropType;
  size?: number;
  /** Draws the white ring used on the profile and follow buttons. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Circular avatar with an optional ring. */
export function Avatar({ source, size = 44, ring = false, style }: AvatarProps) {
  const ringWidth = ring ? 2 : 0;
  const outer = size + ringWidth * 2 + (ring ? 4 : 0);

  return (
    <View
      style={[
        styles.wrapper,
        { width: outer, height: outer, borderRadius: outer / 2 },
        ring && styles.ring,
        style,
      ]}
    >
      <Image
        source={source}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  ring: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
});
