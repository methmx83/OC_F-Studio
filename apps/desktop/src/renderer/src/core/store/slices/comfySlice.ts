/* eslint-disable no-unused-vars */
import type { ComfyRunEvent } from '@shared/comfy';

import {
  COMFY_BRIDGE_UNAVAILABLE_MESSAGE,
  getIpcClient,
  isIpcUnavailableError,
} from '../../adapters/ipcClient';
import type { StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

interface ComfySliceDeps {
  toErrorMessage(error: unknown): string;
  applyComfyRunEventState(state: StudioState, event: ComfyRunEvent): Partial<StudioState>;
}

type ComfySliceKeys =
  | 'comfyOnline'
  | 'comfyBaseUrl'
  | 'queuedWorkflowRuns'
  | 'autoImportedOutputPathsByRunId'
  | 'setComfyBaseUrl'
  | 'checkComfyHealth'
  | 'bindComfyRunEvents';

let comfyRunEventUnsubscribe: (() => void) | null = null;
const COMFY_BASE_URL_STORAGE_KEY = 'ai-filmstudio.comfy.baseUrl';
const COMFY_RECENT_RUNS_STORAGE_KEY = 'ai-filmstudio.comfy.recentRuns';
const COMFY_AUTO_IMPORTED_OUTPUTS_STORAGE_KEY = 'ai-filmstudio.comfy.autoImportedOutputs';
const AUTO_IMPORTED_COMFY_OUTPUT_KEY_LIMIT = 500;
const autoImportedComfyOutputKeys = new Set<string>();
const COMFY_IMPORTABLE_OUTPUT_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi',
  '.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac',
];

function readStoredComfyBaseUrl(): string {
  try {
    const raw = globalThis.localStorage?.getItem(COMFY_BASE_URL_STORAGE_KEY)?.trim();
    return raw ?? '';
  } catch {
    return '';
  }
}

function readStoredQueuedWorkflowRuns(): StudioState['queuedWorkflowRuns'] {
  try {
    const raw = globalThis.localStorage?.getItem(COMFY_RECENT_RUNS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry) => typeof entry === 'object' && entry !== null) as StudioState['queuedWorkflowRuns'];
  } catch {
    return [];
  }
}

function readStoredAutoImportedOutputs(): StudioState['autoImportedOutputPathsByRunId'] {
  try {
    const raw = globalThis.localStorage?.getItem(COMFY_AUTO_IMPORTED_OUTPUTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    const map: StudioState['autoImportedOutputPathsByRunId'] = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([runId, value]) => {
      if (!Array.isArray(value)) {
        return;
      }
      map[runId] = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    });
    return map;
  } catch {
    return {};
  }
}

function persistComfyRecentRuns(runs: StudioState['queuedWorkflowRuns']): void {
  try {
    globalThis.localStorage?.setItem(COMFY_RECENT_RUNS_STORAGE_KEY, JSON.stringify(runs.slice(0, 80)));
  } catch {
    // ignore storage errors
  }
}

function persistComfyAutoImportedOutputs(map: StudioState['autoImportedOutputPathsByRunId']): void {
  try {
    globalThis.localStorage?.setItem(COMFY_AUTO_IMPORTED_OUTPUTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function canAutoImportComfyOutputPath(outputPath: string): boolean {
  const normalized = outputPath.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return COMFY_IMPORTABLE_OUTPUT_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function rememberAutoImportedKey(key: string): void {
  autoImportedComfyOutputKeys.add(key);
  if (autoImportedComfyOutputKeys.size <= AUTO_IMPORTED_COMFY_OUTPUT_KEY_LIMIT) {
    return;
  }

  const first = autoImportedComfyOutputKeys.values().next().value;
  if (typeof first === 'string') {
    autoImportedComfyOutputKeys.delete(first);
  }
}

export function createComfySlice(
  set: StoreSet<StudioState>,
  get: StoreGet<StudioState>,
  deps: ComfySliceDeps,
): Pick<StudioState, ComfySliceKeys> {
  return {
    comfyOnline: false,
    comfyBaseUrl: readStoredComfyBaseUrl(),
    queuedWorkflowRuns: readStoredQueuedWorkflowRuns(),
    autoImportedOutputPathsByRunId: readStoredAutoImportedOutputs(),

    setComfyBaseUrl: (url) => {
      const normalized = url.trim();
      try {
        if (normalized.length === 0) {
          globalThis.localStorage?.removeItem(COMFY_BASE_URL_STORAGE_KEY);
        } else {
          globalThis.localStorage?.setItem(COMFY_BASE_URL_STORAGE_KEY, normalized);
        }
      } catch {
        // ignore storage errors
      }

      set({ comfyBaseUrl: normalized });
    },

    checkComfyHealth: async () => {
      try {
        const ipc = getIpcClient();
        const baseUrlOverride = get().comfyBaseUrl.trim();
        const response = await ipc.getComfyHealth(baseUrlOverride.length > 0 ? { baseUrlOverride } : undefined);
        set({
          comfyOnline: response.online,
          projectMessage: response.online ? response.message : get().projectMessage,
          lastError: response.online ? get().lastError : response.message,
        });
      } catch (error) {
        if (isIpcUnavailableError(error)) {
          set({
            comfyOnline: false,
            projectMessage: COMFY_BRIDGE_UNAVAILABLE_MESSAGE,
          });
          return;
        }

        set({
          comfyOnline: false,
          lastError: `ComfyUI health check failed: ${deps.toErrorMessage(error)}`,
        });
      }
    },

    bindComfyRunEvents: () => {
      if (comfyRunEventUnsubscribe) {
        return;
      }

      try {
        const ipc = getIpcClient();
        comfyRunEventUnsubscribe = ipc.onComfyRunEvent((event) => {
          set((state) => {
            const nextPartial = deps.applyComfyRunEventState(state, event);
            if (nextPartial.queuedWorkflowRuns) {
              persistComfyRecentRuns(nextPartial.queuedWorkflowRuns);
            }
            return nextPartial;
          });

          if (event.status !== 'success' || event.outputPaths.length === 0) {
            return;
          }

          const outputPaths = [...event.outputPaths];
          void (async () => {
            for (const outputPath of outputPaths) {
              if (!canAutoImportComfyOutputPath(outputPath)) {
                continue;
              }

              const key = `${event.runId}:${outputPath}`;
              if (autoImportedComfyOutputKeys.has(key)) {
                continue;
              }
              rememberAutoImportedKey(key);

              try {
                const beforeAssetIds = new Set(get().assets.map((asset) => asset.id));
                await get().importComfyOutputAsset(outputPath);
                const afterState = get();
                const imported = afterState.assets.some((asset) => !beforeAssetIds.has(asset.id));
                if (!imported) {
                  autoImportedComfyOutputKeys.delete(key);
                  continue;
                }

                set((state) => {
                  const existing = state.autoImportedOutputPathsByRunId[event.runId] ?? [];
                  if (existing.includes(outputPath)) {
                    return state;
                  }

                  const nextMap = {
                    ...state.autoImportedOutputPathsByRunId,
                    [event.runId]: [...existing, outputPath],
                  };
                  persistComfyAutoImportedOutputs(nextMap);

                  return {
                    autoImportedOutputPathsByRunId: nextMap,
                  };
                });
              } catch (error) {
                autoImportedComfyOutputKeys.delete(key);
                set({ lastError: `Auto-import failed: ${deps.toErrorMessage(error)}` });
              }
            }
          })();
        });
      } catch (error) {
        if (!isIpcUnavailableError(error)) {
          set({
            comfyOnline: false,
            lastError: `Comfy event binding failed: ${deps.toErrorMessage(error)}`,
          });
          return;
        }

        set({
          comfyOnline: false,
          projectMessage: COMFY_BRIDGE_UNAVAILABLE_MESSAGE,
        });
      }
    },
  };
}
