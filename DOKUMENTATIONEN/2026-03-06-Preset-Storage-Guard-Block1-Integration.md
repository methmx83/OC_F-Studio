# 2026-03-06 – Preset-Dateimodus: Block 1 Guard in Standard-Pipeline integriert

## Aufgabe
Nach Einfuehrung des Preset-Storage-Guards soll dieser automatisch in die normalen Dev-Checks eingebunden sein.

## Umsetzung
Dateien:
- `apps/desktop/package.json`
- `apps/desktop/scripts/clean-emitted-js.mjs`
- `apps/desktop/scripts/validate-preset-storage.mjs`
- `apps/desktop/eslint.config.cjs`

### Aenderungen
1. Guard in Pipeline integriert:
- `pretypecheck` fuehrt jetzt aus:
  - `clean:emitted-js`
  - `validate:preset-storage`
- `prelint` fuehrt jetzt ebenfalls den Guard aus.

2. Skript-Lint sauber gemacht:
- Node-Globals fuer die `.mjs` Skripte explizit gesetzt (`process`, `console`).
- Damit laufen Lint/Typecheck wieder ohne Nebenfehler.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npm run lint --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Der Preset-Dateimodus ist jetzt in der Standard-Qualitaetspipeline abgesichert. Ein Rueckfall auf Renderer-Browser-Storage fuer Presets faellt bei normalen Checks sofort auf.