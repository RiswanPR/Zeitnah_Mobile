import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

// Safely require native bridge module at runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
const VdoBridge = require('vdocipher-rn-bridge');
const VdoPlayerView = VdoBridge.VdoPlayerView;

export const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
export type SpeedPreset = (typeof SPEED_PRESETS)[number];

export interface VdoEmbedInfo {
  otp: string;
  playbackInfo: string;
  classId?: string;
  title?: string;
  resumeTimeMs?: number;
}

export interface VdoPlayerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
}

export interface VdoPlayerProgressEvent {
  currentTimeMs: number;
  currentTimeSeconds: number;
  durationMs?: number;
  durationSeconds?: number;
}

export interface VdoPlayerEmbeddedRef {
  handleBackButtonClick: () => boolean;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  play: () => void;
  pause: () => void;
  seek: (ms: number) => void;
  setSpeed: (speed: SpeedPreset) => void;
  getSpeed: () => SpeedPreset;
}

export interface VdoPlayerEmbeddedProps {
  visible: boolean;
  embedInfo: VdoEmbedInfo | null;
  layout?: VdoPlayerLayout | null;
  title?: string;
  onProgress?: (progress: VdoPlayerProgressEvent) => void;
  onEnded?: () => void;
  onError?: (errorMessage: string) => void;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
  onPlaybackSpeedChanged?: (speed: number) => void;
}

export const VdoPlayerEmbedded = memo(
  forwardRef<VdoPlayerEmbeddedRef, VdoPlayerEmbeddedProps>(
    function VdoPlayerEmbedded(
      {
        visible,
        embedInfo,
        layout,
        title,
        onProgress,
        onEnded,
        onError,
        onEnterFullscreen,
        onExitFullscreen,
        onPlaybackSpeedChanged,
      },
      ref
    ) {
      const playerRef = useRef<any>(null);
      const [isFullscreen, setIsFullscreen] = useState(false);
      const [playerError, setPlayerError] = useState<string | null>(null);

      // Playback speed state (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x)
      const [currentSpeed, setCurrentSpeed] = useState<SpeedPreset>(1.0);

      // Tracking positions for seeking and progress
      const currentPositionMsRef = useRef(0);
      const durationMsRef = useRef(0);

      // Double-tap seeking state & refs
      const lastTapLeftRef = useRef(0);
      const lastTapRightRef = useRef(0);
      const [seekFeedback, setSeekFeedback] = useState<{
        direction: 'backward' | 'forward';
        amount: string;
      } | null>(null);
      const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
      );

      // Expose imperative control methods to parent
      useImperativeHandle(
        ref,
        () => ({
          handleBackButtonClick: () => {
            if (isFullscreen && playerRef.current?.handleBackButtonClick) {
              playerRef.current.handleBackButtonClick();
              return true;
            }
            return false;
          },
          enterFullscreen: () => {
            if (playerRef.current?.enterFullscreenV2) {
              playerRef.current.enterFullscreenV2();
            }
          },
          exitFullscreen: () => {
            if (playerRef.current?.exitFullscreenV2) {
              playerRef.current.exitFullscreenV2();
            }
          },
          play: () => {
            playerRef.current?.play?.();
          },
          pause: () => {
            playerRef.current?.pause?.();
          },
          seek: (ms: number) => {
            playerRef.current?.seek?.(ms);
            currentPositionMsRef.current = ms;
          },
          setSpeed: (speed: SpeedPreset) => {
            playerRef.current?.setPlaybackSpeed?.(speed);
            setCurrentSpeed(speed);
          },
          getSpeed: () => currentSpeed,
        }),
        [isFullscreen, currentSpeed]
      );

      // Reset error state and position tracking when credentials change
      useEffect(() => {
        if (visible) {
          setPlayerError(null);
          setSeekFeedback(null);
          durationMsRef.current = 0;
          currentPositionMsRef.current = embedInfo?.resumeTimeMs || 0;
        }
      }, [visible, embedInfo?.otp, embedInfo?.playbackInfo, embedInfo?.classId, embedInfo?.resumeTimeMs]);

      // Clean up seek feedback timer on unmount
      useEffect(() => {
        return () => {
          if (seekFeedbackTimerRef.current) {
            clearTimeout(seekFeedbackTimerRef.current);
          }
        };
      }, []);

      const handleProgress = useCallback(
        (event: { currentTime: number; duration?: number; totalTime?: number }) => {
          const currentTimeMs = typeof event?.currentTime === 'number' ? event.currentTime : 0;
          currentPositionMsRef.current = currentTimeMs;
          if (typeof event?.duration === 'number' && event.duration > 0) {
            durationMsRef.current = event.duration;
          } else if (typeof event?.totalTime === 'number' && event.totalTime > 0) {
            durationMsRef.current = event.totalTime;
          }
          if (onProgress) {
            onProgress({
              currentTimeMs,
              currentTimeSeconds: Math.round((currentTimeMs / 1000) * 100) / 100,
              durationMs: durationMsRef.current > 0 ? durationMsRef.current : undefined,
              durationSeconds:
                durationMsRef.current > 0
                  ? Math.round((durationMsRef.current / 1000) * 100) / 100
                  : undefined,
            });
          }
        },
        [onProgress]
      );

      const handleLoaded = useCallback((event: any) => {
        if (typeof event?.mediaInfo?.duration === 'number' && event.mediaInfo.duration > 0) {
          durationMsRef.current = event.mediaInfo.duration;
        } else if (typeof event?.duration === 'number' && event.duration > 0) {
          durationMsRef.current = event.duration;
        }
      }, []);

      const handleMediaEnded = useCallback(() => {
        if (onEnded) {
          onEnded();
        }
      }, [onEnded]);

      const handlePlaybackSpeedChanged = useCallback(
        (speed: number) => {
          if (typeof speed === 'number' && SPEED_PRESETS.includes(speed as SpeedPreset)) {
            setCurrentSpeed(speed as SpeedPreset);
            if (onPlaybackSpeedChanged) {
              onPlaybackSpeedChanged(speed);
            }
          }
        },
        [onPlaybackSpeedChanged]
      );

      const handleError = useCallback(
        (event: any) => {
          const errorDesc = event?.errorDescription;
          const safeErrorMsg = errorDesc
            ? `Error ${errorDesc.errorCode || 'unknown'}: ${errorDesc.errorMsg || 'Playback error'}`
            : typeof event?.errorMsg === 'string'
            ? event.errorMsg
            : typeof event?.message === 'string'
            ? event.message
            : 'Playback error occurred';

          console.warn('[VdoCipher Native] Embedded player error:', safeErrorMsg);
          setPlayerError(safeErrorMsg);
          if (onError) {
            onError(safeErrorMsg);
          }
        },
        [onError]
      );

      const handleEnterFullscreen = useCallback(() => {
        setIsFullscreen(true);
        if (onEnterFullscreen) {
          onEnterFullscreen();
        }
      }, [onEnterFullscreen]);

      const handleExitFullscreen = useCallback(() => {
        setIsFullscreen(false);
        if (onExitFullscreen) {
          onExitFullscreen();
        }
      }, [onExitFullscreen]);

      // Double-tap backward gesture (-10s)
      const handleLeftTap = useCallback(() => {
        const now = Date.now();
        const delta = now - lastTapLeftRef.current;
        lastTapLeftRef.current = now;

        if (delta < 300) {
          // Double-tap confirmed
          const currentMs = currentPositionMsRef.current;
          const targetMs = Math.max(0, currentMs - 10000);
          playerRef.current?.seek?.(targetMs);
          currentPositionMsRef.current = targetMs;

          if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
          setSeekFeedback({ direction: 'backward', amount: '-10s' });
          seekFeedbackTimerRef.current = setTimeout(() => {
            setSeekFeedback(null);
          }, 650);
        }
      }, []);

      // Double-tap forward gesture (+10s)
      const handleRightTap = useCallback(() => {
        const now = Date.now();
        const delta = now - lastTapRightRef.current;
        lastTapRightRef.current = now;

        if (delta < 300) {
          // Double-tap confirmed
          const currentMs = currentPositionMsRef.current;
          const durationMs = durationMsRef.current > 0 ? durationMsRef.current : Infinity;
          const targetMs = Math.min(durationMs, currentMs + 10000);
          playerRef.current?.seek?.(targetMs);
          currentPositionMsRef.current = targetMs;

          if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
          setSeekFeedback({ direction: 'forward', amount: '+10s' });
          seekFeedbackTimerRef.current = setTimeout(() => {
            setSeekFeedback(null);
          }, 650);
        }
      }, []);

      // Memoize embedInfo so stable object reference prevents repeated position resets on re-render
      const memoizedEmbedInfo = useMemo(() => {
        if (!embedInfo?.otp || !embedInfo?.playbackInfo) return null;
        return {
          otp: embedInfo.otp,
          playbackInfo: embedInfo.playbackInfo,
          resumeTimeMs: typeof embedInfo.resumeTimeMs === 'number' && embedInfo.resumeTimeMs > 0
            ? Math.round(embedInfo.resumeTimeMs)
            : undefined,
        };
      }, [embedInfo?.otp, embedInfo?.playbackInfo, embedInfo?.resumeTimeMs]);

      if (!visible || !memoizedEmbedInfo) {
        return null;
      }

      // Compute geometry: Use measured WebView layout coordinates if available,
      // otherwise fall back to responsive 16:9 aspect ratio docked at top.
      const screenWidth = Dimensions.get('window').width;
      const defaultHeight = Math.round((screenWidth / 16) * 9);

      // If layout specifies not visible (e.g. modal drawer open or scrolled off-screen)
      // and player is not in fullscreen, position completely off-screen with zero size
      // to guarantee native subviews cannot overlap web content.
      const isHidden = layout?.visible === false && !isFullscreen;

      const embeddedStyle: ViewStyle = isHidden
        ? {
            position: 'absolute',
            top: -9999,
            left: -9999,
            width: 0,
            height: 0,
            opacity: 0,
            zIndex: -1,
          }
        : layout && layout.width > 0 && layout.height > 0
        ? {
            position: 'absolute',
            top: layout.y,
            left: layout.x,
            width: layout.width,
            height: layout.height,
            opacity: 1,
            zIndex: 10,
          }
        : {
            position: 'absolute',
            top: 0,
            left: 0,
            width: screenWidth,
            height: defaultHeight,
            zIndex: 10,
          };

      const containerStyle = isFullscreen
        ? styles.fullscreenContainer
        : [styles.embeddedContainer, embeddedStyle];

      return (
        <View
          style={containerStyle}
          pointerEvents={isHidden ? 'none' : 'auto'}
        >
          {/* Native VdoCipher DRM Player View */}
          <VdoPlayerView
            ref={playerRef}
            style={styles.player}
            embedInfo={memoizedEmbedInfo}
            showNativeControls={true}
            autoPlay={true}
            onProgress={handleProgress}
            onLoaded={handleLoaded}
            onMediaEnded={handleMediaEnded}
            onPlaybackSpeedChanged={handlePlaybackSpeedChanged}
            onError={handleError}
            onLoadError={handleError}
            onInitializationFailure={handleError}
            onEnterFullscreen={handleEnterFullscreen}
            onExitFullscreen={handleExitFullscreen}
          />

          {/* Double-tap seek gesture detectors (Left 35% & Right 35%, leaving top and bottom controls clear) */}
          <View style={styles.gestureOverlay} pointerEvents="box-none">
            <Pressable
              style={styles.leftTouchZone}
              onPress={handleLeftTap}
              accessibilityLabel="Double-tap to rewind 10 seconds"
            />
            <Pressable
              style={styles.rightTouchZone}
              onPress={handleRightTap}
              accessibilityLabel="Double-tap to forward 10 seconds"
            />
          </View>

          {/* Minimal Apple-Style Double-Tap Seek Feedback Indicator */}
          {seekFeedback && (
            <View
              style={[
                styles.seekFeedbackContainer,
                seekFeedback.direction === 'backward'
                  ? styles.seekFeedbackLeft
                  : styles.seekFeedbackRight,
              ]}
              pointerEvents="none"
            >
              <View style={styles.seekFeedbackBubble}>
                <Text style={styles.seekFeedbackIcon}>
                  {seekFeedback.direction === 'backward' ? '⟲' : '⟳'}
                </Text>
                <Text style={styles.seekFeedbackText}>{seekFeedback.amount}</Text>
              </View>
            </View>
          )}

          {/* Error Notification Overlay */}
          {playerError && (
            <View style={styles.errorOverlay} pointerEvents="none">
              <Text style={styles.errorText} numberOfLines={2}>
                {playerError}
              </Text>
            </View>
          )}
        </View>
      );
    }
  )
);

const styles = StyleSheet.create({
  embeddedContainer: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderRadius: 16,
  },
  fullscreenContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    zIndex: 9999,
  },
  player: {
    width: '100%',
    height: '100%',
  },
  gestureOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 15,
  },
  leftTouchZone: {
    width: '32%',
    height: '70%',
    marginTop: '15%',
    backgroundColor: 'transparent',
  },
  rightTouchZone: {
    width: '32%',
    height: '70%',
    marginTop: '15%',
    backgroundColor: 'transparent',
  },
  seekFeedbackContainer: {
    position: 'absolute',
    top: '36%',
    zIndex: 25,
  },
  seekFeedbackLeft: {
    left: '12%',
  },
  seekFeedbackRight: {
    right: '12%',
  },
  seekFeedbackBubble: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(7, 11, 20, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  seekFeedbackIcon: {
    color: '#2DD4BF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  seekFeedbackText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  errorOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
