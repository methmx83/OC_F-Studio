# 2026-03-02 – Workflow-Presets Dateimodus (Teil 1)

## Aufgabe
Eine ToDo-Aufgabe aus dem Preset-Block starten: Weg von `workflows/presets.json` hin zu dateibasierten Presets pro Workflow.

## Umsetzung (Main, erster produktiver Schritt)
Datei:
- `apps/desktop/src/main/index.ts`

Aenderungen:
1. Neue Preset-Pfade eingefuehrt:
   - Legacy: `workflows/presets.json`
   - Neu: `workflows/presets/<workflowId>.presets.json`
2. Lesen erweitert:
   - Liest neue Einzeldateien pro Workflow aus `workflows/presets/`.
   - Faellt fuer Bestand auf Legacy-Datei zurueck.
   - Merge-Verhalten bleibt robust (`mergeWorkflowPresets`), damit Legacy + neue Dateien zusammenlaufen.
3. Schreiben umgestellt:
   - `saveWorkflowPresets(...)` schreibt jetzt in den neuen Ordner `workflows/presets/` pro Workflow eine Datei.
   - Legacy-Datei wird nicht mehr als Ziel verwendet.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Der Dateimodus ist technisch gestartet:
- bestehende Altbestände bleiben lesbar
- neue Saves laufen bereits ins neue, pro-Workflow Dateilayout