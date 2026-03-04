# 2026-03-04 – Comfy Gallery Tab (Vorbereitung)

## Aufgabe
Vorbereitung fuer neue Registerkarte "Comfy Gallery".

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`

Aenderungen:
1. Neuer Navigation-Tab `Gallery` in der Header-Navigation.
2. Neuer View `GalleryView` als Platzhalter mit klarer Zielbeschreibung:
   - Comfy-Output-Ordner als Quelle
   - Grid mit Bild/Video-Preview
   - Filter + Sortierung
   - Import selected / Import all new
3. Routing im Main-View-Switch erweitert (`activeView === "gallery"`).

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅

## Ergebnis
UI-Struktur ist vorbereitet. Naechster Implementierungsschritt kann direkt auf diesem Tab aufsetzen (Dateiscan, Thumbnail-Grid, Importaktionen).