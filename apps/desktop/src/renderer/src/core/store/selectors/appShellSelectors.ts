import type { StudioState } from '../studioStore';

export const selectAppShellStoreState = (state: StudioState) => ({
  pastCount: state.pastCount,
  futureCount: state.futureCount,
  undoUi: state.undoUi,
  redoUi: state.redoUi,
  projectName: state.projectName,
  projectMessage: state.projectMessage,
  isProjectBusy: state.isProjectBusy,
  isDirty: state.isDirty,
  hasProject: state.project !== null,
  comfyOnline: state.comfyOnline,
  ffmpegStatus: state.ffmpegStatus,
  lastError: state.lastError,
  clearLastError: state.clearLastError,
  checkComfyHealth: state.checkComfyHealth,
  bindComfyRunEvents: state.bindComfyRunEvents,
  checkFfmpegHealth: state.checkFfmpegHealth,
  newProject: state.newProject,
  loadProject: state.loadProject,
  saveProject: state.saveProject,
});
