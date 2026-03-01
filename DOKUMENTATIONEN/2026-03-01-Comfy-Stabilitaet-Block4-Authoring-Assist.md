# 2026-03-01 – Comfy Stabilität Block 4 (Template/Meta Authoring Assist)

## Ziel
Workflow-/Template-Authoring im Workflow-Studio beschleunigen und typische Meta/API-Fehler früher sichtbar machen.

## Umgesetzt

### 1) Authoring-Assist Panel im Workflow-Studio
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- eigener Abschnitt **Authoring Assist** je ausgewähltem Workflow
- zeigt erwartete Template-Tokens als Liste (`{{...}}`)
- Buttons:
  - `Copy tokens`
  - `Copy meta input stubs`

### 2) Erwartete Token automatisch aus Meta-Inputs abgeleitet
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Logik:
- Basis-Tokens: `workflowId`, `width`, `height`, `fps`, `frames`, `steps`, `projectRoot`
- pro Input-Key zusätzlich:
  - immer: `<key>`
  - falls `...AssetId`: `<base>Path`, `<base>AbsPath`, `<base>Name`, `<base>Type`

### 3) Frühe Konventionsprüfung in der Validierung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- Validierung meldet jetzt explizit, wenn ein `meta.inputs[].key` **nicht** auf `AssetId` endet.
- Dadurch werden Platzhalter-/Mapping-Probleme früher sichtbar.

### 4) Output-Flow-Helfer bleibt integriert
Dateien:
- `apps/desktop/src/renderer/src/core/store/selectors/workflowStudioSelectors.ts`
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Status:
- `dropAssetToTimeline` ist im Workflow-Studio verfügbar (für den Auto-Place-Flow aus Block 3).

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npm run build --workspace @ai-filmstudio/desktop` ✅

## Wirkung
Beim Erstellen/Anpassen von `.meta.json` + `.api.json` ist sofort sichtbar, welche Token erwartet werden. Das reduziert Trial-and-Error bei Placeholdern und Input-Keys deutlich.