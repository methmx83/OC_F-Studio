# 2026-03-06 – Preset-Dateimodus Punkt 2: Conflict-UX finalisiert

## Aufgabe
Block 2 umsetzen: `PRESET_CONFLICT` im Workflow-Studio UX-seitig sauber behandeln.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

### Neu
1. Konfliktzustand als eigener UI-State:
   - `presetConflictMessage`
2. Bei erfolgreichem Laden/Speichern wird der Konfliktstatus geloescht.
3. Bei `PRESET_CONFLICT` aus `saveWorkflowPresets(...)`:
   - Preset-Stand + `updatedAtByWorkflow` werden wie bisher neu synchronisiert.
   - zusaetzlich wird eine sichtbare Konfliktkarte gesetzt.
4. Neuer Handler `onReloadWorkflowPresets()`:
   - laedt Presets bewusst neu per IPC
   - setzt Warning/Conflict-State konsistent
5. Neue UI-Konfliktkarte:
   - Titel `Preset Conflict`
   - klare Meldung
   - Aktion `Neu laden`

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Der Konfliktfall ist jetzt nicht nur technisch abgefangen, sondern fuer den Nutzer explizit sichtbar und direkt aufloesbar.