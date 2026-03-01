# 2026-03-01 – Comfy Integration: Endpoint-Override im Workflow Studio

## Ziel
Comfy-Integration ohne starre ENV-Abhängigkeit nutzbar machen: Comfy-URL direkt in der App setzen und für Health + Queue verwenden.

## Umgesetzt

### 1) Shared Contracts erweitert
Datei:
- `packages/shared/src/comfy.ts`

Neu:
- `ComfyHealthRequest { baseUrlOverride?: string }`
- `QueueComfyRunRequest` erweitert um `baseUrlOverride?: string`

### 2) IPC/Preload/Adapter auf optionales Health-Request-Payload umgestellt
Dateien:
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
- `apps/desktop/src/renderer/src/env.d.ts`

Neu:
- `getComfyHealth(request?)` statt hardcoded ohne Payload.

### 3) Main-Comfy-Service unterstützt URL-Override
Dateien:
- `apps/desktop/src/main/services/comfyService.ts`
- `apps/desktop/src/main/index.ts`

Neu:
- `resolveComfyBaseUrlPolicy(baseUrlOverride?)`
- `getComfyHealth(request?)` nutzt optionalen Override
- `queueComfyRun(payload)` nutzt `payload.baseUrlOverride`, falls gesetzt

### 4) Store + Workflow Studio UI
Dateien:
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `apps/desktop/src/renderer/src/core/store/slices/comfySlice.ts`
- `apps/desktop/src/renderer/src/core/store/slices/workflowStudioSlice.ts`
- `apps/desktop/src/renderer/src/core/store/selectors/workflowStudioSelectors.ts`
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- Store-State: `comfyBaseUrl`
- Action: `setComfyBaseUrl(url)` (persistiert via localStorage)
- Healthcheck verwendet URL-Override aus Store
- Queue (Send/Retry und store-basierte Queue) verwendet URL-Override
- Workflow-Studio Header: Eingabefeld `Comfy URL Override`

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npm run build --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Comfy kann jetzt projekt-/sessionnah aus der UI gegen beliebige lokale Instanzen getestet und genutzt werden (z. B. `http://127.0.0.1:8188`), ohne ENV-Neustarts.