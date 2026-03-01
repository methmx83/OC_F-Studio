# 2026-03-01 – Comfy Stabilität Block 3 (Output-Flow smarter)

## Ziel
Output-Import aus `Recent Runs` praxisnäher machen: weniger Klicks nach dem Import, besserer Übergang in den Schnitt-Flow.

## Umgesetzt

### 1) Auto-Place für importierte Outputs
Dateien:
- `apps/desktop/src/renderer/src/core/store/selectors/workflowStudioSelectors.ts`
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- `WorkflowStudioView` bekommt Zugriff auf `dropAssetToTimeline`.
- Neues UI-Toggle in `Recent Runs`: `Auto-Place: ON/OFF`.
- Wenn aktiviert, wird jedes neu importierte Output-Asset direkt in die Timeline gelegt (typbasierte Spurwahl über bestehende `dropAssetToTimeline`-Logik).

### 2) Einzel-Import erweitert
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- Beim Einzel-Import wird der Asset-State vor/nach Import verglichen.
- Neu hinzugekommene Assets werden erkannt.
- Bei aktivem Auto-Place werden diese Assets sofort in die Timeline eingefügt.

### 3) Import-All erweitert
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Neu:
- Import-All nutzt ebenfalls eine robuste Vorher/Nachher-Erkennung je Output.
- Nur tatsächlich neu importierte Assets gelten als Import-Erfolg.
- Bei aktivem Auto-Place werden diese Assets pro Import direkt auf der Timeline abgelegt.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npm run build --workspace @ai-filmstudio/desktop` ✅

## Wirkung
Comfy-Output -> Library -> Timeline ist jetzt ein deutlich glatterer Flow. Bei aktivem Auto-Place kannst du nach erfolgreichem Run schneller direkt im Schnitt weiterarbeiten.