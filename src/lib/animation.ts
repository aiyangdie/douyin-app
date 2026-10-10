import { Platform } from 'react-native';

/**
 * Whether an animation may run on the native driver.
 *
 * react-native-web ships no native animated module. Passing `useNativeDriver:
 * true` there changes nothing — the animation is JS-driven either way — but
 * logs a multi-line "Falling back to JS-based animation" warning for every
 * animation that starts, which buries the console. Native platforms keep the
 * native driver so animations stay off the JS thread.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
