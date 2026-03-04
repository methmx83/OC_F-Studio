# 2026-03-03 – Workflow-Presets Dateimodus (Teil 6, Conflict-Guard)

## Aufgabe
Naechster Preset-Block: Konfliktfall bei extern geaenderten Preset-Dateien absichern (`expectedUpdatedAt` / `PRESET_CONFLICT`).

## Umsetzung

### Shared Contract erweitert
Datei:
- `packages/shared/src/ipc/project.ts`

Neu:
- `WorkflowPresetsSaveRequest`
  - `presets`
  - `expectedUpdatedAtByWorkflow?`
- `WorkflowPresetsResponse`
  - `updatedAtByWorkflow?`

### IPC/Preload/Adapter Signaturen umgestellt
Dateien:
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/env.d.ts`
- `packages/shared/src/index.ts`

Aenderung:
- `saveWorkflowPresets` nimmt jetzt ein Request-Objekt statt nur rohe Preset-Map.

### Main Conflict-Detection
Datei:
- `apps/desktop/src/main/index.ts`

Neu:
1. `buildWorkflowPresetUpdatedAtByWorkflow(...)`
   - berechnet pro Workflow den neuesten `updatedAt`-Stand.
2. `saveWorkflowPresets(request)`
   - vergleicht `request.expectedUpdatedAtByWorkflow` mit aktuellem Disk-Stand.
   - bei Abweichung: Save wird abgebrochen mit
     - `success: false`
     - Message: `PRESET_CONFLICT: Workflow "..." changed on disk...`
     - Rueckgabe der aktuellen Presets + `updatedAtByWorkflow`.
3. `getWorkflowPresets()`
   - liefert nun immer `updatedAtByWorkflow` mit, damit Renderer den erwarteten Stand mitfuehren kann.

### Renderer-Integration
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- State `presetUpdatedAtByWorkflow` eingefuehrt.
- Beim Hydraten aus IPC wird `updatedAtByWorkflow` gesetzt.
- Beim Persistieren wird `expectedUpdatedAtByWorkflow` mitgesendet.
- Nach erfolgreichem Save wird der neue `updatedAtByWorkflow`-Stand uebernommen.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Gleichzeitige/extern verursachte Preset-Aenderungen werden jetzt sauber erkannt. Statt still zu ueberschreiben bekommt die UI einen eindeutigen `PRESET_CONFLICT`-Fehlerpfad.