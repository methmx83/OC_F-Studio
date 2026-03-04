# 2026-03-04 – Live-Test Kurzcheckliste (Comfy E2E)

## 5-Minuten Check
1. App starten, Projekt laden.
2. `WF Studio` oeffnen, Workflow waehlen, Inputs setzen.
3. `Comfy URL Override` pruefen, `Comfy Online` refresh.
4. `Send to ComfyUI` druecken.
5. In `Recent Runs` Statuswechsel pruefen (`pending/running/success` oder klarer Fehler).
6. Bei Erfolg: `Import all outputs`.
7. Falls `Auto-Place: ON`: pruefen, ob neue Assets in Timeline landen.
8. Optional: `Retry failed run` und `Cancel run` einmal testen.

## Erwartung
- Keine UI-Abstuerze.
- Fehler sind klar lesbar (kein stilles Fail).
- Output-Import reproduzierbar.