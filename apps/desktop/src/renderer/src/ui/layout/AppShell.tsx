import React, { useEffect, useState } from "react";
import {
  Layout,
  FlaskConical,
  Settings,
  Terminal,
  Cpu,
  Database,
  Zap,
  Undo2,
  Redo2,
  Mic,
  Images,
  FolderPlus,
  FolderOpen,
  Save,
} from "lucide-react";
import { useShallow } from "zustand/shallow";

import AssetLibraryView from "../../features/assets/AssetLibraryView";
import PreviewStage from "../../features/preview/PreviewStage";
import ComfyPanel from "../../features/comfy/ComfyPanel";
import TimelineDock from "../../features/timeline/TimelineDock";
import WorkflowStudioView from "../../features/workflows/WorkflowStudioView";
import ComfyGalleryView from "../../features/gallery/ComfyGalleryView";
import { selectAppShellStoreState } from "../../core/store/selectors";
import { useStudioStore } from "../../core/store/studioStore";

function SettingsView() {
  return (
    <div className="h-full p-6 text-zinc-300">
      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">
        Settings
      </h2>
      <p className="mt-2 text-xs text-zinc-500">
        Coming later. Local-only workflow configuration.
      </p>
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

export default function AppShell() {
  const [activeView, setActiveView] = useState<ActiveView>("studio");

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

  return (
    <div className="flex flex-col h-screen bg-[#050506] text-zinc-100 select-none font-sans overflow-hidden">
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
              disabled={isProjectBusy}
              className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-50 transition-all active:scale-95 shadow-xl shadow-white/5"
            >
              Render Scene
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

      <main className="flex-1 flex overflow-hidden min-h-0">
        {activeView === "studio" ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex overflow-hidden">
              <AssetLibraryView />
              <div className="flex-1 flex flex-col min-w-0 border-x border-[#1a1a1e]">
                <PreviewStage />
              </div>
              <div className="w-[340px] hidden xl:block shrink-0">
                <ComfyPanel />
              </div>
            </div>
            <TimelineDock />
          </div>
        ) : activeView === "voice" ? (
          <VoiceView />
        ) : activeView === "lab" ? (
          <WorkflowStudioView />
        ) : activeView === "gallery" ? (
          <ComfyGalleryView />
        ) : (
          <SettingsView />
        )}
      </main>

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
