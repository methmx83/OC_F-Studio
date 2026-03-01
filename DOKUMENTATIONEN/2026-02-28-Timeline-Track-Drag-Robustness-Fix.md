# 2026-02-28 – Timeline Track-Drag Robustness Fix

## Problem
Clip-Verschieben zwischen Spuren war instabil und brauchte oft mehrere Versuche.

## Ursache
Die Zielspur-Erkennung basierte auf einer Y-Index-Berechnung im Scrollcontainer. Das war in der Praxis fehleranfällig (Ruler/Offsets/Pointer-Position).

## Umsetzung
1. Zielspur-Erkennung auf DOM-Hit-Test umgestellt:
   - `document.elementFromPoint(...)`
   - `closest('[data-track-row-id]')`
2. Jede Timeline-Track-Row markiert mit:
   - `data-track-row-id={track.id}`
3. Drag-Preview zeigt während des Ziehens den Clip direkt auf der aktuellen Zielspur (statt nur auf Ursprungsspur).
4. Typ-Schutz bleibt aktiv:
   - Move nur zwischen kompatiblen Spuren gleicher Art.

## Datei
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`

## Verifikation
- `npm run typecheck` ✅

## Erwartetes Verhalten
Clip-Drag zwischen Audio->Audio bzw. Video->Video greift deutlich zuverlässiger beim ersten Versuch.
