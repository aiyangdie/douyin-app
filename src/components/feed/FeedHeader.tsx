import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FeedTab } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';

interface FeedHeaderProps {
  tab: FeedTab;
  onChangeTab: (tab: FeedTab) => void;
  muted: boolean;
  onToggleMute: () => void;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'following', label: '关注' },
  { key: 'recommended', label: '推荐' },
];

/** Floating header over the feed: 关注 / 推荐 plus search and volume. */
export function FeedHeader({ tab, onChangeTab, muted, onToggleMute }: FeedHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.spacer} />

      <View style={styles.tabs}>
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChangeTab(item.key)}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onToggleMute}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={muted ? '打开声音' : '静音'}
        >
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={21}
            color="#fff"
            style={styles.icon}
          />
        </Pressable>
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="搜索">
          <Ionicons name="search" size={24} color="#fff" style={styles.icon} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  spacer: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  tab: {
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 4,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textPrimary,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 18,
  },
  icon: {
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
