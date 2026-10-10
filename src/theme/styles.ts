import type { ImageStyle } from 'react-native';

/**
 * Fills the parent box, percentages included.
 *
 * `StyleSheet.absoluteFill` is not enough for *replaced* elements — `<video>`
 * and `<img>`. With `width: auto` they resolve to their intrinsic pixel size
 * and ignore the `inset` constraints, so a 720x1280 clip would lay out at
 * 720x1280 inside a 390x844 screen and get clipped instead of scaled.
 * Explicit percentages resolve against the parent on every platform.
 *
 * Typed with `satisfies` rather than `: ViewStyle` so the literal keeps its
 * narrow shape: `ViewStyle` permits `overflow: 'scroll'`, which `ImageStyle`
 * does not, so a `ViewStyle` annotation would make this unusable on `<Image>`.
 */
export const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
} satisfies ImageStyle;
