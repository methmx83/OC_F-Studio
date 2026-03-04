# Smoke Checklist (Desktop)

Ziel: schneller manueller Basis-Check nach Refactors ohne Feature-Tiefentest.

## Vorbereitung (PowerShell)

```powershell
npm install
npm run build --workspace @ai-filmstudio/shared
npm run typecheck --workspace @ai-filmstudio/desktop
npm run build --workspace @ai-filmstudio/desktop
```

App starten (Beispiel):

```powershell
npm run dev --workspace @ai-filmstudio/desktop
```

## Manueller Smoke (Desktop UI)

1. `New Project`
- Neues Projekt anlegen
- Header zeigt Projektname
- Keine Fehlermeldung / kein Crash

2. `Import Video`
- Video importieren
- Asset erscheint in Library mit Thumbnail
- (optional) Proxy wird im Hintergrund erzeugt / Status bleibt stabil

3. `Preview Playback`
- Video auf Timeline ziehen
- Play/Pause testen
- Playhead bewegt sich, Preview zeigt Bild/Video

4. `Proxy Toggle`
- Proxy-Modus im Preview ein/aus schalten
- Preview bleibt nutzbar (kein Hard-Crash)

5. `Workflow Studio Catalog + Meta-Validator`
- `WF Studio` öffnen
- Katalog lädt (oder zeigt erwartete Warnungen sauber)
- Workflow-Auswahl funktioniert
- In PowerShell ausführen: `npm run validate:workflows`
- Erwartung: Validator läuft ohne harte Fehler durch

6. `Workflow Studio Send + Output-Import`
- Einen Workflow mit gültigen Inputs konfigurieren
- `Send to ComfyUI` auslösen
- Erwartung: Queue-Rückmeldung (`queued` oder klarer Fehlerzustand)
- Nach fertigem Run `Import all outputs` ausführen
- Ergebniszusammenfassung prüfen (z. B. X importiert, Y übersprungen)

7. `Comfy Health` (optional)
- Comfy-Status aktualisieren
- Online/Offline wird angezeigt, ohne UI-Abbruch

8. `Audio Import + Library`
- Audio-Datei importieren (z. B. `.wav` oder `.mp3`)
- Asset erscheint in der Library als `Audio`
- Audio-Filter zeigt den Clip korrekt

9. `Audio Timeline + Waveform`
- Audio-Clip auf Timeline ziehen
- Waveform wird sichtbar gerendert (kein leerer Balken)
- Zoom/Scroll in Timeline bleibt stabil

10. `Audio Playback + Track UX`
- Play/Pause testen (Audio hoerbar / laeuft synchron mit Playhead)
- Mute/Solo auf Audio-Track toggeln
- `Clear M/S` setzt alle Audio-Mute/Solo-States zurueck

11. `Workflow Studio Audio Inputs`
- `WF Studio` oeffnen und einen Workflow mit Audio-Input waehlen
- Audio-Input laesst sich mit Audio-Asset verknuepfen
- `Send to ComfyUI` liefert keinen Typ-Mismatch-Fehler fuer Audio-Input

12. `Preset-Dateimodus Migration`
- In Projektordner eine Legacy-Datei `workflows/presets.json` mit mindestens 1 Preset anlegen
- `WF Studio` oeffnen
- Erwartung: Presets werden geladen
- Erwartung: Legacy-Backup wird erzeugt: `workflows/presets.migrated.<timestamp>.bak.json`
- Erwartung: neue Datei entsteht: `workflows/presets/<workflowId>.presets.json`

13. `Preset-Dateimodus Conflict-Guard`
- `WF Studio` geoeffnet lassen
- Extern (Dateieditor) dieselbe `*.presets.json` Datei aendern (updatedAt veraendern)
- In der App Preset speichern
- Erwartung: klare Meldung zu `PRESET_CONFLICT`
- Erwartung: UI laedt den externen Stand automatisch neu (kein stilles Ueberschreiben)

14. `Preset-Dateimodus Invalid-File-Warnung`
- Eine `workflows/presets/<workflowId>.presets.json` absichtlich ungueltig machen (JSON kaputt)
- App/Tab neu laden
- Erwartung: Presets laden weiterhin, aber mit Warning-Message zu ignorierten invalid files

## Dokumentation (Refactor)

Ergebnis in `DOKUMENTATIONEN/Refactor_process.md` eintragen:
- Datum
- was getestet wurde
- Ergebnis
- offene Punkte
