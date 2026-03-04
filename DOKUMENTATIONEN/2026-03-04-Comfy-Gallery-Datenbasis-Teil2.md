# 2026-03-04 – Comfy Gallery Datenbasis (Teil 2)

## Ziel
Gallery direkt alltagstauglich machen: Preview + Multi-Select + Sammelimport.

## Umsetzung

### 1) Gallery IPC-Basis erweitert
Dateien:
- `packages/shared/src/ipc/project.ts`
- `packages/shared/src/ipc/channels.ts`
- `packages/shared/src/index.ts`
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
- `apps/desktop/src/renderer/src/env.d.ts`

Neu:
- Channel: `project:list-comfy-gallery`
- Response/Item-Typen fuer Gallery-Listing

### 2) Main-Scan angebunden
Datei:
- `apps/desktop/src/main/index.ts`

Neu:
- `listComfyGallery(request?)` liefert Bild/Video-Dateien aus dem Comfy Output Ordner (inkl. Unterordner), sortiert nach `modifiedAt`.
- Handler ist im `registerIpc(...)` verdrahtet.

### 3) Gallery UI (Teil 2)
Datei:
- `apps/desktop/src/renderer/src/features/gallery/ComfyGalleryView.tsx`

Neu:
- Thumbnail-/Preview-Darstellung:
  - `img` fuer Bilder
  - `video` Preview (muted, metadata) fuer Videos
- Multi-Select pro Karte (`Select` Toggle)
- Aktionen:
  - `Import selected (N)`
  - `Import all new` (auf Basis bereits importierter `originalName`)
  - bestehender Einzel-Import bleibt
- Import-Status/Disable-Handling waehrend laufender Imports

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Comfy Gallery ist jetzt funktional als Arbeitsoberflaeche nutzbar:
- sichten,
- selektieren,
- gesammelt importieren.