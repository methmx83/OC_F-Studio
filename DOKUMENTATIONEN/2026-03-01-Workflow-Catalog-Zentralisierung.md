# 2026-03-01 – Workflow-Katalog Zentralisierung (WF Studio)

## Ziel
Workflows sollen im WF Studio immer verfuegbar sein, unabhaengig vom aktuell geladenen Projekt.

## Umsetzung

### Katalogquelle erweitert
Datei:
- `apps/desktop/src/main/services/workflowCatalogService.ts`

Neu:
- Catalog scannt jetzt zuerst den **globalen Workflow-Ordner** und optional zusaetzlich den projektlokalen Ordner.
- Quellen:
  - global: `<repo>/workflows`
  - projektlokal: `<projectRoot>/workflows` (falls Projekt geladen)

### Merge-Regel
- Workflows werden nach `id` zusammengefuehrt.
- Bei gleicher ID gewinnt projektlokal (Override), sonst bleibt global.

### Kein harter Projekt-Zwang mehr
- WF-Katalog kann auch ohne projektlokale Workflows sinnvoll gefuellt sein (aus globaler Quelle).

### Main-Wiring
Datei:
- `apps/desktop/src/main/index.ts`

Neu:
- `createWorkflowCatalogService` bekommt `getGlobalWorkflowsRoot()`.
- Aktuell auf: `path.resolve(app.getAppPath(), '../../workflows')`.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
WF Studio ist nicht mehr an den Workflow-Bestand eines einzelnen Projekts gekoppelt. Globale Standard-Workflows koennen zentral gepflegt und in allen Projekten genutzt werden.