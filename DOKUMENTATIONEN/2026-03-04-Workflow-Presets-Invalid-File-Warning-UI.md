# 2026-03-04 – Workflow-Presets: Invalid-File Warning sichtbar im UI

## Aufgabe
Naechster praktischer Ausbau nach Teil 6: Warnungen aus Preset-Dateimodus im Workflow-Studio sichtbar machen.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Aenderungen:
1. Neuer UI-State `presetLoadWarning` eingefuehrt.
2. Beim Preset-Hydraten:
   - Wenn Response `success=true` und Message `with warnings` enthaelt,
   - wird die Warnung in `presetLoadWarning` abgelegt.
3. Bei Fehlern/Projektwechsel wird `presetLoadWarning` zurueckgesetzt.
4. Neue Warnkarte im Workflow-Studio:
   - Titel: `Preset Warning`
   - Inhalt: genaue Warning-Message aus Main (z. B. ignorierte invalid files)

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Warnungen zu defekten Preset-Dateien sind jetzt fuer den Nutzer direkt sichtbar und nicht nur implizit im Backend-Response enthalten.