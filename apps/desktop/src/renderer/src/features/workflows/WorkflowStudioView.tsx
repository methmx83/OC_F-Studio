import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlaskConical,
  Copy,
  Film,
  FolderTree,
  Image as ImageIcon,
  Music2,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import type { ComfyWorkflowRunRequest, GenericComfyWorkflowRunRequest } from "@shared/comfy";
import type { WorkflowPresetItem, WorkflowPresetsMap } from "@shared/ipc/project";
import type { Asset } from "@shared/types";
import { useShallow } from "zustand/shallow";
import type {
  WorkflowCatalogCategory,
  WorkflowCatalogEntry,
  WorkflowCatalogResponse,
  WorkflowMetaInputDefinition,
} from "@shared/workflows";

import { getIpcClient } from "../../core/adapters/ipcClient";
import { selectWorkflowStudioStoreState } from "../../core/store/selectors";
import { useStudioStore } from "../../core/store/studioStore";
import NodeWorkflowEditor from "./NodeWorkflowEditor";

type LoadState = "idle" | "loading" | "loaded" | "error";
type NumKey = "width" | "height" | "fps" | "frames" | "steps";
type SendStatus = "idle" | "sending" | "success" | "error";
type RunFilter = "all" | "queued" | "failed" | "success";
type RunSort = "newest" | "oldest";
type EditorMode = "form" | "graph";

type Draft = {
  settings: Record<NumKey, string>;
  inputs: Record<string, string>;
};

type WorkflowIssue = {
  code: string;
  message: string;
  nextStep: string;
};

type Validation = {
  canSend: boolean;
  request: GenericComfyWorkflowRunRequest | null;
  issues: WorkflowIssue[];
};

type SendState = {
  status: SendStatus;
  message: string;
  runId?: string;
  promptId?: string;
  hint?: string;
  code?: string;
  nextStep?: string;
};

type ImportAllSummary = {
  imported: number;
  skipped: number;
  reasonCounts: Record<string, number>;
  skippedExamples: string[];
  message: string;
};

type WorkflowPreset = WorkflowPresetItem;
type PresetConflictState = {
  workflowId: string;
  message: string;
  remotePresets: WorkflowPresetsMap;
  remoteUpdatedAtByWorkflow: Record<string, string>;
};

const CATS: Array<{ id: WorkflowCatalogCategory; label: string; icon: React.ReactNode }> = [
  { id: "images", label: "Images", icon: <ImageIcon size={14} /> },
  { id: "videos", label: "Videos", icon: <Film size={14} /> },
  { id: "audio", label: "Audio", icon: <Music2 size={14} /> },
];

const NUM_FIELDS: Array<{ key: NumKey; label: string }> = [
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
  { key: "fps", label: "FPS" },
  { key: "frames", label: "Frames" },
  { key: "steps", label: "Steps" },
];

export default function WorkflowStudioView() {
  const {
    projectRoot,
    assets,
    comfyOnline,
    comfyBaseUrl,
    isProjectBusy,
    queuedWorkflowRuns,
    autoImportedOutputPathsByRunId,
    importComfyOutputAsset,
    dropAssetToTimeline,
    setComfyBaseUrl,
    checkComfyHealth,
  } = useStudioStore(useShallow(selectWorkflowStudioStoreState));

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [catalog, setCatalog] = useState<WorkflowCatalogResponse | null>(null);
  const [cat, setCat] = useState<WorkflowCatalogCategory>("videos");
  const [wfId, setWfId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [inputConnectionsByWorkflow, setInputConnectionsByWorkflow] = useState<Record<string, Record<string, boolean>>>({});
  const [sendState, setSendState] = useState<SendState>({
    status: "idle",
    message: "",
  });
  const [importingOutputPath, setImportingOutputPath] = useState<string | null>(null);
  const [importingRunId, setImportingRunId] = useState<string | null>(null);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [copiedAuthoringHint, setCopiedAuthoringHint] = useState<"tokens" | "inputs" | null>(null);
  const [copiedRenderedPayload, setCopiedRenderedPayload] = useState(false);
  const [showComfyPasteHint, setShowComfyPasteHint] = useState(false);
  const [importAllSummaries, setImportAllSummaries] = useState<Record<string, ImportAllSummary>>({});
  const [manuallyImportedOutputPathsByRunId, setManuallyImportedOutputPathsByRunId] = useState<Record<string, string[]>>({});
  const [runFilter, setRunFilter] = useState<RunFilter>(() => {
    try {
      const raw = window.sessionStorage.getItem("workflowStudio.recentRuns.filter");
      if (raw === "queued" || raw === "failed" || raw === "success") {
        return raw;
      }
      return "all";
    } catch {
      return "all";
    }
  });
  const [runSort, setRunSort] = useState<RunSort>(() => {
    try {
      const raw = window.sessionStorage.getItem("workflowStudio.recentRuns.sort");
      return raw === "oldest" ? "oldest" : "newest";
    } catch {
      return "newest";
    }
  });
  const [editorMode, setEditorMode] = useState<EditorMode>("form");
  const [presetsByWorkflow, setPresetsByWorkflow] = useState<Record<string, WorkflowPreset[]>>({});
  const [presetUpdatedAtByWorkflow, setPresetUpdatedAtByWorkflow] = useState<Record<string, string>>({});
  const [presetLoadWarning, setPresetLoadWarning] = useState<string | null>(null);
  const [presetConflictState, setPresetConflictState] = useState<PresetConflictState | null>(null);
  const [presetsHydrated, setPresetsHydrated] = useState(false);
  const [isSavingPresets, setIsSavingPresets] = useState(false);
  const [isReloadingPresets, setIsReloadingPresets] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [autoPlaceImportedOutputs, setAutoPlaceImportedOutputs] = useState(true);
  const skipNextPresetPersistRef = useRef(false);

  const setWorkflowErrorState = (rawMessage: string, fallbackCode: string, context?: { runId?: string; promptId?: string }) => {
    const issue = resolveWorkflowIssue(rawMessage, fallbackCode);
    setSendState({
      status: "error",
      message: issue.message,
      code: issue.code,
      nextStep: issue.nextStep,
      hint: issue.nextStep,
      runId: context?.runId,
      promptId: context?.promptId,
    });
  };

  const rememberQueuedRunRequest = (
    runId: string,
    workflowId: string,
    workflowName: string,
    request: ComfyWorkflowRunRequest,
  ) => {
    useStudioStore.setState((state) => {
      const now = new Date().toISOString();
      const existing = state.queuedWorkflowRuns.find((run) => run.id === runId);
      const nextRun = {
        id: runId,
        workflowId,
        workflowName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        status: existing?.status ?? "pending",
        promptId: existing?.promptId ?? null,
        progress: existing?.progress ?? 0,
        message: existing?.message ?? `Queueing workflow "${workflowName}"...`,
        outputPaths: existing?.outputPaths ?? [],
        request,
      } as const;

      const withoutCurrent = state.queuedWorkflowRuns.filter((run) => run.id !== runId);
      const nextRuns = [nextRun, ...withoutCurrent].sort(compareRunsByNewest).slice(0, 80);
      return { queuedWorkflowRuns: nextRuns };
    });
  };

  const rememberManualImportedOutputPath = (runId: string, outputPath: string) => {
    setManuallyImportedOutputPathsByRunId((prev) => {
      const existing = prev[runId] ?? [];
      if (existing.includes(outputPath)) {
        return prev;
      }
      return {
        ...prev,
        [runId]: [...existing, outputPath],
      };
    });
  };

  const isOutputAlreadyImported = (runId: string, outputPath: string): boolean => {
    const autoImported = autoImportedOutputPathsByRunId[runId] ?? [];
    if (autoImported.includes(outputPath)) {
      return true;
    }

    const manuallyImported = manuallyImportedOutputPathsByRunId[runId] ?? [];
    return manuallyImported.includes(outputPath);
  };

  useEffect(() => {
    void loadCatalog();
  }, [projectRoot]);

  async function loadCatalog(): Promise<void> {
    setLoadState("loading");
    try {
      const res = await getIpcClient().listWorkflowCatalog();
      setCatalog(res);
      setLoadState(res.success ? "loaded" : "error");
    } catch (e) {
      setCatalog({ success: false, message: `Failed to load workflow catalog: ${e instanceof Error ? e.message : String(e)}`, warnings: [], workflows: [] });
      setLoadState("error");
    }
  }

  const wfList = useMemo(() => (catalog?.workflows ?? []).filter((w) => w.category === cat), [catalog, cat]);
  useEffect(() => {
    if (wfList.some((w) => w.id === wfId)) return;
    setWfId(wfList[0]?.id ?? "");
  }, [wfId, wfList]);

  const selected = useMemo(() => wfList.find((w) => w.id === wfId) ?? null, [wfList, wfId]);

  useEffect(() => {
    if (!catalog) return;
    setDrafts((prev) => {
      const next = { ...prev };
      catalog.workflows.forEach((w) => {
        next[w.id] = mergeDraft(w, prev[w.id]);
      });
      return next;
    });
    setInputConnectionsByWorkflow((prev) => {
      const next = { ...prev };
      catalog.workflows.forEach((w) => {
        next[w.id] = mergeInputConnections(w, prev[w.id]);
      });
      return next;
    });
  }, [catalog]);

  useEffect(() => {
    setSendState({ status: "idle", message: "" });
  }, [wfId]);

  useEffect(() => {
    setSelectedPresetId("");
    setPresetName("");
  }, [wfId]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateWorkflowPresets(): Promise<void> {
      if (!projectRoot) {
        setPresetsByWorkflow({});
        setPresetUpdatedAtByWorkflow({});
        setPresetLoadWarning(null);
        setPresetConflictState(null);
        setPresetsHydrated(false);
        return;
      }

      setPresetsHydrated(false);
      try {
        const response = await getIpcClient().getWorkflowPresets();
        if (isCancelled) return;
        if (response.success) {
          skipNextPresetPersistRef.current = true;
          setPresetsByWorkflow(response.presets ?? {});
          setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
          setPresetLoadWarning((response.message || "").includes("with warnings") ? response.message : null);
          setPresetConflictState(null);
        } else {
          setPresetsByWorkflow({});
          setPresetLoadWarning(null);
          setPresetConflictState(null);
          setSendState({ status: "error", message: response.message || "Workflow-Presets konnten nicht geladen werden." });
        }
      } catch (error) {
        if (isCancelled) return;
        setPresetsByWorkflow({});
        setPresetLoadWarning(null);
        setPresetConflictState(null);
        setSendState({
          status: "error",
          message: `Workflow-Presets konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)}`,
        });
      } finally {
        if (!isCancelled) {
          setPresetsHydrated(true);
        }
      }
    }

    void hydrateWorkflowPresets();

    return () => {
      isCancelled = true;
    };
  }, [projectRoot]);

  useEffect(() => {
    let isCancelled = false;

    async function persistWorkflowPresets(): Promise<void> {
      if (!projectRoot || !presetsHydrated) return;
      if (skipNextPresetPersistRef.current) {
        skipNextPresetPersistRef.current = false;
        return;
      }
      if (presetConflictState) {
        return;
      }

      setIsSavingPresets(true);
      try {
        const response = await getIpcClient().saveWorkflowPresets({
          presets: presetsByWorkflow as WorkflowPresetsMap,
          expectedUpdatedAtByWorkflow: presetUpdatedAtByWorkflow,
        });
        if (isCancelled) return;
        if (response.success) {
          setPresetConflictState(null);
          const merged = response.presets ?? {};
          skipNextPresetPersistRef.current = true;
          setPresetsByWorkflow(merged);
          setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
        } else {
          if ((response.message || "").includes("PRESET_CONFLICT")) {
            const conflictedWorkflowId = parseConflictedWorkflowId(response.message, wfId);
            const conflictMessage = `Preset-Konflikt erkannt fuer Workflow "${conflictedWorkflowId}". Entscheide zwischen lokalem Stand und Dateistand.`;
            setPresetConflictState({
              workflowId: conflictedWorkflowId,
              message: conflictMessage,
              remotePresets: response.presets ?? {},
              remoteUpdatedAtByWorkflow: response.updatedAtByWorkflow ?? {},
            });
            setSendState({
              status: "error",
              message: conflictMessage,
            });
          } else {
            setSendState({ status: "error", message: response.message || "Workflow-Presets konnten nicht gespeichert werden." });
          }
        }
      } catch (error) {
        if (isCancelled) return;
        setSendState({
          status: "error",
          message: `Workflow-Presets konnten nicht gespeichert werden: ${error instanceof Error ? error.message : String(error)}`,
        });
      } finally {
        if (!isCancelled) {
          setIsSavingPresets(false);
        }
      }
    }

    void persistWorkflowPresets();

    return () => {
      isCancelled = true;
    };
  }, [presetConflictState, presetUpdatedAtByWorkflow, presetsByWorkflow, presetsHydrated, projectRoot, wfId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("workflowStudio.recentRuns.sort", runSort);
    } catch {
      // ignore session storage errors
    }
  }, [runSort]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem("workflowStudio.recentRuns.filter", runFilter);
    } catch {
      // ignore session storage errors
    }
  }, [runFilter]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const draft = useMemo(() => (selected ? mergeDraft(selected, drafts[selected.id]) : null), [selected, drafts]);
  const inputConnections = useMemo(
    () => (selected ? mergeInputConnections(selected, inputConnectionsByWorkflow[selected.id]) : null),
    [selected, inputConnectionsByWorkflow],
  );
  const validation = useMemo(
    () => (selected && draft ? validate(selected, draft, assets, inputConnections ?? undefined) : null),
    [selected, draft, assets, inputConnections],
  );
  const selectedWorkflowRuns = useMemo(() => {
    if (!selected) {
      return [];
    }

    const dedupedByRunId = new Map<string, (typeof queuedWorkflowRuns)[number]>();
    queuedWorkflowRuns.forEach((run) => {
      if (run.workflowId !== selected.id) {
        return;
      }

      const existing = dedupedByRunId.get(run.id);
      if (!existing) {
        dedupedByRunId.set(run.id, run);
        return;
      }

      const existingTs = Number.isFinite(new Date(existing.updatedAt).getTime()) ? new Date(existing.updatedAt).getTime() : 0;
      const incomingTs = Number.isFinite(new Date(run.updatedAt).getTime()) ? new Date(run.updatedAt).getTime() : 0;
      if (incomingTs >= existingTs) {
        dedupedByRunId.set(run.id, run);
      }
    });

    const runs = Array.from(dedupedByRunId.values());
    runs.sort((a, b) => compareRunsByNewest(a, b));
    return runs.slice(0, 24);
  }, [queuedWorkflowRuns, selected]);
  const filteredWorkflowRuns = useMemo(() => {
    if (runFilter === "all") return selectedWorkflowRuns;
    if (runFilter === "queued") {
      return selectedWorkflowRuns.filter((run) => run.status === "pending" || run.status === "running");
    }
    return selectedWorkflowRuns.filter((run) => run.status === runFilter);
  }, [selectedWorkflowRuns, runFilter]);
  const sortedFilteredWorkflowRuns = useMemo(() => {
    const list = [...filteredWorkflowRuns];
    list.sort((a, b) => {
      if (runSort === "newest") {
        return compareRunsByNewest(a, b);
      }
      return compareRunsByOldest(a, b);
    });
    return list;
  }, [filteredWorkflowRuns, runSort]);
  const workflowPresets = useMemo(() => (selected ? presetsByWorkflow[selected.id] ?? [] : []), [selected, presetsByWorkflow]);
  const expectedTemplateTokens = useMemo(() => (selected ? buildExpectedTemplateTokens(selected.inputs) : []), [selected]);
  const activePresetConflict = useMemo(() => {
    if (!selected || !presetConflictState) {
      return null;
    }
    return presetConflictState.workflowId === selected.id ? presetConflictState : null;
  }, [presetConflictState, selected]);
  const isPresetConflictOperationBusy = isSavingPresets || isReloadingPresets;
  const shouldDisablePresetInputs = isPresetConflictOperationBusy || activePresetConflict !== null;

  useEffect(() => {
    if (!selected || !selectedPresetId) {
      return;
    }

    const selectedPreset = workflowPresets.find((preset) => preset.id === selectedPresetId);
    if (!selectedPreset) {
      setSelectedPresetId("");
      setPresetName("");
      return;
    }

    if (presetName !== selectedPreset.name) {
      setPresetName(selectedPreset.name);
    }
  }, [presetName, selected, selectedPresetId, workflowPresets]);

  // eslint-disable-next-line no-unused-vars
  const patchDraft = (fn: (draftValue: Draft) => Draft) => {
    if (!selected) return;
    setDrafts((prev) => ({ ...prev, [selected.id]: fn(mergeDraft(selected, prev[selected.id])) }));
  };

  const onNum = (key: NumKey, value: string) => {
    patchDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  };
  const onInput = (key: string, value: string) => {
    if (!selected) return;
    patchDraft((d) => ({ ...d, inputs: { ...d.inputs, [key]: value } }));
    if (value.trim()) {
      setInputConnectionsByWorkflow((prev) => ({
        ...prev,
        [selected.id]: {
          ...mergeInputConnections(selected, prev[selected.id]),
          [key]: true,
        },
      }));
    }
  };
  const onInputConnectionChange = (key: string, connected: boolean) => {
    if (!selected) return;
    setInputConnectionsByWorkflow((prev) => ({
      ...prev,
      [selected.id]: {
        ...mergeInputConnections(selected, prev[selected.id]),
        [key]: connected,
      },
    }));
  };

  function onSavePreset(): void {
    if (!selected || !draft || shouldDisablePresetInputs) return;
    const name = presetName.trim();
    if (!name) {
      setSendState({ status: "error", message: "Preset-Name fehlt." });
      return;
    }

    const now = new Date().toISOString();
    setPresetsByWorkflow((prev) => {
      const current = prev[selected.id] ?? [];
      const existing = selectedPresetId ? current.find((p) => p.id === selectedPresetId) : undefined;
      const nextPreset: WorkflowPreset = {
        id: existing?.id ?? makePresetId(),
        name,
        draft,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const nextList = existing ? current.map((p) => (p.id === existing.id ? nextPreset : p)) : [nextPreset, ...current];
      setSelectedPresetId(nextPreset.id);
      return { ...prev, [selected.id]: nextList.slice(0, 20) };
    });
    setPresetConflictState(null);
    setSendState({ status: "success", message: "Preset gespeichert." });
  }

  function onApplyPreset(): void {
    if (!selected || shouldDisablePresetInputs) return;
    const preset = workflowPresets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    setDrafts((prev) => ({ ...prev, [selected.id]: mergeDraft(selected, preset.draft) }));
    setSendState({ status: "success", message: `Preset "${preset.name}" angewendet.` });
  }

  function onDeletePreset(): void {
    if (!selected || !selectedPresetId || shouldDisablePresetInputs) return;
    setPresetsByWorkflow((prev) => {
      const current = prev[selected.id] ?? [];
      return { ...prev, [selected.id]: current.filter((p) => p.id !== selectedPresetId) };
    });
    setSelectedPresetId("");
    setPresetName("");
    setPresetConflictState(null);
    setSendState({ status: "success", message: "Preset geloescht." });
  }

  async function onSend(): Promise<void> {
    if (!selected) {
      setWorkflowErrorState("No workflow selected.", "WF_SEND_NO_WORKFLOW");
      return;
    }
    if (!validation?.canSend || !validation.request) {
      const firstIssue = validation?.issues[0] ?? null;
      if (firstIssue) {
        setSendState({
          status: "error",
          message: firstIssue.message,
          code: firstIssue.code,
          nextStep: firstIssue.nextStep,
          hint: firstIssue.nextStep,
        });
      } else {
        setWorkflowErrorState("Workflow validation failed before send.", "WF_SEND_VALIDATION");
      }
      return;
    }

    const runId = makeRunId();
    rememberQueuedRunRequest(runId, validation.request.workflowId, selected.name, validation.request);
    setSendState({ status: "sending", message: `Queueing "${selected.name}"...`, runId });
    try {
      const preflight = await getIpcClient().previewComfyRunPayload({
        request: validation.request,
        baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
      });
      if (!preflight.success) {
        setWorkflowErrorState(preflight.message || "Workflow payload preflight failed.", "WF_SEND_PREFLIGHT_FAILED", { runId });
        return;
      }

      const res = await getIpcClient().queueComfyRun({
        runId,
        request: validation.request,
        baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
      });
      if (!res.success) {
        setWorkflowErrorState(res.message, "WF_SEND_QUEUE_FAILED", { runId: res.runId, promptId: res.promptId });
        return;
      }

      setSendState({
        status: "success",
        message: res.message,
        runId: res.runId,
        promptId: res.promptId,
      });
    } catch (e) {
      const message = `Workflow queue request failed: ${e instanceof Error ? e.message : String(e)}`;
      setWorkflowErrorState(message, "WF_SEND_QUEUE_EXCEPTION", { runId });
    }
  }

  async function buildRenderedPayloadJson(): Promise<string | null> {
    if (!validation?.request) {
      setWorkflowErrorState("Cannot render payload because workflow validation failed.", "WF_SEND_VALIDATION");
      return null;
    }

    const response = await getIpcClient().previewComfyRunPayload({
      request: validation.request,
      baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
    });

    if (!response.success || !response.renderedPrompt) {
      setWorkflowErrorState(response.message || "Rendern des Workflow-Payloads fehlgeschlagen.", "WF_SEND_PAYLOAD_PREVIEW_FAILED");
      return null;
    }

    return JSON.stringify(response.renderedPrompt, null, 2);
  }

  function onOpenInComfyUi(): void {
    const url = (comfyBaseUrl || "http://127.0.0.1:8188").trim();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onCopyRenderedPayload(): Promise<void> {
    try {
      const payloadJson = await buildRenderedPayloadJson();
      if (!payloadJson) {
        return;
      }

      await navigator.clipboard.writeText(payloadJson);
      setCopiedRenderedPayload(true);
      window.setTimeout(() => setCopiedRenderedPayload(false), 1500);
    } catch (error) {
      setWorkflowErrorState(`Copy rendered payload failed: ${error instanceof Error ? error.message : String(error)}`, "WF_UI_CLIPBOARD_FAILED");
    }
  }

  async function onOpenAndCopyComfyUi(): Promise<void> {
    await onCopyRenderedPayload();
    onOpenInComfyUi();
    setShowComfyPasteHint(true);
    window.setTimeout(() => setShowComfyPasteHint(false), 5000);
  }

  async function onReloadWorkflowPresets(): Promise<void> {
    if (!projectRoot || isReloadingPresets || isSavingPresets) {
      return;
    }

    setIsReloadingPresets(true);
    try {
      if (presetConflictState) {
        skipNextPresetPersistRef.current = true;
        setPresetsByWorkflow(presetConflictState.remotePresets);
        setPresetUpdatedAtByWorkflow(presetConflictState.remoteUpdatedAtByWorkflow);
        setPresetLoadWarning(null);
        setPresetConflictState(null);
        setSendState({ status: "success", message: "Dateistand aus Konflikt uebernommen." });
        return;
      }

      const response = await getIpcClient().getWorkflowPresets();
      if (!response.success) {
        setSendState({ status: "error", message: response.message || "Workflow-Presets konnten nicht neu geladen werden." });
        return;
      }

      skipNextPresetPersistRef.current = true;
      setPresetsByWorkflow(response.presets ?? {});
      setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
      setPresetLoadWarning((response.message || "").includes("with warnings") ? response.message : null);
      setPresetConflictState(null);
      setSendState({ status: "success", message: "Workflow-Presets aus Datei uebernommen." });
    } catch (error) {
      setSendState({
        status: "error",
        message: `Workflow-Presets neu laden fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsReloadingPresets(false);
    }
  }

  async function onKeepLocalPresetChanges(): Promise<void> {
    if (!presetConflictState || isSavingPresets || isReloadingPresets) {
      return;
    }

    setIsSavingPresets(true);
    try {
      const response = await getIpcClient().saveWorkflowPresets({
        presets: presetsByWorkflow as WorkflowPresetsMap,
        expectedUpdatedAtByWorkflow: presetConflictState.remoteUpdatedAtByWorkflow,
      });

      if (response.success) {
        skipNextPresetPersistRef.current = true;
        setPresetsByWorkflow(response.presets ?? {});
        setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
        setPresetConflictState(null);
        setSendState({ status: "success", message: "Lokale Preset-Aenderungen gespeichert." });
        return;
      }

      if ((response.message || "").includes("PRESET_CONFLICT")) {
        const conflictedWorkflowId = parseConflictedWorkflowId(response.message, presetConflictState.workflowId);
        const conflictMessage = `Preset-Konflikt bleibt bestehen fuer Workflow "${conflictedWorkflowId}". Pruefe Dateistand oder versuche erneut.`;
        setPresetConflictState({
          workflowId: conflictedWorkflowId,
          message: conflictMessage,
          remotePresets: response.presets ?? {},
          remoteUpdatedAtByWorkflow: response.updatedAtByWorkflow ?? {},
        });
        setSendState({ status: "error", message: conflictMessage });
        return;
      }

      setSendState({ status: "error", message: response.message || "Lokale Preset-Aenderungen konnten nicht gespeichert werden." });
    } catch (error) {
      setSendState({
        status: "error",
        message: `Lokale Preset-Aenderungen speichern fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsSavingPresets(false);
    }
  }

  async function onImportOutput(runId: string, outputPath: string): Promise<void> {
    const normalizedPath = outputPath.trim();
    if (!canImportOutputPath(normalizedPath)) {
      setWorkflowErrorState(`Unsupported output file type: ${normalizedPath}`, "WF_OUTPUT_UNSUPPORTED_EXTENSION", { runId });
      return;
    }
    if (isOutputAlreadyImported(runId, normalizedPath)) {
      setWorkflowErrorState(`Output already imported in this session: ${normalizedPath}`, "WF_OUTPUT_DUPLICATE", { runId });
      return;
    }

    setImportingOutputPath(normalizedPath);
    try {
      const beforeState = useStudioStore.getState();
      const beforeAssetIds = new Set(beforeState.assets.map((asset) => asset.id));
      await importComfyOutputAsset(normalizedPath);
      const afterState = useStudioStore.getState();
      const importedAssets = afterState.assets.filter((asset) => !beforeAssetIds.has(asset.id));

      if (importedAssets.length === 0) {
        const importIssue = resolveOutputImportIssue(afterState.lastError ?? afterState.projectMessage ?? "", normalizedPath);
        setSendState({
          status: "error",
          message: importIssue.message,
          code: importIssue.code,
          nextStep: importIssue.nextStep,
          hint: importIssue.nextStep,
          runId,
        });
        return;
      }

      rememberManualImportedOutputPath(runId, normalizedPath);
      if (autoPlaceImportedOutputs) {
        importedAssets.forEach((asset) => {
          dropAssetToTimeline(asset.id);
        });
      }
      setSendState({
        status: "success",
        message: `Output importiert: ${normalizedPath}`,
        runId,
      });
    } finally {
      setImportingOutputPath(null);
    }
  }

  async function onImportAllOutputs(run: { id: string; outputPaths: string[] }): Promise<void> {
    if (isProjectBusy) return;

    const uniquePaths = Array.from(new Set(run.outputPaths.map((path) => path.trim()).filter(Boolean)));
    const importablePaths = uniquePaths.filter((path) => canImportOutputPath(path));
    const unsupportedPaths = uniquePaths.filter((path) => !canImportOutputPath(path));
    const duplicatePaths = importablePaths.filter((path) => isOutputAlreadyImported(run.id, path));
    const importCandidates = importablePaths.filter((path) => !duplicatePaths.includes(path));

    const reasonCounts: Record<string, number> = {};
    const skippedExamples: string[] = [];
    const addReason = (reason: string, outputPath?: string) => {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      if (outputPath && skippedExamples.length < 3) {
        skippedExamples.push(outputPath);
      }
    };

    unsupportedPaths.forEach((path) => addReason("WF_OUTPUT_UNSUPPORTED_EXTENSION", path));
    duplicatePaths.forEach((path) => addReason("DUPLICATE_OUTPUT", path));

    if (importCandidates.length === 0) {
      const reasonText = Object.entries(reasonCounts)
        .map(([reason, count]) => `${formatImportReasonLabel(reason)}: ${count}`)
        .join(" | ");
      const summary: ImportAllSummary = {
        imported: 0,
        skipped: uniquePaths.length,
        reasonCounts,
        skippedExamples,
        message: `0 importiert, alle Outputs uebersprungen${reasonText ? ` (${reasonText})` : ""}.`,
      };
      setImportAllSummaries((prev) => ({ ...prev, [run.id]: summary }));
      return;
    }

    setImportingRunId(run.id);
    try {
      let imported = 0;
      let latestImportIssue: WorkflowIssue | null = null;

      for (const outputPath of importCandidates) {
        const beforeState = useStudioStore.getState();
        const beforeAssetIds = new Set(beforeState.assets.map((asset) => asset.id));
        try {
          await importComfyOutputAsset(outputPath);
          const afterState = useStudioStore.getState();
          const importedAssets = afterState.assets.filter((asset) => !beforeAssetIds.has(asset.id));

          if (importedAssets.length > 0) {
            imported += 1;
            rememberManualImportedOutputPath(run.id, outputPath);
            if (autoPlaceImportedOutputs) {
              importedAssets.forEach((asset) => {
                dropAssetToTimeline(asset.id);
              });
            }
          } else {
            latestImportIssue = resolveOutputImportIssue(afterState.lastError ?? afterState.projectMessage ?? "", outputPath);
            addReason(latestImportIssue.code, outputPath);
          }
        } catch (error) {
          latestImportIssue = resolveWorkflowIssue(
            `Output import exception for "${outputPath}": ${error instanceof Error ? error.message : String(error)}`,
            "WF_OUTPUT_IMPORT_EXCEPTION",
          );
          addReason(latestImportIssue.code, outputPath);
        }
      }

      const skipped = uniquePaths.length - imported;
      const reasonText = Object.entries(reasonCounts)
        .map(([reason, count]) => `${formatImportReasonLabel(reason)}: ${count}`)
        .join(" | ");
      const summary: ImportAllSummary = {
        imported,
        skipped,
        reasonCounts,
        skippedExamples,
        message: `${imported} importiert, ${skipped} uebersprungen${reasonText ? ` (${reasonText})` : ""}.`,
      };
      setImportAllSummaries((prev) => ({ ...prev, [run.id]: summary }));

      if (imported === 0 && latestImportIssue) {
        setSendState({
          status: "error",
          message: latestImportIssue.message,
          code: latestImportIssue.code,
          nextStep: latestImportIssue.nextStep,
          hint: latestImportIssue.nextStep,
          runId: run.id,
        });
      }
    } finally {
      setImportingRunId(null);
    }
  }

  async function onRetryRun(run: { id: string; workflowName: string; request: ComfyWorkflowRunRequest | null }): Promise<void> {
    if (!run.request) {
      setWorkflowErrorState(
        `Retry blockiert: Fuer Run "${run.id}" ist kein Request-Payload gespeichert.`,
        "WF_RUN_RETRY_MISSING_REQUEST",
        { runId: run.id },
      );
      return;
    }

    const duplicateActiveRun = queuedWorkflowRuns.find((candidate) => {
      if (candidate.id === run.id) return false;
      if (candidate.status !== "pending" && candidate.status !== "running") return false;
      if (!candidate.request) return false;
      return JSON.stringify(candidate.request) === JSON.stringify(run.request);
    });

    if (duplicateActiveRun) {
      setWorkflowErrorState(
        `Retry blockiert: Fuer diesen Request laeuft bereits ein aktiver Run (${duplicateActiveRun.id}).`,
        "WF_RUN_RETRY_DUPLICATE_ACTIVE",
        { runId: duplicateActiveRun.id },
      );
      return;
    }

    const retryRunId = makeRunId();
    setRetryingRunId(run.id);
    rememberQueuedRunRequest(retryRunId, run.request.workflowId, run.workflowName, run.request);
    setSendState({ status: "sending", message: `Retrying "${run.workflowName}"...`, runId: retryRunId });
    try {
      const res = await getIpcClient().queueComfyRun({
        runId: retryRunId,
        request: run.request,
        baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
      });
      if (!res.success) {
        setWorkflowErrorState(res.message, "WF_RUN_RETRY_FAILED", { runId: res.runId, promptId: res.promptId });
        return;
      }
      setSendState({ status: "success", message: res.message, runId: res.runId, promptId: res.promptId });
    } catch (e) {
      const message = `Retry request failed: ${e instanceof Error ? e.message : String(e)}`;
      setWorkflowErrorState(message, "WF_RUN_RETRY_EXCEPTION", { runId: retryRunId });
    } finally {
      setRetryingRunId(null);
    }
  }

  async function onCancelRun(run: { id: string; promptId: string | null }): Promise<void> {
    setCancellingRunId(run.id);
    try {
      const response = await getIpcClient().cancelComfyRun({
        runId: run.id,
        promptId: run.promptId ?? undefined,
        baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
      });
      if (!response.success) {
        setWorkflowErrorState(response.message, "WF_RUN_CANCEL_FAILED", { runId: response.runId });
        return;
      }
      setSendState({ status: "success", message: response.message, runId: response.runId });
    } catch (e) {
      const message = `Cancel request failed: ${e instanceof Error ? e.message : String(e)}`;
      setWorkflowErrorState(message, "WF_RUN_CANCEL_EXCEPTION", { runId: run.id });
    } finally {
      setCancellingRunId(null);
    }
  }

  async function onCopyPromptPayload(run: { id: string; request: ComfyWorkflowRunRequest | null }): Promise<void> {
    if (!run.request) {
      setWorkflowErrorState(`Copy prompt payload not available for run "${run.id}".`, "WF_RUN_COPY_MISSING_REQUEST", { runId: run.id });
      return;
    }

    const payload = JSON.stringify(run.request, null, 2);
    try {
      if (typeof navigator?.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error("Clipboard API not available");
      }
      setCopiedRunId(run.id);
      window.setTimeout(() => {
        setCopiedRunId((current) => (current === run.id ? null : current));
      }, 1500);
    } catch (e) {
      setWorkflowErrorState(`Copy prompt payload failed: ${e instanceof Error ? e.message : String(e)}`, "WF_UI_CLIPBOARD_FAILED", { runId: run.id });
    }
  }

  async function onCopyExpectedTokens(): Promise<void> {
    if (!selected) return;
    const text = expectedTemplateTokens.map((token) => `{{${token}}}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAuthoringHint("tokens");
      window.setTimeout(() => setCopiedAuthoringHint((current) => (current === "tokens" ? null : current)), 1500);
    } catch (e) {
      setWorkflowErrorState(`Copy template tokens failed: ${e instanceof Error ? e.message : String(e)}`, "WF_UI_CLIPBOARD_FAILED");
    }
  }

  async function onCopyMetaInputStubs(): Promise<void> {
    if (!selected) return;
    const stubs = selected.inputs.map((input) => ({
      key: input.key,
      label: input.label,
      type: input.type,
      required: input.required,
    }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(stubs, null, 2));
      setCopiedAuthoringHint("inputs");
      window.setTimeout(() => setCopiedAuthoringHint((current) => (current === "inputs" ? null : current)), 1500);
    } catch (e) {
      setWorkflowErrorState(`Copy meta input stubs failed: ${e instanceof Error ? e.message : String(e)}`, "WF_UI_CLIPBOARD_FAILED");
    }
  }

  if (!projectRoot) {
    return (
      <div className="h-full p-6 bg-[#07070a] text-zinc-300">
        <div className="h-full rounded-3xl border border-white/5 bg-[#0d0d12] p-8 flex items-center justify-center">
          <div className="max-w-lg text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
              <FlaskConical size={18} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-200">Workflow Studio</h2>
            <p className="text-xs text-zinc-500">
              Load or create a project first. The workflow catalog will be read from <span className="font-mono text-zinc-400">projectRoot/workflows/</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 bg-[#07070a] text-zinc-200">
      <div className="h-full grid grid-cols-[180px_280px_minmax(0,1fr)] gap-4">
        <section className="rounded-2xl border border-white/5 bg-[#0d0d12] p-3 flex flex-col">
          <div className="px-1 pb-3 border-b border-white/5 text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">Category</div>
          <div className="mt-3 space-y-2">
            {CATS.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${cat === c.id ? "border-blue-500/40 bg-blue-600/10 text-white" : "border-white/5 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider">{c.icon}<span>{c.label}</span></div>
                <div className="mt-1 text-[9px] text-zinc-500">{(catalog?.workflows ?? []).filter((w) => w.category === c.id).length} workflows</div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#0d0d12] p-3 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-1 pb-3 border-b border-white/5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">Workflows</div>
              <div className="text-[9px] text-zinc-500 mt-1 uppercase tracking-widest">{cat}</div>
            </div>
            <button onClick={() => void loadCatalog()} className="p-2 rounded-lg border border-white/5 bg-zinc-950/70 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all" title="Reload workflow catalog">
              <RefreshCw size={12} className={loadState === "loading" ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="mt-3 min-h-0 overflow-y-auto space-y-2 pr-1">
            {wfList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/40 p-4 text-[10px] text-zinc-500">
                No workflow meta files found for <span className="font-mono text-zinc-400">{cat}</span>.
                <div className="mt-2 text-zinc-600">Expected under <span className="font-mono">workflows/{cat}/*.meta.json</span></div>
              </div>
            ) : wfList.map((w) => (
              <button key={w.id} onClick={() => setWfId(w.id)} className={`w-full text-left rounded-xl border p-3 transition-all ${wfId === w.id ? "border-blue-500/40 bg-blue-600/10" : "border-white/5 bg-zinc-950/60 hover:border-zinc-700"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-wide text-zinc-100 truncate">{w.name}</div>
                    <div className="mt-1 text-[9px] text-zinc-500 font-mono truncate">{w.id}</div>
                  </div>
                  {!w.templateExists && <span className="text-[8px] px-2 py-1 rounded-md border border-amber-400/20 bg-amber-400/10 text-amber-300 uppercase tracking-wider">No API</span>}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#0d0d12] p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">Workflow Studio</div>
              <div className="text-[9px] text-zinc-500 mt-1">Project-local workflow meta catalog ({catalog?.workflows.length ?? 0} entries)</div>
            </div>
            <div className="flex flex-col gap-2 min-w-[360px]">
              <div className="flex items-center gap-2">
                <input
                  value={comfyBaseUrl}
                  onChange={(event) => setComfyBaseUrl(event.target.value)}
                  placeholder="Comfy URL Override (z. B. http://127.0.0.1:8188)"
                  className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-zinc-950/70 text-[10px] font-mono text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
              <div className="flex items-center gap-2 justify-end flex-wrap">
                <button onClick={() => void checkComfyHealth()} className="px-3 py-2 rounded-xl border border-white/5 bg-zinc-950/60 text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:text-white hover:border-zinc-700" title="Refresh ComfyUI health">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${comfyOnline ? "bg-emerald-400" : "bg-red-400"}`} />
                  {comfyOnline ? "Comfy Online" : "Comfy Offline"}
                </button>
                <button onClick={() => void onOpenAndCopyComfyUi()} disabled={!validation?.canSend} className="px-3 py-2 rounded-xl border border-blue-500/20 bg-blue-500/10 text-[9px] font-black uppercase tracking-widest text-blue-200 hover:bg-blue-500/20 disabled:opacity-40">
                  Open in ComfyUI
                </button>
                <button onClick={() => void onOpenAndCopyComfyUi()} disabled={!validation?.canSend} className="px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-[9px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40">
                  Open + Copy
                </button>
                <button onClick={() => void onCopyRenderedPayload()} disabled={!validation?.canSend} className="px-3 py-2 rounded-xl border border-violet-500/20 bg-violet-500/10 text-[9px] font-black uppercase tracking-widest text-violet-200 disabled:opacity-40">
                  {copiedRenderedPayload ? "Payload Copied" : "Copy Workflow JSON"}
                </button>
                <button onClick={() => void onSend()} disabled={sendState.status === "sending" || !validation?.canSend} className="px-4 py-2 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-2">
                  <Send size={12} /> {sendState.status === "sending" ? "Sending..." : "Send to ComfyUI"}
                </button>
              </div>
            </div>
          </div>

          {showComfyPasteHint && (
            <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-[10px] text-cyan-100">
              Workflow JSON wurde kopiert. In ComfyUI jetzt einfuegen/importieren (Ctrl+V bzw. Load from Clipboard/JSON).
            </div>
          )}

          <div className="mt-4 min-h-0 overflow-y-auto pr-1">
            {catalog?.warnings.length ? (
              <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[10px] text-amber-200">
                <div className="flex items-center gap-2 font-black uppercase tracking-wider"><TriangleAlert size={12} />Meta Warnings ({catalog.warnings.length})</div>
                <div className="mt-2 space-y-1 text-amber-100/80">{catalog.warnings.slice(0, 4).map((w) => <div key={w} className="truncate">{w}</div>)}</div>
              </div>
            ) : null}

            {!selected || !draft || !validation ? (
              <div className="h-full rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 p-8 flex items-center justify-center">
                <div className="max-w-xl text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center"><FolderTree size={18} className="text-zinc-500" /></div>
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300">Select A Workflow</div>
                  <div className="text-xs text-zinc-500">Choose a category and workflow on the left. This panel is now editable and can send to the existing ComfyUI bridge.</div>
                  <div className="text-[10px] text-zinc-600 font-mono break-all">{catalog?.projectWorkflowsRoot ?? "workflows"}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{selected.category}</div>
                  <div className="mt-2 text-xl font-black uppercase tracking-tight text-zinc-100">{selected.name}</div>
                  <div className="mt-2 text-[10px] text-zinc-500 font-mono">id: {selected.id}</div>
                  <div className="mt-1 text-[10px] text-zinc-600 font-mono">meta: {selected.metaRelativePath}</div>
                  <div className="mt-1 text-[10px] text-zinc-600 font-mono">api: {selected.templateRelativePath}</div>
                  {!selected.templateExists && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200">API template missing. Add <span className="font-mono">{selected.templateRelativePath}</span> before sending.</div>}
                </div>

                <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Parameter Presets (MVP)</div>
                  <div className="mt-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_auto_auto_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      disabled={shouldDisablePresetInputs}
                      placeholder="Preset-Name (z. B. Fast Preview)"
                      className="w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-100 outline-none focus:border-blue-500/50"
                    />
                    <select
                      value={selectedPresetId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedPresetId(id);
                        const preset = workflowPresets.find((p) => p.id === id);
                        setPresetName(preset?.name ?? "");
                      }}
                      disabled={shouldDisablePresetInputs}
                      className="w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-100 outline-none focus:border-blue-500/50"
                    >
                      <option value="">Preset waehlen...</option>
                      {workflowPresets.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button onClick={onApplyPreset} disabled={!selectedPresetId || shouldDisablePresetInputs} className="px-3 py-2 rounded-lg border border-white/10 bg-zinc-950/60 text-[9px] font-black uppercase tracking-wider text-zinc-300 disabled:opacity-40">
                      Apply
                    </button>
                    <button onClick={onSavePreset} disabled={shouldDisablePresetInputs} className="px-3 py-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-[9px] font-black uppercase tracking-wider text-emerald-200 disabled:opacity-40">
                      {isPresetConflictOperationBusy ? "Saving..." : "Save"}
                    </button>
                    <button onClick={onDeletePreset} disabled={!selectedPresetId || shouldDisablePresetInputs} className="px-3 py-2 rounded-lg border border-red-400/20 bg-red-400/10 text-[9px] font-black uppercase tracking-wider text-red-200 disabled:opacity-40">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Editor Mode</div>
                      <div className="mt-1 text-[10px] text-zinc-600">Switch between form fields and the visual node graph.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditorMode("form")}
                        className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${editorMode === "form" ? "border-blue-500/40 bg-blue-500/15 text-blue-200" : "border-white/10 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                      >
                        Form
                      </button>
                      <button
                        onClick={() => setEditorMode("graph")}
                        className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${editorMode === "graph" ? "border-blue-500/40 bg-blue-500/15 text-blue-200" : "border-white/10 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                      >
                        Graph
                      </button>
                    </div>
                  </div>
                </div>

                {editorMode === "graph" ? (
                  <NodeWorkflowEditor
                    workflow={selected}
                    draft={draft}
                    assets={assets}
                    connections={inputConnections ?? {}}
                    validationIssues={validation.issues.map((issue) => `${issue.code}: ${issue.message}`)}
                    canSend={validation.canSend}
                    onNumChange={onNum}
                    onInputChange={onInput}
                    onConnectionChange={onInputConnectionChange}
                  />
                ) : (
                  <>
                    <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Settings</div>
                      <div className="mt-3 grid grid-cols-2 xl:grid-cols-5 gap-3">
                        {NUM_FIELDS.map((f) => (
                          <label key={f.key} className="block">
                            <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">{f.label}</div>
                            <input type="number" min={1} step={1} value={draft.settings[f.key]} onChange={(e) => onNum(f.key, e.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-[11px] text-zinc-100 outline-none focus:border-blue-500/50" />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Inputs</div>
                      {selected.inputs.length === 0 ? (
                        <div className="mt-3 text-[10px] text-zinc-500">No inputs defined yet in <span className="font-mono">{selected.metaRelativePath}</span>.</div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {selected.inputs.map((i) => {
                            const options = assetsForInput(assets, i);
                            return (
                              <div key={i.key} className="rounded-xl border border-white/5 bg-zinc-900/40 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-zinc-100 truncate">{i.label}</div>
                                    <div className="mt-1 text-[9px] text-zinc-500 font-mono truncate">{i.key} {i.required ? "(required)" : "(optional)"}</div>
                                  </div>
                                  <span className="text-[8px] px-2 py-1 rounded-md border border-white/10 bg-zinc-950/60 text-zinc-400 uppercase tracking-wider">{i.type}</span>
                                </div>
                                <select value={draft.inputs[i.key] ?? ""} onChange={(e) => onInput(i.key, e.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-100 outline-none focus:border-blue-500/50">
                                  <option value="">{`Select ${i.type} asset${i.required ? "" : " (optional)"}`}</option>
                                  {options.map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                                </select>
                                {options.length === 0 && <div className="mt-2 text-[10px] text-zinc-500">No compatible {i.type} assets in this project yet.</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {(validation.issues.length > 0 || sendState.status !== "idle") && (
                  <div className="rounded-2xl border border-white/5 bg-zinc-950/30 p-4 text-[10px]">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Validation / Send Status</div>
                    {validation.issues.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {validation.issues.map((issue) => (
                          <div key={`${issue.code}:${issue.message}`} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-2 text-amber-200">
                            <div className="text-[9px] font-black uppercase tracking-wider">{issue.code}</div>
                            <div className="mt-1">{issue.message}</div>
                            <div className="mt-1 text-amber-100/80">Next Step: {issue.nextStep}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sendState.status !== "idle" && (
                      <div className={`mt-3 rounded-xl border px-3 py-3 ${sendState.status === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : sendState.status === "error" ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-blue-500/20 bg-blue-500/10 text-blue-200"}`}>
                        <div className="font-bold uppercase tracking-wider text-[9px]">{sendState.status === "success" ? "Queued" : sendState.status === "error" ? "Send Failed" : "Submitting"}</div>
                        <div className="mt-1">{sendState.message}</div>
                        {sendState.code && <div className="mt-2 text-[9px] font-black uppercase tracking-wider">Code: {sendState.code}</div>}
                        {sendState.nextStep && <div className="mt-2 rounded-md border border-current/20 bg-black/20 px-2 py-1 text-[10px]">Next Step: {sendState.nextStep}</div>}
                        {!sendState.nextStep && sendState.hint && <div className="mt-2 rounded-md border border-current/20 bg-black/20 px-2 py-1 text-[10px]">Hint: {sendState.hint}</div>}
                        {sendState.runId && <div className="mt-2 text-[9px] font-mono text-current/80">runId: {sendState.runId}</div>}
                        {sendState.promptId && <div className="mt-1 text-[9px] font-mono text-current/80">promptId: {sendState.promptId}</div>}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-white/5 bg-zinc-950/30 p-4 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Authoring Assist</div>
                    <WandSparkles size={12} className="text-violet-300" />
                  </div>
                  <div className="mt-2 text-zinc-500">
                    Erwartete Template-Token fuer <span className="font-mono text-zinc-300">{selected.id}</span>:
                  </div>
                  <div className="mt-2 rounded-lg border border-white/10 bg-zinc-950/70 p-2 max-h-28 overflow-y-auto font-mono text-[9px] text-zinc-300">
                    {expectedTemplateTokens.map((token) => (
                      <div key={token}>{`{{${token}}}`}</div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => { void onCopyExpectedTokens(); }}
                      className="px-2 py-1 rounded-md border border-white/10 bg-zinc-950/60 text-zinc-300 text-[8px] font-black uppercase tracking-wider hover:border-zinc-700 hover:text-white"
                    >
                      {copiedAuthoringHint === "tokens" ? "Tokens copied" : "Copy tokens"}
                    </button>
                    <button
                      onClick={() => { void onCopyMetaInputStubs(); }}
                      className="px-2 py-1 rounded-md border border-white/10 bg-zinc-950/60 text-zinc-300 text-[8px] font-black uppercase tracking-wider hover:border-zinc-700 hover:text-white"
                    >
                      {copiedAuthoringHint === "inputs" ? "Inputs copied" : "Copy meta input stubs"}
                    </button>
                  </div>
                  <div className="mt-2 text-[9px] text-zinc-500">
                    Regel: <span className="font-mono text-zinc-300">meta.inputs[].key</span> als <span className="font-mono text-zinc-300">...AssetId</span>, Template nutzt abgeleitete Token wie <span className="font-mono text-zinc-300">{"{{...AssetAbsPath}}"}</span>.
                  </div>
                </div>

                {presetLoadWarning && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-[10px] text-amber-200">
                    <div className="font-black uppercase tracking-wider text-[9px]">Preset Warning</div>
                    <div className="mt-1 text-amber-100/90">{presetLoadWarning}</div>
                  </div>
                )}

                {activePresetConflict && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[10px] text-red-200">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-black uppercase tracking-wider text-[9px]">Preset Conflict</div>
                        <div className="mt-1 text-red-100/90">{activePresetConflict.message}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { void onKeepLocalPresetChanges(); }}
                          disabled={isPresetConflictOperationBusy}
                          className="px-2 py-1 rounded-md border border-emerald-300/30 bg-emerald-400/15 text-[8px] font-black uppercase tracking-wider text-emerald-100 disabled:opacity-40"
                        >
                          {isSavingPresets ? "Speichert..." : "Lokale Aenderungen behalten"}
                        </button>
                        <button
                          onClick={() => { void onReloadWorkflowPresets(); }}
                          disabled={isPresetConflictOperationBusy}
                          className="px-2 py-1 rounded-md border border-red-300/30 bg-red-400/15 text-[8px] font-black uppercase tracking-wider text-red-100 disabled:opacity-40"
                        >
                          {isReloadingPresets ? "Laedt..." : "Datei neu laden"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/5 bg-zinc-950/30 p-4 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Recent Runs</div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-widest">{filteredWorkflowRuns.length}/{selectedWorkflowRuns.length}</div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setAutoPlaceImportedOutputs((current) => !current)}
                        className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-wider transition-all ${autoPlaceImportedOutputs ? "border-emerald-500/40 bg-emerald-600/15 text-emerald-200" : "border-white/10 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                        title="Importierte Outputs automatisch in die Timeline legen"
                      >
                        Auto-Place: {autoPlaceImportedOutputs ? "ON" : "OFF"}
                      </button>
                      {(["all", "queued", "failed", "success"] as RunFilter[]).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setRunFilter(filter)}
                          className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-wider transition-all ${runFilter === filter ? "border-blue-500/40 bg-blue-600/15 text-blue-200" : "border-white/10 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRunSort("newest")}
                        className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-wider transition-all ${runSort === "newest" ? "border-blue-500/40 bg-blue-600/15 text-blue-200" : "border-white/10 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                        title="Neueste Runs zuerst"
                      >
                        Neueste zuerst
                      </button>
                      <button
                        onClick={() => setRunSort("oldest")}
                        className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-wider transition-all ${runSort === "oldest" ? "border-blue-500/40 bg-blue-600/15 text-blue-200" : "border-white/10 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}
                        title="Aelteste Runs zuerst"
                      >
                        Aelteste zuerst
                      </button>
                    </div>
                  </div>

                  {selectedWorkflowRuns.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-white/10 bg-zinc-950/40 px-3 py-2 text-zinc-500">
                      No runs for this workflow yet in the current session.
                    </div>
                  ) : filteredWorkflowRuns.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-white/10 bg-zinc-950/40 px-3 py-2 text-zinc-500">
                      Keine Runs fuer den aktiven Filter.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {sortedFilteredWorkflowRuns.map((run) => {
                        const autoImportedPaths = autoImportedOutputPathsByRunId[run.id] ?? [];
                        const autoImportedSet = new Set(autoImportedPaths);
                        const manuallyImportedPaths = manuallyImportedOutputPathsByRunId[run.id] ?? [];
                        const manuallyImportedSet = new Set(manuallyImportedPaths);
                        const isAlreadyImportedPath = (outputPath: string) => autoImportedSet.has(outputPath) || manuallyImportedSet.has(outputPath);
                        const importableOutputCount = run.outputPaths.filter((path) => canImportOutputPath(path)).length;
                        const autoImportedOutputCount = run.outputPaths.filter((path) => autoImportedSet.has(path)).length;
                        const totalKnownImportedOutputCount = run.outputPaths.filter((path) => isAlreadyImportedPath(path)).length;
                        const runFailureIssue = run.status === "failed" ? resolveWorkflowIssue(run.message, "WF_RUN_FAILED") : null;

                        return (
                        <div key={run.id} className="rounded-xl border border-white/5 bg-zinc-900/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-zinc-200 truncate">{run.message}</div>
                              {runFailureIssue && (
                                <div className="mt-1 text-[9px] text-amber-300/90">
                                  {runFailureIssue.code} - Next Step: {runFailureIssue.nextStep}
                                </div>
                              )}
                              <div className="mt-1 text-[9px] font-mono text-zinc-500 truncate">{run.id}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isRunStale(run, nowTs) && (
                                <span className="text-[8px] px-2 py-1 rounded-md border border-amber-400/20 bg-amber-400/10 text-amber-300 uppercase tracking-wider">
                                  stalled
                                </span>
                              )}
                              <span className={statusBadgeClass(run.status)}>
                                {run.status}
                              </span>
                            </div>
                          </div>

                          {(run.progress !== null || run.status === "running") && (
                            <div className="mt-2">
                              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                  className={`h-full ${run.status === "failed" ? "bg-red-500" : run.status === "success" ? "bg-emerald-500" : "bg-blue-500"}`}
                                  style={{ width: `${Math.max(0, Math.min(100, Math.round((run.progress ?? 0) * 100)))}%` }}
                                />
                              </div>
                              <div className="mt-1 text-[9px] text-zinc-500">
                                Progress: {Math.max(0, Math.min(100, Math.round((run.progress ?? 0) * 100)))}%
                              </div>
                            </div>
                          )}

                          <div className="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-2 text-[9px]">
                            <div className="rounded-md border border-white/5 bg-zinc-950/50 px-2 py-1">
                              <span className="text-zinc-500">Prompt:</span>{" "}
                              <span className="font-mono text-zinc-300">{run.promptId ?? "-"}</span>
                            </div>
                            <div className="rounded-md border border-white/5 bg-zinc-950/50 px-2 py-1">
                              <span className="text-zinc-500">Created:</span>{" "}
                              <span className="font-mono text-zinc-300">{formatShortTimestamp(run.createdAt)}</span>
                            </div>
                            <div className="rounded-md border border-white/5 bg-zinc-950/50 px-2 py-1">
                              <span className="text-zinc-500">Updated:</span>{" "}
                              <span className="font-mono text-zinc-300">{formatShortTimestamp(run.updatedAt)}</span>
                            </div>
                            <div className="rounded-md border border-white/5 bg-zinc-950/50 px-2 py-1">
                              <span className="text-zinc-500">Runtime:</span>{" "}
                              <span className="font-mono text-zinc-300">{formatRunDuration(run.createdAt, run.updatedAt, nowTs)}</span>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                void onCopyPromptPayload(run);
                              }}
                              disabled={!run.request}
                              className="px-2 py-1 rounded-md border border-white/10 bg-zinc-950/60 text-zinc-300 text-[8px] font-black uppercase tracking-wider hover:border-zinc-700 hover:text-white disabled:opacity-40"
                              title={run.request ? "Copy prompt payload JSON" : "No stored request payload for this run"}
                            >
                              <span className="inline-flex items-center gap-1"><Copy size={10} /> {copiedRunId === run.id ? "Copied" : "Copy prompt payload"}</span>
                            </button>

                            <button
                              onClick={() => {
                                void onRetryRun(run);
                              }}
                              disabled={run.status !== "failed" || !run.request || retryingRunId === run.id || isProjectBusy}
                              className="px-2 py-1 rounded-md border border-amber-400/20 bg-amber-400/10 text-amber-200 text-[8px] font-black uppercase tracking-wider disabled:opacity-40"
                              title={run.status === "failed" ? (run.request ? "Retry this failed run" : "Retry unavailable: missing stored request payload") : "Retry available for failed runs"}
                            >
                              <span className="inline-flex items-center gap-1"><RotateCcw size={10} /> {retryingRunId === run.id ? "Retrying..." : "Retry failed run"}</span>
                            </button>

                            <button
                              onClick={() => {
                                void onCancelRun(run);
                              }}
                              disabled={(run.status !== "pending" && run.status !== "running") || cancellingRunId === run.id || isProjectBusy}
                              className="px-2 py-1 rounded-md border border-red-400/20 bg-red-400/10 text-red-200 text-[8px] font-black uppercase tracking-wider disabled:opacity-40"
                              title={run.status === "pending" || run.status === "running" ? "Cancel active run" : "Cancel only available for active runs"}
                            >
                              <span className="inline-flex items-center gap-1"><Square size={10} /> {cancellingRunId === run.id ? "Cancelling..." : "Cancel run"}</span>
                            </button>
                          </div>

                          {run.outputPaths.length > 0 && (
                            <div className="mt-2 rounded-md border border-emerald-500/10 bg-emerald-500/5 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold">
                                    Outputs ({run.outputPaths.length})
                                  </div>
                                  {importableOutputCount > 0 && (
                                    <div className={`mt-1 text-[8px] uppercase tracking-wider font-bold ${totalKnownImportedOutputCount >= importableOutputCount ? "text-emerald-300" : "text-blue-300"}`}>
                                      Imported {totalKnownImportedOutputCount}/{importableOutputCount} (Auto {autoImportedOutputCount})
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    void onImportAllOutputs(run);
                                  }}
                                  disabled={isProjectBusy || importingRunId === run.id || run.outputPaths.every((path) => !canImportOutputPath(path) || isAlreadyImportedPath(path))}
                                  className="shrink-0 px-2 py-1 rounded-md border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 text-[8px] font-black uppercase tracking-wider disabled:opacity-40"
                                  title="Import all supported outputs into project assets"
                                >
                                  {importingRunId === run.id ? "Importing all..." : "Import all"}
                                </button>
                              </div>
                              <div className="mt-1 space-y-1">
                                {run.outputPaths.slice(0, 3).map((outputPath) => (
                                  <div key={outputPath} className="flex items-center gap-2">
                                    <div className="font-mono text-[9px] text-emerald-100/80 truncate flex-1 min-w-0">
                                      {outputPath}
                                    </div>
                                    {autoImportedSet.has(outputPath) && (
                                      <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-[8px] font-black uppercase tracking-wider">
                                        Auto
                                      </span>
                                    )}
                                    {manuallyImportedSet.has(outputPath) && !autoImportedSet.has(outputPath) && (
                                      <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-blue-400/30 bg-blue-500/10 text-blue-200 text-[8px] font-black uppercase tracking-wider">
                                        Imported
                                      </span>
                                    )}
                                    <button
                                      onClick={() => {
                                        void onImportOutput(run.id, outputPath);
                                      }}
                                      disabled={!canImportOutputPath(outputPath) || isAlreadyImportedPath(outputPath) || isProjectBusy}
                                      className="shrink-0 px-2 py-1 rounded-md border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 text-[8px] font-black uppercase tracking-wider disabled:opacity-40"
                                      title={
                                        canImportOutputPath(outputPath) && !isAlreadyImportedPath(outputPath)
                                          ? "Import output into project assets"
                                          : isAlreadyImportedPath(outputPath)
                                            ? "Output already imported in this session"
                                          : "Unsupported output file type"
                                      }
                                    >
                                      {importingOutputPath === outputPath ? "Importing..." : "Import"}
                                    </button>
                                  </div>
                                ))}
                                {run.outputPaths.length > 3 && (
                                  <div className="text-[9px] text-emerald-200/70">
                                    +{run.outputPaths.length - 3} more
                                  </div>
                                )}
                                {importAllSummaries[run.id] && (
                                  <div className="mt-2 rounded-md border border-white/10 bg-zinc-950/60 px-2 py-2 text-[9px] text-zinc-300">
                                    <div>Import-Ergebnis: {importAllSummaries[run.id].message}</div>
                                    {importAllSummaries[run.id].skippedExamples.length > 0 && (
                                      <div className="mt-1 text-zinc-500">
                                        Beispiele uebersprungen: {importAllSummaries[run.id].skippedExamples.join(" | ")}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const WORKFLOW_ISSUE_NEXT_STEP_BY_CODE: Record<string, string> = {
  WF_SEND_NO_WORKFLOW: "Workflow im linken Katalog auswaehlen und erneut senden.",
  WF_SEND_VALIDATION: "Validierungsfehler im Bereich 'Validation / Send Status' beheben.",
  WF_SEND_PARAM_INVALID: "Numerische Parameter auf gueltige Werte (>= 1) setzen.",
  WF_SEND_INPUT_KEY_INVALID: "Meta-Input-Key auf ...AssetId konventionieren.",
  WF_SEND_INPUT_MISSING: "Pflicht-Input aus der Asset-Library zuweisen.",
  WF_SEND_INPUT_ASSET_MISSING: "Input neu zuweisen; referenziertes Asset ist nicht mehr im Projekt.",
  WF_SEND_INPUT_TYPE_MISMATCH: "Fuer den Input ein Asset mit passendem Typ (image/video/audio) auswaehlen.",
  WF_SEND_TEMPLATE_MISSING: "API-Template unter workflows/<workflowId>.api.json anlegen oder korrigieren.",
  WF_SEND_PLACEHOLDER_UNRESOLVED: "meta.inputs[].key und {{...}} Platzhalter im API-JSON synchronisieren.",
  WF_SEND_PREFLIGHT_FAILED: "Payload-Preview reparieren und danach erneut senden.",
  WF_SEND_QUEUE_FAILED: "Comfy-Status/URL pruefen und den Run erneut starten.",
  WF_SEND_QUEUE_EXCEPTION: "ComfyUI-Erreichbarkeit und lokale Netzwerk-/Firewall-Regeln pruefen.",
  WF_SEND_PAYLOAD_PREVIEW_FAILED: "Template-JSON und Input-Mapping pruefen.",
  WF_RUN_RETRY_MISSING_REQUEST: "Neuen Run direkt aus dem Workflow-Form starten (historischer Request fehlt).",
  WF_RUN_RETRY_DUPLICATE_ACTIVE: "Auf Abschluss des aktiven Runs warten oder zuerst abbrechen.",
  WF_RUN_RETRY_FAILED: "ComfyUI-Status pruefen und Retry erneut ausloesen.",
  WF_RUN_RETRY_EXCEPTION: "ComfyUI-Verbindung pruefen und Retry erneut ausloesen.",
  WF_RUN_CANCEL_FAILED: "Prompt-ID/Run-Status pruefen und erneut abbrechen.",
  WF_RUN_CANCEL_EXCEPTION: "ComfyUI-Verbindung pruefen und erneut abbrechen.",
  WF_RUN_COPY_MISSING_REQUEST: "Nur Runs mit gespeichertem Request koennen kopiert werden.",
  WF_UI_CLIPBOARD_FAILED: "Browser-Clipboard-Berechtigung pruefen und erneut versuchen.",
  WF_OUTPUT_UNSUPPORTED_EXTENSION: "Nur unterstuetzte Output-Typen importieren (Image/Video/Audio).",
  WF_OUTPUT_DUPLICATE: "Bereits importierten Output nicht erneut importieren; stattdessen vorhandenes Asset nutzen.",
  WF_OUTPUT_VIEW_HTTP_ERROR: "Comfy /view Rueckgabe pruefen (Dateiname/Subfolder) und Run-Ausgabe erneut erzeugen.",
  WF_OUTPUT_VIEW_FETCH_ERROR: "ComfyUI-Verbindung pruefen und Import wiederholen.",
  WF_OUTPUT_EMPTY_FILE: "Run erneut ausfuehren; Comfy lieferte eine leere Datei.",
  WF_OUTPUT_IMPORT_FAILED: "Fehlermeldung pruefen und den betroffenen Output einzeln erneut importieren.",
  WF_OUTPUT_NO_RESULT: "Import erneut versuchen oder Output-Datei in Comfy pruefen.",
  WF_OUTPUT_IMPORT_EXCEPTION: "Import erneut versuchen; bei Wiederholung Comfy-/Dateizugriff pruefen.",
  WF_RUN_FAILED: "Fehlerdetails pruefen, Input/Template korrigieren und Run erneut starten.",
  WF_PROJECT_NOT_LOADED: "Projekt laden oder neu erstellen und danach erneut ausfuehren.",
  WF_COMFY_UNREACHABLE: "ComfyUI starten und URL/Port pruefen.",
  WF_COMFY_REMOTE_BLOCKED: "Nur lokale Hosts sind erlaubt; optional COMFYUI_ALLOW_REMOTE=1 setzen.",
  WF_COMFY_PROMPT_REJECTED: "Workflow/API-JSON gegen Comfy Export pruefen.",
};

function detectWorkflowIssueCode(message: string, fallbackCode: string): string {
  const m = message.toLowerCase();
  if (m.includes("no workflow selected")) return "WF_SEND_NO_WORKFLOW";
  if (m.includes("required input") || m.includes("pflicht-input")) return "WF_SEND_INPUT_MISSING";
  if (m.includes("erwartet") && m.includes("ausgewaehlt ist aber")) return "WF_SEND_INPUT_TYPE_MISMATCH";
  if (m.includes("template fehlt") || m.includes("template missing") || m.includes("missing api template")) return "WF_SEND_TEMPLATE_MISSING";
  if (m.includes("unresolved placeholders")) return "WF_SEND_PLACEHOLDER_UNRESOLVED";
  if (m.includes("no project loaded")) return "WF_PROJECT_NOT_LOADED";
  if (m.includes("not reachable") || m.includes("econnrefused") || m.includes("fetch failed")) return "WF_COMFY_UNREACHABLE";
  if (m.includes("blocked by local-only policy") || m.includes("comfyui_allow_remote")) return "WF_COMFY_REMOTE_BLOCKED";
  if (m.includes("/prompt failed") || m.includes("http 4") || m.includes("http 5")) return "WF_COMFY_PROMPT_REJECTED";
  if (m.includes("unsupported output") || m.includes("unsupported comfy output extension")) return "WF_OUTPUT_UNSUPPORTED_EXTENSION";
  if (m.includes("already imported")) return "WF_OUTPUT_DUPLICATE";
  if (m.includes("/view failed with http")) return "WF_OUTPUT_VIEW_HTTP_ERROR";
  if (m.includes("missing comfy output path") || m.includes("invalid comfy output path")) return "WF_OUTPUT_IMPORT_FAILED";
  if (m.includes("returned an empty file")) return "WF_OUTPUT_EMPTY_FILE";
  if (m.includes("output import failed")) return "WF_OUTPUT_VIEW_FETCH_ERROR";
  return fallbackCode;
}

function resolveWorkflowIssue(rawMessage: string, fallbackCode: string): WorkflowIssue {
  const raw = (rawMessage || "").trim();
  const prefixed = raw.match(/^\[([A-Z0-9_:-]+)\]\s*(.*)$/);
  const prefixCode = prefixed?.[1] ?? null;
  let body = ((prefixed?.[2] ?? raw) || "Unknown workflow error.").trim();

  let nextStepFromMessage: string | null = null;
  const nextStepMatch = body.match(/(?:^|\s)Next step:\s*(.+)$/i);
  if (nextStepMatch) {
    nextStepFromMessage = nextStepMatch[1].trim();
    body = body.replace(/(?:^|\s)Next step:\s*(.+)$/i, "").trim();
  }

  const code = prefixCode ?? detectWorkflowIssueCode(body, fallbackCode);
  const nextStep = nextStepFromMessage ?? WORKFLOW_ISSUE_NEXT_STEP_BY_CODE[code] ?? "Fehlerdetails pruefen und den Schritt erneut ausfuehren.";

  return {
    code,
    message: body || "Unknown workflow error.",
    nextStep,
  };
}

function resolveOutputImportIssue(rawMessage: string, outputPath: string): WorkflowIssue {
  const raw = rawMessage.trim();
  if (!raw) {
    return resolveWorkflowIssue(`Output import produced no asset for "${outputPath}".`, "WF_OUTPUT_NO_RESULT");
  }
  return resolveWorkflowIssue(raw, "WF_OUTPUT_IMPORT_FAILED");
}

function compareRunsByNewest(
  a: { id: string; createdAt: string; updatedAt: string },
  b: { id: string; createdAt: string; updatedAt: string },
): number {
  const aUpdatedTs = Number.isFinite(new Date(a.updatedAt).getTime()) ? new Date(a.updatedAt).getTime() : 0;
  const bUpdatedTs = Number.isFinite(new Date(b.updatedAt).getTime()) ? new Date(b.updatedAt).getTime() : 0;
  if (bUpdatedTs !== aUpdatedTs) {
    return bUpdatedTs - aUpdatedTs;
  }

  const aCreatedTs = Number.isFinite(new Date(a.createdAt).getTime()) ? new Date(a.createdAt).getTime() : 0;
  const bCreatedTs = Number.isFinite(new Date(b.createdAt).getTime()) ? new Date(b.createdAt).getTime() : 0;
  if (bCreatedTs !== aCreatedTs) {
    return bCreatedTs - aCreatedTs;
  }

  return b.id.localeCompare(a.id);
}

function compareRunsByOldest(
  a: { id: string; createdAt: string; updatedAt: string },
  b: { id: string; createdAt: string; updatedAt: string },
): number {
  return -compareRunsByNewest(a, b);
}

function buildExpectedTemplateTokens(inputs: WorkflowMetaInputDefinition[]): string[] {
  const base = ["workflowId", "width", "height", "fps", "frames", "steps", "projectRoot"];
  const tokens = new Set<string>(base);

  inputs.forEach((input) => {
    tokens.add(input.key);
    if (input.key.endsWith("AssetId")) {
      const keyBase = input.key.slice(0, -2);
      tokens.add(`${keyBase}Path`);
      tokens.add(`${keyBase}AbsPath`);
      tokens.add(`${keyBase}Name`);
      tokens.add(`${keyBase}Type`);
    }
  });

  return Array.from(tokens).sort((a, b) => a.localeCompare(b));
}

function isRunStale(run: { status: string; updatedAt: string }, nowTs: number): boolean {
  if (run.status !== "pending" && run.status !== "running") {
    return false;
  }

  const updatedTs = new Date(run.updatedAt).getTime();
  if (!Number.isFinite(updatedTs)) {
    return false;
  }

  return nowTs - updatedTs > 120000;
}

function formatRunDuration(createdAt: string, updatedAt: string, nowTs: number): string {
  const startTs = new Date(createdAt).getTime();
  const updateTs = new Date(updatedAt).getTime();
  if (!Number.isFinite(startTs)) {
    return "-";
  }

  const endTs = Number.isFinite(updateTs) ? Math.max(updateTs, startTs) : nowTs;
  const totalSec = Math.max(0, Math.floor((endTs - startTs) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${String(sec).padStart(2, "0")}s`;
}

function mergeDraft(w: WorkflowCatalogEntry, d?: Draft): Draft {
  return {
    settings: {
      width: d?.settings.width ?? String(w.defaults.width),
      height: d?.settings.height ?? String(w.defaults.height),
      fps: d?.settings.fps ?? String(w.defaults.fps),
      frames: d?.settings.frames ?? String(w.defaults.frames),
      steps: d?.settings.steps ?? String(w.defaults.steps),
    },
    inputs: Object.fromEntries(w.inputs.map((i) => [i.key, d?.inputs[i.key] ?? ""])) as Record<string, string>,
  };
}

function mergeInputConnections(w: WorkflowCatalogEntry, current?: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(w.inputs.map((input) => [input.key, current?.[input.key] ?? true])) as Record<string, boolean>;
}

function validate(w: WorkflowCatalogEntry, d: Draft, assets: Asset[], inputConnections?: Record<string, boolean>): Validation {
  const issues: WorkflowIssue[] = [];
  const addIssue = (code: string, message: string) => {
    const issue = resolveWorkflowIssue(message, code);
    issues.push(issue);
  };

  const nums = parseNums(d.settings, issues);
  const requestInputs: Record<string, string> = {};

  w.inputs.forEach((i) => {
    if (!i.key.endsWith("AssetId")) {
      addIssue("WF_SEND_INPUT_KEY_INVALID", `Input-Key "${i.key}" endet nicht auf "AssetId" (Meta-Konvention verletzt).`);
    }

    const connected = inputConnections?.[i.key] !== false;
    if (!connected) {
      if (i.required) {
        addIssue("WF_SEND_INPUT_MISSING", `Pflicht-Input "${i.label}" ist nicht verbunden.`);
      }
      return;
    }

    const value = (d.inputs[i.key] ?? "").trim();
    if (!value) {
      if (i.required) {
        addIssue("WF_SEND_INPUT_MISSING", `Pflicht-Input "${i.label}" ist leer.`);
      }
      return;
    }
    const asset = assets.find((a) => a.id === value);
    if (!asset) {
      addIssue("WF_SEND_INPUT_ASSET_MISSING", `Ausgewaehltes Asset fuer "${i.label}" existiert nicht mehr im Projekt.`);
      return;
    }
    if (asset.type !== i.type) {
      addIssue("WF_SEND_INPUT_TYPE_MISMATCH", `Input "${i.label}" erwartet ${i.type}, ausgewaehlt ist aber ${asset.type}.`);
      return;
    }
    requestInputs[i.key] = asset.id;
  });

  if (!w.templateExists) {
    addIssue("WF_SEND_TEMPLATE_MISSING", `API-Template fehlt: ${w.templateRelativePath}`);
  }
  if (!nums) return { canSend: false, request: null, issues };

  const request: GenericComfyWorkflowRunRequest = {
    workflowId: w.id,
    workflowTemplateRelativePath: w.templateRelativePath,
    width: nums.width,
    height: nums.height,
    fps: nums.fps,
    frames: nums.frames,
    steps: nums.steps,
  };
  Object.entries(requestInputs).forEach(([k, v]) => {
    request[k] = v;
  });

  return { canSend: issues.length === 0, request: issues.length === 0 ? request : null, issues };
}

function parseNums(s: Record<NumKey, string>, issues: WorkflowIssue[]): Record<NumKey, number> | null {
  const out = {} as Record<NumKey, number>;
  for (const f of NUM_FIELDS) {
    const n = Number((s[f.key] ?? "").trim());
    if (!Number.isFinite(n) || n < 1) {
      issues.push(resolveWorkflowIssue(`${f.label} must be a number >= 1.`, "WF_SEND_PARAM_INVALID"));
      return null;
    }
    out[f.key] = Math.round(n);
  }
  return out;
}

function assetsForInput(assets: Asset[], input: WorkflowMetaInputDefinition): Asset[] {
  return assets.filter((a) => a.type === input.type).slice().sort((a, b) => a.originalName.localeCompare(b.originalName));
}

function parseConflictedWorkflowId(message: string, fallbackWorkflowId: string): string {
  const match = message.match(/Workflow "([^"]+)"/i);
  const parsed = match?.[1]?.trim() ?? "";
  return parsed || fallbackWorkflowId;
}

function makeRunId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `wfstudio_${globalThis.crypto.randomUUID()}`;
  }
  return `wfstudio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function makePresetId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `preset_${globalThis.crypto.randomUUID()}`;
  }
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function statusBadgeClass(status: "pending" | "running" | "success" | "failed"): string {
  const base = "text-[8px] px-2 py-1 rounded-md border uppercase tracking-wider shrink-0";
  if (status === "success") return `${base} border-emerald-400/20 bg-emerald-400/10 text-emerald-300`;
  if (status === "failed") return `${base} border-red-400/20 bg-red-400/10 text-red-300`;
  if (status === "running") return `${base} border-blue-400/20 bg-blue-400/10 text-blue-300`;
  return `${base} border-zinc-400/20 bg-zinc-400/10 text-zinc-300`;
}

function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function canImportOutputPath(outputPath: string): boolean {
  const normalized = outputPath.trim().toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"]
    .some((extension) => normalized.endsWith(extension));
}

function formatImportReasonLabel(reason: string): string {
  if (reason === "WF_OUTPUT_UNSUPPORTED_EXTENSION") return "Dateityp nicht unterstuetzt";
  if (reason === "DUPLICATE_OUTPUT") return "Bereits importiert";
  if (reason === "WF_OUTPUT_VIEW_HTTP_ERROR") return "Comfy /view HTTP-Fehler";
  if (reason === "WF_OUTPUT_VIEW_FETCH_ERROR") return "Comfy /view Netzwerkfehler";
  if (reason === "WF_OUTPUT_EMPTY_FILE") return "Leere Output-Datei";
  if (reason === "WF_OUTPUT_IMPORT_FAILED") return "Import fehlgeschlagen";
  if (reason === "WF_OUTPUT_IMPORT_EXCEPTION") return "Import Exception";
  if (reason === "WF_OUTPUT_NO_RESULT") return "Kein neues Asset erzeugt";
  return reason;
}
