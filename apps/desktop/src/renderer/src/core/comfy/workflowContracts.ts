/* eslint-disable no-unused-vars */
import type { ComfyWorkflowRunRequest } from '@shared/comfy';

export type WorkflowAssetKind = 'image' | 'video' | 'audio';

export type WorkflowContractId = ComfyWorkflowRunRequest['workflowId'];

export type WorkflowParameterValue = number | string;
export type WorkflowParameterMap = Record<string, WorkflowParameterValue>;

export interface NumberWorkflowFieldDef {
  kind: 'number';
  key: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface AssetWorkflowFieldDef {
  kind: 'asset';
  key: string;
  label: string;
  accepts: readonly WorkflowAssetKind[];
  required?: boolean;
  defaultValue?: string;
}

export type WorkflowFieldDef = NumberWorkflowFieldDef | AssetWorkflowFieldDef;

export interface WorkflowContractDefinition<TId extends WorkflowContractId = WorkflowContractId> {
  id: TId;
  name: string;
  description: string;
  fields: readonly WorkflowFieldDef[];
  toRequest: (params: WorkflowParameterMap) => Extract<ComfyWorkflowRunRequest, { workflowId: TId }> | null;
}

const COMMON_FIELDS: readonly NumberWorkflowFieldDef[] = [
  { kind: 'number', key: 'width', label: 'Width', defaultValue: 1280, min: 64, step: 1 },
  { kind: 'number', key: 'height', label: 'Height', defaultValue: 720, min: 64, step: 1 },
  { kind: 'number', key: 'fps', label: 'FPS', defaultValue: 24, min: 1, step: 1 },
  { kind: 'number', key: 'frames', label: 'Frames', defaultValue: 120, min: 1, step: 1 },
  { kind: 'number', key: 'steps', label: 'Steps', defaultValue: 20, min: 1, step: 1 },
];

export const WORKFLOW_CONTRACTS: readonly WorkflowContractDefinition[] = [
  {
    id: 'img_audio_v1',
    name: 'Image + Audio',
    description: 'One image plus one audio asset.',
    fields: [
      ...COMMON_FIELDS,
      { kind: 'asset', key: 'imageAssetId', label: 'Image', accepts: ['image'], required: true },
      { kind: 'asset', key: 'audioAssetId', label: 'Audio', accepts: ['audio'], required: true },
    ],
    toRequest: (params) => {
      const imageAssetId = getStringParam(params, 'imageAssetId');
      const audioAssetId = getStringParam(params, 'audioAssetId');
      if (!imageAssetId || !audioAssetId) {
        return null;
      }

      return {
        workflowId: 'img_audio_v1',
        width: getNumberParam(params, 'width', 1280),
        height: getNumberParam(params, 'height', 720),
        fps: getNumberParam(params, 'fps', 24),
        frames: getNumberParam(params, 'frames', 120),
        steps: getNumberParam(params, 'steps', 20),
        imageAssetId,
        audioAssetId,
      };
    },
  },
  {
    id: 'img_two_clips_v1',
    name: 'Image + Two Clips',
    description: 'One image and two video clip references.',
    fields: [
      ...COMMON_FIELDS,
      { kind: 'asset', key: 'imageAssetId', label: 'Image', accepts: ['image'], required: true },
      { kind: 'asset', key: 'clipAAssetId', label: 'Clip A', accepts: ['video'], required: true },
      { kind: 'asset', key: 'clipBAssetId', label: 'Clip B', accepts: ['video'], required: true },
    ],
    toRequest: (params) => {
      const imageAssetId = getStringParam(params, 'imageAssetId');
      const clipAAssetId = getStringParam(params, 'clipAAssetId');
      const clipBAssetId = getStringParam(params, 'clipBAssetId');
      if (!imageAssetId || !clipAAssetId || !clipBAssetId) {
        return null;
      }

      return {
        workflowId: 'img_two_clips_v1',
        width: getNumberParam(params, 'width', 1280),
        height: getNumberParam(params, 'height', 720),
        fps: getNumberParam(params, 'fps', 24),
        frames: getNumberParam(params, 'frames', 120),
        steps: getNumberParam(params, 'steps', 20),
        imageAssetId,
        clipAAssetId,
        clipBAssetId,
      };
    },
  },
];

export function getWorkflowContractById(workflowId: string): WorkflowContractDefinition | null {
  return WORKFLOW_CONTRACTS.find((contract) => contract.id === workflowId) ?? null;
}

export function createDefaultWorkflowParameters(contract: WorkflowContractDefinition): WorkflowParameterMap {
  const next: WorkflowParameterMap = {};
  contract.fields.forEach((field) => {
    if (field.kind === 'number') {
      next[field.key] = field.defaultValue;
      return;
    }

    if (typeof field.defaultValue === 'string') {
      next[field.key] = field.defaultValue;
    }
  });
  return next;
}

function getNumberParam(params: WorkflowParameterMap, key: string, fallback: number): number {
  const value = params[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function getStringParam(params: WorkflowParameterMap, key: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : '';
}
