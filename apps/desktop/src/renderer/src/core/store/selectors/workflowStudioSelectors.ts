import type { StudioState } from '../studioStore';

export const selectWorkflowStudioStoreState = (state: StudioState) => ({
  projectRoot: state.projectRoot,
  assets: state.assets,
  comfyOnline: state.comfyOnline,
  comfyBaseUrl: state.comfyBaseUrl,
  isProjectBusy: state.isProjectBusy,
  queuedWorkflowRuns: state.queuedWorkflowRuns,
  autoImportedOutputPathsByRunId: state.autoImportedOutputPathsByRunId,
  importComfyOutputAsset: state.importComfyOutputAsset,
  dropAssetToTimeline: state.dropAssetToTimeline,
  setComfyBaseUrl: state.setComfyBaseUrl,
  checkComfyHealth: state.checkComfyHealth,
});
