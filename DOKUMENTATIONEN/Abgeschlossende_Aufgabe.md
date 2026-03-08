# Abgeschlossende Aufgaben

## Hinweis zur Refactor-Dokumentation (ab 2026-02-22)

Refactor-/Modularisierungsarbeiten werden ab jetzt getrennt in `DOKUMENTATIONEN/Refactor_process.md` dokumentiert.

Diese Datei bleibt fuer abgeschlossene Features, Hotfixes und funktionale Erweiterungen.

## Aufgabe 37 - Preset Conflict Hardening (Workflow-Studio)

Der Preset-Konflikt-Flow wurde technisch und in der UX gehaertet, um bei extern/parallelen Dateiaenderungen deterministisch und ohne haengende UI-Zustaende zu reagieren.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - Konflikt-Handling von loser Message auf strukturierten `PresetConflictState` umgestellt
  - Konfliktbanner nur noch workflow-relevant angezeigt (kein alter/inkonsistenter Banner fuer unbeteiligte Workflows)
  - Resolve-UX erweitert:
    - `Lokale Aenderungen behalten`
    - `Datei neu laden`
  - Konflikt-Operationen mit Disable-States gehaertet (`isSavingPresets` / `isReloadingPresets`)
  - Persistenz-Haertung:
    - Guard gegen ungewollte Persist-Loops nach Reload/Hydration (`skipNextPresetPersistRef`)
    - Kein stilles Ueberschreiben lokaler Aenderungen bei Konflikt
  - State-Konsistenz:
    - Auswahl-/Name-Synchronisation fuer Presets nach Save/Reload/Delete
    - keine haengenden `selectedPresetId`/`presetName`-Kombinationen bei entfernten Presets

Wirkung:
- Konflikte sind klarer, reproduzierbar und sauber aufloesbar.
- Lokaler und Dateistand werden explizit getrennt behandelt.
- UI bleibt nach Save/Reload/Apply/Delete konsistent.

Verifiziert:
- `npm run lint` -> OK
- `npm run typecheck` -> OK
- `npm run build` -> OK
- `npm run validate:workflows` -> OK

## Aufgabe 36 - Autosave + Restore UX (Stabilitaetsblock)

Der naechste Stabilitaetsblock fuer Projektwiederherstellung wurde umgesetzt: Restore ist jetzt als klarer UI-Flow verfuegbar, mit Confirm vor Restore, sichtbarem Ergebnisstatus und gehaerteten Disable-States.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
  - `SettingsView` um `Restore Center` erweitert:
    - `Restore Last Session`
    - `Refresh Autosaves`
    - Autosave-Liste mit `Restore Autosave` pro Eintrag
  - klarer Safe-Restore-Flow:
    - Confirm-Dialog vor Last-Session- und Autosave-Restore
    - explizites Status-Feedback (`success/error/info`) mit Grundtext
  - UX-Haertung:
    - Disable-States waehrend Listen-/Restore-Operationen
    - bestaehender Header-Autosave-Dialog ebenfalls mit Confirm + Disable-Haertung
- Datei: `apps/desktop/src/renderer/src/core/store/slices/projectSlice.ts`
  - `restoreLastSession` liefert jetzt `boolean` fuer klare UI-Erfolg/Fehlschlag-Auswertung
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Store-Signatur angepasst: `restoreLastSession: () => Promise<boolean>`
- Doku:
  - `DOKUMENTATIONEN/2026-03-08-Autosave-Restore-UX.md` neu angelegt
  - `DOKUMENTATIONEN/Kontext-Aktuell.md` aktualisiert

Wirkung:
- Restore-Funktionen sind im UI klar auffindbar und direkt bedienbar.
- Restore startet nicht mehr ohne explizite Nutzerbestaetigung bei manuellen Aktionen.
- Fehler und Erfolgsfaelle sind fuer den User sichtbar und nachvollziehbar.

Verifiziert:
- `npm run lint` -> OK
- `npm run typecheck` -> OK
- `npm run build` -> OK
- `npm run validate:workflows` -> OK

## Aufgabe 35 - PR12 Supplement: Smoke-Check-Durchlauf dokumentiert

Der angefragte Smoke-Nachlauf zu PR12 wurde entlang `scripts/smoke.md` durchgefuehrt und dokumentiert.

Ausgefuehrt:
- `npm install` -> OK
- `npm run build --workspace @ai-filmstudio/shared` -> OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` -> OK
- `npm run build --workspace @ai-filmstudio/desktop` -> OK

Wichtiger Laufzeit-Hinweis:
- Im Agent-Environment war `ELECTRON_RUN_AS_NODE=1` gesetzt; dadurch startete Electron initial im Node-Modus und meldete einen irrefuehrenden Startfehler (`cjsPreparseModuleExports`).
- Der eigentliche Starttest wurde ohne diesen Env-Flag ausgefuehrt.

Status:
- Build-/Typecheck-/Lint-Guardrails bleiben gruen.
- Interaktive GUI-Smoke-Schritte sind durch den User-Retest final bestaetigt:
  - `New Project` OK
  - `Import Video` OK
  - `Preview` OK
  - `Proxy Toggle` OK
  - `WF Studio` OK
  - `Comfy Health` OK
  - keine Fehler gefunden, Verhalten weiterhin stabil.

## Aufgabe 34 - PR12 Stabilitaets-/Cleanup-Pass (IPC-Guard-Hardening + Comfy-Polling-Cleanup)

Der geplante kleine Stabilitaets-/Cleanup-Schritt nach PR11 wurde umgesetzt, ohne Feature-Logik zu erweitern.

Umgesetzt:
- Renderer-IPC-Adapter gehaertet:
  - Datei: `apps/desktop/src/renderer/src/core/adapters/ipcClient.ts`
  - alle `ProjectApiPort`-Methoden laufen jetzt ueber zentrale Runtime-Guards (`requireMethod`)
  - fehlende Preload-Methoden liefern konsistent `IpcUnavailableError` statt ungefangener Runtime-`TypeError`
- Letzte direkte `getProjectApi()`-Nutzung im Renderer entfernt:
  - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
  - Komponenten nutzen jetzt `getIpcClient()`
- Comfy-Polling-Lifecycle erweitert:
  - `apps/desktop/src/main/services/comfyService.ts`
  - neue Service-Methode `dispose()`
  - Polling mit `AbortController`/`AbortSignal` abbruchfaehig gemacht
  - aktive Polls werden pro `runId` verwaltet
- Main-Shutdown-Cleanup:
  - `apps/desktop/src/main/index.ts`
  - `app.on('before-quit', () => comfyService.dispose())`

Wirkung:
- Robustere IPC-Fehlerpfade im Renderer bei Legacy-/unsauberem Preload-Stand.
- Sauberer Comfy-Polling-Stop beim App-Beenden (weniger Leak-/Hanging-Risiko).

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run lint --workspace @ai-filmstudio/desktop` OK
- `npm run build --workspace @ai-filmstudio/desktop` OK
- Zusatzcheck: `rg -n "getProjectApi\\(" apps/desktop/src/renderer/src` -> nur noch Adapter-Treffer

## Aufgabe 33 - Comfy-Outputs aus WF-Studio `Recent Runs` direkt als Projekt-Assets importierbar

Der gewuenschte Follow-up aus Punkt 1 wurde umgesetzt: Ausgaben aus ComfyUI koennen jetzt direkt aus der `Recent Runs`-Liste im Workflow-Studio in die Projekt-Asset-Library uebernommen werden, ohne manuellen Datei-Dialog.

Umgesetzt:
- Main-Prozess (`apps/desktop/src/main/index.ts`)
  - Neue IPC: `project:import-comfy-output`
  - Importpfad holt die Datei ueber ComfyUI `GET /view?...&type=output`
  - Unterstuetzte Dateitypen (Image/Video) werden erkannt und wie normale Imports als Projekt-Assets gespeichert
  - Thumbnail/Video-Dauer werden wie beim Standard-Import erzeugt
- Preload/Renderer-API erweitert:
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - `apps/desktop/src/renderer/src/env.d.ts`
  - neue Methode: `importComfyOutput(outputPath)`
- Store erweitert:
  - Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - neue Action `importComfyOutputAsset(outputPath)`
  - integriert den Ruecklauf in Projekt/Assets + `project.json`-Save + Thumbnail + Video-Proxy-Flow
- Workflow-Studio UI erweitert:
  - Datei: `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - `Recent Runs`-Outputs zeigen jetzt pro Eintrag einen `Import`-Button
  - Button ist fuer nicht unterstuetzte Extensions deaktiviert
  - waehrend Import laeuft sichtbarer `Importing...`-State

Wirkung:
- Comfy-Ergebnisse koennen aus dem Workflow-Studio direkt in die Asset-Library uebernommen und sofort weiterverwendet werden.
- Kein manueller Umweg ueber Explorer + separaten Import-Dialog fuer typische Comfy-Outputs mehr.

Verifiziert:
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/workflows/WorkflowStudioView.tsx src/renderer/src/env.d.ts` (Workdir `apps/desktop`) OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- Hinweis: Main-ESLint fuer `apps/desktop/src/main/index.ts` bleibt in dieser Repo-Konfiguration weiterhin von bekannten `no-undef`-Node-Global-Themen betroffen.

## Aufgabe 32 - Workflow-Studio zeigt Run-Progress/Outputs direkt im Tab (Recent Runs)

Als Follow-up zum aktivierten `Send to ComfyUI` wurde der Workflow-Studio-Tab um eine eigene Run-Statusanzeige erweitert. Damit sind die Comfy-Run-Events nicht nur implizit im globalen Store vorhanden, sondern direkt am Workflow sichtbar.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
- WF-Studio liest jetzt `queuedWorkflowRuns` aus dem zentralen Store.
- Neue Sektion `Recent Runs` (pro aktuell ausgewaehltem Workflow):
  - zeigt letzte Runs der aktuellen `workflowId`
  - Status-Badge (`pending`, `running`, `success`, `failed`)
  - Progress-Bar + Prozentanzeige (wenn Progress vorhanden)
  - `promptId` + Erstellzeit
  - extrahierte Output-Pfade (gekürzt, erste Eintraege sichtbar)

Wirkung:
- `Send to ComfyUI` im Workflow-Studio hat jetzt direkt sichtbares Folge-Feedback bis zum Abschluss eines Runs.
- User muss fuer Queue-/Statuskontrolle nicht in ein separates Panel wechseln.

Verifiziert:
- `npx eslint src/renderer/src/features/workflows/WorkflowStudioView.tsx` (Workdir `apps/desktop`) OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK

## Aufgabe 31 - Workflow-Studio rechts editierbar + `Send to ComfyUI` verdrahtet

Der naechste Schritt im neuen Workflow-Studio wurde umgesetzt: Die rechte Seite ist nicht mehr nur Meta-Vorschau, sondern erlaubt jetzt das Setzen von Workflow-Settings und Asset-Inputs direkt aus dem Projekt. Der `Send to ComfyUI`-Button nutzt dabei die bereits vorhandene Main-Bridge (`comfy:queue-run`).

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
- Rechte Workflow-Seite erweitert von read-only auf editierbar:
  - numerische Basis-Settings (`width`, `height`, `fps`, `frames`, `steps`) als Eingabefelder
  - Asset-Selects pro `meta.inputs[]` (Image/Video) aus Projekt-Assets
  - Validierung fuer Pflicht-Inputs, numerische Werte und fehlende API-Template-Datei
- `Send to ComfyUI` aktiviert:
  - erzeugt generischen Workflow-Request aus Katalog-Meta + UI-Werten
  - sendet ueber `projectApi.queueComfyRun(...)` an die bestehende Comfy-Bridge
  - zeigt lokales UI-Feedback (queued/error inkl. `runId` / `promptId`)
- Audio-Inputs werden sichtbar erkannt, aber bewusst deaktiviert markiert (Audio-Asset-Support folgt spaeter)
- Kleiner Zusatz im WF-Studio-Header:
  - manueller Comfy-Health-Refresh mit Online/Offline-Indikator

Wirkung:
- Der Workflow-Studio-Tab kann jetzt reale projekt-lokale `*.meta.json`/`*.api.json` Workflows nicht nur anzeigen, sondern direkt parametrieren und an ComfyUI senden.
- Die bestehende Main-Bridge/Template-Placeholder-Substitution wird wiederverwendet, ohne neuen Upload-Flow oder separaten Sender im Renderer einzufuehren.
- Audio bleibt sauber abgegrenzt als Folgeaufgabe statt halb-funktional eingebaut.

Verifiziert:
- `npx eslint src/renderer/src/features/workflows/WorkflowStudioView.tsx` (Workdir `apps/desktop`) OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run typecheck --workspace @ai-filmstudio/shared` OK
- Hinweis: `apps/desktop/tsconfig.node.tsbuildinfo` wurde durch den Typecheck aktualisiert.

## Aufgabe 30 - Workflow-Meta-Konvention mit realen Projektdateien abgestimmt (Doku/Validierung)

Fokus war hier kein neuer Code, sondern die saubere Abstimmung des Workflow-Dateiformats gegen echte vom User exportierte Comfy-Workflows im Projektordner.

Abgestimmt und validiert:
- Projekt-lokale Ablage bestaetigt: `Projects\\<Projekt>\\workflows\\...` (neben `project.json`)
- Katalog-Ordnernamen fuer den aktuellen Loader muessen exakt sein:
  - `workflows\\videos\\`
  - `workflows\\images\\`
  - `workflows\\audio\\`
- API-Workflow-Dateien werden fuer den aktuellen Flow als `*.api.json` verwendet (Comfy-Exportdateien entsprechend umbenannt)
- Meta-Konvention finalisiert:
  - `inputs[].key` nutzt Asset-Rollen als `...AssetId`
  - `*.api.json` nutzt Platzhalter auf Basis der abgeleiteten Pfadvariablen (`{{...AssetAbsPath}}`)
- Node-ID-Verstaendnis mit User geklaert:
  - Zuordnung in Comfy passiert in der exportierten `*.api.json` ueber konkrete Node-IDs/Felder
  - Die Meta-Datei beschreibt nur die UI-Inputs und deren Rollen
- JSON-Validitaet an Beispiel-Meta geprueft und ein Syntaxproblem (trailing comma in `inputs[]`) korrigiert

Dokumentationsnutzen:
- Reduziert Fehlkonfigurationen bei neuen `*.meta.json` (falsche Ordnernamen, falsches Dateiende, falsche `key`-Benennung, invalides JSON)
- Schafft klare Basis fuer den naechsten Implementierungsschritt (editierbare Inputs + `Send to ComfyUI` im `WF Studio`)

Kontextdateien aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den realen Projektstand + Konventionen erweitert
- `DOKUMENTATIONEN/ToDo.md` um Setup-/Konventionshinweise fuer den laufenden Umbau erweitert

## Aufgabe 1 - Timeline Engine umsetzen

Kernaufgabe 1 ist umgesetzt: Timeline Engine v2 (track-basiert, immutable).

Geaendert:
- Neue Engine-Datei mit immutable Ops in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:1`
- Implementiert:
- `addClipToTrack` in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:66`
- `moveClip` in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:89`
- `removeClipFromTrack` in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:142`
- `trimClip` (ueber `offset`) in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:158`
- track-lokale Overlap-Erkennung in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:360`
- Overlap-Analyse `detectTrackOverlaps` in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:207`
- Typed Errors:
- `NotFoundError` in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:40`
- `OverlapError` in `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts:52`
- `ValidationError` wird genutzt (aus `core/model/errors.ts`)
- Export aktiviert in `apps/desktop/src/renderer/src/core/engine/index.ts:1`

Zusaetzlich korrigiert (fuer Domain-v2-Konsistenz + Typecheck):
- `apps/desktop/src/renderer/src/core/model/timeline.ts` von v1 (`clips[]`) auf v2 (`tracks[]`) angehoben (`createEmptyTimeline` in `apps/desktop/src/renderer/src/core/model/timeline.ts:28`)
- `createClip` jetzt mit `offset` in `apps/desktop/src/renderer/src/core/model/timeline.ts:43`

Kontextdatei aktualisiert:
- Aufgabenjournal in `DOKUMENTATIONEN/Kontext-Aktuell.md:41` ergaenzt, Kernaufgabe als abgeschlossen markiert.

Verifiziert:
- `npx tsc -p apps\desktop\tsconfig.web.json --noEmit` ✅
- `npx eslint src/renderer/src/core/engine/timelineEngine.ts src/renderer/src/core/model/timeline.ts src/renderer/src/core/engine/index.ts` (Workdir `apps/desktop`) ✅

## Aufgabe 2 - Engine in zentralen Store einhaengen und UI-Dummy-State ersetzen

Kernaufgabe 1 - Phase 2 ist umgesetzt: Die Timeline-Engine ist jetzt in einen zentralen Zustand-Store eingebunden, und die bisherigen lokalen Dummy-States wurden in den betroffenen UI-Bereichen durch Store-State ersetzt.

Geaendert:
- `zustand` als Dependency hinzugefuegt in `apps/desktop/package.json`.
- Neuer zentraler Store in `apps/desktop/src/renderer/src/core/store/studioStore.ts`.
- Store-Barrel angelegt in `apps/desktop/src/renderer/src/core/store/index.ts`.

Im Store eingebaut:
- Zentrale Bereiche: Projektstatus, Asset-Library-State, Timeline-State, Workflow-State, Preview-UI-State, UI-Undo/Redo-Zaehler.
- Engine-Anbindung ueber Actions:
- `timelineAddClip` (nutzt `addClipToTrack`)
- `timelineMoveClip` (nutzt `moveClip`)
- `timelineRemoveClip` (nutzt `removeClipFromTrack`)
- `timelineTrimClip` (nutzt `trimClip`)
- `dropAssetToTimeline` erzeugt beim Drop einen echten Clip und schreibt ihn immutable in den Timeline-State.

UI von lokalem Dummy-State auf Store umgestellt:
- `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
- Undo/Redo-Zaehler + Aktionen aus Store statt lokalem `useState`
- `projectName` und `comfyOnline` aus Store
- `apps/desktop/src/renderer/src/features/assets/AssetLibraryView.tsx`
- Filter/Query/Asset-Liste aus Store statt `DUMMY_ASSETS` + lokalem State
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Tracks aus Store-Timeline statt statischem `TRACKS`
- Drop-Handling ueber Store-Action `dropAssetToTimeline` (Engine-Integration aktiv)
- `apps/desktop/src/renderer/src/features/comfy/ComfyPanel.tsx`
- Workflows + Auswahl + Update/Remove aus Store statt lokalem `useState`
- `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
- `proxyMode` / `annotating` aus Store statt lokalem `useState`

Zusaetzliche technische Anpassungen:
- `AppShell` nutzt fuer Key-Events `globalThis.addEventListener/removeEventListener` (statt `window`) fuer sauberen Lint-Lauf.
- Lokale ESLint-Header fuer `no-unused-vars` in Dateien mit TS-Typ-Signaturen gesetzt, da die aktive ESLint-Basisregel dort Funktionsparameter in Typen als ungenutzt meldet.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Abschluss dieser Aufgabe erweitert (Aufgabenjournal + Stand aktualisiert).

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` ✅
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/core/store/index.ts src/renderer/src/ui/layout/AppShell.tsx src/renderer/src/features/assets/AssetLibraryView.tsx src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/features/comfy/ComfyPanel.tsx src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) ✅

## Aufgabe 3 - Command Pattern + echtes Undo/Redo ueber Timeline-Operationen

Kernaufgabe 1 - Phase 3 ist umgesetzt: In `core/commands` wurde ein echtes Command-System fuer Timeline-Operationen eingefuehrt und in den zentralen Store integriert, sodass Undo/Redo nicht mehr nur UI-Zaehler sind, sondern reale Timeline-Operationen rueckgaengig machen bzw. wiederherstellen.

Geaendert:
- Neues Command-Modul in `apps/desktop/src/renderer/src/core/commands/timelineCommands.ts`.
- Export im Command-Barrel aktiviert in `apps/desktop/src/renderer/src/core/commands/index.ts`.

In `core/commands` eingebaut:
- `TimelineCommand` + `TimelineCommandHistory` als Basisabstraktionen.
- History-Flow:
- `executeTimelineCommand(...)`
- `undoTimelineCommand(...)`
- `redoTimelineCommand(...)`
- Command-Factorys fuer Engine-Operationen:
- `createAddClipCommand(...)`
- `createMoveClipCommand(...)`
- `createRemoveClipCommand(...)`
- `createTrimClipCommand(...)`

Store-Integration (echtes Undo/Redo):
- `apps/desktop/src/renderer/src/core/store/studioStore.ts` verwendet jetzt `timelineCommandHistory` statt reinem Dummy-Counter-Ansatz.
- Timeline-Aktionen dispatchen Commands und schreiben `past`/`future` ueber den zentralen History-Mechanismus.
- `undoUi` und `redoUi` fuehren jetzt echte `undoTimelineCommand`/`redoTimelineCommand` auf der Timeline aus.
- `pastCount`/`futureCount` werden aus dem Command-History-Stand synchronisiert.

UI-Anpassung fuer Sichtbarkeit:
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx` zeigt jetzt `Clips in Timeline` (echter Timeline-Zustand), damit Undo/Redo-Effekte direkt sichtbar sind.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` erweitert: Phase 3 als abgeschlossen dokumentiert, offene Kernaufgaben angepasst.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` ✅
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npx eslint src/renderer/src/core/commands/timelineCommands.ts src/renderer/src/core/commands/index.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/ui/layout/AppShell.tsx` (Workdir `apps/desktop`) ✅

## Aufgabe 4 - UI auf echte Projektdaten + visuelle Timeline (Schritt 1 und 2)

Die naechsten zwei Schritte wurden umgesetzt:
1) UI von Dummy-Daten auf echte Projektdaten umgestellt.
2) Timeline visuell gerendert (Clips pro Track sichtbar, Selektion vorhanden) und mit Command-Aktionen verbunden.

Geaendert:
- Projektadapter erweitert in `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`:
- `getProjectRoot()`
- `getAssetThumbnailDataUrl(relativePath)`

Store massiv erweitert in `apps/desktop/src/renderer/src/core/store/studioStore.ts`:
- Projekt-Status und Projektobjekt im Store (`project`, `projectRoot`, `projectMessage`, `isProjectBusy`, `lastError`).
- Echte Projektaktionen:
- `newProject()`
- `loadProject()`
- `saveProject()`
- `importVideoAsset()` / `importImageAsset()`
- Asset-Thumbnail-Hydration via `getAssetThumbnailDataUrl`.
- Timeline/Project-Sync: Timeline-Command-Ergebnisse aktualisieren jetzt auch `project.timeline` im Store.
- Clip-Selektion und Edit-Aktionen:
- `selectClip(...)`
- `nudgeSelectedClip(...)`
- `trimSelectedClip(...)`
- `removeSelectedClip()`

UI-Anpassungen fuer echte Projektdaten:
- `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
- Header-Aktionen fuer `New/Load/Save` eingebaut.
- Projektstatus/Fehleranzeige aus Store eingebunden.
- `apps/desktop/src/renderer/src/features/assets/AssetLibraryView.tsx`
- Asset-Liste auf echte `project.assets` umgestellt.
- Import-Buttons fuer Video/Bild an Store-Aktionen angebunden.
- Thumbnail-Anzeige ueber Data-URL aus Main-Prozess.

Visuelle Timeline (Schritt 2):
- `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Horizontale Zeitskala + Track-Rows + Clip-Blocks mit Position/Breite aus `start/duration`.
- Klick-Selektion von Clips.
- Basis-Edit-Toolbar (nudge left/right, trim in/out, remove, clear selection).
- Aktionen dispatchen command-basiert ueber den Store.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` fortgeschrieben (aktueller Stand + Aufgabenjournal).

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` ✅
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npx eslint src/renderer/src/core/adapters/projectApi.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/assets/AssetLibraryView.tsx src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/ui/layout/AppShell.tsx` (Workdir `apps/desktop`) ✅

## Aufgabe 5 - Punkt 3 und 4 finalisiert (Direkte Edit-Aktionen + Persistenz-Bridge)

Die vom User priorisierten Restpunkte sind abgeschlossen:
- Punkt 3: Erste echte Edit-Aktionen im UI (`move`, `trim`, `remove`) direkt per Command-Dispatch.
- Punkt 4: Persistenz-Bridge finalisiert, sodass Timeline aus `project.json` geladen/gespeichert wird und Undo/Redo auf realen Projektdaten arbeitet.

Was konkret umgesetzt wurde:

Direkte UI-Editing-Aktionen (Punkt 3)
- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Clip-Body Drag implementiert -> `move` via `timelineMoveClip(...)`.
- Linke/rechte Clip-Edge-Handles implementiert -> `trim` via `timelineTrimClip(...)`.
- Entfernen direkt aus Timeline-Toolbar und per `Delete`/`Backspace` -> `remove` via `removeSelectedClip()`.
- Keyboard-Support fuer selektierten Clip:
- `ArrowLeft/ArrowRight` -> Nudge Move
- `Delete/Backspace` -> Remove
- Visuelles Preview waehrend Drag/Trim vor Command-Commit eingebaut.

Persistenz-Bridge (Punkt 4)
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `project` und `timeline` werden bei Command-Ausfuehrung synchron gehalten (`toTimelineHistoryState`).
- `loadProject()` setzt Timeline aus geladener `project.json` in den Store.
- `saveProject()` schreibt den aktuellen Projektstand (inkl. Timeline) ueber Main-IPC zurueck.
- `isDirty`-Flag eingefuehrt:
- wird bei Timeline-Aenderungen gesetzt
- wird nach erfolgreichem Save zurueckgesetzt
- Datei: `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
- `Ctrl+S` eingebaut fuer direktes Speichern.
- Save-Button zeigt passenden Zustand (disabled ohne Projekt / waehrend Busy).
- Projektname zeigt Dirty-Marker (`*`) bei ungespeicherten Aenderungen.

Ergaenzende Glue-Verbesserungen
- Datei: `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- Adapter fuer `getProjectRoot()` und `getAssetThumbnailDataUrl(...)` erweitert.
- Datei: `apps/desktop/src/renderer/src/features/assets/AssetLibraryView.tsx`
- Import-Buttons deaktiviert, wenn kein Projekt geladen ist.

Kontextdatei aktualisiert
- `DOKUMENTATIONEN/Kontext-Aktuell.md` wurde fortgeschrieben und um den Abschluss von Punkt 3+4 ergaenzt.

Verifiziert
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` ✅
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npx eslint src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/core/store/studioStore.ts src/renderer/src/ui/layout/AppShell.tsx src/renderer/src/features/assets/AssetLibraryView.tsx src/renderer/src/core/adapters/projectApi.ts` (Workdir `apps/desktop`) ✅

## Aufgabe 6 - Playback integriert (Play/Pause + Zeitlauf + Playhead)

Auf Wunsch wurde ein Abspiel-Button integriert und der Transport durchgaengig verdrahtet.

Umsetzung:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
- Play/Pause-Button eingebaut.
- Back-to-start Button eingebaut.
- Laufende Zeitdarstellung (`currentTime`) und Gesamtdauer (`timelineEnd`) integriert.
- Scrubber (`range`) zum manuellen Seeken eingebaut.
- Playback-Takt via `requestAnimationFrame` (ruft `stepPlayback(deltaSeconds)` auf).

- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Transport-State hinzugefuegt:
- `isPlaying`
- `currentTime`
- Transport-Aktionen hinzugefuegt:
- `togglePlayback()`
- `setCurrentTime(seconds)`
- `stepPlayback(deltaSeconds)`
- `stopPlayback()`
- Zeit wird auf Timeline-Dauer geklemmt (`clampTime`).
- Playback stoppt automatisch am Timeline-Ende.

- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Vertikalen Playhead basierend auf `currentTime` eingebaut.
- Klick auf die Zeitleiste setzt den Playhead (`setCurrentTime`).

Ergebnis fuer den Test-Flow:
- Projekt laden/erstellen -> Clip in Timeline -> Play druecken -> Zeit laeuft sichtbar, Playhead bewegt sich.
- Seeken ueber Preview-Scrubber oder Klick in Timeline-Ruler.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Playback-Abschluss erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` ✅
- `npm run typecheck --workspace @ai-filmstudio/desktop` ✅
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx src/renderer/src/features/timeline/TimelineDock.tsx src/renderer/src/core/store/studioStore.ts` (Workdir `apps/desktop`) ✅

## Aufgabe 7 - Echten Medien-Preview verdrahtet (Video/Bild im Monitor)

Der schwarze Monitor war nachvollziehbar: Der Preview hatte zwar Transport (Play/Pause/Zeit), aber keine echte Medienquelle. Diese Aufgabe wurde abgeschlossen, indem die Asset-Datei aus dem Projektpfad bis in den Renderer durchgereicht und der aktive Timeline-Clip im Monitor gerendert wird.

Geaendert:
- Main-IPC fuer Asset-Datei-URL hinzugefuegt in `apps/desktop/src/main/index.ts`.
- Neuer Handler `project:asset-file-url` liefert eine `file://`-URL auf lesbare Projektdateien (via `pathToFileURL`).
- Preload-Bridge erweitert in `apps/desktop/src/preload/index.ts` um `getAssetFileUrl(relativePath)`.
- Renderer-Adapter erweitert in `apps/desktop/src/renderer/src/core/adapters/projectApi.ts` um `getAssetFileUrl(relativePath)`.
- Globales Window-Typing erweitert in `apps/desktop/src/renderer/src/env.d.ts`.

Preview-Implementierung:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`.
- Aktiven Clip anhand `currentTime` aufgeloest (`resolveActiveClip`), track-basiert priorisiert.
- Aktives Asset ueber Store-Assets aufgeloest.
- Asset-URL lazy geladen und pro `assetId` gecached.
- Monitor rendert jetzt:
- `video` bei Video-Assets (inkl. Seek/Sync mit Timeline-Zeit)
- `img` bei Bild-Assets
- Fallback-Zustaende fuer "No media", "Missing asset", "Loading asset".
- Video wird auf Timeline-Zeit synchronisiert (`clip.offset + (currentTime - clip.start)`), Play/Pause folgt Transportzustand.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Abschluss dieser Aufgabe erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/env.d.ts src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 8 - Preview-Quelle gehaertet (Loading-Haenger Fix)

Nach Rueckmeldung ("Dateiname wechselt korrekt, Monitor bleibt schwarz / Loading") wurde der Playback-Quellenpfad im Preview robuster gemacht.

Ursachebild:
- Aktiver Clip/Asset wurde bereits korrekt aufgeloest (deshalb wechselnder Dateiname sichtbar).
- Die eigentliche Asset-URL konnte in manchen Laufzeit-Konstellationen nicht zuverlaessig aufgeloest werden, wodurch der Monitor auf "Loading Asset" stehen blieb.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`.
- Laden der Playback-URL auf robusten Resolver umgestellt:
- zuerst `projectApi.getAssetFileUrl(relativePath)` (IPC-Bridge)
- falls leer/fehlerhaft: Fallback ueber `projectApi.getProjectRoot()` + zusammengesetzte `file://`-URL aus `projectRoot + asset.filePath`
- Unterscheidung von Status-Zustaenden:
- pending (URL noch nicht aufgeloest) -> "Loading Asset"
- failed (URL aufgeloest aber nicht verfuegbar) -> "Asset Unavailable"
- Endlos-Loading im Fehlerfall wird dadurch vermieden.
- Vorhandene Video-Synchronisierung (Clip-Offset + Timeline-Zeit) bleibt unveraendert aktiv.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Zusatzfix erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 9 - Preview-Mediaquelle via IPC-Data-URL erweitert

Nach weiterem Testbild war klar: Clip-Aktivierung funktioniert, aber die Medienquelle wurde weiterhin nicht sichtbar decodiert. Daher wurde die Quelle auf eine robustere IPC-Variante erweitert.

Umgesetzt:
- Datei: `apps/desktop/src/main/index.ts`
- Neuer Handler `project:asset-media-data-url` liefert fuer Asset-Dateien eine `data:`-URL mit MIME-Typ-Mapping.
- Unterstuetzte Typ-Mappings fuer Bild/Video-Erweiterungen (`png/jpg/webp/gif/bmp/mp4/webm/mov/m4v/mkv/avi`).
- Datei: `apps/desktop/src/preload/index.ts`
- Bridge erweitert um `getAssetMediaDataUrl(relativePath)`.
- Datei: `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- Port erweitert um `getAssetMediaDataUrl(relativePath)`.
- Datei: `apps/desktop/src/renderer/src/env.d.ts`
- Window-API-Typing um `getAssetMediaDataUrl(relativePath)` erweitert.
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
- Source-Resolver nutzt jetzt Reihenfolge:
- 1) `getAssetMediaDataUrl(...)` (primaer)
- 2) `getAssetFileUrl(...)`
- 3) berechnete `file://` aus `projectRoot + asset.filePath`

Zielwirkung:
- Renderer kann Medien auch dann anzeigen, wenn direkte lokale `file://`-Pfadauflosung in der Laufzeitumgebung blockiert/instabil ist.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um diesen Zusatzfix erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/env.d.ts src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 10 - Media-Fehlerdiagnostik im Preview

Um das verbleibende Schwarzbild klar zu diagnostizieren, wurde die Preview um sichtbares Media-Error-Handling erweitert.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`.
- Neuer `mediaError`-State.
- `img`:
- `onLoad` setzt Fehler zurueck.
- `onError` zeigt klare Ladefehlermeldung.
- `video`:
- `onLoadedData` setzt Fehler zurueck.
- `onError` mappt `MediaError.code` auf diagnostische Meldungen:
- aborted
- network/file error
- decode error (Codec/Datei)
- source not supported
- Unbekannter Fehler
- Fehler wird als Overlay im Monitor angezeigt statt stilles Schwarzbild.

Nutzen:
- Wir sehen sofort, ob Quelle vorhanden ist aber Decoder/Format scheitert.
- Naechster technischer Schritt (z. B. Proxy-Transcode auf browserfreundlichen Codec) kann damit zielgerichtet umgesetzt werden.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um diesen Diagnostik-Schritt erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 11 - FFmpeg Health + Proxy-Pipeline integriert

Auf Basis der lokalen Systeminfos wurde die App nun gezielt auf lokale FFmpeg-Nutzung erweitert.

Umgesetzt:
- Datei: `apps/desktop/src/main/index.ts`
- Neuer IPC `project:ffmpeg-health` (Runtime-Check via `ffmpeg -version`).
- Neuer IPC `project:ensure-video-proxy` (FFmpeg-Transcode in `cache/proxies`).
- Projektstruktur erweitert um `cache/proxies`.
- Proxy-Dateiname deterministisch per Hash aus Quellpfad.
- Regeneration nur, wenn Quelle neuer als Proxy ist.
- Datei: `apps/desktop/src/preload/index.ts`
- Neue Bridge-Methoden:
- `getFfmpegHealth()`
- `ensureVideoProxy(relativeVideoPath)`
- Datei: `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
- Port um `FfmpegHealthResponse`, `ProxyResponse`, `getFfmpegHealth`, `ensureVideoProxy` erweitert.
- Datei: `apps/desktop/src/renderer/src/env.d.ts`
- Window-API-Typing fuer neue FFmpeg/Proxy-Methoden erweitert.
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Neuer Zustand:
- `ffmpegStatus`
- `proxyPathByAssetId`
- `proxyPendingByAssetId`
- Neue Actions:
- `checkFfmpegHealth()`
- `ensureVideoProxy(assetId)`
- Bei Projekt-Load/New und Video-Import werden bekannte Proxy-Pfade vorbereitet.
- Datei: `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
- App startet mit FFmpeg-Healthcheck.
- Header zeigt FFmpeg-Statusbadge (`check/ready/offline`).
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
- Preview waehlt bei aktivem Proxy-Mode bevorzugt Proxy-Quelle (wenn verfuegbar).
- Proxy wird bei Bedarf asynchron angefordert.
- Source-Cache auf Quellpfad-Keying umgestellt, damit Original/Proxy sauber umschaltbar sind.

Wirkung:
- Playback-Quelle ist robuster und bei schweren Files performanter.
- Proxy-Mode hat jetzt echte technische Funktion statt nur UI-Flag.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` erweitert (System-Capabilities + Ausbaujournal).

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/env.d.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/ui/layout/AppShell.tsx src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 12 - Playback-Abbruch nach 1-2 Sekunden gefixt

Nach Test-Rueckmeldung trat ein Abbruch nach kurzer Abspieldauer auf: Clip startete, dann Standbild + Error.

Wahrscheinliche Ursache:
- Source wechselte waehrend laufendem Clip dynamisch (Original -> Proxy), sobald Proxy spaeter verfuegbar wurde.
- Zusaetzlich war fuer Video die Source-Prioritaet nicht optimal (haeufig `data:` zuerst), was instabil sein kann.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`.
- Neuer Source-Lock pro aktivem Clip:
- `lockedClipId`
- `lockedSourceRelativePath`
- Verhalten:
- Beim Clip-Wechsel wird Source einmal gesetzt.
- Waehrend `isPlaying === true` bleibt die Quelle stabil.
- Source-Update (z. B. auf Proxy) erst im Stop/Pause-Zustand.
- Resolver-Reihenfolge fuer Video geaendert:
- zuerst `getAssetFileUrl(...)`
- danach `getAssetMediaDataUrl(...)`
- danach lokaler `file://`-Fallback aus `projectRoot + relativePath`
- Fuer Bilder bleibt `data:` zuerst sinnvoll, `file://` bleibt Fallback.

Ergebnis:
- Kein erzwungener Quellwechsel mitten im Playback.
- Weniger Risiko fuer Decoder-Resets/Abbrueche bei laengerer Wiedergabe.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Hotfix erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 13 - Dev-Origin `file://` Blockade behoben

Aus DevTools-Console:
- `Not allowed to load local resource: file:///...`

Damit war die eigentliche Ursache eindeutig: Im Dev-Betrieb (`http://localhost`) blockiert Chromium lokale `file://`-Ressourcen im Renderer.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`.
- `resolveAssetFileUrl(...)` erweitert:
- erkennt Renderer-Origin (`http:` / `https:`)
- in diesem Modus wird **kein** `file://` mehr verwendet
- stattdessen nur `getAssetMediaDataUrl(...)` (IPC-data source)
- `file://`-Pfade bleiben nur fuer packaged/file-Renderer als Fallback aktiv.

Wirkung:
- Der Dev-Fehler `Not allowed to load local resource` wird umgangen.
- Playback-Quelle ist kompatibel mit dem lokalen Dev-Server-Setup.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Dev-Origin-Fix erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 14 - CSP gesetzt + Dev-Mediazugriff stabilisiert

Nach erneuter Rueckmeldung war weiter nur noch eine CSP-Warnung sichtbar und Playback blieb instabil.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/index.html`
- CSP-Meta-Tag hinzugefuegt (default/script/style/media/connect etc.), um die fehlende CSP im Renderer zu adressieren.
- Datei: `apps/desktop/src/main/index.ts`
- BrowserWindow in Dev (`ELECTRON_RENDERER_URL` gesetzt) auf `webSecurity: false` gestellt, damit lokaler `file://`-Medienzugriff fuer den lokalen Editor-Workflow nicht geblockt wird.
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`
- Dev-only Zwang auf `data:` entfernt.
- Resolver nutzt wieder priorisiert `file://` fuer Video, `data:` bleibt Fallback.

Wirkung:
- `Not allowed to load local resource` wird im lokalen Dev-Flow umgangen.
- Videoquellen bleiben fuer laengeres Playback stabiler als reine `data:`-URLs.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` fortgeschrieben.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 15 - Proxy-Mode Fehlerfall mit Auto-Fallback abgefangen

Rueckmeldung: Mit aktiviertem Proxy-Mode trat weiterhin der Playback-Fehler auf, ohne Proxy lief alles normal.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/preview/PreviewStage.tsx`.
- Neuer asset-lokaler Bypass-Status:
- `proxyBypassByAssetId`
- Verhalten:
- Wenn die aktive Proxy-Quelle fuer ein Video einen Fehler wirft (`video onError`),
- dann wird **nur fuer dieses Asset** automatisch auf die Originalquelle zurueckgeschaltet.
- Proxy-Mode bleibt global aktiv; andere Assets bleiben unveraendert.
- Source-Lock bleibt erhalten, damit waehrend Playback kein instabiles Umschalten passiert.
- Fehlermeldung im Monitor wird konkret als Proxy-Fallback angezeigt.

Nutzen:
- Proxy-Probleme brechen das gesamte Playback nicht mehr.
- User muss Proxy-Mode nicht manuell ausschalten, um weiterzuschneiden.

Kontextdatei aktualisiert:
- `DOKUMENTATIONEN/Kontext-Aktuell.md` um den Proxy-Fallback-Fix erweitert.

Verifiziert:
- `npx tsc -p apps\\desktop\\tsconfig.web.json --noEmit` OK
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/preview/PreviewStage.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 16 - Punkt 1 begonnen: Timeline Snapping (Move/Trim)

Punkt 1 der offenen NLE-Operationen wurde umgesetzt: Snapping beim direkten Timeline-Editing.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`.
- Snapping-Schwelle: 10px (bei 40px/s = 0.25s).
- Move-Drag snappt auf relevante Clip-Kanten im selben Track (`start`/`end`) sowie auf Zeit `0`.
- Trim-Start snappt auf Kantenpunkte innerhalb gueltiger Start-Grenzen.
- Trim-End snappt auf Kantenpunkte innerhalb gueltiger End-Grenzen.
- Preview und Commit verwenden dieselbe Snap-Logik, damit visuelles Verhalten und gespeicherte Operation konsistent sind.

Wirkung:
- Clip-Positionen und Trim-Kanten rasten jetzt in der Timeline beim Naehern an andere Clip-Grenzen ein.
- Grundlage fuer die naechsten Punkte in diesem Block (Cut, Ripple) ist damit gelegt.

## Aufgabe 17 - Punkt 1 erweitert: Cut am Playhead (command-basiert)

Punkt 1 wurde um den naechsten NLE-Baustein erweitert: Ein selektierter Clip kann jetzt direkt an der Playhead-Zeit geschnitten werden.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts`
- Neue Engine-Operation `cutClip(...)` inkl. `CutClipParams`.
- Split-Validierung: `cutTime` muss strikt innerhalb der Clip-Grenzen liegen.
- Erzeugt zwei neue Clips mit korrekter `offset`-Fortschreibung fuer den rechten Split-Teil.
- Datei: `apps/desktop/src/renderer/src/core/commands/timelineCommands.ts`
- Neuer Command-Typ `timeline/cut-clip`.
- Neue Command-Factory `createCutClipCommand(...)` mit Undo/Redo-Flow (Split rueckgaengig machbar).
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Neue Store-Actions:
- `timelineCutClip(...)`
- `cutSelectedClipAtCurrentTime()`
- Nach erfolgreichem Cut wird der rechte Split-Clip selektiert.
- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Neuer Toolbar-Button `Cut at Playhead`.
- Neuer Shortcut `Ctrl+B` fuer Cut am Playhead.
- Cut ist nur aktiv, wenn die Playhead-Zeit innerhalb des selektierten Clips liegt.

Wirkung:
- Cut laeuft voll command-basiert und ist damit undo/redo-faehig.
- Snapping + Cut sind jetzt als echte Editing-Operationen vorhanden; Ripple ist der naechste offene Teil in diesem Block.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/engine/timelineEngine.ts src/renderer/src/core/commands/timelineCommands.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/timeline/TimelineDock.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 18 - Timeline-Drop nutzt echte Videodauer statt fix 5 Sekunden

Die Drop-Logik wurde so erweitert, dass Video-Clips beim Ablegen in die Timeline ihre reale Dauer nutzen (z. B. 11s), wenn diese beim Import verfuegbar ist.

Umgesetzt:
- Datei: `packages/shared/src/types.ts`
- Asset-Modell um optionales Feld `durationSeconds?: number` erweitert.
- Datei: `packages/shared/project.schema.json`
- Schema fuer Assets um optionales numerisches Feld `durationSeconds` (`exclusiveMinimum: 0`) erweitert.
- Datei: `apps/desktop/src/main/index.ts`
- Neuer Probe-Schritt `probeVideoDurationSeconds(...)` via `ffprobe`.
- Beim Video-Import wird `durationSeconds` ermittelt und ins Asset geschrieben (falls erfolgreich).
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Drop-Logik nutzt jetzt `resolveInitialClipDuration(asset)`.
- Fuer Video gilt: erst `asset.durationSeconds`, fallback weiter auf 5s.
- Fuer Bilder bleibt der Default 3s.

Wirkung:
- Neu importierte Video-Assets landen mit realer Dauer in der Timeline statt fixer 5 Sekunden.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts` (Workdir `apps/desktop`) OK
- Hinweis: Ein direkter ESLint-Lauf auf `apps/desktop/src/main/index.ts` meldet in dieser Repo-Konfiguration bestehende `no-undef`-Global-Fehler (`process`, `__dirname`, `NodeJS`), die nicht durch diese Aufgabe eingefuehrt wurden.

## Aufgabe 19 - Ripple Delete mit Lueckenschluss integriert

Der naechste NLE-Baustein ist umgesetzt: Beim Ripple Delete wird der selektierte Clip entfernt und alle nachfolgenden Clips im selben Track ruecken um die entfernte Dauer nach links.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts`
- Neue Engine-Operation `rippleRemoveClip(...)` + `RippleRemoveClipParams`.
- Verhalten: nur Clips nach dem entfernten Clip-Ende werden verschoben (`start -= removedDuration`), danach sortiert.
- Datei: `apps/desktop/src/renderer/src/core/commands/timelineCommands.ts`
- Neuer Command-Typ `timeline/ripple-remove-clip`.
- Neue Factory `createRippleRemoveClipCommand(...)` mit stabilem Undo/Redo ueber Timeline-Snapshots.
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Neue Store-Actions:
- `timelineRippleRemoveClip(...)`
- `rippleRemoveSelectedClip()`
- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Keyboard: `Shift+Delete` fuehrt Ripple Delete auf selektiertem Clip aus.
- Toolbar: eigener Ripple-Delete-Button (`Trash`) mit Titel `Ripple Delete (Shift+Delete)`.

Wirkung:
- Loeschen mit Ripple schliesst Luecken im Track automatisch.
- Undo/Redo bleibt voll funktionsfaehig.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/engine/timelineEngine.ts src/renderer/src/core/commands/timelineCommands.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/timeline/TimelineDock.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 20 - Slip Editing (Offset bei fester Clip-Position) integriert

Slip wurde als naechste Editing-Operation umgesetzt: Der Clip bleibt an derselben Timeline-Position, aber der Medieninhalt wird ueber `offset` verschoben.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/engine/timelineEngine.ts`
- Neuer Typ `SlipClipParams` und neue Engine-Operation `slipClip(...)` (setzt absoluten `offset` bei unveraenderter `start`/`duration`).
- Datei: `apps/desktop/src/renderer/src/core/commands/timelineCommands.ts`
- Neuer Command-Typ `timeline/slip-clip`.
- Neue Factory `createSlipClipCommand(...)` mit Undo auf den urspruenglichen Offset.
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Neue Store-Actions:
- `timelineSlipClip(...)`
- `slipSelectedClip(deltaSeconds)`
- Bei bekannten Video-Metadaten wird Slip auf gueltigen Bereich geklemmt (`0 .. durationSeconds - clip.duration`), sonst nur auf `>= 0`.
- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Keyboard: `Alt+ArrowLeft` / `Alt+ArrowRight` fuer Slip.
- Toolbar: zwei Slip-Buttons (`Slip Backward`, `Slip Forward`).

Wirkung:
- NLE-Basis fuer Snapping/Cut/Ripple/Slip ist jetzt durchgaengig command-basiert und undo/redo-faehig.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/engine/timelineEngine.ts src/renderer/src/core/commands/timelineCommands.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/timeline/TimelineDock.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 21 - Slip no-op Fall gehaertet (Feedback + Shortcut-Fallback)

Rueckmeldung aus App-Test: Slip wirkte wie "tut nichts". Der Kernfall war ein vollstaendiger Quell-Clip ohne verbleibenden Slip-Spielraum (`durationSeconds === clip.duration`).

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `slipSelectedClip(...)` liefert jetzt eine klare Fehlermeldung, wenn kein Slip-Spielraum vorhanden ist:
- `Slip not possible: clip already uses full source duration. Trim or cut the clip first.`
- Datei: `apps/desktop/src/renderer/src/features/timeline/TimelineDock.tsx`
- Slip-Buttons werden deaktiviert, wenn kein Slip-Spielraum vorhanden ist.
- Zusatztastenkombination als Fallback:
- `Ctrl+[` = Slip backward
- `Ctrl+]` = Slip forward
- Offset wird im Clip-Label sichtbar angezeigt (`off x.xx s`), damit Slip-Aenderungen direkt erkennbar sind.

Wirkung:
- Slip verhält sich jetzt nachvollziehbar: kein stilles No-op mehr.
- Bedienung robuster auf Windows, falls `Alt+Arrow` durch System/Menu abgefangen wird.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/features/timeline/TimelineDock.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 22 - Comfy Workflow-Contracts (pro Workflow eigenes TS-Modell) + erweiterbare Panel-Registry

Ziel war ein sauberer Start fuer deine vordefinierten Workflows mit unterschiedlichen Inputs. Das ist jetzt als erweiterbare Registry umgesetzt.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/comfy/workflowContracts.ts`
- Neue diskriminierte TS-Modelle (`ComfyWorkflowRunRequest`) pro Workflow:
- `img_audio_v1` (Bild + Audio)
- `img_two_clips_v1` (Bild + 2 Clips)
- Zentrale Workflow-Registry (`WORKFLOW_CONTRACTS`) mit Felddefinitionen (`number` / `asset`) und `toRequest`-Builder pro Workflow.
- Neue Helpers fuer Defaults und Contract-Lookup:
- `getWorkflowContractById(...)`
- `createDefaultWorkflowParameters(...)`

- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Workflow-Parameter von starrem `WorkflowConfig` auf dynamisches `WorkflowParameterMap` umgestellt.
- Neue Queue-Struktur:
- `queuedWorkflowRuns`
- Neuer Action-Flow:
- `queueSelectedWorkflowRun()` baut aus dem ausgewaehlten Workflow einen typisierten Request und legt ihn als lokalen pending-Run in die Queue.
- `toProjectState(...)` nutzt jetzt Contract-Defaults; ohne Projekt-Workflow-Definitionen werden zwei Start-Workflows (`img_audio_v1`, `img_two_clips_v1`) bereitgestellt.

- Datei: `apps/desktop/src/renderer/src/features/comfy/ComfyPanel.tsx`
- Panel rendert Felder jetzt registry-basiert statt hardcoded Prompt-Form.
- Numerische Felder und Asset-Referenzen werden dynamisch pro Workflow angezeigt.
- Queue-Button nutzt `queueSelectedWorkflowRun()`.
- Queue-Counter im Header zeigt pending Runs.
- Erweiterbarkeit: Neue Workflows/Felder kommen zentral ueber `workflowContracts.ts` hinzu.

Wirkung:
- Unterschiedliche Workflows koennen jetzt unterschiedliche, typsichere Input-Sets haben.
- Neue Workflows sind deutlich einfacher erweiterbar (ein zentraler Contract + Feldliste).
- Grundstein fuer naechsten Schritt (echte Main/Comfy-IPC Queue) ist gelegt.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/comfy/workflowContracts.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/comfy/ComfyPanel.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 23 - ComfyUI Main-Bridge (Health, Queue, Run-Events) end-to-end integriert

Die lokale Stub-Queue wurde auf eine echte ComfyUI-Bridge umgestellt: Workflow-Requests gehen jetzt aus der App in den Main-Prozess, werden mit Projektdaten/Templates aufgeloest, an Comfy gesendet und als Status-Events zurueck in die UI gespiegelt.

Umgesetzt:
- Shared Typvertrag eingefuehrt:
  - Datei: `packages/shared/src/comfy.ts` (Run-Request-Union, Queue-/Health-Responses, Run-Event-Payload)
  - Datei: `packages/shared/src/index.ts` Exporte erweitert
- Main-Prozess erweitert:
  - Datei: `apps/desktop/src/main/index.ts`
  - Neue IPCs:
    - `comfy:health`
    - `comfy:queue-run`
  - Projektstruktur erweitert um `workflows/` Verzeichnis.
  - Workflow-Template-Laden aus `workflows/<workflowId>.api.json`.
  - Placeholder-Aufloesung in JSON-Templates (z. B. `{{width}}`, `{{height}}`, `{{fps}}`, `{{frames}}`, `{{steps}}`, `{{imageAssetPath}}`, `{{clipAAssetAbsPath}}` etc.).
  - Asset-ID -> Asset-Pfad-Mapping aus geladenem `project.json`.
  - Submit an Comfy via `/prompt`, Polling ueber `/history/<prompt_id>`, Event-Push ueber `comfy:run-event`.
- Preload-Bridge erweitert:
  - Datei: `apps/desktop/src/preload/index.ts`
  - Neue Methoden:
    - `getComfyHealth()`
    - `queueComfyRun(payload)`
    - `onComfyRunEvent(listener)` (mit Unsubscribe)
- Renderer API/Typing erweitert:
  - Datei: `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - Datei: `apps/desktop/src/renderer/src/env.d.ts`
- Store auf echte Queue umgestellt:
  - Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - `queueSelectedWorkflowRun()` ist jetzt async und nutzt Main-IPC.
  - Comfy-Health (`comfyOnline`) per `checkComfyHealth()`.
  - Event-Bindung per `bindComfyRunEvents()` und Status-Mapping fuer `pending/running/success/failed`.
- UI-Anbindung:
  - Datei: `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
  - Startet Comfy-Healthcheck + Event-Bindung beim App-Start.
  - Datei: `apps/desktop/src/renderer/src/features/comfy/ComfyPanel.tsx`
  - Queue-Section zeigt aktive Runs + letzte Run-Statusmeldungen.

Wirkung:
- Workflows werden nicht mehr nur lokal vorgemerkt, sondern real an ComfyUI uebergeben.
- Neue Workflows bleiben erweiterbar:
  - TS-Contract im Renderer (`workflowContracts.ts`)
  - passendes `.api.json` Template im Projektordner `workflows/`.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/env.d.ts src/renderer/src/core/comfy/workflowContracts.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/comfy/ComfyPanel.tsx src/renderer/src/ui/layout/AppShell.tsx` (Workdir `apps/desktop`) OK
- `npx eslint src/comfy.ts src/index.ts` (Workdir `packages/shared`) OK
- Hinweis: Ein direkter ESLint-Lauf auf `apps/desktop/src/main/index.ts` meldet in dieser Repo-Konfiguration weiterhin `no-undef` fuer Node-Globals (`process`, `__dirname`, `NodeJS`, `fetch`, `setTimeout`), basierend auf der bestehenden ESLint-Basiskonfiguration.

## Aufgabe 24 - Hotfix: Renderer-Crash bei fehlender `onComfyRunEvent` API abgefangen

Rueckmeldung aus App-Dev-Console:
- `Uncaught TypeError: api.onComfyRunEvent is not a function`
- Folge: React crasht im `AppShell`-Mount, UI bleibt nur als Hintergrund sichtbar.

Ursachebild:
- Renderer erwartet neue Comfy-Bridge-Methoden.
- Wenn ein aelterer Preload-Stand aktiv ist (oder Bridge noch nicht neu geladen wurde), fehlen diese Funktionen zur Laufzeit.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- Runtime-Guards fuer:
  - `getComfyHealth`
  - `onComfyRunEvent`
  - `queueComfyRun`
- Fehlende Methoden fuehren nicht mehr zu einem Crash, sondern zu einem kontrollierten Fallback mit Hinweis:
  - `Comfy bridge unavailable in current preload. Restart app/dev process.`
- `AppShell`-Startup bleibt stabil, auch wenn der Preload noch alt ist.

Wirkung:
- Kein White/Blue-Screen mehr durch Comfy-Bridge-Init.
- App bleibt benutzbar; Comfy-Teil zeigt sauberen Hinweis statt Runtime-Abbruch.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/ui/layout/AppShell.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 25 - Workflow-Template-Import aus dem ComfyPanel verdrahtet

Der Upload-Button im Workflow-Menue war bisher nur UI-Placeholder. Er ist jetzt an einen echten Import-Flow gekoppelt, damit du dein exportiertes Comfy API JSON direkt pro Workflow ins Projekt uebernehmen kannst.

Umgesetzt:
- Main-Prozess:
  - Datei: `apps/desktop/src/main/index.ts`
  - Neuer IPC:
    - `project:import-workflow-template`
  - Neuer Import-Flow:
    - Dateidialog fuer JSON
    - JSON-Parse/Normalisierung
    - Speichern nach `workflows/<workflowId>.api.json` im aktiven Projektordner
- Preload:
  - Datei: `apps/desktop/src/preload/index.ts`
  - Neue Methode:
    - `importWorkflowTemplate(workflowId)`
- Renderer API/Typing:
  - Datei: `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - Datei: `apps/desktop/src/renderer/src/env.d.ts`
- Store:
  - Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
  - Neue Action:
    - `importWorkflowTemplateForSelected()`
  - Verwendet den selektierten Workflow und setzt sauberes UI-Feedback (`projectMessage`/`lastError`).
- ComfyPanel:
  - Datei: `apps/desktop/src/renderer/src/features/comfy/ComfyPanel.tsx`
  - Upload-Button ruft jetzt den echten Import auf (statt no-op).
  - Button ist deaktiviert, wenn kein Workflow selektiert ist.

Wirkung:
- Du kannst jetzt ohne manuelles Dateikopieren direkt in der App dein Comfy API JSON einem Workflow zuordnen.
- Der Queue-Flow nutzt danach automatisch das importierte Template (`workflows/<workflowId>.api.json`).

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/env.d.ts src/renderer/src/core/store/studioStore.ts src/renderer/src/features/comfy/ComfyPanel.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 26 - Workflow-Import/Persistenz-Followup gefixt (Upload ohne Auswahl + echtes Speichern)

Rueckmeldung:
- Upload wirkte, aber Workflows waren nicht dauerhaft gespeichert.
- Nach Loeschen beider Test-Workflows war Upload nicht mehr nutzbar.

Ursachen:
- Import war an einen selektierten Workflow gebunden.
- Workflow-Änderungen (`import`, `patch`, `remove`) wurden nicht durchgaengig in `project.workflowDefinitions` zurueckgeschrieben.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/core/store/studioStore.ts`
- `importWorkflowTemplateForSelected()` erweitert:
  - funktioniert jetzt auch ohne selektierten Workflow (ID-Prompt)
  - validiert Workflow-ID (`[a-zA-Z0-9_-]+`)
  - legt fehlende Workflows im Store an
  - schreibt Workflow als Upsert in `project.workflowDefinitions`
  - speichert `project.json` direkt nach erfolgreichem Import
- `removeWorkflow(...)` synchronisiert jetzt Loeschung auch in `project.workflowDefinitions` und markiert dirty.
- `patchWorkflow(...)` synchronisiert Parameteraenderungen ebenfalls in `project.workflowDefinitions` (Upsert + dirty).
- Hilfsfunktionen ergaenzt:
  - `promptForWorkflowId()`
  - `upsertWorkflowDefinitionInProject(...)`

- Datei: `apps/desktop/src/renderer/src/features/comfy/ComfyPanel.tsx`
- Upload-Button nicht mehr an selektierten Workflow gebunden (kein Disable mehr bei leerer Liste).
- Wenn kein Workflow selektiert ist, startet Import mit ID-Prompt.

Wirkung:
- Upload bleibt auch nach Loeschen der Test-Workflows nutzbar.
- Importierte Workflows bleiben nach Reload erhalten, weil sie in `project.json` (`workflowDefinitions`) persistiert werden.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/core/store/studioStore.ts src/renderer/src/features/comfy/ComfyPanel.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 27 - ComfyPanel bewusst geleert (Upload + Local-Workflow-UI entfernt)

Fuer den geplanten Umbau auf einen separaten Scene-Editor/Workflow-Studio-Tab wurde die rechte Comfy-Seitenleiste zunaechst bewusst auf einen neutralen, leeren Zustand reduziert.

Umgesetzt:
- Datei: `apps/desktop/src/renderer/src/features/comfy/ComfyPanel.tsx`
- Entfernt:
  - Upload-Button (UI-Trigger)
  - `Local Workflows` Liste
  - Workflow-Config-Bereich
  - Queue-/Run-Anzeige im Panel
- Beibehalten:
  - rechte Sidebar-Flaeche selbst (leer), damit Layout in `AppShell` stabil bleibt

Wirkung:
- Die rechte Seitenleiste bleibt sichtbar, aber ohne Workflow-Alt-UI.
- Basis fuer den naechsten Schritt: neuer Workflow/Scene-Editor-Tab ohne Konflikte mit der bisherigen Panel-Logik.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npx eslint src/renderer/src/features/comfy/ComfyPanel.tsx` (Workdir `apps/desktop`) OK

## Aufgabe 28 - Workflow-Meta-Vorlagen fuer priorisierte Workflows angelegt (Doku-Vorbereitung)

Vor dem eigentlichen Scene-Editor-Umbau wurden die vom User genannten Kern-Workflows als Dummy-`*.meta.json` Vorlagen vorbereitet, damit die spaetere Loader-/UI-Implementierung auf stabilen IDs/Namen basiert.

Umgesetzt:
- Neue Doku-Vorlagenstruktur:
  - `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/README.md`
  - `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/videos/*.meta.json`
  - `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/images/*.meta.json`
- Angelegte Video-Workflows:
  - `WAN Animate I2V`
  - `WAN Animate I+V2V`
  - `WAN Animate Face2V`
  - `WAN I2V Clip_Joiner`
- Angelegte Image-Workflows:
  - `Qwen Headswap`
  - `Flux In/ Outpint`
  - `Qwen Multi-Angle`
  - `SeedVR - Upscaler`
- Vorlagen enthalten:
  - `id`, `name`, `category`, `templateFile`, `inputs` (leer als Platzhalter), `defaults`
- `DOKUMENTATIONEN/ToDo.md` erweitert:
  - konkreter Startkatalog (User-Vorgabe)
  - Hinweis auf die angelegten Dummy-Vorlagen

Wirkung:
- Wir koennen den neuen Scene-Editor/Workflow-Studio-Tab als naechstes direkt gegen diese IDs/Namen entwickeln.
- Inputs koennen spaeter pro Workflow schrittweise nachgetragen werden, ohne die UI-Struktur neu zu planen.

Verifiziert:
- Doku-Dateien/Vorlagen im Repo angelegt und Pfade geprueft (kein Code-Check erforderlich)

## Aufgabe 29 - Workflow-Studio Grundstein: Meta-Typen + projekt-lokaler Katalog-Loader + erstes Tab-Layout

Der geplante Scene-Editor/Workflow-Studio-Umbau wurde mit einem ersten lauffaehigen Grundstein begonnen:
- `*.meta.json` ist typisiert
- projekt-lokaler Workflow-Katalog wird geladen
- der bisherige `Lab`-Tab zeigt jetzt ein erstes Workflow-Studio-Layout

Umgesetzt:
- Shared Typen fuer Workflow-Metadaten und Katalog eingefuehrt:
  - Datei: `packages/shared/src/workflows.ts`
  - Exporte erweitert in `packages/shared/src/index.ts`
- Main-Prozess erweitert:
  - Datei: `apps/desktop/src/main/index.ts`
  - Neuer IPC:
    - `project:list-workflow-catalog`
  - Loader liest projekt-lokale `*.meta.json` unter:
    - `workflows/images/*.meta.json`
    - `workflows/videos/*.meta.json`
    - `workflows/audio/*.meta.json`
  - Robustes Parsing/Validation mit Warnungen (defekte Meta-Dateien blockieren nicht den gesamten Katalog)
  - Katalog-Eintraege enthalten zusaetzlich:
    - `metaRelativePath`
    - `templateRelativePath`
    - `templateExists`
- Preload/Renderer-API/Window-Typing erweitert:
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer/src/core/adapters/projectApi.ts`
  - `apps/desktop/src/renderer/src/env.d.ts`
  - Neue Methode:
    - `listWorkflowCatalog()`
- Neues Workflow-Studio-UI (Grundlayout):
  - Datei: `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - 3-Spalten-Layout:
    - Kategorien (`Images`, `Videos`, `Audio`)
    - Workflow-Liste je Kategorie
    - Rechte Meta-/Details-Vorschau (Inputs + Defaults aus `*.meta.json`)
  - `Send to ComfyUI` bewusst noch deaktiviert (naechster Schritt)
- AppShell:
  - Datei: `apps/desktop/src/renderer/src/ui/layout/AppShell.tsx`
  - `Lab`-Tab zeigt jetzt `WorkflowStudioView`
  - Nav-Label auf `WF Studio` angepasst

Wirkung:
- Die Workflow-Verwaltung hat jetzt ein eigenes UI-Grundgeruest im separaten Tab.
- Projekt-lokale Workflow-Metas koennen ohne Upload aus festen Ordnern geladen und sichtbar gemacht werden.
- Basis fuer den naechsten Schritt (editierbare Inputs + Send an ComfyUI) ist gelegt.

Verifiziert:
- `npm run typecheck --workspace @ai-filmstudio/desktop` OK
- `npm run typecheck --workspace @ai-filmstudio/shared` OK
- `npx eslint src/preload/index.ts src/renderer/src/core/adapters/projectApi.ts src/renderer/src/env.d.ts src/renderer/src/ui/layout/AppShell.tsx src/renderer/src/features/workflows/WorkflowStudioView.tsx` (Workdir `apps/desktop`) OK
- `npx eslint src/workflows.ts src/index.ts` (Workdir `packages/shared`) OK
- Hinweis: Main-ESLint fuer `apps/desktop/src/main/index.ts` bleibt in dieser Repo-Konfiguration weiterhin von bekannten `no-undef`-Node-Global-Themen betroffen.
