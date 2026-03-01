/* eslint-disable no-unused-vars */
import { getIpcClient } from '../../adapters/ipcClient';
import type { StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

interface ProjectSliceDeps {
  toErrorMessage(error: unknown): string;
  toProjectState(
    project: NonNullable<StudioState['project']>,
    projectRoot: string | null,
    projectMessage: string,
  ): Partial<StudioState>;
  hydrateAssetThumbnails(
    assets: StudioState['assets'],
    set: StoreSet<StudioState>,
    get: StoreGet<StudioState>,
  ): Promise<void>;
  hydrateKnownVideoProxies(
    assets: StudioState['assets'],
    set: StoreSet<StudioState>,
    get: StoreGet<StudioState>,
  ): Promise<void>;
}

type ProjectSliceKeys =
  | 'projectName'
  | 'projectRoot'
  | 'projectMessage'
  | 'isProjectBusy'
  | 'isDirty'
  | 'project'
  | 'clearLastError'
  | 'newProject'
  | 'loadProject'
  | 'saveProject';

export function createProjectSlice(
  set: StoreSet<StudioState>,
  get: StoreGet<StudioState>,
  deps: ProjectSliceDeps,
): Pick<StudioState, ProjectSliceKeys> {
  return {
    projectName: 'No Project',
    projectRoot: null,
    projectMessage: 'No project loaded',
    isProjectBusy: false,
    isDirty: false,
    project: null,

    clearLastError: () => set({ lastError: null }),

    newProject: async () => {
      set({ isProjectBusy: true, lastError: null });

      try {
        const ipc = getIpcClient();
        const response = await ipc.newProject();
        if (!response.success || !response.project) {
          set({ isProjectBusy: false, lastError: response.message, projectMessage: response.message });
          return;
        }

        const projectRoot = await ipc.getProjectRoot();
        const nextState = deps.toProjectState(response.project, projectRoot, response.message);
        set({ ...nextState, isProjectBusy: false, lastError: null });
        await deps.hydrateAssetThumbnails(response.project.assets, set, get);
        void deps.hydrateKnownVideoProxies(response.project.assets, set, get);
      } catch (error) {
        set({ isProjectBusy: false, lastError: deps.toErrorMessage(error), projectMessage: 'New project failed' });
      }
    },

    loadProject: async () => {
      set({ isProjectBusy: true, lastError: null });

      try {
        const ipc = getIpcClient();
        const response = await ipc.loadProject();
        if (!response.success || !response.project) {
          set({ isProjectBusy: false, lastError: response.message, projectMessage: response.message });
          return;
        }

        const projectRoot = await ipc.getProjectRoot();
        const nextState = deps.toProjectState(response.project, projectRoot, response.message);
        set({ ...nextState, isProjectBusy: false, lastError: null });
        await deps.hydrateAssetThumbnails(response.project.assets, set, get);
        void deps.hydrateKnownVideoProxies(response.project.assets, set, get);
      } catch (error) {
        set({ isProjectBusy: false, lastError: deps.toErrorMessage(error), projectMessage: 'Load project failed' });
      }
    },

    saveProject: async () => {
      const state = get();
      if (!state.project) {
        set({ lastError: 'No project loaded. Nothing to save.' });
        return;
      }

      set({ isProjectBusy: true, lastError: null });

      try {
        const ipc = getIpcClient();
        const response = await ipc.saveProject(state.project);
        if (!response.success) {
          set({ isProjectBusy: false, lastError: response.message, projectMessage: response.message });
          return;
        }

        set({ isProjectBusy: false, projectMessage: response.message, isDirty: false });
      } catch (error) {
        set({ isProjectBusy: false, lastError: deps.toErrorMessage(error), projectMessage: 'Save failed' });
      }
    },
  };
}
