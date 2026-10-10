import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * An `Animated.Value` that stays stable for the component's lifetime.
 *
 * `useRef(new Animated.Value(0)).current` reads a ref during render, which the
 * React Compiler lint rules correctly reject. Lazily initialised state is the
 * supported way to hold an instance across renders.
 */
export function useAnimatedValue(initialValue: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initialValue));
  return value;
}
