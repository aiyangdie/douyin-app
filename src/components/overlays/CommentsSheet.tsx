import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { commentsFor } from '../../data/comments';
import { getCreator } from '../../data/creators';
import type { Comment } from '../../data/types';
import { VIDEOS } from '../../data/videos';
import { formatCount } from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';

/** Share of the screen height the sheet occupies when open. */
const SHEET_RATIO = 0.7;

interface CommentRowProps {
  comment: Comment;
  liked: boolean;
  onToggleLike: (id: string) => void;
}

function CommentRow({ comment, liked, onToggleLike }: CommentRowProps) {
  const author = getCreator(comment.authorId);
  const likeCount = comment.likes + (liked ? 1 : 0);

  return (
    <View style={styles.row}>
      <Avatar source={author.avatar} size={36} />
      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Text style={styles.rowName}>{author.name}</Text>
          {comment.isPinned ? <Text style={styles.pinned}>作者置顶</Text> : null}
        </View>
        <Text style={styles.rowText}>{comment.text}</Text>
        <View style={styles.rowFooter}>
          <Text style={styles.rowTime}>{comment.timeLabel}</Text>
          <Text style={styles.rowReply}>回复</Text>
        </View>

        {comment.replies.length > 0 ? (
          <View style={styles.replies}>
            {comment.replies.map((reply) => {
              const replyAuthor = getCreator(reply.authorId);
              return (
                <Text key={reply.id} style={styles.replyText}>
                  <Text style={styles.replyName}>{replyAuthor.name}：</Text>
                  {reply.text}
                </Text>
              );
            })}
            <Text style={styles.replyMore}>展开 {comment.replies.length} 条回复 ›</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => onToggleLike(comment.id)}
        hitSlop={8}
        style={styles.rowLike}
        accessibilityRole="button"
        accessibilityLabel="点赞这条评论"
      >
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={16}
          color={liked ? colors.brand : colors.textTertiary}
        />
        <Text style={styles.rowLikeText}>{formatCount(likeCount)}</Text>
      </Pressable>
    </View>
  );
}

/** Comment sheet for the video currently open in the feed. */
export function CommentsSheet() {
  // `videoId` intentionally survives the close animation, so the thread keeps
  // rendering while the sheet slides away. `open` drives visibility.
  const contentId = useAppStore((state) => state.commentsVideoId);
  const open = useAppStore((state) => state.commentsOpen);
  const closeComments = useAppStore((state) => state.closeComments);
  const likedComments = useAppStore((state) => state.likedComments);
  const toggleCommentLike = useAppStore((state) => state.toggleCommentLike);

  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * SHEET_RATIO);

  const [draft, setDraft] = useState('');
  /** Comments written in this session, keyed by video. */
  const [posted, setPosted] = useState<Record<string, Comment[]>>({});

  const comments = useMemo(() => {
    if (!contentId) return [];
    return [...(posted[contentId] ?? []), ...commentsFor(contentId)];
  }, [contentId, posted]);

  // The header shows the thread's real total, matching the count on the rail.
  // The list itself only renders the first page, as a real feed would.
  const totalCount = useMemo(() => {
    if (!contentId) return 0;
    const base = VIDEOS.find((video) => video.id === contentId)?.metrics.comments ?? comments.length;
    return base + (posted[contentId]?.length ?? 0);
  }, [contentId, comments.length, posted]);

  const handleSubmit = useCallback(() => {
    const text = draft.trim();
    if (!text || !contentId) return;
    setPosted((previous) => ({
      ...previous,
      [contentId]: [
        {
          id: `local-${Date.now()}`,
          videoId: contentId,
          authorId: 'me',
          text,
          timeLabel: '刚刚',
          likes: 0,
          replies: [],
        },
        ...(previous[contentId] ?? []),
      ],
    }));
    setDraft('');
  }, [contentId, draft]);

  return (
    <BottomSheet visible={open} onClose={closeComments} height={sheetHeight}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{formatCount(totalCount)} 条评论</Text>
        <Pressable
          onPress={closeComments}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="关闭评论"
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommentRow
            comment={item}
            liked={Boolean(likedComments[item.id])}
            onToggleLike={toggleCommentLike}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>还没有评论，来说点什么吧</Text>}
      />

      <View style={styles.inputBar}>
        <View style={styles.inputWrapper}>
          <Ionicons name="create-outline" size={17} color={colors.textTertiary} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSubmit}
            placeholder="说点什么..."
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            returnKeyType="send"
            accessibilityLabel="写评论"
          />
        </View>
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="表情">
          <Ionicons name="happy-outline" size={24} color={colors.textSecondary} />
        </Pressable>
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="@好友">
          <Ionicons name="at-outline" size={24} color={colors.textSecondary} />
        </Pressable>
        {draft.trim().length > 0 ? (
          <Pressable
            onPress={handleSubmit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="发送评论"
          >
            <Ionicons name="send" size={22} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  rowBody: {
    flex: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  pinned: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.brand,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  rowText: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  rowFooter: {
    marginTop: 5,
    flexDirection: 'row',
    gap: 14,
  },
  rowTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  rowReply: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  replies: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.divider,
    gap: 4,
  },
  replyText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  replyName: {
    color: colors.textTertiary,
  },
  replyMore: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  rowLike: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
    width: 34,
  },
  rowLikeText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
});
