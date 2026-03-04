# 2026-03-04 – Comfy Live Tab Einbettung (Teil 1)

## Wunsch
ComfyUI direkt in der App sehen/bedienen statt externes Fenster als Hauptweg.

## Umsetzung

### Neuer Tab
Datei:
- `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`

Neu:
- Navigationseintrag `Comfy Live`
- View-Routing fuer `activeView === "comfy"`

### Neue View
Datei:
- `apps/desktop/src/renderer/src/features/comfy/ComfyLiveView.tsx`

Neu:
- eingebettete ComfyUI ueber `iframe`
- URL-Eingabe (nutzt vorhandene `comfyBaseUrl` im Store)
- Buttons:
  - `Reload`
  - `Open external`

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Hinweis
Ob ComfyUI im `iframe` dargestellt werden kann, haengt von der jeweiligen ComfyUI-Version/Headern ab. Bei Blockierung kann weiterhin `Open external` genutzt werden.
