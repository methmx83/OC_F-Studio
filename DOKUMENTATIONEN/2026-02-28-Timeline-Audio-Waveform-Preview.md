# 2026-02-28 – Timeline Audio Waveform Preview (read-only)

## Ziel
Ersten stabilen Waveform-Block fuer Audio-Clips im TimelineDock liefern, ohne neue Risiko-Flaechen im Engine-/Store-Kern zu erzeugen.

## Umsetzung
Datei:
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`

Aenderungen:
1. Asset-Typ-Aufloesung im Timeline-Renderer ergaenzt (`assetById`-Map).
2. Fuer Audio-Clips (`asset.type === "audio"`) wird eine read-only Waveform-Visualisierung im Clip gezeichnet.
3. Waveform-Bars werden deterministisch aus der `clip.id` erzeugt:
   - `buildAudioWaveformBars(seed, count)`
   - interne Hilfsfunktionen: `hashString(...)`, `xorshift32(...)`
4. Bar-Anzahl passt sich an Clip-Breite an (`width`-basiert, begrenzt auf sinnvolle Min/Max-Werte).
5. Rendering bleibt pointer-safe (`pointer-events-none`), greift nicht in bestehende Drag/Trim-Interaktionen ein.

## Architektur-/Qualitaetsprinzip
- **Kein** Eingriff in Timeline-Engine, Commands oder Persistenzmodell.
- Reiner View-Layer-Block (geringes Risiko, leicht rueckbaubar, klar testbar).
- Deterministische Anzeige statt Zufall pro Render (stabile UI).

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` → OK
- `npm run build --workspace @ai-filmstudio/desktop` → OK

## Ergebnis
- Audio-Clips sind in der Timeline jetzt visuell direkt als Audio erkennbar.
- Vorbereitung fuer spaetere echte Peak/Waveform-Daten (Dateianalyse/Cache) ist damit sauber gelegt.
