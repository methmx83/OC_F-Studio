# 2026-03-06 – Preset Conflict UX Block 2 Follow-up

## Aufgabe
Naechster Task nach Block 2: Konfliktbanner soll nicht unnoetig stehen bleiben, sobald der User aktiv weiterarbeitet.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Aenderungen:
- `presetConflictMessage` wird jetzt auch bei aktiver Nutzeraktion zurueckgesetzt:
  - bei Settings-Aenderung (`onNum`)
  - bei Input-Aenderung (`onInput`)
  - bei Preset speichern (`onSavePreset`)
  - bei Preset anwenden (`onApplyPreset`)
  - bei Preset loeschen (`onDeletePreset`)

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Conflict-UX fuehlt sich jetzt klarer an:
- Konflikt wird sichtbar, solange relevant.
- Bei aktiver Bearbeitung/Neustart des Flows verschwindet der alte Konflikthinweis automatisch.