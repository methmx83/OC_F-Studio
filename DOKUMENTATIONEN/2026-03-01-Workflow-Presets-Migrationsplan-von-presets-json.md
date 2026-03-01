# Workflow-Presets Migration: `workflows/presets.json` -> `workflows/presets/<workflowId>.presets.json`

Stand: 2026-03-01

## Ziel
Projekt-lokale Presets von einer Sammeldatei (`workflows/presets.json`) auf pro-Workflow-Dateien umstellen, ohne Datenverlust und ohne UI-Blocker.

## Ausgangslage
- Altformat: eine Datei `workflows/presets.json` mit Map `{ [workflowId]: WorkflowPreset[] }`.
- Zielformat: eine Datei pro Workflow unter `workflows/presets/<workflowId>.presets.json`.

## Migrationsstrategie (deterministisch)
1. Beim ersten Preset-Read pro Projekt:
   - Wenn neue Zielstruktur vorhanden: direkt aus Zielstruktur lesen.
   - Sonst, wenn Altdatei vorhanden: Altdatei einlesen und in Zielstruktur migrieren.
2. Migration schreibt pro Workflow genau eine Datei ins Zielformat.
3. Nach erfolgreicher Migration:
   - Altdatei wird in `workflows/presets.migrated.<timestamp>.bak.json` umbenannt.
   - Kein stilles Loeschen.
4. Bei Teilfehlern:
   - Bereits geschriebene Ziel-Dateien bleiben bestehen.
   - Fehlercode + UI-Hinweis liefern, damit Nutzer erneut versuchen kann.

## Dateiformat (pro Workflow)
```json
{
  "version": 1,
  "workflowId": "wan_animate_i2v",
  "updatedAt": "2026-03-01T11:00:00.000Z",
  "presets": [
    {
      "id": "preset_fast_preview",
      "name": "Fast Preview",
      "createdAt": "2026-03-01T10:50:00.000Z",
      "updatedAt": "2026-03-01T11:00:00.000Z",
      "draft": {
        "settings": { "width": 768, "height": 432, "fps": 12, "frames": 49, "steps": 8 },
        "inputs": { "refIMGAssetId": "asset_123" }
      }
    }
  ]
}
```

## Validierungsregeln
- `version` muss `1` sein.
- `workflowId` muss Dateinamen entsprechen.
- `presets.length <= 20` pro Workflow.
- `preset.name` getrimmt, 1..64 Zeichen.
- Zeitstempel muessen ISO-8601 parsebar sein.

## Akzeptanzkriterien
- Bestehende Presets aus Altformat sind nach Migration vollstaendig vorhanden.
- Zweiter App-Start fuehrt keine erneute Migration aus.
- Fehler in einer Preset-Datei blockieren nicht die gesamte App.
- Typecheck und bestehende Workflow-Studio-Smoketests bleiben gruen.

## Test-Checkliste (kurz)
1. Projekt mit nur Altdatei laden -> Migration wird ausgeloest.
2. Presets in UI sichtbar, anwendbar, speicherbar, loeschbar.
3. Backup-Datei existiert, Altdatei nicht mehr aktiv genutzt.
4. App neu starten -> keine erneute Migration, Daten konsistent.
5. Defekte Preset-Datei simulieren -> klare UI-Fehlermeldung, App bleibt nutzbar.
