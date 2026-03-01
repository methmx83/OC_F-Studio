# ToDo - Offene Aufgaben / Naechste Umbauten

Letzte Aktualisierung: 2026-03-01

## 1) Workflow-Verwaltung aus Comfy-Panel herausloesen (Scene Editor Tab)

Status: Geplant (vom User priorisiert)

### Zielbild (abgestimmt)
- Der bisherige Workflow-Upload im Comfy-Panel wird entfernt.
- Die komplette Workflow-Verwaltung bekommt einen eigenen UI-Bereich / Tab (Scene Editor / Workflow Studio).
- Workflow-JSONs werden nicht per Upload in die UI gebracht.
- Workflow-JSONs liegen stattdessen in vordefinierten Ordnern und werden von der App geladen.
- Pro ausgewaehltem Workflow koennen Inputs + Basis-Settings gesetzt werden.
- Per Button `Send to ComfyUI` wird der passende Workflow mit eingesetzten Werten an ComfyUI gesendet.
- Generierung/Queue-Ausfuehrung kann initial weiterhin in ComfyUI selbst erfolgen (App sendet nur vorbereiteten Prompt/Workflow).

### Gewuenschtes UI-Konzept (User-Vorgabe)
- Linke Seitenleiste 1: Kategorie-Switch
  - `Images`
  - `Videos`
  - `Audio`
- Linke Seitenleiste 2: Workflow-Liste je Kategorie
  - z. B. `WF1`, `WF2`, `WF3`, `WF4`
- Rechte Seite: Workflow-Inputs + Settings
  - Asset-Referenzen (Bild / Video / Audio je nach Workflow)
  - `Aufloesung`
  - `FPS`
  - `Frames`
  - `Steps`
- Aktion:
  - `Send to ComfyUI`

### Geplanter Startkatalog (vom User vorgegeben)

#### Videos
- `WAN Animate I2V`
- `WAN Animate I+V2V`
- `WAN Animate Face2V`
- `WAN I2V Clip_Joiner`

#### Images
- `Qwen Headswap`
- `Flux In/ Outpint`
- `Qwen Multi-Angle`
- `SeedVR - Upscaler`

#### Audio
- spaeter (separater Schritt)

### Warum dieser Umbau sinnvoll ist (technisch)
- Kein stilles Ueberschreiben von Workflow-Dateien durch Upload-Button.
- Klare Trennung:
  - Comfy-Bridge / Senden
  - Workflow-Katalog / Auswahl / Parameter
- Reproduzierbarer Workflow-Stand durch feste Ordnerstruktur.
- Bessere Skalierbarkeit fuer mehrere Workflow-Familien (Images/Videos/Audio).

### Vorschlag zur Umsetzung (in kleinen Schritten)

#### Phase A - Umbau vorbereiten (klein und sicher)
- Upload-Button im bestehenden Comfy-Panel entfernen oder deaktivieren.
- Bestehende Comfy-Queue/Bridge nicht kaputt machen.
- Bestehendes Contract-System weiterverwenden, aber spaeter in neuen Tab integrieren.

#### Phase B - Neuer Scene-Editor / Workflow-Studio Tab (UI)
- Neuer Tab/View in der App-Shell (oder bestehenden `Lab`-Tab ersetzen/umbauen).
- 3-Spalten-Layout:
  - Kategorie-Sidebar
  - Workflow-Liste
  - Konfigurations-/Input-Bereich
- Erstes statisches UI mit Mock-Daten, dann an echte Datenquelle anbinden.
- Status:
  - begonnen / weitgehend umgesetzt (Tab-Layout + echte Kataloganzeige vorhanden)
  - Konfigurationsbereich jetzt editierbar (Settings + Asset-Inputs aus `*.meta.json`)
  - `Send to ComfyUI` ist im Workflow-Studio verdrahtet (bestehende Comfy-Bridge)
  - Audio-Inputs sind aktiv (Audio-Assets im Shared-Modell integriert)

#### Phase C - Workflow-Katalog aus Ordnern laden (Main + IPC)
- Main-Prozess liest vordefinierte Workflow-Ordner.
- Renderer bekommt ueber IPC eine Liste verfuegbarer Workflows je Kategorie.
- Keine Dateiuploads mehr im Renderer.
- Status:
  - begonnen / umgesetzt fuer `*.meta.json` Katalog via IPC `project:list-workflow-catalog`
  - naechster Schritt: UI-Editing/Send-Flow an diesen Katalog koppeln

#### Phase D - Workflow-Metadaten definieren (wichtig)
- Neben `.api.json` braucht die UI pro Workflow Metadaten:
  - Anzeigename
  - Kategorie
  - benoetigte Inputs (image/video/audio)
  - optionale Default-Werte (width/height/fps/frames/steps)
- Empfehlung:
  - `manifest.json` (global) oder pro Workflow `*.meta.json`
- Vorteil:
  - UI muss nicht aus der JSON-Struktur raten, welche Inputs gebraucht werden.

#### Phase E - Send to ComfyUI (bestehende Bridge nutzen)
- Auswahl + Eingaben im UI sammeln
- Platzhalter-Substitution auf bestehender Main-Seite nutzen
- Prompt/Workflow an ComfyUI senden
- Rueckmeldung im UI (queued / error / success message)
- Status:
  - begonnen / teilweise umgesetzt (Workflow-Studio sendet bereits katalogbasierte Workflows an `comfy:queue-run`)
  - Basis-Feedback im WF-Studio vorhanden (`queued`/`error`, `runId`, `promptId`)
  - Run-Progress/Output-Pfade werden jetzt im WF-Studio als `Recent Runs` pro Workflow angezeigt
  - Import von Comfy-Outputs in Projekt-Assets ist jetzt direkt im WF-Studio (`Recent Runs`) moeglich
  - Follow-up: optional Auto-Erkennung/Import mehrerer Outputs auf einmal oder "Import all outputs" pro Run

#### Phase F - Audio-Asset-Unterstuetzung sauber nachziehen
- Status: **Basis abgeschlossen** (Shared-Type `audio`, Import-Flow, Audio-Selection im Workflow-Studio, Preview-Playback).
- NÃ¤chster Ausbau:
  - echte Waveform-Peakdaten statt rein deterministischer Platzhalter-Bars
  - Audio-Metering / weiterfuehrende Audio-UX

### Empfohlene Ordnerstruktur (Vorschlag)
- `workflows/images/wf1.api.json`
- `workflows/images/wf2.api.json`
- `workflows/images/wf3.api.json`
- `workflows/images/wf4.api.json`
- `workflows/videos/wf1.api.json`
- `workflows/videos/wf2.api.json`
- `workflows/audio/wf1.api.json`
- optional: `workflows/manifest.json`

### Empfehlung fuer `manifest.json` (minimal)
- `id`
- `name`
- `category` (`images` | `videos` | `audio`)
- `templatePath`
- `inputs` (z. B. `image`, `video`, `audio`, `clipA`, `clipB`)
- `defaults` (`width`, `height`, `fps`, `frames`, `steps`)

### Zwischenstand Vorbereitung (bereits angelegt)
- Dummy-`*.meta.json` Vorlagen mit den obigen Workflow-Namen liegen im Repo unter:
  - `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/videos/`
  - `DOKUMENTATIONEN/Workflow-Meta-Vorlagen/images/`
- Diese dienen als Startpunkt fuer die spaetere projekt-lokale Ablage in `Projects\<Projekt>\workflows\...`

### Reales Setup (aktueller User-Stand, 2026-02-22)
- User nutzt bereits echte Comfy-Exporte (`Export (API)`) projekt-lokal im Projektordner, z. B.:
  - `D:\AFS_Projects\Projects\WSG\workflows\videos\Wan_Animate_V2V.api.json`
- Aktuelle Ordnerstruktur im Projekt ist vorbereitet:
  - `workflows\videos\` (befuellt)
  - `workflows\images\` (befuellt)
  - `workflows\audio\` (vorerst leer)
- Zu den API-Dateien liegen/entstehen `*.meta.json` im selben Kategorie-Ordner.

### Verbindliche Meta/API-Konventionen fuer den naechsten Implementierungsschritt
- `meta.inputs[].key` endet auf `...AssetId` (z. B. `refIMGAssetId`, `faceVidAssetId`, `PoseVidAssetId`)
- Platzhalter in `*.api.json` verwenden die abgeleiteten Pfadnamen (z. B. `{{refIMGAssetAbsPath}}`)
- Bei mehreren Inputs desselben Typs muessen unterschiedliche `key`-Namen verwendet werden (z. B. `videoAAssetId`, `videoBAssetId`)
- `category` ist exakt einer von:
  - `images`
  - `videos`
  - `audio`
- JSON-Dateien muessen strikt valide sein (kein trailing comma)

### Offene Punkte / Entscheidungen
- âœ… Erledigt (2026-03-01): Finaler Tab-Name ist `Workflow Studio`.
- ✅ Erledigt (2026-03-01): `Workflow Studio` ersetzt das bisherige `ComfyPanel` als Standardweg; das alte Panel bleibt nur temporaer hinter Feature-Flag fuer Fallback/Debug, bis Paritaet bestaetigt ist.
- âœ… Erledigt (2026-03-01): Workflows werden **nicht** hardcoded (`wf1..wf4`) gelistet, sondern katalog-/manifestbasiert (`*.meta.json` + optionales `manifest.json` als Overlay).
- ✅ Erledigt (2026-03-01): Audio-Support wurde im ersten Umbau umgesetzt (Basis abgeschlossen), weiterer Ausbau als kontinuierliche Phase 2.

### Akzeptanzkriterien (fuer ersten sinnvollen Stand)
- Kein Workflow-Upload-Button mehr im Comfy-Panel.
- Neuer Tab zeigt Kategorien + Workflows aus vordefiniertem Ordner/Manifest.
- Auswahl eines Workflows zeigt Eingaben + Basis-Settings.
- `Send to ComfyUI` sendet den richtigen Workflow mit den gesetzten Werten.
- Typecheck/Lint gruen.

---

## Update-Block 2026-02-28 (Ist-Stand + neue Ideen)

### Bereits umgesetzt (seit letzter ToDo-Pflege)
- Workflow-Studio: `Import all outputs` pro Run umgesetzt.
- Workflow-Meta-Validator eingefuehrt (`npm run validate:workflows`).
- Audio-Asset-Support end-to-end umgesetzt:
  - Shared Types (`Asset.type` inkl. `audio`)
  - Main/IPC/Preload/Renderer durchverdrahtet
  - Audio-Import + Asset-Library-Filter/Buttons
  - Workflow-Studio Audio-Inputs aktiv
  - Preview Audio-Playback integriert
- Timeline Audio Waveform Preview (read-only, deterministisch) integriert.
- Audio-Track UX: Mute/Solo pro Audio-Track integriert.
- Audio-Waveform-Pipeline auf echten Peaks verdrahtet:
  - FFmpeg-Extraktion + Cache-Reads (`cache/waveforms/`) im Main-Service
  - Renderer nutzt IPC-Peaks statt nur Pseudo-Bars
  - Import prewarm: Audio-Import triggert jetzt Peak-Generierung best-effort direkt beim Ingest

### Neue priorisierte ToDos (professioneller Ausbau)

#### A) Workflow Studio Haertung (hoch)
1. âœ… Erledigt (2026-02-28): Queue-Panel erweitert: `Retry failed run` + `Copy prompt payload`.
2. âœ… Erledigt (2026-02-28): Output-Import ausgebaut: `Import all supported outputs` mit Ergebniszusammenfassung (X importiert, Y uebersprungen, inkl. Grundcodes).
3. âœ… Erledigt (2026-02-28): Fehlerbilder praezisiert: klare UI-States fuer Template fehlt / Placeholder fehlt / Asset-Typ-Mismatch (siehe `DOKUMENTATIONEN/2026-02-28-WorkflowStudio-Fehlerbilder-UI-States.md`).

#### B) Audio-System Ausbau (hoch)
1. âœ… Erledigt (2026-02-28): Echte Waveform-Pipeline (nicht nur pseudo bars):
   - Audio-Peaks beim Import vorberechnen
   - Cache unter `cache/waveforms/`
   - Timeline nutzt echte Peakdaten.
2. âœ… Erledigt (2026-02-28): Audio-Preview verbessern:
   - sichtbare Lautstaerke-/Meter-Anzeige in der Preview (`PreviewStage`, WebAudio `AnalyserNode`, Live-Balken).
   - besseres Handling bei mehreren gleichzeitigen Audio-Clips (mehrere aktive Audio-Clips werden parallel geladen/synchronisiert/abgespielt, inkl. Mute/Solo-Respekt).

#### C) Timeline/Editor Profi-Funktionen (mittel-hoch)
1. âœ… Erledigt (2026-02-28): Track Controls erweitert um globale Reset-Aktion `Clear M/S` (setzt alle Audio-Mute/Solo-States zurueck).
2. âœ… Erledigt (2026-02-28): Clip Gain/Volume als erstes Audio-Attribut (UI + Store + Persistenz).
   - `Clip.gain` (0..2, Default 1) in Shared Types + Schema.
   - Timeline-UI: `-VOL / +VOL` auf selektiertem Audio-Clip inkl. Prozentanzeige.
   - Preview-Playback nutzt `clip.gain` pro Audio-Clip (auch bei Multi-Audio).
3. âœ… Erledigt (2026-02-28): Keyframe-Vorbereitung fuer Clip-Parameter (Datenmodell/Store-Slots).
   - `Clip.automation.gain[]` als vorbereiteter Keyframe-Slot (time/value, 0..2) in Shared Types + JSON-Schema.
   - Store-Action `setSelectedClipGainAutomation(points)` angelegt (sanitizing + sort by time + persist in timeline/project).
   - Engine/Command-Clone-Pfade auf `automation` erweitert (Copy/Cut/Move-Pfade verlieren Daten nicht).

#### D) Qualitaet + Betrieb (hoch)
1. âœ… Erledigt (2026-02-28): Zielgerichteter Audio-Smoke-Test als feste Checkliste in `scripts/smoke.md` ergaenzt.
2. âœ… Erledigt (2026-02-28): Workflow-Studio-Regression-Checkliste erweitert (Meta-Validator + Send + Output-Import).
3. âœ… Erledigt (2026-02-28): Doku-Synchronisierung abgeschlossen (`Kontext-Aktuell.md` und `Refactor_process.md` auf aktuellen Stand).

### Abarbeitung 2026-02-28 (dieser Lauf)
- Aufgabe 1: D.1 `Audio-Smoke-Test als feste Checkliste in scripts/smoke.md`.
  - Datei aktualisiert: `scripts/smoke.md`.
  - Neue Audio-Pruefpunkte ergaenzt:
    - Audio-Import + Library-Sichtbarkeit
    - Audio in Timeline + Waveform-Sichtbarkeit
    - Playback + Mute/Solo + `Clear M/S`
    - Workflow-Studio Audio-Input + `Send to ComfyUI` ohne Typ-Mismatch
- Aufgabe 2: B.1 `Echte Audio-Waveform-Pipeline`.
  - Datei aktualisiert: `apps/desktop/src/main/index.js`.
  - Audio-Import waermt Waveform-Cache jetzt direkt beim Ingest vor (best-effort).
  - Typecheck erfolgreich (`npm run typecheck`).
- Aufgabe 3: D.2 `Workflow-Studio-Regression-Checkliste erweitern`.
  - Datei aktualisiert: `scripts/smoke.md`.
  - Workflow-Studio-Smoketest um folgende Pflichtpunkte erweitert:
    - `npm run validate:workflows` als Meta-Validator-Schritt.
    - `Send to ComfyUI` inkl. erwarteter Queue-Rueckmeldung.
    - `Import all outputs` inkl. Ergebniszusammenfassung (X importiert, Y uebersprungen).
  - Nummerierung der Smoke-Schritte bereinigt (fortlaufend 1-11).

- Aufgabe 4: D.3 `Doku-Synchronisierung: Kontext-Aktuell.md + Refactor_process.md`.
  - Dateien aktualisiert:
    - `DOKUMENTATIONEN/Kontext-Aktuell.md`
    - `DOKUMENTATIONEN/Refactor_process.md`
  - Inhalte synchronisiert auf Stand 2026-02-28:
    - Workflow-Studio `Import all outputs`
    - Workflow-Meta-Validator (`npm run validate:workflows`)
    - Audio-Asset-Support end-to-end + Preview-Metering + Multi-Audio-Handling
    - echte Audio-Waveform-Pipeline mit FFmpeg-Peaks + Cache-Prefetch beim Import
    - Timeline-Audio-Ausbau (`Clear M/S`, `Clip.gain`, Keyframe-Slot `automation.gain[]`)

- Aufgabe 5: A.3 `Workflow-Studio Fehlerbilder praezisieren`.
  - Datei neu erstellt:
    - `DOKUMENTATIONEN/2026-02-28-WorkflowStudio-Fehlerbilder-UI-States.md`
  - Dokumentierte, verbindliche UI-States:
    - `WF_TEMPLATE_MISSING`
    - `WF_PLACEHOLDER_MISSING`
    - `WF_ASSET_TYPE_MISMATCH`
  - Pro Status definiert:
    - Trigger
    - User-Meldung
    - CTA-Aktionen
    - Blocker-Verhalten (`Send to ComfyUI` deaktiviert)
    - technische Detailanzeige
  - Akzeptanzkriterien ergaenzt fuer umsetzungsreife Implementierung.

- Aufgabe 6: A.1 `Queue-Panel erweitern: Retry failed run + Copy prompt payload`.
  - Datei aktualisiert:
    - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - Umgesetzte Schritte:
    - Run-Actions im Bereich `Recent Runs` ergaenzt:
      - `Copy prompt payload` (kopiert `run.request` als formatiertes JSON in die Zwischenablage)
      - `Retry failed run` (nur bei `failed` aktiv, queued neuen Run mit neuer `runId`)
    - UI-Feedback integriert:
      - `Copied`-Status mit kurzem Timeout
      - `Retrying...`-Status waehrend Re-Queue
      - Fehlerfeedback ueber bestehendes `Send Status`-Panel
    - Technische Haertung:
      - Retry nutzt vorhandene `queueComfyRun`-Bridge und gespeichertes Run-Request-Payload
      - Buttons respektieren `isProjectBusy` und Status-Gating
  - Validierung:
    - Workspace-Typecheck erfolgreich (`npm run typecheck`).

- Aufgabe 7: A.2 `Import all supported outputs` mit Ergebniszusammenfassung.
  - Dateien aktualisiert:
    - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
    - `DOKUMENTATIONEN/ToDo.md`
  - Umgesetzte Schritte:
    - `Import all` wertet nun deduplizierte Outputs aus und unterscheidet:
      - importierte Dateien
      - uebersprungene Dateien
      - Grundcodes (`UNSUPPORTED_EXTENSION`, `NO_CHANGE_OR_REJECTED`, `IMPORT_EXCEPTION`)
    - Ergebnis wird pro Run im UI unter `Outputs` angezeigt:
      - Format: `X importiert, Y uebersprungen (...)`
    - Fall ohne importierbare Typen ist explizit behandelt (Summary statt silent no-op).

- Aufgabe 8: Follow-up aus â€žNÃ¤chster empfohlener Arbeitsblockâ€œ umgesetzt (Detail-UX Ergebniszusammenfassung).
  - Datei aktualisiert:
    - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - Umgesetzte Schritte:
    - Grundcodes der `Import all`-Zusammenfassung auf menschenlesbare Labels umgestellt:
      - `UNSUPPORTED_EXTENSION` -> `Dateityp nicht unterstuetzt`
      - `NO_CHANGE_OR_REJECTED` -> `Nicht importiert (kein Aenderungseffekt/abgelehnt)`
      - `IMPORT_EXCEPTION` -> `Import-Fehler`
    - Uebersprungene Outputs werden jetzt mit Beispielpfaden im UI gezeigt (`max 3`), damit Fehler schneller nachvollziehbar sind.
    - `Import all`-Status speichert zusaetzlich `skippedExamples` pro Run fuer die Anzeige unter `Import-Ergebnis`.
  - Validierung:
    - `npm run typecheck` ausgefuehrt.
    - Ergebnis: fehlgeschlagen wegen bereits vorhandener Fehler in `src/renderer/src/features/timeline/TimelineDock.tsx` (u. a. `PIXELS_PER_SECOND`, `TRACK_KIND_ROTATION`, `SNAP_THRESHOLD_SECONDS`).
    - Kein neuer Typecheck-Fehler aus `WorkflowStudioView.tsx` sichtbar.

- Aufgabe 9: Typecheck-Status erneut verifiziert (offener Blocker aus Aufgabe 8 geschlossen).
  - Kontext:
    - In Aufgabe 8 war der Workspace-Typecheck rot.
  - Umgesetzte Schritte:
    - Erneut im Projektroot ausgefuehrt: `npm run typecheck`.
    - Ergebnis geprueft fuer alle Workspaces (`desktop`, `shared`).
  - Validierung:
    - Typecheck ist jetzt **gruen** (kein Fehlerauswurf).
  - Dokumentation:
    - Blocker-Status in dieser ToDo-Datei aktualisiert.

- Aufgabe 10: NÃ¤chster empfohlener Arbeitsblock umgesetzt: Inline-Filter in `Recent Runs` (all/queued/failed/success).
  - Datei aktualisiert:
    - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - Umgesetzte Schritte:
    - Run-Filter-State `runFilter` eingefuehrt (`all`, `queued`, `failed`, `success`).
    - Gefilterte Run-Liste (`filteredWorkflowRuns`) auf Basis von Run-Status implementiert.
    - `queued` fasst `pending` + `running` zusammen.
    - UI-Filterbuttons im Bereich `Recent Runs` integriert.
    - Counter erweitert auf `gefiltert/gesamt`.
    - Leerer Filterzustand (`Keine Runs fuer den aktiven Filter.`) als eigener UI-State hinzugefuegt.
  - Validierung:
    - Workspace-Typecheck erfolgreich (`npm run typecheck`).

- Aufgabe 11: NÃ¤chster empfohlener Arbeitsblock umgesetzt: Sortierung in `Recent Runs` (neueste/aelteste zuerst) inkl. Session-Persistenz.
  - Datei aktualisiert:
    - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
  - Umgesetzte Schritte:
    - Neuer Sortier-State `runSort` eingefuehrt (`newest`, `oldest`).
    - Initialwert wird aus `window.sessionStorage` geladen (`workflowStudio.recentRuns.sort`).
    - Sortierpraeferenz wird bei Aenderung wieder in `sessionStorage` gespeichert.
    - Gefilterte Run-Liste wird jetzt nach `createdAt` sortiert (`sortedFilteredWorkflowRuns`).
    - UI-Toggles im Bereich `Recent Runs` hinzugefuegt:
      - `Neueste zuerst`
      - `Aelteste zuerst`
  - Validierung:
    - Workspace-Typecheck erfolgreich (`npm run typecheck`).

- Aufgabe 12: NÃ¤chster empfohlener Arbeitsblock umgesetzt: Presets-MVP (Create/Apply/Delete) im Workflow-Studio.
  - Datei aktualisiert:
    - `apps/desktop/src/renderer/src/features/workflows/WorkflowStudioView.tsx`
    - `DOKUMENTATIONEN/ToDo.md`
  - Umgesetzte Schritte:
    - Preset-Datenmodell eingefuehrt (`WorkflowPreset` mit `name`, `draft`, Zeitstempeln).
    - Projektbezogene Persistenz im Renderer ergaenzt (`localStorage`-Key pro `projectRoot`).
    - UI im Settings-Bereich ergaenzt:
      - Preset-Name
      - Preset-Auswahl
      - `Apply`
      - `Save`
      - `Delete`
    - Verhalten umgesetzt:
      - Preset speichern (neu oder Update des aktuell gewaehlten Presets)
      - Preset auf aktuelle Workflow-Eingaben/Settings anwenden
      - Preset loeschen
      - Preset-Liste pro Workflow getrennt, max. 20 Presets je Workflow
  - Validierung:
    - Workspace-Typecheck erfolgreich (`npm run typecheck`).

### NÃ¤chster empfohlener Arbeitsblock
- Workflow-Presets auf echte projekt-lokale Dateien umstellen (statt `localStorage`), inkl. IPC-Read/Write und Konfliktverhalten bei externen Dateiaenderungen.

### Abarbeitung 2026-03-01 (Cron-Lauf FilmStudio)
- Aufgabe 17: Umsetzungsvorbereitung fuer projekt-lokale Workflow-Presets (Datei-basiert statt `localStorage`) dokumentiert.
  - Ziel:
    - Den offenen Block `Workflow-Presets auf echte projekt-lokale Dateien umstellen` konkretisieren, damit die Implementierung im naechsten Coding-Lauf deterministisch abgearbeitet werden kann.
  - Durchgefuehrte Schritte:
    1. Offenen Block in `NÃ¤chster empfohlener Arbeitsblock` geprueft und als aktive Prioritaet bestaetigt.
    2. Umsetzungs-Schnitt in klar trennbare Arbeitspakete zerlegt:
       - Main: Dateiservice fuer Presets (Read/Write, atomisch, schema-validiert)
       - IPC: `project:list-workflow-presets` / `project:save-workflow-preset` / `project:delete-workflow-preset`
       - Renderer: Umstellung der Preset-Quelle von `localStorage` auf IPC
       - Konfliktverhalten: Last-Write-Wins + Nutzerhinweis bei extern geaenderten Dateien
    3. Zielpfad fuer projekt-lokale Persistenz festgelegt:
       - `Projects/<Projekt>/workflows/presets/<workflowId>.presets.json`
    4. Akzeptanzkriterien fuer den Implementierungslauf festgehalten:
       - Presets bleiben nach App-Neustart erhalten.
       - Presets sind projekt-lokal (keine Vermischung zwischen Projekten).
       - Preset-CRUD funktioniert vollstaendig ohne `localStorage`.
       - Fehlerzustand bei defekter Preset-Datei zeigt klare UI-Meldung und blockiert App nicht.
  - Ergebnis:
    - Die offene Aufgabe ist technisch vorbereitet und als naechster Coding-Block eindeutig spezifiziert.
    - Die eigentliche Code-Umstellung (Main/IPC/Renderer) bleibt als unmittelbarer Folgeschritt offen.

### Abarbeitung 2026-03-01 (dieser Lauf)
- Aufgabe 13: Offenen Entscheid finalisiert: Tab-Name.
  - Ziel: einen der verbleibenden offenen Entscheidungs-Punkte verbindlich abschliessen.
  - Durchgefuehrte Schritte:
    1. Offene Punkte in dieser Datei geprueft.
    2. Bestehende UI-/Doku-Linie bewertet (mehrfache vorhandene Verwendung von `Workflow Studio`).
    3. Entscheidung festgesetzt und dokumentiert.
  - Ergebnis:
    - Finaler Name: `Workflow Studio`.
    - Punkt in `Offene Punkte / Entscheidungen` auf erledigt gesetzt.
  - Hinweis:
    - Diese Entscheidung reduziert inkonsistente Benennung in kÃ¼nftigen Tickets, PRs und UI-Texten.

- Aufgabe 14: Offenen Entscheid finalisiert: Workflow-Liste katalog-/manifestbasiert statt hardcoded.
  - Ziel: zweiten offenen Architekturpunkt verbindlich schliessen, damit die weitere Implementierung eindeutig bleibt.
  - Durchgefuehrte Schritte:
    1. Offenen Entscheid zur Workflow-Quelllogik in `Offene Punkte / Entscheidungen` geprueft.
    2. Bereits umgesetzten Stand abgeglichen (IPC-Katalog `project:list-workflow-catalog`, `*.meta.json`-basierte Anzeige).
    3. Entscheid formalisiert: kein Hardcoding nach `wf1..wf4`, stattdessen katalog-/manifestbasierte Auflistung.
    4. Entscheid in der ToDo-Datei als erledigt markiert.
  - Ergebnis:
    - Verbindliche Linie: `*.meta.json` als PrimÃ¤rquelle, optionales `manifest.json` als Overlay/Ergaenzung.
    - Reduziert Folgeaufwand bei neuen Workflows und vermeidet UI-Ã„nderungen fuer rein datengetriebene Katalog-Updates.

- Aufgabe 15: Offenen Entscheid finalisiert: Audio-Support im ersten Umbau vs. Phase 2.
  - Ziel: verbleibenden offenen Punkt in Offene Punkte / Entscheidungen aufloesen.
  - Durchgefuehrte Schritte:
    1. Offene Frage in der ToDo-Datei identifiziert.
    2. Ist-Stand gegen die umgesetzten Punkte abgeglichen (Audio-Asset-Support, Workflow-Studio Audio-Inputs, Preview-Playback, Waveform-Pipeline).
    3. Entscheidung formalisiert und als erledigt eingetragen.
  - Ergebnis:
    - Audio-Support ist bereits im ersten Umbau umgesetzt (Basis abgeschlossen).
    - Weitere Audio-Verbesserungen laufen als kontinuierlicher Ausbau (Phase 2), ohne die Grundsatzentscheidung erneut offen zu lassen.

- Aufgabe 16: Offenen Entscheid finalisiert: `ComfyPanel` ersetzen vs. parallel betreiben.
  - Ziel: letzten offenen Entscheidungs-Punkt in `Offene Punkte / Entscheidungen` schliessen.
  - Durchgefuehrte Schritte:
    1. Offenen Punkt in der ToDo-Datei identifiziert.
    2. Zielbild aus Abschnitt `Workflow-Verwaltung aus Comfy-Panel herausloesen` gegen den aktuellen Umbau-Stand abgeglichen.
    3. Betriebsstrategie festgelegt und als erledigt dokumentiert.
  - Ergebnis:
    - `Workflow Studio` ist der Standardweg und ersetzt funktional das bisherige `ComfyPanel`.
    - `ComfyPanel` bleibt nur temporaer als Fallback/Debug hinter Feature-Flag bestehen, bis die Paritaet bestaetigt ist.

- Aufgabe 18: Workflow-Presets (projekt-lokal) fuer Implementierung haerten: Dateiformat + IPC-Contract verbindlich dokumentiert.
  - Ziel: den offenen Block `Workflow-Presets auf echte projekt-lokale Dateien umstellen` so konkretisieren, dass der naechste Coding-Lauf direkt umsetzbar ist.
  - Durchgefuehrte Schritte:
    1. Offenen Block in `Nächster empfohlener Arbeitsblock` als aktive Aufgabe bestaetigt.
    2. Verbindliches Datei-Layout fuer Presets spezifiziert (`Projects/<Projekt>/workflows/presets/<workflowId>.presets.json`).
    3. JSON-Struktur v1 inklusive Feldregeln (`version`, `workflowId`, `presets[]`, Zeitstempel, Limits) definiert.
    4. IPC-Contract v1 festgelegt:
       - `project:list-workflow-presets`
       - `project:save-workflow-preset`
       - `project:delete-workflow-preset`
    5. Konfliktverhalten bei externen Dateiaenderungen spezifiziert (`expectedUpdatedAt`, `PRESET_CONFLICT`).
    6. Fehlercode-Katalog dokumentiert (`PRESET_FILE_INVALID_JSON`, `PRESET_SCHEMA_INVALID`, `PRESET_IO_ERROR`, ...).
    7. Ergebnis in neuer Doku-Datei abgelegt.
  - Dokumentation:
    - Neu: `DOKUMENTATIONEN/2026-03-01-Workflow-Presets-Dateiformat-und-IPC-Contract.md`
  - Ergebnis:
    - Der Implementierungspfad Main/IPC/Renderer ist jetzt eindeutig und ohne weitere Grundsatzentscheidungen umsetzbar.

### Abarbeitung 2026-03-01 (Cron-Lauf FilmStudio, 11:23)
- Aufgabe 19: Migrationsplan fuer Altbestand (`workflows/presets.json`) auf pro-Workflow-Presetdateien ausgearbeitet.
  - Ziel:
    - Eine offene Teilaufgabe des Blocks `Workflow-Presets auf echte projekt-lokale Dateien umstellen` konkret abschliessen: reproduzierbare Migration ohne Datenverlust.
  - Durchgefuehrte Schritte:
    1. Altformat (`workflows/presets.json`) und Zielformat (`workflows/presets/<workflowId>.presets.json`) verbindlich gegeneinander abgegrenzt.
    2. Deterministischen Migrationsablauf fuer den Erstlauf dokumentiert (Read-Prioritaet neu -> fallback alt -> schreiben neu -> Backup alt).
    3. Backup-Strategie statt stillem Loeschen festgelegt (`presets.migrated.<timestamp>.bak.json`).
    4. Validierungsregeln + Limits fuer das Zielformat als harte Regeln dokumentiert.
    5. Kurze Test-Checkliste fuer den nachfolgenden Coding-/QA-Lauf ergaenzt.
  - Dokumentation:
    - Neu: `DOKUMENTATIONEN/2026-03-01-Workflow-Presets-Migrationsplan-von-presets-json.md`
  - Ergebnis:
    - Ein konkreter, umsetzbarer Migrationspfad liegt vor.
    - Der eigentliche Code-Schritt (Main/IPC/Renderer-Implementierung) bleibt als naechster Arbeitsblock offen.

### Abarbeitung 2026-03-01 (Cron-Lauf FilmStudio, 12:24)
- Aufgabe 20: Verbindliche Smoke-/Akzeptanz-Checkliste fuer den Datei-basierten Workflow-Preset-Modus erstellt.
  - Ziel:
    - Eine weitere offene Teilaufgabe des Blocks `Workflow-Presets auf echte projekt-lokale Dateien umstellen` abschliessen: reproduzierbare QA-Abnahme ohne Interpretationsspielraum.
  - Durchgefuehrte Schritte:
    1. Offenen Preset-Block in dieser ToDo geprueft und als aktiven Schwerpunkt bestaetigt.
    2. Verbindlichen Test-Scope festgelegt (Preset-CRUD, Persistenz, Projekt-Isolation, Konfliktverhalten, defekte JSON-Datei).
    3. Deterministische Schrittfolge (1-7) fuer manuellen Smoke-Lauf definiert.
    4. Go/No-Go-Akzeptanzkriterien explizit festgelegt.
    5. Ergebnisprotokoll-Vorlage fuer den naechsten Coding-/QA-Lauf hinterlegt.
  - Dokumentation:
    - Neu: `DOKUMENTATIONEN/2026-03-01-Workflow-Preset-Dateimodus-Smoke-und-Akzeptanzcheck.md`
  - Ergebnis:
    - Die QA-Abnahme fuer den Preset-Dateimodus ist jetzt klar spezifiziert und direkt ausfuehrbar.
    - Offener Folgeschritt bleibt: technische Implementierung Main/IPC/Renderer.

## Neue Features (eingetragen durch Cron-Lauf am 2026-02-28)

### E) Workflow Presets + Parameter-Profile (hoch)
- Gespeicherte Presets pro Workflow (z. B. `Fast Preview`, `HQ Render`, `Social 9:16`).
- Presets speichern Default-Parameter (`Aufloesung`, `FPS`, `Frames`, `Steps`, ggf. Asset-Mapping-Regeln).
- Presets sind projekt-lokal versioniert und im Workflow-Studio direkt umschaltbar.
- Ziel: schnellere, reproduzierbare Runs ohne manuelles Neu-Setzen von Werten.

### F) Batch-Run Modus im Workflow-Studio (hoch)
- Ein Workflow kann fuer mehrere Asset-Kombinationen in einem Lauf vorbereitet und in Serie gequeued werden.
- Batch-Queue zeigt Fortschritt, Failures und Retry pro Batch-Item.
- Optionaler Dry-Run vor dem Senden (Placeholder/Asset-Validierung fuer alle Items).
- Ziel: deutlich weniger Handarbeit bei groesseren Produktionen.

### G) Timeline Audio Automation UI (mittel-hoch)
- Sichtbare Keyframe-UI fuer `automation.gain[]` direkt auf Audio-Clips.
- Interpolation (linear als Start) + schnelle Presets (Fade In/Out, Ducking-Basis).
- Preview respektiert Automation live waehrend Playback.
- Ziel: professionelleres Audiomixing ohne externes Tooling.


