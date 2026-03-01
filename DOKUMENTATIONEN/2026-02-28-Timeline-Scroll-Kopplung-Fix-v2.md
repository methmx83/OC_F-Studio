# 2026-02-28 – Timeline Scroll-Kopplung Fix v2 (DAW-ähnlich)

## Feedback
Trotz erstem Fix wirkten linke Trackliste und rechte Timeline weiterhin wie zwei getrennte Bereiche.

## Ursache
- Track-Zeilen links hatten keine feste Zeilenhöhe wie rechts.
- Linke Liste hatte keine Time-Ruler-Offset-Zeile.
- Scroll-Interaktion links/rechts war technisch gekoppelt, visuell aber nicht 1:1 ausgerichtet.

## Umsetzung (v2)
1. **Feste Zeilenhöhe links auf 56px** (wie rechte Timeline-Track-Rows)
2. **Top-Offset links eingefügt** (`h-8`) als Gegenstück zur rechten Time-Ruler-Zeile
3. **Linke Liste scrollbar gemacht, Scrollbar ausgeblendet** (`no-scrollbar`)
4. **Mausrad auf linker Liste wird an rechten Scrollcontainer weitergeleitet**
   - gefühlt ein gemeinsames Scroll-Element
5. **Rechte Timeline bleibt führender Scrollcontainer**
   - `right.scrollTop -> left.scrollTop`

## Datei
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`

## Verifikation
- `npm run typecheck` ✅
- `npm run build` ✅

## Erwartetes Ergebnis
Links und rechts laufen zeilen-genau zusammen (DAW-Feeling), auch bei vielen Spuren und Scroll bis ganz nach unten.
