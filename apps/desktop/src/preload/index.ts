/* eslint-disable no-unused-vars */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '@ai-filmstudio/shared';
import type { AssetImportResponse, AudioWaveformResponse } from '@shared/ipc/assets';
import type { FfmpegHealthResponse, ProxyResponse } from '@shared/ipc/ffmpeg';
import type {
  ComfyGalleryListRequest,
  ComfyGalleryListResponse,
  ProjectResponse,
  WorkflowPresetsResponse,
  WorkflowPresetsSaveRequest,
  WorkflowTemplateImportResponse,
} from '@shared/ipc/project';
import type { Asset, Project } from '@shared/types';
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

contextBridge.exposeInMainWorld('projectApi', {
  newProject: async (): Promise<ProjectResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.new) as Promise<ProjectResponse>;
  },
  saveProject: async (project: Project): Promise<ProjectResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.save, project) as Promise<ProjectResponse>;
  },
  loadProject: async (): Promise<ProjectResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.load) as Promise<ProjectResponse>;
  },
  importVideo: async (): Promise<AssetImportResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.importVideo) as Promise<AssetImportResponse>;
  },
  importImage: async (): Promise<AssetImportResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.importImage) as Promise<AssetImportResponse>;
  },
  importAudio: async (): Promise<AssetImportResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.importAudio) as Promise<AssetImportResponse>;
  },
  importComfyOutput: async (outputPath: string): Promise<AssetImportResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.importComfyOutput, outputPath) as Promise<AssetImportResponse>;
  },
  listComfyGallery: async (request?: ComfyGalleryListRequest): Promise<ComfyGalleryListResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.listComfyGallery, request) as Promise<ComfyGalleryListResponse>;
  },
  importWorkflowTemplate: async (workflowId: string): Promise<WorkflowTemplateImportResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.importWorkflowTemplate, workflowId) as Promise<WorkflowTemplateImportResponse>;
  },
  getWorkflowPresets: async (): Promise<WorkflowPresetsResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.getWorkflowPresets) as Promise<WorkflowPresetsResponse>;
  },
  saveWorkflowPresets: async (request: WorkflowPresetsSaveRequest): Promise<WorkflowPresetsResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.saveWorkflowPresets, request) as Promise<WorkflowPresetsResponse>;
  },
  getProjectRoot: async (): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.getRoot) as Promise<string | null>;
  },
  listWorkflowCatalog: async (): Promise<WorkflowCatalogResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.listWorkflowCatalog) as Promise<WorkflowCatalogResponse>;
  },
  getAssetThumbnailDataUrl: async (relativePath: string): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.assetThumbnailDataUrl, relativePath) as Promise<string | null>;
  },
  getAssetFileUrl: async (relativePath: string): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.assetFileUrl, relativePath) as Promise<string | null>;
  },
  getAssetMediaDataUrl: async (relativePath: string): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.assetMediaDataUrl, relativePath) as Promise<string | null>;
  },
  getFfmpegHealth: async (): Promise<FfmpegHealthResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.ffmpegHealth) as Promise<FfmpegHealthResponse>;
  },
  ensureVideoProxy: async (relativeVideoPath: string): Promise<ProxyResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.ensureVideoProxy, relativeVideoPath) as Promise<ProxyResponse>;
  },
  getAudioWaveformPeaks: async (relativeAudioPath: string, bins: number): Promise<AudioWaveformResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.project.audioWaveformPeaks, relativeAudioPath, bins) as Promise<AudioWaveformResponse>;
  },
  getComfyHealth: async (request?: ComfyHealthRequest): Promise<ComfyHealthResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.comfy.health, request) as Promise<ComfyHealthResponse>;
  },
  queueComfyRun: async (payload: QueueComfyRunRequest): Promise<QueueComfyRunResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.comfy.queueRun, payload) as Promise<QueueComfyRunResponse>;
  },
  previewComfyRunPayload: async (payload: PreviewComfyRunPayloadRequest): Promise<PreviewComfyRunPayloadResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.comfy.previewRun, payload) as Promise<PreviewComfyRunPayloadResponse>;
  },
  cancelComfyRun: async (payload: CancelComfyRunRequest): Promise<CancelComfyRunResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.comfy.cancelRun, payload) as Promise<CancelComfyRunResponse>;
  },
  onComfyRunEvent: (listener: (event: ComfyRunEvent) => void): (() => void) => {
    const channelListener = (...args: [IpcRendererEvent, ComfyRunEvent]) => {
      listener(args[1]);
    };
    ipcRenderer.on(IPC_CHANNELS.comfy.runEvent, channelListener);

    return () => {
      ipcRenderer.off(IPC_CHANNELS.comfy.runEvent, channelListener);
    };
  },
});
