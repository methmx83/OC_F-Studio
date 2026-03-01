# 2026-02-28 – Timeline Scroll-Kopplung Fix (Tracks links + Timeline rechts)

## Problem
Bei vielen Spuren hatten Trackliste (links) und Timeline-Spuren (rechts) faktisch zwei getrennte Scroll-Verhalten.
Beim Scrollen in der Timeline blieb die linke Trackliste visuell stehen.

## Ziel
DAW-ähnliches Verhalten:
- ein führendes vertikales Scroll-Verhalten
- linke Trackliste folgt der Timeline-Vertikalscroll exakt
- keine zweite, konkurrierende Scroll-Interaktion links

## Umsetzung
1. Linke Trackliste auf passives Scroll-Verhalten umgestellt:
   - `overflow-y-auto` -> `overflow-y-hidden`
   - kein eigenes `onScroll` mehr
2. Rechte Timeline ist führender Scroll-Container:
   - `onScroll` der rechten Timeline setzt direkt `leftTrackScrollRef.scrollTop`
3. Bisherige bidirektionale Sync-Logik mit Lock entfernt (vereinfachte, robuste Einweg-Kopplung)

## Betroffene Datei
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`

## Verifikation
- `npm run typecheck` ✅

## Erwartetes Verhalten nach Fix
- Beim Scrollen der Timeline nach unten/oben wandert die linke Trackliste synchron mit.
- Es gibt keine zweite aktive Scrollsteuerung links mehr.
