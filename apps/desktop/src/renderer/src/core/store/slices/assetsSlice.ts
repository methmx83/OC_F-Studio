/* eslint-disable no-unused-vars */
import { getIpcClient } from '../../adapters/ipcClient';
import type { StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

interface AssetsSliceDeps {
  toErrorMessage(error: unknown): string;
  importAssetByType(
    type: 'video' | 'image' | 'audio',
    set: StoreSet<StudioState>,
    get: StoreGet<StudioState>,
  ): Promise<void>;
  importComfyOutputAssetByPath(
    outputPath: string,
    set: StoreSet<StudioState>,
    get: StoreGet<StudioState>,
  ): Promise<void>;
}

type AssetsSliceKeys =
  | 'assets'
  | 'assetThumbnails'
  | 'assetFilter'
  | 'assetQuery'
  | 'ffmpegStatus'
  | 'proxyPathByAssetId'
  | 'proxyPendingByAssetId'
  | 'setAssetFilter'
  | 'setAssetQuery'
  | 'checkFfmpegHealth'
  | 'ensureVideoProxy'
  | 'importVideoAsset'
  | 'importImageAsset'
  | 'importAudioAsset'
  | 'importComfyOutputAsset';

export function createAssetsSlice(
  set: StoreSet<StudioState>,
  get: StoreGet<StudioState>,
  deps: AssetsSliceDeps,
): Pick<StudioState, AssetsSliceKeys> {
  return {
    assets: [],
    assetThumbnails: {},
    assetFilter: 'All',
    assetQuery: '',
    ffmpegStatus: { available: null, version: null, message: 'FFmpeg status unknown' },
    proxyPathByAssetId: {},
    proxyPendingByAssetId: {},

    setAssetFilter: (filter) => set({ assetFilter: filter }),
    setAssetQuery: (query) => set({ assetQuery: query }),

    checkFfmpegHealth: async () => {
      try {
        const ipc = getIpcClient();
        const response = await ipc.getFfmpegHealth();
        set({
          ffmpegStatus: {
            available: response.available,
            version: response.version,
            message: response.message,
          },
        });
      } catch (error) {
        set({
          ffmpegStatus: {
            available: false,
            version: null,
            message: `FFmpeg check failed: ${deps.toErrorMessage(error)}`,
          },
        });
      }
    },

    ensureVideoProxy: async (assetId) => {
      const state = get();
      const asset = state.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.type !== 'video') {
        return;
      }

      if (state.proxyPendingByAssetId[assetId]) {
        return;
      }

      set((current) => ({
        proxyPendingByAssetId: {
          ...current.proxyPendingByAssetId,
          [assetId]: true,
        },
      }));

      try {
        const ipc = getIpcClient();
        const response = await ipc.ensureVideoProxy(asset.filePath);
        set((current) => ({
          proxyPendingByAssetId: {
            ...current.proxyPendingByAssetId,
            [assetId]: false,
          },
          proxyPathByAssetId: response.success && response.proxyRelativePath
            ? {
                ...current.proxyPathByAssetId,
                [assetId]: response.proxyRelativePath,
              }
            : current.proxyPathByAssetId,
          projectMessage: response.message,
          lastError: response.success ? current.lastError : response.message,
        }));
      } catch (error) {
        set((current) => ({
          proxyPendingByAssetId: {
            ...current.proxyPendingByAssetId,
            [assetId]: false,
          },
          lastError: `Proxy generation failed: ${deps.toErrorMessage(error)}`,
        }));
      }
    },

    importVideoAsset: async () => {
      await deps.importAssetByType('video', set, get);
    },

    importImageAsset: async () => {
      await deps.importAssetByType('image', set, get);
    },

    importAudioAsset: async () => {
      await deps.importAssetByType('audio', set, get);
    },

    importComfyOutputAsset: async (outputPath) => {
      await deps.importComfyOutputAssetByPath(outputPath, set, get);
    },
  };
}
