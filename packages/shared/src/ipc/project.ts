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

export interface WorkflowPresetsResponse {
  success: boolean;
  message: string;
  presets: WorkflowPresetsMap;
}

