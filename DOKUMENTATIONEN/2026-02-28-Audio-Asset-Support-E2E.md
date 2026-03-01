# 2026-02-28 – Audio-Asset-Support (end-to-end, sauber integriert)

## Ziel
Audio als vollwertigen Asset-Typ in den bestehenden Unterbau integrieren (Shared Types, Main/IPC, Store, UI, Workflow Studio), ohne Architekturbruch und ohne Quickfix-Workarounds.

## Umgesetzte Schichten

### 1) Shared Contract erweitert
Dateien:
- `packages/shared/src/types.ts`
- `packages/shared/src/ipc/channels.ts`

Aenderungen:
- `Asset.type` erweitert von `image | video` auf `image | video | audio`.
- Neuer IPC-Channel: `project:import-audio`.

Nutzen:
- Audio ist jetzt Teil des zentralen Typsystems und nicht mehr Sonderfall im Renderer.

---

### 2) Main-Prozess: Audio-Import + Ingest + Struktur
Datei:
- `apps/desktop/src/main/index.ts`

Aenderungen:
- Projektstruktur erweitert um `assets/audio`.
- Dateityperkennung erweitert (`.mp3, .wav, .flac, .m4a, .ogg, .aac`).
- `importAssetFile(...)` unterstuetzt jetzt `audio` mit eigenem Dialog/Filter.
- `ingestLocalFileAsProjectAsset(...)` legt Audio unter `assets/audio/...` ab.
- Audio bekommt ein valides Placeholder-Thumbnail (`assets/thumbnails/<id>.png`) statt instabiler Nullpfad-Loesung.
- Comfy-Output-Ingest akzeptiert jetzt ebenfalls Audio-Dateien (via bestehender Typ-Erkennung).
- `registerIpc(...)`-Handler um `importAudio` erweitert.

Wichtig:
- Kein Breaking Change fuer Video/Image-Pfade.
- Kein stilles Verhalten: weiterhin klarer Response-Flow wie bei anderen Asset-Typen.

---

### 3) IPC / Preload / Renderer-API durchgezogen
Dateien:
- `apps/desktop/src/main/ipc/registerIpc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/src/env.d.ts`
- `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`

Aenderungen:
- Neue Methode `importAudio()` in allen API-Layern verdrahtet.
- Runtime-Guard im `ipcClient` ebenfalls vorhanden.

Nutzen:
- Keine API-Luecke zwischen Main und Renderer.
- Legacy-Guard-Prinzip bleibt unveraendert konsistent.

---

### 4) Store: Audio als normaler Import-Flow
Dateien:
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `apps/desktop/src/renderer/src/core/store/slices/assetsSlice.ts`
- `apps/desktop/src/renderer/src/core/store/utils/assetStoreUtils.ts`
- `apps/desktop/src/renderer/src/core/store/selectors/assetLibrarySelectors.ts`

Aenderungen:
- `AssetFilter` erweitert auf `audio`.
- Neue Action `importAudioAsset()`.
- `importAssetByType(...)` unterstuetzt `audio`.
- Selector liefert `importAudioAsset` in die Asset-Library.

Nutzen:
- Audio folgt exakt dem vorhandenen Slice-/Selector-Muster.

---

### 5) UI: Asset Library + Timeline + Workflow Studio

#### Asset Library
Datei:
- `apps/desktop/src/renderer/src/features/assets/AssetLibraryView.tsx`

Aenderungen:
- Neuer Import-Button fuer Audio.
- Filter-Tag `audio` hinzugefuegt.
- Audio-Icons fuer Karten/Badges integriert.

#### Timeline-Drop / Dauer
Dateien:
- `apps/desktop/src/renderer/src/core/store/slices/timelineSlice.ts`
- `apps/desktop/src/renderer/src/core/store/utils/timelineStoreUtils.ts`

Aenderungen:
- Audio-Assets landen bevorzugt im `audio`-Track.
- Anfangsdauer fuer Audio sinnvoll behandelt (Duration aus Asset, fallback 10s).
- Slip-Logik akzeptiert Audio analog zu Video, wenn Quelldauer bekannt ist.

#### Workflow Studio
Datei:
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Aenderungen:
- Audio-Inputs sind nicht mehr deaktiviert.
- Audio-Assets erscheinen in Input-Selects wie Image/Video.
- Validierung akzeptiert Audio regulär.
- `Import all outputs` unterstuetzt jetzt auch Audio-Endungen.

Nutzen:
- Die vorherige Audio-„not supported yet“-Bremse ist sauber entfernt.

---

### 6) Asset-Service MIME-Mapping erweitert
Datei:
- `apps/desktop/src/main/services/assetService.ts`

Aenderungen:
- Audio-MIME-Typen ergänzt (`mp3/wav/flac/m4a/ogg/aac`).

Nutzen:
- Data-URL/File-URL-Aufloesung bleibt auch fuer Audio technisch korrekt.

---

### 7) Preview: Audio-Playback im Transportfluss
Datei:
- `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`

Aenderungen:
- Audio-Ref + Sync zur globalen Transportzeit (`currentTime`) hinzugefuegt.
- Play/Pause/Seek-Verhalten analog zur bestehenden Video-Logik.
- Audio-spezifische Preview-Anzeige mit Dateiname/Zeit eingebaut.

Nutzen:
- Audio-Clips sind in der Preview nicht mehr „stumm unsichtbar“.

---

## Verifikation
Ausgefuehrt:
1. `npm run build --workspace @ai-filmstudio/shared`
2. `npm run typecheck --workspace @ai-filmstudio/desktop`
3. `npm run build --workspace @ai-filmstudio/desktop`

Ergebnis:
- Alle Checks gruen.

## Design-Entscheidungen
- **Keine Sonderlogik im UI-only Layer:** Audio ist durchgehend in Contracts/Store/IPC integriert.
- **Keine riskanten Parallelimporte:** bestehendes sequentielles Importmuster blieb unveraendert.
- **Abwaertskompatibel:** vorhandene Video/Image-Flows unberuehrt.

## Naechster professioneller Schritt (optional)
- Waveform-Preview fuer Audio-Clips (zunaechst statisch, spaeter mit Zoom/Peaks).
- Optionaler Audio-Monitor (Mute/Solo je Track) als Erweiterung des Timeline-Editors.
