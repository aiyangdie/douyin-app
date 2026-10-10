import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { getCreator } from '../../data/creators';
import type { Video } from '../../data/types';
import { USE_NATIVE_DRIVER } from '../../lib/animation';
import { useAnimatedValue } from '../../lib/useAnimatedValue';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { useAppStore, displayLikes } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';
import { FILL } from '../../theme/styles';
import { ActionRail } from './ActionRail';
import { CaptionBlock } from './CaptionBlock';
import { HeartBurst } from './HeartBurst';
import { VideoLayer } from './VideoLayer';

/** Window in which a second tap counts as a double tap. */
const DOUBLE_TAP_MS = 280;

interface VideoPageProps {
  video: Video;
  isActive: boolean;
  /** Mount the native player: true for the active page and its neighbours. */
  shouldMountPlayer: boolean;
  muted: boolean;
  paused: boolean;
  onSingleTap: () => void;
}

/**
 * One full-screen page of the feed: video, gesture layer and all overlays.
 *
 * The player itself lives in `VideoLayer`, which is only mounted when this page
 * is near the viewport — see `shouldMountPlayer`.
 */
export function VideoPage({
  video,
  isActive,
  shouldMountPlayer,
  muted,
  paused,
  onSingleTap,
}: VideoPageProps) {
  const creator = getCreator(video.creatorId);
  const tabBarHeight = useTabBarHeight();

  const liked = useAppStore((s) => Boolean(s.likedVideos[video.id]));
  const favorited = useAppStore((s) => Boolean(s.favoritedVideos[video.id]));
  const following = useAppStore((s) => Boolean(s.followedCreators[video.creatorId]));
  const toggleLike = useAppStore((s) => s.toggleLike);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const toggleFollow = useAppStore((s) => s.toggleFollow);
  const openComments = useAppStore((s) => s.openComments);
  const openShare = useAppStore((s) => s.openShare);

  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const progress = useAnimatedValue(0);
  const burst = useAnimatedValue(0);
  const [burstAt, setBurstAt] = useState({ x: 0, y: 0 });

  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    },
    [],
  );

  const handleReady = useCallback(() => setReady(true), []);

  const handleDoubleTap = useCallback(
    (x: number, y: number) => {
      setBurstAt({ x, y });
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      // Double tap always likes; it never un-likes.
      if (!liked) toggleLike(video.id);
    },
    [burst, liked, toggleLike, video.id],
  );

  /**
   * Single tap toggles playback, double tap likes. The single-tap action is
   * deferred so it can be cancelled when a second tap arrives.
   */
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      // A page fills the viewport exactly, so window coordinates are already
      // page-relative. `locationX/Y` is preferred when present, but
      // react-native-web leaves it undefined on Pressable — falling back to 0
      // pinned the heart burst to the top-left corner.
      const { locationX, locationY, pageX, pageY } = event.nativeEvent;
      const x = locationX ?? pageX ?? 0;
      const y = locationY ?? pageY ?? 0;
      const now = Date.now();

      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        if (singleTapTimer.current) {
          clearTimeout(singleTapTimer.current);
          singleTapTimer.current = null;
        }
        handleDoubleTap(x, y);
        return;
      }

      lastTap.current = now;
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        onSingleTap();
      }, DOUBLE_TAP_MS);
    },
    [handleDoubleTap, onSingleTap],
  );

  return (
    <View style={styles.page}>
      <Image
        source={video.thumbnail}
        style={[FILL, { opacity: ready ? 0 : 1 }]}
        resizeMode="cover"
      />

      {shouldMountPlayer ? (
        <VideoLayer
          source={video.source}
          isActive={isActive}
          paused={paused}
          muted={muted}
          progress={progress}
          onReady={handleReady}
        />
      ) : null}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${creator.name} 的视频，${video.caption}`}
      />

      {paused ? (
        <View style={styles.pauseIndicator} pointerEvents="none">
          <Ionicons name="play" size={74} color="rgba(255, 255, 255, 0.72)" />
        </View>
      ) : null}

      <HeartBurst progress={burst} x={burstAt.x} y={burstAt.y} />

      <CaptionBlock
        video={video}
        creator={creator}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((value) => !value)}
      />

      <ActionRail
        video={video}
        creator={creator}
        liked={liked}
        favorited={favorited}
        following={following}
        likeCount={displayLikes(video, liked)}
        spinning={isActive && !paused}
        onLike={() => toggleLike(video.id)}
        onComment={() => openComments(video.id)}
        onFavorite={() => toggleFavorite(video.id)}
        onShare={() => openShare(video.id)}
        onFollow={() => toggleFollow(video.creatorId)}
      />

      <View style={[styles.progressTrack, { bottom: tabBarHeight }]} pointerEvents="none">
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  pauseIndicator: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  progressFill: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
});
