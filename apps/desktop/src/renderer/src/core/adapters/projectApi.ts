/* eslint-disable no-unused-vars */
import type { AssetImportResponse, AudioWaveformResponse } from '@shared/ipc/assets';
import type { FfmpegHealthResponse, ProxyResponse } from '@shared/ipc/ffmpeg';
import type {
  ProjectResponse,
  WorkflowPresetsMap,
  WorkflowPresetsResponse,
  WorkflowTemplateImportResponse,
} from '@shared/ipc/project';
import type { Project } from '@shared/types';
import type {
  ComfyHealthResponse,
  ComfyRunEvent,
  QueueComfyRunRequest,
  QueueComfyRunResponse,
} from '@shared/comfy';
import type { WorkflowCatalogResponse } from '@shared/workflows';

export interface ProjectApiPort {
  newProject: () => Promise<ProjectResponse>;
  loadProject: () => Promise<ProjectResponse>;
  saveProject: (project: Project) => Promise<ProjectResponse>;
  importVideo: () => Promise<AssetImportResponse>;
  importImage: () => Promise<AssetImportResponse>;
  importAudio: () => Promise<AssetImportResponse>;
  importComfyOutput: (outputPath: string) => Promise<AssetImportResponse>;
  importWorkflowTemplate: (workflowId: string) => Promise<WorkflowTemplateImportResponse>;
  getWorkflowPresets: () => Promise<WorkflowPresetsResponse>;
  saveWorkflowPresets: (presets: WorkflowPresetsMap) => Promise<WorkflowPresetsResponse>;
  getProjectRoot: () => Promise<string | null>;
  listWorkflowCatalog: () => Promise<WorkflowCatalogResponse>;
  getAssetThumbnailDataUrl: (relativePath: string) => Promise<string | null>;
  getAssetFileUrl: (relativePath: string) => Promise<string | null>;
  getAssetMediaDataUrl: (relativePath: string) => Promise<string | null>;
  getFfmpegHealth: () => Promise<FfmpegHealthResponse>;
  ensureVideoProxy: (relativeVideoPath: string) => Promise<ProxyResponse>;
  getAudioWaveformPeaks: (relativeAudioPath: string, bins: number) => Promise<AudioWaveformResponse>;
  getComfyHealth: () => Promise<ComfyHealthResponse>;
  queueComfyRun: (payload: QueueComfyRunRequest) => Promise<QueueComfyRunResponse>;
  onComfyRunEvent: (listener: (event: ComfyRunEvent) => void) => () => void;
}

export function getProjectApi(): ProjectApiPort {
  return globalThis.window.projectApi;
}
