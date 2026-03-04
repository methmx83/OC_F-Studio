import React, { useEffect, useMemo, useState } from "react";
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

type LoadState = "idle" | "loading" | "loaded" | "error";
type NumKey = "width" | "height" | "fps" | "frames" | "steps";
type SendStatus = "idle" | "sending" | "success" | "error";
type RunFilter = "all" | "queued" | "failed" | "success";
type RunSort = "newest" | "oldest";

type Draft = {
  settings: Record<NumKey, string>;
  inputs: Record<string, string>;
};

type Validation = {
  canSend: boolean;
  request: GenericComfyWorkflowRunRequest | null;
  issues: string[];
};

type ImportAllSummary = {
  imported: number;
  skipped: number;
  reasonCounts: Record<string, number>;
  skippedExamples: string[];
  message: string;
};

type WorkflowPreset = WorkflowPresetItem;

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
  const [sendState, setSendState] = useState<{ status: SendStatus; message: string; runId?: string; promptId?: string; hint?: string }>({
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
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [runSort, setRunSort] = useState<RunSort>(() => {
    try {
      const raw = window.sessionStorage.getItem("workflowStudio.recentRuns.sort");
      return raw === "oldest" ? "oldest" : "newest";
    } catch {
      return "newest";
    }
  });
  const [presetsByWorkflow, setPresetsByWorkflow] = useState<Record<string, WorkflowPreset[]>>({});
  const [presetUpdatedAtByWorkflow, setPresetUpdatedAtByWorkflow] = useState<Record<string, string>>({});
  const [presetLoadWarning, setPresetLoadWarning] = useState<string | null>(null);
  const [presetsHydrated, setPresetsHydrated] = useState(false);
  const [isSavingPresets, setIsSavingPresets] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [autoPlaceImportedOutputs, setAutoPlaceImportedOutputs] = useState(true);

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
        setPresetsHydrated(false);
        return;
      }

      setPresetsHydrated(false);
      try {
        const response = await getIpcClient().getWorkflowPresets();
        if (isCancelled) return;
        if (response.success) {
          setPresetsByWorkflow(response.presets ?? {});
          setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
          setPresetLoadWarning((response.message || "").includes("with warnings") ? response.message : null);
        } else {
          setPresetsByWorkflow({});
          setPresetLoadWarning(null);
          setSendState({ status: "error", message: response.message || "Workflow-Presets konnten nicht geladen werden." });
        }
      } catch (error) {
        if (isCancelled) return;
        setPresetsByWorkflow({});
        setPresetLoadWarning(null);
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
      setIsSavingPresets(true);
      try {
        const response = await getIpcClient().saveWorkflowPresets({
          presets: presetsByWorkflow as WorkflowPresetsMap,
          expectedUpdatedAtByWorkflow: presetUpdatedAtByWorkflow,
        });
        if (isCancelled) return;
        if (response.success) {
          const merged = response.presets ?? {};
          const currentJson = JSON.stringify(presetsByWorkflow);
          const mergedJson = JSON.stringify(merged);
          if (currentJson !== mergedJson) {
            setPresetsByWorkflow(merged);
          }
          setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
        } else {
          if ((response.message || "").includes("PRESET_CONFLICT")) {
            setPresetsByWorkflow(response.presets ?? {});
            setPresetUpdatedAtByWorkflow(response.updatedAtByWorkflow ?? {});
            setSendState({
              status: "error",
              message: "Preset-Konflikt erkannt: Datei wurde extern geaendert. Stand wurde neu geladen, bitte Aenderung erneut speichern.",
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
  }, [presetUpdatedAtByWorkflow, projectRoot, presetsByWorkflow, presetsHydrated]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("workflowStudio.recentRuns.sort", runSort);
    } catch {
      // ignore session storage errors
    }
  }, [runSort]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const draft = useMemo(() => (selected ? mergeDraft(selected, drafts[selected.id]) : null), [selected, drafts]);
  const validation = useMemo(() => (selected && draft ? validate(selected, draft, assets) : null), [selected, draft, assets]);
  const selectedWorkflowRuns = useMemo(
    () => (selected ? queuedWorkflowRuns.filter((run) => run.workflowId === selected.id).slice(0, 24) : []),
    [queuedWorkflowRuns, selected],
  );
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
      const aTs = new Date(a.createdAt).getTime();
      const bTs = new Date(b.createdAt).getTime();
      const safeA = Number.isFinite(aTs) ? aTs : 0;
      const safeB = Number.isFinite(bTs) ? bTs : 0;
      return runSort === "newest" ? safeB - safeA : safeA - safeB;
    });
    return list;
  }, [filteredWorkflowRuns, runSort]);
  const workflowPresets = useMemo(() => (selected ? presetsByWorkflow[selected.id] ?? [] : []), [selected, presetsByWorkflow]);
  const expectedTemplateTokens = useMemo(() => (selected ? buildExpectedTemplateTokens(selected.inputs) : []), [selected]);

  // eslint-disable-next-line no-unused-vars
  const patchDraft = (fn: (draftValue: Draft) => Draft) => {
    if (!selected) return;
    setDrafts((prev) => ({ ...prev, [selected.id]: fn(mergeDraft(selected, prev[selected.id])) }));
  };

  const onNum = (key: NumKey, value: string) => patchDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  const onInput = (key: string, value: string) => patchDraft((d) => ({ ...d, inputs: { ...d.inputs, [key]: value } }));

  function onSavePreset(): void {
    if (!selected || !draft) return;
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
    setSendState({ status: "success", message: "Preset gespeichert." });
  }

  function onApplyPreset(): void {
    if (!selected) return;
    const preset = workflowPresets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    setDrafts((prev) => ({ ...prev, [selected.id]: mergeDraft(selected, preset.draft) }));
    setSendState({ status: "success", message: `Preset "${preset.name}" angewendet.` });
  }

  function onDeletePreset(): void {
    if (!selected || !selectedPresetId) return;
    setPresetsByWorkflow((prev) => {
      const current = prev[selected.id] ?? [];
      return { ...prev, [selected.id]: current.filter((p) => p.id !== selectedPresetId) };
    });
    setSelectedPresetId("");
    setPresetName("");
    setSendState({ status: "success", message: "Preset geloescht." });
  }

  async function onSend(): Promise<void> {
    if (!selected || !validation?.request) return;
    const runId = makeRunId();
    setSendState({ status: "sending", message: `Queueing "${selected.name}"...`, runId });
    try {
      const res = await getIpcClient().queueComfyRun({
        runId,
        request: validation.request,
        baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
      });
      const hint = res.success ? undefined : resolveComfyActionHint(res.message);
      setSendState({ status: res.success ? "success" : "error", message: res.message, runId: res.runId, promptId: res.promptId, hint });
    } catch (e) {
      const message = `Workflow queue request failed: ${e instanceof Error ? e.message : String(e)}`;
      setSendState({ status: "error", message, runId, hint: resolveComfyActionHint(message) });
    }
  }

  async function buildRenderedPayloadJson(): Promise<string | null> {
    if (!validation?.request) {
      return null;
    }

    const response = await getIpcClient().previewComfyRunPayload({
      request: validation.request,
      baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
    });

    if (!response.success || !response.renderedPrompt) {
      setSendState({
        status: "error",
        message: response.message || "Rendern des Workflow-Payloads fehlgeschlagen.",
        hint: resolveComfyActionHint(response.message || ""),
      });
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
      setSendState({
        status: "error",
        message: `Copy rendered payload failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  async function onOpenAndCopyComfyUi(): Promise<void> {
    onOpenInComfyUi();
    await onCopyRenderedPayload();
    setShowComfyPasteHint(true);
    window.setTimeout(() => setShowComfyPasteHint(false), 5000);
  }

  async function onImportOutput(outputPath: string): Promise<void> {
    if (!canImportOutputPath(outputPath)) return;
    setImportingOutputPath(outputPath);
    try {
      const beforeState = useStudioStore.getState();
      const beforeAssetIds = new Set(beforeState.assets.map((asset) => asset.id));
      await importComfyOutputAsset(outputPath);
      const afterState = useStudioStore.getState();
      const importedAssets = afterState.assets.filter((asset) => !beforeAssetIds.has(asset.id));

      if (autoPlaceImportedOutputs) {
        importedAssets.forEach((asset) => {
          dropAssetToTimeline(asset.id);
        });
      }
    } finally {
      setImportingOutputPath(null);
    }
  }

  async function onImportAllOutputs(run: { id: string; outputPaths: string[] }): Promise<void> {
    if (isProjectBusy) return;

    const uniquePaths = Array.from(new Set(run.outputPaths.map((path) => path.trim()).filter(Boolean)));
    const importablePaths = uniquePaths.filter((path) => canImportOutputPath(path));
    const unsupportedPaths = uniquePaths.filter((path) => !canImportOutputPath(path));
    const skippedUnsupported = unsupportedPaths.length;

    const reasonCounts: Record<string, number> = {};
    const skippedExamples: string[] = [];
    const addReason = (reason: string, outputPath?: string) => {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      if (outputPath && skippedExamples.length < 3) {
        skippedExamples.push(outputPath);
      }
    };

    unsupportedPaths.forEach((path) => addReason("UNSUPPORTED_EXTENSION", path));

    if (importablePaths.length === 0) {
      const summary: ImportAllSummary = {
        imported: 0,
        skipped: skippedUnsupported,
        reasonCounts,
        skippedExamples,
        message: "0 importiert, alle Outputs uebersprungen (keine unterstuetzten Dateitypen).",
      };
      setImportAllSummaries((prev) => ({ ...prev, [run.id]: summary }));
      return;
    }

    setImportingRunId(run.id);
    try {
      let imported = 0;

      for (const outputPath of importablePaths) {
        const beforeState = useStudioStore.getState();
        const beforeAssetIds = new Set(beforeState.assets.map((asset) => asset.id));
        try {
          await importComfyOutputAsset(outputPath);
          const afterState = useStudioStore.getState();
          const importedAssets = afterState.assets.filter((asset) => !beforeAssetIds.has(asset.id));

          if (importedAssets.length > 0) {
            imported += 1;
            if (autoPlaceImportedOutputs) {
              importedAssets.forEach((asset) => {
                dropAssetToTimeline(asset.id);
              });
            }
          } else {
            addReason("NO_CHANGE_OR_REJECTED", outputPath);
          }
        } catch {
          addReason("IMPORT_EXCEPTION", outputPath);
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
    } finally {
      setImportingRunId(null);
    }
  }

  async function onRetryRun(run: { id: string; workflowName: string; request: ComfyWorkflowRunRequest }): Promise<void> {
    const duplicateActiveRun = queuedWorkflowRuns.find((candidate) => {
      if (candidate.id === run.id) return false;
      if (candidate.status !== "pending" && candidate.status !== "running") return false;
      return JSON.stringify(candidate.request) === JSON.stringify(run.request);
    });

    if (duplicateActiveRun) {
      setSendState({
        status: "error",
        message: `Retry blockiert: Fuer diesen Request laeuft bereits ein aktiver Run (${duplicateActiveRun.id}).`,
        runId: duplicateActiveRun.id,
        hint: "Warte auf Abschluss oder pruefe den aktiven Run in Recent Runs.",
      });
      return;
    }

    const retryRunId = makeRunId();
    setRetryingRunId(run.id);
    setSendState({ status: "sending", message: `Retrying "${run.workflowName}"...`, runId: retryRunId });
    try {
      const res = await getIpcClient().queueComfyRun({
        runId: retryRunId,
        request: run.request,
        baseUrlOverride: comfyBaseUrl.trim().length > 0 ? comfyBaseUrl.trim() : undefined,
      });
      const hint = res.success ? undefined : resolveComfyActionHint(res.message);
      setSendState({ status: res.success ? "success" : "error", message: res.message, runId: res.runId, promptId: res.promptId, hint });
    } catch (e) {
      const message = `Retry request failed: ${e instanceof Error ? e.message : String(e)}`;
      setSendState({ status: "error", message, runId: retryRunId, hint: resolveComfyActionHint(message) });
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
      setSendState({
        status: response.success ? "success" : "error",
        message: response.message,
        runId: response.runId,
        hint: response.success ? undefined : resolveComfyActionHint(response.message),
      });
    } catch (e) {
      const message = `Cancel request failed: ${e instanceof Error ? e.message : String(e)}`;
      setSendState({ status: "error", message, runId: run.id, hint: resolveComfyActionHint(message) });
    } finally {
      setCancellingRunId(null);
    }
  }

  async function onCopyPromptPayload(run: { id: string; request: ComfyWorkflowRunRequest }): Promise<void> {
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
      setSendState({ status: "error", message: `Copy prompt payload failed: ${e instanceof Error ? e.message : String(e)}` });
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
      setSendState({ status: "error", message: `Copy template tokens failed: ${e instanceof Error ? e.message : String(e)}` });
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
      setSendState({ status: "error", message: `Copy meta input stubs failed: ${e instanceof Error ? e.message : String(e)}` });
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
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Settings</div>

                  <div className="mt-3 rounded-xl border border-white/5 bg-zinc-900/40 p-3 space-y-2">
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500">Parameter Presets (MVP)</div>
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_auto_auto_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
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
                        className="w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-[11px] text-zinc-100 outline-none focus:border-blue-500/50"
                      >
                        <option value="">Preset waehlen...</option>
                        {workflowPresets.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button onClick={onApplyPreset} disabled={!selectedPresetId || isSavingPresets} className="px-3 py-2 rounded-lg border border-white/10 bg-zinc-950/60 text-[9px] font-black uppercase tracking-wider text-zinc-300 disabled:opacity-40">
                        Apply
                      </button>
                      <button onClick={onSavePreset} disabled={isSavingPresets} className="px-3 py-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-[9px] font-black uppercase tracking-wider text-emerald-200 disabled:opacity-40">
                        {isSavingPresets ? "Saving..." : "Save"}
                      </button>
                      <button onClick={onDeletePreset} disabled={!selectedPresetId || isSavingPresets} className="px-3 py-2 rounded-lg border border-red-400/20 bg-red-400/10 text-[9px] font-black uppercase tracking-wider text-red-200 disabled:opacity-40">
                        Delete
                      </button>
                    </div>
                  </div>

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

                {(validation.issues.length > 0 || sendState.status !== "idle") && (
                  <div className="rounded-2xl border border-white/5 bg-zinc-950/30 p-4 text-[10px]">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Validation / Send Status</div>
                    {validation.issues.length > 0 && <div className="mt-3 space-y-1">{validation.issues.map((msg) => <div key={msg} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">{msg}</div>)}</div>}
                    {sendState.status !== "idle" && (
                      <div className={`mt-3 rounded-xl border px-3 py-3 ${sendState.status === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : sendState.status === "error" ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-blue-500/20 bg-blue-500/10 text-blue-200"}`}>
                        <div className="font-bold uppercase tracking-wider text-[9px]">{sendState.status === "success" ? "Queued" : sendState.status === "error" ? "Send Failed" : "Submitting"}</div>
                        <div className="mt-1">{sendState.message}</div>
                        {sendState.hint && <div className="mt-2 rounded-md border border-current/20 bg-black/20 px-2 py-1 text-[10px]">Hint: {sendState.hint}</div>}
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
                      {sortedFilteredWorkflowRuns.map((run) => (
                        <div key={run.id} className="rounded-xl border border-white/5 bg-zinc-900/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-zinc-200 truncate">{run.message}</div>
                              {run.status === "failed" && resolveComfyActionHint(run.message) && (
                                <div className="mt-1 text-[9px] text-amber-300/90 truncate">Hint: {resolveComfyActionHint(run.message)}</div>
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
                              className="px-2 py-1 rounded-md border border-white/10 bg-zinc-950/60 text-zinc-300 text-[8px] font-black uppercase tracking-wider hover:border-zinc-700 hover:text-white"
                              title="Copy prompt payload JSON"
                            >
                              <span className="inline-flex items-center gap-1"><Copy size={10} /> {copiedRunId === run.id ? "Copied" : "Copy prompt payload"}</span>
                            </button>

                            <button
                              onClick={() => {
                                void onRetryRun(run);
                              }}
                              disabled={run.status !== "failed" || retryingRunId === run.id || isProjectBusy}
                              className="px-2 py-1 rounded-md border border-amber-400/20 bg-amber-400/10 text-amber-200 text-[8px] font-black uppercase tracking-wider disabled:opacity-40"
                              title={run.status === "failed" ? "Retry this failed run" : "Retry available for failed runs"}
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
                                <div className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold">
                                  Outputs ({run.outputPaths.length})
                                </div>
                                <button
                                  onClick={() => {
                                    void onImportAllOutputs(run);
                                  }}
                                  disabled={isProjectBusy || importingRunId === run.id || run.outputPaths.every((path) => !canImportOutputPath(path))}
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
                                    <button
                                      onClick={() => {
                                        void onImportOutput(outputPath);
                                      }}
                                      disabled={!canImportOutputPath(outputPath) || isProjectBusy}
                                      className="shrink-0 px-2 py-1 rounded-md border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 text-[8px] font-black uppercase tracking-wider disabled:opacity-40"
                                      title={
                                        canImportOutputPath(outputPath)
                                          ? "Import output into project assets"
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
                      ))}
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

function resolveComfyActionHint(message: string): string | undefined {
  const m = message.toLowerCase();

  if (m.includes("no project loaded")) {
    return "Projekt zuerst laden oder neu erstellen.";
  }

  if (m.includes("missing api template") || m.includes("workflow template missing")) {
    return "API-Template-Datei pruefen: workflows/<workflowId>.api.json";
  }

  if (m.includes("unresolved placeholders")) {
    return "meta.inputs[].key und {{...}} Platzhalter im API-JSON abgleichen.";
  }

  if (m.includes("asset") && m.includes("not found")) {
    return "Input-Asset in der Library neu waehlen oder erneut importieren.";
  }

  if (m.includes("not reachable") || m.includes("econnrefused") || m.includes("fetch failed")) {
    return "ComfyUI starten und URL/Port in deiner Umgebung pruefen.";
  }

  if (m.includes("blocked by local-only policy") || m.includes("comfyui_allow_remote")) {
    return "Remote-Comfy ist geblockt. Optional COMFYUI_ALLOW_REMOTE=1 setzen.";
  }

  if (m.includes("http 4") || m.includes("http 5") || m.includes("/prompt failed")) {
    return "ComfyUI-API hat den Prompt abgelehnt. Workflow/API-JSON gegen Comfy export neu pruefen.";
  }

  return undefined;
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

function validate(w: WorkflowCatalogEntry, d: Draft, assets: Asset[]): Validation {
  const issues: string[] = [];
  const nums = parseNums(d.settings, issues);
  const requestInputs: Record<string, string> = {};

  w.inputs.forEach((i) => {
    if (!i.key.endsWith("AssetId")) {
      issues.push(`Input-Key "${i.key}" endet nicht auf "AssetId" (Meta-Konvention verletzt).`);
    }

    const value = (d.inputs[i.key] ?? "").trim();
    if (!value) {
      if (i.required) issues.push(`Pflicht-Input "${i.label}" ist leer.`);
      return;
    }
    const asset = assets.find((a) => a.id === value);
    if (!asset) {
      issues.push(`Ausgewaehltes Asset fuer "${i.label}" existiert nicht mehr im Projekt.`);
      return;
    }
    if (asset.type !== i.type) {
      issues.push(`Input "${i.label}" erwartet ${i.type}, ausgewaehlt ist aber ${asset.type}.`);
      return;
    }
    requestInputs[i.key] = asset.id;
  });

  if (!w.templateExists) issues.push(`API-Template fehlt: ${w.templateRelativePath}`);
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

function parseNums(s: Record<NumKey, string>, issues: string[]): Record<NumKey, number> | null {
  const out = {} as Record<NumKey, number>;
  for (const f of NUM_FIELDS) {
    const n = Number((s[f.key] ?? "").trim());
    if (!Number.isFinite(n) || n < 1) {
      issues.push(`${f.label} must be a number >= 1.`);
      return null;
    }
    out[f.key] = Math.round(n);
  }
  return out;
}

function assetsForInput(assets: Asset[], input: WorkflowMetaInputDefinition): Asset[] {
  return assets.filter((a) => a.type === input.type).slice().sort((a, b) => a.originalName.localeCompare(b.originalName));
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
  if (reason === "UNSUPPORTED_EXTENSION") return "Dateityp nicht unterstuetzt";
  if (reason === "NO_CHANGE_OR_REJECTED") return "Nicht importiert (kein Aenderungseffekt/abgelehnt)";
  if (reason === "IMPORT_EXCEPTION") return "Import-Fehler";
  return reason;
}
