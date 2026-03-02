# 2026-03-02 – WorkflowStudio: Globalen Katalog ohne Projektzwang laden

## Aufgabe (aus ToDo)
Workflow-Studio soll Workflows aus vordefiniertem Ordner laden und nicht von einem geladenen Projekt abhaengen.

## Problem
Im Renderer wurde `loadCatalog()` nur ausgefuehrt, wenn `projectRoot` gesetzt war. Dadurch blieb WF Studio leer, obwohl globale Workflows vorhanden waren.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Aenderungen:
1. Projekt-Guard fuer Katalogladen entfernt:
   - `loadCatalog()` wird jetzt immer im `useEffect` aufgerufen (auch ohne Projekt).
2. Leerer-Zustand-Info angepasst:
   - Pfadanzeige nutzt jetzt `catalog?.projectWorkflowsRoot ?? "workflows"` statt `${projectRoot}\workflows`.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Erwartetes Ergebnis
WF Studio kann globale Workflows anzeigen, auch wenn (noch) kein Projekt geladen ist.