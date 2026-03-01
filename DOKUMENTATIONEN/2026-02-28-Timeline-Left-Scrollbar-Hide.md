# 2026-02-28 – Left Track Scrollbar ausblenden

## Wunsch
In der Timeline soll nur rechts die Scroll-Leiste sichtbar sein. Links im Track-Bereich keine sichtbare Scrollbar.

## Umsetzung
Globale Utility-Klasse `no-scrollbar` in `styles.css` vervollständigt:
- `-ms-overflow-style: none;`
- `scrollbar-width: none;`
- `::-webkit-scrollbar { width: 0; height: 0; display: none; }`

Dadurch bleibt links das Scroll-Verhalten erhalten, aber die Scrollbar ist visuell ausgeblendet.

## Datei
- `apps/desktop/src/renderer/src/styles.css`
