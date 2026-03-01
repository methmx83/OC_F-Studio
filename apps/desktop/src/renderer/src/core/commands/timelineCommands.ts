/* eslint-disable no-unused-vars */
import type { Clip, Timeline } from '@shared/types';

import {
  addClipToTrack,
  cutClip,
  moveClip,
  removeClipFromTrack,
  rippleRemoveClip,
  slipClip,
  trimClip,
  type AddClipParams,
  type CutClipParams,
  type MoveClipParams,
  type RemoveClipParams,
  type RippleRemoveClipParams,
  type SlipClipParams,
  type TrimClipParams,
} from '../engine';
import { NotFoundError } from '../engine';

export type TimelineCommandType =
  | 'timeline/add-clip'
  | 'timeline/move-clip'
  | 'timeline/remove-clip'
  | 'timeline/ripple-remove-clip'
  | 'timeline/slip-clip'
  | 'timeline/trim-clip'
  | 'timeline/cut-clip';

export interface TimelineCommand {
  readonly type: TimelineCommandType;
  execute: (timeline: Timeline) => Timeline;
  undo: (timeline: Timeline) => Timeline;
}

export interface TimelineCommandHistory {
  readonly past: readonly TimelineCommand[];
  readonly future: readonly TimelineCommand[];
}

export interface CommandExecutionResult {
  readonly timeline: Timeline;
  readonly history: TimelineCommandHistory;
}

export function createEmptyCommandHistory(): TimelineCommandHistory {
  return {
    past: [],
    future: [],
  };
}

export function executeTimelineCommand(
  timeline: Timeline,
  history: TimelineCommandHistory,
  command: TimelineCommand,
): CommandExecutionResult {
  const nextTimeline = command.execute(timeline);
  return {
    timeline: nextTimeline,
    history: {
      past: [...history.past, command],
      future: [],
    },
  };
}

export function undoTimelineCommand(
  timeline: Timeline,
  history: TimelineCommandHistory,
): CommandExecutionResult | null {
  if (history.past.length === 0) {
    return null;
  }

  const command = history.past[history.past.length - 1];
  const nextTimeline = command.undo(timeline);
  return {
    timeline: nextTimeline,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, command],
    },
  };
}

export function redoTimelineCommand(
  timeline: Timeline,
  history: TimelineCommandHistory,
): CommandExecutionResult | null {
  if (history.future.length === 0) {
    return null;
  }

  const command = history.future[history.future.length - 1];
  const nextTimeline = command.execute(timeline);
  return {
    timeline: nextTimeline,
    history: {
      past: [...history.past, command],
      future: history.future.slice(0, -1),
    },
  };
}

export function createAddClipCommand(params: AddClipParams): TimelineCommand {
  return {
    type: 'timeline/add-clip',
    execute: (timeline) => addClipToTrack(timeline, params),
    undo: (timeline) =>
      removeClipFromTrack(timeline, {
        trackId: params.trackId,
        clipId: params.clip.id,
      }),
  };
}

export function createMoveClipCommand(timeline: Timeline, params: MoveClipParams): TimelineCommand {
  const sourceTrack = getTrackOrThrow(timeline, params.sourceTrackId);
  const sourceClip = getClipOrThrow(sourceTrack.clips, params.clipId);

  const originalSourceTrackId = params.sourceTrackId;
  const originalTargetTrackId = params.targetTrackId ?? params.sourceTrackId;
  const originalStart = sourceClip.start;

  return {
    type: 'timeline/move-clip',
    execute: (currentTimeline) => moveClip(currentTimeline, params),
    undo: (currentTimeline) => {
      if (originalSourceTrackId === originalTargetTrackId) {
        return moveClip(currentTimeline, {
          sourceTrackId: originalSourceTrackId,
          clipId: params.clipId,
          start: originalStart,
        });
      }

      return moveClip(currentTimeline, {
        sourceTrackId: originalTargetTrackId,
        targetTrackId: originalSourceTrackId,
        clipId: params.clipId,
        start: originalStart,
      });
    },
  };
}

export function createRemoveClipCommand(timeline: Timeline, params: RemoveClipParams): TimelineCommand {
  const track = getTrackOrThrow(timeline, params.trackId);
  const removedClip = cloneClip(getClipOrThrow(track.clips, params.clipId));

  return {
    type: 'timeline/remove-clip',
    execute: (currentTimeline) => removeClipFromTrack(currentTimeline, params),
    undo: (currentTimeline) =>
      addClipToTrack(currentTimeline, {
        trackId: params.trackId,
        clip: removedClip,
      }),
  };
}

export function createRippleRemoveClipCommand(timeline: Timeline, params: RippleRemoveClipParams): TimelineCommand {
  const nextTimeline = rippleRemoveClip(timeline, params);
  const originalTimeline = cloneTimeline(timeline);

  return {
    type: 'timeline/ripple-remove-clip',
    execute: () => nextTimeline,
    undo: () => originalTimeline,
  };
}

export function createTrimClipCommand(timeline: Timeline, params: TrimClipParams): TimelineCommand {
  const track = getTrackOrThrow(timeline, params.trackId);
  getClipOrThrow(track.clips, params.clipId);

  const startDelta = params.startDelta ?? 0;
  const endDelta = params.endDelta ?? 0;

  return {
    type: 'timeline/trim-clip',
    execute: (currentTimeline) =>
      trimClip(currentTimeline, {
        trackId: params.trackId,
        clipId: params.clipId,
        startDelta,
        endDelta,
      }),
    undo: (currentTimeline) =>
      trimClip(currentTimeline, {
        trackId: params.trackId,
        clipId: params.clipId,
        startDelta: -startDelta,
        endDelta: -endDelta,
      }),
  };
}

export function createSlipClipCommand(timeline: Timeline, params: SlipClipParams): TimelineCommand {
  const track = getTrackOrThrow(timeline, params.trackId);
  const clip = getClipOrThrow(track.clips, params.clipId);
  const originalOffset = clip.offset;

  return {
    type: 'timeline/slip-clip',
    execute: (currentTimeline) =>
      slipClip(currentTimeline, {
        trackId: params.trackId,
        clipId: params.clipId,
        offset: params.offset,
      }),
    undo: (currentTimeline) =>
      slipClip(currentTimeline, {
        trackId: params.trackId,
        clipId: params.clipId,
        offset: originalOffset,
      }),
  };
}

export function createCutClipCommand(timeline: Timeline, params: CutClipParams): TimelineCommand {
  const track = getTrackOrThrow(timeline, params.trackId);
  const originalClip = cloneClip(getClipOrThrow(track.clips, params.clipId));
  const leftClipId = params.leftClipId ?? createCommandClipId(params.clipId, 'left');
  const rightClipId = params.rightClipId ?? createCommandClipId(params.clipId, 'right');

  return {
    type: 'timeline/cut-clip',
    execute: (currentTimeline) =>
      cutClip(currentTimeline, {
        ...params,
        leftClipId,
        rightClipId,
      }),
    undo: (currentTimeline) => {
      const timelineWithoutLeft = removeClipFromTrack(currentTimeline, {
        trackId: params.trackId,
        clipId: leftClipId,
      });
      const timelineWithoutSplit = removeClipFromTrack(timelineWithoutLeft, {
        trackId: params.trackId,
        clipId: rightClipId,
      });
      return addClipToTrack(timelineWithoutSplit, {
        trackId: params.trackId,
        clip: originalClip,
      });
    },
  };
}

function getTrackOrThrow(timeline: Timeline, trackId: string) {
  const track = timeline.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    throw new NotFoundError('track', trackId);
  }

  return track;
}

function getClipOrThrow(clips: readonly Clip[], clipId: string): Clip {
  const clip = clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new NotFoundError('clip', clipId);
  }

  return clip;
}

function cloneClip(clip: Clip): Clip {
  return {
    id: clip.id,
    assetId: clip.assetId,
    start: clip.start,
    duration: clip.duration,
    offset: clip.offset,
    gain: clip.gain,
    automation: clip.automation
      ? {
          gain: clip.automation.gain?.map((point) => ({ ...point })),
        }
      : undefined,
  };
}

function createCommandClipId(clipId: string, side: 'left' | 'right'): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto !== 'undefined' && typeof webCrypto.randomUUID === 'function') {
    return `${clipId}_${side}_${webCrypto.randomUUID()}`;
  }

  return `${clipId}_${side}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneTimeline(timeline: Timeline): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => cloneClip(clip)),
    })),
  };
}
