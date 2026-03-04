import React, { useMemo, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";

import { useStudioStore } from "../../core/store/studioStore";

export default function ComfyLiveView() {
  const comfyBaseUrl = useStudioStore((state) => state.comfyBaseUrl);
  const setComfyBaseUrl = useStudioStore((state) => state.setComfyBaseUrl);

  const [reloadKey, setReloadKey] = useState(0);

  const comfyUrl = useMemo(() => {
    const raw = (comfyBaseUrl || "http://127.0.0.1:8188").trim();
    return raw.length > 0 ? raw : "http://127.0.0.1:8188";
  }, [comfyBaseUrl]);

  return (
    <div className="h-full p-4 flex flex-col gap-3 bg-[#0b0b10]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Comfy Live</div>
          <div className="text-[11px] text-zinc-500 mt-1">Eingebettete ComfyUI direkt in der App.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="px-3 py-2 rounded-lg border border-white/10 bg-zinc-900/70 text-[10px] font-black uppercase tracking-wider text-zinc-200"
          >
            <span className="inline-flex items-center gap-1"><RefreshCw size={12} /> Reload</span>
          </button>
          <button
            onClick={() => window.open(comfyUrl, "_blank", "noopener,noreferrer")}
            className="px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-[10px] font-black uppercase tracking-wider text-blue-200"
          >
            <span className="inline-flex items-center gap-1"><ExternalLink size={12} /> Open external</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={comfyBaseUrl}
          onChange={(event) => setComfyBaseUrl(event.target.value)}
          placeholder="Comfy URL, z. B. http://127.0.0.1:8188"
          className="w-full px-3 py-2 rounded-lg border border-white/10 bg-zinc-950/80 text-[11px] font-mono text-zinc-200"
        />
      </div>

      <div className="flex-1 rounded-xl overflow-hidden border border-white/10 bg-black">
        <iframe
          key={reloadKey}
          src={comfyUrl}
          title="Comfy Live"
          className="w-full h-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
