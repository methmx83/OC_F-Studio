# 2026-03-03 – Workflow-Presets Dateimodus (Teil 4, Auto-Migration)

## Aufgabe
Naechsten ToDo-Schritt fuer den Preset-Dateimodus umsetzen: Legacy-Bestand beim Laden automatisch in das neue per-Workflow-Dateiformat ueberfuehren.

## Umsetzung
Datei:
- `apps/desktop/src/main/index.ts`

### Neu eingefuehrt
1. `hasPerWorkflowPresetFiles(projectRoot)`
   - prueft, ob bereits `workflows/presets/*.presets.json` existieren.

2. `writePerWorkflowPresetFiles(projectRoot, presets, prune)`
   - zentraler Writer fuer per-Workflow-Presetdateien.
   - optionales Pruning verwaister Dateien.
   - wird jetzt sowohl fuer Migration als auch normales Save genutzt.

### Verhalten in `getWorkflowPresets()`
- Wenn noch **keine** per-Workflow-Presetdateien vorhanden sind,
- aber Legacy `workflows/presets.json` Daten liefert,
- dann wird automatisch:
  1. Legacy einmalig gebackupt,
  2. in per-Workflow-Dateien migriert,
  3. normaler Response mit geladenen Presets geliefert.

### Verhalten in `saveWorkflowPresets()`
- nutzt jetzt den zentralen Writer `writePerWorkflowPresetFiles(..., prune=true)`.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Preset-Dateimodus ist jetzt deutlich robuster:
- Legacy-Daten werden beim ersten Laden automatisch und sicher ins neue Dateiformat ueberfuehrt,
- Save/Prune laufen ueber einen gemeinsamen, deterministischen Dateipfad.