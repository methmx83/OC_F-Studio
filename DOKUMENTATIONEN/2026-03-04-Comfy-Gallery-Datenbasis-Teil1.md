# 2026-03-04 – Comfy Gallery Datenbasis (Teil 1)

## Ziel
Nach dem vorbereiteten Gallery-Tab eine echte Datenbasis liefern: Output-Ordner scannen und Dateien direkt in die App importieren.

## Umsetzung

### 1) Neue IPC-Contracts + Channel
Dateien:
- `packages/shared/src/ipc/project.ts`
- `packages/shared/src/ipc/channels.ts`
- `packages/shared/src/index.ts`

Neu:
- `project:list-comfy-gallery`
- Typen:
  - `ComfyGalleryListRequest`
  - `ComfyGalleryItem`
  - `ComfyGalleryListResponse`

### 2) Main-Prozess: echter Dateiscan
Datei:
- `apps/desktop/src/main/index.ts`

Neu:
- `listComfyGallery(request?)`
  - scannt konfigurierten Output-Ordner (inkl. Unterordner)
  - filtert auf `image`/`video`
  - liefert Dateimetadaten (Pfad, Name, Typ, Groesse, modifiedAt)
  - sortiert neueste zuerst
  - Fehlerbehandlung bei fehlendem/ungueltigem Ordner

### 3) IPC-Wiring bis Renderer
Dateien:
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
- `apps/desktop/src/renderer/src/env.d.ts`

Neu:
- `listComfyGallery(request?)` im kompletten Pfad Main -> Preload -> Renderer.

### 4) Neue Gallery-View mit echtem Listing
Dateien:
- `apps/desktop/src/renderer/src/features/gallery/ComfyGalleryView.tsx`
- `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`

Neu:
- Tab `Gallery` zeigt jetzt echte Daten:
  - Output-Ordner Eingabe (lokal persistiert)
  - Refresh
  - Filter (`all`/`image`/`video`)
  - Dateiliste als Grid
  - Einzel-Import pro Datei via bestehendem `importComfyOutputAsset(...)`

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Comfy Gallery ist jetzt nicht mehr nur Platzhalter, sondern hat eine echte Datenbasis mit funktionierendem Scan + Import-Flow (Teil 1).