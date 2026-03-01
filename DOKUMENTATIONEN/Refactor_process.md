# Refactor Process

Letzte Aktualisierung: 2026-02-28
Status: Refactor-Reihe PR0-PR12 abgeschlossen; Hardening-Folgearbeiten laufen separat in `DOKUMENTATIONEN/Refactor_Hardening.md`
Quelle der Wahrheit: lokales Repo (`d:\AFS_Projects\AI-FilmStudio`)

## Zweck

Diese Datei dokumentiert ausschliesslich den laufenden Refactor (Architektur-/Modularisierungsarbeiten).

Abgrenzung:
- `DOKUMENTATIONEN/Abgeschlossende_Aufgabe.md` bleibt fuer Feature-/Hotfix-Abschluesse.
- Refactor-Fortschritt, Refactor-Entscheidungen und PR-Schritte werden ab jetzt hier gepflegt.

## Zielbild (Kurzfassung)

Der Refactor folgt der bestehenden `DOKUMENTATIONEN/Refactor-Map.md` und dem abgestimmten Plan:
- `apps/desktop/src/main/index.ts` entkoppeln (Services + IPC-Router)
- Preload bridge-only halten
- Renderer-Store in Domain-Slices aufteilen
- IPC-Contracts in `packages/shared` zentralisieren

Wichtige Leitlinie:
- zuerst mechanisch verschieben, keine Logikaenderung
- fragile Preview-/Proxy-Logik nicht "optimieren", nur kapseln

## Abgestimmte Anpassungen zum Refactor-Map Plan

1. IPC-Channel-Renames nicht in PR 1
- Zuerst Main-Split mit unveraenderten Channel-Strings.
- Namespace-Konsolidierung spaeter separat, damit Fehlerquellen klein bleiben.

2. `window.projectApi` zunaechst kompatibel lassen
- Erst Alias/Wrapper einfuehren, danach Renderer schrittweise migrieren.
- Kein harter Umstieg auf `window.api` in einem mechanischen Refactor-PR.

3. Shared IPC-Typen frueh ausbauen (hoher Nutzen)
- Response-/Request-Typen aktuell in Preload/Renderer doppelt vorhanden.
- Ziel: Shared-Typen fuer Channels + IPC-Payloads als ein Ort der Wahrheit.

4. `comfyService` mit Lifecycle denken
- Polling/Event-Push nicht nur "auslagern", sondern mit sauberem Cleanup (`dispose`/stop polling).

5. Preview/Proxy-Verhalten einfrieren waehrend Refactor
- Keine Verhaltensaenderungen in Source-Lock / Proxy-Bypass / Data-URL- und File-URL-Fallbacks.

## Refactor-PR Reihenfolge (abgestimmt)

### PR 0 - Guardrails
- `typecheck`, `lint`, `build` als Baseline pruefen
- Smoke-Check dokumentieren (Doku/README oder `scripts/smoke.md`)

Akzeptanz:
- Baseline ist reproduzierbar und vor jedem Refactor-Schritt pruefbar

### PR 1 - Main split (mechanisch, keine Logikaenderung)
- `main/lib/*` vorbereiten (nur wenn direkt benoetigt)
- `services/ffmpegService.ts` extrahieren (Health + Proxy)
- `services/assetService.ts` extrahieren (thumbnail/file/media URL)
- `ipc/registerIpc.ts` einfuehren (zunaechst mit bestehenden Channel-Strings)

Akzeptanz:
- App startet
- Asset-Import + Preview laufen wie vorher
- Proxy-Mode funktioniert unveraendert

### PR 2 - ComfyService isolieren
- Comfy Health / Queue / Polling / Event-Push aus `main/index.ts` extrahieren

Akzeptanz:
- Workflow Studio "Send to ComfyUI" funktioniert unveraendert

### PR 3 - WorkflowCatalogService isolieren
- `project:list-workflow-catalog` in Service verschieben
- Parsing/Validation 1:1 beibehalten

Akzeptanz:
- WF Studio listet Workflows inkl. warnings/templateExists wie vorher

### PR 4 - Shared IPC Contracts erweitern + deduplizieren
- `packages/shared/src/ipc/*` aufbauen/erweitern
- Main/Preload/Renderer nutzen gemeinsame Channel-Strings + Payload-Typen

Akzeptanz:
- Keine duplizierten IPC-Response-Typen mehr in Preload/Renderer fuer refactorte Bereiche

### PR 5 - Renderer IPC Client Wrapper
- `core/adapters/ipcClient.ts` als Runtime-Guard-Schicht
- Store nutzt Wrapper statt verstreuter Preload-Guards

Akzeptanz:
- Kein Crash mit altem Preload
- Store wird lesbarer

### PR 6+ - Store Slicing (kontrolliert)
Reihenfolge:
1. `timelineSlice` + `transportSlice`
2. `projectSlice` + `assetsSlice`
3. `previewSlice`
4. `comfySlice`
5. `workflowStudioSlice`

Akzeptanz:
- UI identisch, keine Feature-Aenderung

## Guardrails / Nicht verhandelbar (Refactor-spezifisch)

- Kleine Schritte, gruen halten nach jedem Schritt
- Keine neuen Dependencies ohne Begruendung
- TypeScript strict respektieren (kein `any`)
- Windows-first (PowerShell/CMD kompatible Checks)
- Keine stillen Verhaltensaenderungen im Preview/Proxy-Pfad

## Golden Smoke Check (PowerShell)

Vor jedem Refactor-PR (und nach Abschluss eines Schritts) mindestens ausfuehren:

```powershell
npm run typecheck
npm run lint
npm run build
```

Manueller Smoke (Desktop-App):
1. `npm run dev`
2. Projekt laden oder neu anlegen
3. Video/Bild importieren
4. Preview oeffnen / Playback pruefen
5. Proxy-Mode kurz pruefen (Video vorhanden)
6. Workflow Studio oeffnen (Katalog sichtbar)
7. Falls ComfyUI lokal laeuft: `Send to ComfyUI` Test-Run

Hinweis:
- `lint` ist aktuell noch kein gruener Guardrail auf Root-Ebene (siehe PR-0-Baseline unten).
- Bis zum Lint-Refactor gilt: `typecheck` + `build` muessen gruen sein; `lint`-Output wird gegen bekannte Baseline bewertet.

## Risiken / Beobachtungspunkte

1. Main-File ist stark gekoppelt
- Hohe Gefahr von "versehentlichen" Signatur-/Import-Aenderungen beim Extrahieren.

2. Preview-/Proxy-Pfad ist fragil
- Data-URL / file-URL / Dev-webSecurity / Proxy-Bypass greifen ineinander.

3. Comfy Polling/Event Lifecycle
- Timer-Leaks oder doppelte Event-Pushes beim Refactor moeglich, wenn Cleanup nicht sauber mitwandert.

4. IPC-Type Drift
- Preload/Renderer/Main koennen bei halb umgestellten Typen schnell auseinanderlaufen.

## Fortschrittslog

### 2026-02-28 - Post-PR12 Doku-Sync + Hardening-Stand nachgezogen
- `Refactor_process.md` und `Kontext-Aktuell.md` auf den aktuellen Ist-Stand synchronisiert.
- Seit PR12 umgesetzte Betriebs-/Qualitaetsbausteine dokumentiert:
  - `Workflow Studio`: `Import all outputs` pro Run.
  - Workflow-Meta-Validator als fester Check (`npm run validate:workflows`).
  - Audio-Ausbau abgeschlossen: end-to-end `audio`-Asset-Support, Preview-Metering, Multi-Audio-Handling.
  - Echte Audio-Waveform-Pipeline mit FFmpeg-Peaks (`cache/waveforms/`) inkl. Prefetch beim Import.
  - Timeline-Audio-Funktionen: `Clear M/S`, `Clip.gain`, vorbereiteter Keyframe-Slot `automation.gain[]`.
- Hinweis: Refactor-PR-Reihe bleibt abgeschlossen (PR0-PR12); laufende Arbeit ist jetzt Feature-/Hardening-getrieben.

### 2026-02-22 - Refactor-Prozessdatei eingefuehrt
- Neue Datei `DOKUMENTATIONEN/Refactor_process.md` angelegt.
- Refactor-Dokumentation von Feature-Abschlussdoku getrennt.
- Abgestimmte Anpassungen zur bestehenden `Refactor-Map` dokumentiert.
- Refactor-PR-Reihenfolge mit Akzeptanzkriterien festgehalten.

### 2026-02-22 - PR 0 (Guardrails) Baseline gemessen
- Root `typecheck` ausgefuehrt: **OK**
  - `@ai-filmstudio/desktop`: `tsc -b tsconfig.node.json tsconfig.web.json --pretty false` OK
  - `@ai-filmstudio/shared`: `tsc -p tsconfig.json --noEmit` OK
- Root `lint` ausgefuehrt: **nicht gruen (Baseline bekannt)**
  - ESLint laeuft aktuell ueber generierte Dateien (`apps/desktop/out/**`, `*.js`, `*.d.ts`) und produziert dadurch viele irrelevante Treffer.
  - Zusaetzlich bestehen bekannte ESLint-Config-Luecken fuer Node-/Browser-Globals (`process`, `__dirname`, `fetch`, `document`, `module`, `Buffer`, `setTimeout`).
  - Beispiele:
    - `apps/desktop/src/main/index.ts` -> `no-undef` fuer Node/Runtime-Globals
    - `apps/desktop/src/renderer/src/main.tsx` -> `document` (`no-undef`)
    - `apps/desktop/tailwind.config.js` -> `module` (`no-undef`)
    - `apps/desktop/*.d.ts` -> parser project mismatch
- Root `build` ausgefuehrt: **OK**
  - `electron-vite build` erfolgreich fuer `main`, `preload`, `renderer`
  - Build-Warnung vorhanden (PostCSS Import-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`), aber Build bricht nicht ab
- PR-0 Fazit:
  - Refactor-Guardrails sind teilweise belastbar (`typecheck`, `build`)
  - `lint` braucht in einem separaten Cleanup-Schritt eine klare Ignore-/Env-Konfiguration, bevor es als harter Refactor-Gate taugt

### 2026-02-22 - PR 1 (Main split - Teil 1) mechanisch umgesetzt
- Neue Main-Services angelegt:
  - `apps/desktop/src/main/services/ffmpegService.ts`
    - extrahiert: `FFmpeg health`, `ensure video proxy`
    - mit Hilfsfunktionen fuer den bestehenden Import-Flow (`createVideoThumbnail`, `probeVideoDurationSeconds`)
  - `apps/desktop/src/main/services/assetService.ts`
    - extrahiert: `asset-thumbnail-data-url`, `asset-file-url`, `asset-media-data-url`
- Neuer IPC-Router angelegt:
  - `apps/desktop/src/main/ipc/registerIpc.ts`
  - bindet die bestehenden IPC-Channels zentral (keine Channel-Renames)
- `apps/desktop/src/main/index.ts` umgestellt:
  - direkte `ipcMain.handle(...)`-Registrierungen durch `registerIpc(...)` ersetzt
  - extrahierte Asset-/FFmpeg-Logik ueber Services verdrahtet
  - Verhaltensziel: **unveraendert**
- Scope bewusst klein gehalten:
  - Import-/Workflow-/Comfy-Logik bleibt weiterhin in `main/index.ts` (kommt in spaeteren PRs)

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/main/services/ffmpegService.ts src/main/services/assetService.ts src/main/ipc/registerIpc.ts` (Workdir `apps/desktop`) OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- `apps/desktop/src/main/index.ts` wurde deutlich reduziert (ca. 1405 -> ca. 1149 Zeilen im aktuellen Stand).
- Main-FFmpeg-/Asset-IO-Logik ist jetzt separat test-/lesbarer, ohne IPC-Channel-Verhalten zu aendern.

Risiken / Restpunkte:
- Kein manueller Desktop-Smoke-Test in diesem Schritt ausgefuehrt (nur Typecheck/Build/gezielter Lint).
- `registerIpc.ts` nutzt weiterhin die bisherigen Channel-Strings; Shared IPC-Channel-Konstanten folgen spaeter.

### 2026-02-22 - PR 2 (ComfyService) mechanisch umgesetzt
- Neue Datei `apps/desktop/src/main/services/comfyService.ts` angelegt.
- Aus `apps/desktop/src/main/index.ts` ausgelagert:
  - Comfy Health (`getComfyHealth`)
  - Comfy Queue-Run Flow (`queueComfyRun`)
  - Polling / History-Auswertung / Run-Status-Events (Service-intern, ueber Callback-Emitter)
  - Workflow-Template-Rendering fuer Comfy (`*.api.json` laden, Platzhalter ersetzen, fehlende Tokens pruefen)
  - Output-Pfad-Extraktion aus Comfy-History
- Main-Prozess bleibt fuer diese Runde nur noch als Bruecke verantwortlich fuer:
  - `currentProjectRoot`
  - `readCurrentProjectFromDisk()` (mit bestehender AJV-/Migration-Validierung)
  - `emitComfyRunEvent(...)` (BrowserWindow -> Renderer Event-Push)
- `resolveComfyBaseUrl()` wurde ebenfalls in den Service verschoben und in `main/index.ts` fuer `importComfyOutput(...)` weiterverwendet (export aus Service).
- `registerIpc(...)` verdrahtet `comfy:health` / `comfy:queue-run` jetzt gegen eine `comfyService`-Instanz statt direkte Main-Funktionen.

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/main/services/comfyService.ts src/main/index.ts src/main/ipc/registerIpc.ts` (Workdir `apps/desktop`) -> bekannte `no-undef` Baseline fuer Node-/Runtime-Globals (`process`, `fetch`, `setTimeout`, `Buffer`, `NodeJS`)
- Zusatztest (nur zur Struktur-/Syntaxpruefung, ohne Baseline-Env-Noise):
  - `npx eslint src/main/services/comfyService.ts src/main/index.ts src/main/ipc/registerIpc.ts --rule "no-undef: off"` (Workdir `apps/desktop`) OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- `apps/desktop/src/main/index.ts` weiter reduziert (ca. 1149 -> ca. 765 Zeilen im aktuellen Stand).
- Comfy-Bridge-Logik ist als klarer Service isoliert, ohne IPC-Channel- oder Flow-Aenderung.

Risiken / Restpunkte:
- Manueller Desktop-Smoke-Test (WF Studio -> `Send to ComfyUI`, Event-Update im Renderer) wurde in diesem Schritt nicht ausgefuehrt.
- Polling-Lifecycle/Cleanup ist weiterhin funktional unveraendert (noch keine `dispose()`-API; spaeterer Ausbau moeglich).

### 2026-02-22 - PR 3 (WorkflowCatalogService) mechanisch umgesetzt
- Neue Datei `apps/desktop/src/main/services/workflowCatalogService.ts` angelegt.
- Aus `apps/desktop/src/main/index.ts` ausgelagert:
  - `project:list-workflow-catalog` Loader-Logik
  - Meta-Parsing/Validation (`*.meta.json`)
  - Template-Existence-Checks (`templateExists`)
  - Parser-Helfer (`readRequiredString`, `readFiniteNumber`, `parseWorkflowMeta*`)
- `apps/desktop/src/main/index.ts` nutzt jetzt eine `workflowCatalogService`-Instanz (`createWorkflowCatalogService(...)`).
- Katalog-IPC bleibt unveraendert verdrahtet ueber `registerIpc(...)` und denselben Channel:
  - `project:list-workflow-catalog`
- Verhaltensziel: **unveraendert** (Warnings, Sortierung, `templateExists`, Fehlermeldungen bleiben 1:1)

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/main/services/workflowCatalogService.ts` (Workdir `apps/desktop`) OK
- Zusatzpruefung fuer Main+Service (ohne bekannte Node-/Runtime-Globals-`no-undef`-Noise in `main/index.ts`):
  - `npx eslint src/main/services/workflowCatalogService.ts src/main/index.ts --rule "no-undef: off"` (Workdir `apps/desktop`) OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- `apps/desktop/src/main/index.ts` weiter reduziert (ca. 765 -> ca. 590 Zeilen im aktuellen Stand).
- Workflow-Katalog-Logik ist als separater, klarer Service isoliert und damit deutlich besser wartbar/testbar.

Risiken / Restpunkte:
- Manueller WF-Studio-Smoke-Test (Katalog laden, warnings/templateExists sichtbar) wurde in diesem Schritt nicht ausgefuehrt.
- Shared IPC-Contracts/Channel-Konstanten sind weiterhin nicht zentralisiert (bewusst spaeterer Schritt).

### 2026-02-22 - PR 4 (Shared IPC Contracts + Deduplizierung) umgesetzt
- Neuer Shared-IPC-Bereich in `packages/shared/src/ipc/` angelegt:
  - `channels.ts` (zentrale IPC-Channel-Konstanten)
  - `project.ts` (`ProjectResponse`, `WorkflowTemplateImportResponse`)
  - `assets.ts` (`AssetImportResponse`)
  - `ffmpeg.ts` (`FfmpegHealthResponse`, `ProxyResponse`)
- `packages/shared/src/index.ts` erweitert:
  - Re-Exports fuer `IPC_CHANNELS` + neue IPC-Response-Typen

- Deduplizierung umgesetzt in Desktop-App:
  - `apps/desktop/src/preload/index.ts`
    - lokale Response-Interfaces entfernt
    - importiert Shared-IPC-Typen
    - nutzt zentrale `IPC_CHANNELS` fuer `invoke/on/off`
  - `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
    - lokale Response-Interfaces entfernt
    - importiert Shared-IPC-Typen
  - `apps/desktop/src/renderer/src/env.d.ts`
    - keine Typ-Imports mehr aus `../../preload/index`
    - Window-Typing jetzt auf Shared-IPC-Typen umgestellt
  - `apps/desktop/src/main/ipc/registerIpc.ts`
    - lokale Response-Interfaces entfernt
    - importiert Shared-IPC-Typen
    - nutzt zentrale `IPC_CHANNELS` fuer `ipcMain.handle(...)`
  - `apps/desktop/src/main/services/ffmpegService.ts`
    - nutzt `FfmpegHealthResponse` / `ProxyResponse` aus Shared-IPC-Typen
  - `apps/desktop/src/main/index.ts`
    - importiert `ProjectResponse` / `AssetImportResponse` / `WorkflowTemplateImportResponse` aus Shared
    - `COMFY_RUN_EVENT_CHANNEL` auf `IPC_CHANNELS.comfy.runEvent` umgestellt

Wichtiger Build-/Tooling-Befund in diesem Schritt:
- Value-Import ueber `@shared/ipc/channels` schlug im `electron-vite build` fehl (Runtime-Resolve, waehrend Type-Imports bisher unauffaellig waren).
- Fuer diesen PR wurde ein pragmatischer, build-stabiler Weg gewaehlt:
  - Desktop Runtime-Imports fuer `IPC_CHANNELS` erfolgen aktuell **relativ** direkt aus `packages/shared/src/ipc/channels.js`
  - die Shared-Quelle bleibt dennoch zentral (kein doppelter Channel-String in Main/Preload)
- Zusaetzlich fiel auf: `electron-vite build` nutzt im Repo den generierten `src/**/*.js` Stand; nach Importpfadwechsel war ein forcierter TS-Rebuild noetig, damit die generierten Dateien synchron sind.

Checks:
- `npm run typecheck --workspace @ai-filmstudio/shared` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx tsc -b tsconfig.node.json tsconfig.web.json --force --pretty false` (Workdir `apps/desktop`) OK
  - notwendig, um generierte `src/main/*.js` / `src/preload/*.js` Artefakte zu synchronisieren
- `npm run build --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/ipc/channels.ts src/ipc/project.ts src/ipc/assets.ts src/ipc/ffmpeg.ts src/index.ts` (Workdir `packages/shared`) OK
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/env.d.ts src/main/ipc/registerIpc.ts --rule "no-undef: off"` (Workdir `apps/desktop`) OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Ein grosser Teil der IPC-Response-Typduplikate ist entfernt.
- Preload/Renderer/Main greifen fuer die refactorten IPC-Bereiche auf dieselben Shared-Contracts zurueck.
- Channel-Strings sind zentral definiert und werden bereits im Main-IPCRouter + Preload genutzt.

Risiken / Restpunkte:
- Runtime-Import von `IPC_CHANNELS` erfolgt vorerst per relativem Pfad auf `packages/shared/src` (sauberer als Duplikate, aber noch kein finaler Packaging-Zustand).
- Kein manueller Smoke-Test in der App fuer diesen Schritt (nur Build/Typecheck/Lint gezielt).

### 2026-02-22 - PR 5 (Renderer IPC Client Wrapper) umgesetzt
- Neue Datei `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts` angelegt.
- `ipcClient` kapselt jetzt:
  - Zugriff auf `window.projectApi` (ueber bestehenden `projectApi`-Adapter)
  - Runtime-Guards fuer Legacy-Preload-Faelle bei:
    - `getComfyHealth`
    - `onComfyRunEvent`
    - `queueComfyRun`
    - `importWorkflowTemplate`
  - typed Error `IpcUnavailableError` + `isIpcUnavailableError(...)`
  - zentrale Fallback-Messages fuer fehlende Preload-Methoden

- `apps/desktop/src/renderer/src/core/store/studioStore.ts` umgestellt:
  - direkte Guard-Casts `(api as { ...?: ... })` entfernt
  - Comfy-Guard-Logik (`checkComfyHealth`, `bindComfyRunEvents`, `queueSelectedWorkflowRun`) nutzt jetzt `ipcClient`
  - Workflow-Template-Import-Fallback (`importWorkflowTemplateForSelected`) nutzt jetzt `ipcClient`
  - weitere direkte API-Aufrufe im Store (Import, Save, Proxy, Thumbnail-Hydration etc.) auf `getIpcClient()` vereinheitlicht
- Verhalten beibehalten:
  - gleiche Fallback-Messages bei altem Preload
  - gleiche UI-State-Reaktionen bei Queue/Health/Event-Bindings

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/adapters/ipcClient.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/env.d.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Der zentrale Store ist spuerbar sauberer: keine verstreuten Runtime-Guards mehr fuer Legacy-Preload in mehreren Actions.
- IPC-Legacy-Fallbacks sind in einer dedizierten Adapter-Schicht konzentriert.

Risiken / Restpunkte:
- Einige UI-Komponenten (`WorkflowStudioView.tsx`, `PreviewStage.tsx`) greifen noch direkt auf `getProjectApi()` zu; die Guard-/Adapter-Konsolidierung ist im Store jetzt umgesetzt, aber noch nicht renderer-weit vollstaendig.
- Kein manueller Smoke-Test durchgefuehrt (Build/Typecheck/Lint gezielt).

### 2026-02-25 - Pre-PR6 Follow-up: Runtime-Import-Hack entfernt (`IPC_CHANNELS`) + Packaging-Weg gehaertet
- Ziel (User-Request vor PR6):
  - relativen Runtime-Import-Hack fuer `IPC_CHANNELS` entfernen
  - `@ai-filmstudio/shared` zur Runtime ueber compiled `dist/` + Package-Export nutzbar machen (keine `src`-Runtime-Imports)

Umgesetzt:
- `packages/shared/package.json`
  - `exports` eingefuehrt (Root-Export auf `dist/index.js` + `dist/index.d.ts`)
- Desktop Runtime-Imports umgestellt:
  - `apps/desktop/src/main/index.ts`
  - `apps/desktop/src/main/ipc/registerIpc.ts`
  - `apps/desktop/src/preload/index.ts`
  - `IPC_CHANNELS` wird jetzt via `import { IPC_CHANNELS } from '@ai-filmstudio/shared'` geladen
  - keine Runtime-`src`-Imports aus `packages/shared/src/*` mehr fuer `IPC_CHANNELS`
- `apps/desktop/tsconfig.base.json`
  - Root-Path-Mapping fuer `@ai-filmstudio/shared` auf `../../packages/shared/dist/index.d.ts` ergänzt (TS-Resolve fuer den Root-Import)

Wichtiger Infrastruktur-Befund:
- In diesem lokalen Repo fehlte der npm-Workspace-Link `node_modules/@ai-filmstudio/shared` (trotz Workspace-Konfiguration).
- `npm install` am Repo-Root hat den Workspace-Link erzeugt.
- Danach konnte `electron-vite build` den Import `@ai-filmstudio/shared` sauber ueber Package-Resolution/Exports verarbeiten.
- Zwischenzeitliche Alias-/externalize-Experimente in `electron.vite.config.ts` wurden wieder verworfen; finaler Stand nutzt den normalen Package-Weg.

Checks:
- `npm install` (Root) OK
  - Workspace-Link `@ai-filmstudio/shared -> .\\packages\\shared` ist danach vorhanden (`npm ls @ai-filmstudio/shared --workspaces --all`)
- `npm run build --workspace @ai-filmstudio/shared` OK
- `npx tsc -b tsconfig.node.json tsconfig.web.json --force --pretty false` (Workdir `apps/desktop`) OK
  - notwendig, um generierte `src/**/*.js` Artefakte zu synchronisieren
- `npm run typecheck --workspace @ai-filmstudio/shared` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/main/index.ts src/main/ipc/registerIpc.ts src/preload/index.ts electron.vite.config.ts --rule "no-undef: off"` (Workdir `apps/desktop`) OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Manual Smoke Checklist (User-Request vor PR6)
- Hinweis zur Ausfuehrbarkeit:
  - Eine echte GUI-Interaktion (manuelle Klicks/Playback-Pruefung) kann in dieser Shell-Session nicht durch den Agenten ausgefuehrt werden.
  - Ich dokumentiere daher den Status transparent und ohne Annahmen.

Status 2026-02-25:
- `New Project`: nicht durch Agent manuell ausgefuehrt (GUI-Interaktion nicht verfuegbar)
- `Import Video`: nicht durch Agent manuell ausgefuehrt
- `Preview playback`: nicht durch Agent manuell ausgefuehrt
- `Proxy toggle`: nicht durch Agent manuell ausgefuehrt
- `Workflow Studio catalog`: nicht durch Agent manuell ausgefuehrt
- `Optional Comfy health`: nicht durch Agent manuell ausgefuehrt
- User-Feedback (heutiger Lauf): **"App startet weiterhin problemlos"** -> Startup positiv bestaetigt

Ergebnis / Wirkung:
- Der PR4-Zwischenstand ("relativer Runtime-Import aus `packages/shared/src`") ist bereinigt.
- `IPC_CHANNELS` kommt zur Runtime jetzt wieder ueber den Paketnamen `@ai-filmstudio/shared` (mit `exports` auf `dist/`).

### 2026-02-25 - PR 6a gestartet (Store-Slicing: `timelineSlice` + `transportSlice`)
- Scope (bewusst nur erster Slice-Schritt gemaess Refactor-Reihenfolge):
  - zuerst Timeline + Transport aus `studioStore.ts` herausziehen
  - **keine** Logikverschiebung fuer Project/Assets/Preview/Comfy/Workflow-Studio in diesem Schritt

Umgesetzt:
- Neue Slice-Dateien im Renderer-Store:
  - `apps/desktop/src/renderer/src/core/store/slices/timelineSlice.ts`
  - `apps/desktop/src/renderer/src/core/store/slices/transportSlice.ts`
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - `StudioState` exportiert (fuer type-only Slice-Verwendung)
  - Timeline-/Transport-Actions jetzt ueber Slice-Composer eingebunden:
    - `createTimelineSlice(...)`
    - `createTransportSlice(...)`
  - Inline-Implementierungen fuer Timeline/Transport aus dem God-Store entfernt (mechanische Verlagerung)
  - `undoUi` / `redoUi` mit in den `timelineSlice` verschoben
- Verhalten beibehalten:
  - Timeline-Commands, History-Update, Selection-Handling und Playback-Transport bleiben funktional identisch
  - bestehende Helper (`toTimelineHistoryState`, `sanitizeSelection`, `clampTime`, etc.) bleiben vorerst in `studioStore.ts` und werden als Dependencies an die Slices gereicht

Wichtige Refactor-Fixes waehrend PR6a:
- Angefangene `transportSlice.ts` Datei war lokal korrupt (Nullbyte-Inhalt) und wurde sauber neu erstellt.
- `timelineSlice.ts` Typfehler bei `toTimelineHistoryState(...)` korrigiert (`CommandExecutionResult` statt defektem Placeholder-Type).
- `dropAssetToTimeline` Regression in der Slice-Fassung korrigiert:
  - Bild-Assets nutzen wieder bevorzugt `overlay` (nicht irrtuemlich Track-Kind `image`).

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/slices/timelineSlice.ts src/renderer/src/core/store/slices/transportSlice.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Der Store ist erstmals in echte Domain-Slices aufgeteilt (Startpunkt fuer weitere Slices).
- `studioStore.ts` verliert den kompletten Timeline-/Transport-Aktionsblock, bleibt aber weiterhin zentrale Composition-Schicht.

Risiken / Restpunkte:
- `studioStore.ts` enthaelt weiterhin viele helper functions fuer mehrere Domains; Slice-Schritt 6a ist bewusst ein erster Schnitt, kein kompletter Domain-Cleanup.
- Kein manueller GUI-Smoke durch Agent (CLI-only); letzter verfuegbarer User-Check: App-Start lief weiterhin problemlos.

### 2026-02-25 - PR 6b (Store-Slicing: `projectSlice` + `assetsSlice`)
- Scope (zweiter Schritt der vereinbarten Reihenfolge):
  - nach `timelineSlice + transportSlice` jetzt `projectSlice + assetsSlice`
  - weiterhin **keine** Extraktion von Preview / Comfy / Workflow-Studio in diesem Schritt

Umgesetzt:
- Neue Slice-Dateien:
  - `apps/desktop/src/renderer/src/core/store/slices/projectSlice.ts`
  - `apps/desktop/src/renderer/src/core/store/slices/assetsSlice.ts`
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Project-/Asset-State-Initialisierung aus dem zentralen Objekt in Slices verlagert
  - extrahierte Actions mechanisch nach Slices verschoben und via Composer eingebunden
    - `projectSlice`: `newProject`, `loadProject`, `saveProject`, `clearLastError`
    - `assetsSlice`: Filter/Query, `checkFfmpegHealth`, `ensureVideoProxy`, Asset-Importe inkl. Comfy-Output-Import
  - bestehende Helper in `studioStore.ts` bleiben vorerst bestehen und werden als Dependencies injiziert (`toProjectState`, `hydrateAssetThumbnails`, `hydrateKnownVideoProxies`, `importAssetByType`, `importComfyOutputAssetByPath`, `toErrorMessage`)

Verhalten:
- Bewusst unveraendert (mechanische Verlagerung):
  - Project-Lifecycle + Persistenzfluss
  - Thumbnail-/Proxy-Hydration nach Projekt-Load/New
  - FFmpeg-Health und Proxy-Generierung
  - Asset-Import (Video/Bild/Comfy-Output)

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/slices/projectSlice.ts src/renderer/src/core/store/slices/assetsSlice.ts src/renderer/src/core/store/slices/timelineSlice.ts src/renderer/src/core/store/slices/transportSlice.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- `studioStore.ts` ist deutlich staerker in Richtung Composition-Store verschoben.
- Die ersten vier geplanten Kernbereiche fuer PR6 sind jetzt als Slices abtrennbar vorbereitet:
  - Timeline
  - Transport
  - Project
  - Assets

Risiken / Restpunkte:
- `toProjectState(...)` schreibt bewusst mehrere Domain-Bereiche (u. a. Timeline/Transport/Assets) gleichzeitig; das ist funktional korrekt, aber noch kein final granularer Slice-Reset.
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 6c (Store-Slicing: `previewSlice`)
- Scope (dritter Schritt der vereinbarten Reihenfolge):
  - nach Timeline/Transport + Project/Assets jetzt Preview-Bereich des Stores extrahieren
  - weiterhin **keine** Extraktion von Comfy / Workflow-Studio in diesem Schritt

Umgesetzt:
- Neue Slice-Datei:
  - `apps/desktop/src/renderer/src/core/store/slices/previewSlice.ts`
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Preview-State und Toggles aus dem zentralen Store-Objekt entfernt und via Slice Composer eingebunden
  - extrahiert:
    - `proxyMode`
    - `annotating`
    - `toggleProxyMode()`
    - `toggleAnnotating()`

Verhalten:
- Bewusst unveraendert (reiner mechanischer Move)
- Keine Aenderung an der eigentlichen Preview-Render-/Source-Logik (diese liegt weiterhin in `PreviewStage.tsx` + bereits vorhandenen Store-/Helper-Flows)

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/slices/previewSlice.ts src/renderer/src/core/store/slices/projectSlice.ts src/renderer/src/core/store/slices/assetsSlice.ts src/renderer/src/core/store/slices/timelineSlice.ts src/renderer/src/core/store/slices/transportSlice.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Die ersten drei geplanten PR6-Phasen sind jetzt abgeschlossen:
  - `timelineSlice + transportSlice`
  - `projectSlice + assetsSlice`
  - `previewSlice`
- `studioStore.ts` ist weiter auf die Rolle als Kompositionsdatei reduziert.

Risiken / Restpunkte:
- Preview-bezogene Runtime-/Resolver-Logik ist bewusst **nicht** angefasst worden (nur Store-Flags/Toggles verschoben).
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 6d (Store-Slicing: `comfySlice`)
- Scope (vierter Schritt der vereinbarten Reihenfolge):
  - Comfy-bezogene Store-Zustaende und Basis-Actions extrahieren
  - `queueSelectedWorkflowRun` bewusst noch **nicht** verschieben (bleibt fuer den naechsten Schritt `workflowStudioSlice`, da es inhaltlich zum "Send to ComfyUI"-Flow gehoert)

Umgesetzt:
- Neue Slice-Datei:
  - `apps/desktop/src/renderer/src/core/store/slices/comfySlice.ts`
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Comfy-State und Comfy-Basis-Actions via Slice Composer eingebunden
  - extrahiert:
    - `comfyOnline`
    - `queuedWorkflowRuns`
    - `checkComfyHealth()`
    - `bindComfyRunEvents()`
  - bisheriges module-level `comfyRunEventUnsubscribe` aus `studioStore.ts` in den Slice verschoben
- Bestehende Helper/Verhalten bleiben erhalten:
  - `applyComfyRunEventState(...)` bleibt vorerst in `studioStore.ts` und wird als Dependency injiziert
  - Legacy-Preload-Fallbacks via `ipcClient` bleiben unveraendert

Verhalten:
- Bewusst unveraendert (mechanischer Move)
- Event-Binding bleibt idempotent (`bindComfyRunEvents()` bindet nur einmal)
- Run-Event-State-Updates bleiben ueber denselben Helper (`applyComfyRunEventState`) verdrahtet

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/slices/comfySlice.ts src/renderer/src/core/store/slices/previewSlice.ts src/renderer/src/core/store/slices/projectSlice.ts src/renderer/src/core/store/slices/assetsSlice.ts src/renderer/src/core/store/slices/timelineSlice.ts src/renderer/src/core/store/slices/transportSlice.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- `studioStore.ts` hat jetzt auch den Comfy-Basisbereich als eigene Slice-Grenze.
- Fuer PR6 fehlt damit nur noch der letzte Store-Schritt: `workflowStudioSlice`.

Risiken / Restpunkte:
- `queueSelectedWorkflowRun` arbeitet bereits auf `queuedWorkflowRuns` (jetzt comfySlice-State) und bleibt absichtlich bis zum naechsten Schritt im Workflow-Bereich.
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 6e (Store-Slicing: `workflowStudioSlice`) -> PR6 Reihenfolge komplett
- Scope (fuenfter und letzter Schritt der vereinbarten Reihenfolge):
  - verbleibenden Workflow-Studio-/Send-to-Comfy-Store-Bereich extrahieren
  - damit PR6 Store-Slicing in der abgestimmten Reihenfolge vollstaendig abschliessen

Umgesetzt:
- Neue Slice-Datei:
  - `apps/desktop/src/renderer/src/core/store/slices/workflowStudioSlice.ts`
- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Workflow-Studio-State + Actions via Slice Composer eingebunden
  - extrahiert:
    - `workflows`
    - `selectedWorkflowId`
    - `importWorkflowTemplateForSelected()`
    - `selectWorkflow()`
    - `removeWorkflow()`
    - `patchWorkflow()`
    - `queueSelectedWorkflowRun()` (Send-to-ComfyUI)
  - verbleibende Helpers (`mergeWorkflowParameters`, `promptForWorkflowId`, `upsertWorkflowDefinitionInProject`, `applyComfyRunEventState`, `createId`, `toErrorMessage`) bleiben vorerst in `studioStore.ts` und werden als Dependencies injiziert

Verhalten:
- Bewusst unveraendert (mechanischer Move)
- Workflow-Template-Import, Workflow-Parameter-Patching und Queueing gegen die bestehende Comfy-Bridge bleiben identisch
- `queueSelectedWorkflowRun()` arbeitet weiterhin mit dem in PR6d extrahierten `queuedWorkflowRuns`-State (Comfy-Slice), jetzt bewusst ueber Slice-Grenzen hinweg via Store-State

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/slices/workflowStudioSlice.ts src/renderer/src/core/store/slices/comfySlice.ts src/renderer/src/core/store/slices/previewSlice.ts src/renderer/src/core/store/slices/projectSlice.ts src/renderer/src/core/store/slices/assetsSlice.ts src/renderer/src/core/store/slices/timelineSlice.ts src/renderer/src/core/store/slices/transportSlice.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- PR6 Store-Slicing ist in der abgestimmten Reihenfolge abgeschlossen:
  1. `timelineSlice + transportSlice`
  2. `projectSlice + assetsSlice`
  3. `previewSlice`
  4. `comfySlice`
  5. `workflowStudioSlice`
- `studioStore.ts` ist jetzt primär ein Composer + Shared-Helper-Datei statt ein monolithischer Action-Block.

Risiken / Restpunkte:
- Shared-Helper-Funktionen fuer mehrere Slices liegen weiterhin in `studioStore.ts` (bewusster Zwischenstand fuer verhaltensarmen Refactor).
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 7 (Store-Helper aus `studioStore.ts` nach `core/store/utils` ausgelagert)
- Ziel:
  - `studioStore.ts` nach abgeschlossenem Store-Slicing weiter entschlacken
  - gemeinsam genutzte Helper in dedizierte Utility-Dateien verschieben (ohne Verhaltensaenderung)

Umgesetzt:
- Neue Utility-Dateien:
  - `apps/desktop/src/renderer/src/core/store/utils/storeRuntimeUtils.ts`
    - `toErrorMessage(...)`
    - `createId(...)`
  - `apps/desktop/src/renderer/src/core/store/utils/timelineStoreUtils.ts`
    - `toTimelineHistoryState(...)`
    - `sanitizeSelection(...)`
    - `getTrackOrThrow(...)`
    - `getClipOrThrow(...)`
    - `resolveInitialClipDuration(...)`
    - `getTimelineEnd(...)`
    - `clampTime(...)`
  - `apps/desktop/src/renderer/src/core/store/utils/workflowStoreUtils.ts`
    - `toProjectState(...)`
    - `applyComfyRunEventState(...)`
    - `mergeWorkflowParameters(...)`
    - `promptForWorkflowId(...)`
    - `upsertWorkflowDefinitionInProject(...)`
    - interne Workflow-Mapper (`toWorkflowViewModel(s)`, `toWorkflowParameters`)
  - `apps/desktop/src/renderer/src/core/store/utils/assetStoreUtils.ts`
    - `importAssetByType(...)`
    - `importComfyOutputAssetByPath(...)`
    - `hydrateAssetThumbnails(...)`
    - `hydrateKnownVideoProxies(...)`

- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - lokale Helper-Bloecke entfernt und durch Imports aus `core/store/utils/*` ersetzt
  - ungenutzte Alt-Konstanten aus der Monolith-Zeit entfernt (`INITIAL_WORKFLOWS`, `INITIAL_TIMELINE`)
  - `studioStore.ts` bleibt jetzt primär:
    - Typ-Definitionen (`StudioState`, ViewModels)
    - Refactor-Komposition der Slices
    - wenige Refactor-Konstanten (`WORKFLOW_ID_PATTERN`, `DEFAULT_WORKFLOW_VERSION`)

Verhalten:
- Bewusst unveraendert (mechanischer Move)
- Slices nutzen weiterhin dieselben Helper via Dependency-Injection; nur deren Speicherort hat sich geaendert

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/utils/*.ts src/renderer/src/core/store/slices/*.ts` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- PR7 reduziert die Rest-Komplexitaet von `studioStore.ts` deutlich, ohne den bereits gesliceten Store neu zu verdrahten.
- Die naechsten Refactors koennen gezielter an `utils`/`slices` arbeiten, statt wieder im Store-Monolithen zu schneiden.

Risiken / Restpunkte:
- Utility-Dateien verwenden teils `type`-Imports aus `studioStore.ts` (typischer, aber bewusst akzeptierter Refactor-Zwischenstand; runtime-seitig type-only).
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 8 (Selectors eingefuehrt: `timelineSelectors` + `previewSelectors`)
- Ziel:
  - nach Store-Slicing/Utils-Auslagerung einen ersten `selectors/`-Layer einfuehren
  - Komponenten mit vielen Einzel-Store-Subscriptions auf gebuendelte Selektoren umstellen

Umgesetzt:
- Neuer Ordner `apps/desktop/src/renderer/src/core/store/selectors/`
- Neue Selektor-Dateien:
  - `timelineSelectors.ts`
    - `selectTimelineDockStoreState(...)`
  - `previewSelectors.ts`
    - `selectPreviewStageStoreState(...)`

- Komponenten auf Selektoren umgestellt:
  - `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
    - mehrere Einzel-`useStudioStore(...)`-Subscriptions durch einen gebuendelten Selector ersetzt
  - `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
    - mehrere Einzel-`useStudioStore(...)`-Subscriptions durch einen gebuendelten Selector ersetzt

Wichtiger Technischer Punkt:
- Das Repo nutzt ein `zustand`-API, bei dem der Hook keinen zweiten `equalityFn`-Parameter annimmt.
- Daher wurde **nicht** `useStudioStore(selector, shallow)` verwendet, sondern v5-kompatibel:
  - `useStudioStore(useShallow(selector))` mit `useShallow` aus `zustand/shallow`

Verhalten:
- Bewusst unveraendert (UI-/Feature-Logik nicht geaendert)
- Fokus nur auf Subscription-Organisation / Lesbarkeit / klarere Store-Zugriffspunkte

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/selectors/*.ts src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Erster offizieller Selector-Layer ist vorhanden und wird bereits produktiv genutzt.
- `TimelineDock` und `PreviewStage` sind weniger mit Store-Details verrauscht und einfacher weiter refactorbar.

Risiken / Restpunkte:
- Bisher nur zwei Komponenten migriert; weitere Kandidaten (z. B. `AppShell`, `WorkflowStudioView`) koennen spaeter nachgezogen werden.
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 8b (Selectors Follow-up: `AppShell` + `WorkflowStudioView`)
- Ziel:
  - PR8 fortsetzen und weitere stark store-gekoppelte Komponenten auf den neuen Selector-Layer umstellen

Umgesetzt:
- Neue Selektor-Dateien:
  - `apps/desktop/src/renderer/src/core/store/selectors/appShellSelectors.ts`
    - `selectAppShellStoreState(...)`
  - `apps/desktop/src/renderer/src/core/store/selectors/workflowStudioSelectors.ts`
    - `selectWorkflowStudioStoreState(...)`

- Komponenten auf gebuendelte Store-Selektoren umgestellt:
  - `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
  - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`

Technik:
- Wie in PR8 weiterhin `useStudioStore(useShallow(selector))` (kompatibel zur im Repo vorhandenen `zustand`-Hook-Signatur)

Verhalten:
- Bewusst unveraendert (nur Store-Subscription-Organisation angepasst)
- Keine UI-/Workflow-Logikaenderung

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/selectors/*.ts src/renderer/src/ui/layout/AppShell.tsx src/renderer/src/features/workflows/WorkflowStudioView.tsx` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Selector-Layer wird jetzt bereits von vier zentralen UI-Bereichen genutzt:
  - `TimelineDock`
  - `PreviewStage`
  - `AppShell`
  - `WorkflowStudioView`

Risiken / Restpunkte:
- Weitere kleinere Komponenten koennen spaeter optional folgen; grosser Nutzen liegt bereits in den migrierten Hauptviews.
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-25 - PR 8c (Selectors Follow-up: `AssetLibraryView`)
- Ziel:
  - PR8-Selector-Layer fuer den verbleibenden Hauptbereich `AssetLibraryView` abschliessen

Umgesetzt:
- Neue Selektor-Datei:
  - `apps/desktop/src/renderer/src/core/store/selectors/assetLibrarySelectors.ts`
    - `selectAssetLibraryStoreState(...)`
- Komponente umgestellt:
  - `apps/desktop/src/renderer/src/features/assets/AssetLibraryView.tsx`
  - mehrere Einzel-`useStudioStore(...)`-Subscriptions ersetzt durch gebuendelten Selector via `useShallow(selector)`

Verhalten:
- Bewusst unveraendert (nur Store-Subscription-Organisation)
- Asset-Filter, Suche, Import-Actions und Thumbnail-Liste bleiben identisch verdrahtet

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/selectors/*.ts src/renderer/src/features/assets/AssetLibraryView.tsx` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Die zentralen Store-getriebenen UI-Hauptbereiche nutzen jetzt konsistent den Selector-Layer:
  - `AppShell`
  - `AssetLibraryView`
  - `TimelineDock`
  - `PreviewStage`
  - `WorkflowStudioView`
- `ComfyPanel` ist aktuell leer und benoetigt daher keinen Selector.

Risiken / Restpunkte:
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-26 - PR 9 (Barrel-Exports fuer `selectors` und `utils` + Import-Aufraeumen)
- Ziel:
  - nach PR8/PR8b/PR8c die neuen Ordner `selectors/` und `utils/` mit Barrel-Exports versehen
  - Importpfade in Komponenten / `studioStore.ts` vereinheitlichen und kuerzer machen

Umgesetzt:
- Neue Barrel-Dateien:
  - `apps/desktop/src/renderer/src/core/store/selectors/index.ts`
  - `apps/desktop/src/renderer/src/core/store/utils/index.ts`

- Komponenten-Imports auf Selector-Barrel umgestellt:
  - `TimelineDock.tsx`
  - `PreviewStage.tsx`
  - `AssetLibraryView.tsx`
  - `WorkflowStudioView.tsx`
  - `AppShell.tsx`
  - vorher: direkte Datei-Imports aus `selectors/<name>Selectors`
  - jetzt: Imports aus `../../core/store/selectors`

- `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Utility-Imports auf `./utils`-Barrel konsolidiert
  - mehrere Einzelimports aus `./utils/*` durch einen zentralen Barrel-Import ersetzt

Verhalten:
- Bewusst unveraendert (Import-/Struktur-Cleanup)
- Keine Logik- oder State-Aenderung

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/selectors/*.ts src/renderer/src/core/store/utils/*.ts src/renderer/src/features/assets/AssetLibraryView.tsx src/renderer/src/features/preview/PreviewStage.tsx src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/features/workflows/WorkflowStudioView.tsx src/renderer/src/ui/layout/AppShell.tsx` (Workdir `apps/desktop`) OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Die Refactor-Struktur ist jetzt leichter benutzbar:
  - `selectors/` und `utils/` koennen zentral importiert werden
- Folgearbeiten an Renderer-Store/UI erzeugen weniger Importrauschen.

Risiken / Restpunkte:
- Kein manueller GUI-Smoke durch Agent (CLI-only).

### 2026-02-26 - PR 10 (Build-/Refactor-Workflow gehaertet + `scripts/smoke.md`)
- Ziel:
  - Refactor-Workflow stabiler machen, damit Build-Laeufe nicht von veralteten Artefakten abhaengen
  - manuellen Smoke-Check als feste, wiederverwendbare Checkliste dokumentieren

Umgesetzt:
- Root `package.json`
  - `build`-Script gehaertet:
    - baut jetzt zuerst `@ai-filmstudio/shared`
    - startet danach Desktop-Build
- `apps/desktop/package.json`
  - `build`-Script gehaertet:
    - fuehrt zuerst `typecheck` aus (synchronisiert dabei die generierten `src/**/*.js` Artefakte)
    - startet danach `electron-vite build`
- Neue Datei `scripts/smoke.md`
  - kompakte manuelle Desktop-Smoke-Checkliste (New Project, Import Video, Preview, Proxy Toggle, Workflow Studio Catalog, optional Comfy Health)
  - PowerShell-Kommandos fuer Vorbereitung enthalten

Verhalten:
- Keine Feature-/Runtime-Logikaenderung
- Build-Workflow ist jetzt robuster fuer den lokalen Refactor-Alltag (Shared-Dist + Desktop-TS-Build vor Electron-Build)

Checks:
- `npm run build` (Root) OK
  - inkludiert jetzt:
    - `npm run build --workspace @ai-filmstudio/shared`
    - `npm run build --workspace @ai-filmstudio/desktop`
    - Desktop-Build ruft dabei zuerst `npm run typecheck` auf
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Ein haeufiger Refactor-Stolperstein ist entschärft:
  - Shared-`dist/` wird vor Desktop-Build aktualisiert
  - Desktop-generierte `src/**/*.js` Artefakte werden vor `electron-vite build` synchronisiert
- Smoke-Check ist jetzt als Datei versioniert statt nur in Prozessnotizen verteilt.

Risiken / Restpunkte:
- Build laeuft etwas laenger (bewusst akzeptiert zugunsten stabilerer Refactor-Checks).
- Manueller Smoke selbst wurde in diesem PR nicht durch den Agent ausgefuehrt (CLI-only); nur die Checkliste wurde formalisiert.

### 2026-02-26 - PR 11 (Lint-Workflow gehaertet: Root-`lint` als Refactor-Gate nutzbar)
- Ziel:
  - Root-`npm run lint` nach den Refactors wieder als brauchbares Gate herstellen
  - ohne grossen Regelumbau oder flaechige Codeaenderungen

Ausgangslage (Baseline vor PR11):
- `npm run lint` scheiterte vor allem an:
  - generierten Artefakten (`out/**`, generierte `src/**/*.js`, generierte `*.d.ts`)
  - `no-undef` auf TypeScript-Dateien (Node-/Browser-/DOM-/NodeJS-Globals)
  - JS-Config-Dateien (`tailwind.config.js`, `electron.vite.config.js`) ohne deklarierte Node-Globals

Umgesetzt (`apps/desktop/eslint.config.js`):
- globale Ignore-Regeln hinzugefuegt:
  - `out/**`
  - `src/**/*.js`
  - `**/*.d.ts`
- JS-Config-Override mit Node-Globals:
  - `process`, `module`, `__dirname`
- TypeScript-Override gehaertet:
  - `no-undef` fuer `*.ts` / `*.tsx` deaktiviert (TypeScript uebernimmt diese Pruefung bereits sinnvoller)

Verhalten:
- Keine App-/Feature-Logikaenderung
- ESLint-Workflow wird fokussierter auf Quellcode statt generierte Artefakte

Checks:
- `npm run lint --workspace @ai-filmstudio/desktop` OK
- `npm run lint` (Root) OK
  - `@ai-filmstudio/desktop` lint OK
  - `@ai-filmstudio/shared` lint OK

Ergebnis / Wirkung:
- Root-`lint` ist jetzt als Refactor-Guardrail deutlich brauchbarer.
- Die vorher dokumentierte Lint-Baseline (generierte Artefakte + Env-Noise) ist fuer den Desktop-Workspace weitgehend entschärft.

Risiken / Restpunkte:
- `**/*.d.ts` wird im Desktop-ESLint jetzt ignoriert (bewusst, um generierte Deklarationen aus dem Gate herauszuhalten).
- Wenn spaeter handgeschriebene `.d.ts` lint-relevant werden sollen, kann man die Ignore-Regel gezielt verfeinern.

### 2026-02-26 - Smoke-Hotfix (Preload Runtime-Fehler: `module not found: @ai-filmstudio/shared`)
- Kontext (User-Smoke-Test):
  - App startete, aber `New Project` / `Load Project` funktionierten nicht.
  - Renderer-Konsole zeigte:
    - `Unable to load preload script ... out/preload/index.cjs`
    - `Error: module not found: @ai-filmstudio/shared`

Ursache:
- `electron-vite` externalisierte `@ai-filmstudio/shared` fuer Main/Preload.
- Das Preload-Bundle (`out/preload/index.cjs`) enthielt dadurch:
  - `const shared = require("@ai-filmstudio/shared")`
- Preload laeuft als CJS/Sandbox-Bundle; der Runtime-Require auf das ESM-Workspace-Paket schlug fehl.

Umgesetzt (Fix):
- `apps/desktop/electron.vite.config.ts`
  - von deprecated `externalizeDepsPlugin()` auf `build.externalizeDeps` umgestellt
  - fuer `main` und `preload` jeweils:
    - `externalizeDeps.exclude: ['@ai-filmstudio/shared']`
- Ergebnis:
  - `@ai-filmstudio/shared` wird in Main/Preload mitgebuendelt
  - `out/preload/index.cjs` enthaelt danach keinen Runtime-Require auf `@ai-filmstudio/shared` mehr (IPC-Channels sind inline im Bundle)

Checks:
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Verifikation Bundle-Inhalt:
  - `rg "@ai-filmstudio/shared" apps/desktop/out/preload/index.cjs apps/desktop/out/main/index.js` -> **kein Treffer**
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Hinweis fuer Smoke-Retest:
- Bitte `npm run dev --workspace @ai-filmstudio/desktop` neu starten und `New Project` / `Load Project` erneut pruefen.
- Der konkrete Preload-Fehler aus der Konsole sollte danach verschwunden sein.

### 2026-02-26 - Manueller Smoke-Report (User) nach Preload-Hotfix
Durchgefuehrt vom User anhand `scripts/smoke.md`:

1. `New Project`
- Neues Projekt anlegen: **OK**
- Header zeigt Projektname/Ordnername: **OK**
- Keine Fehlermeldung / kein Crash: **OK**

2. `Import Video`
- Video importieren: **OK**
- Asset erscheint mit Thumbnail in Library: **OK**
- Proxy-Erzeugung im Hintergrund stabil: **OK**
  - User-Check: Datei in `D:\AFS_Projects\Projects\WSG\cache\proxies` vorhanden

3. `Preview Playback`
- Video auf Timeline ziehen: **OK**
- Play/Pause: **OK**
- Playhead + Preview (Bild/Video): **OK**

4. `Proxy Toggle`
- Proxy-Modus ein/aus: **OK**
- Preview bleibt stabil (kein Hard-Crash): **OK**

5. `Workflow Studio Catalog`
- `WF Studio` oeffnen: **OK**
- Katalog laedt / Warnungen sauber: **OK**
- Workflow-Auswahl: **OK**

6. `Comfy Health` (optional)
- Comfy-Status aktualisieren (ComfyUI gestartet, gruen im UI): **OK**
- Online/Offline-Anzeige ohne UI-Abbruch: **OK**
  - Hinweis: Offline wurde nach Reload sichtbar; Live-Umschaltung aktuell nicht erforderlich

Ergebnis:
- Smoke-Check nach dem Preload-Hotfix erfolgreich.
- Kernfluesse (Projekt, Import, Preview, Proxy, WF Studio, Comfy Health) sind im User-Test stabil.

### 2026-02-27 - PR 12 (Stabilitaets-/Cleanup-Pass: `ipcClient`-Hardening + Comfy-Polling-Cleanup)
- Ziel:
  - verbleibende Runtime-Risiken im Renderer-IPC-Zugriff reduzieren
  - Comfy-Polling-Lifecycle um sauberen Shutdown-Cleanup ergaenzen

Umgesetzt:
- `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
  - `PROJECT_API_UNAVAILABLE_MESSAGE` eingefuehrt
  - alle `ProjectApiPort`-Methoden auf zentrale `requireMethod(...)`-Guards umgestellt
  - fehlende Preload-Methoden laufen jetzt konsistent als `IpcUnavailableError` statt ungefangener Runtime-`TypeError`
- `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - direkte `getProjectApi()`-Nutzung entfernt
  - Workflow-Katalog-Load + `Send to ComfyUI` nutzen jetzt `getIpcClient()`
- `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
  - Asset-Source-Resolution auf `getIpcClient()` umgestellt
  - bestehende Source-Prioritaet/Fallback-Reihenfolge (`file://` vs `data:`) unveraendert beibehalten
- `apps/desktop/src/main/services/comfyService.ts`
  - Service-API um `dispose()` erweitert
  - Polling laeuft jetzt mit `AbortController`/`AbortSignal` (abbruchfaehige Delays + Fetch-Polling)
  - aktive Polls werden pro `runId` verwaltet; gleicher `runId` stoppt ggf. alten Poll vor Neustart
- `apps/desktop/src/main/index.ts`
  - `app.on('before-quit', ...)` hinzugefuegt und `comfyService.dispose()` verdrahtet

Verhalten:
- Keine Feature-Erweiterung; gezielter Stabilitaets-/Cleanup-Schritt.
- UI- und IPC-Flows bleiben bewusst unveraendert, nur Runtime-Guards und Cleanup sind gehaertet.

Checks:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run lint --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Zusatzverifikation:
  - `rg -n "getProjectApi\\(" apps/desktop/src/renderer/src` -> nur noch Adapter-Treffer (`projectApi.ts`, `ipcClient.ts`)
- Build-Hinweis unveraendert vorhanden: PostCSS `@import`-Reihenfolge in `apps/desktop/src/renderer/src/styles.css`

Ergebnis / Wirkung:
- Renderer-IPC-Zugriffe sind konsistenter gegen Legacy-/Race-Faelle abgesichert.
- Comfy-Polling hat jetzt einen expliziten Lifecycle-Cleanup beim App-Exit (reduziert Timer-/Polling-Leak-Risiko).

Risiken / Restpunkte:
- Manueller GUI-Smoke wurde in diesem PR nicht durch den Agent ausgefuehrt (CLI-only).
- `ipcClient`-Guards liefern jetzt bewusster frueh Fehlerhinweise; bei sehr alten Preload-Staenden koennen diese Meldungen sichtbarer auftreten (gewolltes Verhalten).

### 2026-02-27 - PR12 Supplement (Smoke-Check nach Stabilitaets-/Cleanup-Pass)
Durchgefuehrt entlang `scripts/smoke.md` mit Fokus auf reproduzierbare CLI-/Startup-Pruefung.

Ausgefuehrte Vorbereitung:
- `npm install` OK
- `npm run build --workspace @ai-filmstudio/shared` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK

Wichtige Beobachtung im Agent-Run:
- In der Agent-Shell war `ELECTRON_RUN_AS_NODE=1` gesetzt; damit startete Electron im Node-Modus und erzeugte einen falschen Startfehler (`cjsPreparseModuleExports`).
- Fuer den eigentlichen Smoke-Run wurde der Start explizit ohne diesen Env-Flag ausgefuehrt.

Smoke-Status:
- Desktop-App-Startpfad (`dev`/`preview`) blockiert nach Bereinigung des Env-Flags nicht mehr sofort mit dem oben genannten Node-Mode-Fehler.
- Interaktive GUI-Schritte (`New Project`, `Import Video`, `Preview Playback`, `Proxy Toggle`, `WF Studio`, optional `Comfy Health`) konnten im Agent-CLI nicht vollstaendig manuell durchgeklickt werden.
- User-Retest (manuell) nachgereicht: `New Project`, `Import Video`, `Preview`, `Proxy Toggle`, `WF Studio`, `Comfy Health` -> **alles OK**, keine Fehler gefunden.

Ergebnis:
- PR12 hat keine Regression in den Build-/Typecheck-/Lint-Gates.
- Der gemeldete Startfehler war env-bedingt (Node-Mode), nicht durch PR12-Codepfade verursacht.

Offene Punkte:
- Keine offenen Smoke-Punkte fuer PR12; User-Retest ist vollstaendig gruen.

## Vorlage fuer kommende Refactor-Eintraege

Fuer jeden Refactor-Schritt hier dokumentieren:
- Was wurde mechanisch verschoben?
- Wurde Verhalten bewusst unveraendert gehalten?
- Welche Checks liefen (`typecheck`, `lint`, `build`, Smoke)?
- Welche Risiken/Nacharbeiten bleiben?
