# Projektkontext - Laufender Snapshot

Letzte Aktualisierung: 2026-02-28
Quelle: Repository-Scan (apps/desktop, packages/shared, DOKUMENTATIONEN)

## Pflicht-Format (kurz)
- Letzter/Aktueller Stand
- Abgeschlossene Aufgaben
- Anstehende Aufgaben
- Probleme + Fixes

Hinweis: Detailrichtlinie in `DOKU_STANDARD.md`.

## Architektur-Kern
- Monorepo mit npm Workspaces (`apps/*`, `packages/*`)
- Desktop-App in `apps/desktop` mit Electron + electron-vite + React + TypeScript
- Shared Domain/Schema in `packages/shared`
- Main-Prozess implementiert Projekt-New/Load/Save, Asset-Import und v1->v2 Migration
- Renderer ist aktuell UI-first mit mehreren UI-only Platzhaltern

## Lokale System-Capabilities (aus Systeminfos)
- Starke Zielhardware: i9-14900K, RTX 5090 (32GB), 64GB RAM
- `ffmpeg` ist im PATH verfuegbar (`C:\Program Files\ffmpeg-7\bin`)
- Node.js 22.x / Conda / CUDA 12.9 vorhanden (lokale AI- und Video-Pipelines moeglich)

## Electron/Vite Setup
- `electron.vite.config.ts`: getrennte Targets fuer `main`, `preload`, `renderer`
- Preload wird als CJS gebaut (`entryFileNames: [name].cjs`)
- Renderer mit `@vitejs/plugin-react`

## Renderer-Struktur (apps/desktop/src/renderer/src)
- `ui/layout/AppShell.tsx` als aktiver Entry-Shell
- `features/` mit `assets`, `preview`, `timeline`, `comfy`
- `core/` mit `model`, `adapters`, `engine` (Timeline Engine v2), `commands` (Command Pattern + Undo/Redo)
- `ui/theme/tokens.css` + `styles.css`

## Aktueller Stand
- UI-Shell laeuft, Navigation vorhanden
- UI-State aus mehreren Panels auf zentralen Zustand-Store (`zustand`) umgestellt
- Persistenz/Projektverwaltung im Main-Prozess vorhanden
- Shared Types + JSON Schema auf Timeline v2 (track-basiert)
- Timeline Engine v2 in `core/engine/timelineEngine.ts` implementiert (immutable add/move/remove/trim + overlap checks)
- Timeline-Engine ist jetzt im Store eingehangen (Clip-Drops erzeugen echte Timeline-Clip-Operationen)
- Command Pattern fuer Timeline-Operationen ist implementiert (`core/commands`) und im Store aktiv fuer echtes Undo/Redo.
- UI ist an echte Projektdaten gebunden (New/Load/Save/Import ueber `projectApi`, Assets/Timeline aus `project.json` im Store).
- Timeline rendert jetzt visuell Tracks + Clips inkl. Selektion und Basis-Editing (nudge/trim/remove) ueber Commands.
- Direkte Timeline-Edit-Aktionen sind jetzt per Maus in der Clip-Ansicht verfuegbar (Drag=Move, Edge-Drag=Trim, Delete=Remove), command-basiert.
- Cut-Operation ist jetzt integriert: selektierter Clip kann an der Playhead-Zeit command-basiert geteilt werden (Toolbar + `Ctrl+B`, Undo/Redo-faehig).
- Ripple Delete ist jetzt integriert: selektierter Clip kann command-basiert mit Lueckenschluss entfernt werden (Toolbar + `Shift+Delete`, Undo/Redo-faehig).
- Slip-Operation ist jetzt integriert: Clip-Inhalt kann bei fester Clip-Position ueber `offset` verschoben werden (Toolbar + `Alt+Left/Alt+Right`, Undo/Redo-faehig).
- Slip-UX ist gehaertet: Bei fehlendem Slip-Spielraum (vollstaendige Quelllaenge im Clip) wird Slip deaktiviert/erlaeutert; zusaetzlicher Shortcut-Fallback `Ctrl+[ / Ctrl+]` und sichtbarer Offset im Clip-Label.
- Comfy-Workflow-Basis ist jetzt typisiert und erweiterbar: pro Workflow eigener TS-Contract (discriminated union), registry-basierte Felder im Panel und lokale Queue-Erzeugung aus validierten Requests.
- Persistenz-Bridge ist geschlossen: Timeline wird aus `project.json` geladen, per Store-Project synchron gehalten und ueber Save in `project.json` geschrieben (inkl. Dirty-Flag).
- Playback-Transport ist integriert: Play/Pause im Preview, laufende Zeit, Scrubber und Playhead in der Timeline.
- Preview rendert jetzt echte Timeline-Medien: aktiver Clip wird ueber `currentTime` aufgeloest und als Video/Bild im Monitor abgespielt/angezeigt.
- Preview-Source-Resolution ist gehaertet: Fallback auf berechnete `file://`-URL aus `projectRoot + asset.filePath`, plus expliziter "Asset Unavailable"-Status statt dauerhaftem "Loading".
- Preview nutzt nun primaer eine IPC-basierte Media-Data-URL (Main liest Asset-Datei und liefert `data:`-Quelle), mit `file://` als sekundarem Fallback fuer lokale Pfadauflosung.
- Preview zeigt jetzt Media-Fehler explizit an (z. B. Decode/Codec oder Source-not-supported), damit schwarze Frames diagnostizierbar sind.
- FFmpeg-Healthcheck ist im Store + UI integriert (sichtbarer Runtime-Status).
- Proxy-Transcode-Pipeline ist integriert (`cache/proxies` via FFmpeg) und Preview nutzt bei aktivem Proxy-Mode bevorzugt Proxy-Videoquellen.
- Playback-Quelle ist waehrend laufendem Clip jetzt stabil gelockt (kein Mid-Playback Wechsel mehr von Original auf Proxy) und Video-Source-Prioritaet wurde auf `file://` vor `data:` gestellt.
- Dev-Renderer-Fix: Bei `http://localhost` werden keine `file://`-Quellen mehr fuer Playback verwendet (Chromium blockiert lokale Ressourcen), stattdessen reine `data:`-Quelle via IPC.
- Dev-Playback weiter gehaertet: BrowserWindow setzt in Dev `webSecurity: false` (nur lokal), damit `file://`-Medien aus dem Projektpfad im Preview geladen werden koennen; CSP-Meta in `renderer/index.html` gesetzt.
- Proxy-Hotfix: Bei Proxy-Decode/Load-Fehler wird fuer das betroffene Asset automatisch auf Originalquelle zurueckgeschaltet (Proxy-Bypass pro Asset), statt Playback komplett zu stoppen.
- Timeline-Drop nutzt jetzt fuer Video-Assets die echte Medienlaenge (wenn beim Import als `durationSeconds` verfuegbar) statt fixer 5s.
- ComfyUI-Bridge ist jetzt echt verdrahtet: Main-IPC (`comfy:health`, `comfy:queue-run`), Template-Loading aus `workflows/<workflowId>.api.json`, Placeholder-Rendering und Run-Status-Events (`comfy:run-event`) bis in den Renderer-Store.
- Shared Comfy-Contracts sind in `packages/shared/src/comfy.ts` zentralisiert; Preload/Renderer nutzen denselben Typvertrag fuer Health, Queue und Run-Events.
- Comfy-Queue im Store ist jetzt Main-gekoppelt (kein lokaler Stub mehr) inkl. Statusverlauf (`pending/running/success/failed`) und Run-Messages im Panel.
- Comfy-Bridge-Startup ist gehaertet: Falls ein aelterer Preload ohne neue Comfy-Methoden laeuft, crasht der Renderer nicht mehr; Store faengt fehlende API-Funktionen robust ab und zeigt stattdessen einen Hinweis.
- Renderer-IPC-Adapter ist jetzt fuer alle Projektmethoden zentral runtime-geguarded (`IpcUnavailableError` statt ungefangener `TypeError` bei fehlenden Preload-Methoden).
- Comfy-Main-Service hat jetzt explizites Polling-Lifecycle-Cleanup (`dispose()` + AbortController), verdrahtet auf App-`before-quit`.
- Workflow-Template-Import ist jetzt direkt im Comfy-Panel aktiv: Upload-Button importiert eine ausgewaehlte JSON-Datei nach `workflows/<workflowId>.api.json` im aktuellen Projekt.
- Workflow-Template-Import/Workflow-Liste ist nun persistenter: Import legt fehlende Workflows im Store/Projekt an, schreibt `workflowDefinitions` mit und speichert das Projekt; Upload funktioniert auch ohne selektierten Workflow via ID-Prompt.
- Comfy-Rechtsleiste wurde fuer den geplanten Scene-Editor-Umbau bewusst geleert: Upload-Button und bisheriger `Local Workflows`/Config-Inhalt im `ComfyPanel` sind entfernt, Sidebar bleibt als leere Flaeche erhalten.
- Vorbereitende Doku/Vorlagen fuer den neuen Workflow-Katalog sind angelegt: `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/` enthaelt Dummy-`*.meta.json` fuer die priorisierten Video-/Image-Workflows (WAN/Qwen/Flux/SeedVR).
- Neuer Workflow-Studio-Grundstein ist im bisherigen `Lab`-Tab aktiv: projekt-lokaler `*.meta.json`-Katalog wird per IPC geladen (`workflows/images|videos|audio/*.meta.json`) und in einer 3-Spalten-UI (Kategorien / Workflow-Liste / Meta-Details) angezeigt.
- Workflow-Studio rechte Seite ist jetzt editierbar: `defaults` (`width/height/fps/frames/steps`) koennen pro ausgewaehltem Meta-Workflow geaendert werden, Inputs werden als Asset-Selects aus Projekt-Assets angeboten (Image/Video).
- `Send to ComfyUI` ist im Workflow-Studio jetzt aktiv verdrahtet und sendet katalogbasierte Workflows direkt ueber die bestehende Comfy-Bridge (`ipcClient.queueComfyRun` -> Main `comfy:queue-run`) inklusive lokalem Queue-/Fehler-Feedback (runId/promptId).
- Workflow-Studio zeigt jetzt zusaetzlich laufende/letzte Runs des aktuell ausgewaehlten Workflows aus dem zentralen Store (`queuedWorkflowRuns`) inkl. Status, Progress, `promptId` und extrahierten Output-Pfaden.
- Comfy-Outputs koennen jetzt direkt aus `Workflow Studio -> Recent Runs` per Button als Projekt-Assets importiert werden (Main holt Dateien ueber ComfyUI `/view`, Store integriert sie inkl. `project.json`-Save/Thumbnail/Video-Proxy wie normaler Import).
- Workflow-Studio unterstuetzt jetzt zusaetzlich `Import all outputs` pro Run.
- Workflow-Meta-Validator ist als fester Check verfuegbar: `npm run validate:workflows`.
- Timeline-Audio-Ausbau ist umgesetzt: globale Reset-Aktion `Clear M/S`, Clip-Lautstaerke `Clip.gain` (0..2) inkl. Preview-Nutzung und vorbereiteter Keyframe-Slot `Clip.automation.gain[]`.
- Audio-Inputs aus `*.meta.json` sind im Workflow-Studio aktiv; `Asset.type` unterstuetzt jetzt `audio` end-to-end (Shared/Main/Preload/Renderer, Import und Preview).
- Audio-Waveform-Pipeline nutzt echte FFmpeg-Peaks inkl. Cache (`cache/waveforms/`) und Import-Prefetch.
- Preview-Audio hat sichtbares Metering und robustes Multi-Audio-Handling (parallele aktive Clips, Mute/Solo-respektiert).
- Shared Workflow-Meta-Typen sind in `packages/shared/src/workflows.ts` eingefuehrt; Main/Preload/Renderer teilen jetzt denselben Typvertrag fuer den Workflow-Katalog.
- Shared IPC-Contracts sind fuer zentrale Renderer/Main/Preload-Bereiche eingefuehrt (`packages/shared/src/ipc/*`); `IPC_CHANNELS` wird zur Runtime jetzt ueber `@ai-filmstudio/shared` (Package-Export auf `dist/`) geladen, ohne relative `packages/shared/src`-Runtime-Imports.
- User arbeitet jetzt mit echten projekt-lokalen Workflow-Dateien in `Projects\\<Projekt>\\workflows\\videos|images|audio\\` (Comfy `Export (API)`), inkl. eigener `*.meta.json` je Workflow.
- Wichtige Konvention ist abgestimmt: `meta.inputs[].key` endet auf `...AssetId` (z. B. `refIMGAssetId`), waehrend die `*.api.json` Platzhalter die abgeleiteten Pfade nutzen (z. B. `{{refIMGAssetAbsPath}}`).
- User-Setup konkret verifiziert (Projekt `WSG`): reale API-Workflows liegen unter `D:\\AFS_Projects\\Projects\\WSG\\workflows\\videos\\` und `...\\images\\`; `audio\\` ist aktuell bewusst leer bis Audio-Asset-Support umgesetzt wird.
- Wichtig fuer den Katalog-Loader: Ordnernamen muessen aktuell exakt `videos`, `images`, `audio` (Plural/Lowercase) sein; API-Dateien werden als `*.api.json` erwartet.
- Meta-JSON-Fallen sind mit User abgestimmt/geprueft: `inputs[].key` darf nicht direkt `...AssetAbsPath` sein (sondern `...AssetId`), und JSON-Dateien muessen strikt valide sein (kein trailing comma in Arrays/Objekten).

## Offene Kernaufgaben
- Snapping/Cut/Ripple/Slip als Basis-NLE-Operationen sind integriert; naechster Fokus ist Persistenz-Haertung und weitere Editor-Funktionen.
- Persistenz-Flow weiter haerten (Autosave-Strategie, Konflikt-Handling)
- Comfy/Workflow-Bereich weiter haerten (Template-Authoring-UX, Output-Dateien in Asset-Library uebernehmen, konfigurierbare Comfy-URL in Settings)

## Beobachtete Inkonsistenz
- Keine offene Timeline-v1/v2-Inkonsistenz mehr in `core/model/timeline.ts` (auf `tracks[]` migriert).

## Aufgabenjournal
- 2026-02-28: Doku-Synchronisierung abgeschlossen (`Kontext-Aktuell.md`, `Refactor_process.md`) auf Basis der umgesetzten Punkte: `Import all outputs`, `npm run validate:workflows`, Audio end-to-end inkl. Preview-Metering/Multi-Audio, echte Waveform-Peaks mit Cache/Prefetch, Timeline-Audio (`Clear M/S`, `Clip.gain`, `automation.gain[]`).
- 2026-02-27: User hat den manuellen Smoke nach PR12 vollstaendig bestaetigt: `New Project`, `Import Video`, `Preview`, `Proxy Toggle`, `WF Studio`, `Comfy Health` ohne Fehler, alles weiterhin stabil.
- 2026-02-27: PR12-Supplement-Smoke dokumentiert: Vorbereitung gemaess `scripts/smoke.md` (`npm install`, Shared-Build, Desktop-Typecheck, Desktop-Build) vollstaendig gruen. Im Agent-Environment war `ELECTRON_RUN_AS_NODE=1` gesetzt und erzeugte initial einen falschen Node-Mode-Startfehler (`cjsPreparseModuleExports`); fuer den eigentlichen Starttest wurde der Run ohne diesen Env-Flag ausgefuehrt. Vollstaendige interaktive GUI-Klickstrecke bleibt im Agent-CLI nicht direkt durchfuehrbar und ist als User-Retest offen.
- 2026-02-27: Refactor PR 12 (Stabilitaets-/Cleanup-Pass) umgesetzt: `ipcClient` fuer alle `ProjectApiPort`-Methoden auf konsistente Runtime-Guards umgestellt, verbleibende direkte `getProjectApi()`-Nutzung in `WorkflowStudioView`/`PreviewStage` entfernt und `comfyService` um `dispose()` + `AbortController`-basiertes Polling-Cleanup erweitert; Main ruft Cleanup bei `before-quit` auf. Desktop-Checks (`typecheck`, `lint`, `build`) gruen.
- 2026-02-26: User-Smoke nach Preload-Hotfix vollstaendig positiv: `New Project`, `Load/Save`-relevanter Projektfluss, Video-Import + Thumbnail, Proxy-Erzeugung (`Projects\\WSG\\cache\\proxies` verifiziert), Timeline/Preview-Playback, Proxy-Toggle, Workflow-Studio-Katalog/Selektion sowie optionaler Comfy-Health-Check funktionieren stabil. Hinweis aus User-Test: Online/Offline-Wechsel bei Comfy wird aktuell nach Reload sichtbar (kein harter Live-Refresh erforderlich).
- 2026-02-26: Smoke-Hotfix umgesetzt nach User-Manual-Test: Preload konnte `@ai-filmstudio/shared` zur Runtime nicht laden (`module not found`), wodurch Projektaktionen blockiert waren. Ursache war `electron-vite`-Externalisierung fuer Main/Preload. Fix in `apps/desktop/electron.vite.config.ts`: `build.externalizeDeps.exclude: ['@ai-filmstudio/shared']` fuer `main` und `preload`, sodass `IPC_CHANNELS` im Bundle landet. Desktop-Build erfolgreich; Verifikation: kein `@ai-filmstudio/shared` mehr in `out/preload/index.cjs`/`out/main/index.js`.
- 2026-02-26: Refactor PR 11 umgesetzt: Desktop-ESLint-Konfiguration gehaertet (`apps/desktop/eslint.config.js`) mit Ignore-Regeln fuer generierte Artefakte (`out/**`, `src/**/*.js`, `**/*.d.ts`), Node-Globals fuer JS-Config-Dateien und deaktiviertem `no-undef` fuer TypeScript-Dateien. Ergebnis: `npm run lint --workspace @ai-filmstudio/desktop` und Root-`npm run lint` laufen gruen.
- 2026-02-26: Refactor PR 10 umgesetzt: Build-/Refactor-Workflow gehaertet. Root-`build` baut jetzt zuerst `@ai-filmstudio/shared` und danach Desktop; Desktop-`build` fuehrt vor `electron-vite build` zusaetzlich `typecheck` aus (synchronisiert generierte `src/**/*.js` Artefakte). Zusaetzlich `scripts/smoke.md` als versionierte manuelle Smoke-Checkliste angelegt. Root-`npm run build` erfolgreich getestet.
- 2026-02-26: Refactor PR 9 umgesetzt: Barrel-Exports fuer `core/store/selectors` und `core/store/utils` eingefuehrt (`index.ts`), Komponenten-Imports (`AppShell`, `AssetLibraryView`, `TimelineDock`, `PreviewStage`, `WorkflowStudioView`) auf den Selector-Barrel umgestellt und `studioStore.ts`-Utility-Imports ueber `./utils` konsolidiert. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 8c umgesetzt: `assetLibrarySelectors` eingefuehrt und `AssetLibraryView` auf gebuendelten Store-Selector via `useShallow(selector)` umgestellt. Damit nutzen jetzt alle zentralen Store-getriebenen Hauptviews den neuen Selector-Layer (ComfyPanel aktuell leer). Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 8b umgesetzt: Selector-Follow-up mit `appShellSelectors` und `workflowStudioSelectors`; `AppShell` und `WorkflowStudioView` auf gebuendelte Store-Selektoren via `useShallow(selector)` umgestellt. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 8 umgesetzt: erster Selector-Layer unter `core/store/selectors/` eingefuehrt (`timelineSelectors`, `previewSelectors`) und `TimelineDock` sowie `PreviewStage` auf gebuendelte Store-Selektoren umgestellt. Wegen aktueller `zustand`-API wurde v5-kompatibel `useShallow(selector)` verwendet (statt zweitem `equalityFn`-Parameter). Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 7 umgesetzt: gemeinsame Store-Helper aus `studioStore.ts` nach `core/store/utils/*` ausgelagert (`storeRuntimeUtils`, `timelineStoreUtils`, `workflowStoreUtils`, `assetStoreUtils`) und `studioStore.ts` auf Helper-Imports umgestellt; ungenutzte Alt-Konstanten aus der Monolith-Phase entfernt. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 6e (Store-Slicing Schritt 5) umgesetzt: `workflowStudioSlice` unter `core/store/slices/` eingefuehrt und verbleibenden Workflow-Studio-Bereich (`workflows`, Auswahl, Patch/Remove, Template-Import, `queueSelectedWorkflowRun`) mechanisch aus `studioStore.ts` extrahiert. Damit ist PR6 Store-Slicing in der vereinbarten Reihenfolge komplett. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 6d (Store-Slicing Schritt 4) umgesetzt: `comfySlice` unter `core/store/slices/` eingefuehrt und Comfy-Basisbereich (`comfyOnline`, `queuedWorkflowRuns`, `checkComfyHealth`, `bindComfyRunEvents`) mechanisch aus `studioStore.ts` extrahiert; `queueSelectedWorkflowRun` bewusst fuer den naechsten Workflow-Slice-Schritt im Store belassen. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 6c (Store-Slicing Schritt 3) umgesetzt: `previewSlice` unter `core/store/slices/` eingefuehrt und Preview-Flags/Toggles (`proxyMode`, `annotating`, `toggleProxyMode`, `toggleAnnotating`) mechanisch aus `studioStore.ts` extrahiert. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 6b (Store-Slicing Schritt 2) umgesetzt: `projectSlice` und `assetsSlice` unter `core/store/slices/` eingefuehrt und in `studioStore.ts` komponiert. Extrahiert wurden u. a. `new/load/saveProject`, Asset-Importe, FFmpeg-Health/Proxy sowie Asset-Filter/Query; Verhalten blieb mechanisch unveraendert. Desktop-Checks (`typecheck`, gezieltes `eslint`, `build`) gruen.
- 2026-02-25: Refactor PR 6a (Store-Slicing Start) umgesetzt: `timelineSlice` und `transportSlice` unter `core/store/slices/` eingefuehrt und in `studioStore.ts` als erste Composed-Slices verdrahtet; Timeline-/Transport-Actions inkl. `undoUi/redoUi` mechanisch aus dem Store-Block verlagert. Nebenfixes: korrupte `transportSlice.ts` (Nullbytes) neu erstellt, Typfehler in `timelineSlice.ts` korrigiert und Image-Drop-Track-Praeferenz (`overlay`) in der Slice-Version wiederhergestellt. Checks (`typecheck`, gezieltes `eslint`, `build`) fuer Desktop gruen.
- 2026-02-25: Refactor Follow-up vor PR6 umgesetzt: relativen Runtime-Import-Hack fuer `IPC_CHANNELS` entfernt; `@ai-filmstudio/shared` ueber Package-Export (`dist/index.js`) fuer Main/Preload zur Runtime nutzbar gemacht, `packages/shared/package.json` um `exports` erweitert und fehlenden npm-Workspace-Link per `npm install` hergestellt. Manueller GUI-Smoke-Check war im Agent-CLI nicht ausfuehrbar; User bestaetigt jedoch fuer den heutigen Lauf: "App startet weiterhin problemlos".
- 2026-02-22: Refactor PR 5 (Renderer IPC Client Wrapper) umgesetzt: `core/adapters/ipcClient.ts` eingefuehrt (typed `IpcUnavailableError`, Runtime-Guards fuer Legacy-Preload-Methoden); `studioStore.ts` auf den Wrapper umgestellt und verstreute Comfy-/Workflow-Guard-Casts aus dem Store entfernt.
- 2026-02-22: Refactor PR 4 (Shared IPC Contracts + Deduplizierung) umgesetzt: `packages/shared/src/ipc/*` fuer Channel-Konstanten und IPC-Response-Typen eingefuehrt; Preload/Renderer/Main-IPCRouter auf gemeinsame Typen umgestellt und `env.d.ts` von Typ-Imports aus `preload/index` entkoppelt. Channel-Konstanten werden im Desktop aktuell per relativem Runtime-Import aus `packages/shared/src/ipc/channels.js` genutzt (build-stabiler Zwischenstand).
- 2026-02-22: Refactor PR 3 (WorkflowCatalogService) mechanisch umgesetzt: Workflow-Katalog-Loader + `*.meta.json` Parsing/Validation (`project:list-workflow-catalog`) aus `apps/desktop/src/main/index.ts` nach `apps/desktop/src/main/services/workflowCatalogService.ts` extrahiert; Main bindet den bestehenden IPC-Channel jetzt ueber eine Service-Instanz.
- 2026-02-22: Refactor PR 2 (ComfyService) mechanisch umgesetzt: Comfy-Health/Queue/Polling/Template-Rendering/History-Auswertung aus `apps/desktop/src/main/index.ts` nach `apps/desktop/src/main/services/comfyService.ts` extrahiert; Main haelt nur noch `currentProjectRoot` + `readCurrentProjectFromDisk()` + BrowserWindow-Event-Emitter als Bruecke.
- 2026-02-22: Refactor PR 1 (Main split - Teil 1) mechanisch umgesetzt: `apps/desktop/src/main/index.ts` auf zentralen IPC-Router `src/main/ipc/registerIpc.ts` umgestellt; FFmpeg-/Proxy-Logik nach `src/main/services/ffmpegService.ts` und Asset-URL/Thumbnail-Reader nach `src/main/services/assetService.ts` extrahiert (Verhalten unveraendert, Channel-Namen unveraendert).
- 2026-02-22: Refactor PR 0 (Guardrails) Baseline gemessen: Root `typecheck` und `build` sind gruen, Root `lint` ist aktuell nicht gruener Gate (ESLint erfasst generierte Dateien + bekannte Env/Globals-Config-Luecken). Details in `DOKUMENTATIONEN/Refactor_process.md`.
- 2026-02-22: Refactor-Dokumentation organisatorisch getrennt: Neue Datei `DOKUMENTATIONEN/Refactor_process.md` als zentrale Prozess-/Fortschrittsdoku fuer Modularisierung/Architektur-Refactor eingefuehrt; `Abgeschlossende_Aufgabe.md` bleibt fuer Features/Hotfixes.
- 2026-02-21: Repository-Scan abgeschlossen (Electron/Vite-Setup, Renderer-Struktur, DOKUMENTATIONEN-Analyse, Projektstand zusammengefasst).
- 2026-02-21: Kernaufgabe 1 abgeschlossen: `core/engine/timelineEngine.ts` umgesetzt (track-basierte immutable Ops, typed errors, overlap detection, trimming via offset) und `core/model/timeline.ts` auf Domain v2 korrigiert.
- 2026-02-21: Kernaufgabe 1 - Phase 2 abgeschlossen: zentraler Zustand-Store mit `zustand` eingefuehrt, Engine-Operationen in den Store integriert, UI-Dummy-State in `AppShell`, `AssetLibraryView`, `TimelineDock`, `ComfyPanel` und `PreviewStage` auf Store-State umgestellt.
- 2026-02-21: Kernaufgabe 1 - Phase 3 abgeschlossen: Command Pattern in `core/commands` umgesetzt, History-Stacks (`past/future`) eingefuehrt und echtes Undo/Redo ueber Timeline-Operationen in den Store integriert.
- 2026-02-21: Folgeaufgabe (Schritt 1+2) abgeschlossen: echte Projekt-Datenanbindung in UI umgesetzt (New/Load/Save/Import + Thumbnail-Hydration), Timeline visuell mit Clip-Rendering, Selektion und command-basierten Edit-Aktionen erweitert.
- 2026-02-21: Folgeaufgabe (Punkt 3+4) abgeschlossen: direkte Move/Trim/Remove-Interaktionen in Timeline per Command-Dispatch umgesetzt und Persistenz-Bridge finalisiert (Load/Save von Timeline ueber `project.json` inkl. Dirty-State).
- 2026-02-21: Zusatzaufgabe abgeschlossen: Play-Transport eingebaut (Play/Pause-Button, Preview-Zeit/Scrubber, Timeline-Playhead mit Seek).
- 2026-02-21: Zusatzaufgabe abgeschlossen: echter Preview-Render eingebaut (Asset-File-URL IPC-Bridge + aktiver Clip wird als Video/Bild im Monitor dargestellt und zur Timeline-Zeit synchronisiert).
- 2026-02-21: Zusatzfix abgeschlossen: Preview-Asset-URL-Fallback implementiert (robuste Aufloesung auch ohne direkte IPC-URL), Loading-Haenger beseitigt und "Asset Unavailable"-Feedback eingebaut.
- 2026-02-21: Zusatzfix abgeschlossen: Media-Source auf IPC-Data-URL erweitert (`project:asset-media-data-url`) um lokale `file://`-Ladeprobleme im Renderer zu umgehen.
- 2026-02-21: Zusatzfix abgeschlossen: Media-Error-Handling im Preview erweitert (`video/img onError`, klare Fehlermeldung fuer Decode/unsupported source).
- 2026-02-21: Ausbau abgeschlossen: FFmpeg Healthcheck + Video-Proxy-Pipeline eingebaut (Main/Preload/Store/Preview), inkl. UI-Status und Proxy-Prefetch bei Video-Assets.
- 2026-02-21: Hotfix abgeschlossen: Playback-Abbruch nach 1-2s behoben durch Source-Lock pro aktivem Clip + Video-Resolver-Reihenfolge (`file://` zuerst, `data:` fallback), um Source-Resets waehrend laufendem Playback zu vermeiden.
- 2026-02-21: Hotfix abgeschlossen: Dev-CSP/Origin-Problem behoben (`Not allowed to load local resource`), Resolver nutzt bei `http/https` Renderer nur noch IPC-`data:` statt `file://`.
- 2026-02-21: Hotfix abgeschlossen: Dev-Media-Ladepfad finalisiert (`webSecurity` in Dev deaktiviert + Resolver wieder auf `file://` fuer Video priorisiert) und CSP-Meta im Renderer hinterlegt.
- 2026-02-21: Hotfix abgeschlossen: Proxy-Playback-Fallback eingebaut (bei Proxy-Fehler automatische Rueckfallebene auf Originalvideo, asset-lokal und ohne globales Deaktivieren von Proxy-Mode).
- 2026-02-21: Punkt 1 gestartet und umgesetzt (Snapping): Timeline-Drag fuer Move/Trim rastet jetzt innerhalb 10px auf Clip-Kanten im selben Track ein; Preview- und Commit-Logik teilen sich denselben Snap-Resolver in `TimelineDock.tsx`.
- 2026-02-21: Punkt 1 erweitert (Cut): Command-basierter Split am Playhead umgesetzt (`timeline/cut-clip`), inkl. Engine-Operation, Store-Action (`cutSelectedClipAtCurrentTime`) sowie Timeline-UI-Trigger (Button + `Ctrl+B`).
- 2026-02-21: Asset-Daueranbindung umgesetzt: Video-Import ermittelt via `ffprobe` die `durationSeconds`; Timeline-Drop uebernimmt diese Dauer fuer neue Clips statt fixem 5s-Default.
- 2026-02-21: Punkt 1 erweitert (Ripple Delete): Neuer Command `timeline/ripple-remove-clip` + Engine-Operation `rippleRemoveClip(...)`; Timeline-UI unterstuetzt Ripple Delete via Button und `Shift+Delete`.
- 2026-02-21: Punkt 1 erweitert (Slip): Neuer Command `timeline/slip-clip` + Engine-Operation `slipClip(...)`; Timeline-UI unterstuetzt Slip via Button und `Alt+ArrowLeft/Alt+ArrowRight`.
- 2026-02-21: Slip-Followup: No-op-Fall behoben (wenn `durationSeconds === clip.duration`), jetzt mit klarem Feedback/Disable-Logik, plus Shortcut-Fallback `Ctrl+[ / Ctrl+]` und sichtbarer `offset`-Anzeige in Timeline-Clips.
- 2026-02-21: Comfy-Contract-Start umgesetzt: `core/comfy/workflowContracts.ts` mit pro-Workflow-TS-Modellen (`img_audio_v1`, `img_two_clips_v1`), Store-Queue-Action (`queueSelectedWorkflowRun`) und registry-basiertem ComfyPanel fuer numerische/Asset-Parameter.
- 2026-02-21: Comfy-Main-Bridge umgesetzt: neue IPCs (`comfy:health`, `comfy:queue-run`), Workflow-Template-Aufloesung aus Projektordner (`workflows/*.api.json`), Placeholder-Substitution inkl. Asset-Pfad-Mapping sowie Polling-basierte Run-Events (`comfy:run-event`) bis in Store/UI.
- 2026-02-21: Comfy-Crash-Hotfix: Renderer-Startup gehaertet gegen Legacy-Preload (`onComfyRunEvent/getComfyHealth/queueComfyRun` ggf. nicht vorhanden); statt Runtime-Crash jetzt defensiver Fallback mit Hinweistext.
- 2026-02-21: Workflow-Template-UX erweitert: Upload im ComfyPanel ist verdrahtet (Datei-Dialog + Import), Main speichert gewaehltes API-JSON unter `workflows/<workflowId>.api.json` fuer den jeweils selektierten Workflow.
- 2026-02-21: Workflow-Import-Followup gefixt: Upload funktioniert auch ohne selektierten Workflow (ID-Prompt), neue/importierte Workflows werden in `project.workflowDefinitions` upserted und direkt gespeichert; `patch/remove` synchronisieren ebenfalls ins Projektmodell.
- 2026-02-22: Scene-Editor-Umbau vorbereitet (UI-Reset): `ComfyPanel` auf leere rechte Sidebar reduziert; Upload-Button und Workflow-Panel-Inhalte entfernt, damit der neue Workflow-Tab spaeter sauber neu aufgebaut werden kann.
- 2026-02-22: Workflow-Katalog-Vorbereitung dokumentiert: `ToDo.md` um Startkatalog erweitert und Dummy-Workflow-Meta-Vorlagen (Video/Image) unter `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/` angelegt.
- 2026-02-22: Workflow-Studio Phase B/C gestartet: Shared `*.meta.json`-Typen + Main-IPC `project:list-workflow-catalog` implementiert; `Lab`-Tab durch erstes Workflow-Studio-Layout mit Kategorien/Workflow-Liste/Meta-Vorschau ersetzt.
- 2026-02-22: Echte Workflow-Integration vorbereitet: User hat reale Comfy-API-Workflows projekt-lokal in `workflows/videos` und `workflows/images` abgelegt (Ordner `audio` aktuell leer) und `*.meta.json`-Dateien begonnen; Konvention `AssetId`-Keys in Meta + `AssetAbsPath`-Platzhalter in API-JSON abgestimmt/korrigiert.
- 2026-02-22: Reale Workflow-Meta-Konvention mit User an echten Dateien finalisiert/validiert: projekt-lokale Ordner auf `videos|images|audio` umbenannt, API-Dateien auf `.api.json` umgestellt, Meta-Beispiele fuer Video-Workflows (u. a. WAN V2V/Face2Video) geprueft und JSON-Syntaxfehler (trailing comma) bereinigt.
- 2026-02-22: Workflow-Studio Phase E begonnen/teilweise umgesetzt: rechte Konfigurationsseite editierbar gemacht (Settings + Asset-Selects aus `*.meta.json`) und `Send to ComfyUI` im Tab direkt an bestehende Comfy-Bridge verdrahtet; Audio-Inputs bleiben vorerst deaktiviert.
- 2026-02-22: Workflow-Studio Follow-up: Run-Statusanzeige im Tab erweitert (Recent Runs pro Workflow mit `pending/running/success/failed`, Progress und Output-Pfaden aus den bestehenden Comfy-Run-Events).
- 2026-02-22: Workflow-Studio Follow-up 2: `Import to Project` fuer Comfy-Outputs umgesetzt (neue IPC `project:import-comfy-output`, Import ueber Comfy `/view`, Asset-Integration ueber Store inkl. Persistenz/Thumbnail/Proxy).
