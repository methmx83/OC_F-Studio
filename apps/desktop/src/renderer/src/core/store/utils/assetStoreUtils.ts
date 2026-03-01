/* eslint-disable no-unused-vars */
import type { Asset, Project } from '@shared/types';

import { getIpcClient } from '../../adapters/ipcClient';
import type { StudioState } from '../studioStore';
import { toErrorMessage } from './storeRuntimeUtils';

type StoreSet = (
  partial: Partial<StudioState> | ((state: StudioState) => Partial<StudioState> | StudioState),
) => void;
type StoreGet = () => StudioState;

export async function importAssetByType(
  type: 'video' | 'image' | 'audio',
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  const state = get();
  if (!state.project) {
    set({ lastError: 'Load or create a project before importing assets.' });
    return;
  }

  set({ isProjectBusy: true, lastError: null });

  try {
    const ipc = getIpcClient();
    const response = type === 'video'
      ? await ipc.importVideo()
      : type === 'image'
        ? await ipc.importImage()
        : await ipc.importAudio();

    if (!response.success || !response.asset) {
      set({ isProjectBusy: false, lastError: response.message, projectMessage: response.message });
      return;
    }

    const refreshedState = get();
    if (!refreshedState.project) {
      set({ isProjectBusy: false, lastError: 'Project was unloaded during import.' });
      return;
    }

    const nextProject: Project = {
      ...refreshedState.project,
      assets: [...refreshedState.project.assets, response.asset],
    };

    const saveResponse = await ipc.saveProject(nextProject);

    const thumbnailDataUrl = await ipc.getAssetThumbnailDataUrl(response.asset.thumbnailPath);
    set((currentState) => ({
      isProjectBusy: false,
      project: nextProject,
      assets: nextProject.assets,
      projectMessage: saveResponse.success ? saveResponse.message : response.message,
      lastError: saveResponse.success ? null : saveResponse.message,
      isDirty: !saveResponse.success,
      assetThumbnails: {
        ...currentState.assetThumbnails,
        [response.asset!.id]: thumbnailDataUrl,
      },
    }));

    if (type === 'video') {
      const proxyResponse = await ipc.ensureVideoProxy(response.asset.filePath);
      if (proxyResponse.success && proxyResponse.proxyRelativePath) {
        set((currentState) => ({
          proxyPathByAssetId: {
            ...currentState.proxyPathByAssetId,
            [response.asset!.id]: proxyResponse.proxyRelativePath!,
          },
        }));
      }
    }
  } catch (error) {
    set({ isProjectBusy: false, lastError: toErrorMessage(error), projectMessage: 'Import failed' });
  }
}

export async function importComfyOutputAssetByPath(
  outputPath: string,
  set: StoreSet,
  get: StoreGet,
): Promise<void> {
  const state = get();
  if (!state.project) {
    set({ lastError: 'Load or create a project before importing assets.' });
    return;
  }

  const trimmedPath = outputPath.trim();
  if (!trimmedPath) {
    set({ lastError: 'Missing Comfy output path.' });
    return;
  }

  set({ isProjectBusy: true, lastError: null });

  try {
    const ipc = getIpcClient();
    const response = await ipc.importComfyOutput(trimmedPath);

    if (!response.success || !response.asset) {
      set({ isProjectBusy: false, lastError: response.message, projectMessage: response.message });
      return;
    }

    const refreshedState = get();
    if (!refreshedState.project) {
      set({ isProjectBusy: false, lastError: 'Project was unloaded during import.' });
      return;
    }

    const nextProject: Project = {
      ...refreshedState.project,
      assets: [...refreshedState.project.assets, response.asset],
    };

    const saveResponse = await ipc.saveProject(nextProject);
    const thumbnailDataUrl = await ipc.getAssetThumbnailDataUrl(response.asset.thumbnailPath);

    set((currentState) => ({
      isProjectBusy: false,
      project: nextProject,
      assets: nextProject.assets,
      projectMessage: saveResponse.success ? saveResponse.message : response.message,
      lastError: saveResponse.success ? null : saveResponse.message,
      isDirty: !saveResponse.success,
      assetThumbnails: {
        ...currentState.assetThumbnails,
        [response.asset!.id]: thumbnailDataUrl,
      },
    }));

    if (response.asset.type === 'video') {
      const proxyResponse = await ipc.ensureVideoProxy(response.asset.filePath);
      if (proxyResponse.success && proxyResponse.proxyRelativePath) {
        set((currentState) => ({
          proxyPathByAssetId: {
            ...currentState.proxyPathByAssetId,
            [response.asset!.id]: proxyResponse.proxyRelativePath!,
          },
        }));
      }
    }
  } catch (error) {
    set({ isProjectBusy: false, lastError: toErrorMessage(error), projectMessage: 'Comfy output import failed' });
  }
}

export async function hydrateAssetThumbnails(
  assets: Asset[],
  set: StoreSet,
  _get: StoreGet,
): Promise<void> {
  if (assets.length === 0) {
    return;
  }

  const ipc = getIpcClient();
  const entries = await Promise.all(
    assets.map(async (asset) => {
      const dataUrl = await ipc.getAssetThumbnailDataUrl(asset.thumbnailPath);
      return [asset.id, dataUrl] as const;
    }),
  );

  const thumbnailMap: Record<string, string | null> = {};
  entries.forEach(([assetId, dataUrl]) => {
    thumbnailMap[assetId] = dataUrl;
  });

  set({ assetThumbnails: thumbnailMap });
}

export async function hydrateKnownVideoProxies(
  assets: Asset[],
  set: StoreSet,
  _get: StoreGet,
): Promise<void> {
  const videoAssets = assets.filter((asset) => asset.type === 'video');
  if (videoAssets.length === 0) {
    return;
  }

  const ipc = getIpcClient();
  const resolved = await Promise.all(
    videoAssets.map(async (asset) => {
      const response = await ipc.ensureVideoProxy(asset.filePath);
      if (!response.success || !response.proxyRelativePath) {
        return null;
      }

      return [asset.id, response.proxyRelativePath] as const;
    }),
  );

  const proxyMap: Record<string, string> = {};
  resolved.forEach((entry) => {
    if (!entry) {
      return;
    }
    const [assetId, path] = entry;
    proxyMap[assetId] = path;
  });

  if (Object.keys(proxyMap).length === 0) {
    return;
  }

  set((state) => ({
    proxyPathByAssetId: {
      ...state.proxyPathByAssetId,
      ...proxyMap,
    },
  }));
}
