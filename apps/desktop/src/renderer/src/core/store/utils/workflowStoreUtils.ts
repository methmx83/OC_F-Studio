import type { ComfyRunEvent } from '@shared/comfy';
import type { Project, WorkflowDefinition } from '@shared/types';

import { createEmptyCommandHistory } from '../../commands';
import {
  createDefaultWorkflowParameters,
  getWorkflowContractById,
  type WorkflowParameterMap,
} from '../../comfy/workflowContracts';
import type { QueuedWorkflowRun, StudioState, WorkflowViewModel } from '../studioStore';

export function toProjectState(
  project: Project,
  projectRoot: string | null,
  projectMessage: string,
): Partial<StudioState> {
  const workflows = toWorkflowViewModels(project);

  return {
    project,
    projectName: project.name,
    projectRoot,
    projectMessage,
    assets: project.assets,
    assetThumbnails: {},
    proxyPathByAssetId: {},
    proxyPendingByAssetId: {},
    timeline: project.timeline,
    timelineCommandHistory: createEmptyCommandHistory(),
    currentTime: 0,
    isPlaying: false,
    pastCount: 0,
    futureCount: 0,
    selectedClip: null,
    droppedAssetIds: [],
    workflows,
    selectedWorkflowId: workflows[0]?.id ?? '',
    queuedWorkflowRuns: [],
    autoImportedOutputPathsByRunId: {},
    trackAudioMutedById: {},
    trackAudioSoloById: {},
    isDirty: false,
  };
}

export function applyComfyRunEventState(state: StudioState, event: ComfyRunEvent): Partial<StudioState> {
  const parseTs = (value: string): number => {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };
  const byNewestUpdate = (a: QueuedWorkflowRun, b: QueuedWorkflowRun): number => {
    const updateDiff = parseTs(b.updatedAt) - parseTs(a.updatedAt);
    if (updateDiff !== 0) {
      return updateDiff;
    }
    const createDiff = parseTs(b.createdAt) - parseTs(a.createdAt);
    if (createDiff !== 0) {
      return createDiff;
    }
    return b.id.localeCompare(a.id);
  };

  const existingIndex = state.queuedWorkflowRuns.findIndex((run) => run.id === event.runId);
  const existingRun = existingIndex >= 0 ? state.queuedWorkflowRuns[existingIndex] : null;
  const resolvedWorkflowId = event.workflowId === 'unknown' && existingRun ? existingRun.workflowId : event.workflowId;
  const resolvedWorkflowName = state.workflows.find((workflow) => workflow.id === resolvedWorkflowId)?.name ?? resolvedWorkflowId;
  const nextComfyOnline = event.status === 'failed' ? state.comfyOnline : true;

  if (existingIndex === -1) {
    const placeholderRun: QueuedWorkflowRun = {
      id: event.runId,
      workflowId: resolvedWorkflowId,
      workflowName: resolvedWorkflowName,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      status: event.status,
      promptId: event.promptId ?? null,
      progress: event.progress,
      message: event.message,
      outputPaths: event.outputPaths,
      request: null,
    };

    return {
      queuedWorkflowRuns: [placeholderRun, ...state.queuedWorkflowRuns]
        .sort(byNewestUpdate)
        .slice(0, 80),
      projectMessage: event.message,
      comfyOnline: nextComfyOnline,
      lastError: event.status === 'failed' ? event.message : state.lastError,
    };
  }

  const existing = state.queuedWorkflowRuns[existingIndex];
  const existingTs = parseTs(existing.updatedAt);
  const incomingTs = parseTs(event.occurredAt);
  if (incomingTs > 0 && existingTs > 0 && incomingTs < existingTs) {
    return {
      projectMessage: state.projectMessage,
      comfyOnline: state.comfyOnline,
      lastError: state.lastError,
    };
  }

  const updatedRun: QueuedWorkflowRun = {
    ...existing,
    workflowId: resolvedWorkflowId,
    workflowName: resolvedWorkflowName,
    status: event.status,
    promptId: event.promptId ?? existing.promptId,
    progress: event.progress,
    message: event.message,
    outputPaths: event.outputPaths.length > 0 ? event.outputPaths : existing.outputPaths,
    updatedAt: event.occurredAt,
  };

  const nextRuns = [...state.queuedWorkflowRuns];
  nextRuns[existingIndex] = updatedRun;
  nextRuns.sort(byNewestUpdate);

  return {
    queuedWorkflowRuns: nextRuns.slice(0, 80),
    projectMessage: event.message,
    comfyOnline: nextComfyOnline,
    lastError: event.status === 'failed' ? event.message : state.lastError,
  };
}

export function toWorkflowViewModels(project: Project): WorkflowViewModel[] {
  if (project.workflowDefinitions.length === 0) {
    return [
      toWorkflowViewModel('img_audio_v1', 'Image + Audio'),
      toWorkflowViewModel('img_two_clips_v1', 'Image + Two Clips'),
    ];
  }

  return project.workflowDefinitions.map((definition) => {
    return toWorkflowViewModel(definition.id, definition.name, definition.config);
  });
}

function toWorkflowViewModel(
  workflowId: string,
  workflowName: string,
  config?: Record<string, unknown>,
): WorkflowViewModel {
  const contract = getWorkflowContractById(workflowId);
  const defaultParameters = contract ? createDefaultWorkflowParameters(contract) : {};
  const configuredParameters = toWorkflowParameters(config);

  return {
    id: workflowId,
    name: workflowName,
    parameters: {
      ...defaultParameters,
      ...configuredParameters,
    },
  };
}

function toWorkflowParameters(config?: Record<string, unknown>): WorkflowParameterMap {
  if (!config) {
    return {};
  }

  const parameters: WorkflowParameterMap = {};
  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      parameters[key] = value;
      return;
    }
    if (typeof value === 'string') {
      parameters[key] = value;
    }
  });
  return parameters;
}

export function mergeWorkflowParameters(
  current: WorkflowParameterMap,
  partial: Partial<WorkflowParameterMap>,
): WorkflowParameterMap {
  const next: WorkflowParameterMap = { ...current };
  Object.entries(partial).forEach(([key, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = value;
      return;
    }
    if (typeof value === 'string') {
      next[key] = value;
    }
  });
  return next;
}

export function promptForWorkflowId(): string | null {
  const promptFn = globalThis.prompt;
  if (typeof promptFn !== 'function') {
    return null;
  }

  const raw = promptFn('Workflow ID (letters, numbers, "-" or "_")', '');
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

export function upsertWorkflowDefinitionInProject(
  project: Project | null,
  definition: WorkflowDefinition,
): Project | null {
  if (!project) {
    return project;
  }

  const existingIndex = project.workflowDefinitions.findIndex((entry) => entry.id === definition.id);
  if (existingIndex === -1) {
    return {
      ...project,
      workflowDefinitions: [...project.workflowDefinitions, definition],
    };
  }

  const existingDefinition = project.workflowDefinitions[existingIndex];
  const mergedDefinition: WorkflowDefinition = {
    ...existingDefinition,
    ...definition,
    config: {
      ...existingDefinition.config,
      ...definition.config,
    },
  };

  const nextDefinitions = [...project.workflowDefinitions];
  nextDefinitions[existingIndex] = mergedDefinition;

  return {
    ...project,
    workflowDefinitions: nextDefinitions,
  };
}
