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
  | 'queuedWorkflowRuns'
  | 'checkComfyHealth'
  | 'bindComfyRunEvents';

let comfyRunEventUnsubscribe: (() => void) | null = null;

export function createComfySlice(
  set: StoreSet<StudioState>,
  get: StoreGet<StudioState>,
  deps: ComfySliceDeps,
): Pick<StudioState, ComfySliceKeys> {
  return {
    comfyOnline: false,
    queuedWorkflowRuns: [],

    checkComfyHealth: async () => {
      try {
        const ipc = getIpcClient();
        const response = await ipc.getComfyHealth();
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
          set((state) => deps.applyComfyRunEventState(state, event));
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
