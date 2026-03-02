# 2026-03-02 – Workflow-Presets Dateimodus (Teil 2)

## Aufgabe 2
Legacy-Presetdatei bei Migration absichern.

## Umsetzung
Datei:
- `apps/desktop/src/main/index.ts`

Neu:
1. `backupLegacyWorkflowPresetsIfPresent(projectRoot)` eingefuehrt.
2. Backup-Logik:
   - Quelle: `workflows/presets.json` (Legacy)
   - Ziel: `workflows/presets.migrated.<timestamp>.bak.json`
3. Sicherheitsregel:
   - Backup wird nur erstellt, wenn Legacy existiert.
   - Falls bereits ein `presets.migrated.*.bak.json` vorhanden ist, wird kein weiteres Backup erzeugt.
4. Hook:
   - Backup wird beim `saveWorkflowPresets(...)` vor dem Schreiben der neuen per-Workflow-Dateien ausgefuehrt.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Migration ist jetzt vorsichtiger:
- Altbestand bleibt per Backup nachvollziehbar erhalten,
- bevor neue per-Workflow-Dateien als primäre Quelle geschrieben werden.