import React, { memo } from 'react';
import {
  VdoPlayerEmbedded,
  type VdoEmbedInfo,
  type VdoPlayerEmbeddedProps,
  type VdoPlayerLayout,
} from './vdo-player-embedded';

export {
  VdoPlayerEmbedded,
  type VdoEmbedInfo,
  type VdoPlayerEmbeddedProps,
  type VdoPlayerLayout,
};

export interface VdoPlayerModalProps {
  visible: boolean;
  embedInfo: VdoEmbedInfo | null;
  layout?: VdoPlayerLayout | null;
  title?: string;
  onClose?: () => void;
  onProgress?: (progress: any) => void;
  onEnded?: () => void;
  onError?: (errorMessage: string) => void;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

/**
 * Backwards-compatible facade that delegates to the embedded native player.
 * No longer wraps VdoPlayerView in a full-screen Modal or popup.
 */
export const VdoPlayerModal = memo(function VdoPlayerModal({
  visible,
  embedInfo,
  layout,
  title,
  onProgress,
  onEnded,
  onError,
  onEnterFullscreen,
  onExitFullscreen,
}: VdoPlayerModalProps) {
  return (
    <VdoPlayerEmbedded
      visible={visible}
      embedInfo={embedInfo}
      layout={layout}
      title={title}
      onProgress={onProgress}
      onEnded={onEnded}
      onError={onError}
      onEnterFullscreen={onEnterFullscreen}
      onExitFullscreen={onExitFullscreen}
    />
  );
});
