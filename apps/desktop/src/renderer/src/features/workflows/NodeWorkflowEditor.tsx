import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "@shared/types";
import type { WorkflowCatalogEntry, WorkflowMetaInputDefinition } from "@shared/workflows";

type NumKey = "width" | "height" | "fps" | "frames" | "steps";

type Draft = {
  settings: Record<NumKey, string>;
  inputs: Record<string, string>;
};

interface NodeWorkflowEditorProps {
  workflow: WorkflowCatalogEntry;
  draft: Draft;
  assets: Asset[];
  connections: Record<string, boolean>;
  validationIssues: string[];
  canSend: boolean;
  // eslint-disable-next-line no-unused-vars
  onNumChange: (key: NumKey, value: string) => void;
  // eslint-disable-next-line no-unused-vars
  onInputChange: (key: string, value: string) => void;
  // eslint-disable-next-line no-unused-vars
  onConnectionChange: (key: string, connected: boolean) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 190;
const NUM_FIELDS: Array<{ key: NumKey; label: string }> = [
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
  { key: "fps", label: "FPS" },
  { key: "frames", label: "Frames" },
  { key: "steps", label: "Steps" },
];

function nodeIdForInput(input: WorkflowMetaInputDefinition): string {
  return `input:${input.key}`;
}

function buildDefaultPositions(workflow: WorkflowCatalogEntry): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = {
    settings: { x: 30, y: 30 },
    output: { x: 760, y: 30 },
  };

  workflow.inputs.forEach((input, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    positions[nodeIdForInput(input)] = {
      x: 30 + col * 300,
      y: 270 + row * 220,
    };
  });

  return positions;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function assetsForInput(assets: Asset[], input: WorkflowMetaInputDefinition): Asset[] {
  return assets.filter((asset) => asset.type === input.type).sort((a, b) => a.originalName.localeCompare(b.originalName));
}

export default function NodeWorkflowEditor(props: NodeWorkflowEditorProps) {
  const { workflow, draft, assets, connections, validationIssues, canSend, onNumChange, onInputChange, onConnectionChange } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() => buildDefaultPositions(workflow));
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    setPositions(buildDefaultPositions(workflow));
  }, [workflow]);

  useEffect(() => {
    if (!drag) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const maxX = Math.max(0, container.clientWidth - NODE_WIDTH);
      const maxY = Math.max(0, container.clientHeight - NODE_HEIGHT);
      const nextX = clamp(event.clientX - rect.left - drag.offsetX, 0, maxX);
      const nextY = clamp(event.clientY - rect.top - drag.offsetY, 0, maxY);

      setPositions((current) => ({
        ...current,
        [drag.id]: {
          x: nextX,
          y: nextY,
        },
      }));
    };

    const onUp = () => {
      setDrag(null);
    };

    globalThis.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    return () => {
      globalThis.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
    };
  }, [drag]);

  const edges = useMemo(() => {
    const output = positions.output ?? { x: 760, y: 30 };
    const list: Array<{ id: string; from: NodePosition; to: NodePosition }> = [];

    const settings = positions.settings ?? { x: 30, y: 30 };
    list.push({
      id: "settings->output",
      from: { x: settings.x + NODE_WIDTH, y: settings.y + 70 },
      to: { x: output.x, y: output.y + 70 },
    });

    workflow.inputs.forEach((input) => {
      const connected = connections[input.key] !== false;
      if (!connected) {
        return;
      }
      const inputPos = positions[nodeIdForInput(input)];
      if (!inputPos) {
        return;
      }
      list.push({
        id: `${input.key}->output`,
        from: { x: inputPos.x + NODE_WIDTH, y: inputPos.y + 70 },
        to: { x: output.x, y: output.y + 110 },
      });
    });

    return list;
  }, [connections, positions, workflow.inputs]);

  const beginDrag = (nodeId: string, event: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const pos = positions[nodeId] ?? { x: 0, y: 0 };
    setDrag({
      id: nodeId,
      offsetX: event.clientX - rect.left - pos.x,
      offsetY: event.clientY - rect.top - pos.y,
    });
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-4">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Node Workflow Editor (MVP)</div>
      <div className="mt-2 text-[10px] text-zinc-500">
        Drag Nodes to organize your graph. Validation stays connected to the existing send pipeline.
      </div>

      {validationIssues.length > 0 && (
        <div className="mt-3 space-y-1">
          {validationIssues.slice(0, 4).map((issue) => (
            <div key={issue} className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
              {issue}
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative mt-3 h-[620px] min-h-[620px] rounded-xl border border-white/10 bg-[#0d0d10] overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edges.map((edge) => (
            <line
              key={edge.id}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="rgba(59, 130, 246, 0.5)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <NodeCard
          title="Settings"
          subtitle="Numeric render parameters"
          position={positions.settings ?? { x: 30, y: 30 }}
          onHeaderMouseDown={(event) => beginDrag("settings", event)}
        >
          <div className="grid grid-cols-2 gap-2">
            {NUM_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <div className="text-[8px] uppercase tracking-wider text-zinc-500 mb-1">{field.label}</div>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.settings[field.key]}
                  onChange={(event) => onNumChange(field.key, event.target.value)}
                  className="w-full rounded-md border border-white/10 bg-zinc-950/70 px-2 py-1 text-[10px] text-zinc-100 outline-none focus:border-blue-500/50"
                />
              </label>
            ))}
          </div>
        </NodeCard>

        {workflow.inputs.map((input) => {
          const id = nodeIdForInput(input);
          const options = assetsForInput(assets, input);
          const connected = connections[input.key] !== false;
          const requiredMissing = input.required && (!connected || !(draft.inputs[input.key] ?? "").trim());
          return (
            <NodeCard
              key={id}
              title={input.label}
              subtitle={`${input.key} (${input.type})`}
              position={positions[id] ?? { x: 30, y: 270 }}
              onHeaderMouseDown={(event) => beginDrag(id, event)}
              invalid={requiredMissing}
            >
              <select
                value={draft.inputs[input.key] ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  onInputChange(input.key, value);
                  if (value.trim() && !connected) {
                    onConnectionChange(input.key, true);
                  }
                }}
                className="w-full rounded-md border border-white/10 bg-zinc-950/70 px-2 py-1 text-[10px] text-zinc-100 outline-none focus:border-blue-500/50"
              >
                <option value="">{`Select ${input.type}${input.required ? "" : " (optional)"}`}</option>
                {options.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.originalName}
                  </option>
                ))}
              </select>
              {options.length === 0 && (
                <div className="mt-2 text-[9px] text-zinc-500">No compatible assets yet.</div>
              )}
              {requiredMissing && (
                <div className="mt-2 text-[9px] text-amber-200">Required input missing.</div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={`text-[9px] ${
                    connected ? "text-emerald-300" : "text-zinc-500"
                  }`}
                >
                  {connected ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() => onConnectionChange(input.key, !connected)}
                  className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-wider ${
                    connected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
                  }`}
                >
                  {connected ? "Disconnect" : "Connect"}
                </button>
              </div>
            </NodeCard>
          );
        })}

        <NodeCard
          title="Output / Send"
          subtitle={workflow.templateRelativePath}
          position={positions.output ?? { x: 760, y: 30 }}
          onHeaderMouseDown={(event) => beginDrag("output", event)}
        >
          <div className={`rounded-md border px-2 py-1 text-[10px] ${
            canSend
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
          >
            {canSend ? "Ready to send" : "Validation issues present"}
          </div>
          <div className="mt-2 text-[9px] text-zinc-500">
            Connected edges are now part of validation. Disconnected required inputs block sending.
          </div>
          <div className="mt-2 text-[9px] text-zinc-500">
            Connected inputs: {workflow.inputs.filter((input) => connections[input.key] !== false).length}/{workflow.inputs.length}
          </div>
        </NodeCard>
      </div>
    </div>
  );
}

function NodeCard(props: {
  title: string;
  subtitle: string;
  position: NodePosition;
  children: React.ReactNode;
  // eslint-disable-next-line no-unused-vars
  onHeaderMouseDown: (event: React.MouseEvent) => void;
  invalid?: boolean;
}) {
  const { title, subtitle, position, children, onHeaderMouseDown, invalid } = props;
  return (
    <div
      className={`absolute rounded-xl border bg-zinc-900/95 shadow-2xl ${invalid ? "border-amber-500/40" : "border-white/10"}`}
      style={{
        width: `${NODE_WIDTH}px`,
        minHeight: `${NODE_HEIGHT}px`,
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <div
        className={`px-3 py-2 border-b cursor-move ${invalid ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-zinc-950/70"}`}
        onMouseDown={onHeaderMouseDown}
      >
        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-100">{title}</div>
        <div className="text-[8px] font-mono text-zinc-500 truncate">{subtitle}</div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
