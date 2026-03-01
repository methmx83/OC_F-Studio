# 2026-02-28 – Timeline Audio: Globales Reset fuer Mute/Solo (Clear M/S)

## Ziel
Eine offene ToDo-Aufgabe aus `DOKUMENTATIONEN/ToDo.md` umsetzen:
- Track Controls um globale Reset-Aktion fuer Audio-Mix-States erweitern (`Clear all M/S`).

## Umgesetzte Schritte

1. **Preview-Slice erweitert**
   - Datei: `apps/desktop/src/renderer/src/core/store/slices/previewSlice.ts`
   - Neuer Store-Action-Key: `clearTrackAudioMixStates`
   - Implementierung setzt beide Maps hart zurueck:
     - `trackAudioMutedById = {}`
     - `trackAudioSoloById = {}`

2. **Store-Typen aktualisiert**
   - Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
   - `StudioState` um Methode erweitert:
     - `clearTrackAudioMixStates: () => void`

3. **Selector fuer Timeline-Dock erweitert**
   - Datei: `apps/desktop/src/renderer/src/core/store/selectors/timelineSelectors.ts`
   - `selectTimelineDockStoreState` gibt jetzt zusaetzlich `clearTrackAudioMixStates` weiter.

4. **Timeline-UI erweitert**
   - Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
   - Neuer Button im Track-Header: **`Clear M/S`**
   - Button ruft `clearTrackAudioMixStates()` auf.
   - Button ist deaktiviert, wenn keine aktiven Overrides vorhanden sind (`Mute`/`Solo` nirgendwo gesetzt).

## Validierung

Ausgefuehrt im Projekt-Root `D:\OpenClaw\workspace\Projekte\AI-FilmStudio`:

1. `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
2. `npm run build --workspace @ai-filmstudio/desktop` ✅

Keine TypeScript-Fehler, Build erfolgreich.

## ToDo-Sync
- `DOKUMENTATIONEN/ToDo.md` wurde aktualisiert:
  - Punkt **C.1** als erledigt markiert (`Clear M/S` umgesetzt).
