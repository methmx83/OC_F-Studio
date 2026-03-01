import React, { useMemo } from "react";
import { Search, Film, Image as ImageIcon, Plus, Video, Music2 } from "lucide-react";

import { useShallow } from "zustand/shallow";

import { selectAssetLibraryStoreState } from "../../core/store/selectors";
import { useStudioStore } from "../../core/store/studioStore";

export default function AssetLibraryView() {
  const {
    filter,
    query,
    assets,
    thumbnails,
    isProjectBusy,
    hasProject,
    setFilter,
    setQuery,
    importVideoAsset,
    importImageAsset,
    importAudioAsset,
  } = useStudioStore(useShallow(selectAssetLibraryStoreState));

  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (filter !== "All" && asset.type !== filter) return false;
      if (query.trim() && !asset.originalName.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [assets, filter, query]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 w-80">
      <div className="p-4 border-b border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[10px] tracking-[0.2em] uppercase text-zinc-500">
            Library
          </h2>
          <div className="flex gap-1">
            <button
              title="Import Image"
              disabled={isProjectBusy || !hasProject}
              className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30"
              onClick={() => void importImageAsset()}
            >
              <ImageIcon size={14} />
            </button>
            <button
              title="Import Video"
              disabled={isProjectBusy || !hasProject}
              className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30"
              onClick={() => void importVideoAsset()}
            >
              <Video size={14} />
            </button>
            <button
              title="Import Audio"
              disabled={isProjectBusy || !hasProject}
              className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30"
              onClick={() => void importAudioAsset()}
            >
              <Music2 size={14} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={12} />
          <input
            type="text"
            placeholder="Search assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-3 text-[10px] focus:outline-none focus:border-blue-500 transition-all font-mono"
          />
        </div>
      </div>

      <div className="flex p-2 gap-1 border-b border-zinc-800 overflow-x-auto no-scrollbar bg-zinc-900/50">
        {(["All", "video", "image", "audio"] as const).map((tag) => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${
              filter === tag ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {visibleAssets.map((asset) => {
            const thumbnail = thumbnails[asset.id];
            return (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-asset", JSON.stringify({ assetId: asset.id }));
                }}
                className="group relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-video cursor-grab active:cursor-grabbing hover:border-blue-500 transition-all shadow-lg"
              >
              {thumbnail ? (
                <img src={thumbnail} alt={asset.originalName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700 select-none">
                  {asset.type === "image" ? <ImageIcon size={28} /> : asset.type === "audio" ? <Music2 size={28} /> : <Film size={28} />}
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-2 opacity-90 group-hover:opacity-100">
                <div className="flex items-center justify-between gap-1 text-[9px] text-zinc-300 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-1.5 truncate flex-1">
                    {asset.type === "image" ? <ImageIcon size={10} className="text-blue-400" /> : asset.type === "audio" ? <Music2 size={10} className="text-violet-300" /> : <Film size={10} />}
                    <span className="truncate">{asset.originalName}</span>
                  </div>
                  <span className="text-[8px] text-zinc-500 font-mono">{asset.status}</span>
                </div>
              </div>
            </div>
          );
        })}

        </div>

        {visibleAssets.length === 0 && (
          <div className="h-32 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center p-4 mt-2">
            <Plus size={20} className="text-zinc-700 mb-2" />
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
              No Assets
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
