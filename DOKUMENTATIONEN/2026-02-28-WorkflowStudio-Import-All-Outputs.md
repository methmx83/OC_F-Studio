# 2026-02-28 – Workflow Studio: "Import all outputs" pro Run

## Ziel
Comfy-Outputs schneller in das Projekt uebernehmen, ohne jeden Output einzeln anzuklicken.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Aenderungen:
1. Neuer lokaler UI-State:
   - `importingRunId` zur Anzeige/Deaktivierung waehrend Batch-Import.
2. Neue Aktion:
   - `onImportAllOutputs(run)`
   - Filtert auf unterstuetzte Dateiendungen (`canImportOutputPath`)
   - dedupliziert Pfade
   - importiert sequentiell ueber vorhandene Store-Aktion `importComfyOutputAsset(...)`
3. Neue UI im Bereich `Recent Runs -> Outputs`:
   - Button `Import all`
   - Deaktiviert bei laufendem Import, Busy-State oder wenn keine importierbaren Outputs vorhanden sind.

## Verhalten
- Ein Klick auf `Import all` importiert alle unterstuetzten Output-Dateien des jeweiligen Runs in die Asset-Library.
- Bestehender Einzel-Import (`Import`) bleibt unveraendert verfuegbar.

## Validierung
- `npm run typecheck --workspace @ai-filmstudio/desktop` → OK
- `npm run build --workspace @ai-filmstudio/desktop` → OK

## Hinweis
- Import erfolgt absichtlich sequentiell (stabil/leicht nachvollziehbar, keine parallelen Race-Conditions im aktuellen Store-Flow).
