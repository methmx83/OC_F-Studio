# 2026-03-04 – Comfy Gallery Datenbasis (Teil 3)

## Ziel
Gallery-Flow weiter in Richtung produktiver Nutzung bringen: besseres Filtern/Sortieren + Auto-Place aus Gallery-Import.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/gallery/ComfyGalleryView.tsx`

### Neu
1. **Import-Filter**
   - `all`
   - `new` (noch nicht importiert)
   - `imported`

2. **Sortierung**
   - `newest`
   - `oldest`

3. **Auto-Place Toggle**
   - `Auto-Place ON/OFF`
   - bei aktiviertem Zustand werden neu importierte Assets direkt in die Timeline gelegt.

4. **Bulk-Import erweitert**
   - `Import selected` und `Import all new` nutzen jetzt optional ebenfalls Auto-Place.
   - neu importierte Assets werden per Vorher/Nachher-Asset-ID erkannt und dann in die Timeline gedroppt.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Gallery ist jetzt deutlich naeher am echten Produktionsfluss:
- schnelle Sichtung,
- gezieltes Filtern,
- reproduzierbarer Bulk-Import,
- optional direktes Weiterarbeiten auf der Timeline.