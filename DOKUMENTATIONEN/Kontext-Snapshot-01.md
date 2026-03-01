### Desktop App + Shared Types + Project Schema + Save/Load

## Ziel

Grundgerüst steht, Projektdateien sind versioniert, Save/Load funktioniert.

## Acceptance Criteria

- `pnpm dev` oder `npm run dev` startet die App (Windows) ohne Fehler
- Electron + React + TypeScript (`strict`) läuft
- `packages/shared` existiert und exportiert:
  - `Project`
  - `Asset`
  - `Timeline`
  - `Clip`
  - `WorkflowDefinition`
  - `WorkflowRun`
- `project.schema.json` existiert mit:
  - `schemaVersion` (z.B. `1`)
  - Validierung für `Project`
- In der App:
  - Button **New Project**
  - Button **Save Project**
  - Button **Load Project**
- Speichern/Laden funktioniert für ein Dummy-Projekt (lokaler Ordner)
- `lint`, `typecheck`, `format` sind konfiguriert und laufen durch

## Out of scope

- Keine Timeline-Canvas
- Kein ComfyUI
- Kein FFmpeg

## Definition of Done

- README mit Start-Anleitung (Windows)
- Ein „Hello Project“ kann gespeichert und wieder geladen werden
