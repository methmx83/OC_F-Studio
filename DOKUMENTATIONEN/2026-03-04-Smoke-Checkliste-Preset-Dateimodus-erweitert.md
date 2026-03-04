# 2026-03-04 – Smoke-Checkliste um Preset-Dateimodus erweitert

## Aufgabe
Naechsten ToDo-Block unterstuetzen: reproduzierbare QA fuer den neuen Preset-Dateimodus inkl. Migration/Conflict/Invalid-File.

## Umsetzung
Datei aktualisiert:
- `scripts/smoke.md`

Ergaenzt um neue Smoke-Punkte:
1. `Preset-Dateimodus Migration`
2. `Preset-Dateimodus Conflict-Guard`
3. `Preset-Dateimodus Invalid-File-Warnung`

## Ergebnis
Die manuelle Abnahme fuer den Preset-Dateimodus ist jetzt als direkte Schrittfolge dokumentiert und kann nach jedem Refactor gleich ausgefuehrt werden.