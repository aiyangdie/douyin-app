import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Video } from '../data/types';

/**
 * Which feed tab is selected. `following` narrows the feed to creators the
 * user follows; `recommended` is the full list.
 */
export type FeedTab = 'following' | 'recommended';

interface AppState {
  /** Ids of videos the user has liked. */
  likedVideos: Record<string, boolean>;
  /** Ids of videos saved to favourites. */
  favoritedVideos: Record<string, boolean>;
  /** Creator ids the user follows. */
  followedCreators: Record<string, boolean>;
  /** Comment ids the user has liked. */
  likedComments: Record<string, boolean>;

  /** Playback volume is off. Persisted so the preference survives restarts. */
  muted: boolean;
  /** Selected tab on the home feed. */
  feedTab: FeedTab;

  /**
   * Video whose comment sheet is showing.
   *
   * Deliberately *not* cleared on close: the sheet keeps rendering this thread
   * while it slides away, so the content does not blank out mid-animation.
   * Visibility is tracked separately by `commentsOpen`.
   */
  commentsVideoId: string | null;
  commentsOpen: boolean;
  /** Same split as the comment sheet, for the share sheet. */
  shareVideoId: string | null;
  shareOpen: boolean;

  toggleLike: (videoId: string) => void;
  toggleFavorite: (videoId: string) => void;
  toggleFollow: (creatorId: string) => void;
  toggleCommentLike: (commentId: string) => void;
  toggleMute: () => void;
  setFeedTab: (tab: FeedTab) => void;
  openComments: (videoId: string) => void;
  closeComments: () => void;
  openShare: (videoId: string) => void;
  closeShare: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      likedVideos: {},
      favoritedVideos: {},
      followedCreators: {},
      likedComments: {},
      muted: false,
      feedTab: 'recommended',
      commentsVideoId: null,
      commentsOpen: false,
      shareVideoId: null,
      shareOpen: false,

      toggleLike: (videoId) =>
        set((state) => ({
          likedVideos: { ...state.likedVideos, [videoId]: !state.likedVideos[videoId] },
        })),

      toggleFavorite: (videoId) =>
        set((state) => ({
          favoritedVideos: {
            ...state.favoritedVideos,
            [videoId]: !state.favoritedVideos[videoId],
          },
        })),

      toggleFollow: (creatorId) =>
        set((state) => ({
          followedCreators: {
            ...state.followedCreators,
            [creatorId]: !state.followedCreators[creatorId],
          },
        })),

      toggleCommentLike: (commentId) =>
        set((state) => ({
          likedComments: {
            ...state.likedComments,
            [commentId]: !state.likedComments[commentId],
          },
        })),

      toggleMute: () => set((state) => ({ muted: !state.muted })),
      setFeedTab: (feedTab) => set({ feedTab }),

      openComments: (videoId) => set({ commentsVideoId: videoId, commentsOpen: true }),
      closeComments: () => set({ commentsOpen: false }),
      openShare: (videoId) => set({ shareVideoId: videoId, shareOpen: true }),
      closeShare: () => set({ shareOpen: false }),
    }),
    {
      name: 'douyin-app-state',
      storage: createJSONStorage(() => AsyncStorage),
      // Only durable preferences are persisted; sheet state is transient.
      partialize: (state) => ({
        likedVideos: state.likedVideos,
        favoritedVideos: state.favoritedVideos,
        followedCreators: state.followedCreators,
        likedComments: state.likedComments,
        muted: state.muted,
      }),
    },
  ),
);

/**
 * The like count as displayed: the seed count plus the user's own like.
 * Keeps the UI consistent without mutating the fixtures.
 */
export function displayLikes(video: Video, liked: boolean): number {
  return video.metrics.likes + (liked ? 1 : 0);
}
