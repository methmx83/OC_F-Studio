# 2026-03-01 – Comfy Stabilität Block 2 (Run-Status UX + Retry-Härtung)

## Ziel
Workflow-Studio bei laufenden/fehlgeschlagenen Comfy-Runs robuster und besser lesbar machen.

## Umgesetzt

### 1) Run-State um `updatedAt` erweitert
Dateien:
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `apps/desktop/src/renderer/src/core/store/slices/workflowStudioSlice.ts`
- `apps/desktop/src/renderer/src/core/store/utils/workflowStoreUtils.ts`

Details:
- `QueuedWorkflowRun` enthält jetzt zusätzlich `updatedAt`.
- Beim lokalen Queue-Start wird `createdAt` + `updatedAt` initial gesetzt.
- Bei jedem Comfy-Run-Event wird `updatedAt = event.occurredAt` synchronisiert.

### 2) Recent-Runs UX verbessert
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- Anzeige pro Run:
  - `Created`
  - `Updated`
  - `Runtime` (aus Created/Updated)
- `stalled`-Badge für aktive Runs (`pending|running`), wenn länger als 120s kein Update einging.
- Zeitaktualisierung im UI über 15s-Ticker.

### 3) Retry-Flow gehärtet (Doppelstarts vermeiden)
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- Vor Retry wird geprüft, ob bereits ein aktiver (`pending|running`) Run mit identischem Request existiert.
- Falls ja: Retry wird blockiert und ein klarer Hinweis angezeigt.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npm run build --workspace @ai-filmstudio/desktop` ✅

## Wirkung
- Deutlich bessere Transparenz über Run-Fortschritt und „hängt der Run gerade?“.
- Weniger versehentliche Duplicate-Runs durch mehrfaches Retry.
