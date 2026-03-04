# 2026-03-04 – Comfy Gallery: Imported-Persistenz

## Wunsch
Imported-Status in der Gallery soll ueber Session-Neustarts stabil bleiben.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/gallery/ComfyGalleryView.tsx`

### Neu
1. Persistenter Storage-Key:
- `ai-filmstudio.comfy.gallery.importedPaths`

2. Imported-Status wird jetzt aus zwei Quellen gebildet:
- bereits im Projekt vorhandene Assets (`originalName`)
- lokal persistierte absolute Gallery-Pfade

3. Beim Import (single/selected/all-new):
- erfolgreicher Import schreibt den Pfad in den persistenten Imported-Store
- Imported-Badge/Filter greifen danach sofort und auch nach App-Neustart

4. Import-Filter `new/imported` nutzt jetzt den kombinierten Persistenz-Status.

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
Gallery-Imported-Markierungen bleiben stabil erhalten und `Import all new` ist deutlich reproduzierbarer.