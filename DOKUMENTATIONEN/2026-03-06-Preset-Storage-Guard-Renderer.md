# 2026-03-06 – Preset-Dateimodus Punkt 1: Renderer-Storage-Guard

## Aufgabe
Punkt 1 abschliessen: sicherstellen, dass Workflow-Presets im Renderer nicht mehr ueber Browser-Storage laufen.

## Umsetzung
Dateien:
- `apps/desktop/scripts/validate-preset-storage.mjs`
- `apps/desktop/package.json`

Neu:
1. Validierungs-Skript `validate-preset-storage.mjs`
   - prueft `WorkflowStudioView.tsx` explizit auf verbotene Browser-Storage-Nutzung fuer Presets (`localStorage`, preset-bezogene sessionStorage-Zugriffe).
   - bricht mit Exit-Code 1 ab, falls Treffer vorhanden sind.
2. NPM-Skript hinzugefuegt:
   - `validate:preset-storage`

## Verifikation
- `npm run validate:preset-storage --workspace @ai-filmstudio/desktop` ✅
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Preset-Dateimodus ist fuer Punkt 1 gehaertet:
- keine renderer-seitige Browser-Storage-Persistenz fuer Workflow-Presets,
- Guard vorhanden, damit Rueckfaelle sofort auffallen.