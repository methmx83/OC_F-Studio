import type { StudioState } from '../studioStore';

export const selectWorkflowStudioStoreState = (state: StudioState) => ({
  projectRoot: state.projectRoot,
  assets: state.assets,
  comfyOnline: state.comfyOnline,
  isProjectBusy: state.isProjectBusy,
  queuedWorkflowRuns: state.queuedWorkflowRuns,
  importComfyOutputAsset: state.importComfyOutputAsset,
  checkComfyHealth: state.checkComfyHealth,
});
