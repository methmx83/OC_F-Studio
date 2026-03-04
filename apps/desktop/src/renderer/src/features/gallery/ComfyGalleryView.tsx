import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Download } from "lucide-react";

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

function readStoredOutputDir(): string {
  try {
    return window.localStorage.getItem(COMFY_GALLERY_PATH_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function ComfyGalleryView() {
  const importComfyOutputAsset = useStudioStore((state) => state.importComfyOutputAsset);

  const [outputDir, setOutputDir] = useState(readStoredOutputDir);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [status, setStatus] = useState<string>("Noch nicht geladen.");
  const [loading, setLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState<"all" | "image" | "video">("all");
  const [importingPath, setImportingPath] = useState<string | null>(null);

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

  const filteredItems = useMemo(() => {
    if (kindFilter === "all") {
      return items;
    }
    return items.filter((item) => item.kind === kindFilter);
  }, [items, kindFilter]);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const response = await getIpcClient().listComfyGallery({ outputDir, limit: 600 });
      setStatus(response.message);
      setItems(response.success ? response.items : []);
    } catch (error) {
      setStatus(`Gallery laden fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function importSingle(absolutePath: string): Promise<void> {
    setImportingPath(absolutePath);
    try {
      await importComfyOutputAsset(absolutePath);
    } finally {
      setImportingPath(null);
    }
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

      <div className="text-[10px] text-zinc-500">{status}</div>

      <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-zinc-950/40 p-3">
        {filteredItems.length === 0 ? (
          <div className="h-full min-h-40 flex items-center justify-center text-[11px] text-zinc-500">Keine Dateien fuer den aktuellen Filter.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {filteredItems.map((item) => (
              <div key={item.absolutePath} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{item.kind}</div>
                <div className="mt-1 text-[11px] text-zinc-200 truncate" title={item.fileName}>{item.fileName}</div>
                <div className="mt-1 text-[9px] text-zinc-500">{formatSize(item.sizeBytes)} · {new Date(item.modifiedAt).toLocaleString()}</div>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => void importSingle(item.absolutePath)}
                    disabled={importingPath === item.absolutePath}
                    className="px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-black uppercase tracking-wider text-emerald-200 disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1"><Download size={10} /> {importingPath === item.absolutePath ? "Import..." : "Import"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
