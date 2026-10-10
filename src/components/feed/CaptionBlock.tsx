import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Creator, Video } from '../../data/types';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { colors } from '../../theme/tokens';
import { Marquee } from '../ui/Marquee';

interface CaptionBlockProps {
  video: Video;
  creator: Creator;
  /** Caption is clamped until the user taps "展开". */
  expanded: boolean;
  onToggleExpanded: () => void;
}

/** Bottom-left overlay: handle, caption, hashtags and the music line. */
export function CaptionBlock({
  video,
  creator,
  expanded,
  onToggleExpanded,
}: CaptionBlockProps) {
  const tabBarHeight = useTabBarHeight();

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 12 }]} pointerEvents="box-none">
      {video.location ? (
        <View style={styles.locationChip}>
          <Ionicons name="location-outline" size={12} color="#fff" />
          <Text style={styles.locationText}>{video.location}</Text>
        </View>
      ) : null}

      <Text style={styles.handle}>@{creator.name}</Text>

      <Pressable onPress={onToggleExpanded} accessibilityRole="button">
        <Text style={styles.caption} numberOfLines={expanded ? undefined : 2}>
          {video.caption}
          {video.tags.length > 0 ? (
            <Text style={styles.tags}>{`  ${video.tags.join(' ')}`}</Text>
          ) : null}
        </Text>
        {!expanded && video.caption.length > 30 ? (
          <Text style={styles.expand}>展开</Text>
        ) : null}
      </Pressable>

      <View style={styles.musicRow}>
        <Ionicons name="musical-note" size={13} color={colors.textPrimary} />
        <Marquee text={video.music} containerStyle={styles.marquee} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 82,
    gap: 6,
  },
  locationChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  locationText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  handle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tags: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  expand: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textTertiary,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  marquee: {
    flex: 1,
  },
});
