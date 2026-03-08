import React, { useEffect, useMemo, useState } from "react";
import type { Timeline, Track } from "@shared/types";
import { useShallow } from "zustand/shallow";

import { getIpcClient } from "../../core/adapters/ipcClient";
import { useStudioStore } from "../../core/store/studioStore";

interface PromptShot {
  id: string;
  label: string;
  durationSeconds: number;
}

interface PromptScenePlan {
  source: string;
  shots: PromptShot[];
  scene1Shots: PromptShot[];
}

export default function PromptSceneGeneratorPanel() {
  const { assets, addTrack, timelineAddClip } = useStudioStore(
    useShallow((state) => ({
      assets: state.assets,
      addTrack: state.addTrack,
      timelineAddClip: state.timelineAddClip,
    })),
  );

  const [promptDraft, setPromptDraft] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<PromptScenePlan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [draggingShotId, setDraggingShotId] = useState<string | null>(null);
  const [dragOverShotId, setDragOverShotId] = useState<string | null>(null);
  const [selectedImageAssetId, setSelectedImageAssetId] = useState("");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5vl:latest");
  const [ollamaInstruction, setOllamaInstruction] = useState(
    "Analyze this image and return one concise cinematic generation prompt.",
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const visualAssets = useMemo(
    () => assets.filter((asset) => asset.type === "video" || asset.type === "image").slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [assets],
  );
  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.type === "image").slice().sort((a, b) => a.originalName.localeCompare(b.originalName)),
    [assets],
  );

  useEffect(() => {
    if (imageAssets.length === 0) {
      if (selectedImageAssetId !== "") {
        setSelectedImageAssetId("");
      }
      return;
    }
    if (!imageAssets.some((asset) => asset.id === selectedImageAssetId)) {
      setSelectedImageAssetId(imageAssets[0].id);
    }
  }, [imageAssets, selectedImageAssetId]);

  const onAnalyzeWithOllama = async () => {
    const imageAsset = imageAssets.find((asset) => asset.id === selectedImageAssetId);
    if (!imageAsset) {
      setStatus("Bitte zuerst ein Bild-Asset fuer Ollama waehlen.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await getIpcClient().analyzeImageWithOllama({
        relativeImagePath: imageAsset.filePath,
        model: ollamaModel.trim() || undefined,
        prompt: ollamaInstruction.trim() || undefined,
      });

      if (!response.success || !response.promptText) {
        setStatus(response.message || "Ollama-Analyse fehlgeschlagen.");
        return;
      }

      setPromptDraft(response.promptText);
      setGeneratedPlan(null);
      setStatus(`Ollama Prompt uebernommen (${response.model ?? ollamaModel}).`);
    } catch (error) {
      setStatus(`Ollama-Analyse fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onGenerate = () => {
    const plan = buildPromptScenePlan(promptDraft);
    if (!plan) {
      setStatus("Bitte Prompt oder Script-Text eingeben.");
      return;
    }
    setGeneratedPlan(plan);
    setStatus(`Shotlist erzeugt: ${plan.shots.length} Shots, Szene 1 mit ${plan.scene1Shots.length} Shots.`);
  };

  const onRegenerateShot = (shotId: string) => {
    if (!generatedPlan) {
      setStatus("Bitte zuerst Shotlist erzeugen.");
      return;
    }
    setGeneratedPlan(regenerateSingleShotInPlan(generatedPlan, shotId));
    setStatus(`Shot "${shotId}" neu generiert.`);
  };

  const onShotDragStart = (event: React.DragEvent<HTMLDivElement>, shotId: string) => {
    setDraggingShotId(shotId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", shotId);
  };

  const onShotDragOver = (event: React.DragEvent<HTMLDivElement>, shotId: string) => {
    event.preventDefault();
    if (!draggingShotId || draggingShotId === shotId) {
      return;
    }
    event.dataTransfer.dropEffect = "move";
    if (dragOverShotId !== shotId) {
      setDragOverShotId(shotId);
    }
  };

  const onShotDrop = (event: React.DragEvent<HTMLDivElement>, targetShotId: string) => {
    event.preventDefault();
    if (!generatedPlan) {
      setDraggingShotId(null);
      setDragOverShotId(null);
      return;
    }

    const sourceShotId = draggingShotId ?? event.dataTransfer.getData("text/plain");
    if (!sourceShotId || sourceShotId === targetShotId) {
      setDraggingShotId(null);
      setDragOverShotId(null);
      return;
    }

    const reordered = reorderShots(generatedPlan.shots, sourceShotId, targetShotId);
    if (reordered !== generatedPlan.shots) {
      setGeneratedPlan(rebuildPlanFromShots(generatedPlan.source, reordered));
      setStatus("Shot-Reihenfolge aktualisiert.");
    }
    setDraggingShotId(null);
    setDragOverShotId(null);
  };

  const onShotDragEnd = () => {
    setDraggingShotId(null);
    setDragOverShotId(null);
  };

  const onApplySceneOne = () => {
    const plan = generatedPlan ?? buildPromptScenePlan(promptDraft);
    if (!plan) {
      setStatus("Bitte zuerst Prompt eingeben und Shotlist erzeugen.");
      return;
    }
    setGeneratedPlan(plan);

    if (plan.scene1Shots.length === 0) {
      setStatus("Keine Scene-1-Struktur erzeugt.");
      return;
    }
    if (visualAssets.length === 0) {
      setStatus("Keine Bild-/Video-Assets verfuegbar. Bitte zuerst Material importieren.");
      return;
    }

    let targetTrack = pickVisualTargetTrack(useStudioStore.getState().timeline);
    if (!targetTrack) {
      addTrack("video");
      targetTrack = pickVisualTargetTrack(useStudioStore.getState().timeline);
    }
    if (!targetTrack) {
      setStatus("Kein Video-/Overlay-Track verfuegbar.");
      return;
    }

    let nextStart = getTrackEndSeconds(targetTrack);
    plan.scene1Shots.forEach((shot, index) => {
      const asset = visualAssets[index % visualAssets.length];
      const duration = resolveGeneratedShotDuration(shot.durationSeconds, asset.durationSeconds);
      timelineAddClip(targetTrack.id, {
        id: makeGeneratedClipId(),
        assetId: asset.id,
        start: roundToStep(nextStart, 0.05),
        duration,
        offset: 0,
        gain: 1,
      });
      nextStart += duration;
    });

    setStatus(`Szene 1 auf "${targetTrack.name}" angelegt (${plan.scene1Shots.length} Clips).`);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f12] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Prompt-to-Scene Generator</div>
        <div className="text-[8px] text-zinc-600">Sidebar</div>
      </div>

      <div className="mt-2 rounded-lg border border-white/10 bg-zinc-950/60 p-2">
        <div className="text-[8px] uppercase tracking-wider text-zinc-500">Ollama Vision (QwenVL)</div>
        <div className="mt-1 space-y-1.5">
          <select
            value={selectedImageAssetId}
            onChange={(event) => setSelectedImageAssetId(event.target.value)}
            className="w-full rounded-md border border-white/10 bg-zinc-950/70 px-2 py-1 text-[10px] text-zinc-200"
          >
            {imageAssets.length === 0 ? (
              <option value="">No image assets</option>
            ) : (
              imageAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.originalName}
                </option>
              ))
            )}
          </select>
          <input
            value={ollamaModel}
            onChange={(event) => setOllamaModel(event.target.value)}
            placeholder="Model (z. B. qwen2.5vl:latest)"
            className="w-full rounded-md border border-white/10 bg-zinc-950/70 px-2 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
          />
          <input
            value={ollamaInstruction}
            onChange={(event) => setOllamaInstruction(event.target.value)}
            placeholder="Instruction for Ollama Vision"
            className="w-full rounded-md border border-white/10 bg-zinc-950/70 px-2 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => { void onAnalyzeWithOllama(); }}
            disabled={isAnalyzing || imageAssets.length === 0}
            className="w-full px-2 py-1 rounded-md border border-amber-500/25 bg-amber-500/10 text-[9px] font-black uppercase tracking-wider text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Image with Ollama"}
          </button>
        </div>
      </div>

      <textarea
        value={promptDraft}
        onChange={(event) => setPromptDraft(event.target.value)}
        placeholder="Script oder Prompt einfuegen..."
        className="mt-2 h-24 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-2 py-2 text-[10px] text-zinc-200 placeholder:text-zinc-600"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="px-2 py-1 rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-[9px] font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/20"
        >
          Generate Shotlist
        </button>
        <button
          type="button"
          onClick={onApplySceneOne}
          className="px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-[9px] font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20"
        >
          Apply Scene 1
        </button>
      </div>

      {status && <div className="mt-2 text-[9px] text-zinc-400">{status}</div>}

      {generatedPlan && (
        <div className="mt-2 space-y-2">
          <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[8px] uppercase tracking-wider text-zinc-500">Shotlist</div>
              <div className="text-[8px] text-zinc-600">Drag & drop zum Sortieren</div>
            </div>
            <div className="mt-1 space-y-1 max-h-36 overflow-y-auto pr-1">
              {generatedPlan.shots.map((shot) => (
                <div
                  key={shot.id}
                  draggable
                  onDragStart={(event) => onShotDragStart(event, shot.id)}
                  onDragOver={(event) => onShotDragOver(event, shot.id)}
                  onDrop={(event) => onShotDrop(event, shot.id)}
                  onDragEnd={onShotDragEnd}
                  className={`rounded-md border px-2 py-1 flex items-center justify-between gap-2 ${
                    dragOverShotId === shot.id
                      ? "border-cyan-400/40 bg-cyan-500/10"
                      : "border-white/10 bg-zinc-900/60"
                  }`}
                >
                  <div className="text-[9px] text-zinc-300 truncate">{shot.label}</div>
                  <button
                    type="button"
                    onClick={() => onRegenerateShot(shot.id)}
                    className="shrink-0 px-1.5 py-0.5 rounded-md border border-violet-500/30 bg-violet-500/10 text-[8px] font-black uppercase tracking-wider text-violet-200 hover:bg-violet-500/20"
                  >
                    Regen
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-2">
            <div className="text-[8px] uppercase tracking-wider text-zinc-500">Scene 1 Struktur</div>
            <div className="mt-1 space-y-1">
              {generatedPlan.scene1Shots.map((shot, index) => (
                <div key={`scene1_${shot.id}`} className="text-[9px] text-zinc-300">
                  {index + 1}. {shot.label} ({shot.durationSeconds.toFixed(1)}s)
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 text-[8px] text-zinc-600">
        Timeline bleibt frei; Generator arbeitet jetzt komplett in der rechten Sidebar.
      </div>
    </div>
  );
}

function rebuildPlanFromShots(source: string, shots: PromptShot[]): PromptScenePlan {
  return {
    source,
    shots,
    scene1Shots: shots.slice(0, Math.min(4, shots.length)),
  };
}

function regenerateSingleShotInPlan(plan: PromptScenePlan, shotId: string): PromptScenePlan {
  const shotIndex = plan.shots.findIndex((shot) => shot.id === shotId);
  if (shotIndex < 0) {
    return plan;
  }

  const nextShots = plan.shots.map((shot, index) => {
    if (index !== shotIndex) {
      return shot;
    }
    return buildRegeneratedShot(plan.source, shot, index);
  });

  return rebuildPlanFromShots(plan.source, nextShots);
}

function buildRegeneratedShot(source: string, shot: PromptShot, shotIndex: number): PromptShot {
  const segments = parsePromptSegments(source);
  const segmentOffset = Math.floor(Math.random() * Math.max(1, segments.length));
  const nextSegment = segments.length > 0
    ? segments[(shotIndex + segmentOffset + 1) % segments.length]
    : shot.label;
  const styleOffset = Math.floor(Math.random() * 4) + 1;
  const shotType = inferShotType(nextSegment, shotIndex + styleOffset);

  return {
    ...shot,
    label: `${shotType}: ${trimWords(nextSegment, 10)}`,
    durationSeconds: resolveShotDurationByIndex(shotIndex + styleOffset),
  };
}

function reorderShots(shots: PromptShot[], sourceShotId: string, targetShotId: string): PromptShot[] {
  const sourceIndex = shots.findIndex((shot) => shot.id === sourceShotId);
  const targetIndex = shots.findIndex((shot) => shot.id === targetShotId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return shots;
  }

  const next = [...shots];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function parsePromptSegments(source: string): string[] {
  const segments = source
    .split(/\r?\n|[.!?;]+/g)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment.length >= 3);

  if (segments.length > 0) {
    return segments;
  }

  const fallbackWords = source.split(/\s+/g).filter(Boolean);
  const fallbackSegments: string[] = [];
  if (fallbackWords.length > 0) {
    for (let index = 0; index < Math.min(8, Math.ceil(fallbackWords.length / 8)); index += 1) {
      const start = index * 8;
      const group = fallbackWords.slice(start, start + 8).join(" ");
      if (group) {
        fallbackSegments.push(group);
      }
    }
  }
  return fallbackSegments;
}

function buildPromptScenePlan(rawPrompt: string): PromptScenePlan | null {
  const source = rawPrompt.trim();
  if (!source) {
    return null;
  }

  const segments = parsePromptSegments(source);
  if (segments.length === 0) {
    return null;
  }

  const shots = segments.slice(0, 8).map((segment, index) => {
    const shotType = inferShotType(segment, index);
    const trimmed = trimWords(segment, 10);
    return {
      id: `shot_${index + 1}`,
      label: `${shotType}: ${trimmed}`,
      durationSeconds: resolveShotDurationByIndex(index),
    } satisfies PromptShot;
  });

  return rebuildPlanFromShots(source, shots);
}

function inferShotType(segment: string, index: number): string {
  const normalized = segment.toLowerCase();
  if (/(establish|totale|overview|opening|intro)/.test(normalized)) return "Establishing";
  if (/(close|nah|detail|portrait)/.test(normalized)) return "Close-up";
  if (/(move|tracking|follow|fahrt|dolly)/.test(normalized)) return "Tracking";
  if (/(dialog|talk|conversation|spricht|gespraech)/.test(normalized)) return "Dialogue";
  const defaults = ["Wide", "Medium", "Close-up", "Cutaway"];
  return defaults[index % defaults.length];
}

function trimWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/g).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function resolveShotDurationByIndex(index: number): number {
  const defaults = [3.0, 2.5, 3.5, 2.0];
  return defaults[index % defaults.length];
}

function pickVisualTargetTrack(timeline: Timeline): Track | null {
  return timeline.tracks.find((track) => track.kind === "video")
    ?? timeline.tracks.find((track) => track.kind === "overlay")
    ?? null;
}

function getTrackEndSeconds(track: Track): number {
  return track.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
}

function resolveGeneratedShotDuration(targetDuration: number, sourceDuration?: number): number {
  if (typeof sourceDuration === "number" && Number.isFinite(sourceDuration) && sourceDuration > 0) {
    return roundToStep(Math.max(0.5, Math.min(targetDuration, sourceDuration)), 0.05);
  }
  return roundToStep(Math.max(0.5, targetDuration), 0.05);
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function makeGeneratedClipId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `clip_${globalThis.crypto.randomUUID()}`;
  }
  return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
