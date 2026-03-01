/* eslint-disable no-unused-vars */
import type { StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

type PreviewSliceKeys =
  | 'proxyMode'
  | 'annotating'
  | 'trackAudioMutedById'
  | 'trackAudioSoloById'
  | 'toggleProxyMode'
  | 'toggleAnnotating'
  | 'toggleTrackAudioMute'
  | 'toggleTrackAudioSolo'
  | 'clearTrackAudioMixStates';

export function createPreviewSlice(
  set: StoreSet<StudioState>,
  _get: StoreGet<StudioState>,
): Pick<StudioState, PreviewSliceKeys> {
  return {
    proxyMode: true,
    annotating: false,
    trackAudioMutedById: {},
    trackAudioSoloById: {},

    toggleProxyMode: () => set((state) => ({ proxyMode: !state.proxyMode })),
    toggleAnnotating: () => set((state) => ({ annotating: !state.annotating })),
    toggleTrackAudioMute: (trackId) => set((state) => ({
      trackAudioMutedById: {
        ...state.trackAudioMutedById,
        [trackId]: !state.trackAudioMutedById[trackId],
      },
    })),
    toggleTrackAudioSolo: (trackId) => set((state) => ({
      trackAudioSoloById: {
        ...state.trackAudioSoloById,
        [trackId]: !state.trackAudioSoloById[trackId],
      },
    })),
    clearTrackAudioMixStates: () => set({
      trackAudioMutedById: {},
      trackAudioSoloById: {},
    }),
  };
}
