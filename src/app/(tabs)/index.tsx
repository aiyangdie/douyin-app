import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { FeedHeader } from '../../components/feed/FeedHeader';
import { VideoFeed } from '../../components/feed/VideoFeed';
import { VIDEOS } from '../../data/videos';
import { useRemoteFeed } from '../../lib/useRemoteFeed';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';

/** Number of videos shown on 关注 when the user follows nobody yet. */
const STARTER_FEED_SIZE = 3;

/** Home feed: full-screen vertical pager with the 关注 / 推荐 switcher. */
export default function HomeScreen() {
  const feedTab = useAppStore((state) => state.feedTab);
  const setFeedTab = useAppStore((state) => state.setFeedTab);
  const muted = useAppStore((state) => state.muted);
  const toggleMute = useAppStore((state) => state.toggleMute);
  const followedCreators = useAppStore((state) => state.followedCreators);

  // `null` while loading and whenever the server is unreachable, in which case
  // the bundled fixtures below keep the feed fully functional offline.
  const remoteVideos = useRemoteFeed();

  const videos = useMemo(() => {
    const pool = remoteVideos?.length ? remoteVideos : VIDEOS;

    if (feedTab === 'recommended') return pool;
    const followed = pool.filter((video) => followedCreators[video.creatorId]);
    // An empty 关注 tab would look broken, so fall back to a starter feed.
    return followed.length > 0 ? followed : pool.slice(0, STARTER_FEED_SIZE);
  }, [feedTab, followedCreators, remoteVideos]);

  return (
    <View style={styles.screen}>
      <VideoFeed key={feedTab} videos={videos} />
      <FeedHeader
        tab={feedTab}
        onChangeTab={setFeedTab}
        muted={muted}
        onToggleMute={toggleMute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
