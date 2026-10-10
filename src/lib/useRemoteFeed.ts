/**
 * Bridges the server's feed into the app's local `Video` shape.
 *
 * Returns `null` while loading and on any failure, which is the signal for the
 * home feed to keep using the bundled fixtures. Nothing here throws.
 */
import { useEffect, useState } from 'react';

import type { Creator, Video } from '../data/types';
import { fetchFeed, type RemoteFeedVideo } from './api';

/** Neutral stand-in for accounts with no avatar on the server. */
const FALLBACK_AVATAR = require('../../assets/avatars/me.png');

function toCreator(user: RemoteFeedVideo['creator']): Creator {
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    // Remote avatars arrive as URLs; `Image` accepts `{ uri }` alongside
    // `require()` results, so the two sources are interchangeable downstream.
    avatar: user.avatarUrl ? { uri: user.avatarUrl } : FALLBACK_AVATAR,
    bio: user.bio,
    verified: user.verified,
    stats: { following: 0, followers: 0, likes: 0 },
  };
}

function toVideo(item: RemoteFeedVideo): Video {
  return {
    id: item.id,
    creatorId: item.creatorId,
    // The author travels with the video: a server video's creator has no entry
    // in the bundled fixture table.
    creator: toCreator(item.creator),
    caption: item.caption,
    tags: item.tags,
    music: item.music,
    // expo-video plays a remote URL just as happily as a bundled asset.
    source: item.videoUrl ?? '',
    thumbnail: item.coverUrl ? { uri: item.coverUrl } : FALLBACK_AVATAR,
    durationSeconds: item.durationSeconds,
    metrics: item.metrics,
    location: item.location ?? undefined,
  };
}

/**
 * The server feed, or `null` when unreachable.
 *
 * Deliberately silent on failure: being offline is an expected state for this
 * app, not an error worth surfacing.
 */
export function useRemoteFeed(limit = 12): Video[] | null {
  const [videos, setVideos] = useState<Video[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFeed(limit)
      .then((items) => {
        if (alive) setVideos(items.filter((item) => item.videoUrl).map(toVideo));
      })
      .catch(() => {
        if (alive) setVideos(null);
      });
    return () => {
      alive = false;
    };
  }, [limit]);

  return videos;
}
