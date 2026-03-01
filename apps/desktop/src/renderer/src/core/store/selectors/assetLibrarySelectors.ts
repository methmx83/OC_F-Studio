import type { StudioState } from '../studioStore';

export const selectAssetLibraryStoreState = (state: StudioState) => ({
  filter: state.assetFilter,
  query: state.assetQuery,
  assets: state.assets,
  thumbnails: state.assetThumbnails,
  isProjectBusy: state.isProjectBusy,
  hasProject: state.project !== null,
  setFilter: state.setAssetFilter,
  setQuery: state.setAssetQuery,
  importVideoAsset: state.importVideoAsset,
  importImageAsset: state.importImageAsset,
  importAudioAsset: state.importAudioAsset,
});
