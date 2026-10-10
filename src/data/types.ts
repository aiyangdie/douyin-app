import type { ImageSourcePropType } from 'react-native';

/** A content creator / account in the app. */
export interface Creator {
  id: string;
  /** Display name shown in comments, messages and the profile header. */
  name: string;
  /** Douyin-style numeric handle, e.g. `@夜行者Leo`. */
  handle: string;
  avatar: ImageSourcePropType;
  bio: string;
  /** Whether the blue "verified" check shows next to the name. */
  verified: boolean;
  stats: {
    following: number;
    followers: number;
    likes: number;
  };
}

/** One short video in the feed. */
export interface Video {
  id: string;
  creatorId: string;
  caption: string;
  /** Human readable hashtags rendered after the caption. */
  tags: string[];
  /** Name of the background track shown on the music line. */
  music: string;
  /**
   * Loopable video. A bundled asset (`require()`) for the local fixtures, or a
   * URL string when the video came from the server — `expo-video` accepts both.
   */
  source: number | string;
  /** Poster frame shown before the player is ready. */
  thumbnail: ImageSourcePropType;
  durationSeconds: number;
  metrics: {
    likes: number;
    comments: number;
    favorites: number;
    shares: number;
  };
  /** Location chip rendered above the caption, when present. */
  location?: string;
  /**
   * Set only on server-supplied videos, whose authors are not in the bundled
   * fixture table. Falls back to `getCreator(creatorId)` when absent.
   */
  creator?: Creator;
}

/** A comment inside the comment sheet. */
export interface Comment {
  id: string;
  videoId: string;
  authorId: string;
  text: string;
  /** e.g. `2小时前`, or `作者` when posted by the creator. */
  timeLabel: string;
  likes: number;
  /** Nested replies, rendered collapsed under the parent comment. */
  replies: { id: string; authorId: string; text: string; likes: number }[];
  isPinned?: boolean;
}

/** A row in the 消息 (inbox) tab. */
export interface Conversation {
  id: string;
  creatorId: string;
  lastMessage: string;
  timeLabel: string;
  unread: number;
  /** `分享视频` / `赞了你的作品` style context chips. */
  context?: string;
}

/** A short "日常" post shown in the 朋友 grid. */
export interface Moment {
  id: string;
  creatorId: string;
  thumbnail: ImageSourcePropType;
  caption: string;
  likes: number;
  /** Card height in the two-column grid, so the masonry looks organic. */
  aspect: number;
}
