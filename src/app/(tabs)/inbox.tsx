import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../../components/ui/Avatar';
import { CONVERSATIONS, INBOX_SHORTCUTS } from '../../data/conversations';
import { getCreator } from '../../data/creators';
import { colors } from '../../theme/tokens';
import { useTabBarHeight } from '../../lib/useTabBarHeight';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** 消息 tab: quick entries (粉丝 / 赞 / @ / 评论) then the conversation list. */
export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  return (
    <View style={styles.screen}>
      <FlatList
        data={CONVERSATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: tabBarHeight + 24,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>消息</Text>

            <View style={styles.shortcuts}>
              {INBOX_SHORTCUTS.map((shortcut) => (
                <Pressable
                  key={shortcut.id}
                  style={styles.shortcut}
                  accessibilityRole="button"
                  accessibilityLabel={shortcut.label}
                >
                  <View style={[styles.shortcutIcon, { backgroundColor: `${shortcut.tint}22` }]}>
                    <Ionicons
                      name={shortcut.icon as IconName}
                      size={24}
                      color={shortcut.tint}
                    />
                    {shortcut.badge > 0 ? (
                      <View style={styles.shortcutBadge}>
                        <Text style={styles.shortcutBadgeText}>
                          {shortcut.badge > 99 ? '99+' : shortcut.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />
          </View>
        }
        renderItem={({ item }) => {
          const creator = getCreator(item.creatorId);
          return (
            <Pressable
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`与 ${creator.name} 的对话`}
            >
              <View>
                <Avatar source={creator.avatar} size={50} />
                {item.unread > 0 ? (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>
                      {item.unread > 99 ? '99+' : item.unread}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {creator.name}
                  </Text>
                  <Text style={styles.rowTime}>{item.timeLabel}</Text>
                </View>
                <Text style={styles.rowMessage} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
                {item.context ? (
                  <View style={styles.contextChip}>
                    <Text style={styles.contextText}>{item.context}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
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
  title: {
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  shortcut: {
    alignItems: 'center',
    gap: 8,
  },
  shortcutIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  shortcutLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  divider: {
    marginTop: 22,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowTime: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  rowMessage: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  contextChip: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  contextText: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  unread: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
