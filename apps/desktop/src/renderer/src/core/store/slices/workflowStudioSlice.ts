/* eslint-disable no-unused-vars */
import type { ComfyRunEvent } from '@shared/comfy';

import {
  COMFY_BRIDGE_UNAVAILABLE_MESSAGE,
  WORKFLOW_TEMPLATE_IMPORT_UNAVAILABLE_MESSAGE,
  getIpcClient,
  isIpcUnavailableError,
} from '../../adapters/ipcClient';
import {
  createDefaultWorkflowParameters,
  getWorkflowContractById,
  type WorkflowParameterMap,
} from '../../comfy/workflowContracts';
import type { StudioState } from '../studioStore';

type StoreSet<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | T),
) => void;
type StoreGet<T> = () => T;

interface WorkflowStudioSliceDeps {
  toErrorMessage(error: unknown): string;
  createId(prefix: string): string;
  mergeWorkflowParameters(
    current: WorkflowParameterMap,
    partial: Partial<WorkflowParameterMap>,
  ): WorkflowParameterMap;
  promptForWorkflowId(): string | null;
  upsertWorkflowDefinitionInProject(
    project: StudioState['project'],
    definition: NonNullable<StudioState['project']>['workflowDefinitions'][number],
  ): StudioState['project'];
  applyComfyRunEventState(state: StudioState, event: ComfyRunEvent): Partial<StudioState>;
  workflowIdPattern: RegExp;
  defaultWorkflowVersion: string;
}

type WorkflowStudioSliceKeys =
  | 'workflows'
  | 'selectedWorkflowId'
  | 'importWorkflowTemplateForSelected'
  | 'selectWorkflow'
  | 'removeWorkflow'
  | 'patchWorkflow'
  | 'queueSelectedWorkflowRun';

const INITIAL_WORKFLOWS: StudioState['workflows'] = [];

export function createWorkflowStudioSlice(
  set: StoreSet<StudioState>,
  get: StoreGet<StudioState>,
  deps: WorkflowStudioSliceDeps,
): Pick<StudioState, WorkflowStudioSliceKeys> {
  return {
    workflows: INITIAL_WORKFLOWS,
    selectedWorkflowId: INITIAL_WORKFLOWS[0]?.id ?? '',

    importWorkflowTemplateForSelected: async () => {
      const state = get();
      const selectedWorkflow = state.workflows.find((workflow) => workflow.id === state.selectedWorkflowId) ?? null;
      let workflowId = selectedWorkflow?.id ?? '';
      let workflowName = selectedWorkflow?.name ?? '';

      if (!workflowId) {
        const promptedId = deps.promptForWorkflowId();
        if (!promptedId) {
          set({ projectMessage: 'Workflow template import canceled.' });
          return;
        }
        workflowId = promptedId;
        workflowName = promptedId;
      }

      if (!deps.workflowIdPattern.test(workflowId)) {
        set({ lastError: `Invalid workflow ID "${workflowId}". Allowed: letters, numbers, "-" and "_".` });
        return;
      }

      try {
        const ipc = getIpcClient();
        const response = await ipc.importWorkflowTemplate(workflowId);
        if (!response.success) {
          set({
            projectMessage: response.message,
            lastError: response.message,
          });
          return;
        }

        set((currentState) => {
          const existingWorkflow = currentState.workflows.find((workflow) => workflow.id === workflowId) ?? null;
          const contract = getWorkflowContractById(workflowId);
          const defaultParameters = contract ? createDefaultWorkflowParameters(contract) : {};
          const resolvedName = existingWorkflow?.name ?? (workflowName || workflowId);
          const nextWorkflows = existingWorkflow
            ? currentState.workflows
            : [
                ...currentState.workflows,
                {
                  id: workflowId,
                  name: resolvedName,
                  parameters: defaultParameters,
                },
              ];

          const nextProject = deps.upsertWorkflowDefinitionInProject(currentState.project, {
            id: workflowId,
            name: resolvedName,
            version: deps.defaultWorkflowVersion,
            config: existingWorkflow?.parameters ?? defaultParameters,
          });

          return {
            workflows: nextWorkflows,
            selectedWorkflowId: workflowId,
            project: nextProject,
            isDirty: nextProject ? true : currentState.isDirty,
            projectMessage: response.message,
            lastError: null,
          };
        });

        const refreshed = get();
        if (refreshed.project) {
          const ipc = getIpcClient();
          const saveResponse = await ipc.saveProject(refreshed.project);
          set({
            projectMessage: saveResponse.message,
            lastError: saveResponse.success ? null : saveResponse.message,
            isDirty: saveResponse.success ? false : refreshed.isDirty,
          });
        }
      } catch (error) {
        if (isIpcUnavailableError(error)) {
          set({ lastError: WORKFLOW_TEMPLATE_IMPORT_UNAVAILABLE_MESSAGE });
          return;
        }

        set({
          lastError: `Workflow template import failed: ${deps.toErrorMessage(error)}`,
        });
      }
    },

    selectWorkflow: (id) => set({ selectedWorkflowId: id }),

    removeWorkflow: (id) =>
      set((state) => {
        const nextWorkflows = state.workflows.filter((workflow) => workflow.id !== id);
        const currentSelectionStillExists = nextWorkflows.some((workflow) => workflow.id === state.selectedWorkflowId);
        const nextProject = state.project
          ? {
              ...state.project,
              workflowDefinitions: state.project.workflowDefinitions.filter((definition) => definition.id !== id),
            }
          : state.project;

        return {
          workflows: nextWorkflows,
          selectedWorkflowId: currentSelectionStillExists ? state.selectedWorkflowId : (nextWorkflows[0]?.id ?? ''),
          project: nextProject,
          isDirty: nextProject ? true : state.isDirty,
        };
      }),

    patchWorkflow: (id, partial) =>
      set((state) => {
        const nextWorkflows = state.workflows.map((workflow) =>
          workflow.id === id
            ? { ...workflow, parameters: deps.mergeWorkflowParameters(workflow.parameters, partial) }
            : workflow,
        );

        const updatedWorkflow = nextWorkflows.find((workflow) => workflow.id === id) ?? null;
        const nextProject = updatedWorkflow
          ? deps.upsertWorkflowDefinitionInProject(state.project, {
              id,
              name: updatedWorkflow.name,
              version: deps.defaultWorkflowVersion,
              config: updatedWorkflow.parameters,
            })
          : state.project;

        return {
          workflows: nextWorkflows,
          project: nextProject,
          isDirty: nextProject ? true : state.isDirty,
        };
      }),

    queueSelectedWorkflowRun: async () => {
      const state = get();
      const selected = state.workflows.find((workflow) => workflow.id === state.selectedWorkflowId);
      if (!selected) {
        set({ lastError: 'No workflow selected.' });
        return;
      }

      const contract = getWorkflowContractById(selected.id);
      if (!contract) {
        set({ lastError: `Workflow "${selected.name}" has no typed contract yet.` });
        return;
      }

      const request = contract.toRequest(selected.parameters);
      if (!request) {
        set({ lastError: `Workflow "${selected.name}" is missing required inputs.` });
        return;
      }

      const runId = deps.createId('wf_run');
      const now = new Date().toISOString();
      const queuedRun: StudioState['queuedWorkflowRuns'][number] = {
        id: runId,
        workflowId: selected.id,
        workflowName: selected.name,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
        promptId: null,
        progress: 0,
        message: 'Submitting workflow to ComfyUI...',
        outputPaths: [],
        request,
      };

      set((currentState) => ({
        queuedWorkflowRuns: [queuedRun, ...currentState.queuedWorkflowRuns].slice(0, 50),
        projectMessage: `Queueing workflow "${selected.name}"...`,
        lastError: null,
      }));

      try {
        const ipc = getIpcClient();
        const baseUrlOverride = state.comfyBaseUrl.trim();
        const response = await ipc.queueComfyRun({
          runId,
          request,
          baseUrlOverride: baseUrlOverride.length > 0 ? baseUrlOverride : undefined,
        });

        if (!response.success) {
          set((currentState) => ({
            ...deps.applyComfyRunEventState(currentState, {
              runId,
              workflowId: request.workflowId,
              promptId: response.promptId,
              status: 'failed',
              message: response.message,
              progress: null,
              outputPaths: [],
              occurredAt: new Date().toISOString(),
            }),
            lastError: response.message,
          }));
          return;
        }

        set((currentState) =>
          deps.applyComfyRunEventState(currentState, {
            runId,
            workflowId: request.workflowId,
            promptId: response.promptId,
            status: 'pending',
            message: response.message,
            progress: 0,
            outputPaths: [],
            occurredAt: new Date().toISOString(),
          }),
        );
      } catch (error) {
        if (isIpcUnavailableError(error)) {
          set((currentState) => ({
            ...deps.applyComfyRunEventState(currentState, {
              runId,
              workflowId: request.workflowId,
              status: 'failed',
              message: COMFY_BRIDGE_UNAVAILABLE_MESSAGE,
              progress: null,
              outputPaths: [],
              occurredAt: new Date().toISOString(),
            }),
            lastError: COMFY_BRIDGE_UNAVAILABLE_MESSAGE,
          }));
          return;
        }

        const message = `Workflow queue request failed: ${deps.toErrorMessage(error)}`;
        set((currentState) => ({
          ...deps.applyComfyRunEventState(currentState, {
            runId,
            workflowId: request.workflowId,
            status: 'failed',
            message,
            progress: null,
            outputPaths: [],
            occurredAt: new Date().toISOString(),
          }),
          lastError: message,
        }));
      }
    },
  };
}
