import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import type { Animated } from 'react-native';

import { FILL } from '../../theme/styles';

interface VideoLayerProps {
  /** Local asset from `require()`. */
  source: number;
  /** Whether this page is the one currently filling the screen. */
  isActive: boolean;
  /** User tapped to pause. */
  paused: boolean;
  muted: boolean;
  /** Written directly, so playback progress never re-renders React. */
  progress: Animated.Value;
  onReady: () => void;
}

/**
 * Thin wrapper around `expo-video`.
 *
 * Mounted only for the active page and its immediate neighbours: each instance
 * allocates a native player, so keeping all eight in memory would be wasteful.
 */
export function VideoLayer({
  source,
  isActive,
  paused,
  muted,
  progress,
  onReady,
}: VideoLayerProps) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    // Drives the bottom progress bar; 0.25s keeps the bar smooth without
    // flooding the bridge.
    instance.timeUpdateEventInterval = 0.25;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    // `muted` is a writable property on expo-video's player; the module exposes
    // no setter method. The player is an imperative native handle rather than
    // render data, so the compiler's immutability rule does not apply.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (isActive && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, isActive, paused]);

  useEffect(() => {
    if (status === 'readyToPlay') onReady();
  }, [status, onReady]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const duration = player.duration;
    if (!duration || duration <= 0) return;
    progress.setValue(Math.min(1, Math.max(0, currentTime / duration)));
  });

  return (
    <VideoView
      // `FILL`, not `absoluteFill`: a bare `<video>` is a replaced element and
      // would otherwise render at its intrinsic 720x1280 and get clipped.
      style={FILL}
      player={player}
      contentFit="cover"
      nativeControls={false}
      // Overlapping cover-fit surfaces glitch on Android; textureView is the
      // documented workaround and this feed stacks full-screen players.
      surfaceType="textureView"
    />
  );
}
