import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { ViewToken } from 'react-native';

import type { Video } from '../../data/types';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';
import { VideoPage } from './VideoPage';

interface VideoFeedProps {
  videos: Video[];
}

/**
 * Full-screen vertical pager.
 *
 * One video per screen, snapped, with Douyin's tap-to-pause and
 * double-tap-to-like gestures handled inside each `VideoPage`.
 */
export function VideoFeed({ videos }: VideoFeedProps) {
  const [pageHeight, setPageHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  /**
   * Index of the page the user paused, or `null`. Storing the *index* rather
   * than a boolean means swiping to another page resumes playback for free --
   * no effect resetting pause state on every page change.
   */
  const [pausedIndex, setPausedIndex] = useState<number | null>(null);

  const muted = useAppStore((state) => state.muted);

  // `videos` can shrink under us (the 关注 tab filters the list), so clamp
  // during render instead of correcting it from an effect.
  const safeIndex = Math.min(activeIndex, Math.max(0, videos.length - 1));
  const paused = pausedIndex === safeIndex;

  const togglePause = useCallback(() => {
    setPausedIndex((current) => (current === safeIndex ? null : safeIndex));
  }, [safeIndex]);

  // FlatList requires both of these to keep a stable identity for its lifetime.
  const [viewabilityConfig] = useState(() => ({ itemVisiblePercentThreshold: 60 }));
  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const first = viewableItems[0];
        if (first?.index != null) setActiveIndex(first.index);
      },
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Video; index: number }) => (
      <View style={{ height: pageHeight || undefined, flex: pageHeight ? undefined : 1 }}>
        <VideoPage
          video={item}
          isActive={index === safeIndex}
          shouldMountPlayer={Math.abs(index - safeIndex) <= 1}
          muted={muted}
          paused={index === safeIndex ? paused : true}
          onSingleTap={togglePause}
        />
      </View>
    ),
    [muted, pageHeight, paused, safeIndex, togglePause],
  );

  return (
    <View
      style={styles.container}
      onLayout={(event) => setPageHeight(Math.round(event.nativeEvent.layout.height))}
    >
      {pageHeight > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          // `pagingEnabled` is deliberately absent: React Native documents it as
          // unsupported for *vertical* paging on Android, and having it set
          // alongside `snapToInterval` made every drag snap back to the page it
          // started on. `snapToInterval` is the supported way to page here and
          // works on both platforms.
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Only the active page and its neighbours keep a player alive.
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
