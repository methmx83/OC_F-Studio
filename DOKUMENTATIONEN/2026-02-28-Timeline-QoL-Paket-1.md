# 2026-02-28 – Timeline QoL Paket 1

## Ziel
Umsetzung der wichtigsten Timeline- und UI-QoL-Punkte aus dem manuellen Testfeedback.

## Umgesetzte Punkte

1. **Timeline-Höhe anpassbar (Resize)**
   - Timeline besitzt jetzt einen oberen Resize-Handle (Drag nach oben/unten).
   - Beim Vergrößern der Timeline wird der Preview-Bereich automatisch kleiner (dynamische Aufteilung im bestehenden Flex-Layout).

2. **Track hinzufügen: freie Auswahl statt fester Reihenfolge**
   - Der `+`-Button öffnet jetzt ein kleines Auswahlmenü.
   - Hinzufügen nur noch als:
     - `Video Track`
     - `Audio Track`
   - Feste Rotation `Video -> Overlay -> Audio -> Text` entfernt.

3. **Track-Header links mit Timeline vertikal synchronisiert**
   - Linke Track-Liste ist jetzt scrollbar.
   - Vertikales Scrollen links/rechts wird bidirektional synchronisiert.
   - Problem „nur 4 Spuren sichtbar, restliche verschwinden“ behoben.

4. **Timeline-Zoom**
   - Zoom-Controls in der Timeline-Toolbar (`- / +`, Prozentanzeige).
   - Zeitachse/Clips skalieren mit (`pixelsPerSecond`).

5. **Clip zwischen Spuren verschieben**
   - Drag eines Clips unterstützt jetzt Zielspur-Erkennung während des Ziehens.
   - Beim Loslassen wird (bei kompatiblem Typ) auf die Zielspur verschoben.
   - Schutz: Verschiebung nur zwischen Spuren gleicher Art (`video->video`, `audio->audio`).

6. **Trim-Limit auf Originaldauer**
   - Trim verlängert Audio/Video-Clips nicht mehr über verfügbare Quelldauer.
   - Begrenzung berücksichtigt `asset.durationSeconds` und `clip.offset`.
   - Gilt sowohl für direkte Timeline-Trim-Aktionen als auch selected-clip Trim.

7. **Library-Bereich angepasst**
   - Linke Library breiter (`w-80`).
   - Asset-Karten als 2-Spalten-Grid.
   - Thumbnails dadurch effektiv deutlich kleiner, zwei nebeneinander sichtbar.

## Geänderte Dateien
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- `apps/desktop/src/renderer/src/core/store/slices/timelineSlice.ts`
- `apps/desktop/src/renderer/src/features/assets/AssetLibraryView.tsx`

## Verifikation
- `npm run typecheck` ✅
- `npm run build` ✅

## Hinweise
- Overlap auf derselben Spur bleibt weiterhin bewusst deaktiviert (wie besprochen).
- Track-übergreifendes Verschieben bleibt typ-sicher (kein Audio auf Video-Track usw.).
