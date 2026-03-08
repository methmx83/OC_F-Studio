import React, { useEffect, useState } from "react";
import {
  Layout,
  FlaskConical,
  Settings,
  Terminal,
  Cpu,
  Database,
  Zap,
  Share2,
  Undo2,
  Redo2,
  Mic,
  Images,
  FolderPlus,
  FolderOpen,
  History,
  Save,
} from "lucide-react";
import type { ProjectAutosaveSnapshot } from "@shared/ipc/project";
import { useShallow } from "zustand/shallow";

import AssetLibraryView from "../../features/assets/AssetLibraryView";
import PreviewStage from "../../features/preview/PreviewStage";
import ComfyPanel from "../../features/comfy/ComfyPanel";
import TimelineDock from "../../features/timeline/TimelineDock";
import WorkflowStudioView from "../../features/workflows/WorkflowStudioView";
import PromptSceneGeneratorPanel from "../../features/workflows/PromptSceneGeneratorPanel";
import ComfyGalleryView from "../../features/gallery/ComfyGalleryView";
import { getIpcClient } from "../../core/adapters/ipcClient";
import type { ShareSnapshotMetrics } from "../../core/analytics/shareSnapshotMetrics";
import { readShareSnapshotMetrics, recordShareSnapshotMetric } from "../../core/analytics/shareSnapshotMetrics";
import { selectAppShellStoreState } from "../../core/store/selectors";
import { useStudioStore } from "../../core/store/studioStore";

function SettingsView() {
  const {
    assetsCount,
    trackCount,
    clipCount,
    queuedRunCount,
    isProjectBusy,
    proxyPendingCount,
  } = useStudioStore(
    useShallow((state) => ({
      assetsCount: state.assets.length,
      trackCount: state.timeline.tracks.length,
      clipCount: state.timeline.tracks.reduce((total, track) => total + track.clips.length, 0),
      queuedRunCount: state.queuedWorkflowRuns.filter((run) => run.status === "pending" || run.status === "running").length,
      isProjectBusy: state.isProjectBusy,
      proxyPendingCount: Object.values(state.proxyPendingByAssetId).filter(Boolean).length,
    })),
  );
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [heapUsedMb, setHeapUsedMb] = useState<number | null>(null);
  const [heapTotalMb, setHeapTotalMb] = useState<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    const frameDurations: number[] = [];

    const tick = (ts: number) => {
      const delta = ts - lastTs;
      lastTs = ts;
      if (delta > 0 && Number.isFinite(delta)) {
        frameDurations.push(delta);
        if (frameDurations.length > 60) {
          frameDurations.shift();
        }
        const avgMs = frameDurations.reduce((sum, value) => sum + value, 0) / frameDurations.length;
        if (Number.isFinite(avgMs) && avgMs > 0) {
          setFrameMs(Number(avgMs.toFixed(2)));
          setFps(Math.max(1, Math.round(1000 / avgMs)));
        }
      }
      rafId = globalThis.requestAnimationFrame(tick);
    };

    rafId = globalThis.requestAnimationFrame(tick);
    return () => {
      globalThis.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const updateMemory = () => {
      const perf = globalThis.performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
        };
      };

      const memory = perf.memory;
      if (!memory) {
        setHeapUsedMb(null);
        setHeapTotalMb(null);
        return;
      }

      setHeapUsedMb(Number((memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)));
      setHeapTotalMb(Number((memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)));
    };

    updateMemory();
    const intervalId = globalThis.setInterval(updateMemory, 1000);
    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="h-full p-6 text-zinc-300">
      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
        Performance Inspector
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
        <PerfCard label="FPS (avg)" value={String(fps)} />
        <PerfCard label="Frame Time" value={`${frameMs} ms`} />
        <PerfCard label="Assets" value={String(assetsCount)} />
        <PerfCard label="Timeline Clips" value={String(clipCount)} />
        <PerfCard label="Tracks" value={String(trackCount)} />
        <PerfCard label="Queued Runs" value={String(queuedRunCount)} />
        <PerfCard label="Proxy Jobs" value={String(proxyPendingCount)} />
        <PerfCard label="Project Busy" value={isProjectBusy ? "YES" : "NO"} />
        <PerfCard
          label="JS Heap"
          value={heapUsedMb === null || heapTotalMb === null ? "n/a" : `${heapUsedMb} / ${heapTotalMb} MB`}
          wide
        />
      </div>
      <p className="mt-3 text-[10px] text-zinc-500">
        Live telemetry aus Renderer-State. Werte aktualisieren sich laufend.
      </p>
    </div>
  );
}

function PerfCard(props: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-[#111114] px-3 py-2 ${
        props.wide ? "col-span-2" : ""
      }`}
    >
      <div className="text-[8px] uppercase tracking-[0.15em] text-zinc-500">{props.label}</div>
      <div className="mt-1 text-xs font-black text-zinc-200">{props.value}</div>
    </div>
  );
}

function VoiceView() {
  return (
    <div className="h-full p-6 text-zinc-300">
      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
        Voice (Local)
      </h2>
      <p className="mt-2 text-xs text-zinc-500">
        Later: local TTS/SVC pipeline, no cloud usage.
      </p>
    </div>
  );
}

type ActiveView = "studio" | "voice" | "gallery" | "lab" | "settings";
type AutosaveFilter = "all" | "manual" | "autosave";
const AUTO_SAVE_INTERVAL_MS = 30_000;
const SHARE_SNAPSHOT_STATUS_RESET_MS = 2_500;
const OPEN_SNAPSHOT_STATUS_RESET_MS = 2_500;

interface SnapshotResultDetail {
  source: "timeline" | "header";
  success: boolean;
  message: string;
  path?: string;
  clipboardCopied?: boolean;
}

function formatSnapshotDate(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return iso;
  }
  return value.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function AppShell() {
  const [activeView, setActiveView] = useState<ActiveView>("studio");
  const [didAttemptSessionRestore, setDidAttemptSessionRestore] = useState(false);
  const [isAutosaveDialogOpen, setIsAutosaveDialogOpen] = useState(false);
  const [isAutosaveDialogBusy, setIsAutosaveDialogBusy] = useState(false);
  const [autosaveSnapshots, setAutosaveSnapshots] = useState<ProjectAutosaveSnapshot[]>([]);
  const [selectedAutosaveFileName, setSelectedAutosaveFileName] = useState<string | null>(null);
  const [autosaveFilter, setAutosaveFilter] = useState<AutosaveFilter>("all");
  const [shareSnapshotStatus, setShareSnapshotStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [openSnapshotStatus, setOpenSnapshotStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [shareMetrics, setShareMetrics] = useState<ShareSnapshotMetrics>(() => readShareSnapshotMetrics());
  const [lastSharedSnapshotPath, setLastSharedSnapshotPath] = useState<string | null>(null);

  const {
    pastCount,
    futureCount,
    undoUi,
    redoUi,
    projectName,
    projectMessage,
    isProjectBusy,
    isDirty,
    hasProject,
    comfyOnline,
    ffmpegStatus,
    lastError,
    clearLastError,
    checkComfyHealth,
    bindComfyRunEvents,
    checkFfmpegHealth,
    newProject,
    loadProject,
    restoreLastSession,
    listProjectAutosaves,
    restoreProjectAutosave,
    saveProject,
  } = useStudioStore(useShallow(selectAppShellStoreState));

  useEffect(() => {
    bindComfyRunEvents();
    void checkComfyHealth();
  }, [bindComfyRunEvents, checkComfyHealth]);

  useEffect(() => {
    void checkFfmpegHealth();
  }, [checkFfmpegHealth]);

  useEffect(() => {
    if (didAttemptSessionRestore || hasProject) {
      return;
    }

    setDidAttemptSessionRestore(true);
    void restoreLastSession();
  }, [didAttemptSessionRestore, hasProject, restoreLastSession]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      const state = useStudioStore.getState();
      if (!state.project || !state.isDirty || state.isProjectBusy) {
        return;
      }
      void state.saveProject("autosave");
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (futureCount > 0) {
            redoUi();
          }
        } else if (pastCount > 0) {
          undoUi();
        }
      } else if (e.key.toLowerCase() === "y" && futureCount > 0) {
        redoUi();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isProjectBusy && hasProject) {
          void saveProject();
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [futureCount, hasProject, isProjectBusy, pastCount, redoUi, saveProject, undoUi]);

  useEffect(() => {
    if (!isAutosaveDialogOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isAutosaveDialogBusy) {
        setIsAutosaveDialogOpen(false);
      }
    };

    globalThis.addEventListener("keydown", handleEscape);
    return () => globalThis.removeEventListener("keydown", handleEscape);
  }, [isAutosaveDialogBusy, isAutosaveDialogOpen]);

  const filteredAutosaveSnapshots = autosaveSnapshots.filter((snapshot) => {
    if (autosaveFilter === "all") {
      return true;
    }
    return snapshot.reason === autosaveFilter;
  });

  useEffect(() => {
    if (!isAutosaveDialogOpen) {
      return;
    }

    if (filteredAutosaveSnapshots.length === 0) {
      setSelectedAutosaveFileName(null);
      return;
    }

    const selectionIsVisible = selectedAutosaveFileName
      ? filteredAutosaveSnapshots.some((snapshot) => snapshot.fileName === selectedAutosaveFileName)
      : false;
    if (selectionIsVisible) {
      return;
    }

    const first = filteredAutosaveSnapshots[0];
    if (first) {
      setSelectedAutosaveFileName(first.fileName);
    }
  }, [filteredAutosaveSnapshots, isAutosaveDialogOpen, selectedAutosaveFileName]);

  useEffect(() => {
    const onSnapshotResult = (event: Event) => {
      const detail = (event as CustomEvent<SnapshotResultDetail>).detail;
      if (!detail || detail.source !== "header") {
        return;
      }

      setShareSnapshotStatus(detail.success ? "success" : "error");
      setShareMetrics(readShareSnapshotMetrics());
      if (detail.success && detail.path) {
        setLastSharedSnapshotPath(detail.path);
      }
    };

    window.addEventListener("afs:snapshot-result", onSnapshotResult);
    return () => window.removeEventListener("afs:snapshot-result", onSnapshotResult);
  }, []);

  useEffect(() => {
    if (shareSnapshotStatus === "idle" || shareSnapshotStatus === "pending") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShareSnapshotStatus("idle");
    }, SHARE_SNAPSHOT_STATUS_RESET_MS);

    return () => window.clearTimeout(timeoutId);
  }, [shareSnapshotStatus]);

  useEffect(() => {
    if (openSnapshotStatus === "idle" || openSnapshotStatus === "pending") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpenSnapshotStatus("idle");
    }, OPEN_SNAPSHOT_STATUS_RESET_MS);

    return () => window.clearTimeout(timeoutId);
  }, [openSnapshotStatus]);

  const handleOpenAutosaveDialog = async () => {
    if (isProjectBusy || !hasProject) {
      return;
    }

    setIsAutosaveDialogBusy(true);
    const response = await listProjectAutosaves();
    setIsAutosaveDialogBusy(false);
    if (!response.success) {
      useStudioStore.setState({ lastError: response.message, projectMessage: response.message });
      return;
    }
    if (response.snapshots.length === 0) {
      useStudioStore.setState({ projectMessage: response.message });
      return;
    }

    const limited = response.snapshots.slice(0, 20);
    const first = limited[0];
    if (!first) {
      return;
    }

    setAutosaveSnapshots(limited);
    setAutosaveFilter("all");
    setSelectedAutosaveFileName(first.fileName);
    setIsAutosaveDialogOpen(true);
  };

  const closeAutosaveDialog = () => {
    if (isAutosaveDialogBusy) {
      return;
    }

    setIsAutosaveDialogOpen(false);
    setAutosaveSnapshots([]);
    setSelectedAutosaveFileName(null);
    setAutosaveFilter("all");
  };

  const handleRestoreSelectedAutosave = async () => {
    const fileName = selectedAutosaveFileName;
    if (!fileName || isAutosaveDialogBusy) {
      return;
    }

    setIsAutosaveDialogBusy(true);
    const success = await restoreProjectAutosave(fileName);
    setIsAutosaveDialogBusy(false);

    if (success) {
      closeAutosaveDialog();
    }
  };

  const handleShareSnapshot = () => {
    if (isProjectBusy || !hasProject) {
      return;
    }

    setShareSnapshotStatus("pending");
    window.dispatchEvent(
      new CustomEvent("afs:timeline-snapshot", {
        detail: {
          source: "header",
          copyPathToClipboard: true,
        },
      }),
    );
  };

  const handleOpenSnapshotFolder = async () => {
    const snapshotPath = lastSharedSnapshotPath;
    if (!snapshotPath || isProjectBusy || !hasProject) {
      return;
    }

    setOpenSnapshotStatus("pending");
    recordShareSnapshotMetric("share_snapshot_open_click");
    setShareMetrics(readShareSnapshotMetrics());

    try {
      const response = await getIpcClient().revealPreviewSnapshot({ path: snapshotPath });
      if (!response.success) {
        setOpenSnapshotStatus("error");
        useStudioStore.setState({ lastError: response.message, projectMessage: response.message });
        return;
      }

      recordShareSnapshotMetric("share_snapshot_open_success");
      setShareMetrics(readShareSnapshotMetrics());
      setOpenSnapshotStatus("success");
      useStudioStore.setState({ projectMessage: response.message });
    } catch (error) {
      const message = `Snapshot folder open failed: ${error instanceof Error ? error.message : String(error)}`;
      setOpenSnapshotStatus("error");
      useStudioStore.setState({ lastError: message, projectMessage: message });
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-[#050506] text-zinc-100 select-none font-sans overflow-hidden">
      <header className="h-14 border-b border-[#1a1a1e] bg-[#0d0d0f] flex items-center justify-between px-6 shrink-0 z-50">
          <div className="flex items-center gap-8 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white italic shadow-lg shadow-blue-500/20">
                S
              </div>
              <div className="flex flex-col min-w-0">
                <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                  SceneEditor <span className="text-blue-500">Local</span>
                </h1>
                <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1 truncate">
                  <Database size={8} /> {projectName}{isDirty ? " *" : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center bg-[#050506] rounded-xl p-1 border border-[#1a1a1e]">
              <NavBtn
                active={activeView === "studio"}
                onClick={() => setActiveView("studio")}
                icon={<Layout size={14} />}
                label="Studio"
              />
              <NavBtn
                active={activeView === "voice"}
                onClick={() => setActiveView("voice")}
                icon={<Mic size={14} />}
                label="Voice"
              />
              <NavBtn
                active={activeView === "lab"}
                onClick={() => setActiveView("lab")}
                icon={<FlaskConical size={14} />}
                label="WF Studio"
              />
              <NavBtn
                active={activeView === "gallery"}
                onClick={() => setActiveView("gallery")}
                icon={<Images size={14} />}
                label="Gallery"
              />
              <NavBtn
                active={activeView === "settings"}
                onClick={() => setActiveView("settings")}
                icon={<Settings size={14} />}
                label="Configs"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1 bg-[#1a1a1e] rounded-lg p-1 border border-white/5">
              <button
                onClick={() => void newProject()}
                disabled={isProjectBusy}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                title="New Project"
              >
                <FolderPlus size={14} />
              </button>
              <button
                onClick={() => void loadProject()}
                disabled={isProjectBusy}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                title="Load Project"
              >
                <FolderOpen size={14} />
              </button>
              <button
                onClick={() => void saveProject()}
                disabled={isProjectBusy || !hasProject}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                title={hasProject ? "Save Project (Ctrl+S)" : "Load or create a project first"}
              >
                <Save size={14} />
              </button>
              <button
                onClick={() => void handleOpenAutosaveDialog()}
                disabled={isProjectBusy || !hasProject}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                title={hasProject ? "Restore Autosave Snapshot" : "Load or create a project first"}
              >
                <History size={14} />
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#1a1a1e] rounded-lg p-1 border border-white/5">
              <button
                onClick={() => {
                  if (pastCount > 0) {
                    undoUi();
                  }
                }}
                disabled={pastCount === 0}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={() => {
                  if (futureCount > 0) {
                    redoUi();
                  }
                }}
                disabled={futureCount === 0}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={14} />
              </button>
            </div>

            <div className="flex items-center gap-4 bg-[#1a1a1e]/50 px-3 py-1.5 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    comfyOnline ? "bg-green-500" : "bg-red-500"
                  } animate-pulse`}
                />
                <span className="text-[8px] font-black uppercase text-zinc-500">
                  Comfy Bridge
                </span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-2 text-blue-500">
                <Cpu size={10} />
                <span className="text-[8px] font-black uppercase">Local GPU</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    ffmpegStatus.available === null
                      ? "bg-zinc-500"
                      : ffmpegStatus.available
                        ? "bg-emerald-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="text-[8px] font-black uppercase text-zinc-500">
                  FFmpeg {ffmpegStatus.available === null ? "check" : ffmpegStatus.available ? "ready" : "offline"}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                void handleOpenSnapshotFolder();
              }}
              disabled={isProjectBusy || !hasProject || !lastSharedSnapshotPath || openSnapshotStatus === "pending"}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1e] text-zinc-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95 border border-white/5"
              title={`Open latest shared snapshot folder (opened ${shareMetrics.openSuccesses}/${shareMetrics.openClicks})`}
            >
              <FolderOpen size={12} />
              {openSnapshotStatus === "pending"
                ? "Opening..."
                : openSnapshotStatus === "success"
                  ? "Opened"
                  : openSnapshotStatus === "error"
                    ? "Retry Open"
                    : "Open Snapshot"}
            </button>

            <button
              onClick={handleShareSnapshot}
              disabled={isProjectBusy || !hasProject || shareSnapshotStatus === "pending"}
              className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-white/5"
              title={`Share snapshot (success ${shareMetrics.successes}/${shareMetrics.clicks})`}
            >
              <Share2 size={12} />
              {shareSnapshotStatus === "pending"
                ? "Sharing..."
                : shareSnapshotStatus === "success"
                  ? "Shared"
                  : shareSnapshotStatus === "error"
                    ? "Retry Share"
                    : "Share Snapshot"}
            </button>
          </div>
      </header>

      {lastError && (
        <div className="h-8 shrink-0 bg-red-500/10 border-b border-red-500/30 text-red-300 text-[10px] px-6 flex items-center justify-between">
          <span className="truncate">{lastError}</span>
          <button
            onClick={clearLastError}
            className="ml-4 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-[9px] uppercase tracking-widest"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 overflow-hidden min-h-0 relative">
        <div className={`h-full ${activeView === "studio" ? "flex" : "hidden"}`}>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex overflow-hidden">
              <AssetLibraryView />
              <div className="flex-1 flex flex-col min-w-0 border-x border-[#1a1a1e]">
                <PreviewStage />
              </div>
              <div className="w-[340px] hidden xl:flex shrink-0 flex-col border-l border-[#1a1a1e] bg-[#0c0c0e]">
                <div className="p-2 border-b border-white/5">
                  <PromptSceneGeneratorPanel />
                </div>
                <div className="min-h-0 flex-1">
                  <ComfyPanel />
                </div>
              </div>
            </div>
            <TimelineDock />
          </div>
        </div>

        <div className={`h-full ${activeView === "voice" ? "block" : "hidden"}`}>
          <VoiceView />
        </div>

        <div className={`h-full ${activeView === "lab" ? "block" : "hidden"}`}>
          <WorkflowStudioView />
        </div>

        <div className={`h-full ${activeView === "gallery" ? "block" : "hidden"}`}>
          <ComfyGalleryView />
        </div>

        <div className={`h-full ${activeView === "settings" ? "block" : "hidden"}`}>
          <SettingsView />
        </div>
      </main>

      {isAutosaveDialogOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
          <div className="w-[680px] max-w-[95vw] max-h-[80vh] overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-2xl shadow-black/60">
            <div className="border-b border-zinc-800 px-5 py-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-200">
                Restore Autosave Snapshot
              </h3>
              <p className="mt-1 text-[10px] text-zinc-500">
                Select a snapshot to restore your project state.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {(["all", "manual", "autosave"] as const).map((filterValue) => (
                  <button
                    key={filterValue}
                    type="button"
                    onClick={() => setAutosaveFilter(filterValue)}
                    className={`rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                      autosaveFilter === filterValue
                        ? "border-blue-500 bg-blue-500/15 text-blue-200"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {filterValue}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto px-3 py-3">
              {filteredAutosaveSnapshots.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-[#111114] px-4 py-8 text-center text-[10px] text-zinc-500">
                  No snapshots found for the selected filter.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAutosaveSnapshots.map((snapshot) => {
                  const isSelected = snapshot.fileName === selectedAutosaveFileName;
                  return (
                    <button
                      key={snapshot.fileName}
                      type="button"
                      onClick={() => setSelectedAutosaveFileName(snapshot.fileName)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-zinc-800 bg-[#111114] hover:border-zinc-700"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-zinc-200">{formatSnapshotDate(snapshot.createdAt)}</div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-500">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 uppercase tracking-widest text-[8px] text-zinc-300">
                          {snapshot.reason}
                        </span>
                        <span>{snapshot.fileName}</span>
                        <span>{formatBytes(snapshot.sizeBytes)}</span>
                      </div>
                    </button>
                  );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
              <button
                type="button"
                onClick={closeAutosaveDialog}
                disabled={isAutosaveDialogBusy}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRestoreSelectedAutosave()}
                disabled={isAutosaveDialogBusy || !selectedAutosaveFileName}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isAutosaveDialogBusy ? "Restoring..." : "Restore Selected"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="h-6 bg-[#0d0d0f] border-t border-[#1a1a1e] px-4 flex items-center justify-between text-[8px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-2">
            <Zap size={10} className="text-yellow-500" /> Neural Pipeline: UI
          </span>
          <span className="flex items-center gap-2 truncate max-w-[460px]">
            <Terminal size={10} /> {projectMessage}
          </span>
        </div>
        <div className="flex gap-6 items-center">
          <span className="text-zinc-500 italic">LOCAL-SHELL</span>
          <div className="w-24 h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-1/4" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavBtn(props: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const { active, onClick, icon, label } = props;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
        active
          ? "bg-[#1a1a1e] text-white shadow-md"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {icon} {label}
    </button>
  );
}
