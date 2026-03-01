import type { Clip, Timeline, Track } from '@shared/types';

import { ValidationError, type ValidationIssue } from '../model/errors';

export interface AddClipParams {
  trackId: string;
  clip: Clip;
}

export interface MoveClipParams {
  sourceTrackId: string;
  clipId: string;
  start: number;
  targetTrackId?: string;
}

export interface RemoveClipParams {
  trackId: string;
  clipId: string;
}

export interface RippleRemoveClipParams {
  trackId: string;
  clipId: string;
}

export interface TrimClipParams {
  trackId: string;
  clipId: string;
  startDelta?: number;
  endDelta?: number;
}

export interface SlipClipParams {
  trackId: string;
  clipId: string;
  offset: number;
}

export interface CutClipParams {
  trackId: string;
  clipId: string;
  cutTime: number;
  leftClipId?: string;
  rightClipId?: string;
}

export interface ClipLocation {
  trackId: string;
  trackIndex: number;
  clipIndex: number;
}

export interface ClipOverlap {
  clipId: string;
  otherClipId: string;
}

const CUT_EPSILON = 1e-6;
const RIPPLE_EPSILON = 1e-6;

export class NotFoundError extends Error {
  public readonly kind: 'track' | 'clip';
  public readonly id: string;

  public constructor(kind: 'track' | 'clip', id: string, message?: string) {
    super(message ?? `${kind} "${id}" not found.`);
    this.name = 'NotFoundError';
    this.kind = kind;
    this.id = id;
  }
}

export class OverlapError extends Error {
  public readonly trackId: string;
  public readonly clipId: string;
  public readonly conflictingClipIds: readonly string[];

  public constructor(trackId: string, clipId: string, conflictingClipIds: string[]) {
    super(`Clip "${clipId}" overlaps in track "${trackId}".`);
    this.name = 'OverlapError';
    this.trackId = trackId;
    this.clipId = clipId;
    this.conflictingClipIds = conflictingClipIds;
  }
}

export function addClipToTrack(timeline: Timeline, params: AddClipParams): Timeline {
  validateTimelineOrThrow(timeline);
  validateClipOrThrow(params.clip);

  const trackIndex = getTrackIndexOrThrow(timeline, params.trackId);
  const track = timeline.tracks[trackIndex];

  if (findClipLocation(timeline, params.clip.id) !== null) {
    throw new ValidationError('Clip id must be unique across timeline.', [
      { field: 'clip.id', message: `Clip "${params.clip.id}" already exists.` },
    ]);
  }

  ensureNoOverlap(track, params.clip);

  const nextTrack: Track = {
    ...track,
    clips: sortClipsByStart([...track.clips, cloneClip(params.clip)]),
  };

  return replaceTrackAtIndex(timeline, trackIndex, nextTrack);
}

export function moveClip(timeline: Timeline, params: MoveClipParams): Timeline {
  validateTimelineOrThrow(timeline);
  validateNumberField('start', params.start, { min: 0, required: true });

  const sourceTrackIndex = getTrackIndexOrThrow(timeline, params.sourceTrackId);
  const sourceTrack = timeline.tracks[sourceTrackIndex];
  const sourceClipIndex = getClipIndexOrThrow(sourceTrack, params.clipId);
  const sourceClip = sourceTrack.clips[sourceClipIndex];

  const targetTrackId = params.targetTrackId ?? params.sourceTrackId;
  const targetTrackIndex = getTrackIndexOrThrow(timeline, targetTrackId);
  const targetTrack = timeline.tracks[targetTrackIndex];

  const movedClip: Clip = {
    ...sourceClip,
    start: params.start,
  };
  validateClipOrThrow(movedClip);

  if (sourceTrackIndex === targetTrackIndex) {
    const remaining = sourceTrack.clips.filter((clip) => clip.id !== sourceClip.id);
    ensureNoOverlapWithClips(targetTrack.id, remaining, movedClip);

    const nextTrack: Track = {
      ...sourceTrack,
      clips: sortClipsByStart([...remaining, movedClip]),
    };
    return replaceTrackAtIndex(timeline, sourceTrackIndex, nextTrack);
  }

  if (targetTrack.clips.some((clip) => clip.id === movedClip.id)) {
    throw new ValidationError('Clip id conflict in target track.', [
      { field: 'clip.id', message: `Clip "${movedClip.id}" already exists in target track.` },
    ]);
  }

  const nextSourceTrack: Track = {
    ...sourceTrack,
    clips: sourceTrack.clips.filter((clip) => clip.id !== sourceClip.id),
  };

  ensureNoOverlapWithClips(targetTrack.id, targetTrack.clips, movedClip);
  const nextTargetTrack: Track = {
    ...targetTrack,
    clips: sortClipsByStart([...targetTrack.clips, movedClip]),
  };

  return replaceTracksByIndex(timeline, [
    { index: sourceTrackIndex, track: nextSourceTrack },
    { index: targetTrackIndex, track: nextTargetTrack },
  ]);
}

export function removeClipFromTrack(timeline: Timeline, params: RemoveClipParams): Timeline {
  validateTimelineOrThrow(timeline);

  const trackIndex = getTrackIndexOrThrow(timeline, params.trackId);
  const track = timeline.tracks[trackIndex];
  const clipIndex = getClipIndexOrThrow(track, params.clipId);

  const nextClips = track.clips.filter((_, index) => index !== clipIndex);
  const nextTrack: Track = {
    ...track,
    clips: nextClips,
  };

  return replaceTrackAtIndex(timeline, trackIndex, nextTrack);
}

export function rippleRemoveClip(timeline: Timeline, params: RippleRemoveClipParams): Timeline {
  validateTimelineOrThrow(timeline);

  const trackIndex = getTrackIndexOrThrow(timeline, params.trackId);
  const track = timeline.tracks[trackIndex];
  const clipIndex = getClipIndexOrThrow(track, params.clipId);
  const clip = track.clips[clipIndex];
  const removedEnd = clip.start + clip.duration;
  const removedDuration = clip.duration;

  const nextClips = track.clips
    .filter((candidate) => candidate.id !== clip.id)
    .map((candidate) => {
      if (candidate.start + RIPPLE_EPSILON < removedEnd) {
        return candidate;
      }

      return {
        ...candidate,
        start: Math.max(0, candidate.start - removedDuration),
      };
    });

  const nextTrack: Track = {
    ...track,
    clips: sortClipsByStart(nextClips),
  };

  return replaceTrackAtIndex(timeline, trackIndex, nextTrack);
}

export function trimClip(timeline: Timeline, params: TrimClipParams): Timeline {
  validateTimelineOrThrow(timeline);

  const startDelta = params.startDelta ?? 0;
  const endDelta = params.endDelta ?? 0;
  validateNumberField('startDelta', startDelta);
  validateNumberField('endDelta', endDelta);

  const trackIndex = getTrackIndexOrThrow(timeline, params.trackId);
  const track = timeline.tracks[trackIndex];
  const clipIndex = getClipIndexOrThrow(track, params.clipId);
  const clip = track.clips[clipIndex];

  const trimmedClip: Clip = {
    ...clip,
    start: clip.start + startDelta,
    offset: clip.offset + startDelta,
    duration: clip.duration - startDelta - endDelta,
  };

  validateClipOrThrow(trimmedClip);

  const remaining = track.clips.filter((candidate) => candidate.id !== clip.id);
  ensureNoOverlapWithClips(track.id, remaining, trimmedClip);

  const nextTrack: Track = {
    ...track,
    clips: sortClipsByStart([...remaining, trimmedClip]),
  };

  return replaceTrackAtIndex(timeline, trackIndex, nextTrack);
}

export function slipClip(timeline: Timeline, params: SlipClipParams): Timeline {
  validateTimelineOrThrow(timeline);
  validateNumberField('offset', params.offset, { min: 0, required: true });

  const trackIndex = getTrackIndexOrThrow(timeline, params.trackId);
  const track = timeline.tracks[trackIndex];
  const clipIndex = getClipIndexOrThrow(track, params.clipId);
  const clip = track.clips[clipIndex];

  const slippedClip: Clip = {
    ...clip,
    offset: params.offset,
  };

  validateClipOrThrow(slippedClip);

  const nextClips = [...track.clips];
  nextClips[clipIndex] = slippedClip;

  const nextTrack: Track = {
    ...track,
    clips: sortClipsByStart(nextClips),
  };

  return replaceTrackAtIndex(timeline, trackIndex, nextTrack);
}

export function cutClip(timeline: Timeline, params: CutClipParams): Timeline {
  validateTimelineOrThrow(timeline);
  validateNumberField('cutTime', params.cutTime, { min: 0, required: true });

  const trackIndex = getTrackIndexOrThrow(timeline, params.trackId);
  const track = timeline.tracks[trackIndex];
  const clipIndex = getClipIndexOrThrow(track, params.clipId);
  const clip = track.clips[clipIndex];

  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;
  if (params.cutTime <= clipStart + CUT_EPSILON || params.cutTime >= clipEnd - CUT_EPSILON) {
    throw new ValidationError('Cut point must be strictly inside clip bounds.', [
      {
        field: 'cutTime',
        message: `cutTime must be > ${clipStart} and < ${clipEnd}.`,
      },
    ]);
  }

  const leftClipId = params.leftClipId ?? `${clip.id}_left`;
  const rightClipId = params.rightClipId ?? `${clip.id}_right`;
  if (leftClipId === rightClipId) {
    throw new ValidationError('Cut clip ids must be unique.', [
      { field: 'leftClipId', message: 'leftClipId and rightClipId must differ.' },
    ]);
  }

  ensureClipIdAvailableForCut(timeline, clip.id, leftClipId);
  ensureClipIdAvailableForCut(timeline, clip.id, rightClipId);

  const leftDuration = params.cutTime - clip.start;
  const rightDuration = clip.duration - leftDuration;

  const leftClip: Clip = {
    id: leftClipId,
    assetId: clip.assetId,
    start: clip.start,
    duration: leftDuration,
    offset: clip.offset,
    gain: clip.gain,
    automation: clip.automation
      ? {
          gain: clip.automation.gain?.map((point) => ({ ...point })),
        }
      : undefined,
  };

  const rightClip: Clip = {
    id: rightClipId,
    assetId: clip.assetId,
    start: params.cutTime,
    duration: rightDuration,
    offset: clip.offset + leftDuration,
    gain: clip.gain,
    automation: clip.automation
      ? {
          gain: clip.automation.gain?.map((point) => ({ ...point })),
        }
      : undefined,
  };

  validateClipOrThrow(leftClip);
  validateClipOrThrow(rightClip);

  const remaining = track.clips.filter((candidate) => candidate.id !== clip.id);
  ensureNoOverlapWithClips(track.id, remaining, leftClip);
  ensureNoOverlapWithClips(track.id, remaining, rightClip);

  const nextTrack: Track = {
    ...track,
    clips: sortClipsByStart([...remaining, leftClip, rightClip]),
  };

  return replaceTrackAtIndex(timeline, trackIndex, nextTrack);
}

export function findClipLocation(timeline: Timeline, clipId: string): ClipLocation | null {
  for (let trackIndex = 0; trackIndex < timeline.tracks.length; trackIndex += 1) {
    const track = timeline.tracks[trackIndex];
    const clipIndex = track.clips.findIndex((clip) => clip.id === clipId);
    if (clipIndex !== -1) {
      return {
        trackId: track.id,
        trackIndex,
        clipIndex,
      };
    }
  }

  return null;
}

export function detectTrackOverlaps(track: Track): ClipOverlap[] {
  const overlaps: ClipOverlap[] = [];
  const clips = sortClipsByStart(track.clips);

  for (let i = 0; i < clips.length; i += 1) {
    const clip = clips[i];
    for (let j = i + 1; j < clips.length; j += 1) {
      const other = clips[j];
      if (other.start >= clip.start + clip.duration) {
        break;
      }

      if (hasOverlap(clip, other)) {
        overlaps.push({ clipId: clip.id, otherClipId: other.id });
      }
    }
  }

  return overlaps;
}

function validateTimelineOrThrow(timeline: Timeline): void {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(timeline.tracks)) {
    issues.push({ field: 'timeline.tracks', message: 'timeline.tracks must be an array.' });
  } else {
    timeline.tracks.forEach((track, trackIndex) => {
      if (!isNonEmptyString(track.id)) {
        issues.push({ field: `timeline.tracks[${trackIndex}].id`, message: 'id must be a non-empty string.' });
      }

      if (!isTrackKind(track.kind)) {
        issues.push({ field: `timeline.tracks[${trackIndex}].kind`, message: 'kind is invalid.' });
      }

      if (!isNonEmptyString(track.name)) {
        issues.push({ field: `timeline.tracks[${trackIndex}].name`, message: 'name must be a non-empty string.' });
      }

      if (!Array.isArray(track.clips)) {
        issues.push({ field: `timeline.tracks[${trackIndex}].clips`, message: 'clips must be an array.' });
        return;
      }

      track.clips.forEach((clip, clipIndex) => {
        issues.push(...validateClip(clip, `timeline.tracks[${trackIndex}].clips[${clipIndex}]`));
      });
    });
  }

  if (issues.length > 0) {
    throw new ValidationError('Invalid timeline payload.', issues);
  }
}

function validateClipOrThrow(clip: Clip): void {
  const issues = validateClip(clip, 'clip');
  if (issues.length > 0) {
    throw new ValidationError('Invalid clip payload.', issues);
  }
}

function validateClip(clip: Clip, baseField: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isNonEmptyString(clip.id)) {
    issues.push({ field: `${baseField}.id`, message: 'id must be a non-empty string.' });
  }

  if (!isNonEmptyString(clip.assetId)) {
    issues.push({ field: `${baseField}.assetId`, message: 'assetId must be a non-empty string.' });
  }

  issues.push(...validateNumberField(`${baseField}.start`, clip.start, { min: 0 }));
  issues.push(...validateNumberField(`${baseField}.duration`, clip.duration, { minExclusive: 0 }));
  issues.push(...validateNumberField(`${baseField}.offset`, clip.offset, { min: 0 }));
  if (typeof clip.gain !== 'undefined') {
    issues.push(...validateNumberField(`${baseField}.gain`, clip.gain, { min: 0 }));
    if (clip.gain > 2) {
      issues.push({ field: `${baseField}.gain`, message: 'gain must be <= 2.' });
    }
  }

  if (typeof clip.automation !== 'undefined') {
    if (typeof clip.automation !== 'object' || clip.automation === null) {
      issues.push({ field: `${baseField}.automation`, message: 'automation must be an object.' });
    } else if (typeof clip.automation.gain !== 'undefined') {
      if (!Array.isArray(clip.automation.gain)) {
        issues.push({ field: `${baseField}.automation.gain`, message: 'automation.gain must be an array.' });
      } else {
        clip.automation.gain.forEach((point, index) => {
          const pointField = `${baseField}.automation.gain[${index}]`;
          if (typeof point !== 'object' || point === null) {
            issues.push({ field: pointField, message: 'gain point must be an object.' });
            return;
          }

          const time = (point as { time?: number }).time;
          const value = (point as { value?: number }).value;
          issues.push(...validateNumberField(`${pointField}.time`, time as number, { min: 0, required: true }));
          issues.push(...validateNumberField(`${pointField}.value`, value as number, { min: 0, required: true }));
          if (typeof value === 'number' && value > 2) {
            issues.push({ field: `${pointField}.value`, message: 'value must be <= 2.' });
          }
        });
      }
    }
  }

  return issues;
}

function validateNumberField(
  field: string,
  value: number,
  constraints?: { min?: number; minExclusive?: number; required?: boolean },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (constraints?.required && typeof value === 'undefined') {
    return [{ field, message: `${field} is required.` }];
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return [{ field, message: `${field} must be a finite number.` }];
  }

  if (typeof constraints?.min === 'number' && value < constraints.min) {
    issues.push({ field, message: `${field} must be >= ${constraints.min}.` });
  }

  if (typeof constraints?.minExclusive === 'number' && value <= constraints.minExclusive) {
    issues.push({ field, message: `${field} must be > ${constraints.minExclusive}.` });
  }

  return issues;
}

function getTrackIndexOrThrow(timeline: Timeline, trackId: string): number {
  const index = timeline.tracks.findIndex((track) => track.id === trackId);
  if (index === -1) {
    throw new NotFoundError('track', trackId);
  }

  return index;
}

function getClipIndexOrThrow(track: Track, clipId: string): number {
  const index = track.clips.findIndex((clip) => clip.id === clipId);
  if (index === -1) {
    throw new NotFoundError('clip', clipId);
  }

  return index;
}

function replaceTrackAtIndex(timeline: Timeline, trackIndex: number, track: Track): Timeline {
  const nextTracks = [...timeline.tracks];
  nextTracks[trackIndex] = track;
  return {
    ...timeline,
    tracks: nextTracks,
  };
}

function replaceTracksByIndex(
  timeline: Timeline,
  replacements: Array<{ index: number; track: Track }>,
): Timeline {
  const nextTracks = [...timeline.tracks];
  replacements.forEach((replacement) => {
    nextTracks[replacement.index] = replacement.track;
  });

  return {
    ...timeline,
    tracks: nextTracks,
  };
}

function ensureNoOverlap(track: Track, candidate: Clip): void {
  ensureNoOverlapWithClips(track.id, track.clips, candidate);
}

function ensureNoOverlapWithClips(trackId: string, clips: Clip[], candidate: Clip): void {
  const conflicts = clips
    .filter((clip) => hasOverlap(clip, candidate))
    .map((clip) => clip.id);

  if (conflicts.length > 0) {
    throw new OverlapError(trackId, candidate.id, conflicts);
  }
}

function hasOverlap(a: Clip, b: Clip): boolean {
  return a.start < b.start + b.duration && b.start < a.start + a.duration;
}

function sortClipsByStart(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }

    return a.id.localeCompare(b.id);
  });
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

function ensureClipIdAvailableForCut(timeline: Timeline, sourceClipId: string, candidateClipId: string): void {
  if (candidateClipId === sourceClipId) {
    return;
  }

  const existing = findClipLocation(timeline, candidateClipId);
  if (existing !== null) {
    throw new ValidationError('Clip id must be unique across timeline.', [
      {
        field: 'clip.id',
        message: `Clip "${candidateClipId}" already exists.`,
      },
    ]);
  }
}

function isTrackKind(value: unknown): value is Track['kind'] {
  return value === 'video' || value === 'overlay' || value === 'audio' || value === 'text';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
