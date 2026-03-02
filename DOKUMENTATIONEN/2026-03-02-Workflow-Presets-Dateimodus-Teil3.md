# 2026-03-02 – Workflow-Presets Dateimodus (Teil 3)

## Aufgabe 3
Dateibasierten Preset-Modus robuster machen: verwaiste Preset-Dateien aufraeumen.

## Umsetzung
Datei:
- `apps/desktop/src/main/index.ts`

Aenderungen in `saveWorkflowPresets(...)`:
1. Vor dem Schreiben werden veraltete `*.presets.json` Dateien im Ordner `workflows/presets/` entfernt,
   wenn deren `workflowId` nicht mehr im gemergten Preset-Stand enthalten ist.
2. Schreiben erfolgt jetzt deterministisch in sortierter Reihenfolge der `workflowId`.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Der Dateimodus bleibt sauber:
- keine toten Preset-Dateien bei geloeschten Workflows/Presets,
- reproduzierbares Dateisystem-Ergebnis nach jedem Save.