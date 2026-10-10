import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { useAnimatedValue } from '../../lib/useAnimatedValue';

interface MusicDiscProps {
  artwork: ImageSourcePropType;
  /** The disc only spins while the video is playing. */
  spinning: boolean;
  size?: number;
}

/** The rotating vinyl at the bottom of the action rail. */
export function MusicDisc({ artwork, spinning, size = 44 }: MusicDiscProps) {
  const rotation = useAnimatedValue(0);

  useEffect(() => {
    if (!spinning) return;
    // `Animated.loop` resets to the value captured when the loop started, so
    // restart from a known angle rather than from wherever the disc stopped.
    rotation.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Image
          source={artwork}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </Animated.View>
      <View style={styles.note} pointerEvents="none">
        <Ionicons name="musical-notes" size={13} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C22',
  },
  note: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
