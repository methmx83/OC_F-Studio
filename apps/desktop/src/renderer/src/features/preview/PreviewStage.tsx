import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, Maximize, Zap, Play, Pause, SkipBack } from "lucide-react";
import type { Asset, Clip, Timeline, Track } from "@shared/types";
import { useShallow } from "zustand/shallow";

import { getIpcClient } from "../../core/adapters/ipcClient";
import { selectPreviewStageStoreState } from "../../core/store/selectors";
import { useStudioStore } from "../../core/store/studioStore";

interface ActiveClipRef {
  trackId: string;
  trackIndex: number;
  clip: Clip;
  trackKind: Track["kind"];
}

const TRACK_PREVIEW_PRIORITY: Record<Track["kind"], number> = {
  video: 0,
  overlay: 1,
  text: 2,
  audio: 3,
};

export default function PreviewStage() {
  const {
    proxyMode,
    annotating,
    timeline,
    assets,
    isPlaying,
    currentTime,
    proxyPathByAssetId,
    proxyPendingByAssetId,
    ffmpegStatus,
    toggleProxyMode,
    toggleAnnotating,
    togglePlayback,
    setCurrentTime,
    stepPlayback,
    ensureVideoProxy,
    trackAudioMutedById,
    trackAudioSoloById,
  } = useStudioStore(useShallow(selectPreviewStageStoreState));

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioElementByClipIdRef = useRef<Record<string, HTMLAudioElement | null>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioMeterRafRef = useRef<number | null>(null);
  const [audioMeterBars, setAudioMeterBars] = useState<number[]>(() => Array.from({ length: 20 }, () => 0));
  const [sourceUrlCache, setSourceUrlCache] = useState<Record<string, string | null>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [lockedClipId, setLockedClipId] = useState<string | null>(null);
  const [lockedSourceRelativePath, setLockedSourceRelativePath] = useState<string | null>(null);
  const [proxyBypassByAssetId, setProxyBypassByAssetId] = useState<Record<string, boolean>>({});

  const timelineEnd = useMemo(() => {
    let maxEnd = 0;
    timeline.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        maxEnd = Math.max(maxEnd, clip.start + clip.duration);
      });
    });
    return maxEnd;
  }, [timeline]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        globalThis.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastTickRef.current === 0) {
        lastTickRef.current = now;
      }

      const deltaSeconds = Math.max(0, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      stepPlayback(deltaSeconds);
      rafRef.current = globalThis.requestAnimationFrame(tick);
    };

    rafRef.current = globalThis.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        globalThis.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      lastTickRef.current = 0;
    };
  }, [isPlaying, stepPlayback]);

  const progress = timelineEnd > 0 ? Math.min(1, currentTime / timelineEnd) : 0;
  const assetById = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);
  const activeClip = useMemo(
    () => resolveActiveClip(timeline, currentTime, trackAudioMutedById, trackAudioSoloById),
    [timeline, currentTime, trackAudioMutedById, trackAudioSoloById],
  );
  const activeAsset = useMemo(() => {
    if (!activeClip) {
      return null;
    }

    return assetById.get(activeClip.clip.assetId) ?? null;
  }, [activeClip, assetById]);
  const activeAudioClips = useMemo(
    () => resolveActiveAudioClips(timeline, currentTime, trackAudioMutedById, trackAudioSoloById),
    [timeline, currentTime, trackAudioMutedById, trackAudioSoloById],
  );
  const activeAudioPlaybackItems = useMemo(() => {
    return activeAudioClips
      .map((clipRef) => {
        const asset = assetById.get(clipRef.clip.assetId);
        if (!asset || asset.type !== "audio") {
          return null;
        }
        const clipLocalTime = Math.max(0, clipRef.clip.offset + (currentTime - clipRef.clip.start));
        return {
          clipId: clipRef.clip.id,
          asset,
          sourceRelativePath: asset.filePath,
          clipLocalTime,
          gain: clipRef.clip.gain ?? 1,
        };
      })
      .filter((item): item is { clipId: string; asset: Asset; sourceRelativePath: string; clipLocalTime: number; gain: number } => Boolean(item));
  }, [activeAudioClips, assetById, currentTime]);
  const activeProxyPath = activeAsset ? (proxyPathByAssetId[activeAsset.id] ?? null) : null;
  const activeProxyPending = activeAsset ? Boolean(proxyPendingByAssetId[activeAsset.id]) : false;
  const shouldUseProxyForActiveAsset = Boolean(
    activeAsset
      && activeAsset.type === "video"
      && proxyMode
      && ffmpegStatus.available === true
      && activeProxyPath
      && !proxyBypassByAssetId[activeAsset.id],
  );
  const sourceRelativePath = useMemo(() => {
    if (!activeAsset) {
      return null;
    }

    if (shouldUseProxyForActiveAsset && activeProxyPath) {
      return activeProxyPath;
    }

    return activeAsset.filePath;
  }, [activeAsset, activeProxyPath, shouldUseProxyForActiveAsset]);
  const activeClipId = activeClip?.clip.id ?? null;

  useEffect(() => {
    if (!activeClipId || !sourceRelativePath) {
      setLockedClipId(null);
      setLockedSourceRelativePath(null);
      return;
    }

    if (lockedClipId !== activeClipId) {
      setLockedClipId(activeClipId);
      setLockedSourceRelativePath(sourceRelativePath);
      return;
    }

    if (!isPlaying) {
      setLockedSourceRelativePath(sourceRelativePath);
    }
  }, [activeClipId, isPlaying, lockedClipId, sourceRelativePath]);

  const effectiveSourceRelativePath = lockedSourceRelativePath ?? sourceRelativePath;
  const sourceCacheKey = effectiveSourceRelativePath ?? "";
  const hasActiveAssetFileUrlEntry = effectiveSourceRelativePath
    ? Object.prototype.hasOwnProperty.call(sourceUrlCache, sourceCacheKey)
    : false;
  const activeAssetFileUrl = effectiveSourceRelativePath ? (sourceUrlCache[sourceCacheKey] ?? null) : null;
  const isActiveAssetPending = Boolean(activeAsset) && (!hasActiveAssetFileUrlEntry || activeProxyPending);
  const isActiveAssetUnavailable = Boolean(activeAsset) && hasActiveAssetFileUrlEntry && !activeAssetFileUrl;
  const clipLocalTime = useMemo(() => {
    if (!activeClip) {
      return 0;
    }

    return Math.max(0, activeClip.clip.offset + (currentTime - activeClip.clip.start));
  }, [activeClip, currentTime]);

  useEffect(() => {
    if (!activeAsset || !sourceRelativePath) {
      return;
    }

    if (
      proxyMode
      && activeAsset.type === "video"
      && ffmpegStatus.available === true
      && !activeProxyPath
      && !activeProxyPending
    ) {
      void ensureVideoProxy(activeAsset.id);
    }
  }, [
    activeAsset,
    activeProxyPath,
    activeProxyPending,
    ensureVideoProxy,
    ffmpegStatus.available,
    proxyMode,
    sourceRelativePath,
  ]);

  useEffect(() => {
    if (!activeAsset || !effectiveSourceRelativePath || hasActiveAssetFileUrlEntry) {
      return;
    }

    let cancelled = false;
    const loadFileUrl = async () => {
      const fileUrl = await resolveAssetFileUrl(effectiveSourceRelativePath, activeAsset.type);
      if (cancelled) {
        return;
      }

      setSourceUrlCache((current) => ({
        ...current,
        [sourceCacheKey]: fileUrl,
      }));
      setMediaError(null);
    };

    void loadFileUrl();
    return () => {
      cancelled = true;
    };
  }, [activeAsset, effectiveSourceRelativePath, hasActiveAssetFileUrlEntry, sourceCacheKey]);

  useEffect(() => {
    if (activeAudioPlaybackItems.length === 0) {
      return;
    }

    let cancelled = false;
    const loadAudioUrls = async () => {
      for (const item of activeAudioPlaybackItems) {
        const cacheKey = item.sourceRelativePath;
        if (Object.prototype.hasOwnProperty.call(sourceUrlCache, cacheKey)) {
          continue;
        }

        const fileUrl = await resolveAssetFileUrl(item.sourceRelativePath, "audio");
        if (cancelled) {
          return;
        }

        setSourceUrlCache((current) => ({
          ...current,
          [cacheKey]: fileUrl,
        }));
      }
    };

    void loadAudioUrls();
    return () => {
      cancelled = true;
    };
  }, [activeAudioPlaybackItems, sourceUrlCache]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeAsset || activeAsset.type !== "video" || !activeAssetFileUrl) {
      return;
    }

    if (Math.abs(video.currentTime - clipLocalTime) > 0.12) {
      try {
        video.currentTime = clipLocalTime;
      } catch {
        // ignore seek failures while metadata is not ready yet
      }
    }

    if (isPlaying) {
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      }
      return;
    }

    if (!video.paused) {
      video.pause();
    }
  }, [activeAsset, activeAssetFileUrl, clipLocalTime, isPlaying]);

  useEffect(() => {
    const activeClipIds = new Set(activeAudioPlaybackItems.map((item) => item.clipId));

    Object.entries(audioElementByClipIdRef.current).forEach(([clipId, audio]) => {
      if (!audio) {
        return;
      }

      const activeItem = activeAudioPlaybackItems.find((item) => item.clipId === clipId);
      if (!activeItem) {
        if (!audio.paused) {
          audio.pause();
        }
        return;
      }

      const audioUrl = sourceUrlCache[activeItem.sourceRelativePath] ?? null;
      if (!audioUrl) {
        return;
      }

      if (Math.abs(audio.currentTime - activeItem.clipLocalTime) > 0.12) {
        try {
          audio.currentTime = activeItem.clipLocalTime;
        } catch {
          // ignore seek failures while metadata is not ready yet
        }
      }

      audio.volume = Math.max(0, Math.min(2, activeItem.gain));

      if (isPlaying) {
        if (audio.paused) {
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
        }
      } else if (!audio.paused) {
        audio.pause();
      }
    });

    Object.entries(audioElementByClipIdRef.current).forEach(([clipId, audio]) => {
      if (!audio) {
        return;
      }
      if (!activeClipIds.has(clipId) && !audio.paused) {
        audio.pause();
      }
    });
  }, [activeAudioPlaybackItems, isPlaying, sourceUrlCache]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || activeAudioPlaybackItems.length === 0) {
      setAudioMeterBars((current) => (current.some((value) => value > 0) ? current.map(() => 0) : current));
      return;
    }

    const AudioContextCtor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    let cancelled = false;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const audioContext = audioContextRef.current;
    if (!audioSourceNodeRef.current) {
      audioSourceNodeRef.current = audioContext.createMediaElementSource(audio);
    }

    if (!audioAnalyserRef.current) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      audioAnalyserRef.current = analyser;
      audioSourceNodeRef.current.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    const analyser = audioAnalyserRef.current;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);

    const renderMeter = () => {
      if (cancelled) {
        return;
      }

      analyser.getByteFrequencyData(frequencyData);
      const nextBars = createAudioMeterBars(frequencyData, 20);
      setAudioMeterBars(nextBars);
      audioMeterRafRef.current = globalThis.requestAnimationFrame(renderMeter);
    };

    if (audioContext.state === "suspended" && isPlaying) {
      void audioContext.resume();
    }

    audioMeterRafRef.current = globalThis.requestAnimationFrame(renderMeter);

    return () => {
      cancelled = true;
      if (audioMeterRafRef.current !== null) {
        globalThis.cancelAnimationFrame(audioMeterRafRef.current);
      }
      audioMeterRafRef.current = null;
    };
  }, [activeAudioPlaybackItems, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;

    if (video && (!activeAsset || activeAsset.type !== "video")) {
      video.pause();
    }
  }, [activeAsset]);

  useEffect(() => {
    setMediaError(null);
  }, [activeAsset?.id, activeAssetFileUrl]);

  useEffect(() => {
    return () => {
      if (audioMeterRafRef.current !== null) {
        globalThis.cancelAnimationFrame(audioMeterRafRef.current);
      }
      audioMeterRafRef.current = null;

      const audioContext = audioContextRef.current;
      audioAnalyserRef.current = null;
      audioSourceNodeRef.current = null;
      audioContextRef.current = null;
      if (audioContext) {
        void audioContext.close();
      }
    };
  }, []);

  const handleActiveVideoError = (error: MediaError | null) => {
    if (
      activeAsset
      && activeAsset.type === "video"
      && activeProxyPath
      && effectiveSourceRelativePath === activeProxyPath
    ) {
      setProxyBypassByAssetId((current) => ({
        ...current,
        [activeAsset.id]: true,
      }));
      setLockedSourceRelativePath(activeAsset.filePath);
      setMediaError(`Proxy-Fehler, fallback auf Original: ${toVideoErrorMessage(error, activeAsset.originalName)}`);
      return;
    }

    setMediaError(toVideoErrorMessage(error, activeAsset?.originalName ?? "Video"));
  };

  return (
    <div className="h-full flex flex-col bg-[#050506]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1e] bg-[#0d0d0f]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Preview
          </span>
          {proxyMode && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
              <Zap size={10} /> Proxy Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg border border-white/5 bg-zinc-900/40 text-zinc-400 hover:text-white transition-all"
            onClick={() => setCurrentTime(0)}
            title="Back To Start"
          >
            <SkipBack size={14} />
          </button>
          <button
            className="p-2 rounded-lg border border-white/5 bg-zinc-900/40 text-zinc-400 hover:text-white transition-all"
            onClick={togglePlayback}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            className={`p-2 rounded-lg border border-white/5 transition-all ${
              annotating ? "bg-blue-600/20 text-white" : "bg-zinc-900/40 text-zinc-400 hover:text-white"
            }`}
            onClick={toggleAnnotating}
            title="Annotate"
          >
            <Pencil size={14} />
          </button>
          <button
            className="p-2 rounded-lg border border-white/5 bg-zinc-900/40 text-zinc-400 hover:text-white transition-all"
            onClick={toggleProxyMode}
            title="Toggle Proxy"
          >
            <Zap size={14} />
          </button>
          <button
            className="p-2 rounded-lg border border-white/5 bg-zinc-900/40 text-zinc-400 hover:text-white transition-all"
            onClick={() => {}}
            title="Clear (UI-only)"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="p-2 rounded-lg border border-white/5 bg-zinc-900/40 text-zinc-400 hover:text-white transition-all"
            onClick={() => {}}
            title="Fullscreen (UI-only)"
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[#1a1a1e] bg-[#09090b]">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(timelineEnd)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={timelineEnd > 0 ? timelineEnd : 1}
          step={0.01}
          value={timelineEnd > 0 ? Math.min(currentTime, timelineEnd) : 0}
          onChange={(event) => setCurrentTime(Number(event.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-[80%] max-w-[980px] aspect-video rounded-2xl border border-[#1a1a1e] bg-[#0b0b0c] flex items-center justify-center text-zinc-700 overflow-hidden">
          {!activeClip && (
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-600">
                {timelineEnd > 0 ? "Playback Ready" : "No Media Loaded"}
              </div>
              <div className="mt-2 text-[11px] text-zinc-700">
                {timelineEnd > 0
                  ? `Playhead: ${formatTime(currentTime)} / ${formatTime(timelineEnd)}`
                  : "Import media and drop clips in timeline to play."}
              </div>
            </div>
          )}

          {activeClip && !activeAsset && (
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400">
                Missing Asset
              </div>
              <div className="mt-2 text-[11px] text-zinc-700">
                Clip references an asset that is not in the current project.
              </div>
            </div>
          )}

          {activeAsset && isActiveAssetPending && (
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
                Loading Asset
              </div>
              <div className="mt-2 text-[11px] text-zinc-700 truncate max-w-[480px]">
                {activeAsset.originalName}
              </div>
            </div>
          )}

          {activeAsset && isActiveAssetUnavailable && (
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400">
                Asset Unavailable
              </div>
              <div className="mt-2 text-[11px] text-zinc-700 truncate max-w-[560px]">
                {activeAsset.originalName} konnte nicht als Playback-Quelle geoeffnet werden.
              </div>
            </div>
          )}

          {activeAsset && mediaError && (
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-red-400">
                Media Error
              </div>
              <div className="mt-2 text-[11px] text-zinc-600 truncate max-w-[640px]">
                {mediaError}
              </div>
            </div>
          )}

          {activeAsset && activeAssetFileUrl && activeAsset.type === "image" && (
            <img
              src={activeAssetFileUrl}
              alt={activeAsset.originalName}
              className="w-full h-full object-contain"
              draggable={false}
              onLoad={() => setMediaError(null)}
              onError={() => setMediaError(`Image konnte nicht geladen werden: ${activeAsset.originalName}`)}
            />
          )}

          {activeAsset && activeAssetFileUrl && activeAsset.type === "video" && (
            <video
              ref={videoRef}
              src={activeAssetFileUrl}
              className="w-full h-full object-contain bg-black"
              playsInline
              preload="auto"
              onLoadedData={() => setMediaError(null)}
              onError={(event) => handleActiveVideoError(event.currentTarget.error)}
            />
          )}

          {activeAsset && activeAssetFileUrl && activeAsset.type === "audio" && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-300">Audio Playback</div>
              <div className="mt-2 text-[12px] text-zinc-300 truncate max-w-[80%]">{activeAsset.originalName}</div>
              <div className="mt-3 text-[10px] text-zinc-500">{formatTime(clipLocalTime)} / {formatTime(activeClip?.clip.duration ?? 0)}</div>
              <div className="mt-3 h-14 w-[70%] max-w-[520px] rounded-xl border border-violet-500/20 bg-zinc-900/60 px-2 py-2 flex items-end gap-[3px]">
                {audioMeterBars.map((value, index) => (
                  <div
                    key={`meter_${index}`}
                    className="flex-1 rounded-sm bg-violet-300/80 transition-[height] duration-75"
                    style={{ height: `${Math.max(8, Math.round(value * 100))}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden" aria-hidden="true">
        {activeAudioPlaybackItems.map((item, index) => {
          const audioUrl = sourceUrlCache[item.sourceRelativePath] ?? null;
          if (!audioUrl) {
            return null;
          }

          return (
            <audio
              key={item.clipId}
              ref={(element) => {
                audioElementByClipIdRef.current[item.clipId] = element;
                if (index === 0) {
                  audioRef.current = element;
                }
              }}
              src={audioUrl}
              preload="auto"
              onLoadedData={() => setMediaError(null)}
              onError={() => setMediaError(`Audio konnte nicht geladen werden: ${item.asset.originalName}`)}
            />
          );
        })}
      </div>
    </div>
  );
}

function resolveActiveAudioClips(
  timeline: Timeline,
  currentTime: number,
  trackAudioMutedById: Record<string, boolean>,
  trackAudioSoloById: Record<string, boolean>,
): ActiveClipRef[] {
  const soloAudioTrackIds = new Set(
    Object.entries(trackAudioSoloById)
      .filter(([, isSolo]) => Boolean(isSolo))
      .map(([trackId]) => trackId),
  );

  const active: ActiveClipRef[] = [];
  timeline.tracks.forEach((track, trackIndex) => {
    if (track.kind !== "audio") {
      return;
    }
    if (trackAudioMutedById[track.id]) {
      return;
    }
    if (soloAudioTrackIds.size > 0 && !soloAudioTrackIds.has(track.id)) {
      return;
    }

    track.clips.forEach((clip) => {
      const clipEnd = clip.start + clip.duration;
      if (currentTime >= clip.start && currentTime < clipEnd) {
        active.push({
          trackId: track.id,
          trackIndex,
          clip,
          trackKind: track.kind,
        });
      }
    });
  });

  return active.sort((left, right) => {
    if (left.trackIndex !== right.trackIndex) {
      return left.trackIndex - right.trackIndex;
    }
    return left.clip.start - right.clip.start;
  });
}

function resolveActiveClip(
  timeline: Timeline,
  currentTime: number,
  trackAudioMutedById: Record<string, boolean>,
  trackAudioSoloById: Record<string, boolean>,
): ActiveClipRef | null {
  const candidates: ActiveClipRef[] = [];
  const soloAudioTrackIds = new Set(
    Object.entries(trackAudioSoloById)
      .filter(([, isSolo]) => Boolean(isSolo))
      .map(([trackId]) => trackId),
  );

  timeline.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip) => {
      const clipEnd = clip.start + clip.duration;
      const isWithinWindow = currentTime >= clip.start && currentTime < clipEnd;
      if (!isWithinWindow) {
        return;
      }

      if (track.kind === "audio") {
        if (trackAudioMutedById[track.id]) {
          return;
        }
        if (soloAudioTrackIds.size > 0 && !soloAudioTrackIds.has(track.id)) {
          return;
        }
      }

      candidates.push({
        trackId: track.id,
        trackIndex,
        clip,
        trackKind: track.kind,
      });
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const kindPriorityDiff = TRACK_PREVIEW_PRIORITY[left.trackKind] - TRACK_PREVIEW_PRIORITY[right.trackKind];
    if (kindPriorityDiff !== 0) {
      return kindPriorityDiff;
    }

    if (left.trackIndex !== right.trackIndex) {
      return left.trackIndex - right.trackIndex;
    }

    return left.clip.start - right.clip.start;
  });

  return candidates[0];
}

async function resolveAssetFileUrl(relativePath: string, mediaType: Asset["type"]): Promise<string | null> {
  const api = getIpcClient();

  // In packaged/file-Renderer: fuer Video bevorzugt file:// laden,
  // data: bleibt als Fallback erhalten.
  if (mediaType === "video") {
    try {
      const ipcUrl = await api.getAssetFileUrl(relativePath);
      if (ipcUrl) {
        return ipcUrl;
      }
    } catch {
      // try next source kind
    }

    try {
      const mediaDataUrl = await api.getAssetMediaDataUrl(relativePath);
      if (mediaDataUrl) {
        return mediaDataUrl;
      }
    } catch {
      // try next source kind
    }
  } else {
    try {
      const mediaDataUrl = await api.getAssetMediaDataUrl(relativePath);
      if (mediaDataUrl) {
        return mediaDataUrl;
      }
    } catch {
      // try next source kind
    }

    try {
      const ipcUrl = await api.getAssetFileUrl(relativePath);
      if (ipcUrl) {
        return ipcUrl;
      }
    } catch {
      // try computed file URL next
    }
  }

  let projectRoot: string | null;
  try {
    projectRoot = await api.getProjectRoot();
  } catch {
    return null;
  }
  if (!projectRoot) {
    return null;
  }

  const absolutePath = joinProjectPath(projectRoot, relativePath);
  return toFileUrl(absolutePath);
}

function joinProjectPath(projectRoot: string, relativePath: string): string {
  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRelative = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normalizedRoot}/${normalizedRelative}`;
}

function toFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }

  if (normalized.startsWith("/")) {
    return `file://${encodeURI(normalized)}`;
  }

  return `file:///${encodeURI(normalized)}`;
}

function createAudioMeterBars(frequencyData: Uint8Array, barCount: number): number[] {
  if (barCount <= 0 || frequencyData.length === 0) {
    return [];
  }

  const bars: number[] = [];
  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const start = Math.floor((barIndex / barCount) * frequencyData.length);
    const end = Math.max(start + 1, Math.floor(((barIndex + 1) / barCount) * frequencyData.length));

    let sum = 0;
    let count = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += frequencyData[sampleIndex] ?? 0;
      count += 1;
    }

    const normalized = count > 0 ? sum / count / 255 : 0;
    bars.push(Math.min(1, Math.max(0, Number(normalized.toFixed(4)))));
  }

  return bars;
}

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const whole = Math.floor(clamped);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  const centiseconds = Math.floor((clamped - whole) * 100);
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
}

function toVideoErrorMessage(error: MediaError | null, originalName: string): string {
  if (!error) {
    return `Video konnte nicht geladen werden: ${originalName}`;
  }

  if (error.code === error.MEDIA_ERR_ABORTED) {
    return `Video-Load wurde abgebrochen: ${originalName}`;
  }
  if (error.code === error.MEDIA_ERR_NETWORK) {
    return `Netzwerk-/Dateifehler beim Laden: ${originalName}`;
  }
  if (error.code === error.MEDIA_ERR_DECODE) {
    return `Decode-Fehler (Codec/Datei): ${originalName}`;
  }
  if (error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return `Quelle/Format nicht unterstuetzt: ${originalName}`;
  }

  return `Unbekannter Video-Fehler: ${originalName}`;
}
