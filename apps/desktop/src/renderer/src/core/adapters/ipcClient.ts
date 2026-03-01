/* eslint-disable no-unused-vars */
import type { ComfyHealthResponse, ComfyRunEvent, QueueComfyRunRequest, QueueComfyRunResponse } from '@shared/comfy';
import type { WorkflowTemplateImportResponse } from '@shared/ipc/project';
import {
  getProjectApi,
  type ProjectApiPort,
} from './projectApi';

export const COMFY_BRIDGE_UNAVAILABLE_MESSAGE =
  'Comfy bridge unavailable in current preload. Restart app/dev process.';
export const WORKFLOW_TEMPLATE_IMPORT_UNAVAILABLE_MESSAGE =
  'Workflow template import unavailable in current preload. Restart app/dev process.';
export const PROJECT_API_UNAVAILABLE_MESSAGE =
  'Project API unavailable in current preload. Restart app/dev process.';

export class IpcUnavailableError extends Error {
  readonly methodName: string;

  constructor(methodName: string, message: string) {
    super(message);
    this.name = 'IpcUnavailableError';
    this.methodName = methodName;
  }
}

export function isIpcUnavailableError(error: unknown): error is IpcUnavailableError {
  return error instanceof IpcUnavailableError;
}

type RuntimeProjectApi = Partial<ProjectApiPort> & Omit<ProjectApiPort, never>;

function getRuntimeProjectApi(): RuntimeProjectApi {
  return getProjectApi() as RuntimeProjectApi;
}

function requireMethod<K extends keyof ProjectApiPort>(
  api: RuntimeProjectApi,
  methodName: K,
  unavailableMessage: string,
): ProjectApiPort[K] {
  const candidate = api[methodName];
  if (typeof candidate !== 'function') {
    throw new IpcUnavailableError(String(methodName), unavailableMessage);
  }
  return candidate as ProjectApiPort[K];
}

export interface IpcClient extends ProjectApiPort {}

export function getIpcClient(): IpcClient {
  const api = getRuntimeProjectApi();

  return {
    newProject: () => requireMethod(api, 'newProject', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    loadProject: () => requireMethod(api, 'loadProject', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    saveProject: (project) => requireMethod(api, 'saveProject', PROJECT_API_UNAVAILABLE_MESSAGE)(project),
    importVideo: () => requireMethod(api, 'importVideo', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    importImage: () => requireMethod(api, 'importImage', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    importAudio: () => requireMethod(api, 'importAudio', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    importComfyOutput: (outputPath) => requireMethod(api, 'importComfyOutput', PROJECT_API_UNAVAILABLE_MESSAGE)(outputPath),
    importWorkflowTemplate: async (workflowId: string): Promise<WorkflowTemplateImportResponse> => {
      const method = requireMethod(api, 'importWorkflowTemplate', WORKFLOW_TEMPLATE_IMPORT_UNAVAILABLE_MESSAGE);
      return method(workflowId);
    },
    getProjectRoot: () => requireMethod(api, 'getProjectRoot', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    listWorkflowCatalog: () => requireMethod(api, 'listWorkflowCatalog', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    getAssetThumbnailDataUrl: (relativePath) => requireMethod(api, 'getAssetThumbnailDataUrl', PROJECT_API_UNAVAILABLE_MESSAGE)(relativePath),
    getAssetFileUrl: (relativePath) => requireMethod(api, 'getAssetFileUrl', PROJECT_API_UNAVAILABLE_MESSAGE)(relativePath),
    getAssetMediaDataUrl: (relativePath) => requireMethod(api, 'getAssetMediaDataUrl', PROJECT_API_UNAVAILABLE_MESSAGE)(relativePath),
    getFfmpegHealth: () => requireMethod(api, 'getFfmpegHealth', PROJECT_API_UNAVAILABLE_MESSAGE)(),
    ensureVideoProxy: (relativeVideoPath) => requireMethod(api, 'ensureVideoProxy', PROJECT_API_UNAVAILABLE_MESSAGE)(relativeVideoPath),
    getAudioWaveformPeaks: (relativeAudioPath, bins) => requireMethod(api, 'getAudioWaveformPeaks', PROJECT_API_UNAVAILABLE_MESSAGE)(relativeAudioPath, bins),
    getComfyHealth: async (): Promise<ComfyHealthResponse> => {
      const method = requireMethod(api, 'getComfyHealth', COMFY_BRIDGE_UNAVAILABLE_MESSAGE);
      return method();
    },
    queueComfyRun: async (payload: QueueComfyRunRequest): Promise<QueueComfyRunResponse> => {
      const method = requireMethod(api, 'queueComfyRun', COMFY_BRIDGE_UNAVAILABLE_MESSAGE);
      return method(payload);
    },
    onComfyRunEvent: (listener: (event: ComfyRunEvent) => void): (() => void) => {
      const method = requireMethod(api, 'onComfyRunEvent', COMFY_BRIDGE_UNAVAILABLE_MESSAGE);
      return method(listener);
    },
  };
}
