import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { app, BrowserWindow, dialog } from 'electron';
import Ajv2020 from 'ajv/dist/2020.js';
import { IPC_CHANNELS } from '@ai-filmstudio/shared';
import type { AssetImportResponse, AudioWaveformResponse } from '@shared/ipc/assets';
import type {
  ProjectResponse,
  WorkflowPresetItem,
  WorkflowPresetsMap,
  WorkflowPresetsResponse,
  WorkflowTemplateImportResponse,
} from '@shared/ipc/project';
import type { Asset, Project } from '@shared/types';
import type {
  CancelComfyRunRequest,
  CancelComfyRunResponse,
  ComfyHealthRequest,
  ComfyHealthResponse,
  ComfyRunEvent,
  QueueComfyRunRequest,
  QueueComfyRunResponse,
} from '@shared/comfy';
import type {
  WorkflowCatalogResponse,
} from '@shared/workflows';
import projectSchema from '../../../../packages/shared/project.schema.json';
import {
  createVideoThumbnail,
  ensureVideoProxy as ensureVideoProxyService,
  getAudioWaveformPeaks as getAudioWaveformPeaksService,
  getFfmpegHealth as getFfmpegHealthService,
  probeVideoDurationSeconds,
} from './services/ffmpegService.js';
import {
  getAssetFileUrl as getAssetFileUrlService,
  getAssetMediaDataUrl as getAssetMediaDataUrlService,
  getAssetThumbnailDataUrl as getAssetThumbnailDataUrlService,
} from './services/assetService.js';
import { createComfyService, resolveComfyBaseUrlPolicy } from './services/comfyService.js';
import { createWorkflowCatalogService } from './services/workflowCatalogService.js';
import {
  registerIpc,
} from './ipc/registerIpc.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat('date-time', true);
const validateProject = ajv.compile<Project>(projectSchema);

const PROJECT_FILE_NAME = 'project.json';
const WORKFLOW_PRESETS_RELATIVE_PATH = path.join('workflows', 'presets.json');
const COMFY_RUN_EVENT_CHANNEL = IPC_CHANNELS.comfy.runEvent;

let currentProjectRoot: string | null = null;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function migrateProjectToV2(project: unknown): unknown {
  if (!isRecord(project)) {
    return project;
  }

  const schemaVersion = project.schemaVersion;
  if (schemaVersion === 2) {
    return project;
  }

  if (schemaVersion !== 1) {
    return project;
  }

  const timeline = isRecord(project.timeline) ? project.timeline : null;
  const oldClips = Array.isArray(timeline?.clips) ? timeline.clips : [];
  const migratedClips = oldClips.map((clip) => {
    if (!isRecord(clip)) {
      return clip;
    }
    return {
      ...clip,
      offset: 0,
    };
  });

  return {
    ...project,
    schemaVersion: 2,
    timeline: {
      tracks: [
        {
          id: 'track_video_1',
          kind: 'video',
          name: 'Video Track',
          clips: migratedClips,
        },
      ],
    },
  };
}

function runMigrationSanityCheck(): void {
  const v1Project: unknown = {
    schemaVersion: 1,
    timeline: {
      clips: [
        {
          id: 'clip-1',
          assetId: 'asset-1',
          start: 0,
          duration: 4,
        },
      ],
    },
  };

  const migrated = migrateProjectToV2(v1Project);
  if (!isRecord(migrated) || migrated.schemaVersion !== 2) {
    throw new Error('Migration sanity check failed: schemaVersion was not migrated to 2.');
  }

  const timeline = migrated.timeline;
  if (!isRecord(timeline) || !Array.isArray(timeline.tracks) || timeline.tracks.length !== 1) {
    throw new Error('Migration sanity check failed: timeline.tracks was not created.');
  }

  const firstTrack = timeline.tracks[0];
  if (!isRecord(firstTrack) || firstTrack.id !== 'track_video_1' || firstTrack.kind !== 'video') {
    throw new Error('Migration sanity check failed: default track is invalid.');
  }

  if (!Array.isArray(firstTrack.clips)) {
    throw new Error('Migration sanity check failed: default track clips are missing.');
  }

  const firstClip = firstTrack.clips[0];
  if (!isRecord(firstClip) || firstClip.offset !== 0) {
    throw new Error('Migration sanity check failed: clip offset was not added.');
  }
}

function resolveProjectPath(projectRoot: string, relativePath: string): string {
  return path.join(projectRoot, relativePath);
}

function createWindow(): void {
  const isDevRenderer = Boolean(process.env.ELECTRON_RENDERER_URL);
  const isProduction = !isDevRenderer;
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // Local-only dev workflow: allow renderer served from localhost
      // to load local file:// media sources for preview playback.
      webSecurity: isProduction,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function createEmptyProject(projectName: string): Project {
  return {
    schemaVersion: 2,
    projectId: randomUUID(),
    name: projectName,
    createdAt: new Date().toISOString(),
    assets: [],
    timeline: { tracks: [] },
    workflowDefinitions: [],
    workflowRuns: [],
  };
}

async function ensureProjectStructure(projectRoot: string): Promise<void> {
  const requiredFolders = [
    'assets',
    'assets/videos',
    'assets/images',
    'assets/audio',
    'assets/thumbnails',
    'generated',
    'cache',
    'cache/proxies',
    'workflows',
  ];

  await Promise.all(
    requiredFolders.map(async (folder) => {
      await fs.mkdir(resolveProjectPath(projectRoot, folder), { recursive: true });
    }),
  );
}

function normalizeWorkflowPresetsMap(value: unknown): WorkflowPresetsMap {
  if (!isRecord(value)) return {};
  const normalized: WorkflowPresetsMap = {};

  Object.entries(value).forEach(([workflowId, rawPresets]) => {
    if (!Array.isArray(rawPresets)) return;
    const items: WorkflowPresetItem[] = [];

    rawPresets.forEach((candidate) => {
      if (!isRecord(candidate)) return;
      const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
      const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
      const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString();
      const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : createdAt;
      const draftCandidate = isRecord(candidate.draft) ? candidate.draft : {};
      const settingsCandidate = isRecord(draftCandidate.settings) ? draftCandidate.settings : {};
      const inputsCandidate = isRecord(draftCandidate.inputs) ? draftCandidate.inputs : {};
      if (!id || !name) return;

      items.push({
        id,
        name,
        createdAt,
        updatedAt,
        draft: {
          settings: {
            width: String(settingsCandidate.width ?? ''),
            height: String(settingsCandidate.height ?? ''),
            fps: String(settingsCandidate.fps ?? ''),
            frames: String(settingsCandidate.frames ?? ''),
            steps: String(settingsCandidate.steps ?? ''),
          },
          inputs: Object.fromEntries(
            Object.entries(inputsCandidate)
              .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string')
              .map(([key, entryValue]) => [key, String(entryValue ?? '')]),
          ),
        },
      });
    });

    if (items.length > 0) {
      normalized[workflowId] = items
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 20);
    }
  });

  return normalized;
}

function mergeWorkflowPresets(base: WorkflowPresetsMap, incoming: WorkflowPresetsMap): WorkflowPresetsMap {
  const merged: WorkflowPresetsMap = {};
  const workflowIds = new Set([...Object.keys(base), ...Object.keys(incoming)]);

  workflowIds.forEach((workflowId) => {
    const byId = new Map<string, WorkflowPresetItem>();
    [...(base[workflowId] ?? []), ...(incoming[workflowId] ?? [])].forEach((preset) => {
      const existing = byId.get(preset.id);
      if (!existing) {
        byId.set(preset.id, preset);
        return;
      }
      const existingTs = new Date(existing.updatedAt).getTime();
      const nextTs = new Date(preset.updatedAt).getTime();
      if (Number.isFinite(nextTs) && (!Number.isFinite(existingTs) || nextTs >= existingTs)) {
        byId.set(preset.id, preset);
      }
    });

    const list = Array.from(byId.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 20);

    if (list.length > 0) {
      merged[workflowId] = list;
    }
  });

  return merged;
}

async function readWorkflowPresetsFromDisk(projectRoot: string): Promise<WorkflowPresetsMap> {
  const presetsPath = resolveProjectPath(projectRoot, WORKFLOW_PRESETS_RELATIVE_PATH);
  try {
    const raw = await fs.readFile(presetsPath, 'utf-8');
    return normalizeWorkflowPresetsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function getWorkflowPresets(): Promise<WorkflowPresetsResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.', presets: {} };
  }

  const presets = await readWorkflowPresetsFromDisk(currentProjectRoot);
  return { success: true, message: 'Workflow presets loaded.', presets };
}

async function saveWorkflowPresets(presets: WorkflowPresetsMap): Promise<WorkflowPresetsResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.', presets: {} };
  }

  const presetsPath = resolveProjectPath(currentProjectRoot, WORKFLOW_PRESETS_RELATIVE_PATH);
  const normalizedIncoming = normalizeWorkflowPresetsMap(presets);
  const diskPresets = await readWorkflowPresetsFromDisk(currentProjectRoot);
  const merged = mergeWorkflowPresets(diskPresets, normalizedIncoming);

  await fs.mkdir(path.dirname(presetsPath), { recursive: true });
  await fs.writeFile(presetsPath, JSON.stringify(merged, null, 2), 'utf-8');

  return { success: true, message: 'Workflow presets saved.', presets: merged };
}

async function saveProjectToCurrentRoot(project: Project): Promise<ProjectResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  if (!validateProject(project)) {
    const message = `Project validation failed: ${ajv.errorsText(validateProject.errors)}`;
    await dialog.showMessageBox({
      type: 'error',
      title: 'Save failed',
      message,
    });
    return { success: false, message };
  }

  const projectPath = resolveProjectPath(currentProjectRoot, PROJECT_FILE_NAME);
  await fs.writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');
  return { success: true, message: `Saved to ${projectPath}` };
}

function detectImportableAssetTypeFromExtension(fileName: string): 'video' | 'image' | 'audio' | null {
  const extension = path.extname(fileName).toLowerCase();
  if (['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi'].includes(extension)) {
    return 'video';
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(extension)) {
    return 'image';
  }
  if (['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac'].includes(extension)) {
    return 'audio';
  }
  return null;
}

const AUDIO_THUMBNAIL_PLACEHOLDER_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z4nQAAAAASUVORK5CYII=';

async function writeAudioThumbnailPlaceholder(absoluteThumbnailPath: string): Promise<void> {
  const placeholderBuffer = Buffer.from(AUDIO_THUMBNAIL_PLACEHOLDER_PNG_BASE64, 'base64');
  await fs.writeFile(absoluteThumbnailPath, placeholderBuffer);
}

async function ingestLocalFileAsProjectAsset(params: {
  sourcePath: string;
  type?: 'video' | 'image' | 'audio';
  originalName?: string;
}): Promise<AssetImportResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  const sourcePath = params.sourcePath;
  const originalName = (params.originalName ?? path.basename(sourcePath)).trim();
  const resolvedType = params.type ?? detectImportableAssetTypeFromExtension(originalName);
  if (!resolvedType) {
    return {
      success: false,
      message: `Unsupported output type for "${originalName}". Supported: image/video/audio files only.`,
    };
  }

  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const assetId = randomUUID();

  const relativeFilePath = path.posix.join(
    resolvedType === 'video' ? 'assets/videos' : resolvedType === 'image' ? 'assets/images' : 'assets/audio',
    `${assetId}_${safeName}${extension}`,
  );
  const relativeThumbnailPath = path.posix.join('assets/thumbnails', `${assetId}.${resolvedType === 'audio' ? 'png' : 'jpg'}`);

  const absoluteFilePath = resolveProjectPath(currentProjectRoot, relativeFilePath);
  const absoluteThumbnailPath = resolveProjectPath(currentProjectRoot, relativeThumbnailPath);

  await fs.copyFile(sourcePath, absoluteFilePath);

  if (resolvedType === 'video') {
    try {
      await createVideoThumbnail(absoluteFilePath, absoluteThumbnailPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        await dialog.showMessageBox({
          type: 'error',
          title: 'FFmpeg missing',
          message: 'FFmpeg not found in PATH',
        });
      } else {
        await dialog.showMessageBox({
          type: 'error',
          title: 'Thumbnail generation failed',
          message: `Failed to generate video thumbnail: ${nodeError.message}`,
        });
      }
    }
  } else if (resolvedType === 'image') {
    await fs.copyFile(sourcePath, absoluteThumbnailPath);
  } else {
    await writeAudioThumbnailPlaceholder(absoluteThumbnailPath);
  }

  const durationSeconds = resolvedType === 'video' || resolvedType === 'audio'
    ? await probeVideoDurationSeconds(absoluteFilePath)
    : null;

  const asset: Asset = {
    id: assetId,
    type: resolvedType,
    originalName,
    filePath: relativeFilePath,
    ...(durationSeconds ? { durationSeconds } : {}),
    thumbnailPath: relativeThumbnailPath,
    createdAt: new Date().toISOString(),
    tags: [],
    notes: '',
    status: 'idea',
  };

  return {
    success: true,
    message: `${resolvedType === 'video' ? 'Video' : resolvedType === 'image' ? 'Image' : 'Audio'} imported`,
    asset,
  };
}

async function importAssetFile(type: 'video' | 'image' | 'audio'): Promise<AssetImportResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  const result = await dialog.showOpenDialog({
    title: type === 'video' ? 'Import Video' : type === 'image' ? 'Import Image' : 'Import Audio',
    properties: ['openFile'],
    filters:
      type === 'video'
        ? [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm', 'm4v', 'avi'] }]
        : type === 'image'
          ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
          : [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, message: 'Import canceled' };
  }

  return ingestLocalFileAsProjectAsset({
    sourcePath: result.filePaths[0],
    type,
  });
}

async function importComfyOutput(outputPath: string): Promise<AssetImportResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  const normalized = outputPath.trim().replace(/\\/g, '/');
  if (!normalized) {
    return { success: false, message: 'Missing Comfy output path.' };
  }
  if (normalized.includes('..') || normalized.startsWith('/')) {
    return { success: false, message: `Invalid Comfy output path: ${outputPath}` };
  }

  const parsed = path.posix.parse(normalized);
  if (!parsed.base) {
    return { success: false, message: `Invalid Comfy output path: ${outputPath}` };
  }

  const inferredType = detectImportableAssetTypeFromExtension(parsed.base);
  if (!inferredType) {
    return {
      success: false,
      message: `Unsupported Comfy output extension: ${path.extname(parsed.base) || '(none)'}`,
    };
  }

  const baseUrlResolution = resolveComfyBaseUrlPolicy();
  if (!baseUrlResolution.ok) {
    return {
      success: false,
      message: `Comfy output import blocked: ${baseUrlResolution.message}`,
    };
  }
  const baseUrl = baseUrlResolution.baseUrl;
  const params = new URLSearchParams({
    filename: parsed.base,
    type: 'output',
  });
  if (parsed.dir) {
    params.set('subfolder', parsed.dir);
  }

  let tempPath: string | null = null;
  try {
    const response = await fetch(`${baseUrl}/view?${params.toString()}`);
    if (!response.ok) {
      return {
        success: false,
        message: `ComfyUI /view failed with HTTP ${response.status} for output "${normalized}".`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      return { success: false, message: `ComfyUI returned an empty file for "${normalized}".` };
    }

    tempPath = resolveProjectPath(
      currentProjectRoot,
      path.join('cache', 'comfy-imports', `${randomUUID()}_${parsed.base}`),
    );
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, buffer);

    return await ingestLocalFileAsProjectAsset({
      sourcePath: tempPath,
      type: inferredType,
      originalName: parsed.base,
    });
  } catch (error) {
    return {
      success: false,
      message: `Comfy output import failed: ${(error as Error).message}`,
    };
  } finally {
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}

async function importWorkflowTemplate(workflowId: string): Promise<WorkflowTemplateImportResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(workflowId)) {
    return {
      success: false,
      message: `Invalid workflow ID "${workflowId}". Allowed: letters, numbers, "-" and "_".`,
    };
  }

  const result = await dialog.showOpenDialog({
    title: `Import Workflow Template for ${workflowId}`,
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, message: 'Workflow template import canceled.' };
  }

  const sourcePath = result.filePaths[0];
  try {
    const rawContent = await fs.readFile(sourcePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as unknown;
    const normalized = toJsonValue(parsed);

    if (!isJsonObject(normalized)) {
      return {
        success: false,
        message: 'Workflow template must be a JSON object.',
      };
    }

    const relativePath = path.posix.join('workflows', `${workflowId}.api.json`);
    const destinationPath = resolveProjectPath(currentProjectRoot, relativePath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.writeFile(destinationPath, JSON.stringify(normalized, null, 2), 'utf-8');

    return {
      success: true,
      message: `Workflow template imported: ${relativePath}`,
      workflowId,
      relativePath,
    };
  } catch (error) {
    return {
      success: false,
      message: `Workflow template import failed: ${(error as Error).message}`,
    };
  }
}

function emitComfyRunEvent(event: Omit<ComfyRunEvent, 'occurredAt'>): void {
  const payload: ComfyRunEvent = {
    ...event,
    occurredAt: new Date().toISOString(),
  };

  BrowserWindow.getAllWindows().forEach((window) => {
    if (window.isDestroyed()) {
      return;
    }

    window.webContents.send(COMFY_RUN_EVENT_CHANNEL, payload);
  });
}

async function readCurrentProjectFromDisk(): Promise<Project> {
  if (!currentProjectRoot) {
    throw new Error('No project loaded. Create or load a project first.');
  }

  const projectPath = resolveProjectPath(currentProjectRoot, PROJECT_FILE_NAME);
  const content = await fs.readFile(projectPath, 'utf-8');
  const parsed = JSON.parse(content) as unknown;
  const migrated = migrateProjectToV2(parsed);

  if (!validateProject(migrated)) {
    throw new Error(`Project validation failed: ${ajv.errorsText(validateProject.errors)}`);
  }

  return migrated;
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

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const comfyService = createComfyService({
  getCurrentProjectRoot: () => currentProjectRoot,
  readCurrentProjectFromDisk,
  resolveProjectPath,
  emitRunEvent: emitComfyRunEvent,
});

const workflowCatalogService = createWorkflowCatalogService({
  getCurrentProjectRoot: () => currentProjectRoot,
  getGlobalWorkflowsRoot: () => path.resolve(app.getAppPath(), '../../workflows'),
  resolveProjectPath,
});

registerIpc({
  newProject: async (): Promise<ProjectResponse> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Project Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'New project canceled' };
    }

    const projectRoot = result.filePaths[0];
    await ensureProjectStructure(projectRoot);

    const projectName = path.basename(projectRoot);
    const project = createEmptyProject(projectName);

    if (!validateProject(project)) {
      return {
        success: false,
        message: `Project validation failed: ${ajv.errorsText(validateProject.errors)}`,
      };
    }

    const projectPath = resolveProjectPath(projectRoot, PROJECT_FILE_NAME);
    await fs.writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');

    currentProjectRoot = projectRoot;

    return {
      success: true,
      message: `Created project in ${projectRoot}`,
      project,
    };
  },
  saveProject: async (project: Project): Promise<ProjectResponse> => {
    return saveProjectToCurrentRoot(project);
  },
  loadProject: async (): Promise<ProjectResponse> => {
    const result = await dialog.showOpenDialog({
      title: 'Load project',
      properties: ['openFile'],
      filters: [{ name: 'Project JSON', extensions: ['json'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Load canceled' };
    }

    const projectPath = result.filePaths[0];
    if (path.basename(projectPath) !== PROJECT_FILE_NAME) {
      return { success: false, message: 'Please select project.json.' };
    }

    const content = await fs.readFile(projectPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    const migrated = migrateProjectToV2(parsed);

    if (!validateProject(migrated)) {
      return {
        success: false,
        message: `Loaded file is invalid: ${ajv.errorsText(validateProject.errors)}`,
      };
    }

    const project: Project = migrated;

    currentProjectRoot = path.dirname(projectPath);
    await ensureProjectStructure(currentProjectRoot);

    return {
      success: true,
      message: `Loaded from ${projectPath}`,
      project,
    };
  },
  getProjectRoot: (): string | null => {
    return currentProjectRoot;
  },
  listWorkflowCatalog: async (): Promise<WorkflowCatalogResponse> => {
    return workflowCatalogService.listCatalog();
  },
  getComfyHealth: async (request?: ComfyHealthRequest): Promise<ComfyHealthResponse> => {
    return comfyService.getComfyHealth(request);
  },
  queueComfyRun: async (payload: QueueComfyRunRequest): Promise<QueueComfyRunResponse> => {
    return comfyService.queueComfyRun(payload);
  },
  cancelComfyRun: async (payload: CancelComfyRunRequest): Promise<CancelComfyRunResponse> => {
    return comfyService.cancelComfyRun(payload);
  },
  importVideo: async (): Promise<AssetImportResponse> => {
    return importAssetFile('video');
  },
  importImage: async (): Promise<AssetImportResponse> => {
    return importAssetFile('image');
  },
  importAudio: async (): Promise<AssetImportResponse> => {
    return importAssetFile('audio');
  },
  importComfyOutput: async (outputPath: string): Promise<AssetImportResponse> => {
    return importComfyOutput(outputPath);
  },
  importWorkflowTemplate: async (workflowId: string): Promise<WorkflowTemplateImportResponse> => {
    return importWorkflowTemplate(workflowId);
  },
  getWorkflowPresets: async (): Promise<WorkflowPresetsResponse> => {
    return getWorkflowPresets();
  },
  saveWorkflowPresets: async (presets: WorkflowPresetsMap): Promise<WorkflowPresetsResponse> => {
    return saveWorkflowPresets(presets);
  },
  getAssetThumbnailDataUrl: async (relativePath: string): Promise<string | null> => {
    return getAssetThumbnailDataUrlService({
      projectRoot: currentProjectRoot,
      relativePath,
    });
  },
  getAssetFileUrl: async (relativePath: string): Promise<string | null> => {
    return getAssetFileUrlService({
      projectRoot: currentProjectRoot,
      relativePath,
    });
  },
  getAssetMediaDataUrl: async (relativePath: string): Promise<string | null> => {
    return getAssetMediaDataUrlService({
      projectRoot: currentProjectRoot,
      relativePath,
    });
  },
  getFfmpegHealth: async () => {
    return getFfmpegHealthService();
  },
  ensureVideoProxy: async (relativeVideoPath: string) => {
    return ensureVideoProxyService({
      projectRoot: currentProjectRoot,
      relativeVideoPath,
    });
  },
  getAudioWaveformPeaks: async (relativeAudioPath: string, bins: number): Promise<AudioWaveformResponse> => {
    return getAudioWaveformPeaksService({
      projectRoot: currentProjectRoot,
      relativeAudioPath,
      bins,
    });
  },
});

app.on('before-quit', () => {
  comfyService.dispose();
});

app.whenReady().then(() => {
  if (process.env.AI_SCENE_EDITOR_RUN_MIGRATION_SANITY === '1') {
    runMigrationSanityCheck();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
