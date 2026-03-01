# 2026-02-28 – Timeline Track Drop Fix

## Problem
Beim Drag&Drop aus der Asset-Library wurden Clips immer nur an die erste passende Spur gehängt.
Ein gezieltes Ablegen auf Spur 2/3/4 war nicht möglich.

## Ursache
`dropAssetToTimeline(assetId)` kannte keine Zielspur.
Im Timeline-UI wurde der Drop nur auf dem Gesamtcontainer verarbeitet, nicht pro Spur.

## Umsetzung
1. Store-API erweitert:
   - `dropAssetToTimeline(assetId, trackId?)`
2. Timeline-Slice erweitert:
   - optionale `trackId`-Auswahl
   - wenn `trackId` übergeben wird und zur Asset-Art passt, wird genau diese Spur benutzt
   - sonst Fallback auf bisherige Auswahl-Logik
3. Timeline-UI erweitert (`TimelineDock.tsx`):
   - gemeinsamer Drop-Handler `handleAssetDrop(...)`
   - `onDrop` auf jeder Spur mit `track.id`
   - `event.stopPropagation()`, damit kein Doppel-Drop vom Parent triggert

## Betroffene Dateien
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `apps/desktop/src/renderer/src/core/store/slices/timelineSlice.ts`
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`

## Verifikation
- `npm run typecheck` ✅
- `npm run build` ✅

## Hinweis zum Overlap-Fehler
Die Meldung bei überlappenden Clips auf derselben Spur ist aktuell erwartetes Verhalten:
- gleichzeitige Überlagerung auf einer einzelnen Spur ist derzeit nicht erlaubt
- für Blenden/Transitions braucht es einen separaten Übergangs-Mechanismus (noch nicht implementiert)
