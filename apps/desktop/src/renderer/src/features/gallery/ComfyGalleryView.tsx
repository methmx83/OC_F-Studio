import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, CheckSquare, Square } from "lucide-react";

import { getIpcClient } from "../../core/adapters/ipcClient";
import { useStudioStore } from "../../core/store/studioStore";

type GalleryItem = {
  absolutePath: string;
  fileName: string;
  kind: "image" | "video";
  sizeBytes: number;
  modifiedAt: string;
};

const COMFY_GALLERY_PATH_KEY = "ai-filmstudio.comfy.gallery.outputDir";
const COMFY_GALLERY_IMPORTED_PATHS_KEY = "ai-filmstudio.comfy.gallery.importedPaths";

function readStoredOutputDir(): string {
  try {
    return window.localStorage.getItem(COMFY_GALLERY_PATH_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function readStoredImportedPaths(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COMFY_GALLERY_IMPORTED_PATHS_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

function writeStoredImportedPaths(paths: Set<string>): void {
  try {
    window.localStorage.setItem(COMFY_GALLERY_IMPORTED_PATHS_KEY, JSON.stringify(Array.from(paths)));
  } catch {
    // ignore storage errors
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function toFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  return encodeURI(`file:///${normalized}`);
}

export default function ComfyGalleryView() {
  const importComfyOutputAsset = useStudioStore((state) => state.importComfyOutputAsset);
  const dropAssetToTimeline = useStudioStore((state) => state.dropAssetToTimeline);
  const assets = useStudioStore((state) => state.assets);

  const [outputDir, setOutputDir] = useState(readStoredOutputDir);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState<string>("Noch nicht geladen.");
  const [loading, setLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | "image" | "video">("all");
  const [importStateFilter, setImportStateFilter] = useState<"all" | "new" | "imported">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [autoPlaceOnImport, setAutoPlaceOnImport] = useState(true);
  const [importingPath, setImportingPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [persistedImportedPaths, setPersistedImportedPaths] = useState<Set<string>>(() => readStoredImportedPaths());

  useEffect(() => {
    try {
      if (outputDir.trim().length > 0) {
        window.localStorage.setItem(COMFY_GALLERY_PATH_KEY, outputDir.trim());
      } else {
        window.localStorage.removeItem(COMFY_GALLERY_PATH_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [outputDir]);

  const importedNames = useMemo(() => new Set(assets.map((asset) => asset.originalName.toLowerCase())), [assets]);

  const filteredItems = useMemo(() => {
    let base = kindFilter === "all" ? items : items.filter((item) => item.kind === kindFilter);

    if (importStateFilter === "new") {
      base = base.filter((item) => !importedNames.has(item.fileName.toLowerCase()) && !persistedImportedPaths.has(item.absolutePath));
    } else if (importStateFilter === "imported") {
      base = base.filter((item) => importedNames.has(item.fileName.toLowerCase()) || persistedImportedPaths.has(item.absolutePath));
    }

    base = [...base].sort((a, b) => {
      const delta = new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      return sortOrder === "newest" ? delta : -delta;
    });

    return base;
  }, [importStateFilter, importedNames, items, kindFilter, persistedImportedPaths, sortOrder]);

  const selectedCount = selectedPaths.size;

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const response = await getIpcClient().listComfyGallery({ outputDir, limit: 600 });
      setStatus(response.message);
      const nextItems = response.success ? response.items : [];
      setItems(nextItems);
      setSelectedPaths((current) => {
        const valid = new Set(nextItems.map((item) => item.absolutePath));
        return new Set(Array.from(current).filter((entry) => valid.has(entry)));
      });
    } catch (error) {
      setStatus(`Gallery laden fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
      setItems([]);
      setSelectedPaths(new Set());
    } finally {
      setLoading(false);
    }
  }

  async function importSingle(absolutePath: string): Promise<void> {
    setImportingPath(absolutePath);
    try {
      const beforeIds = new Set(useStudioStore.getState().assets.map((asset) => asset.id));
      await importComfyOutputAsset(absolutePath);
      setPersistedImportedPaths((current) => {
        const next = new Set(current);
        next.add(absolutePath);
        writeStoredImportedPaths(next);
        return next;
      });
      if (autoPlaceOnImport) {
        const afterAssets = useStudioStore.getState().assets;
        afterAssets.filter((asset) => !beforeIds.has(asset.id)).forEach((asset) => dropAssetToTimeline(asset.id));
      }
    } finally {
      setImportingPath(null);
    }
  }

  async function importSelected(): Promise<void> {
    const targets = Array.from(selectedPaths);
    if (targets.length === 0) {
      return;
    }

    for (const absolutePath of targets) {
      setImportingPath(absolutePath);
      try {
        const beforeIds = new Set(useStudioStore.getState().assets.map((asset) => asset.id));
        await importComfyOutputAsset(absolutePath);
        setPersistedImportedPaths((current) => {
          const next = new Set(current);
          next.add(absolutePath);
          writeStoredImportedPaths(next);
          return next;
        });
        if (autoPlaceOnImport) {
          const afterAssets = useStudioStore.getState().assets;
          afterAssets.filter((asset) => !beforeIds.has(asset.id)).forEach((asset) => dropAssetToTimeline(asset.id));
        }
      } catch {
        // continue with remaining files
      }
    }

    setImportingPath(null);
    setSelectedPaths(new Set());
  }

  async function importAllNew(): Promise<void> {
    const targets = filteredItems
      .filter((item) => !importedNames.has(item.fileName.toLowerCase()) && !persistedImportedPaths.has(item.absolutePath))
      .map((item) => item.absolutePath);

    for (const absolutePath of targets) {
      setImportingPath(absolutePath);
      try {
        const beforeIds = new Set(useStudioStore.getState().assets.map((asset) => asset.id));
        await importComfyOutputAsset(absolutePath);
        setPersistedImportedPaths((current) => {
          const next = new Set(current);
          next.add(absolutePath);
          writeStoredImportedPaths(next);
          return next;
        });
        if (autoPlaceOnImport) {
          const afterAssets = useStudioStore.getState().assets;
          afterAssets.filter((asset) => !beforeIds.has(asset.id)).forEach((asset) => dropAssetToTimeline(asset.id));
        }
      } catch {
        // continue with remaining files
      }
    }

    setImportingPath(null);
  }

  function toggleSelection(absolutePath: string): void {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(absolutePath)) {
        next.delete(absolutePath);
      } else {
        next.add(absolutePath);
      }
      return next;
    });
  }

  return (
    <div className="h-full p-5 text-zinc-200 overflow-hidden flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300">Comfy Gallery</h2>
          <p className="mt-1 text-[11px] text-zinc-500">Assets direkt aus deinem Comfy Output Ordner listen und importieren.</p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="px-3 py-2 rounded-lg border border-white/10 bg-zinc-950/70 text-[10px] font-black uppercase tracking-wider text-zinc-200 disabled:opacity-40"
        >
          <span className="inline-flex items-center gap-1"><RefreshCw size={12} /> {loading ? "Lade..." : "Refresh"}</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={outputDir}
          onChange={(event) => setOutputDir(event.target.value)}
          placeholder="Comfy Output Ordner, z. B. D:\\ComfyUI\\output"
          className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-zinc-950/70 text-[11px] font-mono text-zinc-200"
        />
        <div className="flex items-center gap-1">
          {(["all", "image", "video"] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => setKindFilter(kind)}
              className={`px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${kindFilter === kind ? "border-blue-500/40 bg-blue-500/10 text-blue-200" : "border-white/10 bg-zinc-950/70 text-zinc-400"}`}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[9px]">
        <span className="text-zinc-500 uppercase tracking-wider">Import-Filter</span>
        {(["all", "new", "imported"] as const).map((state) => (
          <button
            key={state}
            onClick={() => setImportStateFilter(state)}
            className={`px-2 py-1 rounded-md border uppercase tracking-wider ${importStateFilter === state ? "border-violet-500/40 bg-violet-500/10 text-violet-200" : "border-white/10 bg-zinc-950/70 text-zinc-400"}`}
          >
            {state}
          </button>
        ))}

        <span className="text-zinc-500 uppercase tracking-wider ml-3">Sort</span>
        {(["newest", "oldest"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortOrder(mode)}
            className={`px-2 py-1 rounded-md border uppercase tracking-wider ${sortOrder === mode ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-white/10 bg-zinc-950/70 text-zinc-400"}`}
          >
            {mode}
          </button>
        ))}

        <button
          onClick={() => setAutoPlaceOnImport((current) => !current)}
          className={`px-2 py-1 rounded-md border uppercase tracking-wider ml-3 ${autoPlaceOnImport ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-zinc-950/70 text-zinc-400"}`}
        >
          Auto-Place {autoPlaceOnImport ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span>{status}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void importSelected()}
            disabled={selectedCount === 0 || Boolean(importingPath)}
            className="px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-black uppercase tracking-wider text-emerald-200 disabled:opacity-40"
          >
            Import selected ({selectedCount})
          </button>
          <button
            onClick={() => void importAllNew()}
            disabled={Boolean(importingPath)}
            className="px-2 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-[9px] font-black uppercase tracking-wider text-blue-200 disabled:opacity-40"
          >
            Import all new
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-zinc-950/40 p-3">
        {filteredItems.length === 0 ? (
          <div className="h-full min-h-40 flex items-center justify-center text-[11px] text-zinc-500">Keine Dateien fuer den aktuellen Filter.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {filteredItems.map((item) => {
              const isSelected = selectedPaths.has(item.absolutePath);
              const isImported = importedNames.has(item.fileName.toLowerCase()) || persistedImportedPaths.has(item.absolutePath);

              return (
                <div key={item.absolutePath} className={`rounded-lg border p-2 ${isSelected ? "border-blue-400/40 bg-blue-500/10" : "border-white/10 bg-black/20"}`}>
                  <div className="relative rounded-md overflow-hidden border border-white/5 bg-zinc-900/50 aspect-video">
                    {item.kind === "image" ? (
                      <img src={toFileUrl(item.absolutePath)} alt={item.fileName} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <video src={toFileUrl(item.absolutePath)} className="w-full h-full object-cover" muted preload="metadata" />
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{item.kind}</div>
                    {isImported && <span className="text-[8px] px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">imported</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-200 truncate" title={item.fileName}>{item.fileName}</div>
                  <div className="mt-1 text-[9px] text-zinc-500">{formatSize(item.sizeBytes)} · {new Date(item.modifiedAt).toLocaleString()}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => toggleSelection(item.absolutePath)}
                      className="px-2 py-1 rounded-md border border-white/10 bg-zinc-950/70 text-[9px] font-black uppercase tracking-wider text-zinc-300"
                    >
                      <span className="inline-flex items-center gap-1">{isSelected ? <CheckSquare size={10} /> : <Square size={10} />} Select</span>
                    </button>
                    <button
                      onClick={() => void importSingle(item.absolutePath)}
                      disabled={importingPath === item.absolutePath}
                      className="px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-black uppercase tracking-wider text-emerald-200 disabled:opacity-40"
                    >
                      <span className="inline-flex items-center gap-1"><Download size={10} /> {importingPath === item.absolutePath ? "Import..." : "Import"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
