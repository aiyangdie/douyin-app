import { Ionicons } from '@expo/vector-icons';
import { Animated, StyleSheet } from 'react-native';

interface HeartBurstProps {
  /** Scale/opacity driver, animated 0 -> 1 by the parent on double tap. */
  progress: Animated.Value;
  /** Tap position inside the video page. */
  x: number;
  y: number;
}

/**
 * The oversized heart that pops where the user double-tapped, Douyin's
 * signature like affordance.
 */
export function HeartBurst({ progress, x, y }: HeartBurstProps) {
  const scale = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.3, 1.25, 1],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: ['-18deg', '-8deg', '0deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.burst,
        {
          left: x - 60,
          top: y - 60,
          opacity,
          transform: [{ scale }, { rotate }],
        },
      ]}
    >
      <Ionicons name="heart" size={120} color="#FE2C55" style={styles.shadow} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
});
