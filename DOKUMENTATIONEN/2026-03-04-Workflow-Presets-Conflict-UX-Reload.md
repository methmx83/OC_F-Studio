# 2026-03-04 – Workflow-Presets Conflict UX (Auto-Reload)

## Aufgabe
Ein weiterer ToDo-Schritt nach technischem Conflict-Guard: bessere Renderer-Reaktion bei `PRESET_CONFLICT`.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Aenderung im Preset-Save-Flow:
- Wenn Main `PRESET_CONFLICT` meldet:
  1. Preset-Stand aus Response wird direkt in den Renderer geladen (`setPresetsByWorkflow`).
  2. `updatedAtByWorkflow` wird aktualisiert.
  3. User bekommt klare Fehlermeldung mit Handlung: extern geaendert, neu geladen, erneut speichern.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Conflict-Fall ist jetzt nicht nur technisch abgesichert, sondern auch UX-seitig sauber: kein stilles Scheitern, kein veralteter Zustand im UI.