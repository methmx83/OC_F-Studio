# 2026-03-04 – Comfy Live WebView Hotfix

## Problem
`Comfy Live` als `iframe` blieb weiss (Comfy blockiert Einbettung per Frame-Header/CSP).

## Umsetzung
Dateien:
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/renderer/src/features/comfy/ComfyLiveView.tsx`

Aenderungen:
1. Electron-Fenster erlaubt jetzt `webviewTag: true`.
2. `ComfyLiveView` nutzt statt `iframe` jetzt nativen `<webview>`.
3. Reload/Open-external bleiben erhalten.
4. Lokale JSX-Declaration fuer `webview` in der View-Datei, damit TypeScript sauber bleibt.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Comfy kann als native Live-Ansicht in der App gerendert werden, wo `iframe` vorher durch Header blockiert war.