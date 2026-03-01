# 2026-03-01 – Issue #1: Workflow-Presets auf projekt-lokale Dateien (IPC)

## Ziel
Preset-Speicherung im Workflow Studio von `localStorage` auf projekt-lokale Dateien umstellen, damit Presets versionierbar, reproduzierbar und projektgebunden sind.

## Umgesetzte Änderungen

### 1) Neue IPC-API für Presets
- Neue Channels ergänzt:
  - `project:get-workflow-presets`
  - `project:save-workflow-presets`
- Neue Shared-IPC-Typen ergänzt:
  - `WorkflowPresetDraft`
  - `WorkflowPresetItem`
  - `WorkflowPresetsMap`
  - `WorkflowPresetsResponse`
- Betroffene Dateien:
  - `packages/shared/src/ipc/channels.ts`
  - `packages/shared/src/ipc/project.ts`
  - `packages/shared/src/index.ts`
  - `apps/desktop/src/main/ipc/registerIpc.ts`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
  - `apps/desktop/src/renderer/src/env.d.ts`

### 2) Main-Prozess: Preset-Read/Write auf Projektdatei
- Neue projekt-lokale Datei:
  - `workflows/presets.json`
- Implementiert in `apps/desktop/src/main/index.ts`:
  - Normalisierung/Validierung eingehender Presets (`normalizeWorkflowPresetsMap`)
  - Lesen von Disk (`readWorkflowPresetsFromDisk`)
  - Merge-Strategie bei parallelen/external Änderungen (`mergeWorkflowPresets`)
    - Zusammenführung über `preset.id`
    - Konfliktauflösung per `updatedAt` (neuester Stand gewinnt)
    - Begrenzung auf max. 20 Presets pro Workflow
  - IPC-Handler:
    - `getWorkflowPresets()`
    - `saveWorkflowPresets(presets)`

### 3) Renderer: Umstellung von localStorage auf IPC
- `WorkflowStudioView.tsx`:
  - Laden der Presets beim Projektwechsel über `getWorkflowPresets()`
  - Persistenz über `saveWorkflowPresets()` statt `localStorage`
  - Alte `localStorage`-Hilfsfunktionen entfernt
  - UI-Status für laufendes Speichern (`Saving...`) ergänzt
  - Schutz gegen unnötige Re-Set-Loop über Vergleich der serialisierten Maps vor `setState`

## Ergebnis
- Presets sind jetzt projekt-lokal gespeichert (`workflows/presets.json`) statt nur browserlokal.
- Externe Dateiänderungen werden beim Speichern nicht blind überschrieben, sondern per Merge-Strategie berücksichtigt.
- Workflow Studio bleibt funktional, inklusive Preset Create/Apply/Delete.

## Validierung
- `npm run typecheck` ✅
- `npm run build` ✅

## Nächster Schritt
- Optionaler Migrationspfad: vorhandene Alt-Presets aus `localStorage` einmalig in `workflows/presets.json` übernehmen (best-effort, mit Nutzerhinweis).
