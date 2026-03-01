# 2026-02-28 – Workflow-Meta-Validator eingebaut

## Kontext
Zur Stabilisierung des Workflow-Studio-Flows wurde ein schneller Konsistenz-Check fuer `*.meta.json` eingefuehrt.

## Umsetzung
- Neues Skript: `scripts/validate-workflow-meta.mjs`
- Neues npm-Skript: `npm run validate:workflows`

## Gepruefte Regeln
- Kategorien nur `images | videos | audio` (Ordnerabgleich)
- `meta.category` muss zur Ordnerkategorie passen
- `inputs` muss Array sein
- `inputs[].key` muss vorhanden sein
- keine doppelten `inputs[].key`
- `inputs[].key` muss auf `AssetId` enden
- `inputs[].key` darf nicht auf `AssetAbsPath` enden
- Warnung bei fehlender passender `*.api.json`

## Ergebnis
- Lauf auf aktuellem Repo: **OK**
- Befehl:
  - `npm run validate:workflows`

## Nutzen
- Fruehes Erkennen typischer Meta-Fehler vor Laufzeit
- Konventionen aus der Workflow-Doku werden automatisch geprueft
