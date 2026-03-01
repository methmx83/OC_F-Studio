import type { StudioState } from '../studioStore';

export const selectPreviewStageStoreState = (state: StudioState) => ({
  proxyMode: state.proxyMode,
  annotating: state.annotating,
  timeline: state.timeline,
  assets: state.assets,
  isPlaying: state.isPlaying,
  currentTime: state.currentTime,
  proxyPathByAssetId: state.proxyPathByAssetId,
  proxyPendingByAssetId: state.proxyPendingByAssetId,
  ffmpegStatus: state.ffmpegStatus,
  toggleProxyMode: state.toggleProxyMode,
  toggleAnnotating: state.toggleAnnotating,
  togglePlayback: state.togglePlayback,
  setCurrentTime: state.setCurrentTime,
  stepPlayback: state.stepPlayback,
  ensureVideoProxy: state.ensureVideoProxy,
  trackAudioMutedById: state.trackAudioMutedById,
  trackAudioSoloById: state.trackAudioSoloById,
});
