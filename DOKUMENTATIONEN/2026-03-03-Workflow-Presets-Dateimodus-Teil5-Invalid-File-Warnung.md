# 2026-03-03 – Workflow-Presets Dateimodus (Teil 5, Warnung bei defekten Dateien)

## Aufgabe
Naechster ToDo-Schritt: defekte Preset-Dateien sollen nicht still geschluckt werden, sondern mit klarer Rueckmeldung geladen werden.

## Umsetzung
Datei:
- `apps/desktop/src/main/index.ts`

### Aenderungen
1. `readWorkflowPresetsFromDisk(...)` liefert jetzt:
   - `presets`
   - `invalidFiles` (Liste fehlerhafter `*.presets.json`)
2. Pro-Datei Parse/Schema-Fehler werden gesammelt (Dateiname), statt komplett stumm zu bleiben.
3. `getWorkflowPresets()` gibt bei vorhandenen defekten Dateien eine klare Warning-Message zurueck:
   - `Workflow presets loaded with warnings. Invalid files ignored: ...`
4. `saveWorkflowPresets()` nutzt weiterhin den gemergten gueltigen Bestand und ignoriert defekte Dateien deterministisch.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Defekte Preset-Dateien blockieren den Betrieb nicht mehr still und sind gleichzeitig sichtbar diagnostizierbar.