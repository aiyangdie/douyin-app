import { Ionicons } from '@expo/vector-icons';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CREATORS, getCreator } from '../../data/creators';
import { MOMENTS } from '../../data/videos';
import { formatCount } from '../../lib/format';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { colors } from '../../theme/tokens';
import { FILL } from '../../theme/styles';
import { Avatar } from '../../components/ui/Avatar';

/** 朋友 tab: who is online, then a two-column wall of 日常 posts. */
export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const header = (
    <View style={styles.headerArea}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>朋友</Text>
        <Pressable style={styles.publish} accessibilityRole="button" accessibilityLabel="发布日常">
          <Ionicons name="camera-outline" size={15} color={colors.textPrimary} />
          <Text style={styles.publishText}>发布日常</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>在线好友</Text>
      <FlatList
        horizontal
        data={CREATORS}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.onlineRow}
        renderItem={({ item, index }) => (
          <Pressable style={styles.onlineItem} accessibilityRole="button" accessibilityLabel={item.name}>
            <View>
              <Avatar source={item.avatar} size={56} />
              {index % 3 !== 1 ? <View style={styles.onlineDot} /> : null}
            </View>
            <Text style={styles.onlineName} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />

      <Text style={styles.sectionLabel}>好友日常</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={MOMENTS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={styles.column}
        contentContainerStyle={[
          styles.grid,
          { paddingTop: insets.top + 12, paddingBottom: tabBarHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const creator = getCreator(item.creatorId);
          return (
            <View style={[styles.card, { aspectRatio: item.aspect }]}>
              <Image source={item.thumbnail} style={styles.cardImage} resizeMode="cover" />
              <View style={styles.cardScrim} />
              <View style={styles.cardFooter}>
                <Avatar source={creator.avatar} size={22} />
                <Text style={styles.cardName} numberOfLines={1}>
                  {creator.name}
                </Text>
                <View style={styles.cardLikes}>
                  <Ionicons name="heart" size={12} color="#fff" />
                  <Text style={styles.cardLikesText}>{formatCount(item.likes)}</Text>
                </View>
              </View>
              <Text style={styles.cardCaption} numberOfLines={2}>
                {item.caption}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerArea: {
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  publish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  publishText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  onlineRow: {
    gap: 16,
  },
  onlineItem: {
    width: 60,
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3ED598',
    borderWidth: 2,
    borderColor: colors.background,
  },
  onlineName: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  grid: {
    paddingHorizontal: 12,
  },
  column: {
    gap: 8,
  },
  card: {
    flex: 1,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  cardImage: {
    ...FILL,
  },
  cardScrim: {
    ...FILL,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  cardCaption: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8,
    fontSize: 12,
    lineHeight: 16,
    color: '#fff',
    fontWeight: '500',
  },
  cardFooter: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    flex: 1,
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  cardLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardLikesText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
});
