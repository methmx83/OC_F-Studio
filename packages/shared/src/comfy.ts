export interface BaseWorkflowRunRequest {
  workflowId: string;
  workflowTemplateRelativePath?: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  steps: number;
}

export interface ImageAudioWorkflowRunRequest extends BaseWorkflowRunRequest {
  workflowId: 'img_audio_v1';
  imageAssetId: string;
  audioAssetId: string;
}

export interface ImageTwoClipsWorkflowRunRequest extends BaseWorkflowRunRequest {
  workflowId: 'img_two_clips_v1';
  imageAssetId: string;
  clipAAssetId: string;
  clipBAssetId: string;
}

export interface GenericComfyWorkflowRunRequest extends BaseWorkflowRunRequest {
  workflowId: string;
  [key: string]: string | number | undefined;
}

export type KnownComfyWorkflowRunRequest =
  | ImageAudioWorkflowRunRequest
  | ImageTwoClipsWorkflowRunRequest;

export type ComfyWorkflowRunRequest =
  | KnownComfyWorkflowRunRequest
  | GenericComfyWorkflowRunRequest;

export interface ComfyHealthRequest {
  baseUrlOverride?: string;
}

export interface QueueComfyRunRequest {
  runId: string;
  request: ComfyWorkflowRunRequest;
  baseUrlOverride?: string;
}

export interface QueueComfyRunResponse {
  success: boolean;
  message: string;
  runId: string;
  promptId?: string;
}

export interface CancelComfyRunRequest {
  runId: string;
  promptId?: string;
  baseUrlOverride?: string;
}

export interface CancelComfyRunResponse {
  success: boolean;
  message: string;
  runId: string;
}

export interface ComfyHealthResponse {
  online: boolean;
  baseUrl: string;
  message: string;
}

export type ComfyRunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface ComfyRunEvent {
  runId: string;
  promptId?: string;
  workflowId: string;
  status: ComfyRunStatus;
  message: string;
  progress: number | null;
  outputPaths: string[];
  occurredAt: string;
}
