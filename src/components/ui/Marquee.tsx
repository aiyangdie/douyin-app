import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { USE_NATIVE_DRIVER } from '../../lib/animation';
import { useAnimatedValue } from '../../lib/useAnimatedValue';

interface MarqueeProps {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Seconds for one full pass of the text. */
  speed?: number;
}

/**
 * Single-line text that scrolls horizontally when it overflows its container,
 * the way Douyin renders the background track name under a caption.
 *
 * Two copies of the text are laid end to end and translated by exactly one
 * text-width, which loops seamlessly.
 */
export function Marquee({ text, style, containerStyle, speed = 8 }: MarqueeProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useAnimatedValue(0);

  const overflows = textWidth > 0 && containerWidth > 0 && textWidth > containerWidth;

  useEffect(() => {
    if (!overflows) {
      translateX.setValue(0);
      return;
    }
    const distance = textWidth + 48;
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -distance,
        duration: speed * 1000 * (distance / Math.max(textWidth, 1)),
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [overflows, textWidth, speed, translateX]);

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
        <Text
          numberOfLines={1}
          style={[styles.text, style]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
        {overflows ? (
          <Text numberOfLines={1} style={[styles.text, styles.spacer, style]}>
            {text}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  text: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  spacer: {
    marginLeft: 48,
  },
});
