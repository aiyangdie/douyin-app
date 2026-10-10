import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../../components/ui/Avatar';
import { CURRENT_USER } from '../../data/creators';
import { MY_WORKS, VIDEOS } from '../../data/videos';
import type { Video } from '../../data/types';
import { formatCount } from '../../lib/format';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';
import { FILL } from '../../theme/styles';

type ProfileTab = 'works' | 'likes' | 'favorites';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'works', label: '作品' },
  { key: 'likes', label: '喜欢' },
  { key: 'favorites', label: '收藏' },
];

/** 我 tab: profile header, stats, and a three-column grid of videos. */
export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [tab, setTab] = useState<ProfileTab>('works');

  const likedVideos = useAppStore((state) => state.likedVideos);
  const favoritedVideos = useAppStore((state) => state.favoritedVideos);
  const openComments = useAppStore((state) => state.openComments);

  const items = useMemo<Video[]>(() => {
    if (tab === 'likes') return VIDEOS.filter((video) => likedVideos[video.id]);
    if (tab === 'favorites') return VIDEOS.filter((video) => favoritedVideos[video.id]);
    return MY_WORKS;
  }, [tab, likedVideos, favoritedVideos]);

  const header = (
    <View>
      <LinearGradient
        colors={['#3A1C36', '#1B1520', colors.background]}
        style={[styles.cover, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.coverActions}>
          <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="二维码">
            <Ionicons name="qr-code-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="设置">
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <Avatar source={CURRENT_USER.avatar} size={78} ring />
          <View style={styles.identityText}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{CURRENT_USER.name}</Text>
              {CURRENT_USER.verified ? (
                <Ionicons name="checkmark-circle" size={15} color={colors.brandCyan} />
              ) : null}
            </View>
            <Text style={styles.handle}>抖音号：{CURRENT_USER.handle}</Text>
          </View>
        </View>

        <Text style={styles.bio}>{CURRENT_USER.bio}</Text>

        <View style={styles.stats}>
          <Stat value={CURRENT_USER.stats.likes} label="获赞" />
          <Stat value={CURRENT_USER.stats.following} label="关注" />
          <Stat value={CURRENT_USER.stats.followers} label="粉丝" />
        </View>

        <View style={styles.buttons}>
          <Pressable style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>编辑资料</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="分享主页">
            <Ionicons name="link-outline" size={17} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="更多">
            <Ionicons name="ellipsis-horizontal" size={17} color={colors.textPrimary} />
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        {PROFILE_TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>
          {tab === 'likes' ? '还没有喜欢的作品' : '还没有收藏的作品'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={items.length > 0 ? styles.column : undefined}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={styles.tile}
            onPress={() => openComments(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.caption}
          >
            <Image source={item.thumbnail} style={styles.tileImage} resizeMode="cover" />
            <View style={styles.tileStats}>
              <Ionicons name="play" size={10} color="#fff" />
              <Text style={styles.tileStatsText}>{formatCount(item.metrics.likes)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{formatCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cover: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  coverActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  identityText: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  handle: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  bio: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 28,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  primaryButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  secondaryButton: {
    width: 42,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.textPrimary,
  },
  tabUnderline: {
    marginTop: 8,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },
  empty: {
    paddingVertical: 40,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textTertiary,
  },
  column: {
    gap: 2,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  tile: {
    flex: 1 / 3,
    aspectRatio: 0.75,
    marginBottom: 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tileImage: {
    ...FILL,
  },
  tileStats: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tileStatsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
