/* eslint-disable no-unused-vars */
import type { Asset, Clip, Project, Timeline, Track } from '@shared/types';
import type { ComfyWorkflowRunRequest } from '@shared/comfy';
import { create } from 'zustand';

import {
  type TimelineCommandHistory,
} from '../commands';
import {
  type WorkflowParameterMap,
} from '../comfy/workflowContracts';
import type {
  CutClipParams,
  MoveClipParams,
  RemoveClipParams,
  RippleRemoveClipParams,
  SlipClipParams,
  TrimClipParams,
} from '../engine';
import { createAssetsSlice } from './slices/assetsSlice';
import { createComfySlice } from './slices/comfySlice';
import { createPreviewSlice } from './slices/previewSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createTimelineSlice } from './slices/timelineSlice';
import { createTransportSlice } from './slices/transportSlice';
import { createWorkflowStudioSlice } from './slices/workflowStudioSlice';
import {
  applyComfyRunEventState,
  clampTime,
  createId,
  getClipOrThrow,
  getTimelineEnd,
  getTrackOrThrow,
  hydrateAssetThumbnails,
  hydrateKnownVideoProxies,
  importAssetByType,
  importComfyOutputAssetByPath,
  mergeWorkflowParameters,
  promptForWorkflowId,
  resolveInitialClipDuration,
  sanitizeSelection,
  toErrorMessage,
  toProjectState,
  toTimelineHistoryState,
  upsertWorkflowDefinitionInProject,
} from './utils';

export type AssetFilter = 'All' | 'video' | 'image' | 'audio';

export interface WorkflowViewModel {
  id: string;
  name: string;
  parameters: WorkflowParameterMap;
}

export interface QueuedWorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  createdAt: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  promptId: string | null;
  progress: number | null;
  message: string;
  outputPaths: string[];
  request: ComfyWorkflowRunRequest;
}

export interface SelectedClip {
  trackId: string;
  clipId: string;
}

export interface FfmpegStatus {
  available: boolean | null;
  version: string | null;
  message: string;
}

export interface StudioState {
  projectName: string;
  projectRoot: string | null;
  projectMessage: string;
  isProjectBusy: boolean;
  isDirty: boolean;
  comfyOnline: boolean;
  lastError: string | null;
  pastCount: number;
  futureCount: number;
  project: Project | null;
  assets: Asset[];
  assetThumbnails: Record<string, string | null>;
  assetFilter: AssetFilter;
  assetQuery: string;
  ffmpegStatus: FfmpegStatus;
  proxyPathByAssetId: Record<string, string>;
  proxyPendingByAssetId: Record<string, boolean>;
  timeline: Timeline;
  timelineCommandHistory: TimelineCommandHistory;
  currentTime: number;
  isPlaying: boolean;
  selectedClip: SelectedClip | null;
  droppedAssetIds: string[];
  workflows: WorkflowViewModel[];
  selectedWorkflowId: string;
  queuedWorkflowRuns: QueuedWorkflowRun[];
  proxyMode: boolean;
  annotating: boolean;
  trackAudioMutedById: Record<string, boolean>;
  trackAudioSoloById: Record<string, boolean>;
  setAssetFilter: (filter: AssetFilter) => void;
  setAssetQuery: (query: string) => void;
  clearLastError: () => void;
  checkComfyHealth: () => Promise<void>;
  bindComfyRunEvents: () => void;
  checkFfmpegHealth: () => Promise<void>;
  ensureVideoProxy: (assetId: string) => Promise<void>;
  newProject: () => Promise<void>;
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  importVideoAsset: () => Promise<void>;
  importImageAsset: () => Promise<void>;
  importAudioAsset: () => Promise<void>;
  importComfyOutputAsset: (outputPath: string) => Promise<void>;
  importWorkflowTemplateForSelected: () => Promise<void>;
  addTrack: (kind?: Track['kind']) => void;
  dropAssetToTimeline: (assetId: string, trackId?: string) => void;
  timelineAddClip: (trackId: string, clip: Clip) => void;
  timelineMoveClip: (params: MoveClipParams) => void;
  timelineRemoveClip: (params: RemoveClipParams) => void;
  timelineRippleRemoveClip: (params: RippleRemoveClipParams) => void;
  timelineTrimClip: (params: TrimClipParams) => void;
  timelineSlipClip: (params: SlipClipParams) => void;
  timelineCutClip: (params: CutClipParams) => void;
  selectClip: (trackId: string, clipId: string) => void;
  clearClipSelection: () => void;
  nudgeSelectedClip: (deltaSeconds: number) => void;
  trimSelectedClip: (startDelta?: number, endDelta?: number) => void;
  slipSelectedClip: (deltaSeconds: number) => void;
  setSelectedClipGain: (gain: number) => void;
  setSelectedClipGainAutomation: (points: { time: number; value: number }[]) => void;
  cutSelectedClipAtCurrentTime: () => void;
  removeSelectedClip: () => void;
  rippleRemoveSelectedClip: () => void;
  setCurrentTime: (seconds: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  stepPlayback: (deltaSeconds: number) => void;
  selectWorkflow: (id: string) => void;
  removeWorkflow: (id: string) => void;
  patchWorkflow: (id: string, partial: Partial<WorkflowParameterMap>) => void;
  queueSelectedWorkflowRun: () => Promise<void>;
  undoUi: () => void;
  redoUi: () => void;
  toggleProxyMode: () => void;
  toggleAnnotating: () => void;
  toggleTrackAudioMute: (trackId: string) => void;
  toggleTrackAudioSolo: (trackId: string) => void;
  clearTrackAudioMixStates: () => void;
}

const WORKFLOW_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_WORKFLOW_VERSION = '1.0.0';

export const useStudioStore = create<StudioState>((set, get) => ({
  lastError: null,

  ...createProjectSlice(set, get, {
    toErrorMessage,
    toProjectState,
    hydrateAssetThumbnails,
    hydrateKnownVideoProxies,
  }),

  ...createAssetsSlice(set, get, {
    toErrorMessage,
    importAssetByType,
    importComfyOutputAssetByPath,
  }),

  ...createPreviewSlice(set, get),

  ...createComfySlice(set, get, {
    toErrorMessage,
    applyComfyRunEventState,
  }),

  ...createWorkflowStudioSlice(set, get, {
    toErrorMessage,
    createId,
    mergeWorkflowParameters,
    promptForWorkflowId,
    upsertWorkflowDefinitionInProject,
    applyComfyRunEventState,
    workflowIdPattern: WORKFLOW_ID_PATTERN,
    defaultWorkflowVersion: DEFAULT_WORKFLOW_VERSION,
  }),

  ...createTimelineSlice(set, get, {
    createId,
    toErrorMessage,
    resolveInitialClipDuration,
    getTrackOrThrow,
    getClipOrThrow,
    toTimelineHistoryState,
    sanitizeSelection,
  }),

  ...createTransportSlice(set, get, {
    clampTime,
    getTimelineEnd,
  }),

}));

