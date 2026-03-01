import type { Asset, Clip, Timeline, Track } from '@shared/types';

import type { CommandExecutionResult } from '../../commands';
import { NotFoundError } from '../../engine';
import type { SelectedClip, StudioState } from '../studioStore';

export function toTimelineHistoryState(state: StudioState, execution: CommandExecutionResult): Partial<StudioState> {
  return {
    timeline: execution.timeline,
    timelineCommandHistory: execution.history,
    pastCount: execution.history.past.length,
    futureCount: execution.history.future.length,
    project: state.project ? { ...state.project, timeline: execution.timeline } : state.project,
    isDirty: state.project ? true : state.isDirty,
    currentTime: clampTime(state.currentTime, execution.timeline),
  };
}

export function sanitizeSelection(timeline: Timeline, selectedClip: SelectedClip | null): SelectedClip | null {
  if (!selectedClip) {
    return null;
  }

  try {
    const track = getTrackOrThrow(timeline, selectedClip.trackId);
    getClipOrThrow(track.clips, selectedClip.clipId);
    return selectedClip;
  } catch {
    return null;
  }
}

export function getTrackOrThrow(timeline: Timeline, trackId: string): Track {
  const track = timeline.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    throw new NotFoundError('track', trackId);
  }

  return track;
}

export function getClipOrThrow(clips: readonly Clip[], clipId: string): Clip {
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new NotFoundError('clip', clipId);
  }

  return clip;
}

export function resolveInitialClipDuration(asset: Asset): number {
  if (asset.type === 'image') {
    return 3;
  }

  if (typeof asset.durationSeconds === 'number' && Number.isFinite(asset.durationSeconds) && asset.durationSeconds > 0) {
    return asset.durationSeconds;
  }

  return asset.type === 'audio' ? 10 : 5;
}

export function getTimelineEnd(timeline: Timeline): number {
  let maxEnd = 0;
  timeline.tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      maxEnd = Math.max(maxEnd, clip.start + clip.duration);
    });
  });
  return maxEnd;
}

export function clampTime(seconds: number, timeline: Timeline): number {
  const end = getTimelineEnd(timeline);
  const bounded = Math.max(0, seconds);
  if (end <= 0) {
    return 0;
  }

  return Math.min(bounded, end);
}
