# AI-FilmStudio

Desktop Video/AI-Editor auf Basis von Electron + React + TypeScript (strict) mit Shared-Contracts im Monorepo.

## Aktueller Stand

- Projekt-Lifecycle: `New Project`, `Load Project`, `Save Project` (JSON-basiert)
- Asset-Import: Bild/Video inkl. Thumbnail-Hydration
- Timeline: Track-basiertes Modell, Drag/Trim, Cut, Ripple Delete, Slip, Undo/Redo
- Preview: Playback, Playhead/Scrubber, Proxy-Toggle, Source-Lock/Fallback-Logik
- FFmpeg-Integration: Health-Check und Video-Proxy-Erzeugung
- Workflow Studio: Katalog aus projektlokalen `workflows/*/*.meta.json`, Konfiguration und Queueing
- ComfyUI-Bridge: Health, Queue-Run, Run-Events, Output-Import ins Projekt

## Voraussetzungen (Windows-first)

- Windows 10/11
- Node.js 22.x (empfohlen)
- npm 10+
- Optional, aber empfohlen fuer Video-Flow: FFmpeg im `PATH`

## Quickstart (PowerShell)

```powershell
npm install
npm run dev
```

## Build- und Guardrail-Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Manueller Smoke-Test

Die versionierte Smoke-Checkliste liegt hier:

- [`scripts/smoke.md`](./scripts/smoke.md)

## Wichtige Skripte (Root)

- `npm run dev` - startet `@ai-filmstudio/desktop` im Dev-Modus
- `npm run typecheck` - TypeScript-Checks ueber Workspaces
- `npm run lint` - ESLint ueber Workspaces
- `npm run build` - baut `shared` und danach `desktop`
- `npm run format` - Prettier Check
- `npm run format:write` - Prettier Write

## Repo-Struktur

- `apps/desktop` - Electron Main/Preload + React Renderer
- `packages/shared` - Shared Types, IPC-Contracts, Schemas
- `DOKUMENTATIONEN` - Projekt-, Refactor- und Hardening-Doku
