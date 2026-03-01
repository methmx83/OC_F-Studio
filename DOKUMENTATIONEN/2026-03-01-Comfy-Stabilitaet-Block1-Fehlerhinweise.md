# 2026-03-01 – Comfy Stabilität Block 1 (Fehlerhinweise + Validierungstexte)

## Ziel
Workflow-Studio robuster und verständlicher machen, speziell bei Queue-/Comfy-Fehlern ohne lokale Comfy-Instanz im Dev-Environment.

## Umgesetzt

### 1) Kontext-Hinweise für Send/Retry-Fehler
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- `resolveComfyActionHint(message)` erkennt typische Fehlerbilder und liefert konkrete Handlungs-Hinweise.
- Diese Hinweise werden angezeigt bei:
  - `Send to ComfyUI` Fehlerzustand
  - `Retry failed run` Fehlerzustand
  - fehlgeschlagenen Einträgen in `Recent Runs`

Abgedeckte Fälle u. a.:
- kein Projekt geladen
- fehlendes API-Template
- unresolved placeholders (`{{...}}`) in `.api.json`
- Asset-ID nicht gefunden
- Comfy nicht erreichbar (`ECONNREFUSED` / fetch failed)
- Remote-Policy blockiert (`COMFYUI_ALLOW_REMOTE`)
- HTTP 4xx/5xx von `/prompt`

### 2) Validierungstexte im Workflow-Studio präzisiert (DE)
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Angepasst:
- Pflicht-Input leer
- Asset existiert nicht mehr im Projekt
- Input-Typ passt nicht zum Asset-Typ
- API-Template fehlt

Ziel: schneller erkennbar, ob Fehler in Meta, Asset-Auswahl oder API-Template liegt.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Wirkung
Der Workflow-Studio-Flow bleibt gleich, aber Fehlersituationen sind deutlich besser interpretierbar und führen schneller zur korrekten Gegenmaßnahme (statt generischem „failed“).