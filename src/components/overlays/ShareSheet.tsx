import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getCreator } from '../../data/creators';
import { VIDEOS } from '../../data/videos';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';
import { BottomSheet } from '../ui/BottomSheet';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ShareTarget {
  id: string;
  label: string;
  icon: IconName;
  tint: string;
  /** Message shown after tapping. */
  toast: string;
}

const TARGETS: ShareTarget[] = [
  { id: 'wechat', label: '微信', icon: 'logo-wechat', tint: '#07C160', toast: '已打开微信' },
  { id: 'moments', label: '朋友圈', icon: 'camera-outline', tint: '#07C160', toast: '已分享到朋友圈' },
  { id: 'qq', label: 'QQ', icon: 'chatbubble-ellipses-outline', tint: '#12B7F5', toast: '已打开 QQ' },
  { id: 'weibo', label: '微博', icon: 'at-outline', tint: '#E6162D', toast: '已分享到微博' },
  { id: 'link', label: '复制链接', icon: 'link-outline', tint: '#8A8F9C', toast: '链接已复制' },
  { id: 'save', label: '保存本地', icon: 'download-outline', tint: '#8A8F9C', toast: '已保存到相册' },
  { id: 'message', label: '私信', icon: 'send', tint: '#8A8F9C', toast: '已发送给好友' },
  { id: 'more', label: '更多', icon: 'ellipsis-horizontal', tint: '#8A8F9C', toast: '更多分享方式' },
];

interface ShareAction {
  id: string;
  label: string;
  icon: IconName;
  toast: string;
}

const ACTIONS: ShareAction[] = [
  { id: 'favorite', label: '收藏', icon: 'bookmark-outline', toast: '已加入收藏' },
  { id: 'report', label: '举报', icon: 'flag-outline', toast: '已收到举报，我们会尽快处理' },
  { id: 'hide', label: '不感兴趣', icon: 'eye-off-outline', toast: '将减少此类内容推荐' },
  { id: 'dislike', label: '减少相似', icon: 'heart-dislike-outline', toast: '已记录你的偏好' },
];

/** Short-lived confirmation toast shown inside the sheet. */
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useAnimatedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setMessage(null);
        });
      }, 1400);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, opacity, show };
}

/** Share sheet opened from the paper-plane button on a video. */
export function ShareSheet() {
  const videoId = useAppStore((state) => state.shareVideoId);
  const open = useAppStore((state) => state.shareOpen);
  const closeShare = useAppStore((state) => state.closeShare);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const favorite = useAppStore((state) =>
    videoId ? Boolean(state.favoritedVideos[videoId]) : false,
  );

  const { height } = useWindowDimensions();
  const { message, opacity, show } = useToast();

  const video = VIDEOS.find((item) => item.id === videoId);
  const creator = video ? getCreator(video.creatorId) : null;

  return (
    <BottomSheet visible={open} onClose={closeShare} height={Math.round(height * 0.4)}>
      <Text style={styles.title} numberOfLines={1}>
        {creator ? `分享 @${creator.name} 的视频` : '分享'}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.targetScroll}
        contentContainerStyle={styles.targetRow}
      >
        {TARGETS.map((target) => (
          <Pressable
            key={target.id}
            style={styles.target}
            onPress={() => show(target.toast)}
            accessibilityRole="button"
            accessibilityLabel={target.label}
          >
            <View style={[styles.targetIcon, { backgroundColor: target.tint }]}>
              <Ionicons name={target.icon} size={24} color="#fff" />
            </View>
            <Text style={styles.targetLabel}>{target.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.divider} />

      <View style={styles.actionRow}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={styles.action}
            onPress={() => {
              if (action.id === 'favorite' && videoId) toggleFavorite(videoId);
              show(action.toast);
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons
              name={
                action.id === 'favorite' && favorite ? 'bookmark' : action.icon
              }
              size={22}
              color={action.id === 'favorite' && favorite ? '#FFC53D' : colors.textSecondary}
            />
            <Text
              style={[
                styles.actionLabel,
                action.id === 'favorite' && favorite && { color: '#FFC53D' },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.cancel}
        onPress={closeShare}
        accessibilityRole="button"
        accessibilityLabel="取消"
      >
        <Text style={styles.cancelText}>取消</Text>
      </Pressable>

      {message ? (
        <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    fontSize: 13,
    color: colors.textTertiary,
  },
  /** Without flexGrow: 0 the horizontal scroller expands and pushes the
   *  action row and cancel button apart in the column layout. */
  targetScroll: {
    flexGrow: 0,
  },
  targetRow: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  target: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  targetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    backgroundColor: colors.divider,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  action: {
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  cancel: {
    marginTop: 'auto',
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '46%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  toastText: {
    fontSize: 13,
    color: '#fff',
  },
});
