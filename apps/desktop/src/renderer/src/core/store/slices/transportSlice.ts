/* eslint-disable no-unused-vars */
import type { StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

interface TransportSliceDeps {
  clampTime(seconds: number, timeline: StudioState['timeline']): number;
  getTimelineEnd(timeline: StudioState['timeline']): number;
}

type TransportSliceKeys =
  | 'currentTime'
  | 'isPlaying'
  | 'setCurrentTime'
  | 'togglePlayback'
  | 'stopPlayback'
  | 'stepPlayback';

export function createTransportSlice(
  set: StoreSet<StudioState>,
  _get: StoreGet<StudioState>,
  deps: TransportSliceDeps,
): Pick<StudioState, TransportSliceKeys> {
  return {
    currentTime: 0,
    isPlaying: false,

    setCurrentTime: (seconds) =>
      set((state) => ({
        currentTime: deps.clampTime(seconds, state.timeline),
      })),

    togglePlayback: () =>
      set((state) => {
        if (state.isPlaying) {
          return { isPlaying: false };
        }

        const timelineEnd = deps.getTimelineEnd(state.timeline);
        if (timelineEnd <= 0) {
          return state;
        }

        const currentTime = state.currentTime >= timelineEnd ? 0 : state.currentTime;
        return { isPlaying: true, currentTime };
      }),

    stopPlayback: () =>
      set({
        isPlaying: false,
      }),

    stepPlayback: (deltaSeconds) =>
      set((state) => {
        if (!state.isPlaying) {
          return state;
        }

        const timelineEnd = deps.getTimelineEnd(state.timeline);
        if (timelineEnd <= 0) {
          return { isPlaying: false, currentTime: 0 };
        }

        const nextTime = state.currentTime + Math.max(0, deltaSeconds);
        if (nextTime >= timelineEnd) {
          return { isPlaying: false, currentTime: timelineEnd };
        }

        return { currentTime: nextTime };
      }),
  };
}
