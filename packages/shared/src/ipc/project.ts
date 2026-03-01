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

