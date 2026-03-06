# 2026-03-06 – Timeline: Frame-Snapshot-Button

## Aufgabe
Button in der Timeline ergaenzen, der am aktuellen Playhead ein Frame als PNG speichert.

## Umsetzung

### 1) Neuer Snapshot-IPC-Flow
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
- `project:save-preview-snapshot`
- Request/Response Typen fuer Snapshot-Export

### 2) Main-Implementierung
Datei:
- `apps/desktop/src/main/index.ts`

Neu:
- `savePreviewSnapshot(...)`
  - erwartet PNG-DataURL + Zeit + optionalen Quellnamen
  - schreibt Datei nach: `exports/snapshots/`
  - Dateiname mit Source + Timecode + Timestamp

### 3) Timeline Button
Datei:
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`

Neu:
- Kamera-Button in Toolbar
- triggert CustomEvent `afs:timeline-snapshot`

### 4) Preview Capture
Datei:
- `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`

Neu:
- lauscht auf `afs:timeline-snapshot`
- erstellt Canvas-Snapshot vom aktuellen Bild/Video-Frame am Playhead
- sendet Snapshot ueber IPC an Main zum Speichern
- Audio-only zeigt Hinweis statt Snapshot

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Ein Klick in der Timeline erzeugt jetzt ein PNG-Snapshot am aktuellen Cursor-Frame und speichert es im Projekt unter `exports/snapshots`.