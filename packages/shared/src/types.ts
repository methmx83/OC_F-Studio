export interface Asset {
  id: string;
  type: 'image' | 'video' | 'audio';
  originalName: string;
  filePath: string;
  durationSeconds?: number;
  thumbnailPath: string;
  createdAt: string;
  tags: string[];
  notes: string;
  status: 'idea' | 'generating' | 'review' | 'approved' | 'used';
}

export interface ClipAutomationPoint {
  time: number;
  value: number;
}

export interface ClipAutomation {
  gain?: ClipAutomationPoint[];
}

export interface Clip {
  id: string;
  assetId: string;
  start: number;
  duration: number;
  offset: number;
  gain?: number;
  automation?: ClipAutomation;
}

export interface Track {
  id: string;
  kind: 'video' | 'overlay' | 'audio' | 'text';
  name: string;
  clips: Clip[];
}

export interface Timeline {
  tracks: Track[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  config: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: string;
}

export interface Project {
  schemaVersion: number;
  projectId: string;
  name: string;
  createdAt: string;
  assets: Asset[];
  timeline: Timeline;
  workflowDefinitions: WorkflowDefinition[];
  workflowRuns: WorkflowRun[];
}
