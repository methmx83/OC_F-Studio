/* eslint-disable no-unused-vars */
import type { Clip } from '@shared/types';
import {
  createAddClipCommand,
  createCutClipCommand,
  createEmptyCommandHistory,
  createMoveClipCommand,
  createRemoveClipCommand,
  createRippleRemoveClipCommand,
  createSlipClipCommand,
  createTrimClipCommand,
  executeTimelineCommand,
  redoTimelineCommand,
  undoTimelineCommand,
  type CommandExecutionResult,
} from '../../commands';
import { createTrack } from '../../model';
import type { SelectedClip, StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

interface TimelineSliceDeps {
  createId(prefix: string): string;
  toErrorMessage(error: unknown): string;
  resolveInitialClipDuration(asset: StudioState['assets'][number]): number;
  getTrackOrThrow: (timeline: StudioState['timeline'], trackId: string) => StudioState['timeline']['tracks'][number];
  getClipOrThrow: (
    clips: readonly StudioState['timeline']['tracks'][number]['clips'][number][],
    clipId: string,
  ) => StudioState['timeline']['tracks'][number]['clips'][number];
  toTimelineHistoryState: (
    state: StudioState,
    execution: CommandExecutionResult,
  ) => Partial<StudioState>;
  sanitizeSelection: (timeline: StudioState['timeline'], selectedClip: SelectedClip | null) => SelectedClip | null;
}

type TimelineSliceKeys =
  | 'pastCount'
  | 'futureCount'
  | 'timeline'
  | 'timelineCommandHistory'
  | 'selectedClip'
  | 'droppedAssetIds'
  | 'addTrack'
  | 'dropAssetToTimeline'
  | 'timelineAddClip'
  | 'timelineMoveClip'
  | 'timelineRemoveClip'
  | 'timelineRippleRemoveClip'
  | 'timelineTrimClip'
  | 'timelineSlipClip'
  | 'timelineCutClip'
  | 'selectClip'
  | 'clearClipSelection'
  | 'nudgeSelectedClip'
  | 'trimSelectedClip'
  | 'slipSelectedClip'
  | 'setSelectedClipGain'
  | 'setSelectedClipGainAutomation'
  | 'cutSelectedClipAtCurrentTime'
  | 'removeSelectedClip'
  | 'rippleRemoveSelectedClip'
  | 'undoUi'
  | 'redoUi';

const INITIAL_TIMELINE = {
  tracks: [
    { id: 't1', name: 'Video Track', kind: 'video', clips: [] },
    { id: 't2', name: 'Overlay', kind: 'overlay', clips: [] },
    { id: 't3', name: 'Audio', kind: 'audio', clips: [] },
  ],
} as const satisfies Pick<StudioState, 'timeline'>['timeline'];

export function createTimelineSlice(
  set: StoreSet<StudioState>,
  get: StoreGet<StudioState>,
  deps: TimelineSliceDeps,
): Pick<StudioState, TimelineSliceKeys> {
  const slice: Pick<StudioState, TimelineSliceKeys> = {
    pastCount: 0,
    futureCount: 0,
    timeline: INITIAL_TIMELINE,
    timelineCommandHistory: createEmptyCommandHistory(),
    selectedClip: null,
    droppedAssetIds: [],

    addTrack: (kind = 'video') =>
      set((state) => {
        const nextTrack = createTrack({ kind });
        const nextTimeline = {
          ...state.timeline,
          tracks: [...state.timeline.tracks, nextTrack],
        };

        return {
          timeline: nextTimeline,
          project: state.project ? { ...state.project, timeline: nextTimeline } : state.project,
          isDirty: state.project ? true : state.isDirty,
          lastError: null,
        };
      }),

    dropAssetToTimeline: (assetId, trackId) =>
      set((state) => {
        const asset = state.assets.find((candidate) => candidate.id === assetId);
        if (!asset) {
          return { lastError: `Asset "${assetId}" not found.` };
        }

        try {
          const preferredTrackKind = asset.type === 'image' ? 'overlay' : asset.type === 'audio' ? 'audio' : 'video';
          const explicitTrack = trackId
            ? state.timeline.tracks.find((track) => track.id === trackId)
            : null;
          const targetTrack =
            (explicitTrack && explicitTrack.kind === preferredTrackKind ? explicitTrack : null)
            ?? state.timeline.tracks.find((track) => track.kind === preferredTrackKind)
            ?? state.timeline.tracks.find((track) => track.kind === 'video')
            ?? state.timeline.tracks[0];

          if (!targetTrack) {
            return { lastError: 'No track available. Add a track first.' };
          }

          const maxEnd = targetTrack.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
          const clip: Clip = {
            id: deps.createId('clip'),
            assetId,
            start: maxEnd,
            duration: deps.resolveInitialClipDuration(asset),
            offset: 0,
            gain: 1,
          };

          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createAddClipCommand({
              trackId: targetTrack.id,
              clip,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            droppedAssetIds: [assetId, ...state.droppedAssetIds].slice(0, 10),
            selectedClip: { trackId: targetTrack.id, clipId: clip.id },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineAddClip: (trackId, clip) =>
      set((state) => {
        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createAddClipCommand({ trackId, clip }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId, clipId: clip.id },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineMoveClip: (params) =>
      set((state) => {
        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createMoveClipCommand(state.timeline, params),
          );

          const selectedTrackId = params.targetTrackId ?? params.sourceTrackId;
          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: selectedTrackId, clipId: params.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineRemoveClip: (params) =>
      set((state) => {
        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createRemoveClipCommand(state.timeline, params),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: null,
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineRippleRemoveClip: (params) =>
      set((state) => {
        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createRippleRemoveClipCommand(state.timeline, params),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: null,
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineTrimClip: (params) =>
      set((state) => {
        try {
          const track = deps.getTrackOrThrow(state.timeline, params.trackId);
          const clip = deps.getClipOrThrow(track.clips, params.clipId);
          const asset = state.assets.find((candidate) => candidate.id === clip.assetId);

          const startDelta = params.startDelta ?? 0;
          let endDelta = params.endDelta ?? 0;
          const hasFiniteSourceDuration = asset
            && (asset.type === 'video' || asset.type === 'audio')
            && typeof asset.durationSeconds === 'number'
            && Number.isFinite(asset.durationSeconds)
            && asset.durationSeconds > 0;

          if (hasFiniteSourceDuration && typeof asset?.durationSeconds === 'number') {
            const maxDuration = Math.max(0.05, asset.durationSeconds - clip.offset - startDelta);
            const requestedDuration = clip.duration - startDelta - endDelta;
            if (requestedDuration > maxDuration) {
              endDelta = clip.duration - startDelta - maxDuration;
            }
          }

          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createTrimClipCommand(state.timeline, {
              ...params,
              endDelta,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: params.trackId, clipId: params.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineSlipClip: (params) =>
      set((state) => {
        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createSlipClipCommand(state.timeline, params),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: params.trackId, clipId: params.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    timelineCutClip: (params) =>
      set((state) => {
        try {
          const leftClipId = params.leftClipId ?? deps.createId('clip');
          const rightClipId = params.rightClipId ?? deps.createId('clip');
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createCutClipCommand(state.timeline, {
              ...params,
              leftClipId,
              rightClipId,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: params.trackId, clipId: rightClipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    selectClip: (trackId, clipId) => set({ selectedClip: { trackId, clipId } }),
    clearClipSelection: () => set({ selectedClip: null }),

    nudgeSelectedClip: (deltaSeconds) =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const track = deps.getTrackOrThrow(state.timeline, selected.trackId);
          const clip = deps.getClipOrThrow(track.clips, selected.clipId);

          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createMoveClipCommand(state.timeline, {
              sourceTrackId: selected.trackId,
              clipId: selected.clipId,
              start: Math.max(0, clip.start + deltaSeconds),
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: selected.trackId, clipId: selected.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    trimSelectedClip: (startDelta = 0, endDelta = 0) =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const track = deps.getTrackOrThrow(state.timeline, selected.trackId);
          const clip = deps.getClipOrThrow(track.clips, selected.clipId);
          const asset = state.assets.find((candidate) => candidate.id === clip.assetId);

          let boundedEndDelta = endDelta;
          const hasFiniteSourceDuration = asset
            && (asset.type === 'video' || asset.type === 'audio')
            && typeof asset.durationSeconds === 'number'
            && Number.isFinite(asset.durationSeconds)
            && asset.durationSeconds > 0;

          if (hasFiniteSourceDuration && typeof asset?.durationSeconds === 'number') {
            const maxDuration = Math.max(0.05, asset.durationSeconds - clip.offset - startDelta);
            const requestedDuration = clip.duration - startDelta - endDelta;
            if (requestedDuration > maxDuration) {
              boundedEndDelta = clip.duration - startDelta - maxDuration;
            }
          }

          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createTrimClipCommand(state.timeline, {
              trackId: selected.trackId,
              clipId: selected.clipId,
              startDelta,
              endDelta: boundedEndDelta,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: selected.trackId, clipId: selected.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    slipSelectedClip: (deltaSeconds) =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const track = deps.getTrackOrThrow(state.timeline, selected.trackId);
          const clip = deps.getClipOrThrow(track.clips, selected.clipId);
          const asset = state.assets.find((candidate) => candidate.id === clip.assetId);

          const maxOffset = asset
            && (asset.type === 'video' || asset.type === 'audio')
            && typeof asset.durationSeconds === 'number'
            && Number.isFinite(asset.durationSeconds)
            && asset.durationSeconds > 0
            ? Math.max(0, asset.durationSeconds - clip.duration)
            : null;

          if (maxOffset !== null && maxOffset <= 1e-9) {
            return {
              lastError: 'Slip not possible: clip already uses full source duration. Trim or cut the clip first.',
            };
          }

          const rawOffset = clip.offset + deltaSeconds;
          const boundedOffset = maxOffset === null
            ? Math.max(0, rawOffset)
            : Math.max(0, Math.min(rawOffset, maxOffset));
          const nextOffset = Math.round(boundedOffset * 1000) / 1000;

          if (Math.abs(nextOffset - clip.offset) < 1e-9) {
            return state;
          }

          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createSlipClipCommand(state.timeline, {
              trackId: selected.trackId,
              clipId: selected.clipId,
              offset: nextOffset,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: selected.trackId, clipId: selected.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    setSelectedClipGain: (gain) =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const trackIndex = state.timeline.tracks.findIndex((track) => track.id === selected.trackId);
          if (trackIndex < 0) {
            return { lastError: `Track "${selected.trackId}" not found.` };
          }

          const track = state.timeline.tracks[trackIndex];
          const clipIndex = track.clips.findIndex((clip) => clip.id === selected.clipId);
          if (clipIndex < 0) {
            return { lastError: `Clip "${selected.clipId}" not found.` };
          }

          const nextGain = Math.max(0, Math.min(2, Math.round(gain * 100) / 100));
          const clip = track.clips[clipIndex];
          if (Math.abs((clip.gain ?? 1) - nextGain) < 1e-9) {
            return state;
          }

          const nextClips = [...track.clips];
          nextClips[clipIndex] = {
            ...clip,
            gain: nextGain,
          };

          const nextTrack = {
            ...track,
            clips: nextClips,
          };
          const nextTracks = [...state.timeline.tracks];
          nextTracks[trackIndex] = nextTrack;
          const nextTimeline = {
            ...state.timeline,
            tracks: nextTracks,
          };

          return {
            timeline: nextTimeline,
            project: state.project ? { ...state.project, timeline: nextTimeline } : state.project,
            isDirty: state.project ? true : state.isDirty,
            selectedClip: { trackId: selected.trackId, clipId: selected.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    setSelectedClipGainAutomation: (points) =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const trackIndex = state.timeline.tracks.findIndex((track) => track.id === selected.trackId);
          if (trackIndex < 0) {
            return { lastError: `Track "${selected.trackId}" not found.` };
          }

          const track = state.timeline.tracks[trackIndex];
          const clipIndex = track.clips.findIndex((clip) => clip.id === selected.clipId);
          if (clipIndex < 0) {
            return { lastError: `Clip "${selected.clipId}" not found.` };
          }

          const sanitizedPoints = points
            .map((point) => ({
              time: Math.max(0, Math.round(point.time * 1000) / 1000),
              value: Math.max(0, Math.min(2, Math.round(point.value * 1000) / 1000)),
            }))
            .sort((left, right) => left.time - right.time);

          const clip = track.clips[clipIndex];
          const nextClips = [...track.clips];
          nextClips[clipIndex] = {
            ...clip,
            automation: {
              ...(clip.automation ?? {}),
              gain: sanitizedPoints,
            },
          };

          const nextTrack = {
            ...track,
            clips: nextClips,
          };
          const nextTracks = [...state.timeline.tracks];
          nextTracks[trackIndex] = nextTrack;
          const nextTimeline = {
            ...state.timeline,
            tracks: nextTracks,
          };

          return {
            timeline: nextTimeline,
            project: state.project ? { ...state.project, timeline: nextTimeline } : state.project,
            isDirty: state.project ? true : state.isDirty,
            selectedClip: { trackId: selected.trackId, clipId: selected.clipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    cutSelectedClipAtCurrentTime: () =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const track = deps.getTrackOrThrow(state.timeline, selected.trackId);
          const clip = deps.getClipOrThrow(track.clips, selected.clipId);
          const clipEnd = clip.start + clip.duration;
          const cutTime = state.currentTime;
          const cutEpsilon = 1e-6;

          if (cutTime <= clip.start + cutEpsilon || cutTime >= clipEnd - cutEpsilon) {
            return { lastError: 'Cut requires playhead inside selected clip bounds.' };
          }

          const leftClipId = deps.createId('clip');
          const rightClipId = deps.createId('clip');
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createCutClipCommand(state.timeline, {
              trackId: selected.trackId,
              clipId: selected.clipId,
              cutTime,
              leftClipId,
              rightClipId,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: { trackId: selected.trackId, clipId: rightClipId },
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    removeSelectedClip: () =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createRemoveClipCommand(state.timeline, {
              trackId: selected.trackId,
              clipId: selected.clipId,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: null,
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    rippleRemoveSelectedClip: () =>
      set((state) => {
        const selected = state.selectedClip;
        if (!selected) {
          return state;
        }

        try {
          const execution = executeTimelineCommand(
            state.timeline,
            state.timelineCommandHistory,
            createRippleRemoveClipCommand(state.timeline, {
              trackId: selected.trackId,
              clipId: selected.clipId,
            }),
          );

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: null,
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    undoUi: () =>
      set((state) => {
        try {
          const execution = undoTimelineCommand(state.timeline, state.timelineCommandHistory);
          if (!execution) {
            return state;
          }

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: deps.sanitizeSelection(execution.timeline, state.selectedClip),
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),

    redoUi: () =>
      set((state) => {
        try {
          const execution = redoTimelineCommand(state.timeline, state.timelineCommandHistory);
          if (!execution) {
            return state;
          }

          return {
            ...deps.toTimelineHistoryState(state, execution),
            selectedClip: deps.sanitizeSelection(execution.timeline, state.selectedClip),
            lastError: null,
          };
        } catch (error) {
          return { lastError: deps.toErrorMessage(error) };
        }
      }),
  };

  return slice;
}
