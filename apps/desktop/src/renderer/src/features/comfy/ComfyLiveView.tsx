import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";

import { useStudioStore } from "../../core/store/studioStore";

export default function ComfyLiveView() {
  const comfyBaseUrl = useStudioStore((state) => state.comfyBaseUrl);
  const setComfyBaseUrl = useStudioStore((state) => state.setComfyBaseUrl);

  const [reloadKey, setReloadKey] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => Math.max(320, window.innerHeight - 56));

  useEffect(() => {
    const onResize = () => setViewportHeight(Math.max(320, window.innerHeight - 56));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const comfyUrl = useMemo(() => {
    const raw = (comfyBaseUrl || "http://127.0.0.1:8188").trim();
    return raw.length > 0 ? raw : "http://127.0.0.1:8188";
  }, [comfyBaseUrl]);

  return (
    <div className="fixed top-14 left-0 right-0 min-h-0 min-w-0 bg-black overflow-hidden z-10" style={{ height: `${viewportHeight}px` }}>
      <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 backdrop-blur px-2 py-2">
        <input
          value={comfyBaseUrl}
          onChange={(event) => setComfyBaseUrl(event.target.value)}
          placeholder="Comfy URL, z. B. http://127.0.0.1:8188"
          className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-zinc-950/80 text-[11px] font-mono text-zinc-200"
        />
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-3 py-2 rounded-lg border border-white/10 bg-zinc-900/80 text-[10px] font-black uppercase tracking-wider text-zinc-200"
        >
          <span className="inline-flex items-center gap-1"><RefreshCw size={12} /> Reload</span>
        </button>
        <button
          onClick={() => window.open(comfyUrl, "_blank", "noopener,noreferrer")}
          className="px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/20 text-[10px] font-black uppercase tracking-wider text-blue-200"
        >
          <span className="inline-flex items-center gap-1"><ExternalLink size={12} /> External</span>
        </button>
      </div>

      <webview
        key={reloadKey}
        src={comfyUrl}
        className="w-full h-full"
        style={{ position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" }}
        allowpopups="true"
        webpreferences="contextIsolation=yes"
      />
    </div>
  );
}
