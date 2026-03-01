/* eslint-disable no-unused-vars */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@ai-filmstudio/shared';
import type { AssetImportResponse, AudioWaveformResponse } from '@shared/ipc/assets';
import type { FfmpegHealthResponse, ProxyResponse } from '@shared/ipc/ffmpeg';
import type { ProjectResponse, WorkflowPresetsMap, WorkflowPresetsResponse, WorkflowTemplateImportResponse } from '@shared/ipc/project';
import type { Project } from '@shared/types';
import type {
  ComfyHealthResponse,
  QueueComfyRunRequest,
  QueueComfyRunResponse,
} from '@shared/comfy';
import type { WorkflowCatalogResponse } from '@shared/workflows';

export interface RegisterIpcHandlers {
  newProject: () => Promise<ProjectResponse>;
  saveProject: (project: Project) => Promise<ProjectResponse>;
  loadProject: () => Promise<ProjectResponse>;
  getProjectRoot: () => string | null;
  listWorkflowCatalog: () => Promise<WorkflowCatalogResponse>;
  getComfyHealth: () => Promise<ComfyHealthResponse>;
  queueComfyRun: (payload: QueueComfyRunRequest) => Promise<QueueComfyRunResponse>;
  importVideo: () => Promise<AssetImportResponse>;
  importImage: () => Promise<AssetImportResponse>;
  importAudio: () => Promise<AssetImportResponse>;
  importComfyOutput: (outputPath: string) => Promise<AssetImportResponse>;
  importWorkflowTemplate: (workflowId: string) => Promise<WorkflowTemplateImportResponse>;
  getWorkflowPresets: () => Promise<WorkflowPresetsResponse>;
  saveWorkflowPresets: (presets: WorkflowPresetsMap) => Promise<WorkflowPresetsResponse>;
  getAssetThumbnailDataUrl: (relativePath: string) => Promise<string | null>;
  getAssetFileUrl: (relativePath: string) => Promise<string | null>;
  getAssetMediaDataUrl: (relativePath: string) => Promise<string | null>;
  getFfmpegHealth: () => Promise<FfmpegHealthResponse>;
  ensureVideoProxy: (relativeVideoPath: string) => Promise<ProxyResponse>;
  getAudioWaveformPeaks: (relativeAudioPath: string, bins: number) => Promise<AudioWaveformResponse>;
}

export function registerIpc(handlers: RegisterIpcHandlers): void {
  ipcMain.handle(IPC_CHANNELS.project.new, async (): Promise<ProjectResponse> => {
    return handlers.newProject();
  });

  ipcMain.handle(IPC_CHANNELS.project.save, async (_event, project: Project): Promise<ProjectResponse> => {
    return handlers.saveProject(project);
  });

  ipcMain.handle(IPC_CHANNELS.project.load, async (): Promise<ProjectResponse> => {
    return handlers.loadProject();
  });

  ipcMain.handle(IPC_CHANNELS.project.getRoot, (): string | null => {
    return handlers.getProjectRoot();
  });

  ipcMain.handle(IPC_CHANNELS.project.listWorkflowCatalog, async (): Promise<WorkflowCatalogResponse> => {
    return handlers.listWorkflowCatalog();
  });

  ipcMain.handle(IPC_CHANNELS.comfy.health, async (): Promise<ComfyHealthResponse> => {
    return handlers.getComfyHealth();
  });

  ipcMain.handle(
    IPC_CHANNELS.comfy.queueRun,
    async (_event, payload: QueueComfyRunRequest): Promise<QueueComfyRunResponse> => {
      return handlers.queueComfyRun(payload);
    },
  );

  ipcMain.handle(IPC_CHANNELS.project.importVideo, async (): Promise<AssetImportResponse> => {
    return handlers.importVideo();
  });

  ipcMain.handle(IPC_CHANNELS.project.importImage, async (): Promise<AssetImportResponse> => {
    return handlers.importImage();
  });

  ipcMain.handle(IPC_CHANNELS.project.importAudio, async (): Promise<AssetImportResponse> => {
    return handlers.importAudio();
  });

  ipcMain.handle(
    IPC_CHANNELS.project.importComfyOutput,
    async (_event, outputPath: string): Promise<AssetImportResponse> => {
      return handlers.importComfyOutput(outputPath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.project.importWorkflowTemplate,
    async (_event, workflowId: string): Promise<WorkflowTemplateImportResponse> => {
      return handlers.importWorkflowTemplate(workflowId);
    },
  );

  ipcMain.handle(IPC_CHANNELS.project.getWorkflowPresets, async (): Promise<WorkflowPresetsResponse> => {
    return handlers.getWorkflowPresets();
  });

  ipcMain.handle(
    IPC_CHANNELS.project.saveWorkflowPresets,
    async (_event, presets: WorkflowPresetsMap): Promise<WorkflowPresetsResponse> => {
      return handlers.saveWorkflowPresets(presets);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.project.assetThumbnailDataUrl,
    async (_event, relativePath: string): Promise<string | null> => {
      return handlers.getAssetThumbnailDataUrl(relativePath);
    },
  );

  ipcMain.handle(IPC_CHANNELS.project.assetFileUrl, async (_event, relativePath: string): Promise<string | null> => {
    return handlers.getAssetFileUrl(relativePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.project.assetMediaDataUrl,
    async (_event, relativePath: string): Promise<string | null> => {
      return handlers.getAssetMediaDataUrl(relativePath);
    },
  );

  ipcMain.handle(IPC_CHANNELS.project.ffmpegHealth, async (): Promise<FfmpegHealthResponse> => {
    return handlers.getFfmpegHealth();
  });

  ipcMain.handle(
    IPC_CHANNELS.project.ensureVideoProxy,
    async (_event, relativeVideoPath: string): Promise<ProxyResponse> => {
      return handlers.ensureVideoProxy(relativeVideoPath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.project.audioWaveformPeaks,
    async (_event, relativeAudioPath: string, bins: number): Promise<AudioWaveformResponse> => {
      return handlers.getAudioWaveformPeaks(relativeAudioPath, bins);
    },
  );
}
