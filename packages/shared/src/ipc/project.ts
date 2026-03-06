import type { Project } from '../types.js';

export interface ProjectResponse {
  success: boolean;
  message: string;
  project?: Project;
}

export interface WorkflowTemplateImportResponse {
  success: boolean;
  message: string;
  workflowId?: string;
  relativePath?: string;
}

export interface WorkflowPresetDraft {
  settings: Record<'width' | 'height' | 'fps' | 'frames' | 'steps', string>;
  inputs: Record<string, string>;
}

export interface WorkflowPresetItem {
  id: string;
  name: string;
  draft: WorkflowPresetDraft;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowPresetsMap {
  [workflowId: string]: WorkflowPresetItem[];
}

export interface WorkflowPresetsSaveRequest {
  presets: WorkflowPresetsMap;
  expectedUpdatedAtByWorkflow?: Record<string, string>;
}

export interface WorkflowPresetsResponse {
  success: boolean;
  message: string;
  presets: WorkflowPresetsMap;
  updatedAtByWorkflow?: Record<string, string>;
}

export interface ComfyGalleryListRequest {
  outputDir?: string;
  limit?: number;
}

export interface ComfyGalleryItem {
  absolutePath: string;
  fileName: string;
  kind: 'image' | 'video';
  sizeBytes: number;
  modifiedAt: string;
}

export interface ComfyGalleryListResponse {
  success: boolean;
  message: string;
  outputDir?: string;
  items: ComfyGalleryItem[];
}

export interface SavePreviewSnapshotRequest {
  dataUrl: string;
  timeSeconds: number;
  sourceName?: string;
}

export interface SavePreviewSnapshotResponse {
  success: boolean;
  message: string;
  path?: string;
}

export interface CreateComfyGalleryFolderRequest {
  outputDir?: string;
  folderName: string;
}

export interface CreateComfyGalleryFolderResponse {
  success: boolean;
  message: string;
  path?: string;
}

