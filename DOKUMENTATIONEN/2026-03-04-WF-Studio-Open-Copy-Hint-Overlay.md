# 2026-03-04 – WF Studio: Open/Copy Verhalten + Hinweis-Overlay

## Wunsch
1. Beim Klick auf `Open in ComfyUI` soll Workflow-JSON automatisch kopiert werden.
2. Zusaetzlicher Button `Open + Copy` (One-Click).
3. Kleines Hinweis-Overlay fuer Einfuegen/Import in ComfyUI.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

### Neu
- `buildRenderedPayloadJson()` als gemeinsame Render-Quelle.
- `onOpenAndCopyComfyUi()`:
  - oeffnet ComfyUI
  - kopiert gerendertes Workflow-JSON in Clipboard
  - zeigt kurzes Overlay-Hinweisfenster (5s)

### Button-Verhalten
- `Open in ComfyUI` -> fuehrt Open+Copy aus.
- `Open + Copy` -> ebenfalls One-Click Open+Copy (explizite Option).
- `Copy Workflow JSON` bleibt separat erhalten.

### Overlay
- Hinweistext im WF Studio:
  - JSON wurde kopiert
  - in ComfyUI einfuegen/importieren (Ctrl+V / Clipboard/JSON Import)

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅