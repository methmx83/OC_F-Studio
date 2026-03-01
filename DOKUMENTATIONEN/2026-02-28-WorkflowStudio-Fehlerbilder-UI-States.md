# Workflow-Studio Fehlerbilder: klare UI-States

Datum: 2026-02-28

## Ziel
Offene ToDo-Aufgabe **A.3** umsetzen: klare UI-States fuer folgende Fehlerbilder definieren:
- Template fehlt
- Placeholder fehlt
- Asset-Typ-Mismatch

## Scope
Diese Spezifikation definiert verbindliche Zustandsnamen, Trigger, User-Meldungen und CTA-Aktionen.
Sie ist bewusst UI-nah, aber ohne tiefe Code-Abhaengigkeiten.

## Verbindliche Status-Codes

### 1) `WF_TEMPLATE_MISSING`
- **Trigger:** referenzierte `*.api.json` Datei kann nicht gelesen werden / existiert nicht.
- **UI-Ort:** Workflow-Detailpanel (oben als Blocker-Banner), zusaetzlich im Queue-Result (falls erst bei Send erkannt).
- **Schweregrad:** blockierend (Send deaktivieren).
- **Meldung (kurz):**
  - Titel: `Workflow-Template nicht gefunden`
  - Text: `Die API-Datei fuer diesen Workflow fehlt oder ist nicht lesbar.`
- **CTA:**
  - `Ordner oeffnen`
  - `Neu laden`
- **Dev-Details (aufklappbar):** absoluter Pfad + OS-Fehlertext.

### 2) `WF_PLACEHOLDER_MISSING`
- **Trigger:** in Meta definierter Input/Setting kann im Template nicht aufgeloest werden.
- **UI-Ort:** direkt am betroffenen Feld + Sammelhinweis im Detailpanel.
- **Schweregrad:** blockierend (Send deaktivieren).
- **Meldung (kurz):**
  - Titel: `Platzhalter fehlt im Template`
  - Text: `Mindestens ein benoetigter Platzhalter ist im Workflow-Template nicht vorhanden.`
- **CTA:**
  - `Fehlende Platzhalter anzeigen`
  - `Meta pruefen`
- **Dev-Details (aufklappbar):** Liste `metaKey -> expectedPlaceholder`.

### 3) `WF_ASSET_TYPE_MISMATCH`
- **Trigger:** ausgewaehltes Asset passt nicht zum erwarteten Typ des Input-Feldes.
- **UI-Ort:** Inline-Fehler am Input-Feld; globaler Warnhinweis falls mehrere Konflikte.
- **Schweregrad:** blockierend fuer betroffene Workflows (Send deaktivieren).
- **Meldung (kurz):**
  - Titel: `Asset-Typ passt nicht`
  - Text: `Erwartet: {expectedType}, ausgewaehlt: {actualType}`
- **CTA:**
  - `Passendes Asset waehlen`
  - `Filter auf {expectedType}`
- **Dev-Details (aufklappbar):** inputKey, assetId, expected/actual type.

## Gemeinsame UI-Regeln
- Solange ein blockierender Fehler aktiv ist, bleibt `Send to ComfyUI` deaktiviert.
- Fehlerzustand muss ohne Seitenreload verschwinden, sobald Ursache behoben ist.
- Fehlertexte kurz halten, technische Details nur im aufklappbaren Bereich zeigen.
- Bei mehreren Fehlern: Prioritaet
  1. `WF_TEMPLATE_MISSING`
  2. `WF_PLACEHOLDER_MISSING`
  3. `WF_ASSET_TYPE_MISMATCH`

## Telemetrie/Logging (minimal)
Pro Fehlerzustand einmalig bei Auftreten loggen:
- `workflowId`
- `statusCode`
- `timestamp`
- `detailsHash` (stabile Kurzsignatur)

## Akzeptanzkriterien
- Alle 3 Fehlerbilder haben je einen eindeutigen Status-Code.
- `Send to ComfyUI` ist bei blockierenden Fehlern nicht ausfuehrbar.
- Jede Fehlersituation zeigt:
  - klare Kurzmeldung
  - mindestens eine konkrete CTA
  - technische Details getrennt von der User-Meldung.

## Ergebnis
ToDo-Punkt **A.3** ist damit als Spezifikation ausgearbeitet und umsetzungsreif dokumentiert.
