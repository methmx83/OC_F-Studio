# 2026-03-06 – Gallery: Neuer Ordner

## Aufgabe
In der Gallery eine Funktion ergaenzen, mit der direkt ein neuer Unterordner im gesetzten Comfy-Output-Ordner erstellt werden kann.

## Umsetzung

### 1) Neue IPC-Contracts + Channel
Dateien:
- `packages/shared/src/ipc/project.ts`
- `packages/shared/src/ipc/channels.ts`
- `packages/shared/src/index.ts`

Neu:
- `CreateComfyGalleryFolderRequest`
- `CreateComfyGalleryFolderResponse`
- Channel: `project:create-comfy-gallery-folder`

### 2) Main/IPC/Preload/Adapter
Dateien:
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
- `apps/desktop/src/renderer/src/env.d.ts`

Neu:
- `createComfyGalleryFolder(...)` mit Validierung:
  - leerer Name blockiert
  - nur erlaubte Zeichen
  - keine Pfadflucht ausserhalb des Output-Ordners
  - erkennt bestehenden Ordner/Dateikonflikt

### 3) Gallery UI
Datei:
- `apps/desktop/src/renderer/src/features/gallery/ComfyGalleryView.tsx`

Neu:
- Eingabefeld `Neuer Ordnername`
- Button `Neuer Ordner`
- nach Erfolg: Feld leeren + Gallery auto-refresh
- Statusmeldung direkt in der Gallery

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Ordnerstruktur fuer Comfy-Outputs kann jetzt direkt in der App gepflegt werden, ohne externen Dateimanager.