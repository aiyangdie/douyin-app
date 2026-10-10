import { Tabs } from 'expo-router/js-tabs';

import { DouyinTabBar } from '../../components/tabs/DouyinTabBar';
import { colors } from '../../theme/tokens';

/**
 * Bottom tab navigator.
 *
 * The bar is absolutely positioned so the feed video runs full-bleed behind it,
 * which is what gives the home screen its edge-to-edge look.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <DouyinTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="friends" options={{ title: '朋友' }} />
      <Tabs.Screen name="inbox" options={{ title: '消息' }} />
      <Tabs.Screen name="me" options={{ title: '我' }} />
    </Tabs>
  );
}
