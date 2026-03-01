# 2026-02-28 – Audio-Track UX: Mute/Solo

## Ziel
Mute/Solo fuer Audio-Tracks als sauberer, modularer Block (Store -> Timeline-UI -> Preview-Verhalten) ohne Eingriff in Timeline-Engine/Command-Logik.

## Umsetzung

### 1) Store-State + Actions (zentral)
Dateien:
- `core/store/studioStore.ts`
- `core/store/slices/previewSlice.ts`

Neu:
- `trackAudioMutedById: Record<string, boolean>`
- `trackAudioSoloById: Record<string, boolean>`
- `toggleTrackAudioMute(trackId)`
- `toggleTrackAudioSolo(trackId)`

Hinweis:
- State liegt bewusst im UI-/Preview-nahen Slice (nicht in Engine), da es ein Playback-/Monitoring-Verhalten ist.

### 2) Selector-Verdrahtung
Dateien:
- `core/store/selectors/timelineSelectors.ts`
- `core/store/selectors/previewSelectors.ts`

Neu:
- Timeline bekommt Mute/Solo-State + Toggle-Actions
- Preview bekommt Mute/Solo-State zur Playback-Filterung

### 3) TimelineDock-UI
Datei:
- `features/timeline/TimelineDock.tsx`

Neu:
- Bei Audio-Tracks erscheinen kompakte Buttons:
  - `M` = Mute
  - `S` = Solo
- Visuelle Zustandsanzeige (farbige aktive States)

### 4) Preview-Verhalten
Datei:
- `features/preview/PreviewStage.tsx`

Aenderung:
- `resolveActiveClip(...)` beruecksichtigt jetzt Audio-Track-Mute/Solo:
  - gemutete Audio-Tracks werden ignoriert
  - wenn mindestens ein Audio-Track auf Solo steht, werden nur diese Solo-Audio-Tracks ausgewertet

## Verifikation
- `npm run typecheck --workspace @ai-filmstudio/desktop` -> OK
- `npm run build --workspace @ai-filmstudio/desktop` -> OK

## Ergebnis
- Audio-Track-Monitoring ist jetzt direkt in der Timeline steuerbar.
- Verhalten ist reproduzierbar und modular integriert.
- Keine seitlichen Auswirkungen auf Projektpersistenz oder Timeline-Engine.
