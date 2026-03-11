import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { app, BrowserWindow, dialog, shell } from 'electron';
import Ajv2020 from 'ajv/dist/2020.js';
import { IPC_CHANNELS } from '@ai-filmstudio/shared';
import type { AssetImportResponse, AudioWaveformResponse } from '@shared/ipc/assets';
import type {
  AnalyzeImageWithOllamaRequest,
  AnalyzeImageWithOllamaResponse,
  ComfyGalleryListRequest,
  ComfyGalleryListResponse,
  CreateComfyGalleryFolderRequest,
  CreateComfyGalleryFolderResponse,
  ProjectSnapshotReason,
  ProjectAutosaveListResponse,
  ProjectResponse,
  RevealPreviewSnapshotRequest,
  RevealPreviewSnapshotResponse,
  SaveProjectReason,
  SavePreviewSnapshotRequest,
  SavePreviewSnapshotResponse,
  WorkflowPresetItem,
  WorkflowPresetsMap,
  WorkflowPresetsResponse,
  WorkflowPresetsSaveRequest,
  WorkflowTemplateImportResponse,
} from '@shared/ipc/project';
import type { Asset, Project } from '@shared/types';
import type {
  CancelComfyRunRequest,
  CancelComfyRunResponse,
  ComfyHealthRequest,
  ComfyHealthResponse,
  ComfyRunEvent,
  PreviewComfyRunPayloadRequest,
  PreviewComfyRunPayloadResponse,
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
const WORKFLOW_PRESETS_LEGACY_RELATIVE_PATH = path.join('workflows', 'presets.json');
const WORKFLOW_PRESETS_DIRECTORY_RELATIVE_PATH = path.join('workflows', 'presets');
const AUTOSAVE_DIRECTORY_RELATIVE_PATH = path.join('cache', 'autosave');
const AUTOSAVE_FILE_PREFIX = 'project.autosave.';
const AUTOSAVE_FILE_SUFFIX = '.json';
const MAX_AUTOSAVE_SNAPSHOTS = 20;
const SESSION_STATE_FILE_NAME = 'scene-editor.session.json';
const COMFY_RUN_EVENT_CHANNEL = IPC_CHANNELS.comfy.runEvent;

let currentProjectRoot: string | null = null;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
interface SessionState {
  lastProjectRoot?: string;
}

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

function resolveSessionStatePath(): string {
  return path.join(app.getPath('userData'), SESSION_STATE_FILE_NAME);
}

async function readSessionState(): Promise<SessionState> {
  try {
    const raw = await fs.readFile(resolveSessionStatePath(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    const lastProjectRoot = typeof parsed.lastProjectRoot === 'string'
      ? parsed.lastProjectRoot.trim()
      : '';
    return lastProjectRoot ? { lastProjectRoot } : {};
  } catch {
    return {};
  }
}

async function writeSessionState(state: SessionState): Promise<void> {
  const filePath = resolveSessionStatePath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Session persistence is best-effort only.
  }
}

async function persistLastProjectRoot(projectRoot: string): Promise<void> {
  await writeSessionState({ lastProjectRoot: projectRoot });
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
      webviewTag: true,
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

function resolveWorkflowPresetFilePath(projectRoot: string, workflowId: string): string {
  return resolveProjectPath(projectRoot, path.join(WORKFLOW_PRESETS_DIRECTORY_RELATIVE_PATH, `${workflowId}.presets.json`));
}

async function readWorkflowPresetsLegacyFromDisk(projectRoot: string): Promise<WorkflowPresetsMap> {
  const presetsPath = resolveProjectPath(projectRoot, WORKFLOW_PRESETS_LEGACY_RELATIVE_PATH);
  try {
    const raw = await fs.readFile(presetsPath, 'utf-8');
    return normalizeWorkflowPresetsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function hasPerWorkflowPresetFiles(projectRoot: string): Promise<boolean> {
  const presetsDir = resolveProjectPath(projectRoot, WORKFLOW_PRESETS_DIRECTORY_RELATIVE_PATH);
  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.presets.json'));
  } catch {
    return false;
  }
}

async function readWorkflowPresetsFromDisk(projectRoot: string): Promise<{ presets: WorkflowPresetsMap; invalidFiles: string[] }> {
  const presetsDir = resolveProjectPath(projectRoot, WORKFLOW_PRESETS_DIRECTORY_RELATIVE_PATH);
  const fromFiles: WorkflowPresetsMap = {};
  const invalidFiles: string[] = [];

  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.presets.json')) {
        continue;
      }

      const workflowId = entry.name.slice(0, -'.presets.json'.length);
      if (!workflowId) {
        continue;
      }

      try {
        const fullPath = path.join(presetsDir, entry.name);
        const raw = await fs.readFile(fullPath, 'utf-8');
        const parsed = JSON.parse(raw) as unknown;
        const normalized = normalizeWorkflowPresetsMap({ [workflowId]: parsed });
        if (normalized[workflowId]?.length) {
          fromFiles[workflowId] = normalized[workflowId];
        }
      } catch {
        invalidFiles.push(entry.name);
      }
    }
  } catch {
    // ignore missing presets dir, legacy fallback below
  }

  const legacy = await readWorkflowPresetsLegacyFromDisk(projectRoot);
  return {
    presets: mergeWorkflowPresets(legacy, fromFiles),
    invalidFiles,
  };
}

async function writePerWorkflowPresetFiles(projectRoot: string, presets: WorkflowPresetsMap, prune = false): Promise<void> {
  const presetsDir = resolveProjectPath(projectRoot, WORKFLOW_PRESETS_DIRECTORY_RELATIVE_PATH);
  await fs.mkdir(presetsDir, { recursive: true });

  if (prune) {
    try {
      const dirEntries = await fs.readdir(presetsDir, { withFileTypes: true });
      const validFileNames = new Set(Object.keys(presets).map((workflowId) => `${workflowId}.presets.json`));
      const removeOps = dirEntries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.presets.json'))
        .filter((entry) => !validFileNames.has(entry.name))
        .map((entry) => fs.unlink(path.join(presetsDir, entry.name)));
      await Promise.all(removeOps);
    } catch {
      // best-effort cleanup only
    }
  }

  const sortedWorkflowIds = Object.keys(presets).sort((a, b) => a.localeCompare(b));
  const writeOps = sortedWorkflowIds.map(async (workflowId) => {
    const targetPath = resolveWorkflowPresetFilePath(projectRoot, workflowId);
    await fs.writeFile(targetPath, JSON.stringify(presets[workflowId], null, 2), 'utf-8');
  });
  await Promise.all(writeOps);
}

async function getWorkflowPresets(): Promise<WorkflowPresetsResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.', presets: {} };
  }

  const projectRoot = currentProjectRoot;
  const hasFileModePresets = await hasPerWorkflowPresetFiles(projectRoot);
  const diskRead = await readWorkflowPresetsFromDisk(projectRoot);
  const presets = diskRead.presets;

  if (!hasFileModePresets) {
    const legacy = await readWorkflowPresetsLegacyFromDisk(projectRoot);
    if (Object.keys(legacy).length > 0) {
      await backupLegacyWorkflowPresetsIfPresent(projectRoot);
      await writePerWorkflowPresetFiles(projectRoot, legacy, false);
      return {
        success: true,
        message: 'Workflow presets loaded and migrated to per-workflow files.',
        presets,
        updatedAtByWorkflow: buildWorkflowPresetUpdatedAtByWorkflow(presets),
      };
    }
  }

  if (diskRead.invalidFiles.length > 0) {
    return {
      success: true,
      message: `Workflow presets loaded with warnings. Invalid files ignored: ${diskRead.invalidFiles.join(', ')}`,
      presets,
      updatedAtByWorkflow: buildWorkflowPresetUpdatedAtByWorkflow(presets),
    };
  }

  return {
    success: true,
    message: 'Workflow presets loaded.',
    presets,
    updatedAtByWorkflow: buildWorkflowPresetUpdatedAtByWorkflow(presets),
  };
}

async function backupLegacyWorkflowPresetsIfPresent(projectRoot: string): Promise<void> {
  const legacyPath = resolveProjectPath(projectRoot, WORKFLOW_PRESETS_LEGACY_RELATIVE_PATH);
  if (!existsSync(legacyPath)) {
    return;
  }

  const workflowsDir = resolveProjectPath(projectRoot, 'workflows');
  try {
    const existing = await fs.readdir(workflowsDir);
    if (existing.some((name) => /^presets\.migrated\..*\.bak\.json$/i.test(name))) {
      return;
    }
  } catch {
    // ignore; backup attempt below still best-effort
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolveProjectPath(projectRoot, path.join('workflows', `presets.migrated.${stamp}.bak.json`));
  try {
    await fs.copyFile(legacyPath, backupPath);
  } catch {
    // best-effort backup only
  }
}

function buildWorkflowPresetUpdatedAtByWorkflow(presets: WorkflowPresetsMap): Record<string, string> {
  const updated: Record<string, string> = {};

  Object.entries(presets).forEach(([workflowId, list]) => {
    const latestTs = list.reduce((latest, preset) => {
      const ts = new Date(preset.updatedAt).getTime();
      if (!Number.isFinite(ts)) {
        return latest;
      }
      return Math.max(latest, ts);
    }, Number.NEGATIVE_INFINITY);

    if (Number.isFinite(latestTs)) {
      updated[workflowId] = new Date(latestTs).toISOString();
    }
  });

  return updated;
}

async function saveWorkflowPresets(request: WorkflowPresetsSaveRequest): Promise<WorkflowPresetsResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.', presets: {} };
  }

  const projectRoot = currentProjectRoot;
  await backupLegacyWorkflowPresetsIfPresent(projectRoot);

  const normalizedIncoming = normalizeWorkflowPresetsMap(request.presets);
  const diskRead = await readWorkflowPresetsFromDisk(projectRoot);
  const diskUpdatedAt = buildWorkflowPresetUpdatedAtByWorkflow(diskRead.presets);
  const expectedUpdatedAt = request.expectedUpdatedAtByWorkflow ?? {};

  const conflictedWorkflowId = Object.keys(normalizedIncoming).find((workflowId) => {
    const expected = expectedUpdatedAt[workflowId] ?? '';
    if (!expected) {
      return false;
    }

    const current = diskUpdatedAt[workflowId] ?? '';
    return current !== expected;
  });

  if (conflictedWorkflowId) {
    return {
      success: false,
      message: `PRESET_CONFLICT: Workflow "${conflictedWorkflowId}" changed on disk. Reload presets and retry save.`,
      presets: diskRead.presets,
      updatedAtByWorkflow: diskUpdatedAt,
    };
  }

  const merged = mergeWorkflowPresets(diskRead.presets, normalizedIncoming);
  await writePerWorkflowPresetFiles(projectRoot, merged, true);

  return {
    success: true,
    message: 'Workflow presets saved.',
    presets: merged,
    updatedAtByWorkflow: buildWorkflowPresetUpdatedAtByWorkflow(merged),
  };
}

function parseAutosaveFileName(fileName: string): { reason: ProjectSnapshotReason; stamp: string } | null {
  if (!fileName.startsWith(AUTOSAVE_FILE_PREFIX) || !fileName.endsWith(AUTOSAVE_FILE_SUFFIX)) {
    return null;
  }
  if (fileName.includes('/') || fileName.includes('\\')) {
    return null;
  }

  const payload = fileName.slice(AUTOSAVE_FILE_PREFIX.length, fileName.length - AUTOSAVE_FILE_SUFFIX.length);
  if (!payload) {
    return null;
  }

  const parts = payload.split('.');
  const head = parts[0];
  if ((head === 'manual' || head === 'autosave') && parts.length > 1) {
    return {
      reason: head,
      stamp: parts.slice(1).join('.'),
    };
  }

  return {
    reason: 'unknown',
    stamp: payload,
  };
}

function toErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toErrnoCode(error: unknown): string | null {
  const candidate = error as NodeJS.ErrnoException | null | undefined;
  return typeof candidate?.code === 'string' ? candidate.code : null;
}

function toReadFailureMessage(subject: string, filePath: string, error: unknown, nextStep: string): string {
  const code = toErrnoCode(error);
  if (code === 'ENOENT') {
    return `${subject} is missing: ${filePath}. Next step: ${nextStep}`;
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return `${subject} is not readable (permission denied): ${filePath}. Next step: ${nextStep}`;
  }
  return `${subject} could not be read: ${toErrorText(error)}. Next step: ${nextStep}`;
}

function toInvalidJsonMessage(subject: string, filePath: string, nextStep: string): string {
  return `${subject} is corrupted (invalid JSON): ${filePath}. Next step: ${nextStep}`;
}

function toInvalidProjectStructureMessage(subject: string, details: string, nextStep: string): string {
  return `${subject} has invalid project structure: ${details}. Next step: ${nextStep}`;
}

async function writeProjectAutosaveSnapshot(projectRoot: string, project: Project, reason: SaveProjectReason): Promise<void> {
  const autosaveDirectory = resolveProjectPath(projectRoot, AUTOSAVE_DIRECTORY_RELATIVE_PATH);
  await fs.mkdir(autosaveDirectory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${AUTOSAVE_FILE_PREFIX}${reason}.${stamp}${AUTOSAVE_FILE_SUFFIX}`;
  const snapshotPath = path.join(autosaveDirectory, fileName);
  await fs.writeFile(snapshotPath, JSON.stringify(project, null, 2), 'utf-8');

  try {
    const entries = await fs.readdir(autosaveDirectory, { withFileTypes: true });
    const snapshotFileNames = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => parseAutosaveFileName(name) !== null)
      .sort((a, b) => b.localeCompare(a));

    const staleFileNames = snapshotFileNames.slice(MAX_AUTOSAVE_SNAPSHOTS);
    if (staleFileNames.length > 0) {
      await Promise.all(staleFileNames.map(async (name) => fs.unlink(path.join(autosaveDirectory, name))));
    }
  } catch {
    // Snapshot pruning is best-effort only.
  }
}

function isValidAutosaveFileName(fileName: string): boolean {
  return parseAutosaveFileName(fileName) !== null;
}

async function listProjectAutosaves(): Promise<ProjectAutosaveListResponse> {
  if (!currentProjectRoot) {
    return {
      success: false,
      message: 'No ProjectRoot set. Create or load a project first.',
      snapshots: [],
    };
  }

  const autosaveDirectory = resolveProjectPath(currentProjectRoot, AUTOSAVE_DIRECTORY_RELATIVE_PATH);
  try {
    const entries = await fs.readdir(autosaveDirectory, { withFileTypes: true });
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fileName = entry.name;
          if (!isValidAutosaveFileName(fileName)) {
            return null;
          }

          const parsed = parseAutosaveFileName(fileName);
          if (!parsed) {
            return null;
          }

          const absolutePath = path.join(autosaveDirectory, fileName);
          const stat = await fs.stat(absolutePath);
          return {
            fileName,
            createdAt: stat.mtime.toISOString(),
            sizeBytes: stat.size,
            reason: parsed.reason,
          };
        }),
    );

    const sortedSnapshots = snapshots
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      success: true,
      message: sortedSnapshots.length > 0 ? 'Autosave snapshots loaded.' : 'No autosave snapshots available yet.',
      snapshots: sortedSnapshots,
    };
  } catch {
    return {
      success: true,
      message: 'No autosave snapshots available yet.',
      snapshots: [],
    };
  }
}

async function restoreProjectAutosave(fileName: string): Promise<ProjectResponse> {
  if (!currentProjectRoot) {
    return {
      success: false,
      message: 'No ProjectRoot set. Create or load a project first. Next step: open a project and retry autosave restore.',
    };
  }

  const trimmed = fileName.trim();
  if (!isValidAutosaveFileName(trimmed)) {
    return {
      success: false,
      message: `Invalid autosave file name: ${fileName}. Next step: refresh autosaves and choose a listed snapshot.`,
    };
  }

  const projectRoot = currentProjectRoot;
  const autosaveDirectory = resolveProjectPath(projectRoot, AUTOSAVE_DIRECTORY_RELATIVE_PATH);
  const snapshotPath = path.join(autosaveDirectory, trimmed);
  if (!existsSync(snapshotPath)) {
    return {
      success: false,
      message: `Autosave snapshot not found: ${trimmed}. Next step: refresh autosaves and select an available snapshot.`,
    };
  }

  let content = '';
  try {
    content = await fs.readFile(snapshotPath, 'utf-8');
  } catch (error) {
    return {
      success: false,
      message: toReadFailureMessage(
        'Autosave snapshot file',
        snapshotPath,
        error,
        'check file permissions or choose another snapshot.',
      ),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        message: toInvalidJsonMessage(
          'Autosave snapshot',
          snapshotPath,
          'choose another snapshot or remove the corrupted file in cache/autosave.',
        ),
      };
    }
    return {
      success: false,
      message: `Failed to parse autosave snapshot: ${toErrorText(error)}. Next step: choose another snapshot and retry.`,
    };
  }

  const migrated = migrateProjectToV2(parsed);
  if (!validateProject(migrated)) {
    return {
      success: false,
      message: toInvalidProjectStructureMessage(
        'Autosave snapshot',
        ajv.errorsText(validateProject.errors),
        'choose another snapshot or open project.json manually and repair invalid fields.',
      ),
    };
  }

  const project: Project = migrated;
  const saveResponse = await saveProjectToCurrentRoot(project);
  if (!saveResponse.success) {
    return {
      success: false,
      message: `${saveResponse.message} Next step: verify project write permissions and retry restore.`,
    };
  }

  return {
    success: true,
    message: `Restored autosave snapshot ${trimmed}`,
    project,
  };
}

async function saveProjectToCurrentRoot(project: Project, reason: SaveProjectReason = 'manual'): Promise<ProjectResponse> {
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

  const projectRoot = currentProjectRoot;
  const projectPath = resolveProjectPath(projectRoot, PROJECT_FILE_NAME);
  await fs.writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');

  await persistLastProjectRoot(projectRoot);
  try {
    await writeProjectAutosaveSnapshot(projectRoot, project, reason);
  } catch {
    // Primary project save succeeded; autosave snapshot must not fail the request.
  }

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

async function listComfyGallery(request?: ComfyGalleryListRequest): Promise<ComfyGalleryListResponse> {
  const configured = request?.outputDir?.trim() || process.env.COMFYUI_OUTPUT_DIR?.trim() || '';
  if (!configured) {
    return {
      success: false,
      message: 'Kein Comfy Output Ordner gesetzt. Bitte Pfad in der Gallery eintragen.',
      items: [],
    };
  }

  const outputDir = path.resolve(configured);
  let rootEntries: import('node:fs').Dirent[] = [];
  try {
    rootEntries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch (error) {
    return {
      success: false,
      message: `Comfy Output Ordner nicht lesbar: ${(error as Error).message}`,
      outputDir,
      items: [],
    };
  }

  const limit = Math.max(20, Math.min(request?.limit ?? 400, 2000));
  const collected: Array<{ absolutePath: string; fileName: string; kind: 'image' | 'video'; sizeBytes: number; modifiedAt: string }> = [];
  const queue: string[] = rootEntries.filter((entry) => entry.isDirectory()).map((entry) => path.join(outputDir, entry.name));

  const addFileIfSupported = async (absolutePath: string, fileName: string): Promise<void> => {
    const type = detectImportableAssetTypeFromExtension(fileName);
    if (type !== 'image' && type !== 'video') {
      return;
    }

    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) {
        return;
      }
      collected.push({
        absolutePath,
        fileName,
        kind: type,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      // ignore unreadable file
    }
  };

  for (const entry of rootEntries) {
    if (entry.isFile()) {
      await addFileIfSupported(path.join(outputDir, entry.name), entry.name);
    }
  }

  while (queue.length > 0 && collected.length < limit) {
    const currentDir = queue.shift() as string;
    let children: import('node:fs').Dirent[] = [];
    try {
      children = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const child of children) {
      const absolute = path.join(currentDir, child.name);
      if (child.isDirectory()) {
        queue.push(absolute);
      } else if (child.isFile()) {
        await addFileIfSupported(absolute, child.name);
      }

      if (collected.length >= limit) {
        break;
      }
    }
  }

  const items = collected
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, limit);

  return {
    success: true,
    message: `Comfy Gallery geladen (${items.length} Dateien).`,
    outputDir,
    items,
  };
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
  tags?: string[];
  notes?: string;
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
    tags: Array.from(new Set((params.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0))),
    notes: params.notes ?? '',
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

  const duplicateTag = `comfy-output:${normalized.toLowerCase()}`;
  try {
    const project = await readCurrentProjectFromDisk();
    const alreadyImported = project.assets.some((asset) => asset.tags.includes(duplicateTag));
    if (alreadyImported) {
      return {
        success: false,
        message: `Output already imported: "${normalized}". Next step: reuse existing asset in library/timeline instead of importing again.`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Comfy output import precheck failed: ${(error as Error).message}`,
    };
  }

  const inferredType = detectImportableAssetTypeFromExtension(parsed.base);
  if (!inferredType) {
    return {
      success: false,
      message: `Unsupported Comfy output extension: ${path.extname(parsed.base) || '(none)'}. Next step: import only image/video/audio outputs.`,
    };
  }

  const baseUrlResolution = resolveComfyBaseUrlPolicy();
  if (!baseUrlResolution.ok) {
    return {
      success: false,
      message: `Comfy output import blocked: ${baseUrlResolution.message}. Next step: fix Comfy base URL policy and retry.`,
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
        message: `ComfyUI /view failed with HTTP ${response.status} for output "${normalized}". Next step: verify output path/subfolder and rerun the workflow if needed.`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      return { success: false, message: `ComfyUI returned an empty file for "${normalized}". Next step: rerun workflow and retry import.` };
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
      tags: ['comfy-output', duplicateTag],
      notes: `Imported from Comfy output path "${normalized}".`,
    });
  } catch (error) {
    return {
      success: false,
      message: `Comfy output import failed: ${(error as Error).message}. Next step: check ComfyUI /view availability and retry import.`,
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

async function createComfyGalleryFolder(request: CreateComfyGalleryFolderRequest): Promise<CreateComfyGalleryFolderResponse> {
  const configured = request.outputDir?.trim() || process.env.COMFYUI_OUTPUT_DIR?.trim() || '';
  if (!configured) {
    return { success: false, message: 'Kein Comfy Output Ordner gesetzt.' };
  }

  const folderName = request.folderName.trim();
  if (!folderName) {
    return { success: false, message: 'Ordnername ist leer.' };
  }
  if (!/^[a-zA-Z0-9 _.-]+$/.test(folderName)) {
    return { success: false, message: 'Ordnername enthaelt ungueltige Zeichen.' };
  }

  const outputDir = path.resolve(configured);
  const targetPath = path.resolve(outputDir, folderName);
  const relative = path.relative(outputDir, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { success: false, message: 'Ordnerpfad ausserhalb des Output-Ordners ist nicht erlaubt.' };
  }

  try {
    const stat = await fs.stat(targetPath).catch(() => null);
    if (stat) {
      if (stat.isDirectory()) {
        return { success: true, message: 'Ordner existiert bereits.', path: targetPath };
      }
      return { success: false, message: 'Ein gleichnamiger Dateieintrag existiert bereits.' };
    }

    await fs.mkdir(targetPath, { recursive: false });
    return { success: true, message: 'Ordner erstellt.', path: targetPath };
  } catch (error) {
    return { success: false, message: `Ordner konnte nicht erstellt werden: ${(error as Error).message}` };
  }
}

async function savePreviewSnapshot(request: SavePreviewSnapshotRequest): Promise<SavePreviewSnapshotResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  const dataUrl = request.dataUrl?.trim();
  if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
    return { success: false, message: 'Invalid snapshot payload.' };
  }

  const base64 = dataUrl.slice('data:image/png;base64,'.length);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return { success: false, message: 'Failed to decode snapshot payload.' };
  }

  const safeSource = (request.sourceName ?? 'preview')
    .replace(/[^a-z0-9_\-.]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'preview';
  const timeCode = Math.max(0, Number.isFinite(request.timeSeconds) ? request.timeSeconds : 0)
    .toFixed(2)
    .replace('.', '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const targetDir = resolveProjectPath(currentProjectRoot, path.join('exports', 'snapshots'));
  await fs.mkdir(targetDir, { recursive: true });

  const fileName = `${safeSource}_t${timeCode}_${stamp}.png`;
  const targetPath = path.join(targetDir, fileName);
  await fs.writeFile(targetPath, buffer);

  return {
    success: true,
    message: 'Snapshot gespeichert.',
    path: targetPath,
  };
}

async function revealPreviewSnapshot(request: RevealPreviewSnapshotRequest): Promise<RevealPreviewSnapshotResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  const rawPath = request.path?.trim() ?? '';
  if (!rawPath) {
    return { success: false, message: 'Snapshot path is required.' };
  }

  const absoluteSnapshotPath = path.resolve(rawPath);
  const snapshotsRoot = resolveProjectPath(currentProjectRoot, path.join('exports', 'snapshots'));
  const relativeToSnapshotsRoot = path.relative(path.resolve(snapshotsRoot), absoluteSnapshotPath);
  if (relativeToSnapshotsRoot.startsWith('..') || path.isAbsolute(relativeToSnapshotsRoot)) {
    return { success: false, message: 'Snapshot path is outside the project snapshots folder.' };
  }

  if (path.extname(absoluteSnapshotPath).toLowerCase() !== '.png') {
    return { success: false, message: 'Only PNG snapshots can be revealed.' };
  }

  if (!existsSync(absoluteSnapshotPath)) {
    return { success: false, message: 'Snapshot file no longer exists on disk.' };
  }

  const folderPath = path.dirname(absoluteSnapshotPath);
  const openError = await shell.openPath(folderPath);
  if (openError) {
    return { success: false, message: `Snapshot folder could not be opened: ${openError}` };
  }

  return {
    success: true,
    message: 'Snapshot folder opened.',
    path: absoluteSnapshotPath,
  };
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

async function analyzeImageWithOllama(request: AnalyzeImageWithOllamaRequest): Promise<AnalyzeImageWithOllamaResponse> {
  if (!currentProjectRoot) {
    return { success: false, message: 'No ProjectRoot set. Create or load a project first.' };
  }

  const relativeImagePath = (request.relativeImagePath ?? '').trim();
  if (!relativeImagePath) {
    return { success: false, message: 'relativeImagePath is required.' };
  }

  const model = (request.model ?? 'qwen2.5vl:latest').trim() || 'qwen2.5vl:latest';
  const instruction = (
    request.prompt
    ?? 'Analyze this image and produce one concise cinematic generation prompt with style, lighting, framing, and mood.'
  ).trim();
  const endpoint = (request.endpoint ?? 'http://127.0.0.1:11434/api/chat').trim() || 'http://127.0.0.1:11434/api/chat';

  try {
    const absolutePath = resolveProjectPath(currentProjectRoot, relativeImagePath);
    const fileBuffer = await fs.readFile(absolutePath);
    const base64Image = fileBuffer.toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: instruction,
              images: [base64Image],
            },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        message: `Ollama request failed (${response.status}): ${body || response.statusText}`,
      };
    }

    const json = await response.json() as unknown;
    const content = isRecord(json)
      ? (
        isRecord(json.message) && typeof json.message.content === 'string'
          ? json.message.content
          : typeof json.response === 'string'
            ? json.response
            : ''
      )
      : '';

    const promptText = content.trim();
    if (!promptText) {
      return {
        success: false,
        message: 'Ollama returned no prompt content.',
        model,
      };
    }

    return {
      success: true,
      message: 'Image analyzed with Ollama.',
      promptText,
      model,
    };
  } catch (error) {
    return {
      success: false,
      message: `Ollama analyze failed: ${(error as Error).message}`,
      model,
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

async function loadProjectFromPath(
  projectPath: string,
  successMessagePrefix: string,
  source: 'manual-load' | 'session-restore' = 'manual-load',
): Promise<ProjectResponse> {
  if (path.basename(projectPath) !== PROJECT_FILE_NAME) {
    return { success: false, message: 'Please select project.json.' };
  }

  const invalidJsonSubject = source === 'session-restore' ? 'Last session project file' : 'Selected project file';
  const invalidProjectSubject = source === 'session-restore' ? 'Last session project' : 'Selected project';
  const nextStep = source === 'session-restore'
    ? 'load a different project manually and save it as the new session.'
    : 'pick a valid project.json file and retry.';

  let content = '';
  try {
    content = await fs.readFile(projectPath, 'utf-8');
  } catch (error) {
    return {
      success: false,
      message: toReadFailureMessage(invalidJsonSubject, projectPath, error, nextStep),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        message: toInvalidJsonMessage(invalidJsonSubject, projectPath, nextStep),
      };
    }
    return {
      success: false,
      message: `Failed to parse project file: ${toErrorText(error)}. Next step: ${nextStep}`,
    };
  }

  const migrated = migrateProjectToV2(parsed);
  if (!validateProject(migrated)) {
    return {
      success: false,
      message: toInvalidProjectStructureMessage(
        invalidProjectSubject,
        ajv.errorsText(validateProject.errors),
        nextStep,
      ),
    };
  }

  try {
    const project: Project = migrated;
    const projectRoot = path.dirname(projectPath);
    currentProjectRoot = projectRoot;
    await ensureProjectStructure(projectRoot);
    await persistLastProjectRoot(projectRoot);

    return {
      success: true,
      message: `${successMessagePrefix} ${projectPath}`,
      project,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to finalize project load: ${toErrorText(error)}. Next step: check disk access and retry.`,
    };
  }
}

async function restoreLastSessionProject(): Promise<ProjectResponse> {
  const session = await readSessionState();
  const projectRoot = session.lastProjectRoot?.trim() ?? '';
  if (!projectRoot) {
    return {
      success: false,
      message: 'No previous session found.',
    };
  }

  const projectPath = resolveProjectPath(projectRoot, PROJECT_FILE_NAME);
  if (!existsSync(projectPath)) {
    return {
      success: false,
      message: `Last session project not found: ${projectPath}. Next step: load a project manually and save once to refresh session recovery.`,
    };
  }

  return loadProjectFromPath(projectPath, 'Restored last session from', 'session-restore');
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
  getGlobalWorkflowsRoot: () => resolveGlobalWorkflowsRoot(),
  readCurrentProjectFromDisk,
  resolveProjectPath,
  emitRunEvent: emitComfyRunEvent,
});

function findNearestWorkflowsRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, 'workflows');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function hasWorkflowMetaFiles(rootPath: string): boolean {
  const categories = ['images', 'videos', 'audio'];
  try {
    return categories.some((category) => {
      const categoryDir = path.join(rootPath, category);
      if (!existsSync(categoryDir)) {
        return false;
      }
      const files = readdirSync(categoryDir, { withFileTypes: true });
      return files.some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.meta.json'));
    });
  } catch {
    return false;
  }
}

function resolveGlobalWorkflowsRoot(): string {
  const directCandidates = [
    // Robust for electron-vite dev build output (apps/desktop/out/main -> repo/workflows)
    path.resolve(__dirname, '../../../../workflows'),
    // Additional fallbacks for different runtime layouts
    path.resolve(app.getAppPath(), '../../workflows'),
    path.resolve(app.getAppPath(), '../workflows'),
    path.resolve(app.getAppPath(), 'workflows'),
  ];

  const populatedMatch = directCandidates.find((candidate) => existsSync(candidate) && hasWorkflowMetaFiles(candidate));
  if (populatedMatch) {
    return populatedMatch;
  }

  const nearestFromAppPath = findNearestWorkflowsRoot(app.getAppPath());
  if (nearestFromAppPath && hasWorkflowMetaFiles(nearestFromAppPath)) {
    return nearestFromAppPath;
  }

  const existingMatch = directCandidates.find((candidate) => existsSync(candidate));
  if (existingMatch) {
    return existingMatch;
  }

  return directCandidates[0];
}

const workflowCatalogService = createWorkflowCatalogService({
  getCurrentProjectRoot: () => currentProjectRoot,
  getGlobalWorkflowsRoot: () => resolveGlobalWorkflowsRoot(),
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
    await persistLastProjectRoot(projectRoot);

    return {
      success: true,
      message: `Created project in ${projectRoot}`,
      project,
    };
  },
  saveProject: async (project: Project, reason?: SaveProjectReason): Promise<ProjectResponse> => {
    return saveProjectToCurrentRoot(project, reason ?? 'manual');
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
    return loadProjectFromPath(projectPath, 'Loaded from');
  },
  restoreLastSession: async (): Promise<ProjectResponse> => {
    return restoreLastSessionProject();
  },
  listProjectAutosaves: async (): Promise<ProjectAutosaveListResponse> => {
    return listProjectAutosaves();
  },
  restoreProjectAutosave: async (fileName: string): Promise<ProjectResponse> => {
    return restoreProjectAutosave(fileName);
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
  previewComfyRunPayload: async (payload: PreviewComfyRunPayloadRequest): Promise<PreviewComfyRunPayloadResponse> => {
    return comfyService.previewComfyRunPayload(payload);
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
  listComfyGallery: async (request?: ComfyGalleryListRequest): Promise<ComfyGalleryListResponse> => {
    return listComfyGallery(request);
  },
  savePreviewSnapshot: async (request: SavePreviewSnapshotRequest): Promise<SavePreviewSnapshotResponse> => {
    return savePreviewSnapshot(request);
  },
  revealPreviewSnapshot: async (request: RevealPreviewSnapshotRequest): Promise<RevealPreviewSnapshotResponse> => {
    return revealPreviewSnapshot(request);
  },
  createComfyGalleryFolder: async (request: CreateComfyGalleryFolderRequest): Promise<CreateComfyGalleryFolderResponse> => {
    return createComfyGalleryFolder(request);
  },
  importWorkflowTemplate: async (workflowId: string): Promise<WorkflowTemplateImportResponse> => {
    return importWorkflowTemplate(workflowId);
  },
  getWorkflowPresets: async (): Promise<WorkflowPresetsResponse> => {
    return getWorkflowPresets();
  },
  saveWorkflowPresets: async (request: WorkflowPresetsSaveRequest): Promise<WorkflowPresetsResponse> => {
    return saveWorkflowPresets(request);
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
  analyzeImageWithOllama: async (request: AnalyzeImageWithOllamaRequest): Promise<AnalyzeImageWithOllamaResponse> => {
    return analyzeImageWithOllama(request);
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
