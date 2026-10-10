import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '../theme/tokens';

/**
 * Total height of the floating tab bar, home-indicator inset included.
 *
 * Screens inside the tab navigator use this as bottom padding, and the feed
 * uses it to keep its caption and action rail clear of the bar.
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 6);
}
