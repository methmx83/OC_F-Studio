# 2026-03-01 – Comfy Feinschliff: Cancel-Run + Output-Routing-Basis

## Ziel
Comfy-Integration im Alltag abrunden: aktive Runs aus der App abbrechen können und die bestehende Routing-Logik sauber beibehalten.

## Umgesetzt

### 1) Neuer Cancel-Run IPC-Flow (End-to-End)
**Shared Contracts**
- `packages/shared/src/comfy.ts`
  - `CancelComfyRunRequest`
  - `CancelComfyRunResponse`
- `packages/shared/src/ipc/channels.ts`
  - neuer Kanal: `comfy.cancelRun`

**Main/Preload/Renderer Adapter**
- `apps/desktop/src/main/ipc/registerIpc.ts`
  - Handler `cancelComfyRun(...)` + IPC-Registration fuer `comfy:cancel-run`
- `apps/desktop/src/preload/index.ts`
  - `projectApi.cancelComfyRun(...)`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - Port erweitert um `cancelComfyRun(...)`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
  - Guarded-Wrapper fuer `cancelComfyRun(...)`
- `apps/desktop/src/renderer/src/env.d.ts`
  - Window-API-Typ erweitert

### 2) ComfyService: echte Cancel-Operation
- `apps/desktop/src/main/services/comfyService.ts`
  - Service-Interface erweitert: `cancelComfyRun(...)`
  - neuer HTTP-Call auf ComfyUI `POST /interrupt`
  - laufendes Polling fuer den Run wird sofort abgebrochen (`stopPollingRun(runId)`)
  - Run-Event wird als abgeschlossenes `failed`-Event mit klarer Cancel-Message emittiert

### 3) Workflow-Studio UI: Cancel-Button pro aktivem Run
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - Neuer Button `Cancel run` bei `pending/running`
  - eigener Busy-State `cancellingRunId`
  - nutzt denselben URL-Override wie Health/Send/Retry

### 4) Output-Routing
- Bestehender Auto-Place-Flow aus Block 3 bleibt intakt:
  - importierte Outputs werden optional sofort ueber `dropAssetToTimeline(...)` auf passende Spuren geroutet.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npm run build --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Comfy-Integration ist jetzt deutlich bedienbarer im Live-Betrieb:
- Endpoint override
- robuste Health/Queue/Retry
- **aktives Canceln laufender Runs**
- Output-Import mit optionalem Direkt-Routing in die Timeline.