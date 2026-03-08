import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Scissors, Trash2, X, Minus, Camera } from "lucide-react";
import type { Timeline, Track } from "@shared/types";

import { useShallow } from "zustand/shallow";

import { getIpcClient } from "../../core/adapters/ipcClient";
import { selectTimelineDockStoreState } from "../../core/store/selectors";
import { useStudioStore } from "../../core/store/studioStore";

const MIN_CLIP_DURATION = 0.1;
const SNAP_THRESHOLD_PX = 10;
const MIN_TIMELINE_HEIGHT_PX = 240;
const MAX_TIMELINE_HEIGHT_PX = 620;
const DEFAULT_TIMELINE_HEIGHT_PX = 320;
const DEFAULT_pixelsPerSecond = 40;
const MIN_pixelsPerSecond = 20;
const MAX_pixelsPerSecond = 160;

type DragMode = "move" | "trim-start" | "trim-end";

interface DragState {
  mode: DragMode;
  trackId: string;
  targetTrackId?: string;
  clipId: string;
  pointerStartX: number;
  pointerStartY: number;
  clipStart: number;
  clipDuration: number;
}

interface PreviewClipWindow {
  start: number;
  duration: number;
}

interface DragCommitWindow extends PreviewClipWindow {
  mode: DragMode;
}

export default function TimelineDock() {
  const {
    timeline,
    assets,
    droppedAssetIds: droppedAssets,
    selectedClip,
    lastError,
    currentTime,
    setCurrentTime,
    addTrack,
    dropAssetToTimeline,
    selectClip,
    clearClipSelection,
    nudgeSelectedClip,
    trimSelectedClip,
    slipSelectedClip,
    setSelectedClipGain,
    cutSelectedClipAtCurrentTime,
    removeSelectedClip,
    rippleRemoveSelectedClip,
    timelineMoveClip,
    timelineTrimClip,
    trackAudioMutedById,
    trackAudioSoloById,
    toggleTrackAudioMute,
    toggleTrackAudioSolo,
    clearTrackAudioMixStates,
  } = useStudioStore(useShallow(selectTimelineDockStoreState));

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDeltaPx, setDragDeltaPx] = useState(0);
  const [timelineHeightPx, setTimelineHeightPx] = useState(DEFAULT_TIMELINE_HEIGHT_PX);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_pixelsPerSecond);
  const [showTrackAddMenu, setShowTrackAddMenu] = useState(false);
  const [audioWaveformByAssetId, setAudioWaveformByAssetId] = useState<Record<string, number[]>>({});

  const leftTrackScrollRef = useRef<HTMLDivElement | null>(null);
  const rightTrackScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineResizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const assetById = useMemo(() => {
    const map = new Map<string, (typeof assets)[number]>();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  const assetNameById = useMemo(() => {
    const map = new Map<string, string>();
    assets.forEach((asset) => map.set(asset.id, asset.originalName));
    return map;
  }, [assets]);

  const snapThresholdSeconds = SNAP_THRESHOLD_PX / pixelsPerSecond;

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resize = timelineResizeStateRef.current;
      if (!resize) {
        return;
      }

      const deltaY = resize.startY - event.clientY;
      const nextHeight = Math.max(MIN_TIMELINE_HEIGHT_PX, Math.min(MAX_TIMELINE_HEIGHT_PX, resize.startHeight + deltaY));
      setTimelineHeightPx(nextHeight);
    };

    const handleMouseUp = () => {
      timelineResizeStateRef.current = null;
    };

    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const audioAssets = assets.filter((asset) => asset.type === "audio");
    if (audioAssets.length === 0) {
      return;
    }

    let cancelled = false;
    const loadPeaks = async () => {
      const ipc = getIpcClient();
      const updates: Record<string, number[]> = {};

      for (const asset of audioAssets) {
        if (audioWaveformByAssetId[asset.id]?.length) {
          continue;
        }

        try {
          const response = await ipc.getAudioWaveformPeaks(asset.filePath, 96);
          if (!cancelled && response.success && response.peaks.length > 0) {
            updates[asset.id] = response.peaks;
          }
        } catch {
          // best-effort; fallback waveform remains available
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setAudioWaveformByAssetId((current) => ({ ...current, ...updates }));
      }
    };

    void loadPeaks();
    return () => {
      cancelled = true;
    };
  }, [assets, audioWaveformByAssetId]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      setDragDeltaPx(event.clientX - dragState.pointerStartX);

      if (dragState.mode !== "move") {
        return;
      }

      const sourceTrack = getTrackById(timeline, dragState.trackId);
      if (!sourceTrack) {
        return;
      }

      const hovered = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-track-row-id]") as HTMLElement | null;
      const hoveredTrackId = hovered?.dataset.trackRowId;

      if (!hoveredTrackId) {
        return;
      }

      const candidateTrack = getTrackById(timeline, hoveredTrackId);
      const canMoveToTrack = candidateTrack && sourceTrack.kind === candidateTrack.kind;

      setDragState((current) => {
        if (!current) {
          return current;
        }

        const nextTargetTrackId = canMoveToTrack ? hoveredTrackId : current.trackId;
        if (current.targetTrackId === nextTargetTrackId) {
          return current;
        }

        return { ...current, targetTrackId: nextTargetTrackId };
      });
    };

    const handleMouseUp = () => {
      const deltaSeconds = roundToStep(dragDeltaPx / pixelsPerSecond, 0.05);
      if (Math.abs(deltaSeconds) > 0 || (dragState.mode === "move" && dragState.targetTrackId && dragState.targetTrackId !== dragState.trackId)) {
        const commit = resolveDragCommitWindow(timeline, dragState, deltaSeconds, snapThresholdSeconds);
        if (commit.mode === "move") {
          timelineMoveClip({
            sourceTrackId: dragState.trackId,
            clipId: dragState.clipId,
            start: commit.start,
            targetTrackId: dragState.targetTrackId && dragState.targetTrackId !== dragState.trackId ? dragState.targetTrackId : undefined,
          });
        } else if (commit.mode === "trim-start") {
          timelineTrimClip({
            trackId: dragState.trackId,
            clipId: dragState.clipId,
            startDelta: roundToStep(commit.start - dragState.clipStart, 0.05),
          });
        } else {
          timelineTrimClip({
            trackId: dragState.trackId,
            clipId: dragState.clipId,
            endDelta: roundToStep(dragState.clipDuration - commit.duration, 0.05),
          });
        }
      }

      setDragState(null);
      setDragDeltaPx(0);
    };

    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragDeltaPx, dragState, pixelsPerSecond, snapThresholdSeconds, timeline, timelineMoveClip, timelineTrimClip]);

  const totalClips = timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0);
  const hasAnyAudioMixOverrides = useMemo(
    () => Object.values(trackAudioMutedById).some(Boolean) || Object.values(trackAudioSoloById).some(Boolean),
    [trackAudioMutedById, trackAudioSoloById],
  );
  const maxEndSeconds = useMemo(() => {
    let maxEnd = 12;
    timeline.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        maxEnd = Math.max(maxEnd, clip.start + clip.duration + 1);
      });
    });
    return maxEnd;
  }, [timeline]);

  const timelineWidthPx = Math.max(900, Math.ceil(maxEndSeconds * pixelsPerSecond));
  const isClipSelected = selectedClip !== null;
  const selectedTimelineClip = useMemo(() => getSelectedTimelineClip(timeline, selectedClip), [selectedClip, timeline]);
  const canCutSelectedClip = useMemo(() => {
    if (!selectedTimelineClip) {
      return false;
    }

    const clipEnd = selectedTimelineClip.start + selectedTimelineClip.duration;
    const cutEpsilon = 1e-6;
    return currentTime > selectedTimelineClip.start + cutEpsilon && currentTime < clipEnd - cutEpsilon;
  }, [currentTime, selectedTimelineClip]);
  const canSlipSelectedClip = useMemo(() => {
    if (!selectedTimelineClip) {
      return false;
    }

    const asset = assets.find((candidate) => candidate.id === selectedTimelineClip.assetId);
    if (!asset || asset.type !== "video") {
      return false;
    }

    if (typeof asset.durationSeconds !== "number" || !Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0) {
      return true;
    }

    return asset.durationSeconds - selectedTimelineClip.duration > 1e-9;
  }, [assets, selectedTimelineClip]);
  const selectedAudioClipGain = useMemo(() => {
    if (!selectedTimelineClip) {
      return null;
    }
    const asset = assets.find((candidate) => candidate.id === selectedTimelineClip.assetId);
    if (!asset || asset.type !== "audio") {
      return null;
    }
    return selectedTimelineClip.gain ?? 1;
  }, [assets, selectedTimelineClip]);
  const handleAssetDrop = (event: React.DragEvent<HTMLDivElement>, targetTrackId?: string) => {
    event.preventDefault();
    event.stopPropagation();

    const payload = event.dataTransfer.getData("application/x-asset");
    if (!payload) return;

    try {
      const { assetId } = JSON.parse(payload) as { assetId: string };
      dropAssetToTimeline(assetId, targetTrackId);
    } catch {
      // ignore malformed drag payload
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedClip) {
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && event.shiftKey) {
        event.preventDefault();
        rippleRemoveSelectedClip();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelectedClip();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.altKey) {
          if (canSlipSelectedClip) {
            slipSelectedClip(-0.25);
          }
          return;
        }
        nudgeSelectedClip(-0.25);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.altKey) {
          if (canSlipSelectedClip) {
            slipSelectedClip(0.25);
          }
          return;
        }
        nudgeSelectedClip(0.25);
        return;
      }

      if ((event.ctrlKey && event.key === "[") || (event.ctrlKey && event.key === "]")) {
        event.preventDefault();
        if (!canSlipSelectedClip) {
          return;
        }
        slipSelectedClip(event.key === "[" ? -0.25 : 0.25);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "b" && canCutSelectedClip) {
        event.preventDefault();
        cutSelectedClipAtCurrentTime();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [
    canCutSelectedClip,
    canSlipSelectedClip,
    cutSelectedClipAtCurrentTime,
    nudgeSelectedClip,
    removeSelectedClip,
    rippleRemoveSelectedClip,
    slipSelectedClip,
    selectedClip,
  ]);

  const startDrag = (
    event: React.MouseEvent,
    mode: DragMode,
    trackId: string,
    clip: { id: string; start: number; duration: number },
  ) => {
    event.preventDefault();
    event.stopPropagation();
    selectClip(trackId, clip.id);
    setDragState({
      mode,
      trackId,
      targetTrackId: trackId,
      clipId: clip.id,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      clipStart: clip.start,
      clipDuration: clip.duration,
    });
    setDragDeltaPx(0);
  };

  const resolvePreviewWindow = (
    track: Track,
    trackId: string,
    clipId: string,
    start: number,
    duration: number,
  ): PreviewClipWindow => {
    if (!dragState || dragState.clipId !== clipId) {
      return { start, duration };
    }

    const activeTrackId = dragState.mode === "move" ? dragState.targetTrackId ?? dragState.trackId : dragState.trackId;
    if (activeTrackId !== trackId) {
      return { start, duration };
    }

    const deltaSeconds = dragDeltaPx / pixelsPerSecond;
    return resolveDragPreviewWindow(track, dragState, deltaSeconds, snapThresholdSeconds);
  };

  return (
    <div className="bg-[#0d0d0f] border-t border-[#1a1a1e] flex relative" style={{ height: `${timelineHeightPx}px` }}>
      <div
        className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-20"
        onMouseDown={(event) => {
          event.preventDefault();
          timelineResizeStateRef.current = { startY: event.clientY, startHeight: timelineHeightPx };
        }}
      />
      <div className="w-56 border-r border-[#1a1a1e] p-3 shrink-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tracks</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!hasAnyAudioMixOverrides}
              onClick={clearTrackAudioMixStates}
              className="px-2 py-1 rounded-lg bg-zinc-900/40 border border-white/5 text-[8px] font-black uppercase tracking-wider text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
              title="Clear all audio M/S states"
            >
              Clear M/S
            </button>
            <div className="relative">
              <button
                className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white transition-all"
                title="Add Track"
                onClick={() => setShowTrackAddMenu((current) => !current)}
              >
                <Plus size={14} />
              </button>
              {showTrackAddMenu && (
                <div className="absolute right-0 mt-1 w-28 rounded-lg border border-white/10 bg-zinc-950 shadow-xl z-20 p-1">
                  <button
                    className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-zinc-800 text-zinc-200"
                    onClick={() => {
                      addTrack("video");
                      setShowTrackAddMenu(false);
                    }}
                  >
                    + Video Track
                  </button>
                  <button
                    className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-zinc-800 text-zinc-200"
                    onClick={() => {
                      addTrack("audio");
                      setShowTrackAddMenu(false);
                    }}
                  >
                    + Audio Track
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-3 overflow-y-auto no-scrollbar pr-1 flex-1"
          ref={leftTrackScrollRef}
          onWheel={(event) => {
            const right = rightTrackScrollRef.current;
            if (!right) {
              return;
            }
            event.preventDefault();
            right.scrollTop += event.deltaY;
          }}
        >
          <div className="h-8 border-b border-zinc-900/60" />
          {timeline.tracks.map((track) => (
            <div
              key={track.id}
              className="h-14 px-3 py-2 border-b border-zinc-900/60 bg-zinc-900/30 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="truncate">{track.name}</div>
                <div className="text-[8px] text-zinc-600 mt-1 normal-case tracking-normal">{track.clips.length} clips</div>
              </div>
              {track.kind === "audio" && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleTrackAudioMute(track.id)}
                    className={`px-2 py-0.5 rounded-md border text-[8px] tracking-wider ${trackAudioMutedById[track.id] ? "border-red-400/30 bg-red-500/10 text-red-300" : "border-white/10 bg-zinc-950/60 text-zinc-400"}`}
                    title="Mute audio track"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTrackAudioSolo(track.id)}
                    className={`px-2 py-0.5 rounded-md border text-[8px] tracking-wider ${trackAudioSoloById[track.id] ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-white/10 bg-zinc-950/60 text-zinc-400"}`}
                    title="Solo audio track"
                  >
                    S
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Timeline</div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/40 px-1 py-0.5">
              <button
                className="p-1 text-zinc-400 hover:text-white disabled:opacity-40"
                disabled={pixelsPerSecond <= MIN_pixelsPerSecond}
                onClick={() => setPixelsPerSecond((current) => Math.max(MIN_pixelsPerSecond, current - 10))}
                title="Zoom out"
              >
                <Minus size={12} />
              </button>
              <span className="text-[9px] font-mono text-zinc-300 w-10 text-center">{Math.round((pixelsPerSecond / DEFAULT_pixelsPerSecond) * 100)}%</span>
              <button
                className="p-1 text-zinc-400 hover:text-white disabled:opacity-40"
                disabled={pixelsPerSecond >= MAX_pixelsPerSecond}
                onClick={() => setPixelsPerSecond((current) => Math.min(MAX_pixelsPerSecond, current + 10))}
                title="Zoom in"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={!isClipSelected}
              onClick={() => nudgeSelectedClip(-0.25)}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
              title="Nudge Left"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={!isClipSelected}
              onClick={() => nudgeSelectedClip(0.25)}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
              title="Nudge Right"
            >
              <ChevronRight size={14} />
            </button>
            <button
              disabled={!canSlipSelectedClip}
              onClick={() => slipSelectedClip(-0.25)}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-cyan-300 disabled:opacity-30 transition-all"
              title="Slip Backward (Alt+Left or Ctrl+[)"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={!canSlipSelectedClip}
              onClick={() => slipSelectedClip(0.25)}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-cyan-300 disabled:opacity-30 transition-all"
              title="Slip Forward (Alt+Right or Ctrl+])"
            >
              <ChevronRight size={14} />
            </button>
            {selectedAudioClipGain !== null && Number.isFinite(selectedAudioClipGain) && (
              <>
                <button
                  disabled={selectedAudioClipGain <= 0}
                  onClick={() => setSelectedClipGain(Math.max(0, selectedAudioClipGain - 0.1))}
                  className="px-2 py-1 rounded-lg bg-zinc-900/40 border border-white/5 text-[10px] font-black tracking-wider text-violet-300 hover:text-violet-200 disabled:opacity-40 transition-all"
                  title="Audio Gain -0.1"
                >
                  -VOL
                </button>
                <div className="px-2 py-1 rounded-lg border border-violet-400/20 bg-violet-500/10 text-[10px] font-mono text-violet-200">
                  {(Math.max(0, Math.min(1, selectedAudioClipGain)) * 100).toFixed(0)}%
                </div>
                <button
                  disabled={selectedAudioClipGain >= 1}
                  onClick={() => {
                    if (!Number.isFinite(selectedAudioClipGain) || selectedAudioClipGain >= 1) {
                      return;
                    }
                    setSelectedClipGain(Math.min(1, selectedAudioClipGain + 0.1));
                  }}
                  className="px-2 py-1 rounded-lg bg-zinc-900/40 border border-white/5 text-[10px] font-black tracking-wider text-violet-300 hover:text-violet-200 disabled:opacity-40 transition-all"
                  title="Audio Gain +0.1"
                >
                  +VOL
                </button>
              </>
            )}
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("afs:timeline-snapshot", {
                    detail: { source: "timeline", copyPathToClipboard: false },
                  }),
                )
              }
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-emerald-300 transition-all"
              title="Snapshot am Playhead speichern"
            >
              <Camera size={14} />
            </button>
            <button
              disabled={!isClipSelected}
              onClick={() => trimSelectedClip(0.1, 0)}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
              title="Trim In"
            >
              <Scissors size={14} />
            </button>
            <button
              disabled={!isClipSelected}
              onClick={() => trimSelectedClip(0, 0.1)}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
              title="Trim Out"
            >
              <Scissors size={14} />
            </button>
            <button
              disabled={!canCutSelectedClip}
              onClick={cutSelectedClipAtCurrentTime}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-amber-300 disabled:opacity-30 transition-all"
              title="Cut at Playhead (Ctrl+B)"
            >
              <Scissors size={14} />
            </button>
            <button
              disabled={!isClipSelected}
              onClick={removeSelectedClip}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-red-400 disabled:opacity-30 transition-all"
              title="Remove Clip"
            >
              <Trash2 size={14} />
            </button>
            <button
              disabled={!isClipSelected}
              onClick={rippleRemoveSelectedClip}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-orange-300 disabled:opacity-30 transition-all"
              title="Ripple Delete (Shift+Delete)"
            >
              <Trash2 size={14} />
            </button>
            <button
              disabled={!isClipSelected}
              onClick={clearClipSelection}
              className="p-1.5 rounded-lg bg-zinc-900/40 border border-white/5 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
              title="Clear Selection"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div
          className="mt-3 flex-1 rounded-2xl border border-[#1a1a1e] bg-[#050506] overflow-auto relative"
          ref={rightTrackScrollRef}
          onScroll={(event) => {
            const left = leftTrackScrollRef.current;
            if (left) {
              left.scrollTop = event.currentTarget.scrollTop;
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleAssetDrop(e)}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              clearClipSelection();
            }
          }}
        >
          <div style={{ width: `${timelineWidthPx}px` }} className="min-h-full">
            <div
              className="h-8 border-b border-zinc-900 relative bg-zinc-950/40 cursor-pointer"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left + event.currentTarget.scrollLeft;
                setCurrentTime(x / pixelsPerSecond);
              }}
            >
              {Array.from({ length: Math.ceil(maxEndSeconds) + 1 }).map((_, second) => (
                <div
                  key={second}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${second * pixelsPerSecond}px` }}
                >
                  <div className="absolute top-0 bottom-0 w-px bg-zinc-800" />
                  <span className="absolute top-1 left-1 text-[9px] text-zinc-600 font-mono">{second}s</span>
                </div>
              ))}
            </div>

            {timeline.tracks.map((track) => (
              <div
                key={track.id}
                data-track-row-id={track.id}
                className="h-14 border-b border-zinc-900/60 relative"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleAssetDrop(e, track.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.target === e.currentTarget) {
                    clearClipSelection();
                  }
                }}
              >
                {track.clips.map((clip) => {
                  const preview = resolvePreviewWindow(track, track.id, clip.id, clip.start, clip.duration);
                  const left = preview.start * pixelsPerSecond;
                  const width = Math.max(28, preview.duration * pixelsPerSecond);
                  const selected = selectedClip?.trackId === track.id && selectedClip?.clipId === clip.id;
                  const assetType = assetById.get(clip.assetId)?.type;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectClip(track.id, clip.id);
                      }}
                      onMouseDown={(e) => startDrag(e, "move", track.id, clip)}
                      className={`absolute top-2 h-10 rounded-lg border px-3 text-left overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
                        selected
                          ? "border-blue-400 bg-blue-600/25 text-blue-100 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]"
                          : "border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-zinc-500"
                      }`}
                      style={{ left: `${left}px`, width: `${width}px` }}
                      title={`${assetNameById.get(clip.assetId) ?? clip.assetId} (${preview.start.toFixed(2)}s, ${preview.duration.toFixed(2)}s)`}
                    >
                      <button
                        type="button"
                        className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400/40 cursor-ew-resize"
                        onMouseDown={(e) => startDrag(e, "trim-start", track.id, clip)}
                        title="Trim Start"
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-400/40 cursor-ew-resize"
                        onMouseDown={(e) => startDrag(e, "trim-end", track.id, clip)}
                        title="Trim End"
                      />

                      {assetType === "audio" && (
                        <div className="absolute inset-x-2 bottom-1.5 top-4 flex items-end gap-[2px] opacity-70 pointer-events-none">
                          {buildAudioWaveformBars(
                            clip.id,
                            Math.max(12, Math.min(72, Math.floor(width / 6))),
                            audioWaveformByAssetId[clip.assetId],
                          ).map((value, index) => (
                            <div
                              key={`${clip.id}_bar_${index}`}
                              className="flex-1 rounded-sm bg-violet-300/70"
                              style={{ height: `${Math.max(12, Math.round(value * 100))}%` }}
                            />
                          ))}
                        </div>
                      )}

                      <div className="truncate text-[10px] font-bold pointer-events-none relative z-10">
                        {assetNameById.get(clip.assetId) ?? clip.assetId}
                      </div>
                      <div className="truncate text-[8px] text-zinc-500 font-mono pointer-events-none relative z-10">
                        {preview.start.toFixed(2)}s - {(preview.start + preview.duration).toFixed(2)}s | off {clip.offset.toFixed(2)}s
                        {assetType === "audio" ? ` | vol ${Math.round((clip.gain ?? 1) * 100)}%` : ""}
                      </div>
                    </div>
                  );
                })}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-blue-500/80 pointer-events-none"
                  style={{ left: `${currentTime * pixelsPerSecond}px` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
          <span>Clips: {totalClips}</span>
          <span className="truncate max-w-[65%]">
            {dragState ? "Drag body = Move, edges = Trim" : droppedAssets.length > 0 ? `Recent drops: ${droppedAssets.join(" - ")}` : "Drop assets from library into timeline"}
          </span>
        </div>
        {lastError && <div className="mt-1 text-[10px] text-red-400 truncate">Timeline error: {lastError}</div>}
      </div>
    </div>
  );
}

function getSelectedTimelineClip(
  timeline: Timeline,
  selectedClip: { trackId: string; clipId: string } | null,
): { assetId: string; start: number; duration: number; offset: number; gain?: number } | null {
  if (!selectedClip) {
    return null;
  }

  const track = timeline.tracks.find((candidate) => candidate.id === selectedClip.trackId);
  if (!track) {
    return null;
  }

  const clip = track.clips.find((candidate) => candidate.id === selectedClip.clipId);
  if (!clip) {
    return null;
  }

  return {
    assetId: clip.assetId,
    start: clip.start,
    duration: clip.duration,
    offset: clip.offset,
    gain: clip.gain,
  };
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function resolveDragCommitWindow(
  timeline: Timeline,
  dragState: DragState,
  deltaSeconds: number,
  snapThresholdSeconds: number,
): DragCommitWindow {
  const trackId = dragState.mode === "move" ? dragState.targetTrackId ?? dragState.trackId : dragState.trackId;
  const track = getTrackById(timeline, trackId);
  if (!track) {
    return {
      mode: dragState.mode,
      start: dragState.clipStart,
      duration: dragState.clipDuration,
    };
  }

  const preview = resolveDragPreviewWindow(track, dragState, deltaSeconds, snapThresholdSeconds);
  return {
    mode: dragState.mode,
    start: roundToStep(preview.start, 0.05),
    duration: roundToStep(preview.duration, 0.05),
  };
}

function resolveDragPreviewWindow(
  track: Track,
  dragState: DragState,
  deltaSeconds: number,
  snapThresholdSeconds: number,
): PreviewClipWindow {
  if (dragState.mode === "move") {
    const rawStart = Math.max(0, dragState.clipStart + deltaSeconds);
    const snappedStart = snapTime(rawStart, getTrackSnapPoints(track, dragState.clipId), snapThresholdSeconds);
    return {
      start: snappedStart,
      duration: dragState.clipDuration,
    };
  }

  if (dragState.mode === "trim-start") {
    const maxStart = dragState.clipStart + dragState.clipDuration - MIN_CLIP_DURATION;
    const rawStart = clamp(dragState.clipStart + deltaSeconds, 0, maxStart);
    const snapPoints = getTrackSnapPoints(track, dragState.clipId).filter((point) => point >= 0 && point <= maxStart);
    const snappedStart = snapTime(rawStart, snapPoints, snapThresholdSeconds);
    return {
      start: snappedStart,
      duration: Math.max(MIN_CLIP_DURATION, dragState.clipDuration - (snappedStart - dragState.clipStart)),
    };
  }

  const minEnd = dragState.clipStart + MIN_CLIP_DURATION;
  const rawEnd = Math.max(minEnd, dragState.clipStart + dragState.clipDuration + deltaSeconds);
  const snapPoints = getTrackSnapPoints(track, dragState.clipId).filter((point) => point >= minEnd);
  const snappedEnd = snapTime(rawEnd, snapPoints, snapThresholdSeconds);
  return {
    start: dragState.clipStart,
    duration: Math.max(MIN_CLIP_DURATION, snappedEnd - dragState.clipStart),
  };
}

function getTrackSnapPoints(track: Track, excludedClipId: string): number[] {
  const points = new Set<number>([0]);
  track.clips.forEach((clip) => {
    if (clip.id === excludedClipId) {
      return;
    }
    points.add(clip.start);
    points.add(clip.start + clip.duration);
  });
  return [...points];
}

function snapTime(value: number, points: readonly number[], threshold: number): number {
  let snapped = value;
  let bestDistance = threshold + Number.EPSILON;
  points.forEach((point) => {
    const distance = Math.abs(value - point);
    if (distance <= threshold && distance < bestDistance) {
      bestDistance = distance;
      snapped = point;
    }
  });
  return snapped;
}

function getTrackById(timeline: Timeline, trackId: string): Track | null {
  return timeline.tracks.find((track) => track.id === trackId) ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildAudioWaveformBars(seed: string, count: number, peaks?: number[]): number[] {
  if (Array.isArray(peaks) && peaks.length > 0) {
    return resamplePeaks(peaks, count);
  }

  const values: number[] = [];
  let state = hashString(seed);
  for (let index = 0; index < count; index += 1) {
    state = xorshift32(state + index + 1);
    const normalized = Math.abs(state % 10_000) / 10_000;
    const shaped = 0.15 + normalized * 0.85;
    values.push(shaped);
  }
  return values;
}

function resamplePeaks(peaks: number[], count: number): number[] {
  if (count <= 0) {
    return [];
  }
  if (peaks.length === count) {
    return peaks;
  }

  const out = Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * peaks.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * peaks.length));
    let max = 0;
    for (let i = start; i < end && i < peaks.length; i += 1) {
      max = Math.max(max, peaks[i] ?? 0);
    }
    return max;
  });

  return out;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

function xorshift32(value: number): number {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}
