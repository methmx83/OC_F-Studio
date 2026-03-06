/* eslint-disable no-unused-vars */
import type { AssetImportResponse, AudioWaveformResponse } from '@shared/ipc/assets';
import type { FfmpegHealthResponse, ProxyResponse } from '@shared/ipc/ffmpeg';
import type {
  ComfyGalleryListRequest,
  ComfyGalleryListResponse,
  ProjectResponse,
  SavePreviewSnapshotRequest,
  SavePreviewSnapshotResponse,
  WorkflowPresetsResponse,
  WorkflowPresetsSaveRequest,
  WorkflowTemplateImportResponse,
} from '@shared/ipc/project';
import type { Project } from '@shared/types';
import type {
  CancelComfyRunRequest,
  CancelComfyRunResponse,
  ComfyHealthRequest,
  ComfyHealthResponse,
  ComfyRunEvent,
  PreviewComfyRunPayloadRequest,
  PreviewComfyRunPayloadResponse,
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
  listComfyGallery: (request?: ComfyGalleryListRequest) => Promise<ComfyGalleryListResponse>;
  savePreviewSnapshot: (request: SavePreviewSnapshotRequest) => Promise<SavePreviewSnapshotResponse>;
  importWorkflowTemplate: (workflowId: string) => Promise<WorkflowTemplateImportResponse>;
  getWorkflowPresets: () => Promise<WorkflowPresetsResponse>;
  saveWorkflowPresets: (request: WorkflowPresetsSaveRequest) => Promise<WorkflowPresetsResponse>;
  getProjectRoot: () => Promise<string | null>;
  listWorkflowCatalog: () => Promise<WorkflowCatalogResponse>;
  getAssetThumbnailDataUrl: (relativePath: string) => Promise<string | null>;
  getAssetFileUrl: (relativePath: string) => Promise<string | null>;
  getAssetMediaDataUrl: (relativePath: string) => Promise<string | null>;
  getFfmpegHealth: () => Promise<FfmpegHealthResponse>;
  ensureVideoProxy: (relativeVideoPath: string) => Promise<ProxyResponse>;
  getAudioWaveformPeaks: (relativeAudioPath: string, bins: number) => Promise<AudioWaveformResponse>;
  getComfyHealth: (request?: ComfyHealthRequest) => Promise<ComfyHealthResponse>;
  queueComfyRun: (payload: QueueComfyRunRequest) => Promise<QueueComfyRunResponse>;
  previewComfyRunPayload: (payload: PreviewComfyRunPayloadRequest) => Promise<PreviewComfyRunPayloadResponse>;
  cancelComfyRun: (payload: CancelComfyRunRequest) => Promise<CancelComfyRunResponse>;
  onComfyRunEvent: (listener: (event: ComfyRunEvent) => void) => () => void;
}

export function getProjectApi(): ProjectApiPort {
  return (globalThis.window as unknown as { projectApi: ProjectApiPort }).projectApi;
}
