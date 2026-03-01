# 2026-03-01 – Workflow-Preset-Dateimodus: Smoke- und Akzeptanzcheck

## Ziel
Verbindliche, reproduzierbare Testschritte fuer den offenen Umbau
`Workflow-Presets auf echte projekt-lokale Dateien umstellen`.

Dieser Check dient als direkte Arbeitsgrundlage fuer den naechsten Coding-/QA-Lauf.

## Scope
- Preset-CRUD ueber Datei-basierten Speicher
- Projekt-Lokalitaet (keine Vermischung zwischen Projekten)
- Persistenz ueber App-Neustart
- Konfliktverhalten bei externen Dateiaenderungen
- Fehlertoleranz bei defekten Preset-Dateien

## Vorbedingungen
1. Build/Typecheck gruen.
2. Workflow Studio verfuegbar.
3. Testprojekt mit mindestens einem Workflow im Katalog vorhanden.
4. Zugriff auf Projektordner im Dateisystem.

## Testdaten
- Workflow-ID: frei waehlbar aus Katalog (Beispiel: `wan-animate-i2v`)
- Preset-Namen:
  - `Fast Preview`
  - `HQ Render`

## Smoke-Ablauf (manuell, deterministisch)

### 1) Preset anlegen (Datei wird erzeugt)
1. Projekt A oeffnen.
2. Im Workflow Studio einen Workflow waehlen.
3. Settings setzen (z. B. 1280x720, FPS 24, Frames 81, Steps 20).
4. Preset `Fast Preview` speichern.
5. Dateisystem pruefen:
   - Erwarteter Pfad: `Projects/<ProjektA>/workflows/presets/<workflowId>.presets.json`

Erwartung:
- Datei existiert.
- JSON ist valide.
- Preset ist in UI sichtbar.

### 2) Preset anwenden
1. Werte in UI bewusst aendern.
2. Preset `Fast Preview` auf `Apply`.

Erwartung:
- Werte entsprechen exakt dem gespeicherten Preset.
- Kein UI-Fehler.

### 3) Preset loeschen
1. Preset `Fast Preview` auswaehlen.
2. `Delete` ausfuehren.

Erwartung:
- Preset verschwindet aus UI.
- Dateiinhalt ist entsprechend aktualisiert.

### 4) Persistenz ueber Neustart
1. Preset `HQ Render` speichern.
2. App komplett schliessen.
3. App neu starten, Projekt A oeffnen, gleichen Workflow oeffnen.

Erwartung:
- `HQ Render` ist weiterhin vorhanden.
- Werte nach `Apply` korrekt.

### 5) Projekt-Isolation
1. Projekt B oeffnen (anderes Projekt).
2. Gleichen Workflow oeffnen.

Erwartung:
- Presets aus Projekt A tauchen in Projekt B nicht auf.

### 6) Externe Dateiaenderung + Konflikt
1. Projekt A offen lassen.
2. Preset-Datei extern editieren (z. B. Name oder Parameter aendern).
3. In UI erneut speichern (ohne Reload).

Erwartung:
- Definiertes Konfliktverhalten greift (`PRESET_CONFLICT` oder Last-Write-Wins gemaess finalem Contract).
- Klare User-Meldung, kein stilles Ueberschreiben ohne Hinweis.

### 7) Defekte JSON-Datei
1. Preset-Datei absichtlich ungueltig machen (z. B. fehlende Klammer).
2. Workflow Studio neu laden.

Erwartung:
- Klare Fehlermeldung (`PRESET_FILE_INVALID_JSON` / `PRESET_SCHEMA_INVALID`).
- App bleibt bedienbar.
- Kein Crash.

## Akzeptanzkriterien (Go/No-Go)
1. Preset-CRUD funktioniert ohne `localStorage`.
2. Presets sind projekt-lokal getrennt.
3. Presets bleiben nach Neustart erhalten.
4. Konflikte und Datei-Fehler werden sichtbar, reproduzierbar und ohne App-Absturz behandelt.
5. Typecheck/Lint bleiben gruen.

## Ergebnisprotokoll (auszufuellen nach Lauf)
- Datum/Uhrzeit:
- Commit/Branch:
- Durchgefuehrte Schritte: 1-7 (ja/nein + Notizen)
- Fehlercodes gesehen:
- Go/No-Go:
- Offene Nacharbeiten:
