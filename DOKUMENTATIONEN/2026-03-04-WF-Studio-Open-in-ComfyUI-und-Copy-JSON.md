# 2026-03-04 – WF Studio: Open in ComfyUI + Copy Workflow JSON

## Ziel
Im WF Studio neben `Send to ComfyUI` direkte Debug-/Sichtbarkeitsaktionen anbieten.

## Umsetzung

### Neue Buttons im WF Studio
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
1. `Open in ComfyUI`
   - oeffnet die aktuell konfigurierte Comfy-URL (oder Fallback `http://127.0.0.1:8188`) im Browser.
2. `Copy Workflow JSON`
   - rendert das finale Prompt-Payload (inkl. ersetzter Platzhalter) ueber Main/IPC
   - kopiert das Ergebnis als JSON in die Zwischenablage.

### Neuer Preview-IPC-Flow
Dateien:
- `packages/shared/src/comfy.ts`
- `packages/shared/src/ipc/channels.ts`
- `apps/desktop/src/main/services/comfyService.ts`
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
- `apps/desktop/src/renderer/src/env.d.ts`
- `apps/desktop/src/main/index.ts`

Neu:
- `comfy:preview-run` Channel
- `previewComfyRunPayload(...)` in Main-Service
- Rueckgabe des gerenderten Prompts als JSON (ohne Queue-Start)

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
WF Studio hat jetzt einen klaren Visual-/Debug-Weg:
- ComfyUI direkt oeffnen,
- gerendertes Prompt-JSON 1:1 kopieren und in ComfyUI vergleichen.