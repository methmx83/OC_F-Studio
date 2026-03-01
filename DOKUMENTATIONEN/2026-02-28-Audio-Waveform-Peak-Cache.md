# 2026-02-28 – Echter Audio-Waveform-Peak-Cache

## Ziel
Deterministische Platzhalter-Wellenform im TimelineDock durch echte, dateibasierte Audio-Peaks ersetzen, inklusive Cache fuer stabile Performance.

## Umsetzung

### 1) Neuer IPC-Endpunkt fuer Waveform-Peaks
- Shared Channel erweitert: `project:audio-waveform-peaks`
- Neuer Shared Response-Typ: `AudioWaveformResponse { success, message, peaks[] }`
- Verdrahtung in:
  - `main/ipc/registerIpc.ts`
  - `preload/index.ts`
  - `renderer/env.d.ts`
  - `core/adapters/projectApi.ts`
  - `core/adapters/ipcClient.ts`

### 2) Main-Service: Peak-Extraktion + Cache
Datei:
- `main/services/ffmpegService.ts`

Neu:
- `getAudioWaveformPeaks({ projectRoot, relativeAudioPath, bins })`
- Validierung (Projekt geladen, Dateityp, Lesbarkeit)
- Cache-Pfad: `cache/waveforms/<sha1>.json`
- Cache-Reuse bei unveraenderter Quelldatei (mtime-Vergleich)
- Bei Cache-Miss:
  - ffmpeg decodiert Audio zu Mono/F32 (`-ac 1 -ar 2000 -f f32le pipe:1`)
  - Peaks werden in `bins` Fenster auf maximale Amplitude reduziert
  - Normalisierung auf `0..1`
  - Persistenz als JSON im Waveform-Cache

### 3) Main-Index Handler eingebunden
Datei:
- `main/index.ts`

Neu:
- Import des Service-Entrypoints
- Handler `getAudioWaveformPeaks(relativeAudioPath, bins)` in `registerIpc(...)`

### 4) TimelineDock nutzt echte Peaks
Datei:
- `features/timeline/TimelineDock.tsx`

Neu:
- Lokaler Cache im Renderer: `audioWaveformByAssetId`
- `useEffect`: laedt fuer Audio-Assets einmalig Peaks per IPC
- `buildAudioWaveformBars(...)` priorisiert echte Peaks
- Fallback auf deterministische Pseudo-Waveform bleibt erhalten, falls Peaks nicht verfuegbar sind
- `resamplePeaks(...)` passt Peak-Anzahl an Clip-Breite/Balkenanzahl an

## Architekturprinzip
- Kein Eingriff in Timeline-Engine/Commands/Persistenzschema.
- Waveform-Feature liegt klar in Service + IPC + View-Layer.
- Caching reduziert wiederholte ffmpeg-Decodes deutlich.

## Verifikation
- `npm run build --workspace @ai-filmstudio/shared` -> OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` -> OK
- `npm run build --workspace @ai-filmstudio/desktop` -> OK

## Ergebnis
- Timeline zeigt jetzt echte Audio-Peaks (mit Fallback).
- Waveform-Berechnung ist reproduzierbar, gecacht und robust gegen Reloads.
