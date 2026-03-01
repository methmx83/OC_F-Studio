/* eslint-disable no-unused-vars */
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Project } from '@shared/types';
import type {
  CancelComfyRunRequest,
  CancelComfyRunResponse,
  ComfyHealthRequest,
  ComfyHealthResponse,
  ComfyRunEvent,
  ComfyWorkflowRunRequest,
  QueueComfyRunRequest,
  QueueComfyRunResponse,
} from '@shared/comfy';

const COMFY_POLL_INTERVAL_MS = 1200;
const COMFY_MAX_POLL_ATTEMPTS = 6000;
const COMFY_DEFAULT_BASE_URL = 'http://127.0.0.1:8188';
const COMFY_REMOTE_OPT_IN_ENV = 'COMFYUI_ALLOW_REMOTE';
const LOCAL_COMFY_HOST_ALLOWLIST = new Set(['localhost', '127.0.0.1', '::1']);

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ComfyBaseUrlPolicyResult =
  | {
    ok: true;
    baseUrl: string;
    warningMessage: string | null;
  }
  | {
    ok: false;
    baseUrl: string;
    message: string;
  };

export interface ComfyService {
  getComfyHealth(request?: ComfyHealthRequest): Promise<ComfyHealthResponse>;
  queueComfyRun(payload: QueueComfyRunRequest): Promise<QueueComfyRunResponse>;
  cancelComfyRun(payload: CancelComfyRunRequest): Promise<CancelComfyRunResponse>;
  dispose(): void;
}

export interface CreateComfyServiceOptions {
  getCurrentProjectRoot(): string | null;
  readCurrentProjectFromDisk(): Promise<Project>;
  resolveProjectPath(projectRoot: string, relativePath: string): string;
  emitRunEvent(event: Omit<ComfyRunEvent, 'occurredAt'>): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Workflow template contains a non-finite number.');
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry));
  }

  if (!isRecord(value)) {
    throw new Error('Workflow template must be valid JSON.');
  }

  const recordValue: { [key: string]: JsonValue } = {};
  Object.entries(value).forEach(([key, entry]) => {
    recordValue[key] = toJsonValue(entry);
  });
  return recordValue;
}

function isRemoteComfyHostAllowed(): boolean {
  const raw = process.env[COMFY_REMOTE_OPT_IN_ENV]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function appendWarning(message: string, warningMessage: string | null): string {
  if (!warningMessage) {
    return message;
  }
  return `${message} ${warningMessage}`;
}

export function resolveComfyBaseUrlPolicy(baseUrlOverride?: string): ComfyBaseUrlPolicyResult {
  const overrideUrl = baseUrlOverride?.trim();
  const configuredUrl = process.env.COMFYUI_BASE_URL?.trim();
  const unresolvedBaseUrl = overrideUrl && overrideUrl.length > 0
    ? overrideUrl
    : configuredUrl && configuredUrl.length > 0
      ? configuredUrl
      : COMFY_DEFAULT_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(unresolvedBaseUrl);
  } catch {
    return {
      ok: false,
      baseUrl: unresolvedBaseUrl,
      message: `Invalid COMFYUI_BASE_URL "${unresolvedBaseUrl}". Expected absolute http(s) URL.`,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      baseUrl: unresolvedBaseUrl,
      message: `Unsupported COMFYUI_BASE_URL protocol "${parsed.protocol}". Use http:// or https://.`,
    };
  }

  const isLocalHost = LOCAL_COMFY_HOST_ALLOWLIST.has(parsed.hostname.toLowerCase());
  const remoteOptInEnabled = isRemoteComfyHostAllowed();
  if (!isLocalHost && !remoteOptInEnabled) {
    return {
      ok: false,
      baseUrl: unresolvedBaseUrl,
      message: `Remote ComfyUI host "${parsed.hostname}" blocked by local-only policy. Set ${COMFY_REMOTE_OPT_IN_ENV}=1 to allow remote hosts.`,
    };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  const baseUrl = `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  return {
    ok: true,
    baseUrl,
    warningMessage: isLocalHost
      ? null
      : `Warning: remote ComfyUI host "${parsed.hostname}" enabled via ${COMFY_REMOTE_OPT_IN_ENV}=1.`,
  };
}

export function resolveComfyBaseUrl(baseUrlOverride?: string): string {
  const resolution = resolveComfyBaseUrlPolicy(baseUrlOverride);
  if (!resolution.ok) {
    throw new Error(resolution.message);
  }
  return resolution.baseUrl;
}

async function readWorkflowTemplate(
  projectRoot: string,
  workflowId: string,
  resolveProjectPath: (projectRoot: string, relativePath: string) => string,
): Promise<JsonValue> {
  if (!/^[a-zA-Z0-9_-]+$/.test(workflowId)) {
    throw new Error(`Workflow ID "${workflowId}" contains unsupported characters.`);
  }

  const templatePath = resolveProjectPath(projectRoot, path.join('workflows', `${workflowId}.api.json`));
  let raw: string;
  try {
    raw = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      throw new Error(`Workflow template missing: workflows/${workflowId}.api.json`);
    }
    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;
  return toJsonValue(parsed);
}

function buildWorkflowTemplateVariables(
  request: ComfyWorkflowRunRequest,
  project: Project,
  projectRoot: string,
  resolveProjectPath: (projectRoot: string, relativePath: string) => string,
): Record<string, JsonPrimitive> {
  const variables: Record<string, JsonPrimitive> = {
    workflowId: request.workflowId,
    width: request.width,
    height: request.height,
    fps: request.fps,
    frames: request.frames,
    steps: request.steps,
    projectRoot,
  };

  const requestEntries = Object.entries(request) as Array<[string, unknown]>;
  requestEntries.forEach(([key, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      variables[key] = value;
      return;
    }

    if (typeof value === 'string') {
      variables[key] = value;

      if (!key.endsWith('AssetId')) {
        return;
      }

      const asset = project.assets.find((candidate) => candidate.id === value);
      if (!asset) {
        throw new Error(`Asset "${value}" referenced by "${key}" was not found in project assets.`);
      }

      const assetKeyBase = key.slice(0, -2);
      variables[`${assetKeyBase}Path`] = asset.filePath;
      variables[`${assetKeyBase}AbsPath`] = resolveProjectPath(projectRoot, asset.filePath);
      variables[`${assetKeyBase}Name`] = asset.originalName;
      variables[`${assetKeyBase}Type`] = asset.type;
    }
  });

  return variables;
}

function replaceTemplateString(
  source: string,
  variables: Record<string, JsonPrimitive>,
): JsonValue {
  const exactMatch = source.match(/^{{([a-zA-Z0-9_]+)}}$/);
  if (exactMatch) {
    const token = exactMatch[1];
    if (Object.prototype.hasOwnProperty.call(variables, token)) {
      return variables[token];
    }
    return source;
  }

  return source.replace(/{{([a-zA-Z0-9_]+)}}/g, (fullToken, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, token)) {
      return fullToken;
    }

    const resolved = variables[token];
    return resolved === null ? '' : String(resolved);
  });
}

function applyTemplateVariables(
  template: JsonValue,
  variables: Record<string, JsonPrimitive>,
): JsonValue {
  if (typeof template === 'string') {
    return replaceTemplateString(template, variables);
  }

  if (Array.isArray(template)) {
    return template.map((entry) => applyTemplateVariables(entry, variables));
  }

  if (!isJsonObject(template)) {
    return template;
  }

  const next: { [key: string]: JsonValue } = {};
  Object.entries(template).forEach(([key, value]) => {
    next[key] = applyTemplateVariables(value, variables);
  });
  return next;
}

function collectMissingTemplateTokens(
  value: JsonValue,
  variables: Record<string, JsonPrimitive>,
  missing: Set<string>,
): void {
  if (typeof value === 'string') {
    const matches = value.matchAll(/{{([a-zA-Z0-9_]+)}}/g);
    for (const match of matches) {
      const token = match[1];
      if (!Object.prototype.hasOwnProperty.call(variables, token)) {
        missing.add(token);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectMissingTemplateTokens(entry, variables, missing));
    return;
  }

  if (!isJsonObject(value)) {
    return;
  }

  Object.values(value).forEach((entry) => collectMissingTemplateTokens(entry, variables, missing));
}

interface ComfyPromptSubmitResult {
  promptId: string;
}

async function requestComfyInterrupt(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/interrupt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`ComfyUI /interrupt failed with HTTP ${response.status}: ${raw.slice(0, 200)}`);
  }
}

async function submitComfyPrompt(baseUrl: string, promptTemplate: JsonValue): Promise<ComfyPromptSubmitResult> {
  const payload = isJsonObject(promptTemplate) && Object.prototype.hasOwnProperty.call(promptTemplate, 'prompt')
    ? { ...promptTemplate, client_id: randomUUID() }
    : { prompt: promptTemplate, client_id: randomUUID() };

  const response = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`ComfyUI /prompt failed with HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }

  let parsed: unknown = {};
  try {
    parsed = raw.length > 0 ? JSON.parse(raw) : {};
  } catch {
    throw new Error('ComfyUI /prompt did not return valid JSON.');
  }

  const promptId = extractPromptId(parsed);
  if (!promptId) {
    throw new Error('ComfyUI /prompt response did not contain prompt_id.');
  }

  return { promptId };
}

function extractPromptId(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidate = payload.prompt_id;
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate;
  }

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return String(candidate);
  }

  return null;
}

interface EvaluatedComfyHistory {
  status: 'running' | 'success' | 'failed';
  message: string;
  outputPaths: string[];
}

function extractComfyOutputPaths(outputs: unknown): string[] {
  if (!isRecord(outputs)) {
    return [];
  }

  const result = new Set<string>();
  Object.values(outputs).forEach((nodeOutput) => {
    if (!isRecord(nodeOutput)) {
      return;
    }

    Object.values(nodeOutput).forEach((candidateList) => {
      if (!Array.isArray(candidateList)) {
        return;
      }

      candidateList.forEach((entry) => {
        if (!isRecord(entry)) {
          return;
        }

        const filename = typeof entry.filename === 'string' ? entry.filename : '';
        if (!filename) {
          return;
        }

        const subfolder = typeof entry.subfolder === 'string'
          ? entry.subfolder.replace(/\\/g, '/')
          : '';
        const outputPath = subfolder ? path.posix.join(subfolder, filename) : filename;
        result.add(outputPath);
      });
    });
  });

  return Array.from(result);
}

function evaluateComfyHistory(promptId: string, payload: unknown): EvaluatedComfyHistory | null {
  if (!isRecord(payload)) {
    return null;
  }

  const run = payload[promptId];
  if (!isRecord(run)) {
    return null;
  }

  const outputPaths = extractComfyOutputPaths(run.outputs);
  const statusRecord = isRecord(run.status) ? run.status : null;
  const statusText = typeof statusRecord?.status_str === 'string'
    ? statusRecord.status_str.toLowerCase()
    : '';

  if (statusText === 'error' || statusText === 'failed') {
    return {
      status: 'failed',
      message: 'ComfyUI reported workflow failure.',
      outputPaths: [],
    };
  }

  if (statusText === 'success' || statusText === 'completed' || outputPaths.length > 0) {
    return {
      status: 'success',
      message: outputPaths.length > 0 ? `Workflow completed (${outputPaths.length} output file(s)).` : 'Workflow completed.',
      outputPaths,
    };
  }

  return {
    status: 'running',
    message: 'Workflow running.',
    outputPaths: [],
  };
}

function createAbortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  if (isRecord(error)) {
    return typeof error.name === 'string' && error.name === 'AbortError';
  }

  return false;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      clearTimeout(timeoutHandle);
      cleanup();
      reject(createAbortError());
    };

    const timeoutHandle = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function monitorComfyRun(params: {
  runId: string;
  workflowId: string;
  promptId: string;
  baseUrl: string;
  emitRunEvent: (event: Omit<ComfyRunEvent, 'occurredAt'>) => void;
  signal: AbortSignal;
}): Promise<void> {
  const {
    runId,
    workflowId,
    promptId,
    baseUrl,
    emitRunEvent,
    signal,
  } = params;

  if (signal.aborted) {
    return;
  }

  emitRunEvent({
    runId,
    promptId,
    workflowId,
    status: 'running',
    message: 'Workflow execution started.',
    progress: null,
    outputPaths: [],
  });

  for (let attempt = 0; attempt < COMFY_MAX_POLL_ATTEMPTS; attempt += 1) {
    if (signal.aborted) {
      return;
    }

    try {
      await delay(COMFY_POLL_INTERVAL_MS, signal);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      throw error;
    }

    try {
      const response = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`, { signal });
      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as unknown;
      const evaluated = evaluateComfyHistory(promptId, payload);
      if (!evaluated || evaluated.status === 'running') {
        continue;
      }

      emitRunEvent({
        runId,
        promptId,
        workflowId,
        status: evaluated.status,
        message: evaluated.message,
        progress: 1,
        outputPaths: evaluated.outputPaths,
      });
      return;
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      // Network hiccups are expected while polling.
    }
  }

  if (signal.aborted) {
    return;
  }

  emitRunEvent({
    runId,
    promptId,
    workflowId,
    status: 'failed',
    message: 'ComfyUI polling timed out before completion.',
    progress: null,
    outputPaths: [],
  });
}

export function createComfyService(options: CreateComfyServiceOptions): ComfyService {
  const activePollControllers = new Map<string, AbortController>();
  let isDisposed = false;

  function stopPollingRun(runId: string): void {
    const controller = activePollControllers.get(runId);
    if (!controller) {
      return;
    }

    controller.abort();
    activePollControllers.delete(runId);
  }

  function stopAllPolling(): void {
    activePollControllers.forEach((controller) => {
      controller.abort();
    });
    activePollControllers.clear();
  }

  return {
    async getComfyHealth(request?: ComfyHealthRequest): Promise<ComfyHealthResponse> {
      const resolution = resolveComfyBaseUrlPolicy(request?.baseUrlOverride);
      if (!resolution.ok) {
        return {
          online: false,
          baseUrl: resolution.baseUrl,
          message: resolution.message,
        };
      }

      const { baseUrl, warningMessage } = resolution;
      try {
        const response = await fetch(`${baseUrl}/system_stats`);
        if (!response.ok) {
          return {
            online: false,
            baseUrl,
            message: appendWarning(`ComfyUI responded with HTTP ${response.status}.`, warningMessage),
          };
        }

        return {
          online: true,
          baseUrl,
          message: appendWarning(`ComfyUI reachable at ${baseUrl}.`, warningMessage),
        };
      } catch (error) {
        return {
          online: false,
          baseUrl,
          message: appendWarning(`ComfyUI not reachable: ${(error as Error).message}`, warningMessage),
        };
      }
    },

    async queueComfyRun(payload: QueueComfyRunRequest): Promise<QueueComfyRunResponse> {
      const runId = payload.runId?.trim();
      if (!runId) {
        return { success: false, message: 'Missing runId.', runId: payload.runId };
      }

      if (isDisposed) {
        return { success: false, message: 'Comfy service is shutting down.', runId };
      }

      const projectRoot = options.getCurrentProjectRoot();
      if (!projectRoot) {
        return {
          success: false,
          message: 'No project loaded. Create or load a project first.',
          runId,
        };
      }

      const workflowRequest = payload.request;
      const baseUrlResolution = resolveComfyBaseUrlPolicy(payload.baseUrlOverride);
      if (!baseUrlResolution.ok) {
        const message = `Failed to queue workflow: ${baseUrlResolution.message}`;
        options.emitRunEvent({
          runId,
          workflowId: workflowRequest.workflowId,
          status: 'failed',
          message,
          progress: null,
          outputPaths: [],
        });
        return {
          success: false,
          message,
          runId,
        };
      }
      const baseUrl = baseUrlResolution.baseUrl;
      const warningMessage = baseUrlResolution.warningMessage;

      options.emitRunEvent({
        runId,
        workflowId: workflowRequest.workflowId,
        status: 'pending',
        message: 'Preparing workflow payload...',
        progress: null,
        outputPaths: [],
      });

      try {
        const project = await options.readCurrentProjectFromDisk();
        const template = await readWorkflowTemplate(projectRoot, workflowRequest.workflowId, options.resolveProjectPath);
        const variables = buildWorkflowTemplateVariables(
          workflowRequest,
          project,
          projectRoot,
          options.resolveProjectPath,
        );
        const renderedTemplate = applyTemplateVariables(template, variables);

        const missingTokens = new Set<string>();
        collectMissingTemplateTokens(renderedTemplate, variables, missingTokens);
        if (missingTokens.size > 0) {
          const missingJoined = Array.from(missingTokens).sort().join(', ');
          throw new Error(`Workflow template contains unresolved placeholders: ${missingJoined}`);
        }

        const submitResult = await submitComfyPrompt(baseUrl, renderedTemplate);

        options.emitRunEvent({
          runId,
          promptId: submitResult.promptId,
          workflowId: workflowRequest.workflowId,
          status: 'pending',
          message: `Queued in ComfyUI (prompt_id: ${submitResult.promptId}).`,
          progress: 0,
          outputPaths: [],
        });

        stopPollingRun(runId);
        const pollController = new AbortController();
        activePollControllers.set(runId, pollController);

        void monitorComfyRun({
          runId,
          workflowId: workflowRequest.workflowId,
          promptId: submitResult.promptId,
          baseUrl,
          emitRunEvent: options.emitRunEvent,
          signal: pollController.signal,
        }).finally(() => {
          const activeController = activePollControllers.get(runId);
          if (activeController === pollController) {
            activePollControllers.delete(runId);
          }
        });

        return {
          success: true,
          message: appendWarning('Workflow queued in ComfyUI.', warningMessage),
          runId,
          promptId: submitResult.promptId,
        };
      } catch (error) {
        const message = `Failed to queue workflow: ${(error as Error).message}`;
        options.emitRunEvent({
          runId,
          workflowId: workflowRequest.workflowId,
          status: 'failed',
          message,
          progress: null,
          outputPaths: [],
        });
        return {
          success: false,
          message,
          runId,
        };
      }
    },

    async cancelComfyRun(payload: CancelComfyRunRequest): Promise<CancelComfyRunResponse> {
      const runId = payload.runId?.trim();
      if (!runId) {
        return { success: false, message: 'Missing runId.', runId: payload.runId };
      }

      stopPollingRun(runId);

      const baseUrlResolution = resolveComfyBaseUrlPolicy(payload.baseUrlOverride);
      if (!baseUrlResolution.ok) {
        const message = `Failed to cancel workflow: ${baseUrlResolution.message}`;
        options.emitRunEvent({
          runId,
          workflowId: 'unknown',
          promptId: payload.promptId,
          status: 'failed',
          message,
          progress: null,
          outputPaths: [],
        });
        return { success: false, message, runId };
      }

      try {
        await requestComfyInterrupt(baseUrlResolution.baseUrl);
      } catch (error) {
        const message = `Comfy cancel request failed: ${(error as Error).message}`;
        options.emitRunEvent({
          runId,
          workflowId: 'unknown',
          promptId: payload.promptId,
          status: 'failed',
          message,
          progress: null,
          outputPaths: [],
        });
        return { success: false, message, runId };
      }

      const message = 'Workflow cancel requested by user.';
      options.emitRunEvent({
        runId,
        workflowId: 'unknown',
        promptId: payload.promptId,
        status: 'failed',
        message,
        progress: null,
        outputPaths: [],
      });

      return { success: true, message, runId };
    },

    dispose(): void {
      isDisposed = true;
      stopAllPolling();
    },
  };
}
