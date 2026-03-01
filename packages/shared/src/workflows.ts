export type WorkflowCatalogCategory = 'images' | 'videos' | 'audio';

export type WorkflowMetaInputType = 'image' | 'video' | 'audio';

export interface WorkflowMetaInputDefinition {
  key: string;
  type: WorkflowMetaInputType;
  label: string;
  required: boolean;
}

export interface WorkflowMetaDefaults {
  width: number;
  height: number;
  fps: number;
  frames: number;
  steps: number;
}

export interface WorkflowMetaDefinition {
  id: string;
  name: string;
  category: WorkflowCatalogCategory;
  templateFile: string;
  inputs: WorkflowMetaInputDefinition[];
  defaults: WorkflowMetaDefaults;
}

export interface WorkflowCatalogEntry extends WorkflowMetaDefinition {
  metaRelativePath: string;
  templateRelativePath: string;
  templateExists: boolean;
}

export interface WorkflowCatalogResponse {
  success: boolean;
  message: string;
  projectWorkflowsRoot?: string;
  warnings: string[];
  workflows: WorkflowCatalogEntry[];
}
